import { fetchAndCreateEdges } from './flowFetchAndCreateEdges';
import { fitViewToFlow } from './flowFunctions';
export const GROUP_NODE_WIDTH = 300;

export async function generateNodesAndEdges(params) {
    const {
        rowData,
        stateScores,
        getHighestScoringContainer,
        parentChildMap,
        groupByLayers,
        activeLayers,
        layerOptions,
        layoutPositions,    // <-- add this
    } = params;

    if (!rowData || rowData.length === 0) return;

    // Get highest scoring container ID
    const highestScoringId = getHighestScoringContainer?.();

    // Calculate min and max scores for normalization
    const scoreValues = Object.values(stateScores || {}).filter(score => typeof score === 'number');
    const minScore = scoreValues.length > 0 ? Math.min(...scoreValues) : 0;
    const maxScore = scoreValues.length > 0 ? Math.max(...scoreValues) : 1;
    const scoreRange = maxScore - minScore || 1;

    // Normalize score function
    const normalizeScore = (score) => {
        if (typeof score !== 'number') return undefined;
        return (score - minScore) / scoreRange;
    };

    let computedNodes = [];
    let childToGroup = {};

    // Helper to get position
    const getNodePosition = (id, fallback) => {
        if (layoutPositions && layoutPositions[id]) {
            return layoutPositions[id];
        }
        return fallback;
    };

    const layersToUse = Array.isArray(activeLayers) && activeLayers.length > 0
        ? activeLayers
        : Array.isArray(layerOptions) ? layerOptions : [];

    if (groupByLayers && layersToUse.length > 0) {
        // --- GROUP BY LAYERS MODE ---
        // 1. Create group nodes for each layer in layersToUse
        const layerGroups = layersToUse.map((layer, i) => {
            const saved = layoutPositions?.[`layer-${layer}`] || {};
            return {
                id: `layer-${layer}`,
                type: 'group',
                data: { Name: layer, children: [] },
                style: {
                    width: saved.width || GROUP_NODE_WIDTH,
                    height: saved.height || 180,
                },
                position: saved.x !== undefined && saved.y !== undefined
                    ? { x: saved.x, y: saved.y }
                    : { x: 100 * i, y: 0 }
            }
        });

        // 2. Assign parentId for each node tagged with a layer
        rowData.forEach((item, index) => {
            const tags = (item.Tags || '').toLowerCase().split(',').map(t => t.trim());
            const matchedLayer = layersToUse.find(l => tags.includes(l.toLowerCase()));
            if (matchedLayer) {
                childToGroup[item.id?.toString()] = `layer-${matchedLayer}`;
            }
        });

        // 3. Map nodes, assign parentId if in childToGroup
        const childNodes = rowData.map((item, index) => {
            const parentId = childToGroup[item.id?.toString()];
            return {
                id: item.id.toString(),
                position: getNodePosition(
                    item.id.toString(),
                    parentId
                        ? { x: 40 + (index % 2) * 120, y: 40 + Math.floor(index / 2) * 80 }
                        : { x: 100 * index, y: 100 * index }
                ),
                data: {
                    id: item.id,
                    Name: item.Name || `Node ${item.id}`,
                    Description: item.Description || '',
                    Budget: item.Budget || undefined,
                    Cost: item.Cost || undefined,
                    Tags: item.Tags || '',
                    isHighestScoring: highestScoringId === item.id?.toString(),
                    score: stateScores?.[item.id],
                    normalizedScore: normalizeScore(stateScores?.[item.id]),
                    PendingEdges: item.PendingEdges || [],
                },
                type: 'custom',
                ...(parentId ? { parentId, extent: 'parent' } : {}),
            };
        });

        computedNodes = [...layerGroups, ...childNodes];
    } else {
        // --- DEFAULT GROUP BY TAGS MODE ---
        // Build a lookup: childId -> parentId (for group nodes)
        const groupIds = rowData
            .filter(item => (item.Tags || '').toLowerCase().split(',').map(t => t.trim()).includes('group'))
            .map(item => item.id?.toString());

        if (parentChildMap) {
            parentChildMap.forEach(({ container_id, children }) => {
                if (groupIds.includes(container_id?.toString())) {
                    children.forEach(child => {
                        // Find the child node in rowData to check if it's a group
                        const childItem = rowData.find(item => item.id?.toString() === child.id?.toString());
                        const childTags = (childItem?.Tags || '').toLowerCase().split(',').map(t => t.trim());
                        const childIsGroup = childTags.includes('group');
                        // Only assign parentId if not a group and not a 'successor' relationship
                        if (!childIsGroup && child.label !== 'successor') {
                            childToGroup[child.id?.toString()] = container_id?.toString();
                        }
                    });
                }
            });
        }

        computedNodes = rowData.map((item, index) => {
            const tags = (item.Tags || '')
                .toLowerCase()
                .split(',')
                .map(t => t.trim());
            const isGroup = tags.includes('group');
            const parentId = childToGroup[item.id?.toString()];

            let fallbackPosition;
            if (parentId) {
                const siblings = Object.entries(childToGroup)
                    .filter(([cid, pid]) => pid === parentId)
                    .map(([cid]) => cid);
                const childIndex = siblings.indexOf(item.id?.toString());
                const col = childIndex % 2;
                const row = Math.floor(childIndex / 2);
                fallbackPosition = { x: 40 + col * 120, y: 40 + row * 80 };
            } else {
                const parsedPosition = (() => {
                    const pos = item.Position;
                    if (!pos) return null;
                    if (typeof pos === 'string') {
                        try {
                            const obj = JSON.parse(pos);
                            if (obj && typeof obj.x === 'number' && typeof obj.y === 'number') {
                                return { x: obj.x, y: obj.y };
                            }
                            const [x, y] = pos.split(',').map(Number);
                            if (!isNaN(x) && !isNaN(y)) return { x, y };
                        } catch (e) {
                            const [x, y] = pos.split(',').map(Number);
                            if (!isNaN(x) && !isNaN(y)) return { x, y };
                        }
                    } else if (typeof pos === 'object' && pos !== null &&
                        typeof pos.x === 'number' && typeof pos.y === 'number') {
                        return { x: pos.x, y: pos.y };
                    }
                    return null;
                })();
                fallbackPosition = parsedPosition || { x: 100 * index, y: 100 * index };
            }

            return {
                id: item.id.toString(),
                position: getNodePosition(item.id.toString(), fallbackPosition), // <-- use getNodePosition
                data: {
                    id: item.id,
                    Name: item.Name || `Node ${item.id}`,
                    Description: item.Description || '',
                    Budget: item.Budget || undefined,
                    Cost: item.Cost || undefined,
                    Tags: item.Tags || '',
                    isHighestScoring: highestScoringId === item.id?.toString(),
                    score: stateScores?.[item.id],
                    normalizedScore: normalizeScore(stateScores?.[item.id]),
                    PendingEdges: item.PendingEdges || [],
                },
                type: isGroup ? 'group' : 'custom',
                style: isGroup ? { width: GROUP_NODE_WIDTH, height: 180 } : {},
                ...(parentId ? { parentId, extent: 'parent' } : {}),
            };
        });
    }

    // Sort: group nodes first, then others
    computedNodes.sort((a, b) => {
        if (a.type === 'group' && b.type !== 'group') return -1;
        if (a.type !== 'group' && b.type === 'group') return 1;
        return 0;
    });

    // No more activeGroup logic needed!
    // console.log(computedNodes);
    await fetchAndCreateEdges(computedNodes, params);
    fitViewToFlow();
}



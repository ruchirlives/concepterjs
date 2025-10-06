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
        keepLayout,         // <-- add this
        layoutPositions,    // <-- add this
        showGroupNodes,
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
        if (keepLayout && layoutPositions && layoutPositions[id]) {
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
                type: showGroupNodes ? 'group' : 'custom',
                data: { Name: layer, children: [] },
                style: showGroupNodes
                    ? {
                        width: saved.width || GROUP_NODE_WIDTH,
                        height: saved.height || 180,
                    }
                    : {},
                position: saved.x !== undefined && saved.y !== undefined
                    ? { x: saved.x, y: saved.y }
                    : { x: 100 * i, y: 0 }
            }
        });

        // 2. For each row, create a clone inside every matching layer group
        const childNodes = [];
        rowData.forEach((item, index) => {
            const tags = (item.Tags || '').toLowerCase().split(',').map(t => t.trim());
            const matchedLayers = layersToUse.filter(l => tags.includes(l.toLowerCase()));
            if (matchedLayers.length === 0) return; // skip if no matching layer

            matchedLayers.forEach((layer, li) => {
                const parentId = `layer-${layer}`;
                const cloneId = `${item.id.toString()}__in__${parentId}`;
                if (showGroupNodes) {
                    childToGroup[cloneId] = parentId;
                }
                childNodes.push({
                    id: cloneId,
                    position: getNodePosition(
                        cloneId,
                        { x: 40 + ((index + li) % 2) * 120, y: 40 + Math.floor((index + li) / 2) * 80 }
                    ),
                    data: {
                        id: item.id,               // original id
                        originalId: item.id,       // explicit original id
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
                    ...(showGroupNodes ? { parentId, extent: 'parent' } : {}),
                });
            });
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
                        if (showGroupNodes && !childIsGroup && child.label !== 'successor') {
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
                fallbackPosition = { x: 100 * index, y: 100 * index };
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
                type: isGroup && showGroupNodes ? 'group' : 'custom',
                style: isGroup && showGroupNodes ? { width: GROUP_NODE_WIDTH, height: 180 } : {},
                ...(showGroupNodes && parentId ? { parentId, extent: 'parent' } : {}),
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



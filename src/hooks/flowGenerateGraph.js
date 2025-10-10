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
        autoFit = true,
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
        // Allow multi-membership by cloning children into each parent group
        // Build a lookup: groupIds and parentsByChild (childId -> [parentIds])
        const groupIds = rowData
            .filter(item => (item.Tags || '').toLowerCase().split(',').map(t => t.trim()).includes('group'))
            .map(item => item.id?.toString());

        const parentsByChild = {};
        if (parentChildMap) {
            parentChildMap.forEach(({ container_id, children }) => {
                if (!groupIds.includes(container_id?.toString())) return;
                const cleanChildren = children.filter(c => c.label !== 'successor');
                cleanChildren.forEach(child => {
                    // Skip if child itself is a group
                    const childItem = rowData.find(r => r.id?.toString() === child.id?.toString());
                    const childTags = (childItem?.Tags || '').toLowerCase().split(',').map(t => t.trim());
                    const childIsGroup = childTags.includes('group');
                    if (childIsGroup) return;
                    const cid = child.id?.toString();
                    if (!parentsByChild[cid]) parentsByChild[cid] = [];
                    if (!parentsByChild[cid].includes(container_id?.toString())) {
                        parentsByChild[cid].push(container_id?.toString());
                    }
                });
            });
        }

        computedNodes = [];
        rowData.forEach((item, index) => {
            const tags = (item.Tags || '')
                .toLowerCase()
                .split(',')
                .map(t => t.trim());
            const isGroup = tags.includes('group');
            const origId = item.id.toString();

            if (isGroup && showGroupNodes) {
                computedNodes.push({
                    id: origId,
                    position: getNodePosition(origId, { x: 100 * index, y: 100 * index }),
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
                    type: 'group',
                    style: { width: GROUP_NODE_WIDTH, height: 180 },
                });
                return;
            }

            const parentIds = showGroupNodes ? (parentsByChild[origId] || []) : [];
            if (parentIds.length > 0 && showGroupNodes) {
                parentIds.forEach((parentId, pi) => {
                    const cloneId = `${origId}__in__${parentId}`;
                    computedNodes.push({
                        id: cloneId,
                        position: getNodePosition(
                            cloneId,
                            { x: 40 + ((index + pi) % 2) * 120, y: 40 + Math.floor((index + pi) / 2) * 80 }
                        ),
                        data: {
                            id: item.id,
                            originalId: item.id,
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
                        parentId,
                        extent: 'parent',
                    });
                });
            } else {
                // No parents or not showing groups: render single node
                computedNodes.push({
                    id: origId,
                    position: getNodePosition(origId, { x: 100 * index, y: 100 * index }),
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
                });
            }
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
    if (autoFit) {
        fitViewToFlow();
    }
}



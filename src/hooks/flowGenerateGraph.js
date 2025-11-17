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
        rowSelectedLayer,
        columnSelectedLayer,
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

    const toKey = (value) => (value != null ? value.toString() : null);
    const normalize = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
    const splitTags = (tags) => (tags || '')
        .split(',')
        .map(tag => tag.trim().toLowerCase())
        .filter(Boolean);

    const rowLayerTag = normalize(rowSelectedLayer);
    const columnLayerTag = normalize(columnSelectedLayer);

    const rowLayerNodes = new Set();
    const columnLayerNodes = new Set();
    rowData.forEach(item => {
        const key = toKey(item?.id);
        if (!key) return;
        const tags = splitTags(item?.Tags);
        if (rowLayerTag && tags.includes(rowLayerTag)) {
            rowLayerNodes.add(key);
        }
        if (columnLayerTag && tags.includes(columnLayerTag)) {
            columnLayerNodes.add(key);
        }
    });

    const idToLabel = new Map();
    rowData.forEach((item) => {
        const key = toKey(item?.id);
        if (!key) return;
        idToLabel.set(key, item?.Name || `Node ${item?.id ?? ''}`);
    });

    const buildChildLookup = () => {
        const map = new Map();
        (parentChildMap || []).forEach(({ container_id, children }) => {
            const key = toKey(container_id);
            if (!key) return;
            map.set(key, Array.isArray(children) ? children : []);
        });
        return map;
    };

    const childLookup = buildChildLookup();
    const buildAssignments = (sourceIds) => {
        const assignments = new Map();
        sourceIds.forEach(parentId => {
            const children = childLookup.get(parentId) || [];
            children.forEach(child => {
                const childId = toKey(child?.id);
                if (!childId) return;
                if (!assignments.has(childId)) {
                    assignments.set(childId, []);
                }
                assignments.get(childId).push({
                    parentId,
                    label: idToLabel.get(parentId) || '',
                });
            });
        });
        return assignments;
    };

    const rowAssignments = buildAssignments(rowLayerNodes);
    const columnAssignments = buildAssignments(columnLayerNodes);

    const buildGridAssignment = (originalId) => {
        if (!originalId) return null;
        const rowEntries = rowAssignments.get(originalId);
        const columnEntries = columnAssignments.get(originalId);
        if (!rowEntries && !columnEntries) return null;
        const normalizeEntries = (entries) => {
            if (!Array.isArray(entries)) return [];
            return entries.map(({ parentId, label }) => ({
                parentId,
                label: label || '',
            }));
        };
        const rowData = normalizeEntries(rowEntries);
        const columnData = normalizeEntries(columnEntries);
        return {
            rowId: rowData[0]?.parentId ?? null,
            rowIds: rowData.map((entry) => entry.parentId),
            rowLabels: rowData.map((entry) => entry.label),
            columnId: columnData[0]?.parentId ?? null,
            columnIds: columnData.map((entry) => entry.parentId),
            columnLabels: columnData.map((entry) => entry.label),
        };
    };

    const shouldHideNode = (id) => {
        if (!id) return false;
        return rowLayerNodes.has(id) || columnLayerNodes.has(id);
    };

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

            const origId = toKey(item.id);
            if (!origId || shouldHideNode(origId)) return;

            const gridAssignment = buildGridAssignment(origId);

            matchedLayers.forEach((layer, li) => {
                const parentId = `layer-${layer}`;
                const cloneId = `${item.id.toString()}__in__${parentId}`;
                if (showGroupNodes) {
                    childToGroup[cloneId] = parentId;
                }
                const nodeData = {
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
                };
                if (gridAssignment) {
                    nodeData.gridAssignment = gridAssignment;
                }
                childNodes.push({
                    id: cloneId,
                    position: getNodePosition(
                        cloneId,
                        { x: 40 + ((index + li) % 2) * 120, y: 40 + Math.floor((index + li) / 2) * 80 }
                    ),
                    data: nodeData,
                    ...(gridAssignment ? { gridAssignment } : {}),
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

            if (shouldHideNode(origId)) {
                return;
            }

            const gridAssignment = buildGridAssignment(origId);

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
                    ...(gridAssignment ? { gridAssignment } : {}),
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
                            ...(gridAssignment ? { gridAssignment } : {}),
                        },
                        ...(gridAssignment ? { gridAssignment } : {}),
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
                        ...(gridAssignment ? { gridAssignment } : {}),
                    },
                    ...(gridAssignment ? { gridAssignment } : {}),
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



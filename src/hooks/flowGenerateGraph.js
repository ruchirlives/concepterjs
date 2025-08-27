import { fetchAndCreateEdges } from './flowFetchAndCreateEdges';
import { fitViewToFlow } from './flowFunctions';
export const GROUP_NODE_WIDTH = 300;

export async function generateNodesAndEdges(params) {
    const {
        rowData,
        stateScores,
        getHighestScoringContainer,
        parentChildMap // <-- make sure this is passed in!
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

    // Build a lookup: childId -> parentId (for group nodes)
    const groupIds = rowData
        .filter(item => (item.Tags || '').toLowerCase().split(',').map(t => t.trim()).includes('group'))
        .map(item => item.id?.toString());

    const childToGroup = {};
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

    // Now, map nodes and assign parentId if in childToGroup
    let computedNodes = rowData.map((item, index) => {
        const tags = (item.Tags || '')
            .toLowerCase()
            .split(',')
            .map(t => t.trim());
        const isGroup = tags.includes('group');
        const parentId = childToGroup[item.id?.toString()];

        // Position: relative for children, absolute for others
        let position;
        if (parentId) {
            // Place children in a grid inside the group
            const siblings = Object.entries(childToGroup)
                .filter(([cid, pid]) => pid === parentId)
                .map(([cid]) => cid);
            const childIndex = siblings.indexOf(item.id?.toString());
            const col = childIndex % 2;
            const row = Math.floor(childIndex / 2);
            position = { x: 40 + col * 120, y: 40 + row * 80 };
        } else {
            position = { x: 100 * index, y: 100 * index };
        }

        return {
            id: item.id.toString(),
            position,
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

    // Sort: group nodes first, then others
    computedNodes.sort((a, b) => {
        if (a.type === 'group' && b.type !== 'group') return -1;
        if (a.type !== 'group' && b.type === 'group') return 1;
        return 0;
    });

    // No more activeGroup logic needed!
    console.log(computedNodes);
    await fetchAndCreateEdges(computedNodes, params);
    fitViewToFlow();
}



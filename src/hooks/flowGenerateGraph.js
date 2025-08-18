import { fetchAndCreateEdges } from './flowFetchAndCreateEdges';
import { fitViewToFlow } from './flowFunctions';
export const GROUP_NODE_WIDTH = 300;

export function generateNodesAndEdges(params) {
    const { 
        rowData, 
        setNodes, 
        stateScores, 
        getHighestScoringContainer 
    } = params;
    
    if (!rowData || rowData.length === 0) return;

    // Get highest scoring container ID
    const highestScoringId = getHighestScoringContainer?.();

    // Calculate min and max scores for normalization
    const scoreValues = Object.values(stateScores || {}).filter(score => typeof score === 'number');
    const minScore = scoreValues.length > 0 ? Math.min(...scoreValues) : 0;
    const maxScore = scoreValues.length > 0 ? Math.max(...scoreValues) : 1;
    const scoreRange = maxScore - minScore || 1; // Avoid division by zero

    // Normalize score function
    const normalizeScore = (score) => {
        if (typeof score !== 'number') return undefined;
        return (score - minScore) / scoreRange;
    };

    // Build initial computedNodes with group vs custom types
    let computedNodes = rowData.map((item, index) => {
        const tags = (item.Tags || '')
            .toLowerCase()
            .split(',')
            .map(t => t.trim());
        const isGroup = tags.includes('group');

        return {
            id: item.id.toString(),
            position: { x: 100 * index, y: 100 * index },
            data: {
                id: item.id,
                Name: item.Name || `Node ${item.id}`,
                Description: item.Description || '',
                Budget: item.Budget || undefined,
                Cost: item.Cost || undefined,
                Tags: item.Tags || '',
                // Add scoring data
                isHighestScoring: highestScoringId === item.id?.toString(),
                score: stateScores?.[item.id],
                normalizedScore: normalizeScore(stateScores?.[item.id]),
                PendingEdges: item.PendingEdges || [],
            },
            type: isGroup ? 'group' : 'custom',
            style: { width: GROUP_NODE_WIDTH },
        };
    });

    fetchAndCreateEdges(computedNodes, params);
    fitViewToFlow();
    setNodes(computedNodes);
}



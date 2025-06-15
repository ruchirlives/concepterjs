import { fetchAndCreateEdges } from './flowFetchAndCreateEdges';
import { fitViewToFlow } from './flowFunctions';
export const GROUP_NODE_WIDTH = 300;

export function generateNodesAndEdges(params) {
    const { rowData } = params;
    if (!rowData || rowData.length === 0) return;

    // 1️⃣ Build initial computedNodes with group vs custom types
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
                Horizon: item.Horizon || '',
                Tags: item.Tags || '',
            },
            type: isGroup ? 'group' : 'custom',
            style: { width: GROUP_NODE_WIDTH }, // ← critical!
        };
    });


    fetchAndCreateEdges(computedNodes, params);
    // Fit the view to the nodes and edges
    fitViewToFlow();
}



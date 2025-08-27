import colors from "tailwindcss/colors";
import { MarkerType } from '@xyflow/react';

export function buildVisibleEdges(params) {
    const { childMap, computedNodes: visibleNodes, allNodes } = params;
    const newEdges = [];

    // Build lookup of every node by id
    const nodeById = {};
    allNodes.forEach(n => { nodeById[n.id] = n; });

    // For each parent node, create edges to children,
    // but skip if the child is a direct child of a group (handled by parentId)
    visibleNodes.forEach(parentNode => {
        const parentId = parentNode.id;
        const children = childMap[parentId] || [];

        children.forEach(c => {
            const childId = c.id;
            const childNode = nodeById[childId];

            // Skip edge if child is a direct child of this group (handled by parentId)
            if (childNode?.parentId === parentId) return;

            const edgeId = `${parentId}-to-${childId}`;
            if (!newEdges.some(e => e.id === edgeId)) {
                newEdges.push({
                    id: edgeId,
                    source: parentId,
                    target: childId,
                    type: 'customEdge',
                    style: { stroke: colors.black }
                });
            }
        });
    });

    // Optionally, keep your advanced ancestor/buried logic here if needed

    return newEdges;
}

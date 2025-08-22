import dagre from 'dagre';

function estimateNodeHeight(label, width, fontSize = 16, paddingY = 16) {
    const charsPerLine = Math.floor(width / (fontSize * 0.6));
    const lines = Math.ceil(label.length / charsPerLine);
    const lineHeight = fontSize * 1.25;
    return Math.max(48, lines * lineHeight + paddingY);
}

export const getLayoutedElements = (
    nodes,
    edges,
    direction = 'LR',
    nodesep = 35,
    ranksep = 100
) => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: direction, nodesep, ranksep });

    const nodeWidth = 320;

    // Track connected nodes
    const connectedNodeIds = new Set();
    edges.forEach((edge) => {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
    });

    // Add connected nodes to Dagre
    nodes.forEach((node) => {
        if (connectedNodeIds.has(node.id)) {
            const label = node.data?.Name || '';
            const height = estimateNodeHeight(label, nodeWidth);
            dagreGraph.setNode(node.id, { width: nodeWidth, height });
        }
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    // Determine bottom of Dagre layout
    let maxY = 0;
    connectedNodeIds.forEach((id) => {
        const n = dagreGraph.node(id);
        if (n && n.y != null) {
            maxY = Math.max(maxY, n.y + n.height / 2);
        }
    });

    const gridSpacingX = 360;
    const gridSpacingY = 140;
    const columns = 8;
    const gridYOffset = maxY + 200; // Push grid below Dagre layout
    let gridIndex = 0;

    const layoutedNodes = nodes.map((node) => {
        const isConnected = connectedNodeIds.has(node.id);
        const dagreNode = dagreGraph.node(node.id);

        if (isConnected && dagreNode?.x != null && dagreNode?.y != null) {
            return {
                ...node,
                position: {
                    x: dagreNode.x - dagreNode.width / 2,
                    y: dagreNode.y - dagreNode.height / 2,
                },
            };
        } else {
            // Grid fallback layout
            const col = gridIndex % columns;
            const row = Math.floor(gridIndex / columns);
            gridIndex++;

            return {
                ...node,
                position: {
                    x: col * gridSpacingX,
                    y: gridYOffset + row * gridSpacingY,
                },
                positionAbsolute: node.type !== 'group',
            };
        }
    });

    return { nodes: layoutedNodes, edges };
};

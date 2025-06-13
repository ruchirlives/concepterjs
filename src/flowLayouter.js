import dagre from 'dagre';

// Helper: Estimate node height by line breaks for the given width.
function estimateNodeHeight(label, width, fontSize = 16, paddingY = 16) {
    // Rough estimate: characters per line (font and width dependent!)
    const charsPerLine = Math.floor(width / (fontSize * 0.6)); // tweak as needed
    const lines = Math.ceil(label.length / charsPerLine);
    const lineHeight = fontSize * 1.25; // e.g. 20px
    return Math.max(48, lines * lineHeight + paddingY); // 48px minimum
}

export const getLayoutedElements = (
    nodes, edges, direction = 'LR', nodesep = 75, ranksep = 100
) => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // Adjust these values to increase spacing between nodes:
    // const nodesep = 75; // space between nodes in the same rank
    // const ranksep = 100; // space between ranks

    // Set graph options with extra spacing.
    dagreGraph.setGraph({ rankdir: direction, nodesep, ranksep });

    // Set nodes in Dagre graph.

    const nodeWidth = 320; // matches max-w-xs
    nodes.forEach((node) => {
        const label = node.data?.Name || '';
        const height = estimateNodeHeight(label, nodeWidth);
        dagreGraph.setNode(node.id, { width: nodeWidth, height });
    });

    // Set edges in Dagre graph.
    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    // Run the layout algorithm.
    dagre.layout(dagreGraph);

    // Update node positions.
    const layoutedNodes = nodes.map((node) => {
        const dagreNode = dagreGraph.node(node.id);
        return {
            ...node,
            position: {
                x: dagreNode.x - (dagreNode.width / 2),
                y: dagreNode.y - (dagreNode.height / 2),
            },
        };
    });

    return { nodes: layoutedNodes, edges };
};

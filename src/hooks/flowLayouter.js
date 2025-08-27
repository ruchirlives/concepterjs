import dagre from 'dagre';

function estimateNodeHeight(label, width, fontSize = 16, paddingY = 16) {
    const charsPerLine = Math.floor(width / (fontSize * 0.6));
    const lines = Math.ceil(label.length / charsPerLine);
    const lineHeight = fontSize * 1.25;
    return Math.max(48, lines * lineHeight + paddingY);
}

// Run dagre on a subset of nodes/edges and return nodes with updated positions
function layoutSubset(nodes, edges, direction, nodesep, ranksep) {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: direction, nodesep, ranksep });

    const nodeWidth = 320;
    nodes.forEach((node) => {
        const label = node.data?.Name || '';
        const height = estimateNodeHeight(label, nodeWidth);
        g.setNode(node.id, { width: nodeWidth, height });
    });
    edges.forEach((edge) => g.setEdge(edge.source, edge.target));
    dagre.layout(g);

    return nodes.map((node) => {
        const n = g.node(node.id);
        if (n) {
            return {
                ...node,
                position: { x: n.x - n.width / 2, y: n.y - n.height / 2 },
            };
        }
        return node;
    });
}

export const getLayoutedElements = (
    nodes,
    edges,
    direction = 'LR',
    nodesep = 35,
    ranksep = 100
) => {
    const nodeWidth = 320;

    // --- Layout top-level nodes (no parentId) ---
    const topNodes = nodes.filter(n => !n.parentId);
    const topNodeIds = new Set(topNodes.map(n => n.id));
    const topEdges = edges.filter(e =>
        topNodeIds.has(e.source) && topNodeIds.has(e.target)
    );
    let layoutedNodes = layoutSubset(topNodes, topEdges, direction, nodesep, ranksep);

    // --- Layout each group (subflow) individually ---
    const allNodesById = Object.fromEntries(nodes.map(n => [n.id, n]));
    const childEdges = edges.slice(); // will be reused

    layoutedNodes
        .filter(n => n.type === 'group')
        .forEach(group => {
            const children = nodes.filter(n => n.parentId === group.id);
            if (children.length === 0) return;

            const childEdgesForGroup = childEdges.filter(e => {
                const sParent = allNodesById[e.source]?.parentId;
                const tParent = allNodesById[e.target]?.parentId;
                return sParent === group.id && tParent === group.id;
            });

            const laidOutChildren = layoutSubset(children, childEdgesForGroup, direction, nodesep, ranksep);

            // Determine bounding box of children
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            laidOutChildren.forEach(n => {
                minX = Math.min(minX, n.position.x);
                minY = Math.min(minY, n.position.y);
                maxX = Math.max(maxX, n.position.x + nodeWidth);
                const h = estimateNodeHeight(n.data?.Name || '', nodeWidth);
                maxY = Math.max(maxY, n.position.y + h);
            });

            const padding = 40;
            const width = maxX - minX + padding * 2;
            const height = maxY - minY + padding * 2;

            // Update group size
            layoutedNodes = layoutedNodes.map(n =>
                n.id === group.id ? { ...n, style: { ...n.style, width, height } } : n
            );

            // Shift children into group coordinate system
            const offsetX = padding - minX;
            const offsetY = padding - minY;
            laidOutChildren.forEach(n => {
                n.position = { x: n.position.x + offsetX, y: n.position.y + offsetY };
                layoutedNodes.push(n);
            });
        });

    return { nodes: layoutedNodes, edges };
};

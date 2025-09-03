import dagre from 'dagre';

function estimateNodeHeight(label, width, fontSize = 16, paddingY = 16) {
    const charsPerLine = Math.floor(width / (fontSize * 0.6));
    const lines = Math.ceil(label.length / charsPerLine);
    const lineHeight = fontSize * 1.25;
    return Math.max(48, lines * lineHeight + paddingY);
}

function layoutSubset(nodes, edges, direction, nodesep, ranksep, nodeSizes = {}) {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: direction, nodesep, ranksep });

    nodes.forEach((node) => {
        const width = nodeSizes[node.id]?.width || node.style?.width || 320;
        const height = nodeSizes[node.id]?.height || node.style?.height ||
            estimateNodeHeight(node.data?.Name || '', width);
        g.setNode(node.id, { width, height });
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
    // 1. Compute group sizes based on their children
    const nodeSizes = {};
    const allNodesById = Object.fromEntries(nodes.map(n => [n.id, n]));

    // --- Identify island nodes ---
    const nodeIdsWithEdges = new Set();
    edges.forEach(e => {
        nodeIdsWithEdges.add(e.source);
        nodeIdsWithEdges.add(e.target);
    });
    const islandNodes = nodes.filter(
        n => !n.parentId && !nodeIdsWithEdges.has(n.id)
    );
    const nonIslandNodes = nodes.filter(n => !islandNodes.includes(n));

    // --- Compute group sizes for non-island nodes only ---
    nonIslandNodes.filter(n => n.type === 'group').forEach(group => {
        const children = nonIslandNodes.filter(n => n.parentId === group.id);
        if (children.length === 0) {
            nodeSizes[group.id] = {
                width: group.style?.width || 320,
                height: group.style?.height || 180
            };
            return;
        }

        // Layout children to get their positions
        const childEdges = edges.filter(e => {
            const sParent = allNodesById[e.source]?.parentId;
            const tParent = allNodesById[e.target]?.parentId;
            return sParent === group.id && tParent === group.id;
        });
        const laidOutChildren = layoutSubset(children, childEdges, direction, nodesep, ranksep);

        // Bounding box
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        laidOutChildren.forEach(n => {
            minX = Math.min(minX, n.position.x);
            minY = Math.min(minY, n.position.y);
            maxX = Math.max(maxX, n.position.x + (n.style?.width || 320));
            const h = n.style?.height || estimateNodeHeight(n.data?.Name || '', n.style?.width || 320);
            maxY = Math.max(maxY, n.position.y + h);
        });

        const padding = 40;
        const width = maxX - minX + padding * 2;
        const height = maxY - minY + padding * 2;

        nodeSizes[group.id] = { width, height };
    });

    // 2. Layout top-level nodes using computed group sizes (excluding islands)
    const topNodes = nonIslandNodes.filter(n => !n.parentId);
    const topNodeIds = new Set(topNodes.map(n => n.id));
    const topEdges = edges.filter(e =>
        topNodeIds.has(e.source) && topNodeIds.has(e.target)
    );
    let layoutedNodes = layoutSubset(topNodes, topEdges, direction, nodesep, ranksep, nodeSizes);

    // 3. Layout and position children inside their groups (excluding islands)
    layoutedNodes
        .filter(n => n.type === 'group')
        .forEach(group => {
            const children = nonIslandNodes.filter(n => n.parentId === group.id);
            if (children.length === 0) return;

            const childEdgesForGroup = edges.filter(e => {
                const sParent = allNodesById[e.source]?.parentId;
                const tParent = allNodesById[e.target]?.parentId;
                return sParent === group.id && tParent === group.id;
            });

            const laidOutChildren = layoutSubset(children, childEdgesForGroup, direction, nodesep, ranksep);

            // Use the same bounding box logic as above
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            laidOutChildren.forEach(n => {
                minX = Math.min(minX, n.position.x);
                minY = Math.min(minY, n.position.y);
                maxX = Math.max(maxX, n.position.x + (n.style?.width || 320));
                const h = n.style?.height || estimateNodeHeight(n.data?.Name || '', n.style?.width || 320);
                maxY = Math.max(maxY, n.position.y + h);
            });

            const padding = 40;
            const width = maxX - minX + padding * 2;
            const height = maxY - minY + padding * 2;

            // Update group node's style in layoutedNodes
            layoutedNodes = layoutedNodes.map(n =>
                n.id === group.id
                    ? { ...n, style: { ...n.style, width, height } }
                    : n
            );

            // Shift children into group coordinate system
            const offsetX = padding - minX;
            const offsetY = padding - minY;
            laidOutChildren.forEach(n => {
                n.position = { x: n.position.x + offsetX, y: n.position.y + offsetY };
                layoutedNodes.push(n);
            });
        });

    // 4. Layout island nodes in an 8-column grid
    const gridCols = 8;
    const gridSpacingX = 340; // width + margin
    const gridSpacingY = 120; // height + margin
    islandNodes.forEach((node, i) => {
        const col = i % gridCols;
        const row = Math.floor(i / gridCols);
        const width = node.style?.width || 320;
        const height = node.style?.height || estimateNodeHeight(node.data?.Name || '', width);
        node.position = {
            x: col * gridSpacingX,
            y: row * gridSpacingY
        };
        layoutedNodes.push({ ...node, position: node.position });
    });

    return { nodes: layoutedNodes, edges };
};

import dagre from 'dagre';

function estimateNodeHeight(label, width, fontSize = 16, paddingY = 16) {
    const charsPerLine = Math.floor(width / (fontSize * 0.6));
    const lines = Math.ceil(label.length / charsPerLine);
    const lineHeight = fontSize * 1.25;
    return Math.max(48, lines * lineHeight + paddingY);
}

function layoutSubset(nodes, edges, direction, nodesep, ranksep, nodeSizes = {}) {
    if (nodes.length === 0) return [];

    // Find all node IDs that are connected by edges
    const connectedIds = new Set();
    edges.forEach(e => {
        connectedIds.add(e.source);
        connectedIds.add(e.target);
    });

    // Split nodes into connected and disconnected (islands)
    const connectedNodes = nodes.filter(n => connectedIds.has(n.id));
    const disconnectedNodes = nodes.filter(n => !connectedIds.has(n.id));

    // If all nodes are disconnected, use grid fallback
    if (connectedNodes.length === 0) {
        const gridColCount = 8;
        // Dynamically compute spacing based on node sizes to avoid overlap (esp. for group nodes)
        const widths = nodes.map(n => nodeSizes[n.id]?.width || n.style?.width || 320);
        const heights = nodes.map(n => nodeSizes[n.id]?.height || n.style?.height || estimateNodeHeight(n.data?.Name || '', (nodeSizes[n.id]?.width || n.style?.width || 320)));
        const maxWidth = widths.length ? Math.max(...widths) : 320;
        const maxHeight = heights.length ? Math.max(...heights) : 120;
        const gridSpacingX = Math.max(340, maxWidth + 60); // add gap to ensure spacing between group nodes
        const gridSpacingY = Math.max(120, maxHeight + 60);
        return nodes.map((node, idx) => {
            const col = idx % gridColCount;
            const row = Math.floor(idx / gridColCount);
            return {
                ...node,
                position: {
                    x: col * gridSpacingX,
                    y: row * gridSpacingY
                }
            };
        });
    }

    // Otherwise, lay out connected nodes with dagre and disconnected nodes in a grid
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: direction, nodesep, ranksep });

    connectedNodes.forEach((node) => {
        const width = nodeSizes[node.id]?.width || node.style?.width || 320;
        const height = nodeSizes[node.id]?.height || node.style?.height ||
            estimateNodeHeight(node.data?.Name || '', width);
        g.setNode(node.id, { width, height });
    });
    edges.forEach((edge) => g.setEdge(edge.source, edge.target));
    dagre.layout(g);

    // Lay out disconnected nodes in a grid
    const gridColCount = 8;
    // For islands, also compute dynamic spacing to avoid overlap when sizes vary
    const islandWidths = disconnectedNodes.map(n => nodeSizes[n.id]?.width || n.style?.width || 320);
    const islandHeights = disconnectedNodes.map(n => nodeSizes[n.id]?.height || n.style?.height || estimateNodeHeight(n.data?.Name || '', (nodeSizes[n.id]?.width || n.style?.width || 320)));
    const maxIslandWidth = islandWidths.length ? Math.max(...islandWidths) : 320;
    const maxIslandHeight = islandHeights.length ? Math.max(...islandHeights) : 120;
    const gridSpacingX = Math.max(340, maxIslandWidth + 60);
    const gridSpacingY = Math.max(120, maxIslandHeight + 60);
    // Compute the bottom (max Y) of connected nodes so we can offset islands below
    let connectedBottomY = 0;
    connectedNodes.forEach((node) => {
        const n = g.node(node.id);
        if (n) {
            const topY = n.y - n.height / 2;
            const bottomY = topY + n.height;
            if (bottomY > connectedBottomY) connectedBottomY = bottomY;
        }
    });
    const islandYOffset = connectedBottomY > 0 ? connectedBottomY + 80 : 0; // 80px gap

    const gridNodes = disconnectedNodes.map((node, idx) => {
        const col = idx % gridColCount;
        const row = Math.floor(idx / gridColCount);
        return {
            ...node,
            position: {
                x: col * gridSpacingX,
                y: islandYOffset + row * gridSpacingY
            }
        };
    });

    // Combine dagre and grid results
    return [
        ...connectedNodes.map((node) => {
            const n = g.node(node.id);
            if (n) {
                return {
                    ...node,
                    position: { x: n.x - n.width / 2, y: n.y - n.height / 2 },
                };
            }
            return node;
        }),
        ...gridNodes
    ];
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

    nodes.filter(n => n.type === 'group').forEach(group => {
        const children = nodes.filter(n => n.parentId === group.id);
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

        // Find connected children
        const connectedIds = new Set();
        childEdges.forEach(e => {
            connectedIds.add(e.source);
            connectedIds.add(e.target);
        });
        const connectedChildren = children.filter(n => connectedIds.has(n.id));
        const islandChildren = children.filter(n => !connectedIds.has(n.id));

        // Lay out connected children with dagre
        const laidOutConnected = layoutSubset(connectedChildren, childEdges, direction, nodesep, ranksep);

        // Lay out island children in a grid
        const gridColCount = 8;
        const gridSpacingX = 340;
        const gridSpacingY = 120;
        const laidOutIslands = islandChildren.map((node, idx) => {
            const col = idx % gridColCount;
            const row = Math.floor(idx / gridColCount);
            return {
                ...node,
                position: {
                    x: col * gridSpacingX,
                    y: row * gridSpacingY
                }
            };
        });

        // Combine both sets
        const laidOutChildren = [...laidOutConnected, ...laidOutIslands];

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

    // After step 1: Compute group sizes based on their children

    // STEP 1.5: Lay out group nodes respecting edges between them

    // Collect group nodes with computed sizes
    const groupNodes = nodes
        .filter(n => n.type === 'group')
        .map(n => ({
            ...n,
            style: {
                ...n.style,
                width: nodeSizes[n.id].width,
                height: nodeSizes[n.id].height
            }
        }));

    // Build a meta-graph of group dependencies: if any edge connects a child in group A to a child in group B, add A -> B
    const groupIdSet = new Set(groupNodes.map(n => n.id));
    const groupEdgesMap = new Map(); // key: "A=>B" value: {source:A,target:B}

    for (const e of edges) {
        const sNode = allNodesById[e.source];
        const tNode = allNodesById[e.target];

        // Determine source/target group: if node is a group use itself; else use its parentId if that parent is a group
        const sGroup = sNode?.type === 'group' ? sNode.id : (groupIdSet.has(sNode?.parentId) ? sNode?.parentId : undefined);
        const tGroup = tNode?.type === 'group' ? tNode.id : (groupIdSet.has(tNode?.parentId) ? tNode?.parentId : undefined);

        if (sGroup && tGroup && sGroup !== tGroup) {
            const key = `${sGroup}=>${tGroup}`;
            if (!groupEdgesMap.has(key)) {
                groupEdgesMap.set(key, { source: sGroup, target: tGroup });
            }
        }
    }

    const groupEdges = Array.from(groupEdgesMap.values());

    // Use dagre-driven subset layout for groups; falls back to grid for isolated groups
    let layoutedGroups = layoutSubset(groupNodes, groupEdges, direction, nodesep, ranksep, nodeSizes);

    // If there are no edges between groups, pack group nodes tightly without overlap
    if (groupNodes.length > 0 && groupEdges.length === 0) {
        const margin = 20;
        // Build rects list with sizes
        const rects = layoutedGroups.map(g => ({
            id: g.id,
            width: nodeSizes[g.id]?.width || g.style?.width || 320,
            height: nodeSizes[g.id]?.height || g.style?.height || 180,
        }));
        const totalArea = rects.reduce((acc, r) => acc + (r.width + margin) * (r.height + margin), 0);
        const idealRowWidth = Math.max(600, Math.floor(Math.sqrt(totalArea))); // aim near-square

        let x = 0;
        let y = 0;
        let rowHeight = 0;
        const positionsById = {};
        rects.forEach(r => {
            if (x > 0 && x + r.width + margin > idealRowWidth) {
                // new row
                x = 0;
                y += rowHeight + margin;
                rowHeight = 0;
            }
            positionsById[r.id] = { x, y };
            x += r.width + margin;
            rowHeight = Math.max(rowHeight, r.height);
        });

        // Apply packed positions
        layoutedGroups = layoutedGroups.map(n => {
            const p = positionsById[n.id];
            if (!p) return n;
            return {
                ...n,
                position: { x: p.x, y: p.y }
            };
        });
    }

    // 2. Layout top-level nodes using computed group sizes
    const topNodes = nodes.filter(n => !n.parentId && n.type !== 'group');
    const topNodeIds = new Set(topNodes.map(n => n.id));
    const topEdges = edges.filter(e =>
        topNodeIds.has(e.source) && topNodeIds.has(e.target)
    );
    let layoutedTopNodes;
    if (topEdges.length === 0) {
        // Use grid layout for top-level nodes if no edges between them
        const gridColCount = 8;
        const gridSpacingX = 340;
        const gridSpacingY = 120;
        layoutedTopNodes = topNodes.map((node, idx) => {
            const col = idx % gridColCount;
            const row = Math.floor(idx / gridColCount);
            return {
                ...node,
                position: {
                    x: col * gridSpacingX,
                    y: row * gridSpacingY
                }
            };
        });
    } else {
        layoutedTopNodes = layoutSubset(topNodes, topEdges, direction, nodesep, ranksep, nodeSizes);
    }

    let layoutedNodes = [
        ...layoutedGroups,
        ...layoutedTopNodes
    ];

    // 3. Layout and position children inside their groups
    layoutedGroups.forEach(group => {
        const children = nodes.filter(n => n.parentId === group.id);
        if (children.length === 0) return;

        const childEdgesForGroup = edges.filter(e => {
            const sParent = allNodesById[e.source]?.parentId;
            const tParent = allNodesById[e.target]?.parentId;
            return sParent === group.id && tParent === group.id;
        });

        // Split children into connected and islands
        const connectedIds = new Set();
        childEdgesForGroup.forEach(e => {
            connectedIds.add(e.source);
            connectedIds.add(e.target);
        });
        const connectedChildren = children.filter(n => connectedIds.has(n.id));
        const islandChildren = children.filter(n => !connectedIds.has(n.id));

        const laidOutConnected = layoutSubset(connectedChildren, childEdgesForGroup, direction, nodesep, ranksep);

        const gridColCount = 8;
        const gridSpacingX = 340;
        const gridSpacingY = 120;
        // Offset island children below the connected children within the group
        let connectedBottomY = 0;
        laidOutConnected.forEach(n => {
            const width = n.style?.width || 320;
            const height = n.style?.height || estimateNodeHeight(n.data?.Name || '', width);
            const bottomY = n.position.y + height;
            if (bottomY > connectedBottomY) connectedBottomY = bottomY;
        });
        const islandYOffset = connectedBottomY > 0 ? connectedBottomY + 80 : 0; // 80px gap

        const laidOutIslands = islandChildren.map((node, idx) => {
            const col = idx % gridColCount;
            const row = Math.floor(idx / gridColCount);
            return {
                ...node,
                position: {
                    x: col * gridSpacingX,
                    y: islandYOffset + row * gridSpacingY
                }
            };
        });

        const laidOutChildren = [...laidOutConnected, ...laidOutIslands];

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

    // After laying out groups, pack groups tightly if unconnected and we now know final sizes
    if (groupEdges.length === 0) {
        const margin = 20;
        const groupsNow = layoutedNodes.filter(n => n.type === 'group');
        // Compute target row width based on total area to keep a compact near-square packing
        const totalArea = groupsNow.reduce((acc, g) => {
            const w = (g.style?.width || 320) + margin;
            const h = (g.style?.height || 180) + margin;
            return acc + w * h;
        }, 0);
        const idealRowWidth = Math.max(600, Math.floor(Math.sqrt(totalArea)));

        let x = 0;
        let y = 0;
        let rowHeight = 0;
        const positionsById = {};
        groupsNow.forEach(g => {
            const gw = g.style?.width || 320;
            const gh = g.style?.height || 180;
            if (x > 0 && x + gw + margin > idealRowWidth) {
                x = 0;
                y += rowHeight + margin;
                rowHeight = 0;
            }
            positionsById[g.id] = { x, y };
            x += gw + margin;
            rowHeight = Math.max(rowHeight, gh);
        });

        // Apply new positions to group nodes only; children remain relative
        layoutedNodes = layoutedNodes.map(n => {
            if (n.type !== 'group') return n;
            const p = positionsById[n.id];
            if (!p) return n;
            return { ...n, position: { x: p.x, y: p.y } };
        });
    }

    // After laying out groups and optional packing, before returning nodes
    // 1. Collect group bounding boxes
    const groupBoxes = layoutedNodes
        .filter(n => n.type === 'group')
        .map(group => ({
            minX: group.position?.x ?? 0,
            minY: group.position?.y ?? 0,
            maxX: (group.position?.x ?? 0) + (group.style?.width || 320),
            maxY: (group.position?.y ?? 0) + (group.style?.height || 180)
        }));

    // 2. Find the max Y (bottom) of all groups to offset top-level nodes below them
    const groupBottom = groupBoxes.length
        ? Math.max(...groupBoxes.map(box => box.maxY))
        : 0;

    // 3. Offset top-level nodes if they overlap any group
    const overlappingTopNodes = [];
    const nonOverlappingTopNodes = [];

    layoutedNodes.forEach(n => {
        if (!n.parentId && n.type !== 'group') {
            const nodeY = n.position.y;
            const overlaps = groupBoxes.some(box =>
                n.position.x < box.maxX &&
                n.position.x + (n.style?.width || 320) > box.minX &&
                nodeY < box.maxY &&
                nodeY + (n.style?.height || estimateNodeHeight(n.data?.Name || '', n.style?.width || 320)) > box.minY
            );
            if (overlaps) {
                overlappingTopNodes.push(n);
            } else {
                nonOverlappingTopNodes.push(n);
            }
        }
    });

    // Lay out ALL top-level nodes (not in groups) below all groups using dagre
    const gridYOffset = groupBottom + 80; // 80px gap below groups

    const topLevelNodes = layoutedNodes.filter(n => !n.parentId && n.type !== 'group');
    const topLevelNodeIds = new Set(topLevelNodes.map(n => n.id));
    const topLevelEdges = edges.filter(e =>
        topLevelNodeIds.has(e.source) && topLevelNodeIds.has(e.target)
    );

    // Use dagre for layout
    let dagreNodes = layoutSubset(topLevelNodes, topLevelEdges, direction, nodesep, ranksep);

    // Offset all top-level nodes by gridYOffset
    dagreNodes = dagreNodes.map(node => ({
        ...node,
        position: {
            x: node.position.x,
            y: node.position.y + gridYOffset
        }
    }));

    // Remove all top-level nodes from layoutedNodes, then add dagreNodes
    layoutedNodes = [
        ...layoutedNodes.filter(n => n.parentId || n.type === 'group'),
        ...dagreNodes
    ];

    return { nodes: layoutedNodes, edges };
};

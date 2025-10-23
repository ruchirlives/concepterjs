import dagre from 'dagre';

function estimateNodeHeight(label, width, fontSize = 16, paddingY = 16) {
    const charsPerLine = Math.floor(width / (fontSize * 0.6));
    const lines = Math.ceil(label.length / charsPerLine);
    const lineHeight = fontSize * 1.25;
    return Math.max(48, lines * lineHeight + paddingY);
}

function getNodeDimensions(node) {
    if (!node) return { width: 0, height: 0 };
    const width = Number.isFinite(node?.width)
        ? node.width
        : Number.isFinite(node?.style?.width)
            ? node.style.width
            : 320;
    const height = Number.isFinite(node?.height)
        ? node.height
        : Number.isFinite(node?.style?.height)
            ? node.style.height
            : estimateNodeHeight(node?.data?.Name || '', width);
    return { width, height };
}

const CELL_MARGIN = 24;

function layoutNodesWithinCell(groupNodes, availMinX, availMaxX, availMinY, availMaxY) {
    if (!Array.isArray(groupNodes) || groupNodes.length === 0) return null;
    if (!Number.isFinite(availMinX) || !Number.isFinite(availMaxX) || !Number.isFinite(availMinY) || !Number.isFinite(availMaxY)) return null;

    const availWidth = Math.max(0, availMaxX - availMinX);
    const availHeight = Math.max(0, availMaxY - availMinY);
    if (availWidth === 0 || availHeight === 0) return null;

    const nodesData = groupNodes.map(node => {
        const dims = getNodeDimensions(node);
        return {
            node,
            width: Math.max(1, dims.width),
            height: Math.max(1, dims.height),
        };
    });

    const maxWidth = nodesData.reduce((acc, item) => Math.max(acc, item.width), 1);
    const minWidth = nodesData.reduce((acc, item) => Math.min(acc, item.width), maxWidth);

    const maxColumns = Math.min(
        nodesData.length,
        Math.max(1, Math.floor((availWidth + CELL_MARGIN) / (Math.max(1, minWidth) + CELL_MARGIN)))
    );

    let bestLayout = null;

    for (let columns = maxColumns; columns >= 1; columns--) {
        let columnWidth = (availWidth - CELL_MARGIN * (columns - 1)) / columns;
        if (columnWidth <= 0) continue;
        if (columnWidth < maxWidth && columns > 1) continue;

        const rowHeights = [];
        const totalRows = Math.ceil(nodesData.length / columns);
        let totalHeight = 0;
        for (let row = 0; row < totalRows; row++) {
            const start = row * columns;
            const end = Math.min(start + columns, nodesData.length);
            let rowHeight = 0;
            for (let i = start; i < end; i++) {
                rowHeight = Math.max(rowHeight, nodesData[i].height);
            }
            rowHeights.push(rowHeight);
            totalHeight += rowHeight;
        }
        const totalHeightWithGaps = totalHeight + CELL_MARGIN * Math.max(0, totalRows - 1);
        const overflow = Math.max(0, totalHeightWithGaps - availHeight);

        if (
            !bestLayout ||
            overflow < bestLayout.overflow ||
            (overflow === bestLayout.overflow && columns > bestLayout.columns)
        ) {
            bestLayout = {
                columns,
                columnWidth,
                rowHeights,
                overflow,
            };
            if (overflow === 0) break;
        }
    }

    if (!bestLayout) return null;

    const { columns, columnWidth, rowHeights } = bestLayout;

    const positions = new Map();
    let index = 0;
    let yCursor = availMinY;

    for (let row = 0; row < rowHeights.length; row++) {
        const rowHeight = rowHeights[row];
        for (let col = 0; col < columns && index < nodesData.length; col++, index++) {
            const data = nodesData[index];
            const baseX = availMinX + col * (columnWidth + CELL_MARGIN);
            const centeredX = baseX + Math.max(0, (columnWidth - data.width) / 2);
            const clampedX = clamp(
                centeredX,
                availMinX,
                Math.max(availMinX, availMaxX - data.width)
            );

            const centeredY = yCursor + Math.max(0, (rowHeight - data.height) / 2);
            const clampedY = clamp(
                centeredY,
                availMinY,
                Math.max(availMinY, availMaxY - data.height)
            );

            positions.set(data.node.id, { x: clampedX, y: clampedY });
        }
        if (row < rowHeights.length - 1) {
            yCursor += rowHeight + CELL_MARGIN;
        }
    }

    return positions;
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
    ranksep = 100,
    options = {}
) => {

    const nodeSizes = {};
    nodes.forEach(node => {
        nodeSizes[node.id] = getNodeDimensions(node);
    });

    // 1. Compute group sizes based on their children
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
        const laidOutConnected = layoutSubset(connectedChildren, childEdges, direction, nodesep, ranksep, nodeSizes);

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
            const dims = nodeSizes[n.id] || getNodeDimensions(n);
            minX = Math.min(minX, n.position.x);
            minY = Math.min(minY, n.position.y);
            maxX = Math.max(maxX, n.position.x + dims.width);
            maxY = Math.max(maxY, n.position.y + dims.height);
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

        const laidOutConnected = layoutSubset(connectedChildren, childEdgesForGroup, direction, nodesep, ranksep, nodeSizes);

        const gridColCount = 8;
        const gridSpacingX = 340;
        const gridSpacingY = 120;
        // Offset island children below the connected children within the group
        let connectedBottomY = 0;
        laidOutConnected.forEach(n => {
            const dims = nodeSizes[n.id] || getNodeDimensions(n);
            const bottomY = n.position.y + dims.height;
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
            const dims = nodeSizes[n.id] || getNodeDimensions(n);
            minX = Math.min(minX, n.position.x);
            minY = Math.min(minY, n.position.y);
            maxX = Math.max(maxX, n.position.x + dims.width);
            maxY = Math.max(maxY, n.position.y + dims.height);
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
            const w = (g.style?.width || nodeSizes[g.id]?.width || 320) + margin;
            const h = (g.style?.height || nodeSizes[g.id]?.height || 180) + margin;
            return acc + w * h;
        }, 0);
        const idealRowWidth = Math.max(600, Math.floor(Math.sqrt(totalArea)));

        let x = 0;
        let y = 0;
        let rowHeight = 0;
        const positionsById = {};
        groupsNow.forEach(g => {
            const gw = g.style?.width || nodeSizes[g.id]?.width || 320;
            const gh = g.style?.height || nodeSizes[g.id]?.height || 180;
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

    // Vertical packing for groups (applies to both connected and unconnected groups):
    // Keep dagre-determined X positions for connected groups, but nudge Y downwards to
    // remove vertical overlaps while minimizing movement. This prevents tall groups from
    // overlapping when dagre ranksep is insufficient.
    {
        const groupsNow = layoutedNodes.filter(n => n.type === 'group');
        if (groupsNow.length > 0) {
            const marginY = 20; // minimal vertical gap between groups

            // Build list with size and positions
            const items = groupsNow.map(g => ({
                id: g.id,
                x: g.position?.x ?? 0,
                y: g.position?.y ?? 0,
                w: g.style?.width || nodeSizes[g.id]?.width || 320,
                h: g.style?.height || nodeSizes[g.id]?.height || 180
            }));

            // Sort by x then y to stabilize; we will scan by rows (similar Xs) and push down to avoid overlap
            items.sort((a, b) => (a.x - b.x) || (a.y - b.y));

            // Greedy pass: for each item, ensure it doesn't overlap any previously placed item
            for (let i = 0; i < items.length; i++) {
                const a = items[i];
                let requiredY = a.y; // minimal Y to avoid overlaps above
                for (let j = 0; j < i; j++) {
                    const b = items[j];
                    const overlapX = (a.x < b.x + b.w) && (a.x + a.w > b.x);
                    if (!overlapX) continue; // only care about vertical packing where columns overlap
                    const bBottom = b.y + b.h + marginY;
                    if (bBottom > requiredY) requiredY = bBottom;
                }
                if (requiredY !== a.y) {
                    a.y = requiredY;
                }
            }

            // Apply adjusted Y back to layoutedNodes (groups only)
            const yById = Object.fromEntries(items.map(it => [it.id, it.y]));
            layoutedNodes = layoutedNodes.map(n => {
                if (n.type !== 'group') return n;
                const newY = yById[n.id];
                if (newY == null) return n;
                return { ...n, position: { x: n.position.x, y: newY } };
            });
        }
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
    let dagreNodes = layoutSubset(topLevelNodes, topLevelEdges, direction, nodesep, ranksep, nodeSizes);

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

    if (options?.gridDimensions) {
        layoutedNodes = applyGridConstraints(layoutedNodes, options.gridDimensions);
    }

    return { nodes: layoutedNodes, edges };
};

function clamp(value, min, max) {
    const val = Number.isFinite(value) ? value : min;
    const lower = Number.isFinite(min) ? min : Number.NEGATIVE_INFINITY;
    const upper = Number.isFinite(max) ? max : Number.POSITIVE_INFINITY;
    if (lower > upper) return lower;
    return Math.min(Math.max(val, lower), upper);
}

function resolveRowSegment(lookup = {}, id) {
    if (!id) return null;
    return (lookup.rowsByOriginalId && lookup.rowsByOriginalId[id])
        || (lookup.rowsByNodeId && lookup.rowsByNodeId[id])
        || null;
}

function resolveColumnSegment(lookup = {}, id) {
    if (!id) return null;
    return (lookup.columnsByOriginalId && lookup.columnsByOriginalId[id])
        || (lookup.columnsByNodeId && lookup.columnsByNodeId[id])
        || null;
}

function applyGridConstraints(layoutedNodes, gridDimensions) {
    if (!Array.isArray(layoutedNodes) || layoutedNodes.length === 0) return layoutedNodes;
    if (!gridDimensions) return layoutedNodes;
    const rows = Array.isArray(gridDimensions.rows) ? gridDimensions.rows : [];
    const columns = Array.isArray(gridDimensions.columns) ? gridDimensions.columns : [];
    if (rows.length === 0 && columns.length === 0) return layoutedNodes;

    const lookup = gridDimensions.lookup || {};
    const bounds = gridDimensions.bounds || {};
    const canvasWidth = Number.isFinite(bounds.width) ? bounds.width : 0;
    const canvasHeight = Number.isFinite(bounds.height) ? bounds.height : 0;

    const groups = new Map();

    layoutedNodes.forEach(node => {
        const assignment = node?.gridAssignment || node?.data?.gridAssignment;
        if (!assignment) return;
        const rowId = assignment.rowId ?? (Array.isArray(assignment.rowIds) ? assignment.rowIds[0] : null);
        const columnId = assignment.columnId ?? (Array.isArray(assignment.columnIds) ? assignment.columnIds[0] : null);
        if (!rowId && !columnId) return;
        const rowSegment = rowId ? resolveRowSegment(lookup, rowId) : null;
        const columnSegment = columnId ? resolveColumnSegment(lookup, columnId) : null;
        if (rowId && !rowSegment) return;
        if (columnId && !columnSegment) return;

        const minX = Number.isFinite(columnSegment?.left) ? columnSegment.left : 0;
        const maxX = Number.isFinite(columnSegment?.right) ? columnSegment.right : canvasWidth;
        const minY = Number.isFinite(rowSegment?.top) ? rowSegment.top : 0;
        const maxY = Number.isFinite(rowSegment?.bottom) ? rowSegment.bottom : canvasHeight;

        if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) return;

        const key = `${rowSegment?.key ?? '__ALL_ROWS__'}::${columnSegment?.key ?? '__ALL_COLS__'}`;
        if (!groups.has(key)) {
            groups.set(key, {
                nodes: [],
                minX,
                maxX,
                minY,
                maxY,
            });
        }
        groups.get(key).nodes.push(node);
    });

    if (groups.size === 0) return layoutedNodes;

    const updated = new Map();
    const baseHorizontalPadding = 2;
    const baseVerticalPaddingTop = 2;
    const baseVerticalPaddingBottom = 2;

    groups.forEach(group => {
        const { nodes: groupNodes, minX, maxX, minY, maxY } = group;
        if (!groupNodes || groupNodes.length === 0) return;

        const rawMinX = minX + baseHorizontalPadding;
        const rawMaxX = maxX - baseHorizontalPadding;
        const rawMinY = minY + baseVerticalPaddingTop;
        const rawMaxY = maxY - baseVerticalPaddingBottom;

        const availMinX = Math.min(rawMinX, rawMaxX);
        const availMaxX = Math.max(rawMinX, rawMaxX);
        const availMinY = Math.min(rawMinY, rawMaxY);
        const availMaxY = Math.max(rawMinY, rawMaxY);

        const layoutPositions = layoutNodesWithinCell(
            groupNodes,
            availMinX,
            availMaxX,
            availMinY,
            availMaxY
        );

        if (layoutPositions && layoutPositions.size > 0) {
            groupNodes.forEach(node => {
                const position = layoutPositions.get(node.id);
                if (!position) return;
                updated.set(node.id, {
                    ...node,
                    position,
                });
            });
            return;
        }

        let currentMinX = Infinity;
        let currentMaxX = -Infinity;
        let currentMinY = Infinity;
        let currentMaxY = -Infinity;

        groupNodes.forEach(node => {
            const { width, height } = getNodeDimensions(node);
            currentMinX = Math.min(currentMinX, node.position?.x ?? 0);
            currentMaxX = Math.max(currentMaxX, (node.position?.x ?? 0) + width);
            currentMinY = Math.min(currentMinY, node.position?.y ?? 0);
            currentMaxY = Math.max(currentMaxY, (node.position?.y ?? 0) + height);
        });

        if (!Number.isFinite(currentMinX) || !Number.isFinite(currentMaxX) || !Number.isFinite(currentMinY) || !Number.isFinite(currentMaxY)) return;

        const widthSpan = currentMaxX - currentMinX;
        const heightSpan = currentMaxY - currentMinY;

        let offsetX = 0;
        if (availMaxX > availMinX) {
            const minOffsetX = availMinX - currentMinX;
            const maxOffsetX = availMaxX - currentMaxX;
            const prefersCenterX = widthSpan <= (availMaxX - availMinX);
            const desiredX = prefersCenterX ? (minOffsetX + maxOffsetX) / 2 : minOffsetX;
            offsetX = clamp(desiredX, minOffsetX, maxOffsetX);
        }

        let offsetY = 0;
        if (availMaxY > availMinY) {
            const minOffsetY = availMinY - currentMinY;
            const maxOffsetY = availMaxY - currentMaxY;
            const prefersCenterY = heightSpan <= (availMaxY - availMinY);
            const desiredY = prefersCenterY ? (minOffsetY + maxOffsetY) / 2 : minOffsetY;
            offsetY = clamp(desiredY, minOffsetY, maxOffsetY);
        }

        const clampWithin = (value, minBound, maxBound) => {
            const minVal = Number.isFinite(minBound) ? minBound : value;
            const maxCandidate = Number.isFinite(maxBound) ? maxBound : value;
            const maxVal = maxCandidate < minVal ? minVal : maxCandidate;
            return clamp(value, minVal, maxVal);
        };

        groupNodes.forEach(node => {
            const originalPosition = node.position || { x: 0, y: 0 };
            const { width, height } = getNodeDimensions(node);

            const shiftedX = originalPosition.x + (Number.isFinite(offsetX) ? offsetX : 0);
            const shiftedY = originalPosition.y + (Number.isFinite(offsetY) ? offsetY : 0);

            const maxAllowedX = Number.isFinite(availMaxX) ? availMaxX - width : shiftedX;
            const maxAllowedY = Number.isFinite(availMaxY) ? availMaxY - height : shiftedY;

            const clampedX = clampWithin(shiftedX, availMinX, maxAllowedX);
            const clampedY = clampWithin(shiftedY, availMinY, maxAllowedY);

            updated.set(node.id, {
                ...node,
                position: {
                    x: clampedX,
                    y: clampedY,
                },
            });
        });
    });

    if (updated.size === 0) return layoutedNodes;
    return layoutedNodes.map(node => updated.get(node.id) || node);
}

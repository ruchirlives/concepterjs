import { buildVisibleEdges } from './flowBuildVisibleEdges';
import { getLayoutedElements } from './flowLayouter';

export const fetchAndCreateEdges = async (computedNodes, params) => {
    const { setNodes, setEdges, parentChildMap, setLayoutPositions, layoutPositions, keepLayout } = params;

    if (!parentChildMap) return;

    // Build lookup of all original node IDs before hide
    const originalIdSet = new Set(computedNodes.map(n => n.id));
    // const groupSet = new Set(computedNodes.filter(n => n.type === 'group').map(n => n.id));

    // Filter parentChildMap by originalIdSet and remove only 'successor' relations
    const filteredParentChildMap = parentChildMap
        .filter(({ container_id, children }) =>
            originalIdSet.has(container_id) || children.some(child => originalIdSet.has(child.id))
        )
        .map(({ container_id, children }) => ({
            container_id,
            children: children.filter(c => c.label !== 'successor')
        }));

    // Build childMap: container_id → children objects
    const childMap = Object.fromEntries(
        filteredParentChildMap.map(({ container_id, children }) => [
            container_id.toString(),
            children
        ])
    );

    // Invert childMap → parentMap
    const nameById = Object.fromEntries(
        computedNodes.map(n => [n.id, n.data.Name])
    );
    const parentMap = {};
    for (const [pid, children] of Object.entries(childMap)) {
        children.forEach(child => {
            const cid = child.id.toString();
            if (!parentMap[cid]) parentMap[cid] = [];
            parentMap[cid].push({ id: pid, name: nameById[pid] || pid });
        });
    }

    // Add children and parents to each node
    computedNodes = computedNodes.map(node => {
        const rawChildren = childMap[node.id] || [];
        const rawParents = parentMap[node.id] || [];
        const children = rawChildren.map(c => ({
            id: c.id.toString(),
            name: c.name,
            position: c.position,
            tags: c.tags,
        }));
        const parents = rawParents.map(p => ({ id: p.id, name: p.name }));
        return { ...node, data: { ...node.data, children, parents } };
    });

    // Build childToGroup map for edge building
    const groupIds = computedNodes.filter(n => n.type === 'group').map(n => n.id);
    const childToGroup = {};
    groupIds.forEach(gid => {
        (childMap[gid] || []).forEach(c => {
            childToGroup[c.id.toString()] = gid;
        });
    });

    // Build edges
    const allNodes = computedNodes.slice();
    const newEdges = buildVisibleEdges({
        childMap,
        computedNodes,
        childToGroup,
        allNodes,
        setEdges
    });

    // Add ghost nodes for PendingEdges
    computedNodes.forEach(node => {
        const pendingEdges = Array.isArray(node.data?.PendingEdges) ? node.data.PendingEdges : [];
        pendingEdges.forEach((pending, idx) => {
            if (!pending?.Name) return;
            const ghostNodeId = `ghost-${node.id}-${pending.to || idx}`;

            // Determine parent group for this node, if any
            const parentGroupId = node.parentId || childToGroup[node.id];

            const ghostNode = {
                id: ghostNodeId,
                type: 'ghost',
                data: { 
                    label: pending.Name 
                        ? pending.Name.slice(0, 50) + (pending.Name.length > 50 ? '…' : '') 
                        : '', 
                    parentId: node.id, 
                    id: pending.to || null 
                },
                position: {
                    x: (node.position?.x || 0) + 150,
                    y: (node.position?.y || 0) + 60 * (idx + 1)
                },
                selectable: false,
                draggable: true,
                targetPosition: 'left',
                ...(parentGroupId ? { parentId: parentGroupId, extent: 'parent' } : {})
            };
            computedNodes.push(ghostNode);

            newEdges.push({
                id: `pendingedge-${node.id}-${ghostNodeId}`,
                source: node.id,
                target: ghostNodeId,
                type: 'customEdge',
                // Only set label if it has text, otherwise undefined/empty
                data: { label: pending.Name && pending.Name.trim() ? (pending.position?.label || '') : '' },
            });
        });
    });

    // Layout & set state
    await deployNodesEdges();

    async function deployNodesEdges() {
        if (keepLayout) {
            const restored = computedNodes.map(node => ({
                ...node,
                position: layoutPositions[node.id] || node.position
            }));
            setNodes(restored);
            setEdges(newEdges);
        } else {
            const layouted = getLayoutedElements(computedNodes, newEdges, 'LR');
            setNodes(layouted.nodes);
            setEdges(layouted.edges);
            // Update layout positions in Zustand store
            const newLayoutPositions = layouted.nodes.reduce((acc, node) => {
                acc[node.id] = node.position;
                return acc;
            }, {});
            setLayoutPositions(newLayoutPositions);
        }
    }
};




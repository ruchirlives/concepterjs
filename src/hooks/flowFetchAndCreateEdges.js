import { buildVisibleEdges } from './flowBuildVisibleEdges';
import { getLayoutedElements } from './flowLayouter';

export const fetchAndCreateEdges = async (computedNodes, params) => {
    const { setNodes, setEdges, parentChildMap } = params;

    // Build lookup of all original node IDs before hide
    const originalIdSet = new Set(computedNodes.map(n => n.id));

    // Fetch parent→children relationships
    if (!parentChildMap) return;

    // Filter parentChildMap by originalIdSet and remove successors or group-type children
    const groupSet = new Set(computedNodes.filter(n => n.type === 'group').map(n => n.id));
    const filteredParentChildMap = parentChildMap
        .filter(({ container_id, children }) =>
            originalIdSet.has(container_id) || children.some(child => originalIdSet.has(child.id))
        )
        .map(({ container_id, children }) => ({
            container_id,
            // Exclude successor relations and group nodes
            children: children.filter(c => c.label !== 'successor' && !groupSet.has(c.id.toString()))
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
        const children = rawChildren.map(function (c) {
            return {
                id: c.id.toString(),
                name: c.name,
                position: c.position,
                tags: c.tags,
            };
        });
        const parents = rawParents.map(p => ({ id: p.id, name: p.name }));
        return { ...node, data: { ...node.data, children, parents } };
    });

    const allNodes = computedNodes.slice();

    // Build childToGroup map for edge building
    const groupIds = computedNodes.filter(n => n.type === 'group').map(n => n.id);
    const childToGroup = {};
    groupIds.forEach(gid => {
        (childMap[gid] || []).forEach(c => {
            childToGroup[c.id.toString()] = gid;
        });
    });

    // No filtering for activeGroup or visibility: just use all computedNodes
    // React Flow will handle group visibility via parentId

    const newEdges = buildVisibleEdges({
        childMap,
        computedNodes,
        childToGroup,
        allNodes,
        setEdges
    });

    // Add a ghost node for each PendingEdge, using Name as the label
    computedNodes.forEach(node => {
        const pendingEdges = Array.isArray(node.data?.PendingEdges) ? node.data.PendingEdges : [];
        pendingEdges.forEach((pending, idx) => {
            if (!pending?.Name) return;
            const ghostNodeId = `ghost-${node.id}-${pending.to || idx}`;
            const ghostNode = {
                id: ghostNodeId,
                type: 'ghost',
                data: { label: pending.Name, parentId: node.id, id: pending.to || null },
                position: {
                    x: (node.position?.x || 0) + 150,
                    y: (node.position?.y || 0) + 60 * (idx + 1)
                },
                selectable: false,
                draggable: true,
                targetPosition: 'left'
            };
            computedNodes.push(ghostNode);

            newEdges.push({
                id: `pendingedge-${node.id}-${ghostNodeId}`,
                source: node.id,
                target: ghostNodeId,
                type: 'customEdge',
                data: { label: pending?.position?.label || '' },
            });
        });
    });

    // Layout & set state
    await deployNodesEdges({
        setLayoutPositions: params.setLayoutPositions,
        layoutPositions: params.layoutPositions,
        keepLayout: params.keepLayout
    });

    async function deployNodesEdges(params) {
        const { setLayoutPositions, layoutPositions, keepLayout } = params;
        if (keepLayout) {
            const restored = computedNodes.map(node => ({
                ...node,
                position: layoutPositions[node.id] || node.position
            }));
            setNodes(restored);
            setEdges(newEdges);
            return;
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
            return;
        }
    }
};




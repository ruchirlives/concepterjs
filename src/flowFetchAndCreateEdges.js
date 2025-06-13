import { manyChildren } from './api';
import { buildVisibleEdges } from './flowBuildVisibleEdges';
import { getLayoutedElements } from './flowLayouter';

export const fetchAndCreateEdges = async (computedNodes, params) => {
    const { setNodes, setEdges, activeGroup, keepLayout } = params;

    // Build lookup of all original node IDs before hide
    const originalIdSet = new Set(computedNodes.map(n => n.id));

    // Fetch parent→children relationships
    const parentChildMap = await manyChildren([...originalIdSet]);
    // console.log('Parent-child map:', parentChildMap);
    if (!parentChildMap) return;

    // Build childMap: container_id → children objects
    const childMap = Object.fromEntries(
        parentChildMap.map(({ container_id, children }) => [
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

    // Inject children & parents


    // Add children and parents to each node and lower case the fields
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

        // console.log('Raw children:', rawChildren);
        // console.log('Children:', children);


        const parents = rawParents.map(p => ({ id: p.id, name: p.name }));
        return { ...node, data: { ...node.data, children, parents } };
    });

    const allNodes = computedNodes.slice();
    // Note: this is a shallow copy of the original nodes, so we can still access the original data

    // Identify groups and hidden children
    const groupIds = computedNodes.filter(n => n.type === 'group').map(n => n.id);
    const hiddenChildIds = new Set(
        groupIds.flatMap(gid => (childMap[gid] || []).map(c => c.id.toString()))
    );
    const childToGroup = {};
    groupIds.forEach(gid => {
        (childMap[gid] || []).forEach(c => {
            childToGroup[c.id.toString()] = gid;
        });
    });

    // Only show the *direct* children of the activeGroup (or root group otherwise)
    if (activeGroup) {
        const directKids = new Set(
            (childMap[activeGroup] || []).map(c => c.id.toString())
        );
        computedNodes = computedNodes.filter(n => directKids.has(n.id));
    } else {
        computedNodes = computedNodes.filter(n =>
            n.type === 'group' || !hiddenChildIds.has(n.id)
        );
    }

    computedNodes = computedNodes.filter(n => {
        // if (n.type !== 'group') return true;
        const parents = n.data.parents || [];
        const hasVisibleGroupParent = parents.some(p => {
            const pid = p.id.toString();
            return computedNodes.some(m => m.id === pid && m.type === 'group');
        });
        return !hasVisibleGroupParent;
    });

    // ──────────────────────────────────────────────────────────
    // const visibleIds = new Set(computedNodes.map(n => n.id));

    const newEdges = buildVisibleEdges({
        childMap,
        computedNodes,
        childToGroup,
        allNodes,
        setEdges
    });

    // Check if any edges are missing sourcehandle or targethandle on their source or target nodes
    newEdges.forEach(edge => {
        const sourceNode = computedNodes.find(node => node.id === edge.source);
        const targetNode = computedNodes.find(node => node.id === edge.target);
        if (!sourceNode || !targetNode) {
            console.warn(`Edge ${edge.id} has missing source or target node:`, {
                edge,
                sourceNode,
                targetNode
            }); 
            return; // Skip if either node is not found
        }
    });


    // Layout & set state
    await deployNodesEdges({
        setLayoutPositions: params.setLayoutPositions,
        layoutPositions: params.layoutPositions
    });


    async function deployNodesEdges(params) {
        const { setLayoutPositions, layoutPositions } = params;
        if (keepLayout) {
            const restored = computedNodes.map(node => ({
                ...node,
                position: layoutPositions[node.id] || node.position
            }));
            setNodes(restored);
            setEdges(newEdges);
            return;
        }
        else {
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




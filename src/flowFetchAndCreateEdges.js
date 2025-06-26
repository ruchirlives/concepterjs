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

    // Build map of child node IDs to relationship labels for successor override
    const childRelationshipLabels = {};
    // Build map of successor child node IDs to their specific parent IDs
    const successorChildToParent = {};
    for (const [parentId, children] of Object.entries(childMap)) {
        children.forEach(c => {
            const cid = c.id.toString();
            const label = c.position && typeof c.position === 'object' ? c.position.label : c.position;
            if (!childRelationshipLabels[cid]) childRelationshipLabels[cid] = new Set();
            childRelationshipLabels[cid].add(label);

            // Track successor relationships specifically
            if (label === 'successor') {
                if (!successorChildToParent[cid]) successorChildToParent[cid] = [];
                successorChildToParent[cid].push(parentId);
            }
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
        // Build set of successor children of the activeGroup specifically
        const activeGroupSuccessors = new Set();
        (childMap[activeGroup] || []).forEach(c => {
            const label = c.position && typeof c.position === 'object' ? c.position.label : c.position;
            if (label === 'successor') {
                activeGroupSuccessors.add(c.id.toString());
            }
        });
        computedNodes = computedNodes.filter(n =>
            directKids.has(n.id) && !activeGroupSuccessors.has(n.id)
        );
    } else {
        computedNodes = computedNodes.filter(n => {
            const isGroup = n.type === 'group';
            const isHiddenChild = hiddenChildIds.has(n.id);
            const isSuccessor = childRelationshipLabels[n.id]?.has('successor');
            const successorParents = successorChildToParent[n.id] || [];

            // For successor nodes, check if parent is directly visible (not hidden)
            const hasDirectlyVisibleParent = successorParents.some(pid => {
                const parentExists = computedNodes.some(m => m.id === pid);
                const parentNotHidden = !hiddenChildIds.has(pid);
                return parentExists && parentNotHidden;
            });

            return isGroup
                || !isHiddenChild
                || (isSuccessor && hasDirectlyVisibleParent);
        });
    }

    computedNodes = computedNodes.filter(n => {
        const parents = n.data.parents || [];
        const hasVisibleGroupParent = parents.some(p => {
            const pid = p.id.toString();
            return computedNodes.some(m => m.id === pid && m.type === 'group');
        });
        if (activeGroup) {
            return !hasVisibleGroupParent;
        }
        return !hasVisibleGroupParent || childRelationshipLabels[n.id]?.has('successor');
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




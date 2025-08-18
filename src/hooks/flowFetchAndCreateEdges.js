import { manyChildren } from '../api';
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
        // Show direct children of activeGroup (including successors now)
        computedNodes = computedNodes.filter(n => directKids.has(n.id));
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

            return isGroup || !isHiddenChild
                || (isSuccessor && hasDirectlyVisibleParent);
        });
    }

    computedNodes = computedNodes.filter(n => {
        if (n.type === 'group') return true; // <-- Always show group nodes

        const parents = n.data.parents || [];
        const hasVisibleGroupParent = parents.some(p => {
            const pid = p.id.toString();
            return allNodes.some(m => m.id === pid && m.type === 'group');
        });

        if (activeGroup) {
            // Hide the activeGroup node itself when we're inside it
            if (n.id === activeGroup) {
                return false;
            }
            // Show children if their group parent IS the activeGroup, hide if it's a different group
            const hasActiveGroupAsParent = parents.some(p => p.id === activeGroup);
            return hasActiveGroupAsParent || !hasVisibleGroupParent;
        }

        // For nodes outside activeGroup, check if they should be visible
        const isDirectChild = !hasVisibleGroupParent;
        const isSuccessorWithVisibleChain = childRelationshipLabels[n.id]?.has('successor') &&
            hasVisibleSuccessorChain(n.id, successorChildToParent, allNodes, new Set());

        return isDirectChild || isSuccessorWithVisibleChain;
    });

    // Helper function to check if a successor chain leads to a visible node
    function hasVisibleSuccessorChain(nodeId, successorChildToParent, allNodes, visited) {
        // Prevent infinite loops
        if (visited.has(nodeId)) return false;
        visited.add(nodeId);

        const successorParents = successorChildToParent[nodeId] || [];

        for (const parentId of successorParents) {
            const parentNode = allNodes.find(n => n.id === parentId);
            if (!parentNode) continue;

            // Check if this parent is directly visible (not a child of a group)
            const parentIsDirectlyVisible = !parentNode.data.parents?.some(p => {
                const pid = p.id.toString();
                return allNodes.some(m => m.id === pid && m.type === 'group');
            });

            if (parentIsDirectlyVisible) {
                return true; // Found a visible node in the chain
            }

            // If parent is also a successor, recursively check its chain
            if (childRelationshipLabels[parentId]?.has('successor')) {
                if (hasVisibleSuccessorChain(parentId, successorChildToParent, allNodes, visited)) {
                    return true;
                }
            }
        }

        return false; // No visible node found in any chain
    }

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


    // Add a ghost node for each PendingEdge, using Name as the label
    computedNodes.forEach(node => {
        const pendingEdges = Array.isArray(node.data?.PendingEdges) ? node.data.PendingEdges : [];
        pendingEdges.forEach((pending, idx) => {
            if (!pending?.Name) return; // Skip if Name is missing

            console.log(`Adding ghost node for pending edge: ${pending.Name} with ${pending.to} at index ${idx}`);

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
                draggable: true, // <-- Make ghost node moveable
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




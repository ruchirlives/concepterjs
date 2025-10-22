import { buildVisibleEdges } from './flowBuildVisibleEdges';
import { getLayoutedElements } from './flowLayouter';

export const fetchAndCreateEdges = async (computedNodes, params) => {
    const {
        setNodes,
        setEdges,
        parentChildMap,
        setLayoutPositions,
        layoutPositions,
        keepLayout,
        groupByLayers,
        showGhostConnections = true,
        showGroupNodes = true,
        // influencers support (from AppContext via params)
        refreshInfluencers,
    } = params;

    if (!parentChildMap) return;

    // Build lookup of all node IDs currently present
    const presentIdSet = new Set(computedNodes.map(n => n.id));

    // Build a mapping from originalId -> array of clone nodes whenever clones exist
    // Clones are non-group nodes where `data.originalId` is set or id contains `__in__`
    const clonesByOriginal = {};
    computedNodes.forEach(n => {
        if (n.type !== 'group') {
            const original = n.data?.originalId || n.data?.id || n.id;
            // If a node has a parentId or id contains __in__, treat as a clone instance
            if (n.parentId || String(n.id).includes('__in__')) {
                if (!clonesByOriginal[original]) clonesByOriginal[original] = [];
                clonesByOriginal[original].push(n);
            }
        }
    });
    // const groupSet = new Set(computedNodes.filter(n => n.type === 'group').map(n => n.id));

    // Filter parentChildMap by what's visible and remove only 'successor' relations
    let filteredParentChildMap;
    if (!groupByLayers) {
        filteredParentChildMap = parentChildMap
            .filter(({ container_id, children }) => {
                const parentVisible = presentIdSet.has(String(container_id));
                // If clones exist, a child can be represented by a clone even if the original id isn't present
                const hasVisibleChild = children.some(child =>
                    presentIdSet.has(String(child.id)) || (clonesByOriginal[String(child.id)]?.length > 0)
                );
                return parentVisible || hasVisibleChild;
            })
            .map(({ container_id, children }) => ({
                container_id,
                children: children.filter(c => c.label !== 'successor')
            }));
    } else {
        // When grouping by layers, we want to project relationships onto each layer
        // where both endpoints have a clone in the same parent group.
        const tmp = [];
        // const getCloneGroup = (clone) => clone.parentId || clone.id.split('__in__')[1] || undefined;
        parentChildMap.forEach(({ container_id, children }) => {
            const parentClones = clonesByOriginal[container_id]?.filter(c => showGroupNodes ? c.parentId : true);
            if (!parentClones || parentClones.length === 0) return;
            const cleanChildren = children.filter(c => c.label !== 'successor');
            if (cleanChildren.length === 0) return;
            tmp.push({ container_id, children: cleanChildren });
        });
        filteredParentChildMap = tmp;
    }

    // Build childMap: container_id → children objects
    let childMap;
    const clonesExist = Object.keys(clonesByOriginal).length > 0;
    if (!groupByLayers && !clonesExist) {
        // Simple mapping: original ids
        childMap = Object.fromEntries(
            filteredParentChildMap.map(({ container_id, children }) => [
                container_id.toString(),
                children
            ])
        );
    } else if (groupByLayers) {
        // Build a child map keyed by CLONE IDs inside each layer
        childMap = {};
        const getCloneGroup = (clone) => clone.parentId || clone.id.split('__in__')[1] || undefined;
        filteredParentChildMap.forEach(({ container_id, children }) => {
            const parentClones = clonesByOriginal[container_id] || [];
            parentClones.forEach(parentClone => {
                const parentGroup = getCloneGroup(parentClone);
                if (!parentGroup) return;
                const key = parentClone.id;
                if (!childMap[key]) childMap[key] = [];
                children.forEach(c => {
                    const childClones = clonesByOriginal[c.id] || [];
                    const inSameLayer = childClones.find(ch => getCloneGroup(ch) === parentGroup);
                    if (inSameLayer) {
                        childMap[key].push({ ...c, id: inSameLayer.id });
                    }
                });
            });
        });
    } else {
        // Not grouping by layers, but clones exist for multi-membership.
        // Map each parent group to its children using the clone that belongs to that parent (by parentId)
        childMap = {};
        filteredParentChildMap.forEach(({ container_id, children }) => {
            const key = container_id.toString();
            if (!childMap[key]) childMap[key] = [];
            children.forEach(c => {
                const clones = clonesByOriginal[c.id] || [];
                const inSameGroup = clones.find(ch => ch.parentId === key);
                if (inSameGroup) {
                    childMap[key].push({ ...c, id: inSameGroup.id });
                } else {
                    // Fallback to original id if no clone (e.g., when showGroupNodes is off)
                    childMap[key].push({ ...c, id: c.id.toString() });
                }
            });
        });

        // Additionally, create mappings for non-group parent clones to their children clones within the same group.
        // This enables visualizing edges between clone nodes when a group is active.
        filteredParentChildMap.forEach(({ container_id, children }) => {
            const parentClones = clonesByOriginal[container_id] || [];
            if (!parentClones.length) return;
            parentClones.forEach(parentClone => {
                const parentGroup = parentClone.parentId;
                if (!parentGroup) return;
                const cloneKey = parentClone.id; // use clone id as the parent key
                if (!childMap[cloneKey]) childMap[cloneKey] = [];
                children.forEach(c => {
                    const childClones = clonesByOriginal[c.id] || [];
                    const childInSameGroup = childClones.find(ch => ch.parentId === parentGroup);
                    if (childInSameGroup) {
                        childMap[cloneKey].push({ ...c, id: childInSameGroup.id });
                    }
                });
            });
        });
    }

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
    // In layer mode, keys in childMap are clone IDs; otherwise, keys are original parents
    Object.entries(childMap).forEach(([pid, children]) => {
        const parentNode = computedNodes.find(n => n.id === pid) || null;
        const gid = parentNode?.parentId || (groupIds.includes(pid) ? pid : undefined);
        (children || []).forEach(c => {
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

    if (showGhostConnections) {
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
    }

    // Influencers: fetch for all real edges and annotate
    try {
        if (typeof refreshInfluencers === 'function') {
            // Build map from nodeId -> originalId
            const originalIdByNodeId = Object.fromEntries(
                allNodes.map(n => [n.id, n.data?.originalId || n.data?.id || n.id])
            );
            const edgePairs = newEdges
                .filter(e => e && typeof e.source === 'string' && typeof e.target === 'string')
                .filter(e => !String(e.source).startsWith('ghost-') && !String(e.target).startsWith('ghost-'))
                .map(e => [originalIdByNodeId[e.source] || e.source, originalIdByNodeId[e.target] || e.target]);
            const uniquePairsKey = new Set(edgePairs.map(([s, t]) => `${String(s)}::${String(t)}`));
            const pairs = Array.from(uniquePairsKey).map(k => k.split('::'));
            const infMap = await refreshInfluencers(pairs, { skipIfSame: true });
            // annotate edges with flags and attach simplified influencer list
            const hasInf = (s, t) => {
                const k = `${String(s)}::${String(t)}`;
                const arr = infMap && Array.isArray(infMap[k]) ? infMap[k] : [];
                return arr.length > 0;
            };
            const getInfList = (s, t) => {
                const k = `${String(s)}::${String(t)}`;
                const arr = infMap && Array.isArray(infMap[k]) ? infMap[k] : [];
                return arr.map(it => {
                    const id = (it && (it.container_id ?? it.id ?? it.ID)) ?? String(it);
                    const name = (it && (it.container_name ?? it.Name ?? it.name ?? it.label ?? it.Label ?? it.title ?? it.Title))
                        ?? (it && (it.id != null ? String(it.id) : undefined))
                        ?? String(it);
                    return { id, name };
                });
            };
            newEdges.forEach(e => {
                const s0 = originalIdByNodeId[e.source] || e.source;
                const t0 = originalIdByNodeId[e.target] || e.target;
                if (!String(e.source).startsWith('ghost-') && !String(e.target).startsWith('ghost-')) {
                    e.data = { ...(e.data || {}), hasInfluencers: hasInf(s0, t0), influencers: getInfList(s0, t0) };
                }
            });
        }
    } catch (e) {
        console.warn('Influencers annotation failed', e);
    }

    // Normalize and de-duplicate nodes/edges to avoid React key collisions
    // 1) Normalize ids to strings
    computedNodes = (computedNodes || []).map(n => ({
        ...n,
        id: String(n.id),
        data: {
            ...(n.data || {}),
            id: n.data?.id != null ? String(n.data.id) : n.data?.id,
            originalId: n.data?.originalId != null ? String(n.data.originalId) : n.data?.originalId,
        }
    }));
    const normalizedEdges = (newEdges || []).map(e => ({
        ...e,
        id: String(e.id),
        source: String(e.source),
        target: String(e.target),
    }));

    // 2) De-duplicate by id, keeping first occurrence
    const seenNodeIds = new Set();
    computedNodes = computedNodes.filter(n => {
        if (seenNodeIds.has(n.id)) { return false; }
        seenNodeIds.add(n.id);
        return true;
    });
    const seenEdgeIds = new Set();
    const uniqueEdges = normalizedEdges.filter(e => {
        if (seenEdgeIds.has(e.id)) { return false; }
        seenEdgeIds.add(e.id);
        return true;
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
            setEdges(uniqueEdges);
        } else {
            const layouted = getLayoutedElements(
                computedNodes,
                uniqueEdges,
                'LR',
                35,
                100,
                { gridDimensions: params.flowGridDimensions }
            );
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




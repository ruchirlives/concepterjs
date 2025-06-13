import colors from "tailwindcss/colors";

export function buildVisibleEdges(params) {
    const { childMap, computedNodes: visibleNodes, allNodes, } = params;

    const newEdges = [];

    // console log the count of visible nodes and edges
    const visibleCount = visibleNodes.length;
    console.log(`Visible nodes: ${visibleCount}`);

    // build lookup of every node by id so we can climb parents
    const nodeById = {};
    allNodes.forEach(n => { nodeById[n.id] = n; });

    // console.log('nodeById', nodeById);

    // recursive helper: find the nearest ancestor that _is_ in visibleNodes
    function findVisibleAncestor(childId, level = 0) {
        if (level >= 3) return null; // Limit to 2 levels up

        const parents = nodeById[childId]?.data.parents || [];
        for (const p of parents) {
            const pid = p.id.toString();
            // only stop at a visible *group* (type === 'group')
            const candidate = nodeById[pid];
            if (candidate?.type === 'group' &&
                visibleNodes.some(n => n.id === pid)) {
                return pid;
            }
            // otherwise keep going up
            const up = findVisibleAncestor(pid, level + 1);
            if (up) return up;
        }
        return null;
    }
    // Empty the children array of each node in visibleNodes
    visibleNodes.forEach(node => {
        node.data.children.length = 0; // Clear the children array
    });

    // 1️⃣ Visible parents: direct & buried children
    visibleNodes.forEach(parentNode => {
        const parentId = parentNode.id;
        const children = childMap[parentId] || [];

        children.forEach(c => {
            const childId = c.id;
            const childVisible = visibleNodes.some(n => n.id === childId);
            const edgeId = `${parentId}-to-${childId}`;

            // A) both visible → direct edge
            if (childVisible) {
                if (!newEdges.some(e => e.id === edgeId)) { // avoid duplicates by id

                    // if c.position is a json object, use c.position.label =========
                    let data;
                    if (c.position !== null && typeof c.position === 'object') {
                        // For label trim to 20 chars
                        const label = c.position.label.length > 20
                            ? c.position.label.substring(0, 20) + '...'
                            : c.position.label;
                        const description = c.position.description;
                        data = { label: label, description: description };
                    }
                    else {
                        data = { label: c.position };
                    }
                    // ===============================================================

                    newEdges.push({ id: edgeId, type: 'customEdge', source: parentId, target: childId, data: data, style: { stroke: colors.black } });
                }
                return;
            }

            // If child is not tagged as input or output, skip it
            const childTags = c.tags
            if (!childTags.some(t => t.trim() === 'input' || t.trim() === 'output')) {
                // console.log('Skipping child without input/output tag:', c);
                return;
            }

            // B) buried child → reroute & handle on ancestor
            const ancId = findVisibleAncestor(childId);
            if (!ancId) return;
            const ancNode = nodeById[ancId];

            // Skip where ancestor is the same as parentId
            if (!ancId || ancId === parentId) return;

            // inject handle on ancId for buried childId (…)
            ancNode.data.children = ancNode.data.children || [];
            if (!ancNode.data.children.some(ch => ch.id === childId)) {
                const buried = nodeById[childId];
                console.log('Adding buried child to ancestor:', buried);
                ancNode.data.children.push({
                    id: childId,
                    name: buried.data.Name,
                    position: buried.position,
                    tags: buried.data.Tags,
                });
            }

            // push edge from parentId → ancId using that handle
            newEdges.push({
                id: edgeId,
                source: parentId,
                // sourceHandle: `out-group-${parentId}`,
                target: ancId,
                targetHandle: `in-child-${childId}-on-${ancId}`,
                /* style/label… */
            });
        });
    });

    // 2️⃣ buried parent → visible child
    visibleNodes.forEach(childNode => {
        const childId = childNode.id;
        (childNode.data.parents || []).forEach(p => {
            const parentId = p.id.toString();
            // only when parent is hidden
            if (visibleNodes.some(n => n.id === parentId)) return;

            // If parent is not tagged as input or output, skip it
            const parentTagsRaw = nodeById[parentId]?.data.Tags || [];
            const parentTags = Array.isArray(parentTagsRaw)
                ? parentTagsRaw
                : typeof parentTagsRaw === 'string'
                    ? parentTagsRaw.split(',').map(s => s.trim()).filter(Boolean)
                    : [];
            if (!parentTags.some(t => t === 'input' || t === 'output')) {
                // skip
                return;
            }

            // find the nearest visible ancestor of the buried parent
            const ancId = findVisibleAncestor(parentId);
            if (!ancId) return;

            // inject out‐child handle on ancId for buried parentId
            const ancNode = nodeById[ancId];
            ancNode.data.children = ancNode.data.children || [];
            if (!ancNode.data.children.some(ch => ch.id === parentId)) {
                const buried = nodeById[parentId];
                ancNode.data.children.push({
                    id: parentId,
                    name: buried.data.Name,
                    position: buried.position,
                    tags: buried.data.Tags,
                });
            }

            // push edge from ancId → childId using that handle
            const edgeId = `${ancId}-to-${childId}-out-${parentId}`;
            if (!newEdges.some(e => e.id === edgeId)) {
                newEdges.push({
                    id: edgeId,
                    source: ancId,
                    target: childId,
                    sourceHandle: `out-child-${parentId}-on-${ancId}`,
                    /* style/label… */
                });
            }
        });
    });


    // ✅ NEW: for each group, pull its direct kids from childMap
    visibleNodes.forEach(node => {
        if (node.type !== 'group') return;        // only for group-nodes
        node.data.children = node.data.children || [];  // ensure the array

        // look up the raw children from your childMap
        const directKids = childMap[node.id] || [];
        directKids.forEach(k => {
            const cid = k.id.toString();
            // guard against duplicates
            if (!node.data.children.some(ch => ch.id === cid)) {
                node.data.children.push({
                    id: cid,
                    name: k.name,          // or k.data.Name if you have that
                    position: k.position,
                    tags: k.tags,
                });
            }
        });
    });

    return newEdges;
}

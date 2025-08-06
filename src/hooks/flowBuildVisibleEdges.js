import colors from "tailwindcss/colors";
import { MarkerType } from '@xyflow/react';

export function buildVisibleEdges(params) {

    // params: { childMap, computedNodes, allNodes }
    // - childMap: map of parentId → array of children
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
                if (!newEdges.some(e => e.id === edgeId)) {
                    // build edge data
                    let data;
                    // console.log('DEBUG EDGE POSITION:', c.position);
                    if (c.position !== null && typeof c.position === 'object' && c.position.label) {
                        const label = c.position.label.length > 20
                            ? c.position.label.substring(0, 20) + '...'
                            : c.position.label;
                        data = { label: label, description: c.position.description };
                    } else {
                        data = { label: "" };
                    }

                    // assemble edge object
                    let edgeObj = {
                        id: edgeId,
                        source: parentId,
                        target: childId,
                        data: data,
                        style: { stroke: colors.black }
                    };

                    // Add arrow marker for successor relationships and use custom edge type for gap
                    if (c.position &&
                        ((typeof c.position === 'object' && c.position.label === 'successor') ||
                            (typeof c.position === 'string' && c.position === 'successor'))) {
                        // Generate dynamic color based on source node (same logic as customEdge.js)
                        const getHueFromString = (str) => {
                            let hash = 0;
                            for (let i = 0; i < str.length; i++) {
                                hash = (hash * 31 + str.charCodeAt(i)) % 360;
                            }
                            return hash;
                        };
                        const hue = getHueFromString(parentId);
                        const strokeColor = `hsl(${hue}, 70%, 50%)`;

                        edgeObj.markerEnd = {
                            type: MarkerType.ArrowClosed,
                            color: strokeColor,
                            width: 8,
                            height: 8,
                        };
                        // Use custom edge type for successor edges to get gap functionality
                        edgeObj.type = 'customEdge';
                        edgeObj.style = {
                            stroke: strokeColor,
                            strokeWidth: 8
                        };
                    } else {
                        // Use custom edge type for non-successor edges
                        edgeObj.type = 'customEdge';
                    }

                    newEdges.push(edgeObj);
                }
                return;
            }

            // If child is not tagged as input or output, skip it
            // const childTags = c.tags
            // if (!childTags.some(t => t.trim() === 'input' || t.trim() === 'output')) {
            //     // console.log('Skipping child without input/output tag:', c);
            //     return;
            // }

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
                // Ensure tags is an array
                let tags = buried.data.Tags;
                if (typeof tags === 'string') tags = tags.split(',').map(t => t.trim()).filter(Boolean);
                if (!Array.isArray(tags)) tags = []; // Ensure it's an array even if no tags
                ancNode.data.children.push({
                    id: childId,
                    name: buried.data.Name,
                    position: buried.position,
                    tags,
                });
            }

            // Create unique edge ID for buried child edges
            const buriedEdgeId = `${parentId}-to-${ancId}-via-${childId}`;
            if (!newEdges.some(e => e.id === buriedEdgeId)) {
                // push edge from parentId → ancId using that handle
                newEdges.push({
                    id: buriedEdgeId,
                    source: parentId,
                    target: ancId,
                    type: 'customEdge', // Add this to use the same edge renderer
                    // Remove the specific targetHandle - let React Flow use the default
                    // targetHandle: `in-child-${childId}-on-${ancId}`,
                    data: { 
                        buriedChild: childId,
                        label: `→ ${nodeById[childId]?.data.Name || childId}` 
                    },
                    style: { 
                        stroke: colors.gray[400],
                        strokeDasharray: '5,5' // Make buried edges visually distinct
                    }
                });
            }
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
            // const parentTagsRaw = nodeById[parentId]?.data.Tags || [];
            // const parentTags = Array.isArray(parentTagsRaw)
            //     ? parentTagsRaw
            //     : typeof parentTagsRaw === 'string'
            //         ? parentTagsRaw.split(',').map(s => s.trim()).filter(Boolean)
            //         : [];
            // if (!parentTags.some(t => t === 'input' || t === 'output')) {
            //     // skip
            //     return;
            // }

            // find the nearest visible ancestor of the buried parent
            const ancId = findVisibleAncestor(parentId);
            if (!ancId) return;

            // inject out‐child handle on ancId for buried parentId
            const ancNode = nodeById[ancId];
            ancNode.data.children = ancNode.data.children || [];
            if (!ancNode.data.children.some(ch => ch.id === parentId)) {
                const buried = nodeById[parentId];
                let tags = buried.data.Tags;
                if (typeof tags === 'string') tags = tags.split(',').map(t => t.trim()).filter(Boolean);
                if (!Array.isArray(tags)) tags = []; // Ensure it's an array even if no tags
                ancNode.data.children.push({
                    id: parentId,
                    name: buried.data.Name,
                    position: buried.position,
                    tags,
                });
            }

            // push edge from ancId → childId using that handle
            const edgeId = `${ancId}-to-${childId}-out-${parentId}`;
            if (!newEdges.some(e => e.id === edgeId)) {
                newEdges.push({
                    id: edgeId,
                    source: ancId,
                    target: childId,
                    type: 'customEdge', // Add this to use the same edge renderer
                    // Remove the specific sourceHandle - let React Flow use the default
                    // sourceHandle: `out-child-${parentId}-on-${ancId}`,
                    data: { 
                        buriedParent: parentId,
                        label: `from ${nodeById[parentId]?.data.Name || parentId}` 
                    },
                    style: { 
                        stroke: colors.gray[400],
                        strokeDasharray: '5,5' // Make buried edges visually distinct
                    }
                });
            }
        });
    });


    // ✅ NEW: for each group, pull its direct kids from childMap
    visibleNodes.forEach(node => {
        // console.log('Processing', node);
        if (node.type !== 'group') return;        // only for group-nodes
        node.data.children = node.data.children || [];  // ensure the array

        // look up the raw children from your childMap
        const directKids = childMap[node.id] || [];
        directKids.forEach(k => {
            const cid = k.id.toString();
            // guard against duplicates
            if (!node.data.children.some(ch => ch.id === cid && JSON.stringify(ch.tags) === JSON.stringify(k.tags))) {
                node.data.children.push({
                    id: cid,
                    name: k.name,          // or k.data.Name if you have that
                    position: k.position,
                    tags: k.tags,
                });
            }
        });
    });

    // const ids = visibleNodes.map(n => n.id);
    // const dupes = ids.filter((id, idx) => ids.indexOf(id) !== idx);
    // if (dupes.length > 0) {
    //   console.warn('Duplicate node IDs in visibleNodes:', [...new Set(dupes)]);
    // }

    return newEdges;
}

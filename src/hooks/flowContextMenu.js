import { useRef } from "react";
import toast from 'react-hot-toast';
import { useAppContext } from '../AppContext';
import {
    createContainer,
    removeChildren,
    addChildren,
    getContainerBudgetApi,
    convertToBudgetContainerApi,
    addFinanceContainerApi,
    deleteContainers,
    removeContainers,
    fetchChildren,
    embed_containers,
    fetchParentContainers,
    categorizeContainers,
    buildRelationshipsContainers,
    exportSelectedContainers,
    exportBranch,
    mergeContainers,
    joinContainers,
    add_similar,
    joinSimilarContainers,
    api_build_chain_beam,
    renameContainer,
    embedPositions,
    findSimilarPositions,
    searchPositionZ,
} from "../api";
import { handleWriteBack, requestRefreshChannel } from "./effectsShared";
import { displayContextMenu, requestAddChild } from "./flowFunctions";
import { useMenuHandlers } from "./useContextMenu";

// Explicit handler map to avoid eval and ensure bundlers keep references
const HANDLERS = {
    insertNode,
    getContainerBudgetAction,
    convertToBudgetContainerAction,
    addFinanceContainerAction,
    rename,
    view,
    deleteAction,
    removeAction,
    copyToClipboard,
    hideUnselected,
    hideChildren,
    embedContainers,
    showChildren,
    showParents,
    categorize,
    buildRelationships,
    exportSelected,
    exportBranchSelected,
    mergeSelected,
    joinSelected,
    addSelected,
    addSimilar,
    joinSimilar,
    buildChainBeam,
    renameFromDescription,
    removeFromActiveGroup,
    makeGroupNode,
    unmakeGroupNode,
    makeInputNode,
    unmakeInputNode,
    makeOutputNode,
    unmakeOutputNode,
    addLayerTag,
    removeLayerTag,
    createLayerFromVisible,
    embedPositionsAction,
    findSimilarPositionsAction,
    searchPositionZAction,
};

export const menuItems = [
    // Basics
    { handler: "view", label: "View Details", group: "Basics" },
    { handler: "rename", label: "Rename", group: "Basics" },
    { handler: "copyToClipboard", label: "Copy to Clipboard", group: "Basics" },
    { handler: "deleteAction", label: "Delete", group: "Basics" },
    { handler: "removeAction", label: "Remove from Project", group: "Basics" },

    // Visibility
    { handler: "hideUnselected", label: "Hide Unselected", group: "Visibility" },
    { handler: "hideChildren", label: "Hide Children", group: "Visibility" },
    { handler: "showChildren", label: "Show Children", group: "Visibility" },
    { handler: "showParents", label: "Show Parents", group: "Visibility" },
    { handler: "createLayerFromVisible", label: "Create Layer from Visible", group: "Visibility" },

    // Analysis
    { handler: "categorize", label: "Categorize Containers", group: "Analyze" },
    { handler: "buildRelationships", label: "Build Relationships", group: "Analyze" },

    // Combine
    { handler: "mergeSelected", label: "Merge Selected", group: "Combine" },
    { handler: "joinSelected", label: "Join Selected", group: "Combine" },
    { handler: "joinSimilar", label: "Join Top Similar", group: "Combine" },
    { handler: "addSelected", label: "Add Selected", group: "Combine" },
    { handler: "addSimilar", label: "Add Similar", group: "Combine" },
    { handler: "insertNode", label: "Insert Node", group: "Combine" },

    // AI
    { handler: "buildChainBeam", label: "Build Chain Beam", group: "AI" },
    { handler: "renameFromDescription", label: "Rename from Description", group: "AI" },

    // Positions
    { handler: "embedContainers", label: "Embed Containers", group: "Positions" },
    { handler: "embedPositionsAction", label: "Embed Positions", group: "Positions" },
    { handler: "findSimilarPositionsAction", label: "Find Similar Positions", group: "Positions" },
    { handler: "searchPositionZAction", label: "Search Position Z", group: "Positions" },

    // Groups
    { handler: "removeFromActiveGroup", label: "Remove from Active Group", group: "Groups" },
    { handler: "makeGroupNode", label: "Make Group Node", group: "Node Type" },
    { handler: "unmakeGroupNode", label: "Unmake Group Node", group: "Node Type" },
    { handler: "makeInputNode", label: "Make Input Node", group: "Node Type" },
    { handler: "unmakeInputNode", label: "Unmake Input Node", group: "Node Type" },
    { handler: "makeOutputNode", label: "Make Output Node", group: "Node Type" },
    { handler: "unmakeOutputNode", label: "Unmake Output Node", group: "Node Type" },

    // Finance
    { handler: "getContainerBudgetAction", label: "Get Container Budget", group: "Finance" },
    { handler: "convertToBudgetContainerAction", label: "Convert to Budget Container", group: "Finance" },
    { handler: "addFinanceContainerAction", label: "Add Finance Container", group: "Finance" },

    // Export
    { handler: "exportSelected", label: "Export Selected", group: "Export" },
    { handler: "exportBranchSelected", label: "Export Branch", group: "Export" },
    { handler: "exportApp", label: "Export to App", group: "Export" }
];

// FUNCTIONS *****************************************
/* eslint-disable no-unused-vars */

async function insertNode({ nodeId, selectedIds, selectedContentLayer, rowData, setRowData }) {
    // First create new node
    const newNodeName = prompt("Enter name for the new node:");
    if (!newNodeName) return;
    // Ensure Tags is always a string for downstream code that calls .split
    const tags = selectedContentLayer ? String(selectedContentLayer) : ""
    console.log("Creating new node with tags:", tags);
    const newId = await createContainer();

    // Add to rowData
    if (newId) {
        const newRow = {
            id: newId,
            Name: newNodeName,
            Description: "",
            Tags: tags
        };
        rowData.push(newRow);
        setRowData([...rowData]);
    }
    await handleWriteBack(rowData);

    console.log("New node created with id:", newId);
    // Continue to rewire relationships if applicable
    if (!newId) {
        alert("Failed to create new node.");
        return;
    }
    // Next, remove relationships from nodeId to selectedIds
    const ok = await removeChildren(nodeId, selectedIds);
    if (!ok) {
        alert("Failed to remove relationships from original node.");
        return;
    }
    // Now, add relationships from nodeId to newNode, and from newNode to selectedIds
    const ok1 = await addChildren(nodeId, [newId]);
    const ok2 = await addChildren(newId, selectedIds);
    if (!ok1 || !ok2) {
        alert("Failed to add relationships.");
        return;
    }
    await requestRefreshChannel();
}

async function getContainerBudgetAction({ selectedIds }) {
    if (!selectedIds.length) {
        toast.error("No containers selected.");
        return;
    }
    const budgets = await getContainerBudgetApi(selectedIds);
    if (!budgets.length) {
        toast("No budgets found for selected containers.");
        return;
    }
    let msg = budgets.map(b => `ID: ${b.Name} — Budget: ${b.Budget}`).join('\n');
    toast(msg, { duration: 8000 });
}

async function convertToBudgetContainerAction({ selectedIds }) {
    if (!selectedIds.length) {
        toast.error("No containers selected.");
        return;
    }
    const res = await convertToBudgetContainerApi(selectedIds);
    toast.success(res.message || "Converted to budget container.");
    requestRefreshChannel();
}

async function addFinanceContainerAction({ selectedIds }) {
    if (!selectedIds.length) {
        toast.error("No containers selected.");
        return;
    }
    const res = await addFinanceContainerApi(selectedIds);
    toast.success(res.message || "Converted to finance container.");
    requestRefreshChannel();
}

// rename
async function rename({ selectedNodes, selectedIds, rowData, setRowData }) {
    if (selectedNodes.length === 0) {
        toast.error("No nodes selected to rename.");
        return;
    }
    const name = prompt("Enter new name for the selected node(s):");
    if (!name) return;

    // Update the nodes in rowData
    const updatedRowData = rowData.map(row =>
        selectedIds.includes(row.id) ? { ...row, Name: name } : row
    );
    setRowData(updatedRowData);

    // Optionally update selectedNodes too
    selectedNodes.forEach(node => {
        if (selectedIds.includes(node.data.id)) {
            node.data.Name = name;
        }
    });

    handleWriteBack(updatedRowData);
    toast.success("Node(s) renamed successfully!");
}


async function view({ nodeId, selectedNodes }) {
    console.log(`View details for Node ID: ${nodeId}`);
    console.log("Active node's data:", selectedNodes[0]);
}

async function deleteAction({ selectedIds }) {
    // first confirm
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} container(s)? This action cannot be undone.`)) {
        return;
    }
    const ok = await deleteContainers(selectedIds);
    if (ok) requestRefreshChannel();
    else alert("Failed to delete containers.");
}

async function removeAction({ selectedIds }) {
    const ok = await removeContainers(selectedIds);
    if (ok) requestRefreshChannel();
    else alert("Failed to remove containers.");
}

async function copyToClipboard({ selectedNodes }) {
    if (!selectedNodes || selectedNodes.length === 0) {
        toast.error("No nodes selected to copy.");
        return;
    }
    try {
        // Copy only the Name text of each selected node
        const text = selectedNodes.map(n => n.data.Name).join('\n');
        await navigator.clipboard.writeText(text);
        toast.success("Copied node Name(s) to clipboard!");
    } catch (err) {
        toast.error("Failed to copy to clipboard.");
        console.error("Clipboard error:", err);
    }
}

async function hideUnselected({ selectedIds, activeGroup }) {
    if (activeGroup) {
        // Add active group to selectedIds
        selectedIds.push(activeGroup);
    }
    const ch = new BroadcastChannel("idSelectChannel");
    ch.postMessage({ selectedIds });
    ch.close();
}

async function hideChildren({ selectedNodes, rowData, setRowData }) {
    const ids = selectedNodes.map(n => n.data.id);
    const childrenIds = [];
    for (const id of ids) {
        const children = await fetchChildren(id);
        children?.forEach(child => {
            if (!childrenIds.includes(child.id)) childrenIds.push(child.id);
        });
    }
    const remaining = rowData.filter(row => !childrenIds.includes(row.id));
    setRowData(remaining);
    const ch = new BroadcastChannel("idSelectChannel");
    ch.postMessage({ selectedIds: remaining.map(r => r.id) });
    ch.close();
}

async function embedContainers({ selectedIds, nodes }) {
    // If selectedIds is empty, return all visible nodes
    if (selectedIds.length === 0) {
        const alVisibleIds = nodes.map(n => n.data.id);
        selectedIds = alVisibleIds;
        return;
    }
    const ok = await embed_containers(selectedIds);
    if (ok) {
        alert("Containers embedded successfully.");
    } else {
        alert("Failed to embed containers.");
    }
}

async function showChildren({ selectedNodes }) {
    let ids = selectedNodes.map(n => n.data.id);
    if (ids.length === 0) return;
    const childrenIds = [];
    for (const id of ids) {
        const children = await fetchChildren(id);
        children?.forEach(child => {
            if (!childrenIds.includes(child.id)) childrenIds.push(child.id);
        });
    }
    const ch = new BroadcastChannel("showChildChannel");
    childrenIds.forEach(childId => ch.postMessage({ childId }));
    ch.close();
}

async function showParents({ selectedNodes }) {
    let ids = selectedNodes.map(n => n.data.id);
    if (ids.length === 0) return;
    const parentIds = [];
    for (const id of ids) {
        const parents = await fetchParentContainers(id);
        parents?.forEach(parent => {
            if (!parentIds.includes(parent.id)) parentIds.push(parent.id);
        });
    }
    const ch = new BroadcastChannel("showParentChannel");
    parentIds.forEach(parentId => ch.postMessage({ parentId }));
    ch.close();
}

async function categorize({ nodes, selectedNodes, activeGroup }) {
    let ids = selectedNodes.map(n => n.data.id);
    if (ids.length === 0) ids = nodes.map(n => n.data.id);
    const result = await categorizeContainers(ids);
    if (!result || !result.new_category_ids) {
        alert("Failed to categorize containers.");
        return;
    }
    alert("Containers categorized successfully.");
    console.log(result.new_category_ids);
    if (!activeGroup) {
        requestRefreshChannel();
        return;
    }
    // add ids as children to the active group
    await addChildren(activeGroup, result.new_category_ids);
    // brief delay to allow the request to complete
    requestRefreshChannel();
}

async function buildRelationships({ nodes, selectedNodes }) {
    let ids = selectedNodes.map(n => n.data.id);
    if (ids.length === 0) ids = nodes.map(n => n.data.id);
    const ok = await buildRelationshipsContainers(ids);
    alert(ok ? "Relationships built successfully." : "Failed to build relationships.");
}

async function exportSelected({ selectedIds }) {
    exportSelectedContainers(selectedIds);
}

async function exportBranchSelected({ selectedIds }) {
    const data = await exportBranch(selectedIds);
    if (data) {
        alert("Branch exported successfully.");
    } else {
        alert("Failed to export branch.");
    }
}

async function mergeSelected({ selectedIds, activeGroup, activeLayers, rowData, setRowData }) {
    const ok = await mergeContainers(selectedIds);
    if (ok) {
        alert("Containers merged successfully.");
    } else {
        alert("Failed to merge containers.");
    }
    // add ids as children to the active group
    console.log("ID: ", ok.id, "Active group: ", activeGroup);
    if (activeGroup) {
        await addChildren(activeGroup, [ok.id]);
    }
    requestRefreshChannel();
}

async function joinSelected({ selectedIds, activeGroup }) {
    const ok = await joinContainers(selectedIds, true);
    if (ok) {
        alert("Containers joined successfully.");
    } else {
        alert("Failed to join containers.");
    }
    // add ids as children to the active group
    console.log("ID: ", ok.id, "Active group: ", activeGroup);
    await addChildren(activeGroup, [ok.id]);
    // brief delay to allow the request to complete
    requestRefreshChannel();
}

async function addSelected({ nodeId, selectedIds }) {
    await requestAddChild(nodeId, selectedIds);
    // set timeout to allow the request to complete before refreshing the channel
    await new Promise(resolve => setTimeout(resolve, 300));
    requestRefreshChannel();
}

async function addSimilar({ nodeId, selectedIds, nodes }) {
    // If selectedIds is empty, return all visible nodes
    if (selectedIds.length === 1 && selectedIds[0] === nodeId) {
        const alVisibleIds = nodes.map(n => n.data.id);
        console.log("No selected IDs, using all visible IDs:", alVisibleIds);
        selectedIds = alVisibleIds;
    }
    const ok = await add_similar(nodeId, selectedIds);
    if (ok) {
        alert(ok.message);
    }
    // set timeout to allow the request to complete before refreshing the channel
    await new Promise(resolve => setTimeout(resolve, 300));
    requestRefreshChannel();
}

async function joinSimilar({ selectedIds, activeGroup }) {
    if (!selectedIds.length) {
        toast.error("No containers selected.");
        return;
    }
    try {
        const res = await joinSimilarContainers(selectedIds);
        toast.success(res.message || "Joined similar containers.");
        if (res.new_container_id && activeGroup) {
            await addChildren(activeGroup, [res.new_container_id]);
        }
        requestRefreshChannel();
    } catch (err) {
        toast.error("Failed to join similar containers.");
        console.error(err);
    }
}


async function buildChainBeam({ nodes, nodeId, selectedIds }) {
    const end_node = nodeId;
    const start_node = selectedIds[0];

    const alVisibleIds = nodes.map(n => n.data.id);

    const ok = await api_build_chain_beam(start_node, end_node, alVisibleIds);
    if (ok?.narrative) {
        toast((t) => (
            <div className="max-w-[300px]">
                <div className="font-semibold mb-1">Reasoning Chain</div>
                <div className="text-sm mb-2 overflow-y-auto max-h-40 whitespace-pre-wrap">{ok.narrative}</div>
                <button
                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
                    onClick={() => {
                        navigator.clipboard.writeText(ok.narrative);
                        toast.success("Copied!");
                        toast.dismiss(t.id); // Close current toast
                    }}
                >
                    Copy to Clipboard
                </button>
            </div>
        ), {
            duration: 10000,
        });
    }
    // set timeout to allow the request to complete before refreshing the channel
    await new Promise(resolve => setTimeout(resolve, 300));
    requestRefreshChannel();
}

async function renameFromDescription({ selectedNodes, selectedIds }) {
    for (const id of selectedIds) {
        const node = selectedNodes.find(n => n.data.id === id);
        if (node) {
            const desc = node.data.Description;
            console.log(`Renaming row ${id} to ${desc}`);
            const res = await renameContainer(id);
            if (!res) alert("Failed to rename row.");
        }
    }
}

async function removeFromActiveGroup({ activeGroup, selectedIds, history }) {
    if (!activeGroup) {
        alert("No active group selected.");
        return;
    }
    let ok = await removeChildren(activeGroup, selectedIds);
    if (!ok) {
        alert("Failed to remove containers from active group.");
        return;
    }
    const prev = history[history.length - 1] || null;
    ok = await addChildren(prev, selectedIds);
    if (ok) requestRefreshChannel();
}

async function makeGroupNode({ selectedIds }) {
    console.log("Making group node for IDs:", selectedIds);
    const ch = new BroadcastChannel("addTagsChannel");
    ch.postMessage({ selectedIds, tags: "group" });
    ch.close();
}

async function unmakeGroupNode({ selectedIds }) {
    console.log("Removing group node for IDs:", selectedIds);
    const ch = new BroadcastChannel("removeTagsChannel");
    ch.postMessage({ selectedIds, tags: "group" });
    ch.close();
}

async function makeInputNode({ selectedIds }) {
    console.log("Making input node for IDs:", selectedIds);
    const ch = new BroadcastChannel("addTagsChannel");
    ch.postMessage({ selectedIds, tags: "input" });
    ch.close();
}
async function unmakeInputNode({ selectedIds }) {
    console.log("Removing input node for IDs:", selectedIds);
    const ch = new BroadcastChannel("removeTagsChannel");
    ch.postMessage({ selectedIds, tags: "input" });
    ch.close();
}
async function makeOutputNode({ selectedIds }) {
    console.log("Making output node for IDs:", selectedIds);
    const ch = new BroadcastChannel("addTagsChannel");

    ch.postMessage({ selectedIds, tags: "output" });
    ch.close();
}
async function unmakeOutputNode({ selectedIds }) {
    console.log("Removing output node for IDs:", selectedIds);

    const ch = new BroadcastChannel("removeTagsChannel");
    ch.postMessage({ selectedIds, tags: "output" });
    ch.close();
}

async function addLayerTag({ selectedIds }, layer) {
    const ch = new BroadcastChannel("addTagsChannel");
    ch.postMessage({ selectedIds, tags: layer });
    ch.close();
}

async function removeLayerTag({ selectedIds }, layer) {
    const ch = new BroadcastChannel("removeTagsChannel");
    ch.postMessage({ selectedIds, tags: layer });
    ch.close();
}

async function createLayerFromVisible({ rowData, addLayer }) {
    const layer = prompt("Enter new layer name:");
    if (!layer) return;

    if (typeof addLayer === 'function') {
        addLayer(layer);
    }

    console.log("rowData", rowData)
    const selectedIds = rowData
        .filter(n => {
            const tags = (n.Tags || '').split(',').map(t => t.trim());
            return !tags.includes(layer);
        })
        .map(n => n.id);

    if (!selectedIds.length) {
        toast.success(`All visible nodes already contain "${layer}".`);
        return;
    }

    console.log("Adding layer", layer, "to visible nodes:", selectedIds);

    const ch = new BroadcastChannel("addTagsChannel");
    ch.postMessage({ selectedIds, tags: [layer] });
    ch.close();
    toast.success(`Layer "${layer}" added to visible nodes.`);
}


async function embedPositionsAction({ selectedIds }) {
    if (!selectedIds.length) {
        toast.error("No containers selected.");
        return;
    }
    const res = await embedPositions(selectedIds);
    if (res?.message) toast.success(res.message);
    else toast.error("Failed to embed positions.");
}

async function findSimilarPositionsAction({ nodes }) {
    const positionText = prompt("Enter position text to find similar:");
    if (!positionText) return;
    const res = await findSimilarPositions(positionText);
    console.log("Similar positions response:", res);

    // Build a map of id -> Name for quick lookup
    const idToName = {};
    nodes.forEach(n => {
        idToName[n.data.id] = n.data.Name;
    });

    if (res?.similar_positions?.length) {
        // Sort by score descending
        const sorted = [...res.similar_positions].sort((a, b) => b.score - a.score);
        const msg = sorted
            .map(pos => {
                const containerName = idToName[pos.container_id] || pos.container_id;
                const childName = idToName[pos.child_id] || pos.child_id;
                const label = pos.position_label || "";
                return `Container: ${containerName}\nLabel: ${label}\nChild: ${childName}\nScore: ${pos.score.toFixed(3)}`;
            })
            .join('\n\n');
        toast.success(
            <div style={{ whiteSpace: "pre-wrap" }}>
                <b>Similar positions found:</b>
                <br />
                {msg}
            </div>,
            { duration: 10000 }
        );
    } else {
        toast.error(res?.message || "No similar positions found.");
    }
}

async function searchPositionZAction({ nodeId, selectedNodes }) {
    const node = selectedNodes.find(n => n.data.id === nodeId) || selectedNodes[0];
    const defaultValue = node?.data?.Name || "";
    const searchTerm = prompt("Search Position Z for:", defaultValue);
    if (!searchTerm) return;
    const results = await searchPositionZ(searchTerm);
    if (results.length) {
        toast.success(
            <div style={{ whiteSpace: "pre-wrap" }}>
                <b>Results:</b>
                <br />
                {results.join('\n')}
            </div>,
            { duration: 10000 }
        );
    } else {
        toast.error("No results found.");
    }
}
/* eslint-enable no-unused-vars */

/* DYNAMIC HANDLER ******************************************/
function getDynamicHandler(action) {
    if (action.startsWith('exportApp')) {
        return (ctx) => ctx.exportApp(ctx.nodeId);
    } else if (action.startsWith('addLayer:')) {
        const layer = action.split(':')[1];
        return (ctx) => addLayerTag(ctx, layer);
    } else if (action.startsWith('removeLayer:')) {
        const layer = action.split(':')[1];
        return (ctx) => removeLayerTag(ctx, layer);
    }
    return HANDLERS[action] || null;
}

// HOOK *****************************************
export function useContextMenu(flowWrapperRef, activeGroup, baseMenuItems, nodes, rowData, setRowData, history) {
    const menuRef = useRef(null);
    const { layerOptions, activeLayers, addLayer, selectedContentLayer } = useAppContext();
    const { exportApp } = useMenuHandlers(rowData, setRowData);
    const layerMenus = [
        { handler: 'addLayerMenu', label: 'Add to Layer', group: 'Layers', children: layerOptions.map(l => ({ handler: `addLayer:${l}`, label: l })) },
        { handler: 'removeLayerMenu', label: 'Remove from Layer', group: 'Layers', children: layerOptions.map(l => ({ handler: `removeLayer:${l}`, label: l })) },
    ];
    const allMenuItems = [...baseMenuItems, ...layerMenus];

    const handleContextMenu = (event, node) => {
        event.preventDefault();
        displayContextMenu(menuRef, event, node, flowWrapperRef);
    };

    const selectionContextMenu = (event, nodes) => {
        event.preventDefault();
        displayContextMenu(menuRef, event, nodes[0], flowWrapperRef);
    };

    const gearContextMenu = (event) => {
        const m = menuRef.current;
        if (!m) return;
        requestAnimationFrame(() =>
            displayContextMenu(menuRef, event, { data: { id: "gear" } }, flowWrapperRef)
        );
    };

    const onMenuItemClick = async (action) => {
        const m = menuRef.current;
        const nodeId = m?.dataset.nodeId;
        const selectedNodes = nodes.filter(n => n.selected);
        const selectedIds = selectedNodes.map(n => n.data.id);

        // If no nodes are selected:
        // - When right-clicked on a node, select that node only.
        // - When opened from the gear menu, select all nodes in view.
        if (selectedIds.length === 0) {
            if (nodeId && nodeId !== "gear") {
                const clickedNode = nodes.find(n => n.data.id === nodeId);
                if (clickedNode) {
                    selectedNodes.push(clickedNode);
                    selectedIds.push(clickedNode.data.id);
                }
            } else {
                selectedIds.push(...nodes.map(n => n.data.id));
                selectedNodes.push(...nodes);
            }
        }

        const ctx = { nodes, nodeId, selectedNodes, selectedIds, rowData, setRowData, activeGroup, history, activeLayers, addLayer, exportApp, selectedContentLayer };
        const handler = getDynamicHandler(action);
        if (!handler) return console.warn(`No handler for action "${action}"`);
        await handler(ctx);
        if (m) m.style.setProperty("display", "none", "important");
    };

    const hideMenu = () => {
        const m = menuRef.current;
        if (m) m.style.setProperty("display", "none", "important");
    };

    return {
        menuItems: allMenuItems,
        menuRef,
        handleContextMenu,
        onMenuItemClick,
        hideMenu,
        selectionContextMenu,
        gearContextMenu,
    };
}

export { removeAction };



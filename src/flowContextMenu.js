import { useRef } from "react";
import toast from 'react-hot-toast';
import { useAppContext } from './AppContext';
import {
    deleteContainers,
    renameContainer,
    removeChildren,
    fetchChildren,
    exportSelectedContainers,
    mergeContainers,
    joinContainers,
    categorizeContainers,
    embed_containers,
    buildRelationshipsContainers,
    get_mermaid,
    get_gantt,
    get_docx,
    addChildren,
    add_similar,
    api_build_chain_beam,
} from "./api";
import { requestReloadChannel, sendMermaidCodeToChannel } from "./effectsShared";
import {
    displayContextMenu,
    requestAddChild,
    requestRefreshChannel,
} from "./flowFunctions";


export const menuItems = [
    { handler: "view", label: "View Details" },
    { handler: "deleteAction", label: "Delete" },
    { handler: "hideUnselected", label: "Hide Unselected" },
    { handler: "hideChildren", label: "Hide Children" },
    { handler: "showChildren", label: "Show Children" },
    { handler: "categorize", label: "Categorize Containers" },
    { handler: "buildRelationships", label: "Build Relationships" },
    { handler: "exportMermaid", label: "Export to Mermaid" },
    { handler: "exportGantt", label: "Export to Gantt" },
    { handler: "exportDocx", label: "Export to Docx" },
    { handler: "exportSelected", label: "Export Selected" },
    { handler: "mergeSelected", label: "Merge Selected" },
    { handler: "joinSelected", label: "Join Selected" },
    { handler: "addSelected", label: "Add Selected" },
    { handler: "addSimilar", label: "Add Similar" },
    { handler: "buildChainBeam", label: "Build Chain Beam" },
    { handler: "embedContainers", label: "Embed Containers" },
    { handler: "renameFromDescription", label: "Rename from Description" },
    { handler: "removeFromActiveGroup", label: "Remove from Active Group" },
    { handler: "makeGroupNode", label: "Make Group Node" },
    { handler: "makeInputNode", label: "Make Input Node" },
    { handler: "makeOutputNode", label: "Make Output Node" },
    { handler: "unmakeInputNode", label: "Unmake Input Node" },
    { handler: "unmakeOutputNode", label: "Unmake Output Node" },
    { handler: "unmakeGroupNode", label: "Unmake Group Node" },
];
/* eslint-disable no-unused-vars */
async function view({ nodeId, selectedNodes }) {
    console.log(`View details for Node ID: ${nodeId}`);
    console.log("Active node's data:", selectedNodes[0]);
}

async function deleteAction({ selectedIds }) {
    const ok = await deleteContainers(selectedIds);
    if (ok) requestReloadChannel();
    else alert("Failed to delete containers.");
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

async function categorize({ nodes, selectedNodes, activeGroup }) {
    let ids = selectedNodes.map(n => n.data.id);
    if (ids.length === 0) ids = nodes.map(n => n.data.id);
    const ok = await categorizeContainers(ids);
    alert(ok ? "Containers categorized successfully." : "Failed to categorize containers.");
    console.log(ok.new_category_ids);
    if (!activeGroup) {
        requestReloadChannel();
        return;
    }
    ids = ok.new_category_ids;
    // add ids as children to the active group
    await addChildren(activeGroup, ids);
    // brief delay to allow the request to complete
    requestReloadChannel();
}

async function buildRelationships({ nodes, selectedNodes }) {
    let ids = selectedNodes.map(n => n.data.id);
    if (ids.length === 0) ids = nodes.map(n => n.data.id);
    const ok = await buildRelationshipsContainers(ids);
    alert(ok ? "Relationships built successfully." : "Failed to build relationships.");
}

async function exportMermaid({ selectedIds }) {
    const code = await get_mermaid(selectedIds[0]);
    sendMermaidCodeToChannel(code);
}

async function exportGantt({ selectedIds }) {
    const code = await get_gantt(selectedIds[0]);
    sendMermaidCodeToChannel(code);
}

async function exportDocx({ selectedIds }) {
    const blobUrl = await get_docx(selectedIds[0]);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = "output.docx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function exportSelected({ selectedIds }) {
    exportSelectedContainers(selectedIds);
}

async function mergeSelected({ selectedIds, activeGroup }) {
    const ok = await mergeContainers(selectedIds);
    if (ok) {
        alert("Containers merged successfully.");
    } else {
        alert("Failed to merge containers.");
    }
    // add ids as children to the active group
    console.log("ID: ", ok.id, "Active group: ", activeGroup);
    await addChildren(activeGroup, [ok.id]);
    // brief delay to allow the request to complete
    requestReloadChannel();
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
    requestReloadChannel();
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
    if (ok) requestReloadChannel();
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


const handlersByName = menuItems.reduce((map, { handler }) => {
    // eslint-disable-next-line
    const fn = eval(handler);
    if (typeof fn !== 'function') console.warn(`Handler not found for "${handler}"`);
    else map[handler] = fn;
    return map;
}, {});
/* Extra handlers for dynamic layer actions */
function getDynamicHandler(action) {
    if (action.startsWith('addLayer:')) {
        const layer = action.split(':')[1];
        return (ctx) => addLayerTag(ctx, layer);
    }
    if (action.startsWith('removeLayer:')) {
        const layer = action.split(':')[1];
        return (ctx) => removeLayerTag(ctx, layer);
    }
    return null;
}
/* eslint-enable no-unused-vars */

export function useContextMenu(flowWrapperRef, activeGroup, baseMenuItems, nodes, rowData, setRowData, history) {
    const menuRef = useRef(null);
    const { layerOptions } = useAppContext();
    const layerMenus = [
        { handler: 'addLayerMenu', label: 'Add to Layer', children: layerOptions.map(l => ({ handler: `addLayer:${l}`, label: l })) },
        { handler: 'removeLayerMenu', label: 'Remove from Layer', children: layerOptions.map(l => ({ handler: `removeLayer:${l}`, label: l })) },
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
        const selected = m?.dataset.selected;

        let selectedNodes = [];

        // If selected, then use nodeId, otherwise check for selected nodes
        if (!selected) {
            const selectedNodes = nodes.filter(n => n.selected);
            if (selectedNodes.length === 0) {
                console.warn("No nodes selected for action:", action);
                return;
            }
        }
        else {
            // If selected, we can use the nodeId directly
            console.log("Node ID from menu:", nodeId);
            selectedNodes = nodes.filter(n => n.data.id === nodeId);
        }

        const selectedIds = selectedNodes.map(n => n.data.id);

        // If no nodes are selected selectedIds will be all nodes in the graph
        if (selectedIds.length === 0) {
            selectedIds.push(...nodes.map(n => n.data.id));
        }

        const ctx = { nodes, nodeId, selectedNodes, selectedIds, rowData, setRowData, activeGroup, history };
        const handler = handlersByName[action] || getDynamicHandler(action);
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


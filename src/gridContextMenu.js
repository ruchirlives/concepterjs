import React, { useRef, useState } from "react";
import { fetchParentContainers, addChildren, removeChildren, deleteContainers, get_docx, mergeContainers, fetchContainerById, fetchChildren } from "./api"; // Import API function
import { sendGanttToChannel, sendMermaidToChannel, writeBackUpdatedData } from "./effectsShared";
import { addTagToNodes, removeTagFromNodes } from "./gridEffects";

// Context menu rendering
const ContextMenu = React.forwardRef(({ onMenuItemClick, gridApiRef, setRowData, handleAddRow, activeLayers = [], layerOptions = [] }, ref) => {
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [showRemoveMenu, setShowRemoveMenu] = useState(false);

    return (
        <div
            ref={ref}
            style={{
                position: "absolute",
                display: "none",
                backgroundColor: "#ffffff",
                border: "1px solid #ccc",
                zIndex: 1000,
                boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
            }}
        >
            <div
                onClick={() => onMenuItemClick("view", gridApiRef)}
                style={{ padding: "8px", cursor: "pointer" }}
            >
                View Details
            </div>
            {/* Delay by days */}
            <div
                onClick={() => onMenuItemClick("delay by days", gridApiRef, setRowData)}
                style={{ padding: "8px", cursor: "pointer" }}
            >
                Delay by Days
            </div>
            {/* Update gantt */}
            <div
                onClick={() => onMenuItemClick("update gantt", gridApiRef)}
                style={{ padding: "8px", cursor: "pointer" }}
            >
                Update Gantt
            </div>
            {/* Update mermaid */}
            <div
                onClick={() => onMenuItemClick("update mermaid", gridApiRef)}
                style={{ padding: "8px", cursor: "pointer" }}
            >
                Update Mermaid
            </div>
            <div
                onClick={() => onMenuItemClick("hide unselected", gridApiRef, setRowData)}
                style={{ padding: "8px", cursor: "pointer" }}
            >
                Hide Unselected
            </div>
            <div
                onClick={() => onMenuItemClick("delete", gridApiRef, setRowData)}
                style={{ padding: "8px", cursor: "pointer" }}
            >
                Delete
            </div>
            <div
                onClick={() => onMenuItemClick("parents", gridApiRef)}
                style={{ padding: "8px", cursor: "pointer" }}
            >
                Parent Containers
            </div>
            <div
                onClick={() => onMenuItemClick("add children", gridApiRef)}
                style={{ padding: "8px", cursor: "pointer" }}
            >
                Add Children
            </div>
            <div
                onClick={() => onMenuItemClick("create children", gridApiRef, setRowData, handleAddRow)}
                style={{ padding: "8px", cursor: "pointer" }}
            >
                Create Children
            </div>
            <div
                onClick={() => onMenuItemClick("remove children", gridApiRef)}
                style={{ padding: "8px", cursor: "pointer" }}
            >
                Remove Children
            </div>
            {/* Select children */}
            <div
                onClick={() => onMenuItemClick("select children", gridApiRef)}
                style={{ padding: "8px", cursor: "pointer" }}
            >
                Select Children
            </div>
            {/* Add tag */}
            <div
                onClick={() => onMenuItemClick("add tag", gridApiRef)}
                style={{ padding: "8px", cursor: "pointer" }}
            >
                Add Tag
            </div>
            {/* Add to layer */}
            <div
                onMouseEnter={() => setShowAddMenu(true)}
                onMouseLeave={() => setShowAddMenu(false)}
                style={{ padding: "8px", cursor: "pointer", position: "relative" }}
            >
                Add to Layer
                {showAddMenu && (
                    <div style={{ position: "absolute", left: "100%", top: 0, backgroundColor: "#fff", border: "1px solid #ccc", zIndex: 1000 }}>
                        {layerOptions.map((l) => (
                            <div key={l} style={{ padding: "4px 8px", cursor: "pointer" }} onClick={() => onMenuItemClick("add layer", gridApiRef, setRowData, null, l)}>
                                {l}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {/* Remove from layer */}
            <div
                onMouseEnter={() => setShowRemoveMenu(true)}
                onMouseLeave={() => setShowRemoveMenu(false)}
                style={{ padding: "8px", cursor: "pointer", position: "relative" }}
            >
                Remove from Layer
                {showRemoveMenu && (
                    <div style={{ position: "absolute", left: "100%", top: 0, backgroundColor: "#fff", border: "1px solid #ccc", zIndex: 1000 }}>
                        {layerOptions.map((l) => (
                            <div key={l} style={{ padding: "4px 8px", cursor: "pointer" }} onClick={() => onMenuItemClick("remove layer", gridApiRef, setRowData, null, l)}>
                                {l}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {/* Export to mermaid */}
            <div
                onClick={() => onMenuItemClick("export mermaid", gridApiRef)}
                style={{ padding: "8px", cursor: "pointer" }}
            >
                Export to Mermaid
            </div>
            {/* Export gantt */}
            <div
                onClick={() => onMenuItemClick("export gantt", gridApiRef)}
                style={{ padding: "8px", cursor: "pointer" }}
            >
                Export to Gantt
            </div>
            {/* Export docx */}
            <div
                onClick={() => onMenuItemClick("export docx", gridApiRef)}
                style={{ padding: "8px", cursor: "pointer" }}
            >
                Export to Docx
            </div>
            {/* Merge selected */}
            <div
                onClick={() => onMenuItemClick("merge selected", gridApiRef, setRowData)}
                style={{ padding: "8px", cursor: "pointer" }}
            >
                Merge Selected
            </div>

        </div>
    );
});

// Custom hook for managing context menu logic
export const useContextMenu = () => {
    const menuRef = useRef(null);
    const prevID = useRef(null); // Store the previous mermaid code

    const handleContextMenu = (params) => {
        params.event.preventDefault();
        const rowId = params.node.data.id;

        const menu = menuRef.current;
        if (menu) {
            const x = params.event.clientX || (params.event.touches && params.event.touches[0].clientX);
            const y = params.event.clientY || (params.event.touches && params.event.touches[0].clientY);

            menu.style.left = `${x}px`;
            menu.style.top = `${y}px`;
            menu.style.display = "block";

            // Attach rowId to the menu for later use
            menu.dataset.rowId = rowId;
        }
    };

    const onMenuItemClick = async (action, gridApiRef, setRowData, handleAddRow, layer) => {
        // const { setRowData, handleAddRow } = options;
        const menu = menuRef.current;
        const rowId = menu ? menu.dataset.rowId : null;

        const gridApi = gridApiRef.current;

        const selectedNodes = gridApi.getSelectedNodes();
        const selectedIds = selectedNodes.map((node) => node.data.id);

        if (action === "view") {
            console.log(`View details for Row ID: ${action}`);
            alert(`View details for Row ID: ${rowId}`);
        } else if (action === "delete") {
            // Prompt user to confirm deletion
            const isConfirmed = window.confirm("Are you sure you want to delete these rows?");
            if (isConfirmed) {
                // Get selected rows
                // Delete the rows
                selectedNodes.forEach((node) => {
                    gridApi.applyTransaction({ remove: [node.data] });
                });

                // Update the rowData state by filtering out the removed rows
                setRowData((prevData) => prevData.filter((row) => !selectedIds.includes(row.id)));

                // Delete using api
                const response = await deleteContainers(selectedNodes.map((node) => node.data.id));
                if (response) {
                    console.log("Rows deleted successfully.");
                } else {
                    alert("Failed to delete rows.");
                }
            }
        } else if (action === "parents") {
            try {
                const data = await fetchParentContainers(rowId); // Assume this is imported or accessible
                // Select the parent containers in the grid
                const parentIds = data.map((container) => container.id);
                parentIds.forEach((parentId) => {
                    const parentNode = gridApi.getRowNode(parentId);
                    if (parentNode) {
                        parentNode.setSelected(true); // Select the parent node
                    }
                });
                console.log("Parent containers fetched successfully:", data);
            } catch (error) {
                console.error("Error fetching parent containers:", error);
                alert("Failed to fetch parent containers.");
            }
        }
        else if (action === "add children") {
            // Add children to the selected row
            const parentId = rowId;
            // Call the API to add children
            const response = await addChildren(parentId, selectedIds);
            if (response) {
                console.log("Children added successfully.");
            } else {
                alert("Failed to add children.");
            }
        } else if (action === "create children") {
            const parentId = rowId;
            console.log("Creating children for Row ID:", parentId);

            // Create new children — returns array
            const newRows = await handleAddRow();

            if (!Array.isArray(newRows) || newRows.length === 0) {
                alert("No children created.");
                return;
            }

            const newRowIds = newRows.map((row) => row.id);

            const response = await addChildren(parentId, newRowIds);

            if (response) {
                console.log("Children created successfully.");
            } else {
                alert("Failed to create children.");
            }
        } else if (action === "remove children") {
            // Remove children from the selected row
            const parentId = rowId;
            // Call the API to remove children
            const response = await removeChildren(parentId, selectedIds);
            if (response) {
                alert("Children removed successfully.");
            } else {
                alert("Failed to remove children.");
            }
        } else if (action === "hide unselected") {
            // Hide unselected rows
            gridApi.forEachNode((node) => {
                if (!selectedIds.includes(node.data.id)) {
                    //remove node using setRowData
                    setRowData((prevData) => prevData.filter((row) => row.id !== node.data.id));
                    //remove node using gridApi
                    // gridApi.applyTransaction({ remove: [node.data] });
                }
            });
        } else if (action === "add tag") {
            // Add tag to the selected row
            const selectedNodes = gridApi.getSelectedNodes();
            // Prompt user for tag input
            const tag = window.prompt("Enter a tag for the selected rows:");
            if (tag) {
                // Loop through selected rows and add tag
                addTagToNodes(selectedNodes, tag, gridApi);
            }
        } else if (action === "add layer") {
            const selectedNodes = gridApi.getSelectedNodes();
            if (layer) {
                addTagToNodes(selectedNodes, layer, gridApi);
            }
        } else if (action === "remove layer") {
            const selectedNodes = gridApi.getSelectedNodes();
            if (layer) {
                removeTagFromNodes(selectedNodes, layer, gridApi);
            }
        }
        else if (action === "export mermaid") {
            // Export the current flowchart as a Mermaid diagram using export_mermaid api for container name field

            const firstItemId = selectedIds[0];

            await sendMermaidToChannel(firstItemId); // Close the channel after sending the message
            prevID.current = firstItemId; // Store the previous mermaid code
            console.log(prevID.current);
        }
        else if (action === "export gantt") {
            // Export the current flowchart as a Gantt chart using export_gantt api for container name field

            const firstItemId = selectedIds[0];
            await sendGanttToChannel(firstItemId); // Close the channel after sending the message
            prevID.current = firstItemId; // Store the previous mermaid code
            console.log(prevID.current);
        }
        else if (action === "update gantt") {
            await writeBackUpdatedData(gridApi, prevID, 'gantt'); // Write back the updated data to the server
        }
        else if (action === "update mermaid") {
            await writeBackUpdatedData(gridApi, prevID, 'mermaid'); // Write back the updated data to the server
        }
        else if (action === "export docx") {
            // Export the current flowchart as a docx file using export_docx API for container name field
            const firstItemId = selectedIds[0];
            const blobUrl = await get_docx(firstItemId);
            console.log(blobUrl);

            // Create a temporary download link and trigger the download
            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = "output.docx";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        else if (action === "merge selected") {
            // Merge selected rows
            // Perform merge operation here
            console.log("Merging rows with IDs:", selectedIds);
            const response = await mergeContainers(selectedIds);
            if (response) {
                const mergedRowId = response.id; // Assuming the API returns the merged row data
                console.log("Rows merged successfully.", mergedRowId);
                // Add the new merged row to the grid by fetching the updated data
                const mergedRowData = await fetchContainerById(mergedRowId); // Fetch the merged row data which returns an array with one object
                console.log(mergedRowData[0]);
                const mergedRow = mergedRowData[0]; // Get the first object from the array
                // Update the rowData state with the new merged row

                setRowData((prevData) => {
                    const updatedData = prevData.filter((row) => !selectedIds.includes(row.id));
                    return [...updatedData, mergedRow]; // Add the new merged row
                });

            } else {
                alert("Failed to merge rows.");
            }
        }
        else if (action === "select children") {
            // Select children of the selected row
            const selectedNodes = gridApi.getSelectedNodes();
            selectedNodes.forEach(async (node) => {
                // Get the children of the selected node using fetchChildren API
                const children = await fetchChildren(node.data.id);
                children.forEach((childNode) => {
                    const targetId = childNode.id;
                    // Find the child node in the grid
                    const childNodeInGrid = gridApi.getRowNode(targetId);
                    // Add the child node to the selected nodes
                    childNodeInGrid.setSelected(true);
                });
            });
        }
        else if (action === "delay by days") {
            // Delay selected rows by a specified number of days
            const selectedNodes = gridApi.getSelectedNodes();
            const delayDays = window.prompt("Enter the number of days to delay:");

            function delaySelectedRows(selectedNodes) {
                selectedNodes.forEach((node) => {
                    node.data.StartDate = new Date(node.data.StartDate); // Convert DueDate to Date object
                    node.data.StartDate.setDate(node.data.StartDate.getDate() + parseInt(delayDays)); // Delay by specified days
                    node.data.EndDate = new Date(node.data.EndDate); // Convert DueDate to Date object
                    node.data.EndDate.setDate(node.data.EndDate.getDate() + parseInt(delayDays)); // Delay by specified days


                    // Update the row using applyTransaction
                    gridApi.applyTransaction({ update: [node.data] });

                    // Write back the updated data to the server


                });
            }
            delaySelectedRows(selectedNodes);

            // Gather all updated row data from the grid
            await writeBackUpdatedData(gridApi, prevID);
        }


        // Hide menu after action
        if (menu) {
            menu.style.display = "none";
        }
    };

    const hideMenu = () => {
        const menu = menuRef.current;
        if (menu) menu.style.display = "none";
    };

    return { menuRef, handleContextMenu, onMenuItemClick, hideMenu };
};


export default ContextMenu;



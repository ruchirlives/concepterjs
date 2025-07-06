import React, { useRef } from "react";
import { handleEdgeRemoval } from './flowFunctions';
import { createNewRow } from './ModalNewContainer';
import { addChildren } from "./api";
import { requestReloadChannel } from "./effectsShared"; // Import the function to handle edge removal
import { displayContextMenu } from './flowFunctions';

export const useEdgeMenu = (flowWrapperRef, activeGroup) => {
    const menuRef = useRef(null);

    const handleEdgeMenu = (event, edge) => {
        console.log("Edge Context menu triggered", event);
        event.preventDefault(); // Prevent default context menu
        menuRef.current.edgeId = edge.id; // Store the edge ID in the menuRef for later use

        displayContextMenu(menuRef, event, { data: { id: "edge" } }, flowWrapperRef); // Call the function to display the context menu
    };

    const onMenuItemClick = async (action, rowData, setRowData, edges, setEdges) => {
        if (action === "delete edge") {
            const edgeId = menuRef.current.edgeId;
            console.log("Edge Id:", action, edgeId);

            // Perform delete edge action
            removeEdgeById(edgeId);
        }
        // Add other actions here if needed
        else if (action === "edit edge") {
            // Handle edit edge action here
            console.log("Edit edge action triggered");
        }
        else if (action === "insert node") {
            // Handle insert node action here
            console.log("Insert node action triggered");
            // Get source and target nodes from the edge
            const edgeId = menuRef.current.edgeId;
            const edge = edges.find((e) => e.id === edgeId);
            const sourceNodeId = edge.source;
            const targetNodeId = edge.target;
            console.log("Source Node ID:", sourceNodeId);
            console.log("Target Node ID:", targetNodeId);
            // Insert a new node between the source and target nodes

            // First remove the edge
            removeEdgeById(edgeId);

            // Use createNewRow to create a new node(s)
            const newNodes = await createNewRow(setRowData, activeGroup)();
            console.log("New Nodes:", newNodes);

            // For each new node, use the addChildren function to add the new node as a child of the source node
            for (const newNode of newNodes) {
                const newNodeId = newNode.id;
                console.log("Adding child:", newNodeId, "to parent:", sourceNodeId);
                const response = await addChildren(sourceNodeId, [newNodeId]);
                console.log("Response from addChildren:", response);
                // Also create a new edge between the new node and the target node using addchildren
                const response2 = await addChildren(newNodeId, [targetNodeId]);
                console.log("Response from addChildren:", response2);
            }

            requestReloadChannel(); // Call the function to reload the channel with the new node ID
        }
        else if (action === "edit narrative") {
            // Handle edit narrative action here
            console.log("Edit narrative action triggered");
            // You can implement the logic to edit the narrative of the edge here
        }
        ;
        hideMenu();

        function removeEdgeById(edgeId) {
            setEdges((oldEdges) => {
                // For each removal change, find the corresponding edge in the old edges.
                return newFunction();

                function newFunction() {
                    handleEdgeRemoval(oldEdges, edgeId);
                    // Return the new edges array after applying all changes.
                    return oldEdges.filter((edge) => edge.id !== edgeId);
                }
            });
            console.log("Edge removed:", edgeId);
        }
    }


    const hideMenu = () => {
        const menu = menuRef.current;
        if (menu) menu.style.display = "none";
    };

    return { menuRef, handleEdgeMenu, onMenuItemClick, hideMenu };
}

const EdgeMenu = React.forwardRef(({ onMenuItemClick, rowData, setRowData, edges, setEdges }, ref) => {
    return (
        <div
            ref={ref}
            style={{ display: "none" }}
            className="absolute max-h-64 overflow-y-auto bg-white border border-gray-300 rounded shadow-lg text-sm z-50 w-56"
        >
            {["delete edge", "insert node", "edit edge", "edit narrative"].map((action) => (
                <div
                    key={action}
                    onClick={() => onMenuItemClick(action, rowData, setRowData, edges, setEdges)}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                >
                    {action.replace(/_/g, " ").charAt(0).toUpperCase() + action.slice(1)}
                </div>
            ))}
        </div>
    );
});

export default EdgeMenu;
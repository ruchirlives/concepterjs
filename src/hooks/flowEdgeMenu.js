import React, { useRef } from "react";
import { handleEdgeRemoval } from './flowFunctions';
import useCreateNewRow from '../components/ModalNewContainer';
import { addChildren, removeChildren, getPosition, setPosition, setNarrative, suggestRelationship } from "../api";
import { requestRefreshChannel } from "./effectsShared"; // Import the function to handle edge removal
import { displayContextMenu } from './flowFunctions';
import { useAppContext } from '../AppContext';
import { useTiptapContext } from '../TiptapContext';
import { useOnEdgeDoubleClick } from './flowEffects'; // Import the onEdgeDoubleClick function

export const useEdgeMenu = (flowWrapperRef) => {
    const menuRef = useRef(null);
    const { setEdges } = useAppContext();
    const { tiptapContent, setTiptapContent } = useTiptapContext();
    const onEdgeDoubleClick = useOnEdgeDoubleClick(setEdges);
    const newRowFunc = useCreateNewRow();

    const handleEdgeMenu = (event, edge) => {
        console.log("Edge Context menu triggered", event);
        console.log("Edge Data:", edge);
        event.preventDefault(); // Prevent default context menu
        menuRef.current.edgeId = edge?.id || null; // Store the edge ID if available
        menuRef.current.edge = edge; // Store full edge data

        displayContextMenu(menuRef, event, { data: { id: "edge" } }, flowWrapperRef); // Display the context menu
    };

    const onMenuItemClick = async (action, rowData, setRowData) => {
        // Get source and target nodes from the stored edge
        const edge = menuRef.current.edge;
        if (!edge) return;
        console.log("Selected Edge:", edge);
        const sourceNodeId = edge.source;
        const targetNodeId = edge.target;

        // construct edgeId from edges using source -to- target
        const edgeId = sourceNodeId + "-to-" + targetNodeId;
        console.log("Source Node ID:", sourceNodeId);
        console.log("Target Node ID:", targetNodeId);
        console.log("Edge ID:", edgeId);

        if (action === "delete edge" && edgeId) {
            console.log("Edge Id:", action, edgeId);
            // Perform delete edge action
            removeEdgeById(edgeId);
        }
        // Add other actions here if needed
        else if (action === "flip edge" && edgeId) {
            // Handle flip edge action here
            console.log("Flip edge action triggered");
            // 1. Get metadata from the old edge
            const position = await getPosition(sourceNodeId, targetNodeId);
            console.log("Old Edge Position:", position);

            // 2. Remove the old edge
            console.log("Removing edge:", edgeId);
            removeEdgeById(edgeId);

            // 3. Create a new edge in the reverse direction
            //    Use addChildren to create an edge from target to source
            const response = await addChildren(targetNodeId, [sourceNodeId]);
            console.log("Response from addChildren (flip):", response);

            // 4. Copy metadata to the new edge
            if (position) {
                if (position.label) {
                    await setPosition(targetNodeId, sourceNodeId, position.label);
                }
                if (position.narrative) {
                    await setNarrative(targetNodeId, sourceNodeId, position.narrative);
                }
            }

            requestRefreshChannel();
        }
        else if (action === "rename" && edgeId) {
            // Handle rename action here useOnEdgeDoubleClick
            console.log("Rename action triggered");
            onEdgeDoubleClick(null, edge);


        }
        else if (action === "insert node" && edgeId) {
            // Handle insert node action here
            console.log("Insert node action triggered");
            // Insert a new node between the source and target nodes

            // First remove the edge
            removeEdgeById(edgeId);

            // useCreateNewRow to create a new node(s)
            const result = await newRowFunc();
            console.log("New Nodes result:", result);

            // Normalize result to an array of nodes with { id }
            let newNodes = [];
            if (Array.isArray(result)) {
                newNodes = result;
            } else if (result && (Array.isArray(result.loadedNodes) || Array.isArray(result.newRows))) {
                const a = Array.isArray(result.loadedNodes) ? result.loadedNodes : [];
                const b = Array.isArray(result.newRows) ? result.newRows : [];
                newNodes = [...a, ...b];
            }

            if (!Array.isArray(newNodes) || newNodes.length === 0) {
                console.log("No nodes created or selected");
                return;
            }

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

            requestRefreshChannel(); // Call the function to reload the channel with the new node ID
        }
        else if (action === "suggest relationship") {
            // Handle suggest relationship action here
            console.log("Suggest relationship action triggered");
            const suggestedRelationship = await suggestRelationship(sourceNodeId, targetNodeId);
            console.log("Suggested Relationship:", suggestedRelationship);
            // reload the channel to reflect the suggested relationship
            requestRefreshChannel();
        }
        else if (action === "edit narrative" && edgeId) {
            // Handle edit narrative action here
            console.log("Edit narrative action triggered");
            // Get the narrative from the edge
            const position = await getPosition(sourceNodeId, targetNodeId);
            const narrative = position?.narrative || null;

            // If narrative is null, then setNarrative to []
            if (!narrative) {
                await setNarrative(sourceNodeId, targetNodeId, []);
            }
            setTiptapContent(narrative); // Set the narrative in the AppContext
            console.log("setTiptapContent called with:", narrative);
        }
        else if (action === "replace narrative" && edgeId) {
            // Handle replace narrative action here
            console.log("Replace narrative action triggered");
            // You can implement the logic to replace the narrative of the edge here
            console.log("Tiptap Content:", tiptapContent); // Log the tiptapContent from AppContext
            // Set relationship position content using export const setPosition = async (sourceId, targetId, label) => {
            const narrative = tiptapContent; // Replace with the actual narrative you want to set
            console.log("Setting narrative to:", narrative);
            const response = await setNarrative(sourceNodeId, targetNodeId, narrative);
            console.log("Response from setNarrative:", response);
        };
        hideMenu();

        function removeEdgeById(edgeId) {
            setEdges((oldEdges) => {
                // For each removal change, find the corresponding edge in the old edges.
                console.log("Removing edge with ID:", edgeId);
                return newFunction();

                function newFunction() {
                    handleEdgeRemoval(oldEdges, edgeId);
                    // Return the new edges array after applying all changes.
                    return oldEdges.filter((edge) => edge.id !== edgeId);
                }
            });

            console.log("Edge removed:", edgeId);

            // Call your API to remove the edge
            const sourceNodeId = edge.source;
            const targetNodeId = edge.target;
            removeChildren(sourceNodeId, [targetNodeId])
                .then((response) => {
                    if (response) {
                        console.log("Edge removed successfully.");
                    } else {
                        alert("Failed to remove edge.");
                    }
                })
                .catch((error) => {
                    console.error("Error removing edge:", error);
                    alert("Failed to remove edge.");
                });
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
            {["delete edge", "rename", "insert node", "flip edge", "edit narrative", "replace narrative", "suggest relationship"].map((action) => (
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

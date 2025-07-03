import { useEffect, useRef, useCallback } from "react";
import { addChildren, clearContainers, fetchContainers, writeBackData, requestRekey } from "./api";
import { setApiUrl } from "./apiConfig";
import { formatDateFields, handleWriteBack } from "./effectsShared";

// ==================== UTILITIES ====================

export const flashAndScrollToRow = (rowId, gridApiRef) => {
    const rowNode = getRowNodeSafely(gridApiRef, rowId);
    if (!rowNode) return;

    gridApiRef.current.flashCells({ rowNodes: [rowNode] });
    gridApiRef.current.ensureNodeVisible(rowNode, "middle");
}

export const useRowSelectMessage = (rowData, setRowData, gridApiRef) => {
    const handleRowSelect = useCallback((event) => {
        const { nodeId } = event.data;
        flashAndScrollToRow(nodeId, gridApiRef);

        const rowNode = gridApiRef.current?.getRowNode(nodeId);
        if (rowNode) {
            rowNode.setSelected(true, true);
        } else {
            console.error("Row not found:", nodeId);
        }
    }, [gridApiRef]);

    useBroadcastChannel('rowSelectChannel', handleRowSelect, [handleRowSelect]);
};

// ==================== BUTTON EFFECTS ====================
export const useClearButtonEffect = (setRowData, setCurrentContainer) => {
    const handleClearClick = useCallback(() => {
        setRowData([]);
        clearContainers();
        setCurrentContainer("New");
    }, [setRowData, setCurrentContainer]);

    useButtonEffect("clearButton", handleClearClick, [handleClearClick]);
};


// Effect to fetch initial data
export const useFetchData = (setRowData, fetchContainers) => {
    useEffect(() => {
        console.log("Fetching initial data..."); // Debugging line
        const fetchData = async () => {
            const data = await fetchContainers();
            if (!data || data.length === 0) {
                console.warn("No data fetched from the server.");
                return;
            }
            formatDateFields(data);
            setRowData(data);
        };

        fetchData();
    }, [setRowData, fetchContainers]);
};

export const useWriteBackButton = (rowData) => {
    const handleWriteBackClick = useCallback(() => handleWriteBack(rowData), [rowData]);
    useButtonEffect("writeBackButton", handleWriteBackClick, [handleWriteBackClick]);
};

export const useAddRowButton = (handleAddRow) => {
    useButtonEffect("addRowButton", handleAddRow, [handleAddRow]);
};


export const useLoadButtonEffect = (setIsLoadModalOpen, setMerge) => {
    const handleOpenLoadModal = useCallback(() => {
        setMerge(false);
        setIsLoadModalOpen(true);
    }, [setMerge, setIsLoadModalOpen]);

    useButtonEffect("loadContainersButton", handleOpenLoadModal, [handleOpenLoadModal]);
};

export const useImportButtonEffect = (setIsLoadModalOpen, setMerge) => {
    const handleOpenImportModal = useCallback(() => {
        setMerge(true);
        setIsLoadModalOpen(true);
    }, [setMerge, setIsLoadModalOpen]);

    useButtonEffect("importContainersButton", handleOpenImportModal, [handleOpenImportModal]);
};

export const useSaveButtonEffect = (saveData, currentContainer) => {
    const handleSaveClick = useCallback(async () => {
        // Check if there are any containers in the backend
        const response = await fetchContainers();
        if (!response || response.length === 0) {
            console.log(response);
            alert("No containers found. Please create a container or reload first.");
            return;
        }

        console.log("Backend is active with the following number of containers:", response.length);

        const name = prompt("Enter a name for the save:", currentContainer);
        if (name) {
            saveData(name);
        }
    }, [saveData, currentContainer]);

    useButtonEffect("saveContainersButton", handleSaveClick, [handleSaveClick]);
};

// Effect to populate dropdown and attach listener
export const useDropDownEffect = () => {
    useEffect(() => {
        const dropDown = document.getElementById("ServerSelector");
        const REACT_APP_API_URLS = process.env.REACT_APP_API_URLS;

        // Parse the JSON string
        var urls = {};
        if (REACT_APP_API_URLS) {
            try {
                urls = JSON.parse(REACT_APP_API_URLS);
            } catch (error) {
                console.error("Failed to parse REACT_APP_API_URLS:", error);
            }
        }

        // Populate the dropdown menu
        if (dropDown) {
            // Clear existing options
            dropDown.innerHTML = "";

            // Add a default option
            const defaultOption = document.createElement("option");
            defaultOption.value = "";
            defaultOption.textContent = "Select Server";
            dropDown.appendChild(defaultOption);

            // Add options from urls which is a json dictionary
            if (urls) {
                console.log(urls);
                Object.keys(urls).forEach((key) => {
                    const option = document.createElement("option");
                    option.value = urls[key];
                    option.textContent = key;
                    dropDown.appendChild(option);
                });

            }

        }

        // Event listener for dropdown change
        const handleDropDownChange = (event) => {
            setApiUrl(event.target.value);
        };

        if (dropDown) {
            dropDown.addEventListener("change", handleDropDownChange);
        }

        return () => {
            if (dropDown) {
                dropDown.removeEventListener("change", handleDropDownChange);
            }
        };
    }, []);
};

// Effect to load data from the server and attach listener to loadDataButton
export const useLoadDataEffect = (setRowData, fetchContainers, sendFilteredRows) => {
    useEffect(() => {
        const loadDataButton = document.getElementById("loadDataButton");

        const handleLoadData = asyncDataLoaderWithDateFormatting(fetchContainers, setRowData);

        if (loadDataButton) {
            loadDataButton.addEventListener("click", handleLoadData);
        }

        return () => {
            if (loadDataButton) {
                loadDataButton.removeEventListener("click", handleLoadData);
            }
        };
    }, [setRowData, fetchContainers, sendFilteredRows]);
};

export const useFilteredRowContext = (rowData, sendFilteredRows) => {
    const prevCountRef = useRef(rowData.length);

    useEffect(() => {
        const refreshButton = document.getElementById("refreshButton");
        const handleRefreshClick = () => sendFilteredRows();

        if (refreshButton) {
            refreshButton.addEventListener("click", handleRefreshClick);
        }

        // Update when row count changes
        if (rowData.length !== prevCountRef.current) {
            sendFilteredRows();
            prevCountRef.current = rowData.length;
        }

        return () => {
            if (refreshButton) {
                refreshButton.removeEventListener("click", handleRefreshClick);
            }
        };
    }, [rowData.length, sendFilteredRows]);
};

export const useAddChildChannel = (gridApiRef, setRowData) => {
    useEffect(() => {
        const channel = new BroadcastChannel('addChildChannel');

        const handleLoadData = asyncDataLoaderWithDateFormatting(fetchContainers, setRowData);

        const add_Children = async (parentId, selectedIds) => {
            await addChildren(parentId, selectedIds);
        };

        channel.onmessage = async (event) => {
            const { parentId, selectedIds } = event.data;
            console.log("Received addChild request:", parentId, selectedIds);

            try {
                await add_Children(parentId, selectedIds);
                await handleLoadData();
            } catch (error) {
                console.error("Error handling addChild request:", error);
            }
        };

        return () => {
            channel.close();
        };
    }, [gridApiRef, setRowData]);
};

export const useAddTagsChannel = (gridApiRef, setRowData) => {
    const handleAddTags = useCallback(async (event) => {
        const { selectedIds, tags } = event.data;
        console.log("Received addTags request:", tags);

        try {
            const selectedNodes = selectedIds.map(id => gridApiRef.current.getRowNode(id));
            addTagToNodes(selectedNodes, tags, gridApiRef.current);
            setRowData((prev) => {
                const updated = [...prev, ...selectedNodes.map(node => node.data)];
                writeBackData(updated);
                return updated;
            });
        } catch (error) {
            console.error("Error handling addTags request:", error);
        }
    }, [gridApiRef, setRowData]);

    useBroadcastChannel('addTagsChannel', handleAddTags, [handleAddTags]);
}

// removeTagsChannel
export const useRemoveTagsChannel = (gridApiRef, setRowData) => {
    const handleRemoveTags = useCallback(async (event) => {
        const { selectedIds, tags } = event.data;
        console.log("Received removeTags request:", tags);

        try {
            const selectedNodes = selectedIds.map(id => gridApiRef.current.getRowNode(id));
            removeTagFromNodes(selectedNodes, tags, gridApiRef.current);
            setRowData((prev) => {
                const updated = [...prev, ...selectedNodes.map(node => node.data)];
                writeBackData(updated);
                return updated;
            });
        } catch (error) {
            console.error("Error handling removeTags request:", error);
        }
    }, [gridApiRef, setRowData]);

    useBroadcastChannel('removeTagsChannel', handleRemoveTags, [handleRemoveTags]);
};

export const useRequestReloadChannel = (setRowData) => {
    useEffect(() => {
        const channel = new BroadcastChannel('requestReloadChannel');

        channel.onmessage = async (event) => {
            console.log("Received requestReload message:", event.data);
            asyncDataLoaderWithDateFormatting(fetchContainers, setRowData)();
        };

        return () => {
            channel.close();
        };
    }, [setRowData]);
}

export const useRekeyButtonEffect = () => {
    const handleRekeyClick = useCallback(async () => {
        console.log("Rekey button clicked");
        const resp = await requestRekey();
        console.log("Rekey response:", resp.message);
        // Reload
        const channel = new BroadcastChannel('requestReloadChannel');
        channel.postMessage({ type: "reload" });
    }, []);

    useButtonEffect("requestRekeyButton", handleRekeyClick, [handleRekeyClick]);
};


/**
 * Reusable hook for attaching button event listeners
 */
const useButtonEffect = (buttonId, handler, dependencies = []) => {
    useEffect(() => {
        const button = document.getElementById(buttonId);

        if (button) {
            button.addEventListener("click", handler);
        }

        return () => {
            if (button) {
                button.removeEventListener("click", handler);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [buttonId, handler, ...dependencies]);
};

/**
 * Reusable hook for broadcast channels
 */
const useBroadcastChannel = (channelName, messageHandler, dependencies = []) => {
    useEffect(() => {
        const channel = new BroadcastChannel(channelName);
        channel.onmessage = messageHandler;

        return () => {
            channel.close();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelName, messageHandler, ...dependencies]);
};

/**
 * Async data loader with date formatting
 */
const asyncDataLoaderWithDateFormatting = (fetchContainers, setRowData) => {
    return async () => {
        const data = await fetchContainers();
        console.log("Reloaded");
        formatDateFields(data);
        setRowData(data);
    };
};

/**
 * Utility to get row node safely
 */
const getRowNodeSafely = (gridApi, nodeId) => {
    if (!gridApi?.current) {
        console.error("Grid API not available");
        return null;
    }

    const rowNode = gridApi.current.getRowNode(nodeId);
    if (!rowNode) {
        console.error("Row not found:", nodeId);
    }

    return rowNode;
};

// ==================== GRID UTILITIES ====================
export function addTagToNodes(selectedNodes, tag, gridApi) {
    selectedNodes.forEach((node) => {
        const existingTags = node.data.Tags;
        // Append the new tag to existing comma separated tags
        node.data.Tags = existingTags ? `${existingTags}, ${tag}` : tag;
        // Update the row using applyTransaction
        gridApi.applyTransaction({ update: [node.data] });
    });
}

export function removeTagFromNodes(selectedNodes, tag, gridApi) {
    selectedNodes.forEach((node) => {
        const existingTags = node.data.Tags;
        // Remove the tag from existing comma separated tags
        if (existingTags) {
            const tagsArray = existingTags.split(',').map(t => t.trim());
            const updatedTagsArray = tagsArray.filter(t => t !== tag);
            node.data.Tags = updatedTagsArray.join(', ');
            // Update the row using applyTransaction
            gridApi.applyTransaction({ update: [node.data] });
        }
    });
}

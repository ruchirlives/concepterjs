import { useEffect, useRef, useCallback } from "react";
import { addChildren, clearContainers, fetchContainers, writeBackData, requestRekey, requestDedup, loadContainers } from "./api";
import { setApiUrl } from "./apiConfig";
import { formatDateFields, handleWriteBack } from "./effectsShared";
import API_URLS from "./globalconfig";
import { useAppContext } from "AppContext";
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

        // Use imported API_URLS
        const urls = API_URLS;

        // Populate the dropdown menu
        if (dropDown) {
            dropDown.innerHTML = "";

            const defaultOption = document.createElement("option");
            defaultOption.value = "";
            defaultOption.textContent = "Select Server";
            dropDown.appendChild(defaultOption);

            if (urls) {
                Object.keys(urls).forEach((key) => {
                    const option = document.createElement("option");
                    option.value = urls[key];
                    option.textContent = key;
                    dropDown.appendChild(option);
                });
            }
        }

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
export const useReloadEffect = () => {
    const { lastLoadedFile } = useAppContext();
    useEffect(() => {
        console.log("Using ReLoad loadDataButton effect...");
        const loadDataButton = document.getElementById("loadDataButton");

        const handleLoadData = () => {
            console.log("Load data button clicked");
            loadContainers(lastLoadedFile).then((data) => {
                console.log("Loaded data:", data);
            });
            // Broadcast a message to requestRefreshChannel
            setTimeout(() => {
                const channel = new BroadcastChannel('requestRefreshChannel');
                channel.postMessage({ type: 'refresh' });
            }, 200);
        };

        if (loadDataButton) {
            loadDataButton.addEventListener("click", handleLoadData);
        }

        return () => {
            if (loadDataButton) {
                loadDataButton.removeEventListener("click", handleLoadData);
            }
        };
    }, [lastLoadedFile]);
};

export const useRefreshEffect = (rowData, setRowData, fetchContainers, sendFilteredRows) => {
    const prevCountRef = useRef(rowData.length);

    useEffect(() => {
        const refreshButton = document.getElementById("refreshButton");
        const handleRefreshClick = async () => {
            await fetchContainers().then((data) => {
                console.log("Data refreshed:", data);
                formatDateFields(data);
                setRowData(data);
                // Remove sendFilteredRows() from here
            });
        };

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
    }, [rowData.length, setRowData, fetchContainers, sendFilteredRows]);
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
                const updated = prev.map(row => {
                    const node = selectedNodes.find(n => n.data.id === row.id);
                    return node ? { ...row, ...node.data } : row;
                });
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
                const updated = prev.map(row => {
                    const node = selectedNodes.find(n => n.data.id === row.id);
                    return node ? { ...row, ...node.data } : row;
                });
                writeBackData(updated);
                return updated;
            });
        } catch (error) {
            console.error("Error handling removeTags request:", error);
        }
    }, [gridApiRef, setRowData]);

    useBroadcastChannel('removeTagsChannel', handleRemoveTags, [handleRemoveTags]);
};

export const useRequestRefreshChannel = (setRowData) => {
    useEffect(() => {
        const channel = new BroadcastChannel('requestRefreshChannel');

        channel.onmessage = async (event) => {
            console.log("Received requestRefresh message:", event.data);
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
        const channel = new BroadcastChannel('requestRefreshChannel');
        channel.postMessage({ type: "reload" });
    }, []);

    useButtonEffect("requestRekeyButton", handleRekeyClick, [handleRekeyClick]);
};

// Deduplication button effect
export const useDedupButtonEffect = (setRowData) => {
    const handleDedupClick = useCallback(async () => {
        console.log("Deduplication button clicked");
        const resp = await requestDedup();
        console.log("Deduplication response:", resp.message);
        // Reload
        const channel = new BroadcastChannel('requestRefreshChannel');
        channel.postMessage({ type: "reload" });
    }, []);

    useButtonEffect("requestDedupButton", handleDedupClick, [handleDedupClick]);
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

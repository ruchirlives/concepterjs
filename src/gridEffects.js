import { useEffect, useRef } from "react";
import { addChildren, clearContainers, fetchContainers, requestRekey, writeBackData } from "./api"; // Import API function
import { setApiUrl } from "./apiConfig";
import { formatDateFields, handleWriteBack } from "./effectsShared";

export const flashAndScrollToRow = (rowId, gridApiRef) => {
    // Highlight the row
    // Try to get the row node by ID
    const rowNode = gridApiRef.current.getRowNode(rowId);
    // If the row node exists, flash and scroll to it

    if (!rowNode) {
        console.error("Row not found:", rowId);
        return;
    }

    gridApiRef.current.flashCells({ rowNodes: [rowNode] });
    gridApiRef.current.ensureNodeVisible(rowNode, "middle");
}

export const useRowSelectMessage = (rowData, setRowData, gridApiRef) => {
    useEffect(() => {
        const channel = new BroadcastChannel('rowSelectChannel');
        channel.onmessage = (event) => {
            const { nodeId } = event.data;
            // Handle the selection logic here.
            flashAndScrollToRow(nodeId, gridApiRef);
            // Make row selected without deselecting others
            const rowNode = gridApiRef.current.getRowNode(nodeId);
            if (rowNode) {
                rowNode.setSelected(true, true); // Select the row without deselecting others
            } else {
                console.error("Row not found:", nodeId);
            }

        };

        return () => {
            // The cleanup function closes the channel when the component unmounts.
            channel.close();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gridApiRef]);
};

// Effect to clear the rowdata and attach this to the clear button
export const useClearButtonEffect = (setRowData, setCurrentContainer) => {
    useEffect(() => {
        const clearButton = document.getElementById("clearButton");

        const handleClearClick = () => {
            setRowData([]);
            clearContainers();
            setCurrentContainer("New");
        };

        clearButton?.addEventListener("click", handleClearClick);
        return () => clearButton?.removeEventListener("click", handleClearClick);
    });  // ← run once on mount
};


// Effect to fetch initial data
export const useFetchData = (setRowData, fetchContainers) => {
    useEffect(() => {
        console.log("Fetching initial data..."); // Debugging line
        const fetchData = async () => {
            const data = await fetchContainers();
            formatDateFields(data);
            setRowData(data);
        };

        fetchData();
    }, [setRowData, fetchContainers]);
};

// Effect to attach write-back button listener
export const useWriteBackButton = (rowData) => {
    useEffect(() => {
        const writeBackButton = document.getElementById("writeBackButton");

        const clickHandler = () => handleWriteBack(rowData);

        if (writeBackButton) {
            writeBackButton.addEventListener("click", clickHandler);
        }

        return () => {
            if (writeBackButton) {
                writeBackButton.removeEventListener("click", clickHandler);
            }
        };
    }, [rowData]);
};

// Effect to attach add-row button listener
export const useAddRowButton = (rowData, setRowData, handleAddRow) => {
    useEffect(() => {
        const addRowButton = document.getElementById("addRowButton");




        if (addRowButton) {
            addRowButton.addEventListener("click", handleAddRow);
        }

        return () => {
            if (addRowButton) {
                addRowButton.removeEventListener("click", handleAddRow);
            }
        };
    }, [rowData, setRowData, handleAddRow]);
};


// Effect to attach load button listener
export const useLoadButtonEffect = (setIsLoadModalOpen, setMerge) => {
    useEffect(() => {
        const loadButton = document.getElementById("loadContainersButton");

        const handleOpenLoadModal = () => {
            setMerge(false); // Set merge to false when load button is clicked
            setIsLoadModalOpen(true);
        };

        if (loadButton) {
            loadButton.addEventListener("click", handleOpenLoadModal);
        }

        return () => {
            if (loadButton) {
                loadButton.removeEventListener("click", handleOpenLoadModal);
            }
        };
    }, [setIsLoadModalOpen, setMerge]);
};

export const useImportButtonEffect = (setIsLoadModalOpen, setMerge) => {
    useEffect(() => {
        const importButton = document.getElementById("importContainersButton");

        const handleOpenImportModal = () => {
            setMerge(true); // Set merge to true when import button is clicked
            setIsLoadModalOpen(true);
        };

        if (importButton) {
            importButton.addEventListener("click", handleOpenImportModal);
        }

        return () => {
            if (importButton) {
                importButton.removeEventListener("click", handleOpenImportModal);
            }
        };
    }, [setIsLoadModalOpen, setMerge]);
}

export const useRekeyButtonEffect = () => {
    useEffect(() => {
        const rekeyButton = document.getElementById("requestRekeyButton");
        console.log("Rekey button:", rekeyButton); // Debugging line

        const handleRekeyClick = async () => {
            console.log("Rekey button clicked");
            const resp = await requestRekey();
            console.log("Rekey response:", resp.message); // Debugging line
            // Reload
            const channel = new BroadcastChannel('requestReloadChannel');
            channel.postMessage({ type: "reload" });
        };

        if (rekeyButton) {
            rekeyButton.addEventListener("click", handleRekeyClick);
        }

        return () => {
            if (rekeyButton) {
                rekeyButton.removeEventListener("click", handleRekeyClick);
            }
        };
    }, []);
}

// Effect to attach save button listener
export const useSaveButtonEffect = (saveData, currentContainer) => {
    useEffect(() => {
        // Get the button element from index.html
        const saveButton = document.getElementById("saveContainersButton");

        // Define the click handler
        const handleSaveClick = () => {
            const name = prompt("Enter a name for the save:", currentContainer);
            if (name) {
                saveData(name); // Call the save function
            }
        };

        // Attach the event listener
        if (saveButton) {
            saveButton.addEventListener("click", handleSaveClick);
        }

        // Cleanup: Remove the event listener when the component unmounts
        return () => {
            if (saveButton) {
                saveButton.removeEventListener("click", handleSaveClick);
            }
        };
    }, [saveData, currentContainer]); // Dependency: Re-attach listener if saveData changes

    // No return value is needed for this effect
    return null;
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

export const useFilteredRowBroadcast = (rowData, sendFilteredRows) => {
    const prevCountRef = useRef(rowData.length);

    // useffect when broadcast requestRefresh received
    useEffect(() => {
        const channel = new BroadcastChannel('requestRefreshChannel');

        channel.onmessage = (event) => {
            console.log("Received requestRefresh message:");
            sendFilteredRows();
        };

        return () => {
            channel.close();
        };
    }, [sendFilteredRows]);

    useEffect(() => {
        const refreshButton = document.getElementById("refreshButton");
        const handleRefreshClick = () => sendFilteredRows();

        if (refreshButton) {
            refreshButton.addEventListener("click", handleRefreshClick);
        }

        // Only broadcast when row count actually changes
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
    useEffect(() => {
        const channel = new BroadcastChannel('addTagsChannel');

        channel.onmessage = async (event) => {
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
        };

        return () => {
            channel.close();
        };
    }, [gridApiRef, setRowData]);
}

// removeTagsChannel
export const useRemoveTagsChannel = (gridApiRef, setRowData) => {
    useEffect(() => {
        const channel = new BroadcastChannel('removeTagsChannel');

        channel.onmessage = async (event) => {
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
        };

        return () => {
            channel.close();
        };
    }, [gridApiRef, setRowData]);
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


function asyncDataLoaderWithDateFormatting(fetchContainers, setRowData) {
    return async () => {
        const data = await fetchContainers();
        console.log("Reloaded"); // Debugging line
        // Change StartDate and EndDate to be in MM-DD-YYYY format
        formatDateFields(data);
        setRowData(data);
    };
}

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

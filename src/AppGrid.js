// React imports
import React, { useState, useRef, useEffect } from "react";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry } from "ag-grid-community";
import { createNewRow } from "./ModalNewContainer"; // Import the function to create a new row
import NamePromptModal from "./ModalNamePrompt";

// My imports
import ContextMenu, { useContextMenu } from "./gridContextMenu";
import LoadModal from "./ModalLoad";
// import MiniMap from "./ModalMiniMap"; // Import the MiniMap component
import columnDefs from "./gridColumnDefs";
import { fetchContainers, fetchChildren, saveContainers, fetchContainerById } from "./api";
import {
  useFetchData, useWriteBackButton, useAddRowButton, useLoadButtonEffect, useImportButtonEffect,
  useSaveButtonEffect, useDropDownEffect, useLoadDataEffect, useFilteredRowBroadcast,
  useClearButtonEffect, useRowSelectMessage, flashAndScrollToRow, useAddChildChannel, useRequestReloadChannel, useRekeyButtonEffect, useAddTagsChannel, useRemoveTagsChannel
} from "./gridEffects";
import { handleWriteBack } from "./effectsShared";

// Import the custom theme
import "ag-grid-community/styles/ag-theme-alpine.css"; // Default theme as fallback
import { themeQuartz, colorSchemeDark } from "ag-grid-community";

// Import the required module
import { AllCommunityModule } from "ag-grid-community";

// Register required modules
ModuleRegistry.registerModules([AllCommunityModule]);

const App = () => {
  const [rowData, setRowData] = useState([]); // State to hold fetched data
  // const [miniMapData, setMiniMapData] = useState([]); // Mini-map children data
  // const [lastSelectedRow, setLastSelectedRow] = useState(null); // Last selected row
  const [isLoadModalOpen, setLoadModalOpen] = useState(false); // State for load modal

  const [merge, setMerge] = useState(false); // State for merge functionality

  // State to store name of the current container
  const [currentContainer, setCurrentContainer] = useState(null);
  const [activeGroup, setActiveGroup] = useState(null);
  const [collapsed, setCollapsed] = React.useState(false);

  // Reference to the grid API
  const gridApiRef = useRef(null); // Ref to store gridApi

  const onGridReady = (params) => {
    gridApiRef.current = params.api; // Store gridApi in ref
    console.log("Grid API initialized:", gridApiRef.current); // Debugging
  };

  // to use myTheme in an application, pass it to the theme grid option
  const myTheme = themeQuartz.withPart(colorSchemeDark);

  // Grid options for advanced configurations
  const gridOptions = {
    rowDragManaged: true, // Enables managed drag-and-drop
    getRowId: (params) => String(params.data.id), // Ensure the ID is a string
    animateRows: true,    // Smooth animations during dragging
    getRowHeight: (params) => {
      // Calculate height dynamically based on the description length
      if (!params.hidden && params.data && params.data.Description && params.data.Description.length > 150) {
        return 100; // Higher for long descriptions
      }
      else if (params.hidden) {
        return 0; // Hides the row
      }
      return 60; // Default height
    },
    rowSelection: {
      mode: 'multiRow',
      checkboxes: false,
      enableClickSelection: true,
    },
    // onRowSelected: (event) => onRowSelected(event), // Row selection handler
    onCellContextMenu: (event) => handleContextMenu(event), // Context menu handler
    // Apply row style based on Horizon field value
    getRowStyle: (params) => {
      const horizonValue = params.data.Horizon; // Get the Horizon field value
      if (params.data.hidden) {
        return { color: 'DarkGrey' };  // Hides the row
      }
      if (horizonValue === "short") {
        return { color: "white" }; // Green for high horizon
      } else if (horizonValue === "medium") {
        return { color: "LightGrey" }; // Yellow for medium horizon
      } else if (horizonValue === "long") {
        return { color: "SlateGrey" }; // Red for low horizon
      }
      else if (horizonValue === "completed") {
        return { color: "green" }; // Green for completed
      }
      return {}; // Default style
    },

  };

  // Function to save data with the provided name
  const saveData = (name) => {
    console.log(`Data saved under the name: ${name}`);
    // First writeback the data to the server
    handleWriteBack(rowData);
    saveContainers(name);

  };

  const handleAddRow = createNewRow(setRowData, activeGroup); // Function to create a new row

  // Handle row selection and fetch children dynamically
  // const onRowSelected = async (event) => {
  //   if (event.node.__selected) {
  //     const parentRow = event.data;
  //     setLastSelectedRow(parentRow); // Save the last selected row
  //     // Fetch children from the API
  //     const children = await fetchChildren(parentRow.id);
  //     setMiniMapData(children); // Populate mini-map with fetched children
  //   }
  // };

  // Add a child row to the main grid if it doesn’t already exist
  const addRowIfNotExists = (child) => {
    console.log("Adding child row:", child);
    setRowData((prevData) => {
      const exists = prevData.some((row) => row.id === child.id);
      if (!exists) {
        return [...prevData, child];
      } else {
        // alert("Row already exists in the main grid.");
        // Highlight the existing row
        flashAndScrollToRow(child.id, gridApiRef); // Flash the row

      }
      return prevData;
    });
  };

  // Add channel to listen for messages to activate addRowIfNotExists
  useEffect(() => {
    const channel = new BroadcastChannel("showChildChannel");
    channel.onmessage = async (event) => {
      const { childId } = event.data;
      console.log("Received childId:", childId);
      // Fetch the child data from the API
      const child = rowData.find((row) => row.id === childId);
      if (!child) {
        console.error("Child not found in rowData:", childId);
        // fetch the child data from the API
        await fetchContainerById(childId).then((childData) => {
          if (childData) {
            addRowIfNotExists(childData); // Add the child row to the main grid
          } else {
            console.error("Child data not found for ID:", childId);
          }
        });
        return;
      }
      addRowIfNotExists(child); // Add the child row to the main grid
    };
    return () => {
      channel.close(); // Close the channel when the component unmounts
    };
  });

  // Use the custom context menu logic
  const { menuRef, handleContextMenu, onMenuItemClick, hideMenu } = useContextMenu();

  const sendFilteredRows = () => {
    // get currently filtered rows
    const filteredRowData = [];

    const displayedRowCount = gridApiRef.current.getDisplayedRowCount();

    for (let i = 0; i < displayedRowCount; i++) {
      const rowNode = gridApiRef.current.getDisplayedRowAtIndex(i);
      if (rowNode) {
        filteredRowData.push(rowNode.data);
      }
    }

    // console.log('Filtered rows:', filteredRowData);

    // Create BroadcastChannel
    const channel = new BroadcastChannel('tagSelectChannel');
    // Send message
    channel.postMessage({ tagFilter: filteredRowData });
    // Close the channel
    channel.close();
  }

  // OnFilter
  const onFilterChanged = (e) => {
    const colId = e.columns[0].colId;
    if (colId === "Tags") {
      // console.log('Filter changed', e.columns[0]);

      // Send filtered rows
      sendFilteredRows();
    }
  };

  const handleCellDoubleClick = (params) => {
    if (params.colDef.field === "id") {
      // Prevent editing or do something else
      console.log("Double-clicked ID column – editing suppressed. Params:", params.value);
      // Do NOT call startEditingCell() — default behaviour will be blocked since editable is false
      const channel = new BroadcastChannel('selectNodeChannel');
      channel.postMessage({ nodeId: params.value });
      channel.close();
    } else {
      console.log("Double-clicked:", params.colDef.field, "with value:", params.value);
      // Default AG Grid editing will occur automatically for editable: true
    }
  };

  // set up a useeffect that listens to const channel = new BroadcastChannel("idSelectChannel");
  // and calls onMenuItemClick with the selectedIds action hide unselected

  useEffect(() => {
    const channel = new BroadcastChannel("idSelectChannel");
    channel.onmessage = (event) => {
      const { selectedIds } = event.data;
      console.log("Received selected IDs:", selectedIds);
      // Filter the rowData based on selectedIds
      const filteredData = rowData.filter((row) => selectedIds.includes(row.id));
      setRowData(filteredData); // Update the rowData state with filtered data
    };
    return () => {
      channel.close(); // Close the channel when the component unmounts
    };
  });

  useEffect(() => {
    const channel = new BroadcastChannel("activeGroupChannel");
    channel.onmessage = (event) => {
      const { activeGroup } = event.data;
      console.log("Received active group:", activeGroup);
      setActiveGroup(activeGroup); // Update the active group state

      // If activeGroup is null, fetch all containers
      if (activeGroup === null) {
        console.log("Active group is null, fetching all containers");
        // reset color of all rows to default
        setRowData((prevData) =>
          prevData.map((row) => ({ ...row, hidden: false }))
        );
        return;
      }
      else {
        console.log("Active group is not null, fetching active group data");

        fetchChildren(activeGroup).then((children) => {
          const childIds = new Set(children.map(child => child.id)); // Use Set for faster lookup

          setRowData(prevData =>
            prevData.map(row => ({
              ...row,
              hidden: !childIds.has(row.id), // hide if not in childIds
            }))
          );
        });
      }


    };
    return () => {
      channel.close(); // Close the channel when the component unmounts
    }
  }, [rowData]);

  // Use custom hooks for effects
  useFetchData(setRowData, fetchContainers);
  useWriteBackButton(rowData);
  useLoadDataEffect(setRowData, fetchContainers, sendFilteredRows);
  useFilteredRowBroadcast(rowData, sendFilteredRows);
  useAddRowButton(handleAddRow);
  useLoadButtonEffect(setLoadModalOpen, setMerge);
  useImportButtonEffect(setLoadModalOpen, setMerge);
  useSaveButtonEffect(saveData, currentContainer);
  useDropDownEffect();
  useClearButtonEffect(setRowData, setCurrentContainer);
  // useModalButtonEffect(setModalOpen); // Pass modal state updater to the hook
  useRowSelectMessage(rowData, setRowData, gridApiRef);
  useAddChildChannel(gridApiRef, setRowData);
  useRequestReloadChannel(setRowData);
  useRekeyButtonEffect()
  useAddTagsChannel(gridApiRef, setRowData);
  useRemoveTagsChannel(gridApiRef, setRowData);


  return (
  <div
    className="ag-theme-quartz bg-white rounded shadow flex flex-col"
    style={{
      height: "auto", // Let inner container manage height
      width: "100%",
      overflow: "hidden",
    }}
    onClick={hideMenu}
    onContextMenu={(e) => e.preventDefault()}
  >
    {/* Header with collapse button */}
    <div className="flex justify-between rounded items-center bg-white text-black px-4 py-1 cursor-pointer select-none">
      <span className="font-semibold">Container Grid</span>
      <button
        className="text-lg font-bold"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand grid" : "Collapse grid"}
      >
        {collapsed ? "▼" : "▲"}
      </button>
    </div>

    {/* Grid content collapsible but always mounted */}
    <div
      className={`transition-all duration-300 overflow-hidden`}
      style={{ height: collapsed ? 0 : 400 }}
    >
      <div style={{ height: 400 }}> {/* 👈 Keep grid a fixed height always */}
        <AgGridReact
          rowSelection="multiple"
          theme={myTheme}
          rowData={rowData}
          columnDefs={columnDefs}
          gridOptions={gridOptions}
          onGridReady={onGridReady}
          onFilterChanged={onFilterChanged}
          onCellDoubleClicked={handleCellDoubleClick}
        />
      </div>

      <ContextMenu
        ref={menuRef}
        onMenuItemClick={onMenuItemClick}
        gridApiRef={gridApiRef}
        setRowData={setRowData}
        handleAddRow={handleAddRow}
      />

      <LoadModal
        isOpen={isLoadModalOpen}
        setIsOpen={setLoadModalOpen}
        setRowData={setRowData}
        gridApiRef={gridApiRef}
        setCurrentContainer={setCurrentContainer}
        merge={merge}
      />

      <NamePromptModal />
    </div>
  </div>
);
};

export default App;




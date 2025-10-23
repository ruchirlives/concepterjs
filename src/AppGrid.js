// React imports
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useAppContext, rowInLayers } from "./AppContext";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry } from "ag-grid-community";
import useCreateNewRow from "./components/ModalNewContainer"; // Import the function to create a new row
import NamePromptModal from "./components/ModalNamePrompt";

// My imports
import ContextMenu, { useContextMenu } from "./hooks/gridContextMenu";
import LoadModal from "./components/ModalLoad";
// import MiniMap from "./ModalMiniMap"; // Import the MiniMap component
import columnDefs from "./hooks/gridColumnDefs";
import { fetchContainers, saveContainers, fetchContainerById } from "./api";
import {
  useFetchData, useWriteBackButton, useAddRowButton, useLoadButtonEffect, useImportButtonEffect,
  useSaveButtonEffect, useDropDownEffect, useReloadEffect, useRefreshEffect,
  useClearButtonEffect, useRowSelectMessage, flashAndScrollToRow, useAddChildChannel, useRequestRefreshChannel, useRekeyButtonEffect, useDedupButtonEffect, useAddTagsChannel, useRemoveTagsChannel
} from "./hooks/gridEffects";
import { handleWriteBack } from "./hooks/effectsShared";

// Import the custom theme
import "ag-grid-community/styles/ag-theme-alpine.css"; // Default theme as fallback
import { themeQuartz, colorSchemeDark } from "ag-grid-community";


// Import the required module
import { AllCommunityModule } from "ag-grid-community";

// Register required modules
ModuleRegistry.registerModules([AllCommunityModule]);

const App = () => {
  const { rowData, setRowData, activeLayers, layerOptions } = useAppContext();
  const displayRows = useMemo(
    () => rowData.filter((r) => rowInLayers(r, activeLayers)),
    [rowData, activeLayers]
  );
  // const [miniMapData, setMiniMapData] = useState([]); // Mini-map children data
  // const [lastSelectedRow, setLastSelectedRow] = useState(null); // Last selected row
  const [isLoadModalOpen, setLoadModalOpen] = useState(false); // State for load modal

  const [merge, setMerge] = useState(false); // State for merge functionality

  // State to store name of the current container
  const [currentContainer, setCurrentContainer] = useState(null);
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
  };

  const stateVariables = useAppContext(); // Get state variables from context

  // Function to save data with the provided name
  const saveData = (name) => {
    console.log(`Data saved under the name: ${name}`);
    // First writeback the data to the server
    handleWriteBack(rowData);

    delete stateVariables.rowData; // Remove rowData from state variables to avoid redundancy
    delete stateVariables.nodes; // Remove nodes from state variables to avoid redundancy
    delete stateVariables.edges; // Remove edges from state variables to avoid redundancy

    // state variables are now passed inside saveContainers
    saveContainers(name, stateVariables).then((response) => {
      console.log("Save response:", response);
    }).catch((error) => {
      console.error("Error saving data:", error);
    });

  };

  const handleAddRow = useCreateNewRow(); // Function to create a new row

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

  // Add channel to listen for messages to activate addRowIfNotExists for parents
  useEffect(() => {
    const channel = new BroadcastChannel("showParentChannel");
    channel.onmessage = async (event) => {
      const { parentId } = event.data;
      console.log("Received parentId:", parentId);
      // Fetch the parent data from the API
      const parent = rowData.find((row) => row.id === parentId);
      if (!parent) {
        console.error("Parent not found in rowData:", parentId);
        // fetch the parent data from the API
        await fetchContainerById(parentId).then((parentData) => {
          if (parentData) {
            addRowIfNotExists(parentData); // Add the parent row to the main grid
          } else {
            console.error("Parent data not found for ID:", parentId);
          }
        });
        return;
      }
      addRowIfNotExists(parent); // Add the parent row to the main grid
    };
    return () => {
      channel.close(); // Close the channel when the component unmounts
    };
  });

  // Use the custom context menu logic
  const { menuRef, handleContextMenu, onMenuItemClick, hideMenu } = useContextMenu();

  const sendFilteredRows = () => {
    if (!gridApiRef.current) {
      console.warn("Grid API not initialized yet.");
      return;
    }
    const filteredRowData = [];
    const displayedRowCount = gridApiRef.current.getDisplayedRowCount();

    for (let i = 0; i < displayedRowCount; i++) {
      const rowNode = gridApiRef.current.getDisplayedRowAtIndex(i);
      if (rowNode) {
        filteredRowData.push(rowNode.data);
      }
    }

    setRowData(filteredRowData);
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

  const handleCellValueChanged = useCallback((params) => {
    setRowData((prevData) =>
      prevData.map((row) =>
        row.id === params.data.id
          ? { ...row, [params.colDef.field]: params.newValue }
          : row
      )
    );
    handleWriteBack([params.data]); // Write back only the changed row
  }, [setRowData]);

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

  // Removed active group broadcast listener

  // Use custom hooks for effects
  useFetchData(setRowData, fetchContainers);
  useWriteBackButton(rowData);
  useReloadEffect();
  useRefreshEffect(rowData, setRowData, fetchContainers, sendFilteredRows);
  useAddRowButton(handleAddRow);
  useLoadButtonEffect(setLoadModalOpen, setMerge);
  useImportButtonEffect(setLoadModalOpen, setMerge);
  useSaveButtonEffect(saveData, currentContainer, setCurrentContainer);
  useDropDownEffect();
  useClearButtonEffect(setRowData, setCurrentContainer);
  // useModalButtonEffect(setModalOpen); // Pass modal state updater to the hook
  useRowSelectMessage(rowData, setRowData, gridApiRef);
  useAddChildChannel(gridApiRef, setRowData);
  useRequestRefreshChannel(setRowData);
  useRekeyButtonEffect()
  useDedupButtonEffect()
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
    <div onClick={() => setCollapsed((c) => !c)} className="flex justify-between rounded items-center bg-white text-black px-4 py-1 cursor-pointer select-none">
      <span className="font-semibold">Container Grid</span>
      <button
        className="text-lg font-bold"
        aria-label={collapsed ? "Expand grid" : "Collapse grid"}
      >
        {collapsed ? "▼" : "▲"}
      </button>
    </div>

    {/* Grid content collapsible but always mounted */}
    <div
      className={`transition-all duration-300 overflow-auto`}
      style={{ height: collapsed ? 0 : 600 }}
    >
      <div style={{ height: 600 }}> {/* 👈 Keep grid a fixed height always */}
        <AgGridReact
          rowSelection="multiple"
          theme={myTheme}
          rowData={displayRows}
          columnDefs={columnDefs}
          gridOptions={gridOptions}
          onGridReady={onGridReady}
          onFilterChanged={onFilterChanged}
          onCellDoubleClicked={handleCellDoubleClick}
          onCellValueChanged={handleCellValueChanged}
        />
      </div>

      <ContextMenu
        ref={menuRef}
        onMenuItemClick={onMenuItemClick}
        gridApiRef={gridApiRef}
        setRowData={setRowData}
        handleAddRow={handleAddRow}
        activeLayers={activeLayers}
        layerOptions={layerOptions}
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




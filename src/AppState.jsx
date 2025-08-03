import React, { useMemo, useState } from "react";
import { ReactFlow, ReactFlowProvider, Background, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAppContext } from "./AppContext";
import StateDropdown from "./components/StateDropdown";
import { CustomStateNode } from "components/CustomStateNode";
import { CustomStateEdge } from "components/CustomStateEdge";
import { useStateComparison } from "./hooks/useStateComparison";
import DiffPopup from "./components/DiffPopup";

const App = () => {
  const { rowData, setDiffDict } = useAppContext();
  const [selectedTargetState, setSelectedTargetState] = useState("base");
  const [collapsed, setCollapsed] = useState(true);

  // Use the custom hook for state comparison logic
  const { 
    nodes, 
    edges, 
    loading,
    showDiffPopup,
    currentDiffResults,
    selectedDiffs,
    toggleDiffSelection,
    copySelectedDiffs,
    closeDiffPopup
  } = useStateComparison(
    rowData, 
    selectedTargetState, 
    setDiffDict, 
    collapsed
  );

  // Define custom node and edge types
  const nodeTypes = useMemo(
    () => ({
      custom: CustomStateNode,
    }),
    []
  );

  const edgeTypes = useMemo(
    () => ({
      custom: CustomStateEdge,
    }),
    []
  );

  // Handle target state change from the StateDropdown
  const handleTargetStateChange = (newState) => {
    setSelectedTargetState(newState);
  };

  return (
    <div className="bg-white rounded shadow">
      <div className="flex justify-between items-center bg-white text-black px-4 py-2 cursor-pointer select-none">
        <div className="flex items-center gap-4">
          <span className="font-semibold">State Diagram</span>
          <div className="flex items-center gap-2">
            <span className="text-sm">Target State:</span>
            <StateDropdown onStateChange={handleTargetStateChange} className="min-w-32" />
          </div>
          {loading && <span className="text-xs text-gray-500">Loading...</span>}
        </div>

        <button
          className="text-lg font-bold"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand state diagram" : "Collapse state diagram"}
        >
          {collapsed ? "▼" : "▲"}
        </button>
      </div>

      <div className={`transition-all duration-300 overflow-hidden`} style={{ height: collapsed ? 0 : 400 }}>
        {!collapsed && (
          <div style={{ width: "100%", height: "400px", position: "relative" }}>
            <ReactFlow 
              nodes={nodes} 
              edges={edges} 
              nodeTypes={nodeTypes} 
              edgeTypes={edgeTypes} 
              fitView
              fitViewOptions={{ padding: 0.1 }}
              minZoom={0.1}
              maxZoom={2}
              attributionPosition="bottom-left"
            >
              <Background />
              <Controls />
            </ReactFlow>
          </div>
        )}
      </div>

      {/* Diff Selection Popup */}
      <DiffPopup
        show={showDiffPopup}
        diffResults={currentDiffResults}
        selectedDiffs={selectedDiffs}
        onToggleDiff={toggleDiffSelection}
        onCopy={copySelectedDiffs}
        onClose={closeDiffPopup}
        rowData={rowData}
      />
    </div>
  );
};

const AppState = (props) => (
  <ReactFlowProvider>
    <App {...props} />
  </ReactFlowProvider>
);

export default AppState;

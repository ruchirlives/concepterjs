import React, { useMemo, useState, useCallback } from "react";
import { ReactFlow, ReactFlowProvider, Background, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAppContext } from "./AppContext";
import StateDropdown from "./components/StateDropdown";
import { CustomStateNode } from "components/CustomStateNode";
import { CustomStateEdge } from "components/CustomStateEdge";
import { useStateComparison } from "./hooks/useStateComparison";
import DiffPopup from "./components/DiffPopup";
import { toast } from "react-hot-toast"; // Assuming you're using react-hot-toast

const App = () => {
  const { rowData, setDiffDict } = useAppContext();
  const [selectedTargetState, setSelectedTargetState] = useState("base");
  const [collapsed, setCollapsed] = useState(true);
  const [flipDirection, setFlipDirection] = useState(false);

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
    collapsed,
    flipDirection // <-- add this argument
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

  // Handle closing diff popup and refresh like dropdown selection
  const handleCloseDiffPopup = () => {
    closeDiffPopup();
    // Trigger the same refresh as selecting from dropdown
    handleTargetStateChange(selectedTargetState);
  };

  // Export state diagram data to Excel/TSV format
  const handleExportExcel = useCallback(() => {
    const exportData = [];
    exportData.push([
      "Source State",
      "Target State",
      "Change Details",
      "Costs",
      "Total Cost"
    ]);
    edges.forEach((edge) => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      const edgeData = edge.data || {};

      // Restore qualitativeText (change details)
      let qualitativeText = "No qualitative changes available";
      if (edgeData.changesArray && edgeData.changesArray.length > 0) {
        qualitativeText = edgeData.changesArray.join('\n');
        if (qualitativeText.includes('\n')) {
          qualitativeText = `"${qualitativeText}"`;
        }
      }

      // Add qual_label column
      let qualLabelText = "";
      if (edgeData.qual_label && edgeData.qual_label.some(q => q)) {
        qualLabelText = edgeData.qual_label.filter(q => q).join('\n');
        if (qualLabelText.includes('\n')) {
          qualLabelText = `"${qualLabelText}"`;
        }
      }

      exportData.push([
        sourceNode?.data.label || edge.source,
        targetNode?.data.label || edge.target,
        qualitativeText,
        qualLabelText, // <-- Add value to row
        edgeData.totalWeight || "0"
      ]);
    });

    // Convert to TSV format
    const tsv = exportData.map(row => row.join("\t")).join("\n");

    // Show in toast with copy option
    toast((t) => (
      <div className="max-w-[400px]">
        <div className="font-semibold mb-1">State Diagram Export</div>
        <div className="text-xs mb-2 text-gray-600">
          {nodes.length} states, {edges.length} comparisons with detailed changes
        </div>
        <div className="text-xs mb-2 overflow-y-auto max-h-40 whitespace-pre-wrap font-mono bg-gray-50 p-2 rounded">
          {tsv.substring(0, 300)}...
        </div>
        <div className="flex gap-2">
          <button
            className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
            onClick={() => {
              navigator.clipboard.writeText(tsv);
              toast.success("Copied to clipboard!");
              toast.dismiss(t.id);
            }}
          >
            Copy to Clipboard
          </button>
          <button
            className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
            onClick={() => {
              const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `state-diagram-${selectedTargetState}-${new Date().toISOString().split('T')[0]}.tsv`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              toast.success("File downloaded!");
              toast.dismiss(t.id);
            }}
          >
            Download File
          </button>
        </div>
      </div>
    ), { duration: 10000 });
  }, [nodes, edges, selectedTargetState]);

  return (
    <div className="bg-white rounded shadow">
      <div className="flex justify-between items-center bg-white text-black px-4 py-2 cursor-pointer select-none">
        <div className="flex items-center gap-4">
          <span className="font-semibold">State Diagram</span>
          <div className="flex items-center gap-2">
            <span className="text-sm">
              {flipDirection ? "Source State:" : "Target State:"}
            </span>
            <StateDropdown onStateChange={handleTargetStateChange} className="min-w-32" />
            <button
              className="ml-2 px-2 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300"
              onClick={() => setFlipDirection(f => !f)}
              title="Flip source/target direction"
            >
              Flip
            </button>
          </div>
          {loading && <span className="text-xs text-gray-500">Loading...</span>}
          
          {/* Export to Excel Button */}
          <button
            className="px-3 py-1 text-xs rounded bg-green-500 text-white hover:bg-green-600 disabled:bg-gray-300"
            onClick={handleExportExcel}
            disabled={nodes.length === 0}
            title="Export state diagram to Excel format"
          >
            Export to Excel
          </button>
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
        onClose={handleCloseDiffPopup}
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

import React, { useEffect, useState, useMemo } from "react";
import { ReactFlow, ReactFlowProvider, Background, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAppContext } from "./AppContext";
import { listStates, compareStates } from "./api";
import { getLayoutedElements } from "./flowLayouter";
import StateDropdown from "./StateDropdown";
import { CustomStateNode } from "CustomStateNode";
import { CustomStateEdge } from "CustomStateEdge";
import toast from "react-hot-toast";

const App = () => {
  const { rowData, setDiffDict } = useAppContext();
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedTargetState, setSelectedTargetState] = useState("base");
  const [collapsed, setCollapsed] = useState(true); // Add collapsed state

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

  useEffect(() => {
    // Only load when not collapsed
    if (collapsed) return;
    
    const load = async () => {
      try {
        const states = await listStates();

        // Create initial nodes with custom node type and target marking
        const initialNodes = states.map((state) => ({
          id: state,
          type: "custom", // Use custom node type
          data: {
            label: state,
            Name: state,
            isTarget: state === selectedTargetState, // Mark target state
          },
          position: { x: 0, y: 0 }, // Will be overwritten by layouter
        }));

        // Create name lookup map
        const nameById = {};
        rowData.forEach((c) => {
          nameById[c.id] = c.Name;
        });

        const containerIds = rowData.map((c) => c.id);
        const initialEdges = [];

        // Compare ALL other states WITH the selected target state
        // Each other state becomes a source node feeding into the target
        for (const sourceState of states) {
          // Skip if comparing with itself
          if (sourceState === selectedTargetState) continue;

          try {
            // Compare sourceState with selectedTargetState
            const diffResults = await compareStates(sourceState, containerIds);
            const changes = [];

            Object.keys(diffResults).forEach((containerId) => {
              const containerDiffs = diffResults[containerId];
              // get containerName
              const containerName = nameById[containerId] || containerId;
              Object.keys(containerDiffs).forEach((targetId) => {
                const diff = containerDiffs[targetId];
                const targetName = nameById[targetId] || targetId;
                if (diff.status === "added") {
                  changes.push(`${containerName} Added ${targetName}: ${diff.relationship}`);
                } else if (diff.status === "changed") {
                  changes.push(`${containerName} Changed ${targetName}: ${diff.relationship}`);
                } else if (diff.status === "removed") {
                  changes.push(`${containerName} Removed ${targetName}: ${diff.relationship}`);
                }
              });
            });

            // Only create edge if there are changes
            if (changes.length > 0) {
              const label = changes.join("\n");
              initialEdges.push({
                id: `${sourceState}-${selectedTargetState}`,
                source: sourceState, // Other states are sources
                target: selectedTargetState, // Selected state is the target
                label,
                type: "custom",
                animated: false,
                style: { stroke: "#1976d2", strokeWidth: 2 },
                data: {
                  onClick: () => {
                    setDiffDict(diffResults);
                    console.log('Edge clicked, diffDict updated:', diffResults);
                    // Toast notification
                    toast.success(`Copied diff results for ${sourceState} to ${selectedTargetState}`);
                  }
                }
              });
            }
          } catch (err) {
            console.error(`Error comparing ${sourceState} with ${selectedTargetState}:`, err);
          }
        }

        // Apply layouter to organize the nodes and edges
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
          initialNodes,
          initialEdges,
          "TB", // Top to Bottom layout - target state will be at bottom
          100, // Node separation
          150 // Rank separation
        );

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
      } catch (err) {
        console.error("Failed to build state graph:", err);
      }
    };
    load();
  }, [rowData, selectedTargetState, setDiffDict, collapsed]); // Add collapsed to dependencies

  return (
    <div className="bg-white rounded shadow">
      <div className="flex justify-between items-center bg-white text-black px-4 py-2 cursor-pointer select-none">
        <div className="flex items-center gap-4">
          <span className="font-semibold">State Diagram</span>
          <div className="flex items-center gap-2">
            <span className="text-sm">Target State:</span>
            <StateDropdown onStateChange={handleTargetStateChange} className="min-w-32" />
          </div>
        </div>
        
        {/* Add collapse/expand button */}
        <button 
          className="text-lg font-bold" 
          onClick={() => setCollapsed((c) => !c)} 
          aria-label={collapsed ? "Expand state diagram" : "Collapse state diagram"}
        >
          {collapsed ? "▼" : "▲"}
        </button>
      </div>
      
      {/* Collapsible content */}
      <div className={`transition-all duration-300 overflow-hidden`} style={{ height: collapsed ? 0 : 400 }}>
        <div style={{ width: "100%", height: "100%" }}>
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView>
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
};

const AppState = (props) => (
  <ReactFlowProvider>
    <App {...props} />
  </ReactFlowProvider>
);

export default AppState;

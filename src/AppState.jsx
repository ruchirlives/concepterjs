import React, { useEffect, useState, useMemo } from "react";
import { ReactFlow, ReactFlowProvider, Background, Controls, EdgeLabelRenderer, getBezierPath, BaseEdge, Handle, Position } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAppContext } from "./AppContext";
import { listStates, compareStates } from "./api";
import { getLayoutedElements } from "./flowLayouter";
import StateDropdown from "./StateDropdown";

// Custom edge component with proper label handling
const CustomEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, data, label }) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  if (!label || label === "No difference") {
    return <BaseEdge id={id} path={edgePath} style={style} />;
  }

  // Improved word wrapping logic
  const wrapText = (text, maxLineLength = 40) => {
    const lines = text.split("\n");
    const wrappedLines = [];

    lines.forEach((line) => {
      if (line.length <= maxLineLength) {
        wrappedLines.push(line);
        return;
      }

      const words = line.split(" ");
      let currentLine = "";

      words.forEach((word) => {
        // Check if adding this word would exceed the line length
        const testLine = currentLine ? `${currentLine} ${word}` : word;

        if (testLine.length <= maxLineLength) {
          currentLine = testLine;
        } else {
          // If current line has content, push it and start a new line
          if (currentLine) {
            wrappedLines.push(currentLine);
            currentLine = word;
          } else {
            // If single word is too long, break it
            if (word.length > maxLineLength) {
              for (let i = 0; i < word.length; i += maxLineLength) {
                wrappedLines.push(word.slice(i, i + maxLineLength));
              }
              currentLine = "";
            } else {
              currentLine = word;
            }
          }
        }
      });

      // Don't forget the last line
      if (currentLine) {
        wrappedLines.push(currentLine);
      }
    });

    return wrappedLines;
  };

  const wrappedLines = wrapText(label);

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: "10px",
            fontWeight: "500",
            color: "#333",
            background: "rgba(255,255,255,0.96)",
            padding: "8px 10px",
            borderRadius: "6px",
            border: "1px solid #ddd",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            maxWidth: "350px",
            lineHeight: "1.4",
            textAlign: "left",
            pointerEvents: "all",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
          className="nodrag nopan"
        >
          {wrappedLines.map((line, index) => (
            <div
              key={index}
              style={{
                marginBottom: index < wrappedLines.length - 1 ? "3px" : "0",
                wordBreak: "break-word",
                hyphens: "auto",
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

// Enhanced Custom Node component with handles
const CustomNode = ({ data, selected }) => {
  const isTarget = data.isTarget;

  return (
    <div
      style={{
        padding: "14px 18px",
        borderRadius: "16px",
        border: isTarget ? "3px solid #1976d2" : selected ? "2px solid #64b5f6" : "2px solid #e0e0e0",
        background: isTarget
          ? "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)"
          : selected
          ? "linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)"
          : "linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)",
        boxShadow: isTarget
          ? "0 12px 32px rgba(25, 118, 210, 0.4), 0 4px 8px rgba(25, 118, 210, 0.2)"
          : selected
          ? "0 8px 20px rgba(0,0,0,0.15)"
          : "0 6px 16px rgba(0,0,0,0.08)",
        color: isTarget ? "#1565c0" : "#37474f",
        fontWeight: isTarget ? "700" : "500",
        fontSize: "15px",
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        textAlign: "center",
        minWidth: "100px",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        cursor: "pointer",
        position: "relative",
      }}
    >
      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: isTarget ? "#1976d2" : "#555",
          width: "8px",
          height: "8px",
          border: "2px solid #fff",
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: isTarget ? "#1976d2" : "#555",
          width: "8px",
          height: "8px",
          border: "2px solid #fff",
        }}
      />

      {isTarget && (
        <div
          style={{
            fontSize: "10px",
            color: "#1976d2",
            marginBottom: "6px",
            fontWeight: "600",
            letterSpacing: "0.5px",
            textTransform: "uppercase",
          }}
        >
          🎯 TARGET
        </div>
      )}
      <div style={{ fontWeight: isTarget ? "700" : "600" }}>{data.label}</div>

      {/* Subtle glow effect for target */}
      {isTarget && (
        <div
          style={{
            position: "absolute",
            top: "-2px",
            left: "-2px",
            right: "-2px",
            bottom: "-2px",
            borderRadius: "18px",
            background: "linear-gradient(135deg, rgba(25, 118, 210, 0.1), rgba(187, 222, 251, 0.1))",
            zIndex: -1,
            filter: "blur(8px)",
          }}
        />
      )}
    </div>
  );
};

const App = () => {
  const { rowData } = useAppContext();
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedTargetState, setSelectedTargetState] = useState("base");

  // Define custom node and edge types
  const nodeTypes = useMemo(
    () => ({
      custom: CustomNode,
    }),
    []
  );

  const edgeTypes = useMemo(
    () => ({
      custom: CustomEdge,
    }),
    []
  );

  // Handle target state change from the StateDropdown
  const handleTargetStateChange = (newState) => {
    setSelectedTargetState(newState);
  };

  useEffect(() => {
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
  }, [rowData, selectedTargetState]);

  return (
    <div className="bg-white rounded shadow">
      <div className="flex items-center bg-white text-black px-4 py-2 cursor-pointer select-none">
        <span className="font-semibold mr-4">State Diagram</span>
        <div className="flex items-center gap-2">
          <span className="text-sm">Target State:</span>
          <StateDropdown onStateChange={handleTargetStateChange} className="min-w-32" />
        </div>
      </div>
      <div style={{ width: "100%", height: 400 }}>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView>
          <Background />
          <Controls />
        </ReactFlow>
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

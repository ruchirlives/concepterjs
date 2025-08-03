import React, { useEffect, useState, useMemo } from "react";
import { ReactFlow, ReactFlowProvider, Background, Controls, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAppContext } from './AppContext';
import { listStates, compareStates } from './api';

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
    return <path id={id} style={style} className="react-flow__edge-path" d={edgePath} />;
  }

  // Split the label into lines and wrap long lines
  const lines = label.split('\n').flatMap(line => {
    if (line.length <= 50) return [line];
    
    const words = line.split(' ');
    const wrappedLines = [];
    let currentLine = '';
    
    words.forEach(word => {
      if ((currentLine + word).length <= 50) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) wrappedLines.push(currentLine);
        currentLine = word;
      }
    });
    
    if (currentLine) wrappedLines.push(currentLine);
    return wrappedLines;
  });

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: '11px',
            fontWeight: 'bold',
            color: '#333',
            background: 'rgba(255,255,255,0.95)',
            padding: '6px 8px',
            borderRadius: '4px',
            border: '1px solid #ddd',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            maxWidth: '300px',
            lineHeight: '1.3',
            textAlign: 'left',
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          {lines.map((line, index) => (
            <div key={index} style={{ marginBottom: index < lines.length - 1 ? '2px' : '0' }}>
              {line}
            </div>
          ))}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

const App = () => {
  const { rowData, activeState } = useAppContext();
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  // Define custom edge types
  const edgeTypes = useMemo(() => ({
    custom: CustomEdge,
  }), []);

  useEffect(() => {
    const load = async () => {
      try {
        const states = await listStates();
        const center = { x: 250, y: 250 };
        const radius = 200;
        const angleStep = (2 * Math.PI) / (states.length || 1);

        const builtNodes = states.map((state, index) => ({
          id: state,
          data: { label: state },
          position: {
            x: center.x + radius * Math.cos(index * angleStep),
            y: center.y + radius * Math.sin(index * angleStep),
          },
        }));
        setNodes(builtNodes);

        // Create name lookup map like in AppMatrix
        const nameById = {};
        rowData.forEach((c) => {
          nameById[c.id] = c.Name;
        });

        const containerIds = rowData.map((c) => c.id);
        const builtEdges = [];
        for (const state of states) {
          if (state === activeState) continue;
          try {
            const diffResults = await compareStates(state, containerIds);
            const changes = [];
            Object.keys(diffResults).forEach((containerId) => {
              const containerDiffs = diffResults[containerId];
              Object.keys(containerDiffs).forEach((targetId) => {
                const diff = containerDiffs[targetId];
                const targetName = nameById[targetId] || targetId;
                if (diff.status === "added") {
                  changes.push(`Added ${targetName}: ${diff.relationship}`);
                } else if (diff.status === "changed") {
                  changes.push(`Changed ${targetName}: ${diff.relationship}`);
                } else if (diff.status === "removed") {
                  changes.push(`Removed ${targetName}: ${diff.relationship}`);
                }
              });
            });
            const label = changes.length > 0 ? changes.join("\n") : "No difference";
            builtEdges.push({
              id: `${state}-${activeState}`,
              source: state,           // Comparator state is the source (what we're comparing from)
              target: activeState,     // Active state is the target (current state we're comparing to)
              label,
              type: 'custom',
              animated: false,
              style: { stroke: '#999', strokeWidth: 2 }
            });
          } catch (err) {
            console.error('Error comparing states:', err);
          }
        }
        setEdges(builtEdges);
      } catch (err) {
        console.error('Failed to build state graph:', err);
      }
    };
    load();
  }, [rowData, activeState]);

  return (
    <div className="bg-white rounded shadow">
      <div className="flex justify-between items-center bg-white text-black px-4 py-2 cursor-pointer select-none">
        <span className="font-semibold">State Diagram</span>
      </div>
      <div style={{ width: '100%', height: 400 }}>
        <ReactFlow 
          nodes={nodes} 
          edges={edges} 
          edgeTypes={edgeTypes}
          fitView
        >
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

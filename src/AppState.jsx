import React, { useEffect, useState } from "react";
import { ReactFlow, ReactFlowProvider, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAppContext } from './AppContext';
import { listStates, compareStates } from './api';

const App = () => {
  const { rowData, activeState } = useAppContext();
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

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
                if (diff.status === "added") {
                  changes.push(`Added ${targetId}: ${diff.relationship}`);
                } else if (diff.status === "changed") {
                  changes.push(`Changed ${targetId}: ${diff.relationship}`);
                } else if (diff.status === "removed") {
                  changes.push(`Removed ${targetId}: ${diff.relationship}`);
                }
              });
            });
            const label = changes.length > 0 ? changes.join("\n") : "No difference";
            builtEdges.push({
              id: `${state}-${activeState}`,
              source: state,
              target: activeState,
              label,
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
        <ReactFlow nodes={nodes} edges={edges} fitView>
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

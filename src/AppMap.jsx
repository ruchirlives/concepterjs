import React, { useRef, useCallback } from "react";
import { useAppContext } from "./AppContext";
import { usePixiApp } from "./hooks/usePixiApp";
import { usePanZoom } from "./hooks/usePanZoom";
import { useNodes } from "./hooks/useNodes";

export default function AppMap() {
  const canvasRef = useRef();
  const dragStateRef = useRef({ isDraggingNode: false });

  const { rowData, setRowData } = useAppContext();

  // Update node positions in rowData
  const updateNodePosition = useCallback(
    (id, x, y) => {
      setRowData((prev) =>
        prev.map((row) => (row.id === id ? { ...row, position: { x, y } } : row))
      );
    },
    [setRowData]
  );

  // Initialize PIXI app
  const { app, container } = usePixiApp(
    canvasRef, 
    rowData && rowData.length > 0
  );

  // Add pan/zoom functionality
  usePanZoom(app, container, dragStateRef);

  // Manage nodes
  useNodes(container, rowData, updateNodePosition, dragStateRef);

  return (
    <>
      {(!rowData || rowData.length === 0) && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: "1.5rem",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          Loading data...
        </div>
      )}
      <div ref={canvasRef} style={{ width: "100vw", height: "100vh" }} />
    </>
  );
}

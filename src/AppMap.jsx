import React, { useRef, useCallback, useEffect } from "react";
import { useAppContext } from "./AppContext";
import { usePixiApp } from "./hooks/usePixiApp";
import { usePanZoom } from "./hooks/usePanZoom";
import { useNodes } from "./hooks/useNodes";
import useZoomLevel from "./hooks/useZoomLevel";
import { Viewport } from "pixi-viewport";

export default function AppMap() {
  const canvasRef = useRef();
  const dragStateRef = useRef({ isDraggingNode: false });
  const viewportRef = useRef(null);
  const { rowData, setRowData } = useAppContext();
  const { app } = usePixiApp(canvasRef, rowData && rowData.length > 0);

  // Create viewport only once
  useEffect(() => {
    if (!app || viewportRef.current) return;

    const viewport = new Viewport({
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      worldWidth: 100000,
      worldHeight: 100000,
      interaction: app.renderer.plugins.interaction,
      ticker: app.ticker,
      divWheel: app.view,
    });

    viewport.eventMode = "static";
    viewport.interactive = true; // legacy flag
    viewport.isInteractive = true; // 👈 add this manually
    viewport.interactiveChildren = true;



    app.stage.addChild(viewport);
    viewportRef.current = viewport;
  }, [app]);

  // Update node positions in rowData
  const updateNodePosition = useCallback(
    (id, x, y) => {
      setRowData((prev) => prev.map((row) => (row.id === id ? { ...row, position: { x, y } } : row)));
    },
    [setRowData]
  );

  // Get zoom level from viewport
  const zoom = useZoomLevel(viewportRef);

  // Add pan/zoom functionality
  usePanZoom(app, viewportRef.current, dragStateRef);

  // Manage nodes, now passing viewport as container
  useNodes(viewportRef.current, rowData, updateNodePosition, dragStateRef, zoom);

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
      <div
        ref={canvasRef}
        style={{ width: "100vw", height: "100vh", overflow: "hidden" }}
      />
    </>
  );
}

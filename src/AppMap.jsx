import React, { useEffect, useRef, useCallback } from "react";
import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import { useAppContext } from "./AppContext";

export default function AppMap() {
  const ref = useRef();
  const appRef = useRef();
  const viewportRef = useRef();
  const nodesRef = useRef(new Map());

  // Use AppContext instead of useAppMapData
  const { rowData, setRowData } = useAppContext();

  // Update node positions in rowData
  const updateNodePosition = useCallback(
    (id, x, y) => {
      setRowData((prev) => prev.map((row) => (row.id === id ? { ...row, position: { x, y } } : row)));
    },
    [setRowData]
  );

  // Initialize PIXI app - only when we have data
  useEffect(() => {
    // Wait until we have data and DOM element is ready
    if (!ref.current || !rowData || rowData.length === 0) return;

    console.log("Initializing PIXI Application");
    console.log("Row data count:", rowData.length);

    // Capture refs for cleanup
    const nodes = nodesRef.current;

    const app = new PIXI.Application();

    // Initialize the app (PIXI v8 async initialization)
    app
      .init({
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: 0xffffff,
        antialias: true,
        resolution: 1,
      })
      .then(() => {
        ref.current.appendChild(app.canvas);
        appRef.current = app;

        // Create viewport
        const viewport = new Viewport({
          screenWidth: window.innerWidth,
          screenHeight: window.innerHeight,
          worldWidth: 100000,
          worldHeight: 100000,
          events: app.renderer.events, // PIXI v8 events
        });

        app.stage.addChild(viewport);
        viewportRef.current = viewport;

        // Add viewport plugins
        viewport
          .drag({
            mouseButtons: "left",
          })
          .pinch()
          .wheel()
          .decelerate();

        // Create nodes after viewport is ready
        createNodes();
      });

    const createNodes = () => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      // Clear existing nodes
      nodesRef.current.forEach((nodeContainer) => {
        viewport.removeChild(nodeContainer);
      });
      nodesRef.current.clear();

      // Create new nodes from rowData
      rowData.forEach((row) => {
        const nodeContainer = new PIXI.Container();
        // Use existing position or generate random position
        nodeContainer.x = row.position?.x ?? Math.random() * 1000 - 500;
        nodeContainer.y = row.position?.y ?? Math.random() * 1000 - 500;
        nodeContainer.eventMode = "static"; // PIXI v8 interaction
        nodeContainer.cursor = "pointer";

        // Create circle graphics (PIXI v8 syntax)
        const graphics = new PIXI.Graphics().circle(0, 0, 15).fill(0x3498db).stroke({ width: 2, color: 0x2980b9 });

        nodeContainer.addChild(graphics);

        // Create text label
        const label = row.Name || row.id || "Unknown";
        if (label) {
          const text = new PIXI.Text({
            text: label,
            style: {
              fontFamily: "Arial",
              fontSize: 12,
              fill: 0x000000,
              align: "center",
            },
          });
          text.anchor.set(0.5);
          text.y = -35;
          nodeContainer.addChild(text);
        }

        // Event handlers for node dragging
        let isDragging = false;
        let dragOffset = null;

        const onDragStart = (event) => {
          event.stopPropagation();
          isDragging = true;
          const position = event.global;
          const localPos = viewport.toLocal(position);
          dragOffset = {
            x: localPos.x - nodeContainer.x,
            y: localPos.y - nodeContainer.y,
          };
          nodeContainer.alpha = 0.7;
        };

        const onDragEnd = () => {
          if (isDragging) {
            updateNodePosition(row.id, nodeContainer.x, nodeContainer.y);
            isDragging = false;
            dragOffset = null;
            nodeContainer.alpha = 1;
          }
        };

        const onDragMove = (event) => {
          if (!isDragging || !dragOffset) return;

          const position = event.global;
          const localPos = viewport.toLocal(position);
          nodeContainer.x = localPos.x - dragOffset.x;
          nodeContainer.y = localPos.y - dragOffset.y;
        };

        const onNodeClick = () => {
          console.log("Clicked node:", row.Name || row.id);
        };

        // Add event listeners (PIXI v8 events)
        nodeContainer.on("pointerdown", onDragStart);
        nodeContainer.on("pointerup", onDragEnd);
        nodeContainer.on("pointerupoutside", onDragEnd);
        nodeContainer.on("pointermove", onDragMove);
        nodeContainer.on("click", onNodeClick);

        viewport.addChild(nodeContainer);
        nodesRef.current.set(row.id, nodeContainer);
      });

      // Center the view on the nodes
      if (rowData.length > 0) {
        viewport.fitWorld();
      }
    };

    return () => {
      // Cleanup
      if (nodes) {
        nodes.clear();
      }

      if (appRef.current && !appRef.current.destroyed) {
        appRef.current.destroy(true);
      }

      appRef.current = null;
      viewportRef.current = null;
    };
  }, [rowData, updateNodePosition]);

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
      <div ref={ref} style={{ width: "100vw", height: "100vh" }} />
    </>
  );
}

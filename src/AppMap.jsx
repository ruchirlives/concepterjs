import React, { useEffect, useRef, useCallback } from "react";
import * as PIXI from "pixi.js";
import { useAppContext } from "./AppContext";

export default function AppMap() {
  const ref = useRef();
  const appRef = useRef();
  const containerRef = useRef(); // Container that holds all nodes
  const nodesRef = useRef(new Map()); // Track node containers by ID
  const isInitializedRef = useRef(false); // Track if PIXI is initialized
  const dragStateRef = useRef({ isDraggingNode: false }); // Shared drag state

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

  // Initialize PIXI app only once when component mounts and data is available
  useEffect(() => {
    // Wait until we have data and DOM element is ready
    if (!ref.current || !rowData || rowData.length === 0) return;

    // Don't reinitialize if already initialized
    if (isInitializedRef.current) return;

    console.log("Initializing PIXI Application");
    console.log("Row data count:", rowData.length);

    // Capture current nodes ref for cleanup
    const currentNodesRef = nodesRef.current;

    // Create PIXI app
    const app = new PIXI.Application({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0xffffff,
    });

    ref.current.appendChild(app.view);
    appRef.current = app;

    // Create a container that will hold all nodes (this is what we'll pan/zoom)
    const nodesContainer = new PIXI.Container();
    app.stage.addChild(nodesContainer);
    containerRef.current = nodesContainer;

    // Pan functionality
    const canvas = app.view;
    let isPanning = false;
    let lastPanPosition = null;

    const startPan = (event) => {
      // Don't start panning if we're dragging a node
      if (dragStateRef.current.isDraggingNode) return;

      isPanning = true;
      lastPanPosition = { x: event.clientX, y: event.clientY };
      canvas.style.cursor = "grabbing";
    };

    const doPan = (event) => {
      if (!isPanning || !lastPanPosition || dragStateRef.current.isDraggingNode) return;

      const deltaX = event.clientX - lastPanPosition.x;
      const deltaY = event.clientY - lastPanPosition.y;

      nodesContainer.x += deltaX;
      nodesContainer.y += deltaY;

      lastPanPosition = { x: event.clientX, y: event.clientY };
    };

    const endPan = () => {
      if (isPanning) {
        isPanning = false;
        lastPanPosition = null;
        canvas.style.cursor = "grab";
      }
    };

    // Zoom functionality
    const doZoom = (event) => {
      event.preventDefault();

      const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const newScale = nodesContainer.scale.x * scaleFactor;

      // Limit zoom range
      if (newScale < 0.1 || newScale > 5) return;

      // Get mouse position relative to canvas
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Calculate zoom towards mouse position
      const beforeScale = nodesContainer.scale.x;
      nodesContainer.scale.set(newScale);

      const afterScale = nodesContainer.scale.x;
      const scaleChange = (afterScale - beforeScale) / beforeScale;

      nodesContainer.x -= (mouseX - nodesContainer.x) * scaleChange;
      nodesContainer.y -= (mouseY - nodesContainer.y) * scaleChange;

      console.log(`Zoom level: ${newScale.toFixed(2)}`);
    };

    // Set initial cursor and add event listeners
    canvas.style.cursor = "grab";
    canvas.addEventListener("mousedown", startPan);
    window.addEventListener("mousemove", doPan);
    window.addEventListener("mouseup", endPan);
    canvas.addEventListener("wheel", doZoom, { passive: false });

    // Mark as initialized
    isInitializedRef.current = true;

    console.log("PIXI app initialized with pan and zoom");

    return () => {
      console.log("Cleaning up PIXI app");
      // Remove event listeners
      if (canvas) {
        canvas.removeEventListener("mousedown", startPan);
        canvas.removeEventListener("wheel", doZoom);
      }
      window.removeEventListener("mousemove", doPan);
      window.removeEventListener("mouseup", endPan);

      // Clear nodes using captured ref
      currentNodesRef.clear();

      if (appRef.current && !appRef.current.destroyed) {
        appRef.current.destroy(true, true);
      }
      appRef.current = null;
      containerRef.current = null;
      isInitializedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Added rowData as dependency to fix the warning

  // Separate effect for creating/updating nodes
  useEffect(() => {
    const nodesContainer = containerRef.current;
    if (!nodesContainer || !rowData || rowData.length === 0) return;

    console.log("Updating nodes");

    // Clear existing nodes
    nodesRef.current.forEach((nodeContainer) => {
      nodesContainer.removeChild(nodeContainer);
    });
    nodesRef.current.clear();

    // Create nodes from rowData
    rowData.forEach((row, index) => {
      // Create a container for each node
      const nodeContainer = new PIXI.Container();

      // Use existing position or grid pattern
      nodeContainer.x = row.position?.x ?? 100 + (index % 5) * 150;
      nodeContainer.y = row.position?.y ?? 100 + Math.floor(index / 5) * 100;

      // Make node interactive
      nodeContainer.eventMode = "static";
      nodeContainer.cursor = "pointer";

      // Create circle for node
      const graphics = new PIXI.Graphics();
      graphics.beginFill(0x3498db);
      graphics.drawCircle(0, 0, 20);
      graphics.endFill();
      nodeContainer.addChild(graphics);

      // Create text label
      const label = row.Name || row.id || "Unknown";
      const text = new PIXI.Text(label, {
        fontFamily: "Arial",
        fontSize: 12,
        fill: 0x000000,
        align: "center",
      });
      text.anchor.set(0.5);
      text.y = -40;
      nodeContainer.addChild(text);

      // Node dragging variables
      let isNodeDragging = false;
      let nodeDragOffset = null;

      // Node event handlers
      const onNodeDragStart = (event) => {
        event.stopPropagation(); // Prevent canvas panning
        isNodeDragging = true;
        dragStateRef.current.isDraggingNode = true; // Update shared flag

        // Calculate offset from node center
        const globalPos = event.global;
        const localPos = nodesContainer.toLocal(globalPos);
        nodeDragOffset = {
          x: localPos.x - nodeContainer.x,
          y: localPos.y - nodeContainer.y,
        };

        nodeContainer.alpha = 0.7; // Visual feedback
        nodeContainer.cursor = "grabbing";
      };

      const onNodeDragMove = (event) => {
        if (!isNodeDragging || !nodeDragOffset) return;

        const globalPos = event.global;
        const localPos = nodesContainer.toLocal(globalPos);

        nodeContainer.x = localPos.x - nodeDragOffset.x;
        nodeContainer.y = localPos.y - nodeDragOffset.y;
      };

      const onNodeDragEnd = () => {
        if (isNodeDragging) {
          isNodeDragging = false;
          dragStateRef.current.isDraggingNode = false; // Update shared flag
          nodeDragOffset = null;
          nodeContainer.alpha = 1; // Reset visual feedback
          nodeContainer.cursor = "pointer";

          // Update position in rowData
          updateNodePosition(row.id, nodeContainer.x, nodeContainer.y);

          console.log(`Node ${label} moved to (${nodeContainer.x}, ${nodeContainer.y})`);
        }
      };

      const onNodeClick = () => {
        console.log(`Clicked node: ${label}`);
      };

      // Add node event listeners
      nodeContainer.on("pointerdown", onNodeDragStart);
      nodeContainer.on("pointermove", onNodeDragMove);
      nodeContainer.on("pointerup", onNodeDragEnd);
      nodeContainer.on("pointerupoutside", onNodeDragEnd);
      nodeContainer.on("click", onNodeClick);

      // Add container to the nodes container
      nodesContainer.addChild(nodeContainer);
      nodesRef.current.set(row.id, nodeContainer);
    });

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

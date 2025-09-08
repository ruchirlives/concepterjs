import React, { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import useAppMapData from "./hooks/useAppMapData";

export default function AppMap() {
  const ref = useRef();
  const appRef = useRef();
  const viewportRef = useRef();
  const nodesRef = useRef(new Map());
  const dragDataRef = useRef(null);

  const { nodes, loadContainers, loadChildren, updateNodePosition } = useAppMapData();

  // Initialize PIXI app and viewport
  useEffect(() => {
    if (!ref.current) return;

    // Copy ref values at the beginning of the effect
    const currentNodes = nodesRef.current;
    console.log("Initializing PIXI Application");
    console.log("Current nodes count:", currentNodes.size);

    const app = new PIXI.Application({
      resizeTo: window,
      backgroundColor: 0xffffff,
    });

    ref.current.appendChild(app.view);
    appRef.current = app;

    // Wait for next frame to ensure DOM is ready
    requestAnimationFrame(() => {
      const viewport = new Viewport({
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        worldWidth: 100000,
        worldHeight: 100000,
        // For PIXI v5, pass the interaction manager correctly
        interaction: app.renderer.plugins.interaction,
        // Don't pass ticker initially - let viewport manage its own
        // ticker: app.ticker,
        // Pass the canvas element for proper event handling
        divWheel: app.view,
      });

      app.stage.addChild(viewport);
      viewportRef.current = viewport;

      viewport.drag().wheel().pinch().decelerate();

      // Load initial data
      loadContainers();
    });

    return () => {
      const viewport = viewportRef.current;
      const currentApp = appRef.current;

      // 1. Clear nodes first - use the captured reference
      if (currentNodes) {
        currentNodes.forEach((container) => {
          if (container && viewport) {
            viewport.removeChild(container);
          }
        });
        currentNodes.clear();
      }

      // 2. Remove viewport from stage and destroy it
      if (viewport && currentApp && currentApp.stage) {
        currentApp.stage.removeChild(viewport);
        viewport.destroy({ children: true });
        viewportRef.current = null;
      }

      // 3. Destroy the app
      if (currentApp && !currentApp.destroyed) {
        currentApp.destroy(true, true);
      }

      appRef.current = null;
    };
  }, [loadContainers]);

  // Update nodes when data changes
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    // Clear existing nodes
    nodesRef.current.forEach((container) => {
      viewport.removeChild(container);
    });
    nodesRef.current.clear();

    // Create new nodes
    nodes.forEach((node) => {
      const container = new PIXI.Container();
      container.x = node.x;
      container.y = node.y;
      container.interactive = true;
      container.cursor = "pointer";

      // Create circle graphics
      const graphics = new PIXI.Graphics();
      graphics.beginFill(0x3498db);
      graphics.drawCircle(0, 0, 10);
      graphics.endFill();
      container.addChild(graphics);

      // Create text label
      const zoom = viewport.scale.x;
      const label =
        zoom < 0.2
          ? ""
          : zoom < 1
          ? node.name
          : `${node.name}${node.description ? " - " + node.description : ""}`;

      if (label) {
        const text = new PIXI.Text(label, {
          fill: "black",
          fontSize: 14 / Math.max(zoom, 0.5),
        });
        text.anchor.set(0.5);
        text.y = -20;
        container.addChild(text);
      }

      // Event handlers
      const onDragStart = (event) => {
        event.stopPropagation();
        dragDataRef.current = { id: node.id, data: event.data };
      };

      const onDragEnd = () => {
        if (dragDataRef.current?.id === node.id) {
          updateNodePosition(node.id, container.x, container.y, true);
          dragDataRef.current = null;
        }
      };

      const onDragMove = (event) => {
        if (!dragDataRef.current || dragDataRef.current.id !== node.id) return;

        const newPosition = dragDataRef.current.data.getLocalPosition(viewport);
        container.x = newPosition.x;
        container.y = newPosition.y;
        updateNodePosition(node.id, newPosition.x, newPosition.y, false);
      };

      const onNodeClick = async () => {
        viewport.animate({
          position: { x: node.x, y: node.y },
          scale: Math.max(1, viewport.scale.x),
        });
        await loadChildren(node.id, { x: node.x, y: node.y });
      };

      // Add event listeners (PIXI v5 events)
      container.on("mousedown", onDragStart);
      container.on("touchstart", onDragStart);
      container.on("mouseup", onDragEnd);
      container.on("touchend", onDragEnd);
      container.on("mouseupoutside", onDragEnd);
      container.on("touchendoutside", onDragEnd);
      container.on("mousemove", onDragMove);
      container.on("touchmove", onDragMove);
      container.on("click", onNodeClick);
      container.on("tap", onNodeClick);

      viewport.addChild(container);
      nodesRef.current.set(node.id, container);
    });
  }, [nodes, loadChildren, updateNodePosition]);

  return (
  <>
    {nodes.length === 0 && (
      <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        fontSize: "1.5rem"
      }}>
        Loading containers...
      </div>
    )}
    <div ref={ref} style={{ width: "100vw", height: "100vh" }} />
  </>
);
}

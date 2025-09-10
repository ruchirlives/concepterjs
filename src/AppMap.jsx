import React, { useEffect, useRef } from "react";
import { useAppContext } from "./AppContext";
import InfiniteCanvas from "ef-infinite-canvas";
import { useNodes } from "./hooks/useNodes";
import { useBackdropMap } from "./hooks/useBackdropMap";

export default function AppMap() {
  const canvasRef = useRef(null);
  const infiniteCanvasRef = useRef(null);
  const redrawRef = useRef(() => {});
  const { rowData } = useAppContext();
  const { drawMap, refreshMap } = useBackdropMap("/maps/topo_lad.json");

  const { redraw } = useNodes(
    infiniteCanvasRef.current,
    rowData && rowData.length > 0 ? rowData : undefined,
    drawMap
  );
  redrawRef.current = redraw;

  useEffect(() => {
    // Prevent unwanted scroll warnings: only allow ctrl+wheel for zoom
    const preventScroll = (e) => {
      if (!e.ctrlKey) {
        e.preventDefault();
      }
    };

    const canvas = canvasRef.current;
    if (!canvas) return;

    const infiniteCanvas = new InfiniteCanvas(canvas);
    infiniteCanvasRef.current = infiniteCanvas;

    const handleResize = () => {
      if (!canvasRef.current) return;
      const parent = canvasRef.current.parentElement;
      if (parent) {
        canvasRef.current.width = parent.offsetWidth;
        canvasRef.current.height = parent.offsetHeight;
      }
      // redraw grid and nodes after resize
      if (redrawRef.current) redrawRef.current();
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    // Add wheel event listener to canvas
    if (canvas) {
      canvas.addEventListener("wheel", preventScroll, { passive: false });
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      if (canvas) {
        canvas.removeEventListener("wheel", preventScroll);
      }
      infiniteCanvasRef.current = null;
    };
  }, []);

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
      <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
        <canvas
          id="canvas"
          ref={canvasRef}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      <button
        style={{ position: "absolute", top: 10, right: 10, zIndex: 20 }}
        onClick={() => {
          const ctx = infiniteCanvasRef.current?.getContext("2d");
          if (ctx) {
            const transform = ctx.getTransform();
            refreshMap(transform);
            redrawRef.current();
          }
        }}
      >
        Refresh Map
      </button>
    </>
  );
}


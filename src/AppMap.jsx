import React, { useEffect, useRef } from "react";
import { useAppContext } from "./AppContext";
import InfiniteCanvas from "ef-infinite-canvas";

export default function AppMap() {
  const canvasRef = useRef(null);
  const infiniteCanvasRef = useRef(null);
  const { rowData } = useAppContext();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const infiniteCanvas = new InfiniteCanvas(canvas);
    infiniteCanvasRef.current = infiniteCanvas;
    const ctx = infiniteCanvas.getContext("2d");

    ctx.strokeStyle = "#ccc";

    for (let x = -1000; x <= 1000; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, -1000);
      ctx.lineTo(x, 1000);
      ctx.stroke();
    }

    for (let y = -1000; y <= 1000; y += 50) {
      ctx.beginPath();
      ctx.moveTo(-1000, y);
      ctx.lineTo(1000, y);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.fillStyle = "red";
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.fill();

    const handleResize = () => {
      infiniteCanvas.resize();
    };

    window.addEventListener("resize", handleResize);
    infiniteCanvas.resize();

    return () => {
      window.removeEventListener("resize", handleResize);
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
    </>
  );
}


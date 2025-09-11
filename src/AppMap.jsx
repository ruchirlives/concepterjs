import React, { useEffect, useRef } from "react";
import { useAppContext } from "./AppContext";
import InfiniteCanvas from "ef-infinite-canvas";
import { useNodes } from "./hooks/useNodes";
import { useBackdropMap } from "./hooks/useBackdropMap";

export default function AppMap() {
  const canvasRef = useRef(null);
  const infiniteCanvasRef = useRef(null);
  const redrawRef = useRef(() => {});
  const { rowData, layerOptions = [] } = useAppContext();
  const { drawMap, refreshMap } = useBackdropMap("/maps/topo_lad.json");

  // Layer filter state
  const [selectedLayer, setSelectedLayer] = React.useState("");
  const selectedLayerRef = React.useRef(selectedLayer);
  useEffect(() => { selectedLayerRef.current = selectedLayer; }, [selectedLayer]);

  // Optionally filter rowData by selectedLayer
  const filteredRowData = React.useMemo(() => {
    if (!selectedLayer) return rowData;
    return (rowData || []).filter(row => (row.Tags || "").split(",").map(t => t.trim()).includes(selectedLayer));
  }, [rowData, selectedLayer]);

  // Memoize the nodes array to ensure stable reference
  const memoizedNodes = React.useMemo(() => filteredRowData && filteredRowData.length > 0 ? filteredRowData : undefined, [filteredRowData]);

  const { redraw } = useNodes(
    infiniteCanvasRef.current,
    memoizedNodes,
    drawMap,
    selectedLayerRef
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
      <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative" }}>
        {/* Integrated container for Headings tab and canvas */}
        <div style={{ position: "absolute", top: 0, right: 0, width: 340, height: "100%", zIndex: 20, display: "flex", flexDirection: "column", pointerEvents: "none" }}>
          <div style={{ margin: 10, pointerEvents: "auto" }}>
            <div style={{ display: "flex", background: "#f7f7f7", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", border: "1px solid #e0e0e0" }}>
              <div style={{ padding: "8px 16px", fontWeight: 600, fontSize: 15, borderBottom: "2px solid #0078d4", borderRadius: "8px 8px 0 0", background: "#fff" }}>
                Headings
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.97)", borderRadius: "0 0 8px 8px", padding: 12, border: "1px solid #e0e0e0", borderTop: "none" }}>
              <button
                style={{ marginBottom: 10, width: "100%", padding: "6px 0", borderRadius: 4, border: "1px solid #ccc", background: "#f5f5f5", fontWeight: 500, fontSize: 14, cursor: "pointer" }}
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
              <div style={{ marginTop: 6 }}>
                <label style={{ fontSize: 13, marginRight: 6 }}>Layer:</label>
                <select
                  value={selectedLayer}
                  onChange={e => setSelectedLayer(e.target.value)}
                  style={{ fontSize: 13, padding: "2px 8px", borderRadius: 4, border: "1px solid #ccc" }}
                >
                  <option value="">All Layers</option>
                  {layerOptions.map(layer => (
                    <option key={layer} value={layer}>{layer}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
        <div style={{ width: "100%", height: "100%" }}>
          <canvas
            id="canvas"
            ref={canvasRef}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </div>
    </>
  );
}


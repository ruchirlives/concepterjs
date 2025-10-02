import React, { useEffect, useRef } from "react";
import { useAppContext } from "./AppContext";
import InfiniteCanvas from "ef-infinite-canvas";
import { useNodes } from "./hooks/useMapNodes";
import { useBackdropMap } from "./hooks/useBackdropMap";

export default function AppMap() {
  const canvasRef = useRef(null);
  const infiniteCanvasRef = useRef(null);
  const redrawRef = useRef(() => {});
  const dragModeRef = useRef(null); // 'move' or 'scale'
  const { rowData, layerOptions = [] } = useAppContext();
  const { drawMap, drawMapVector, refreshMap, getMapSVGPath } = useBackdropMap("/maps/topo_lad.json", dragModeRef);

  // Layer filter state
  const [selectedLayer, setSelectedLayer] = React.useState("");
  const selectedLayerRef = React.useRef(selectedLayer);
  useEffect(() => {
    selectedLayerRef.current = selectedLayer; 
  }, [selectedLayer]);

  // Export controls
  const [exportScale, setExportScale] = React.useState(3);
  const [exportPreset, setExportPreset] = React.useState("fit"); // fit | 2k | 4k
  const [snapToGrid, setSnapToGrid] = React.useState(true);
  const [snapStrategy, setSnapStrategy] = React.useState("nearest"); // nearest | expand
  const [gridStep, setGridStep] = React.useState(50);

  // Optionally filter rowData by selectedLayer
  const filteredRowData = React.useMemo(() => {
    if (!selectedLayer) return rowData;
    return (rowData || []).filter(row => (row.Tags || "").split(",").map(t => t.trim()).includes(selectedLayer));
  }, [rowData, selectedLayer]);

  // Memoize the nodes array to ensure stable reference
  const memoizedNodes = React.useMemo(() => filteredRowData && filteredRowData.length > 0 ? filteredRowData : undefined, [filteredRowData]);

  const {
    redraw,
    contextMenuElement,
    exportBitmap,
    exportSVG,
  } = useNodes(
    infiniteCanvasRef.current,
    memoizedNodes,
    drawMap,
    selectedLayerRef,
    dragModeRef,
    drawMapVector
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

    const persistTransform = () => {
      try {
        const ic = infiniteCanvasRef.current;
        if (ic && typeof ic.getTransform === "function") {
          const m = ic.getTransform();
          const payload = { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f };
          sessionStorage.setItem("appmap:transform", JSON.stringify(payload));
        }
      } catch {}
    };

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

    // Restore previous pan/zoom after initial resize to avoid resets
    try {
      const saved = sessionStorage.getItem("appmap:transform");
      if (saved) {
        const t = JSON.parse(saved);
        if (t && typeof infiniteCanvas.setTransform === "function") {
          const { a = 1, b = 0, c = 0, d = 1, e = 0, f = 0 } = t;
          infiniteCanvas.setTransform(a, b, c, d, e, f);
          if (redrawRef.current) redrawRef.current();
        }
      }
    } catch {}

    // Add wheel event listener to canvas
    if (canvas) {
      canvas.addEventListener("wheel", preventScroll, { passive: false });
      // Save transform on user interactions that likely change it
      canvas.addEventListener("wheel", persistTransform, { passive: true });
      canvas.addEventListener("pointerup", persistTransform);
    }

    // Save/restore on tab visibility change
    const onHide = () => persistTransform();
    const onShow = () => {
      try {
        const saved = sessionStorage.getItem("appmap:transform");
        const ic = infiniteCanvasRef.current;
        if (saved && ic && typeof ic.setTransform === "function") {
          const t = JSON.parse(saved);
          const { a = 1, b = 0, c = 0, d = 1, e = 0, f = 0 } = t || {};
          ic.setTransform(a, b, c, d, e, f);
          if (redrawRef.current) redrawRef.current();
        }
      } catch {}
    };
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) onHide(); else onShow();
    });

    return () => {
      // Persist current pan/zoom (canvas transform) before unmount
      try {
        const ic = infiniteCanvasRef.current;
        if (ic && typeof ic.getTransform === "function") {
          const m = ic.getTransform();
          const payload = { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f };
          sessionStorage.setItem("appmap:transform", JSON.stringify(payload));
        }
      } catch (e) {
        // ignore storage errors
      }
      window.removeEventListener("resize", handleResize);
      if (canvas) {
        canvas.removeEventListener("wheel", preventScroll);
        canvas.removeEventListener("wheel", persistTransform);
        canvas.removeEventListener("pointerup", persistTransform);
      }
      document.onvisibilitychange = null;
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <label style={{ fontSize: 12, alignSelf: "center" }}>Scale</label>
                <input type="number" min={1} max={8} step={1}
                  value={exportScale}
                  onChange={e => setExportScale(Math.max(1, Math.min(8, parseInt(e.target.value || "1", 10))))}
                  style={{ fontSize: 12, padding: "2px 6px", border: "1px solid #ccc", borderRadius: 4 }} />
                <label style={{ fontSize: 12, alignSelf: "center" }}>Preset</label>
                <select value={exportPreset} onChange={e => setExportPreset(e.target.value)}
                  style={{ fontSize: 12, padding: "2px 6px", border: "1px solid #ccc", borderRadius: 4 }}>
                  <option value="fit">Fit Nodes</option>
                  <option value="2k">Center 2000 x 2000</option>
                  <option value="4k">Center 4000 x 4000</option>
                </select>
                <label style={{ fontSize: 12, alignSelf: "center" }}>Grid Step</label>
                <input type="number" min={10} step={10} value={gridStep}
                  onChange={e => setGridStep(Math.max(1, parseInt(e.target.value || "50", 10)))}
                  style={{ fontSize: 12, padding: "2px 6px", border: "1px solid #ccc", borderRadius: 4 }} />
                <label style={{ fontSize: 12, alignSelf: "center" }}>Snap</label>
                <select value={snapStrategy} onChange={e => setSnapStrategy(e.target.value)}
                  style={{ fontSize: 12, padding: "2px 6px", border: "1px solid #ccc", borderRadius: 4 }}>
                  <option value="nearest">Nearest</option>
                  <option value="expand">Expand</option>
                </select>
                <div style={{ gridColumn: "1 / span 2", display: "flex", alignItems: "center", gap: 6 }}>
                  <input id="expSnap" type="checkbox" checked={snapToGrid} onChange={e => setSnapToGrid(e.target.checked)} />
                  <label htmlFor="expSnap" style={{ fontSize: 12 }}>Snap to grid</label>
                </div>
              </div>
              <button
                style={{ marginBottom: 10, width: "100%", padding: "6px 0", borderRadius: 4, border: "1px solid #ccc", background: "#f5f5f5", fontWeight: 500, fontSize: 14, cursor: "pointer" }}
                onClick={() => {
                  let bounds = null;
                  if (exportPreset === "2k") bounds = { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 };
                  if (exportPreset === "4k") bounds = { minX: -2000, maxX: 2000, minY: -2000, maxY: 2000 };
                  exportBitmap({
                    scale: exportScale,
                    padding: exportPreset === "fit" ? 150 : 0,
                    bounds,
                    gridStep,
                    snapToGrid,
                    snapStrategy
                  });
                }}
              >
                Export PNG
              </button>
              <button
                style={{ marginBottom: 10, width: "100%", padding: "6px 0", borderRadius: 4, border: "1px solid #ccc", background: "#f5f5f5", fontWeight: 500, fontSize: 14, cursor: "pointer" }}
                onClick={() => {
                  let bounds = null;
                  if (exportPreset === "2k") bounds = { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 };
                  if (exportPreset === "4k") bounds = { minX: -2000, maxX: 2000, minY: -2000, maxY: 2000 };
                  exportSVG({
                    padding: exportPreset === "fit" ? 150 : 0,
                    bounds,
                    gridStep,
                    snapToGrid,
                    snapStrategy,
                    getMapSVGPath,
                  });
                }}
              >
                Export SVG
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
        {/* Render the context menu portal */}
        {contextMenuElement}
      </div>
    </>
  );
}


import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAppContext } from "./AppContext";

const AppPrioritiser = () => {
  const { rows: rowData, setRows: setRowData } = useAppContext();
  const [positions, setPositions] = useState({});
  const [collapsed, setCollapsed] = useState(true);
  const containerRef = useRef(null);
  const draggingRef = useRef(null);

  // Initialize positions from rowData's built-in Impact/Effort fields
  useEffect(() => {
    const newPos = {};
    rowData.forEach((c) => {
      newPos[c.id] = {
        impact: typeof c.Impact === "number" ? c.Impact : 50,
        effort: typeof c.Effort === "number" ? c.Effort : 50,
      };
    });
    setPositions(newPos);
  }, [rowData]);

  const handleMouseDown = (e, id) => {
    draggingRef.current = id;
    e.stopPropagation();
  };

  const handleMouseMove = (e) => {
    if (!draggingRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const effort = ((e.clientX - rect.left) / rect.width) * 100;
    const impact = (1 - (e.clientY - rect.top) / rect.height) * 100;
    setPositions((prev) => ({
      ...prev,
      [draggingRef.current]: {
        impact: Math.min(100, Math.max(0, impact)),
        effort: Math.min(100, Math.max(0, effort)),
      },
    }));
  };

  const handleMouseUp = useCallback(() => {
    const id = draggingRef.current;
    if (id) {
      const { impact, effort } = positions[id] || { impact: 50, effort: 50 };
      // just update the in‐memory copy
      setRowData(r =>
        r.map(c => c.id === id ? { ...c, Impact: impact, Effort: effort } : c)
      );
    }
    draggingRef.current = null;
  }, [positions, setRowData]);

  // 1) global mouseup listener so we never miss a release
  useEffect(() => {
    const onDocMouseUp = () => handleMouseUp();
    document.addEventListener("mouseup", onDocMouseUp);
    return () => document.removeEventListener("mouseup", onDocMouseUp);
  }, [handleMouseUp]);

  return (
    <div className="bg-white rounded shadow">
      <div className="flex justify-between items-center bg-white text-black px-4 py-2 cursor-pointer select-none">
        <span className="font-semibold">Prioritiser</span>
        <button
          className="text-lg font-bold"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand prioritiser" : "Collapse prioritiser"}
        >
          {collapsed ? "▼" : "▲"}
        </button>
      </div>
      <div
        // now scrollable and taller
        className={`transition-all duration-300 overflow-y-auto`}
        style={{ height: collapsed ? 0 : 650 }}
      >
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="relative h-full border m-4 select-none"
        >
          {/* axis labels */}
          <div className="absolute bottom-0 left-0 mb-2 ml-2 text-xs text-gray-500">
            Low Effort
          </div>
          <div className="absolute bottom-0 right-0 mb-2 mr-2 text-xs text-gray-500">
            High Effort
          </div>
          <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -rotate-90 text-xs text-gray-500">
            Low → High Impact
          </div>
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-300" />
          <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-300" />
          {rowData.map((container) => {
            const pos = positions[container.id] || { impact: 50, effort: 50 };
            return (
              <div
                key={container.id}
                onMouseDown={(e) => handleMouseDown(e, container.id)}
                style={{
                  position: "absolute",
                  left: `${pos.effort}%`,
                  top: `${100 - pos.impact}%`,
                  transform: "translate(-50%, -50%)",
                }}
                className="cursor-pointer bg-blue-100 text-xs px-2 py-1 rounded shadow"
                title={`${container.Name} (Impact ${Math.round(
                  pos.impact
                )}, Effort ${Math.round(pos.effort)})`}
              >
                {container.Name}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AppPrioritiser;

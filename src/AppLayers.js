import React, { useState, useEffect } from "react";
import { useAppContext } from "./AppContext";

const AppLayers = () => {
  const {
    layerOptions,
    addLayer,
    removeLayer,
    activeLayers,
    toggleLayer,
    rows
  } = useAppContext();
  const [collapsed, setCollapsed] = useState(true);
  const [newLayer, setNewLayer] = useState("");

  // Extract tags from rows and add as layers, but only when not collapsed
  useEffect(() => {
    if (collapsed || !rows) return;
    const tagSet = new Set();
    rows.forEach(row => {
      if (row.Tags) {
        row.Tags
          .split(",")
          .map(tag => tag.trim())
          .filter(Boolean)
          .forEach(tag => tagSet.add(tag));
      }
    });
    tagSet.forEach(tag => {
      if (!layerOptions.includes(tag)) {
        addLayer(tag);
      }
    });
    // eslint-disable-next-line
  }, [rows, collapsed]);

  const handleAdd = () => {
    const name = newLayer.trim();
    if (name) {
      addLayer(name);
      setNewLayer("");
    }
  };

  return (
    <div className="bg-white rounded shadow">
      <div
        onClick={() => setCollapsed((c) => !c)}
        className="flex justify-between items-center bg-white text-black px-4 py-2 cursor-pointer select-none"
      >
        <span className="font-semibold">Layers</span>
        <button className="text-lg font-bold">{collapsed ? "▼" : "▲"}</button>
      </div>
      <div
        className={`transition-all duration-300 overflow-auto`}
        style={{ height: collapsed ? 0 : "auto" }}
      >
        <div className="p-4 space-y-2">
          <div className="flex space-x-2">
            <input
              className="border rounded px-2 py-1 text-sm flex-grow"
              type="text"
              value={newLayer}
              onChange={(e) => setNewLayer(e.target.value)}
              placeholder="New layer name"
            />
            <button
              onClick={handleAdd}
              className="bg-blue-600 text-white text-sm px-2 py-1 rounded"
            >
              Add
            </button>
          </div>
          <ul className="space-y-1">
            {layerOptions.map((layer) => (
              <li key={layer} className="flex items-center justify-between">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={activeLayers.includes(layer)}
                    onChange={() => toggleLayer(layer)}
                  />
                  <span>{layer}</span>
                </label>
                <button
                  onClick={() => removeLayer(layer)}
                  className="text-red-500 text-sm"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AppLayers;

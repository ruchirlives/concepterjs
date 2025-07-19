import React, { createContext, useContext, useState } from 'react';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [rows, setRows] = useState([]);
  
  // Add Tiptap content state only
  const [tiptapContent, setTiptapContent] = useState({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Edit here..." }] }],
  });

  // Layers state
  const [layerOptions, setLayerOptions] = useState([]); // available layers
  const [activeLayers, setActiveLayers] = useState([]); // currently selected

  const addLayer = (layer) => {
    setLayerOptions((prev) =>
      prev.includes(layer) ? prev : [...prev, layer]
    );
  };

  const removeLayer = (layer) => {
    setLayerOptions((prev) => prev.filter((l) => l !== layer));
    setActiveLayers((prev) => prev.filter((l) => l !== layer));
  };

  const toggleLayer = (layer) => {
    setActiveLayers((prev) =>
      prev.includes(layer)
        ? prev.filter((l) => l !== layer)
        : [...prev, layer]
    );
  };

  const value = {
    rows,
    setRows,
    // Add Tiptap content to context
    tiptapContent,
    setTiptapContent,
    layerOptions,
    addLayer,
    removeLayer,
    activeLayers,
    setActiveLayers,
    toggleLayer,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);

// Utility to check if a row belongs to any active layer
export const rowInLayers = (row, layers = []) => {
  if (!layers.length) return true;
  const tags = (row.Tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  return tags.some((t) => layers.includes(t));
};

export default AppContext;

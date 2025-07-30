import React, { createContext, useContext, useState } from 'react';
import { requestRefreshChannel } from './effectsShared';
import { useNodesState, useEdgesState } from '@xyflow/react'; // Import Zustand hooks for nodes and edges
const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [rowData, setRowData] = useState([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges] = useEdgesState();
  // last loaded file item
  const [lastLoadedFile, setLastLoadedFile] = useState(null);


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
    requestRefreshChannel();
  };

  const toggleLayer = (layer) => {
    setActiveLayers((prev) =>
      prev.includes(layer)
        ? prev.filter((l) => l !== layer)
        : [...prev, layer]
    );
    requestRefreshChannel();
  };

  const value = {
    rowData,
    setRowData,
    // Add Tiptap content to context
    tiptapContent,
    setTiptapContent,
    layerOptions,
    addLayer,
    removeLayer,
    activeLayers,
    setActiveLayers,
    toggleLayer,
    nodes,
    setNodes,
    edges,
    setEdges,
    onNodesChange,
    lastLoadedFile,
    setLastLoadedFile,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);

// Utility to check if a row belongs to any active layer
export const rowInLayers = (rowData, layers = []) => {
  if (!layers.length) return true;
  const tagList = (rowData.Tags || '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const layerList = layers.map((l) => l.trim().toLowerCase());

  return tagList.some((t) => layerList.includes(t));
};

export default AppContext;

import React, { createContext, useCallback, useContext, useState } from 'react';
import { requestRefreshChannel, handleWriteBack } from './hooks/effectsShared';
import { useNodesState, useEdgesState } from '@xyflow/react';
import { listStates, switchState, removeState, clearStates } from './api';
import toast from "react-hot-toast";

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [rowData, setRowData] = useState([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges] = useEdgesState();
  const [lastLoadedFile, setLastLoadedFile] = useState(null);

  // State management
  const [activeGroup, setActiveGroup] = useState(null);
  const [activeState, setActiveState] = useState("base");
  const [availableStates, setAvailableStates] = useState([]);
  const [comparatorState, setComparatorState] = useState("base");
  const [diffDict, setDiffDict] = useState({});

  // Matrix management
  const [relationships, setRelationships] = useState({});
  const [forwardExists, setForwardExists] = useState({});
  const [loading, setLoading] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [hideEmpty, setHideEmpty] = useState(true);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [childrenMap, setChildrenMap] = useState({});
  const [hoveredFrom, setHoveredFrom] = useState(null);
  const [hoveredRowId, setHoveredRowId] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [selectedFromLayer, setSelectedFromLayer] = useState("");
  const [selectedToLayer, setSelectedToLayer] = useState("");
  const [differences, setDifferences] = useState({});
  const [loadingDifferences, setLoadingDifferences] = useState(false);
  const [differencesTrigger, setDifferencesTrigger] = useState(0);
  const [showDropdowns, setShowDropdowns] = useState({});
  const [rawDifferences, setRawDifferences] = useState({});

  // Add Tiptap content state only
  const [tiptapContent, setTiptapContent] = useState({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Edit here..." }] }],
  });

  // Layers state
  const [layerOptions, setLayerOptions] = useState([]);
  const [activeLayers, setActiveLayers] = useState([]);

  // Layer dropdown state
  const [layerDropdownOpen, setLayerDropdownOpen] = useState(false);
  const [hiddenLayers, setHiddenLayers] = useState(new Set());


  // State management functions
  const handleStateSwitch = async (stateName) => {
    if (!stateName.trim()) return;

    try {
      // Persist current state before switching
      await handleWriteBack(rowData);

      // Refresh available states to include newly saved state
      const states = await listStates();
      setAvailableStates(states);

      await switchState(stateName);
      setActiveState(stateName);

      // Request refresh for components that depend on state changes
      // requestRefreshChannel();

      toast.success(`Switched to state: ${stateName}`);
    } catch (error) {
      console.error("Failed to switch state:", error);
      toast.error("Failed to switch state");
    }
  };

  const handleRemoveState = async (stateName = activeState) => {
    if (stateName === "base") {
      toast.error("Cannot remove base state");
      return;
    }

    try {
      await removeState(stateName);

      // If we deleted the current active state, switch to base
      if (stateName === activeState) {
        setActiveState("base");
        // requestRefreshChannel();
      }

      // Refresh available states
      const states = await listStates();
      setAvailableStates(states);

      toast.success(`Removed state: ${stateName}`);
    } catch (error) {
      console.error("Failed to remove state:", error);
      toast.error("Failed to remove state");
    }
  };

  const handleClearStates = async () => {
    try {
      await clearStates();
      setActiveState("base");
      setAvailableStates([]);
      // requestRefreshChannel();
      toast.success("Cleared all states");
    } catch (error) {
      console.error("Failed to clear states:", error);
      toast.error("Failed to clear states");
    }
  };

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

  const clearLayers = useCallback(() => {
    setLayerOptions([]);
    setActiveLayers([]);
  }, []);

  const value = {
    rowData,
    setRowData,
    tiptapContent,
    setTiptapContent,
    layerOptions,
    addLayer,
    removeLayer,
    activeLayers,
    setActiveLayers,
    toggleLayer,
    clearLayers,
    nodes,
    setNodes,
    edges,
    setEdges,
    onNodesChange,
    lastLoadedFile,
    setLastLoadedFile,
    // State management
    activeGroup,
    setActiveGroup,
    activeState,
    availableStates,
    setAvailableStates,
    comparatorState,
    setComparatorState,
    diffDict,
    setDiffDict,
    handleStateSwitch,
    handleRemoveState,
    handleClearStates,
    // Layer dropdown state
    layerDropdownOpen,
    setLayerDropdownOpen,
    hiddenLayers,
    setHiddenLayers,
    // Matrix management
    relationships,
    setRelationships,
    forwardExists,
    setForwardExists,
    loading,
    setLoading,
    editingCell,
    setEditingCell,
    hideEmpty,
    setHideEmpty,
    hoveredCell,
    setHoveredCell,
    childrenMap,
    setChildrenMap,
    hoveredFrom,
    setHoveredFrom,
    hoveredRowId,
    setHoveredRowId,
    flipped,
    setFlipped,
    selectedFromLayer,
    setSelectedFromLayer,
    selectedToLayer,
    setSelectedToLayer,
    differences,
    setDifferences,
    loadingDifferences,
    setLoadingDifferences,
    differencesTrigger,
    setDifferencesTrigger,
    showDropdowns,
    setShowDropdowns,
    rawDifferences,
    setRawDifferences
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

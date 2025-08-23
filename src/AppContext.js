import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { requestRefreshChannel, handleWriteBack } from './hooks/effectsShared';
import { useNodesState, useEdgesState } from '@xyflow/react';
import { listStates, switchState, removeState, clearStates, manyChildren } from './api';
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
  const [loading, setLoading] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [hideEmpty, setHideEmpty] = useState(true);
  const [hoveredCell, setHoveredCell] = useState(null);
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

  // Content layer filter state (add this)
  const [selectedContentLayer, setSelectedContentLayer] = useState("");

  // Parent-child relationship map
  const [parentChildMap, setParentChildMap] = useState([]);

  useEffect(() => {
    async function fetchParentChildMap() {
      const allIds = rowData.map(r => r.id);
      if (allIds.length === 0) return;
      const result = await manyChildren(allIds);
      setParentChildMap(result || []);
    }
    fetchParentChildMap();
  }, [rowData]); // or other dependencies as needed


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
    // Content layer filter (add these)
    selectedContentLayer,
    setSelectedContentLayer,
    // Matrix management
    loading,
    setLoading,
    editingCell,
    setEditingCell,
    hideEmpty,
    setHideEmpty,
    hoveredCell,
    setHoveredCell,
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
    setRawDifferences,
    // Parent-child relationship map
    parentChildMap,
    setParentChildMap,
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

/**
 * Topologically sorts items based on "successor" relationships.
 * @param {string[]} items - Array of item IDs to sort.
 * @param {Object} relationships - Map of "parentId-childId" -> relationship object.
 * @returns {string[]} Sorted array of item IDs.
 */
export function sortBySuccessor(items, relationships) {
  // console.log("Sorting items with relationships:", relationships);
  const graph = {};
  const inDegree = {};
  items.forEach(id => {
    graph[id] = [];
    inDegree[id] = 0;
  });

  // Debug: log all found successor relationships
  items.forEach(parentId => {
    items.forEach(childId => {
      if (parentId === childId) return;
      const relKey = `${parentId}-${childId}`;
      const rel = relationships[relKey];
      if (rel && rel.label === "successor") {
        console.log(`Found successor: ${parentId} -> ${childId}`);
        graph[parentId].push(childId);
        inDegree[childId]++;
      }
    });
  });

  // Kahn's algorithm for topological sort
  const queue = [];
  Object.keys(inDegree).forEach(id => {
    if (inDegree[id] === 0) queue.push(id);
  });

  const result = [];
  while (queue.length) {
    const id = queue.shift();
    result.push(id);
    graph[id].forEach(succ => {
      inDegree[succ]--;
      if (inDegree[succ] === 0) queue.push(succ);
    });
  }

  // If cycle, fallback to original order
  if (result.length !== items.length) return items;
  return result;
}

export default AppContext;

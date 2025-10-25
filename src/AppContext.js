import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { requestRefreshChannel, handleWriteBack } from './hooks/effectsShared';
import { useNodesState, useEdgesState } from '@xyflow/react';
import { listStates, switchState, removeState, clearStates, manyChildren, getInfluencers as fetchInfluencers } from './api';
import toast from "react-hot-toast";
import { registerStateSetter, unregisterStateSetter } from './stateSetterRegistry';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [rowData, setRowData] = useState([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges] = useEdgesState();
  const [lastLoadedFile, setLastLoadedFile] = useState(null);

  // State management
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


  // Layers state
  const [layerOptions, setLayerOptions] = useState([]);
  const [activeLayers, setActiveLayers] = useState([]);
  const [layerOrdering, setLayerOrdering] = useState({});

  // Layer dropdown state
  const [layerDropdownOpen, setLayerDropdownOpen] = useState(false);
  const [hiddenLayers, setHiddenLayers] = useState(new Set());

  // Content layer filter state (add this)
  const [selectedContentLayer, setSelectedContentLayer] = useState("");
  const [rowSelectedLayer, setRowSelectedLayer] = useState('');
  const [columnSelectedLayer, setColumnSelectedLayer] = useState('');

  // Flow grid overlay dimensions
  const [flowGridDimensions, setFlowGridDimensions] = useState({
    rows: [],
    columns: [],
    bounds: { width: 0, height: 0, top: 0, left: 0, clientTop: 0, clientLeft: 0 },
    lookup: {
      rowsByOriginalId: {},
      rowsByNodeId: {},
      columnsByOriginalId: {},
      columnsByNodeId: {},
    },
    cellOptions: {
      width: null,
      height: null,
    },
  });

  // Parent-child relationship map
  const [parentChildMap, setParentChildMap] = useState([]);

  // Influencers cache shared across sub-apps
  const [influencersMap, setInfluencersMap] = useState({});
  const influencersSigRef = useRef("");

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

  const normalizeId = (value) => {
    if (value == null) return '';
    return typeof value === 'string' ? value : value.toString();
  };

  const arraysEqual = (a = [], b = []) => {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  };

  const sanitizeOrder = useCallback((order = []) => {
    const seen = new Set();
    const result = [];
    order.forEach((raw) => {
      const id = normalizeId(raw);
      if (!id || seen.has(id)) return;
      seen.add(id);
      result.push(id);
    });
    return result;
  }, []);

  const updateLayerOrderingForLayer = useCallback((layer, updater) => {
    if (!layer || typeof updater !== 'function') return;
    setLayerOrdering((prev) => {
      const prevOrder = Array.isArray(prev?.[layer]) ? prev[layer] : [];
      const nextOrder = sanitizeOrder(updater(prevOrder));
      if (arraysEqual(prevOrder, nextOrder)) return prev;
      return { ...prev, [layer]: nextOrder };
    });
  }, [sanitizeOrder]);

  const addLayer = (layer) => {
    setLayerOptions((prev) =>
      prev.includes(layer) ? prev : [...prev, layer]
    );
    setLayerOrdering((prev) => {
      if (!layer || prev[layer]) return prev;
      return { ...prev, [layer]: [] };
    });
  };

  const removeLayer = (layer) => {
    setLayerOptions((prev) => prev.filter((l) => l !== layer));
    setActiveLayers((prev) => prev.filter((l) => l !== layer));
    setLayerOrdering((prev) => {
      if (!prev[layer]) return prev;
      const { [layer]: _removed, ...rest } = prev;
      return rest;
    });
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

  const clearLayers = useCallback(({ resetOrdering = true } = {}) => {
    setLayerOptions([]);
    setActiveLayers([]);
    if (resetOrdering) {
      setLayerOrdering({});
    }
  }, []);

  useEffect(() => {
    const mapping = {
      rowData: setRowData,
      activeLayers: setActiveLayers,
      activeState: setActiveState,
      availableStates: setAvailableStates,
      columnSelectedLayer: setColumnSelectedLayer,
      comparatorState: setComparatorState,
      diffDict: setDiffDict,
      differences: setDifferences,
      differencesTrigger: setDifferencesTrigger,
      editingCell: setEditingCell,
      flipped: setFlipped,
      flowGridDimensions: setFlowGridDimensions,
      hiddenLayers: setHiddenLayers,
      hideEmpty: setHideEmpty,
      hoveredCell: setHoveredCell,
      hoveredFrom: setHoveredFrom,
      hoveredRowId: setHoveredRowId,
      lastLoadedFile: setLastLoadedFile,
      layerDropdownOpen: setLayerDropdownOpen,
      layerOptions: setLayerOptions,
      layerOrdering: setLayerOrdering,
      loading: setLoading,
      loadingDifferences: setLoadingDifferences,
      rawDifferences: setRawDifferences,
      rowSelectedLayer: setRowSelectedLayer,
      selectedContentLayer: setSelectedContentLayer,
      selectedFromLayer: setSelectedFromLayer,
      selectedToLayer: setSelectedToLayer,
      showDropdowns: setShowDropdowns,
    };

    Object.entries(mapping).forEach(([key, setter]) => registerStateSetter(key, setter));

    return () => {
      Object.entries(mapping).forEach(([key, setter]) => unregisterStateSetter(key, setter));
    };
  }, [
    setActiveLayers,
    setActiveState,
    setAvailableStates,
    setColumnSelectedLayer,
    setComparatorState,
    setDiffDict,
    setDifferences,
    setDifferencesTrigger,
    setEditingCell,
    setFlipped,
    setFlowGridDimensions,
    setHiddenLayers,
    setHideEmpty,
    setHoveredCell,
    setHoveredFrom,
    setHoveredRowId,
    setLastLoadedFile,
    setLayerDropdownOpen,
    setLayerOptions,
    setLayerOrdering,
    setLoading,
    setLoadingDifferences,
    setRawDifferences,
    setRowData,
    setRowSelectedLayer,
    setSelectedContentLayer,
    setSelectedFromLayer,
    setSelectedToLayer,
    setShowDropdowns,
  ]);

  useEffect(() => {
    if (!Array.isArray(rowData)) return;
    if (rowData.length === 0) return;
    setLayerOrdering((prev) => {
      const layerToIds = {};
      rowData.forEach((row) => {
        const id = normalizeId(row?.id);
        if (!id) return;
        const tags = (row?.Tags || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean);
        tags.forEach((tag) => {
          if (!layerToIds[tag]) layerToIds[tag] = [];
          layerToIds[tag].push(id);
        });
      });

      const next = {};
      let changed = false;

      layerOptions.forEach((layer) => {
        const ids = Array.isArray(layerToIds[layer]) ? layerToIds[layer] : [];
        const idStrings = ids.map(normalizeId).filter(Boolean);
        const existing = Array.isArray(prev[layer]) ? sanitizeOrder(prev[layer]) : [];
        const filteredExisting = existing.filter((id) => idStrings.includes(id));
        const appended = idStrings.filter((id) => !filteredExisting.includes(id));
        const combined = [...filteredExisting, ...appended];

        if (combined.length > 0) {
          next[layer] = combined;
        }

        if (!arraysEqual(existing, combined)) {
          changed = true;
        }
      });

      const prevKeys = Object.keys(prev || {});
      const nextKeys = Object.keys(next);
      if (prevKeys.length !== nextKeys.length) {
        changed = true;
      } else {
        for (let i = 0; i < prevKeys.length; i += 1) {
          if (!nextKeys.includes(prevKeys[i])) {
            changed = true;
            break;
          }
        }
      }

      if (!changed) return prev;
      return next;
    });
  }, [rowData, layerOptions, sanitizeOrder]);

  // Influencers helpers
  const normalizePairs = (pairs) => {
    if (!Array.isArray(pairs)) return [];
    return pairs
      .map(p => Array.isArray(p) ? p : [p?.source_id, p?.target_id])
      .map(([s, t]) => [String(s || ""), String(t || "")])
      .filter(([s, t]) => !!s && !!t && s !== t);
  };


  const refreshInfluencers = useCallback(async (pairs, { skipIfSame = true } = {}) => {
    const signatureForPairs = (pairs) => normalizePairs(pairs).map(([s, t]) => `${s}::${t}`).join("|");
    try {
      const norm = normalizePairs(pairs);
      const sig = signatureForPairs(norm);
      if (skipIfSame && influencersSigRef.current === sig) {
        return influencersMap;
      }
      influencersSigRef.current = sig;
      if (norm.length === 0) {
        setInfluencersMap({});
        return {};
      }
      const result = await fetchInfluencers({ pairs: norm });
      const safe = result || {};
      setInfluencersMap(safe);
      return safe;
    } catch (e) {
      console.warn("Failed to fetch influencers (context)", e);
      setInfluencersMap({});
      return {};
    }
  }, [influencersMap]);

  const refreshInfluencerPair = useCallback(async (sourceId, targetId) => {
    try {
      const s = String(sourceId || "");
      const t = String(targetId || "");
      if (!s || !t) return [];
      const pairs = [[s, t]];
      const result = await fetchInfluencers({ pairs });
      const k = `${s}::${t}`;
      const arr = result && Array.isArray(result[k]) ? result[k] : [];
      setInfluencersMap(prev => ({ ...prev, [k]: arr }));
      return arr;
    } catch (e) {
      console.warn("Failed to refresh influencer pair (context)", sourceId, targetId, e);
      return [];
    }
  }, []);

  const value = {
    rowData,
    setRowData,
    layerOptions,
    setLayerOptions,
    layerOrdering,
    setLayerOrdering,
    updateLayerOrderingForLayer,
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
    rowSelectedLayer,
    setRowSelectedLayer,
    columnSelectedLayer,
    setColumnSelectedLayer,
    flowGridDimensions,
    setFlowGridDimensions,
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
    // Influencers shared API
    influencersMap,
    setInfluencersMap,
    refreshInfluencers,
    refreshInfluencerPair,
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
 * @param {Object} relationships - Map of "parentId--childId" -> relationship object.
 * @returns {string[]} Sorted array of item IDs.
 */
export function sortBySuccessor(items, relationships) {
  // console.log("Relationships", relationships);
  // console.log("Pre-sort", items);
  const REL_KEY_SEPARATOR = '--'; // match your useMatrixLogic.js

  const graph = {};
  const inDegree = {};
  items.forEach(id => {
    graph[id] = [];
    inDegree[id] = 0;
  });


  items.forEach(parentId => {
    items.forEach(childId => {
      if (parentId === childId) return;
      const relKey = `${parentId}${REL_KEY_SEPARATOR}${childId}`;
      const rel = relationships[relKey];
      if (rel === "successor" || (rel && rel.label === "successor")) {
        graph[parentId].push(childId); // parentId -> childId
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

  // console.log("Post-sort", result);
  return result;
}

export default AppContext;

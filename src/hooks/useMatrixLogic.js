import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { manyChildren, setPosition, compareStates, revertDifferences } from '../api';
import { useAppContext } from '../AppContext';
import { useEdgeMenu } from './flowEdgeMenu';
import { useStateScores } from './useStateScores';
import toast from 'react-hot-toast';

export const useMatrixLogic = () => {
  const { rowData, edges, layerOptions, comparatorState, setDiffDict, activeState, hiddenLayers,
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
    setRawDifferences,
    selectedContentLayer,
    setSelectedContentLayer

  } = useAppContext();

  const [collapsed, setCollapsed] = useState(true);
  const inputRef = useRef(null);
  const flowWrapperRef = useRef(null);

  const { menuRef, handleEdgeMenu, onMenuItemClick, hideMenu } = useEdgeMenu(flowWrapperRef, null);
  const { stateScores, handleCalculateStateScores, getHighestScoringContainer, clearStateScores } = useStateScores();

  // Filter data by layers (including global hidden layers)
  const { fromLayerFilteredData, toLayerFilteredData } = useMemo(() => {
    const filterByLayer = (data, layer) => {
      return data.filter((container) => {
        const tags = (container.Tags || '').split(',').map((t) => t.trim());
        const inSelectedLayer = layer ? tags.includes(layer) : true;
        const notHidden = !tags.some((t) => hiddenLayers.has(t));
        return inSelectedLayer && notHidden;
      });
    };

    return {
      fromLayerFilteredData: filterByLayer(rowData, selectedFromLayer),
      toLayerFilteredData: filterByLayer(rowData, selectedToLayer),
    };
  }, [rowData, selectedFromLayer, selectedToLayer, hiddenLayers]);

  // Combined filtered data
  const combinedFilteredData = useMemo(() => {
    const combinedIds = new Set([...fromLayerFilteredData.map((c) => c.id), ...toLayerFilteredData.map((c) => c.id)]);
    return rowData.filter((c) => combinedIds.has(c.id));
  }, [rowData, fromLayerFilteredData, toLayerFilteredData]);

  // Name lookup map
  const nameById = useMemo(() => {
    const map = {};
    rowData.forEach((c) => {
      map[c.id] = c.Name;
    });
    return map;
  }, [rowData]);

  // Filtered sources and targets
  const { filteredSources, filteredTargets } = useMemo(() => {
    const baseSourceData = flipped ? toLayerFilteredData : fromLayerFilteredData;
    const baseTargetData = flipped ? fromLayerFilteredData : toLayerFilteredData;

    if (!hideEmpty || baseSourceData.length === 0 || baseTargetData.length === 0) {
      return {
        filteredSources: baseSourceData,
        filteredTargets: baseTargetData,
      };
    }

    const sources = new Set();
    const targets = new Set();

    baseSourceData.forEach((source) => {
      baseTargetData.forEach((target) => {
        if (source.id !== target.id) {
          // When flipped, we need to check the correct relationship direction
          const key = flipped
            ? `${target.id}-${source.id}` // flipped: target becomes parent, source becomes child
            : `${source.id}-${target.id}`; // normal: source is parent, target is child

          if (forwardExists[key]) {
            sources.add(source.id);
            targets.add(target.id);
          }
        }
      });
    });

    return {
      filteredSources: baseSourceData.filter((c) => sources.has(c.id)),
      filteredTargets: baseTargetData.filter((c) => targets.has(c.id)),
    };
  }, [fromLayerFilteredData, toLayerFilteredData, forwardExists, hideEmpty, flipped]);

  // Container IDs string for dependency tracking
  const containerIdsString = useMemo(() => {
    return filteredSources.map((c) => c.id).join(",");
  }, [filteredSources]);

  // Build a lookup of edges for every visible relationship
  const edgeMap = useMemo(() => {
    const existing = {};
    // Add null check for edges array
    if (edges && Array.isArray(edges)) {
      edges.forEach((e) => {
        existing[`${e.source}-${e.target}`] = e;
      });
    }

    const map = {};
    filteredSources.forEach((source) => {
      filteredTargets.forEach((target) => {
        if (source.id === target.id) return;
        const sourceId = flipped ? target.id : source.id;
        const targetId = flipped ? source.id : target.id;
        const key = `${sourceId}-${targetId}`;
        map[key] =
          existing[key] || {
            source: String(sourceId),
            target: String(targetId),
          };
      });
    });

    return map;
  }, [edges, filteredSources, filteredTargets, flipped]);

  // Event handlers
  const handleStateChange = useCallback((newState) => {
    console.log(`Matrix state changed to: ${newState}`);
    setDifferences({});
    setLoadingDifferences(true);
  }, [setDifferences, setLoadingDifferences]);

  const handleCellClick = useCallback((sourceId, targetId) => {
    if (sourceId === targetId) return;
    const key = `${sourceId}-${targetId}`;
    setEditingCell({ sourceId, targetId, key });
  }, [setEditingCell]);

  const handleCellSubmit = useCallback(
    async (value) => {
      if (!editingCell) return;
      const { sourceId, targetId, key } = editingCell;

      try {
        await setPosition(sourceId, targetId, value);
        setRelationships((prev) => ({
          ...prev,
          [key]: value,
        }));
        setForwardExists((prev) => ({
          ...prev,
          [key]: true,
        }));

        setEditingCell(null);
        setDifferencesTrigger((prev) => prev + 1);
      } catch (error) {
        console.error("Error saving relationship:", error);
        setEditingCell(null);
      }
    },
    [editingCell, setEditingCell, setRelationships, setForwardExists, setDifferencesTrigger]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        handleCellSubmit(e.target.value);
      } else if (e.key === "Escape") {
        setEditingCell(null);
      }
    },
    [handleCellSubmit, setEditingCell]
  );

  const handleBlur = useCallback(
    (e) => {
      handleCellSubmit(e.target.value);
    },
    [handleCellSubmit]
  );

  const handleExportExcel = useCallback(() => {
    const headers = ["", ...filteredTargets.map((c) => c.Name), `Difference to ${comparatorState}`];
    const rows = filteredSources.map((source) => {
      const values = [source.Name];
      filteredTargets.forEach((target) => {
        const key = `${source.id}-${target.id}`;
        values.push(relationships[key] || "");
      });
      values.push(differences[source.id] || "No difference");
      return values.join("\t");
    });
    const tsv = [headers.join("\t"), ...rows].join("\n");

    toast((t) => (
      <div className="max-w-[300px]">
        <div className="font-semibold mb-1">Matrix TSV</div>
        <div className="text-xs mb-2 overflow-y-auto max-h-40 whitespace-pre-wrap font-mono">{tsv}</div>
        <button
          className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
          onClick={() => {
            navigator.clipboard.writeText(tsv);
            toast.success("Copied!");
            toast.dismiss(t.id);
          }}
        >
          Copy to Clipboard
        </button>
      </div>
    ));
  }, [filteredSources, filteredTargets, relationships, differences, comparatorState]);

  const handleCopyDiff = async (containerId) => {
    try {
      const containerIds = [containerId];
      const differenceResults = await compareStates(comparatorState, activeState, containerIds);

      if (!differenceResults || !differenceResults[containerId]) {
        toast.error("No differences found for this container");
        return;
      }

      setDiffDict(differenceResults);
      toast.success(`Copied diff results for container to context`);
    } catch (error) {
      console.error("Failed to copy diff:", error);
      toast.error("Failed to copy diff");
    }
    setShowDropdowns((prev) => ({ ...prev, [containerId]: false }));
  };

  const handleRevertDiff = async (containerId) => {
    try {
      const containerIds = [containerId];
      const differenceResults = await compareStates(comparatorState, activeState, containerIds);

      if (!differenceResults || !differenceResults[containerId]) {
        toast.error("No differences found for this container");
        return;
      }

      await revertDifferences(containerIds, differenceResults, activeState);
      toast.success(`Reverted differences for container in ${activeState} state`);
      setDifferencesTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to revert diff:", error);
      toast.error("Failed to revert diff");
    }
    setShowDropdowns((prev) => ({ ...prev, [containerId]: false }));
  };

  const toggleDropdown = (containerId) => {
    setShowDropdowns((prev) => ({ ...prev, [containerId]: !prev[containerId] }));
  };

  const getRelationshipColor = (value, isDifferentFromComparator) => {
    if (!value) return "bg-yellow-50";
    if (isDifferentFromComparator) return "bg-blue-50";
    return "bg-yellow-50";
  };

  // Load relationships
  const loadRelationships = useCallback(async () => {
    if (combinedFilteredData.length === 0 || collapsed) return;

    setLoading(true);

    try {
      const containerIds = combinedFilteredData.map((container) => container.id);
      const parentChildMap = await manyChildren(containerIds);

      if (!parentChildMap) {
        setRelationships({});
        setLoading(false);
        return;
      }

      const newRelationships = {};
      const newForwardMap = {};
      const newChildrenMap = {};

      parentChildMap.forEach(({ container_id, children }) => {
        const parentId = container_id.toString();

        // Add null check for children
        if (!children || !Array.isArray(children)) {
          newChildrenMap[parentId] = [];
          return;
        }

        newChildrenMap[parentId] = children.map((c) => c.id.toString());

        children.forEach((child) => {
          const childId = child.id.toString();
          const key = `${parentId}-${childId}`;

          let relationship = "";
          if (child.position) {
            if (typeof child.position === "object") {
              relationship = child.position.label || "";
            } else {
              relationship = child.position.toString();
            }
          }

          newRelationships[key] = relationship;
          newForwardMap[key] = true;
        });
      });

      for (let i = 0; i < fromLayerFilteredData.length; i++) {
        for (let j = 0; j < toLayerFilteredData.length; j++) {
          const sourceId = fromLayerFilteredData[i].id;
          const targetId = toLayerFilteredData[j].id;
          const key = `${sourceId}-${targetId}`;

          if (!(key in newRelationships)) {
            newRelationships[key] = "";
          }
        }
      }

      setRelationships(newRelationships);
      setForwardExists(newForwardMap);
      setChildrenMap(newChildrenMap);
    } catch (error) {
      console.error("Error loading relationships:", error);
      const newRelationships = {};
      for (let i = 0; i < fromLayerFilteredData.length; i++) {
        for (let j = 0; j < toLayerFilteredData.length; j++) {
          const sourceId = fromLayerFilteredData[i].id;
          const targetId = toLayerFilteredData[j].id;
          const key = `${sourceId}-${targetId}`;
          newRelationships[key] = "";
        }
      }
      setRelationships(newRelationships);
      setForwardExists({});
      setChildrenMap({});
    }

    setLoading(false);
  }, [combinedFilteredData, fromLayerFilteredData, toLayerFilteredData, collapsed, setRelationships, setForwardExists, setChildrenMap, setLoading]);

  // Effects
  useEffect(() => {
    loadRelationships();
  }, [loadRelationships]);

  useEffect(() => {
    if (combinedFilteredData.length > 0 && !collapsed && Object.keys(relationships).length === 0) {
      loadRelationships();
    }
  }, [collapsed, combinedFilteredData.length, relationships, loadRelationships]);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  useEffect(() => {
    if (filteredSources.length === 0 || collapsed) return;

    const fetchDifferences = async () => {
      setLoadingDifferences(true);
      setDifferences({});
      try {
        const containerIds = filteredSources.map((container) => container.id);

        const differenceResults = await compareStates(
          comparatorState,   // sourceState (comparator)
          activeState,       // targetState (current state)
          containerIds
        );
        // console.log("Difference results:", differenceResults);

        const differencesMap = {};

        Object.keys(differenceResults).forEach((containerId) => {
          const containerDiffs = differenceResults[containerId];

          const changes = [];
          Object.keys(containerDiffs).forEach((targetId) => {
            const diff = containerDiffs[targetId];
            const targetName = nameById[targetId] || targetId;
            if (diff.status === "added") {
              changes.push(`Added ${targetName}: ${diff.relationship}`);
            } else if (diff.status === "changed") {
              changes.push(`Changed ${targetName}: ${diff.relationship}`);
            } else if (diff.status === "removed") {
              changes.push(`Removed ${targetName}: ${diff.relationship}`);
            }
          });

          differencesMap[containerId] = changes.length > 0 ? changes.join("\n") : "No difference";
        });

        setDifferences(differencesMap);
        setRawDifferences(differenceResults);
      } catch (error) {
        console.error("Error fetching differences:", error);
        setDifferences({});
      } finally {
        setLoadingDifferences(false);
      }
    };

    fetchDifferences();
  }, [
    comparatorState,
    differencesTrigger,
    collapsed,
    filteredSources,
    nameById,
    containerIdsString,
    activeState,
    setDifferences,
    setLoadingDifferences,
    setRawDifferences
  ]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        hideMenu();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuRef, hideMenu]);

  // Filter layer options to exclude hidden layers
  const availableLayerOptions = useMemo(() => {
    return layerOptions.filter(layer => !hiddenLayers.has(layer));
  }, [layerOptions, hiddenLayers]);

  // Compute unique content layers from rowData
  const contentLayerOptions = useMemo(() => {
    const layers = new Set();
    rowData.forEach(row => {
      if (row.Tags) {
        row.Tags.split(",").map(t => t.trim()).forEach(t => {
          if (t) layers.add(t);
        });
      }
    });
    return Array.from(layers).sort();
  }, [rowData]);

  return {
    // State
    relationships,
    forwardExists,
    loading,
    editingCell,
    collapsed,
    setCollapsed,
    hideEmpty,
    setHideEmpty,
    hoveredCell,
    setHoveredCell,
    childrenMap,
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
    loadingDifferences,
    showDropdowns,
    setShowDropdowns,
    rawDifferences,
    selectedContentLayer,
    setSelectedContentLayer,

    // Refs
    inputRef,
    flowWrapperRef,

    // Data
    filteredSources,
    filteredTargets,
    nameById,
    rowData,
    edgeMap,
    layerOptions: availableLayerOptions,
    comparatorState,
    contentLayerOptions, // <-- add this line

    // Actions
    handleStateChange,
    handleCellClick,
    handleKeyDown,
    handleBlur,
    handleExportExcel,
    handleCopyDiff,
    handleRevertDiff,
    toggleDropdown,
    getRelationshipColor,

    // Menu
    menuRef,
    handleEdgeMenu,
    onMenuItemClick,
    hideMenu,

    // State scores
    stateScores,
    handleCalculateStateScores,
    getHighestScoringContainer,
    clearStateScores,
  };
};
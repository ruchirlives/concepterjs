import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { setPosition, compareStates, revertDifferences } from '../api';
import { requestRefreshChannel } from "hooks/effectsShared";
import { useAppContext } from '../AppContext';
import { useEdgeMenu } from './flowEdgeMenu';
import { useStateScores } from './useStateScores';
import toast from 'react-hot-toast';

export const useMatrixLogic = () => {
  const {
    rowData, edges, layerOptions, comparatorState, setDiffDict, activeState, hiddenLayers,
    loading,
    editingCell, setEditingCell,
    hideEmpty, setHideEmpty,
    hoveredCell, setHoveredCell,
    hoveredFrom, setHoveredFrom,
    hoveredRowId, setHoveredRowId,
    flipped, setFlipped,
    selectedFromLayer, setSelectedFromLayer,
    selectedToLayer, setSelectedToLayer,
    differences, setDifferences,
    loadingDifferences, setLoadingDifferences,
    differencesTrigger, setDifferencesTrigger,
    showDropdowns, setShowDropdowns,
    rawDifferences, setRawDifferences,
    selectedContentLayer, setSelectedContentLayer,
    parentChildMap, setParentChildMap // <-- only these for relationships
  } = useAppContext();

  const inputRef = useRef(null);
  const flowWrapperRef = useRef(null);

  const { menuRef, handleEdgeMenu, onMenuItemClick, hideMenu } = useEdgeMenu(flowWrapperRef, null);
  const { stateScores, handleCalculateStateScores, getHighestScoringContainer, clearStateScores } = useStateScores();

  // Compute a lookup map of container ID to Name
  const nameById = useMemo(() => {
    const map = {};
    rowData.forEach(row => {
      map[row.id] = row.Name;
    });
    return map;
  }, [rowData]);
  // 1. Filter data by layers (including global hidden layers)
  const { fromLayerFilteredData, toLayerFilteredData } = useMemo(() => {
    // Positive screen: only include rows that have at least one ticked (visible) layer
    const visibleLayers = new Set((layerOptions || []).filter(l => !hiddenLayers.has(l)));

    const filterByLayer = (data, layer) => {
      return data.filter((container) => {
        const tags = (container.Tags || '').split(',').map((t) => t.trim()).filter(Boolean);
        const inSelectedLayer = layer ? tags.includes(layer) : true;
        const isUntagged = tags.length === 0;
        const includeUntagged = !hiddenLayers.has('__UNTAGGED__');
        const inVisible = isUntagged ? includeUntagged : (visibleLayers.size === 0 ? false : tags.some((t) => visibleLayers.has(t)));
        return inSelectedLayer && inVisible;
      });
    };

    return {
      fromLayerFilteredData: filterByLayer(rowData, selectedFromLayer),
      toLayerFilteredData: filterByLayer(rowData, selectedToLayer),
    };
  }, [rowData, selectedFromLayer, selectedToLayer, hiddenLayers, layerOptions]);

  // 2. DERIVE relationships, forwardExists, childrenMap FIRST!
  const { relationships, forwardExists, childrenMap } = useMemo(() => {
    const rels = {};
    const fwds = {};
    const children = {};

    if (!parentChildMap || !Array.isArray(parentChildMap)) {
      return { relationships: rels, forwardExists: fwds, childrenMap: children };
    }

    parentChildMap.forEach(({ container_id, children: childArr }) => {
      const parentId = container_id.toString();
      children[parentId] = [];
      if (!childArr || !Array.isArray(childArr)) return;
      childArr.forEach(child => {
        const childId = child.id.toString();
        children[parentId].push(childId);
        const key = `${parentId}--${childId}`;
        let relationship = "";
        if (child.position) {
          if (typeof child.position === "object") {
            relationship = child.position.label || "";
          } else {
            relationship = child.position.toString();
          }
        }
        rels[key] = relationship;
        fwds[key] = true;
      });
    });

    // Fill in empty relationships for all visible pairs
    for (let i = 0; i < fromLayerFilteredData.length; i++) {
      for (let j = 0; j < toLayerFilteredData.length; j++) {
        const sourceId = fromLayerFilteredData[i].id;
        const targetId = toLayerFilteredData[j].id;
        const key = `${sourceId}--${targetId}`;
        if (!(key in rels)) rels[key] = "";
      }
    }

    return { relationships: rels, forwardExists: fwds, childrenMap: children };
  }, [parentChildMap, fromLayerFilteredData, toLayerFilteredData]);

  // 3. Now you can use forwardExists, relationships, childrenMap in other hooks
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
            ? `${target.id}--${source.id}` // flipped: target becomes parent, source becomes child
            : `${source.id}--${target.id}`; // normal: source is parent, target is child

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

  // Kanban-specific filtered sources/targets
  const { kanbanFilteredSources, kanbanFilteredTargets } = useMemo(() => {
    if (!hideEmpty) {
      return {
        kanbanFilteredSources: fromLayerFilteredData,
        kanbanFilteredTargets: toLayerFilteredData,
      };
    }

    // Build childrenMap if not already present
    // childrenMap: { [parentId]: [childId, ...] }
    const hasCommonChildren = (sourceId, targetId) => {
      if (sourceId === targetId) return false;
      const sourceChildren = childrenMap[sourceId] || [];
      const targetChildren = childrenMap[targetId] || [];
      return sourceChildren.some(cid => targetChildren.includes(cid));
    };

    // Filter sources: keep if any target shares a child
    const filteredSources = fromLayerFilteredData.filter(source =>
      toLayerFilteredData.some(target => hasCommonChildren(source.id.toString(), target.id.toString()))
    );

    // Filter targets: keep if any source shares a child
    const filteredTargets = toLayerFilteredData.filter(target =>
      fromLayerFilteredData.some(source => hasCommonChildren(source.id.toString(), target.id.toString()))
    );

    return {
      kanbanFilteredSources: filteredSources,
      kanbanFilteredTargets: filteredTargets,
    };
  }, [fromLayerFilteredData, toLayerFilteredData, childrenMap, hideEmpty]);

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
        existing[`${e.source}--${e.target}`] = e;
      });
    }

    const map = {};
    filteredSources.forEach((source) => {
      filteredTargets.forEach((target) => {
        if (source.id === target.id) return;
        const sourceId = flipped ? target.id : source.id;
        const targetId = flipped ? source.id : target.id;
        const key = `${sourceId}--${targetId}`;
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
    const key = `${sourceId}--${targetId}`;
    setEditingCell({ sourceId, targetId, key });
  }, [setEditingCell]);

  const handleCellSubmit = useCallback(
    async (value) => {
      if (!editingCell) return;
      const { sourceId, targetId } = editingCell;

      try {
        await setPosition(sourceId, targetId, value);
        setEditingCell(null);
        setDifferencesTrigger((prev) => prev + 1);
        requestRefreshChannel(); // <-- Add this line to trigger refresh
      } catch (error) {
        console.error("Error saving relationship:", error);
        setEditingCell(null);
      }
    },
    [editingCell, setEditingCell, setDifferencesTrigger]
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
    // Always: rows = filteredSources, columns = filteredTargets (matches UI)
    const exportRows = filteredSources;
    const exportCols = filteredTargets;

    const headers = ["", ...exportCols.map((c) => c.Name), `Difference to ${comparatorState}`];
    const rows = exportRows.map((rowItem) => {
      const values = [rowItem.Name];
      exportCols.forEach((colItem) => {
        // Relationship key: direction depends on flipped
        const key = flipped
          ? `${colItem.id}--${rowItem.id}` // flipped: target (col) is parent, source (row) is child
          : `${rowItem.id}--${colItem.id}`; // normal: source (row) is parent, target (col) is child
        values.push(relationships[key] || "");
      });
      values.push(differences[rowItem.id] || "No difference");
      return values.join("\t");
    });
    const tsv = [headers.join("\t"), ...rows].join("\n");

    if (navigator && navigator.clipboard) {
      navigator.clipboard.writeText(tsv);
      alert("Matrix copied to clipboard as TSV!");
    } else {
      alert(tsv);
    }
  }, [filteredSources, filteredTargets, relationships, differences, comparatorState, flipped]);

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
      requestRefreshChannel(); // <-- Add this line to trigger refresh
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

  // Effects
  useEffect(() => {
    // Optionally, you can call setParentChildMap here if you want to force a reload
  }, [setParentChildMap]);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  useEffect(() => {
    if (filteredSources.length === 0) return;

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
    childrenMap, // only once!
    loading,
    editingCell,
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
    contentLayerOptions,
    kanbanFilteredSources,
    kanbanFilteredTargets,

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


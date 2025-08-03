import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { manyChildren, setPosition, compareStates, revertDifferences } from "./api";
import { useAppContext } from "./AppContext";
import EdgeMenu, { useEdgeMenu } from "./hooks/flowEdgeMenu";
import toast from "react-hot-toast";
import StateDropdown, { ComparatorDropdown } from "./components/StateDropdown";
import { useStateScores } from './hooks/useStateScores';

const AppMatrix = () => {
  const { rowData, edges, layerOptions, comparatorState, setDiffDict, activeState } = useAppContext();
  const [relationships, setRelationships] = useState({});
  const [forwardExists, setForwardExists] = useState({});
  const [loading, setLoading] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [collapsed, setCollapsed] = useState(true);
  const [hideEmpty, setHideEmpty] = useState(true);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [childrenMap, setChildrenMap] = useState({});
  const [hoveredFrom, setHoveredFrom] = useState(null);
  const [hoveredRowId, setHoveredRowId] = useState(null);
  const [flipped, setFlipped] = useState(true);
  const [selectedFromLayer, setSelectedFromLayer] = useState("");
  const [selectedToLayer, setSelectedToLayer] = useState("");
  const [differences, setDifferences] = useState({});
  const [loadingDifferences, setLoadingDifferences] = useState(false);
  const [differencesTrigger, setDifferencesTrigger] = useState(0);
  const [showDropdowns, setShowDropdowns] = useState({}); // Track which dropdowns are open

  const inputRef = useRef(null);
  const flowWrapperRef = useRef(null);

  const { menuRef, handleEdgeMenu, onMenuItemClick, hideMenu } = useEdgeMenu(flowWrapperRef, null);

  // Handle state change callback
  const handleStateChange = useCallback((newState) => {
    console.log(`Matrix state changed to: ${newState}`);
    setDifferences({});
    setLoadingDifferences(true);
  }, []);

  // FIRST: Define all the memoized values that other hooks depend on

  // Filter rowData by selected layers for "from" and "to"
  const { fromLayerFilteredData, toLayerFilteredData } = useMemo(() => {
    const filterByLayer = (data, layer) => {
      if (!layer) return data;
      return data.filter((container) => {
        if (!container.Tags) return false;
        const containerTags = container.Tags.split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);
        return containerTags.includes(layer);
      });
    };

    return {
      fromLayerFilteredData: filterByLayer(rowData, selectedFromLayer),
      toLayerFilteredData: filterByLayer(rowData, selectedToLayer),
    };
  }, [rowData, selectedFromLayer, selectedToLayer]);

  // Combine both filtered datasets for relationship loading
  const combinedFilteredData = useMemo(() => {
    const combinedIds = new Set([...fromLayerFilteredData.map((c) => c.id), ...toLayerFilteredData.map((c) => c.id)]);
    return rowData.filter((c) => combinedIds.has(c.id));
  }, [rowData, fromLayerFilteredData, toLayerFilteredData]);

  // Map container id to name for quick lookup
  const nameById = useMemo(() => {
    const map = {};
    rowData.forEach((c) => {
      map[c.id] = c.Name;
    });
    return map;
  }, [rowData]);

  // Memoize filtered data based on hideEmpty setting and flipped state
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
          const key = `${source.id}-${target.id}`;
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

  // THEN: Define callbacks that depend on the memoized values

  // Use manyChildren to get all relationships efficiently
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
  }, [combinedFilteredData, fromLayerFilteredData, toLayerFilteredData, collapsed]);

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

  const handleCellClick = useCallback((sourceId, targetId) => {
    if (sourceId === targetId) return;
    const key = `${sourceId}-${targetId}`;
    setEditingCell({ sourceId, targetId, key });
  }, []);

  // Add this memoized value before the useEffect
  const containerIdsString = useMemo(() => {
    return filteredSources.map((c) => c.id).join(",");
  }, [filteredSources]);

  // useEffect handles the conditions and state dependencies
  useEffect(() => {
    if (filteredSources.length === 0 || collapsed) return;

    const fetchDifferences = async () => {
      setLoadingDifferences(true);
      setDifferences({});
      try {
        const containerIds = filteredSources.map((container) => container.id);
        const differenceResults = await compareStates(comparatorState, containerIds);

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
      } catch (error) {
        console.error("Error fetching differences:", error);
        setDifferences({});
      } finally {
        setLoadingDifferences(false);
      }
    };

    fetchDifferences();
  }, [
    // Include all dependencies that are actually used in the effect
    comparatorState,
    differencesTrigger,
    collapsed,
    filteredSources,
    nameById,
    containerIdsString, // Use the memoized string instead of the complex expression
  ]);

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

        // Trigger differences refresh
        setDifferencesTrigger((prev) => prev + 1);
      } catch (error) {
        console.error("Error saving relationship:", error);
        setEditingCell(null);
      }
    },
    [editingCell, setRelationships, setForwardExists, setDifferencesTrigger]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        handleCellSubmit(e.target.value);
      } else if (e.key === "Escape") {
        setEditingCell(null);
      }
    },
    [handleCellSubmit]
  );

  const handleBlur = useCallback(
    (e) => {
      handleCellSubmit(e.target.value);
    },
    [handleCellSubmit]
  );

  // FINALLY: All useEffect hooks that depend on the above

  // Hide menu when clicking outside
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

  // Load existing relationships when filtered data changes OR when collapsed state changes
  useEffect(() => {
    loadRelationships();
  }, [loadRelationships]);

  // Additional effect to trigger fetch when expanding with existing data
  useEffect(() => {
    if (combinedFilteredData.length > 0 && !collapsed && Object.keys(relationships).length === 0) {
      loadRelationships();
    }
  }, [collapsed, combinedFilteredData.length, relationships, loadRelationships]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Color coding and tooltip functions (non-hooks can stay here)
  const getRelationshipColor = (value) => {
    if (!value) return "bg-yellow-50";
    if (value.includes("parent")) return "bg-blue-50";
    if (value.includes("child")) return "bg-green-50";
    return "bg-yellow-50";
  };

  const RelationshipTooltip = ({ text, position }) => {
    if (!text) return null;
    return (
      <div
        style={{
          position: "fixed",
          top: position.y + 12,
          left: position.x + 12,
          zIndex: 1000,
          background: "rgba(0,0,0,0.85)",
          color: "#fff",
          padding: "8px 12px",
          borderRadius: "6px",
          fontSize: "13px",
          maxWidth: "320px",
          wordBreak: "break-word",
          pointerEvents: "none",
        }}
      >
        {text}
      </div>
    );
  };

  const handleCopyDiff = async (containerId) => {
    try {
      // We need to get the actual diff results for this container
      const containerIds = [containerId]; // Just this one container
      const differenceResults = await compareStates(comparatorState, containerIds);

      if (!differenceResults || !differenceResults[containerId]) {
        toast.error("No differences found for this container");
        return;
      }

      // Set the diffDict with the same format as AppState uses
      setDiffDict(differenceResults);
      toast.success(`Copied diff results for container to context`);
      console.log("Copied diff results:", differenceResults);
    } catch (error) {
      console.error("Failed to copy diff:", error);
      toast.error("Failed to copy diff");
    }
    setShowDropdowns((prev) => ({ ...prev, [containerId]: false }));
  };

  const handleRevertDiff = async (containerId) => {
    try {
      // Get the current diff results for this container
      const containerIds = [containerId];
      const differenceResults = await compareStates(comparatorState, containerIds);

      if (!differenceResults || !differenceResults[containerId]) {
        toast.error("No differences found for this container");
        return;
      }

      // Revert using the ACTIVE state as target (where we want to revert changes)
      await revertDifferences(containerIds, differenceResults, activeState);
      toast.success(`Reverted differences for container in ${activeState} state`);

      // Trigger differences refresh
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

  // Replace the stateScores state and functions with the hook
  const { stateScores, handleCalculateStateScores, getHighestScoringContainer, clearStateScores } = useStateScores();

  return (
    <div ref={flowWrapperRef} className="bg-white rounded shadow">
      {/* Header */}
      <div className="flex justify-between items-center bg-white text-black px-4 py-2 cursor-pointer select-none">
        <div className="flex items-center gap-4">
          <span className="font-semibold">
            Relationship Matrix ({filteredSources.length}×{filteredTargets.length} of {rowData.length} containers)
          </span>

          {/* State Management Dropdown */}
          <StateDropdown onStateChange={handleStateChange} />

          {/* Comparator State Dropdown - Using the new component */}
          <ComparatorDropdown />

          {/* From Layer Filter Dropdown */}
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-600">{flipped ? "To:" : "From:"}</label>
            <select
              value={flipped ? selectedToLayer : selectedFromLayer}
              onChange={(e) => (flipped ? setSelectedToLayer(e.target.value) : setSelectedFromLayer(e.target.value))}
              className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
              title={`Filter ${flipped ? "to" : "from"} layer`}
            >
              <option value="">All Layers</option>
              {layerOptions.map((layer) => (
                <option key={layer} value={layer}>
                  {layer}
                </option>
              ))}
            </select>
          </div>

          {/* To Layer Filter Dropdown */}
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-600">{flipped ? "From:" : "To:"}</label>
            <select
              value={flipped ? selectedFromLayer : selectedToLayer}
              onChange={(e) => (flipped ? setSelectedFromLayer(e.target.value) : setSelectedToLayer(e.target.value))}
              className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
              title={`Filter ${flipped ? "from" : "to"} layer`}
            >
              <option value="">All Layers</option>
              {layerOptions.map((layer) => (
                <option key={layer} value={layer}>
                  {layer}
                </option>
              ))}
            </select>
          </div>

          {/* Hide Empty Toggle Button */}
          <button
            className={`px-3 py-1 text-xs rounded transition-colors ${
              hideEmpty ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            onClick={() => setHideEmpty(!hideEmpty)}
            title={hideEmpty ? "Show all containers" : "Hide empty rows/columns"}
          >
            {hideEmpty ? "Show All" : "Hide Empty"}
          </button>

          {/* Flip Axis Button */}
          <button
            className="px-3 py-1 text-xs rounded bg-purple-500 text-white hover:bg-purple-600"
            onClick={() => setFlipped((f) => !f)}
            title="Flip rows and columns"
          >
            Flip Axis
          </button>

          <button
            className="px-3 py-1 text-xs rounded bg-green-500 text-white hover:bg-green-600"
            onClick={handleExportExcel}
            title="Export current view"
          >
            Export Excel
          </button>

          <button
            className="px-3 py-1 text-xs rounded bg-purple-500 text-white hover:bg-purple-600"
            onClick={handleCalculateStateScores}
            title={`Calculate propagated change scores for ${comparatorState} state`}
            disabled={!comparatorState}
          >
            Calculate Scores
          </button>

          <button
            className="px-3 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600"
            onClick={clearStateScores}
            title="Clear all state scores and highlighting"
            disabled={Object.keys(stateScores).length === 0}
          >
            Clear Scores
          </button>
        </div>

        <button className="text-lg font-bold" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "Expand matrix" : "Collapse matrix"}>
          {collapsed ? "▼" : "▲"}
        </button>
      </div>

      {/* Matrix content */}
      <div className={`transition-all duration-300 overflow-auto`} style={{ height: collapsed ? 0 : 700 }}>
        <div className="h-full flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-500">Loading relationships...</div>
            </div>
          ) : filteredSources.length === 0 || filteredTargets.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-500">
                {rowData.length === 0
                  ? "No data available. Load containers to populate the matrix."
                  : "No containers match the current filters. Adjust layer filters or toggle 'Show All'."}
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 m-4 mb-0 border border-gray-300 relative overflow-auto">
                <div className="overflow-x-auto overflow-y-auto w-full h-full" style={{ maxHeight: "600px" }}>
                  <table className="table-fixed border-collapse w-full">
                    <thead className="sticky top-0 z-20">
                      <tr>
                        {/* Top-left corner cell */}
                        <th className="sticky left-0 z-30 p-2 bg-gray-100 border border-gray-300 text-xs font-medium text-left min-w-30 max-w-30 w-30">
                          <div className="w-0 h-0 border-l-[50px] border-l-transparent border-b-[30px] border-b-gray-400 relative">
                            <span className="absolute -bottom-6 -left-12 text-xs">{flipped ? "To" : "From"}</span>
                            <span className="absolute -bottom-2 left-2 text-xs">{flipped ? "From" : "To"}</span>
                          </div>
                        </th>
                        {/* Column headers - only show filtered containers */}
                        {filteredTargets.map((container) => (
                          <th
                            key={container.id}
                            className="p-2 bg-gray-100 border border-gray-300 text-xs font-medium text-left truncate whitespace-nowrap min-w-30 max-w-30 w-30"
                          >
                            <div title={container.Name}>{container.Name}</div>
                          </th>
                        ))}
                        {/* Difference to comparator state column header */}
                        <th className="p-2 bg-blue-100 border border-gray-300 text-xs font-medium text-left truncate whitespace-nowrap min-w-40 max-w-40 w-40">
                          <div title={`Differences compared to ${comparatorState} state`}>
                            Difference to {comparatorState}
                            {loadingDifferences && <span className="ml-1">⏳</span>}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Only show filtered containers as rows */}
                      {filteredSources.map((sourceContainer) => (
                        <tr key={sourceContainer.id}>
                          {/* Row header */}
                          <th
                            className={`sticky left-0 z-10 p-2 border border-gray-300 text-xs font-medium text-left truncate whitespace-nowrap min-w-30 max-w-30 w-30 ${
                              // Check if this is the highest scoring container
                              getHighestScoringContainer() === sourceContainer.id.toString()
                                ? "bg-yellow-400"
                                : hoveredFrom && childrenMap[hoveredFrom]?.includes(sourceContainer.id.toString())
                                ? "bg-yellow-100"
                                : hoveredRowId === sourceContainer.id.toString()
                                ? "bg-yellow-200"
                                : "bg-gray-100"
                            }`}
                            onMouseEnter={() => {
                              setHoveredFrom(sourceContainer.id.toString());
                              setHoveredRowId(sourceContainer.id.toString());
                            }}
                            onMouseLeave={() => {
                              setHoveredFrom(null);
                              setHoveredRowId(null);
                            }}
                          >
                            <div title={sourceContainer.Name} className="whitespace-normal text-xs">
                              {sourceContainer.Name}
                              {/* Show score if available */}
                              {stateScores[sourceContainer.id] !== undefined && (
                                <div className="text-gray-600 text-xs mt-1">Score: {stateScores[sourceContainer.id].toFixed(3)}</div>
                              )}
                              {childrenMap[sourceContainer.id.toString()]?.length > 0 && (
                                <div className="text-gray-400 text-xs mt-1 break-words">
                                  ({childrenMap[sourceContainer.id.toString()].map((cid) => nameById[cid] || cid).join(", ")})
                                </div>
                              )}
                            </div>
                          </th>
                          {/* Data cells - only show filtered containers as columns */}
                          {filteredTargets.map((targetContainer) => {
                            // Flip the key if flipped
                            const key = flipped ? `${targetContainer.id}-${sourceContainer.id}` : `${sourceContainer.id}-${targetContainer.id}`;
                            const isEditing = editingCell?.key === key;
                            const value = relationships[key] || "";
                            const isDiagonal = sourceContainer.id === targetContainer.id;

                            if (isDiagonal) {
                              return (
                                <td key={key} className="p-2 bg-gray-200 border border-gray-300 text-left">
                                  —
                                </td>
                              );
                            }

                            // Find the actual edge from the edges array
                            const edge = edges.find(
                              (e) =>
                                e.source === (flipped ? targetContainer.id : sourceContainer.id) &&
                                e.target === (flipped ? sourceContainer.id : targetContainer.id)
                            );

                            return (
                              <td
                                key={key}
                                className={`p-1 border border-gray-300 text-left cursor-pointer hover:bg-gray-50 min-w-30 max-w-30 w-30 ${
                                  forwardExists[key] ? getRelationshipColor(value) : "bg-white"
                                }`}
                                onClick={() =>
                                  flipped
                                    ? handleCellClick(targetContainer.id, sourceContainer.id)
                                    : handleCellClick(sourceContainer.id, targetContainer.id)
                                }
                                onContextMenu={(event) => {
                                  event.preventDefault();
                                  if (edge) {
                                    handleEdgeMenu(event, edge);
                                  }
                                }}
                                onMouseEnter={(e) => {
                                  setHoveredRowId(sourceContainer.id.toString()); // Highlight the row header
                                  if (value || forwardExists[key]) {
                                    const rect = e.target.getBoundingClientRect();
                                    setHoveredCell({
                                      key,
                                      text: value || "Add label",
                                      position: { x: rect.left, y: rect.top },
                                    });
                                  }
                                }}
                                onMouseLeave={() => {
                                  setHoveredRowId(null); // Remove row header highlight
                                  setHoveredCell(null);
                                }}
                              >
                                {isEditing ? (
                                  <input
                                    ref={inputRef}
                                    type="text"
                                    defaultValue={value}
                                    className="w-full px-1 py-0 text-xs border-0 outline-none bg-white"
                                    onKeyDown={handleKeyDown}
                                    onBlur={handleBlur}
                                  />
                                ) : (
                                  <span className="text-xs block whitespace-pre-line break-words">{value || "—"}</span>
                                )}
                              </td>
                            );
                          })}
                          {/* Difference to comparator state column */}
                          <td className="p-2 bg-blue-50 border border-gray-300 text-left min-w-40 max-w-40 w-40 relative">
                            <div className="flex items-start justify-between">
                              <div className="text-xs whitespace-pre-line break-words flex-1 pr-2">
                                {loadingDifferences ? (
                                  <span className="text-gray-500">Loading...</span>
                                ) : (
                                  differences[sourceContainer.id] || "No difference"
                                )}
                              </div>

                              {/* Dropdown button - only show if there are differences */}
                              {differences[sourceContainer.id] && differences[sourceContainer.id] !== "No difference" && (
                                <button
                                  onClick={() => toggleDropdown(sourceContainer.id)}
                                  className="text-gray-500 hover:text-gray-700 focus:outline-none text-sm"
                                >
                                  ⋮
                                </button>
                              )}
                            </div>

                            {/* Dropdown Menu */}
                            {showDropdowns[sourceContainer.id] && (
                              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-[140px]">
                                <button
                                  onClick={() => handleCopyDiff(sourceContainer.id)}
                                  className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 border-b border-gray-100"
                                >
                                  Copy Diff to Context
                                </button>
                                <button
                                  onClick={() => handleRevertDiff(sourceContainer.id)}
                                  className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  Revert Diff
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Render the tooltip only once, outside the table */}
                  {hoveredCell && <RelationshipTooltip text={hoveredCell.text} position={hoveredCell.position} />}
                  {/* EdgeMenu component */}
                  <EdgeMenu
                    ref={menuRef}
                    onMenuItemClick={onMenuItemClick}
                    rowData={rowData}
                    setRowData={() => {}}
                    edges={filteredSources
                      .map((source) =>
                        filteredTargets.map((target) => ({
                          id: `${source.id}-${target.id}`,
                          source: source.id,
                          target: target.id,
                        }))
                      )
                      .flat()}
                    setEdges={() => {}}
                  />
                </div>
              </div>

              {/* Instructions below the table */}
              <div className="mt-4 text-sm text-gray-600 flex-shrink-0">
                <p>• Click on any cell to edit the relationship</p>
                <p>• Press Enter to save, Escape to cancel</p>
                <p>• Diagonal cells (same container) are disabled</p>
                <p>• Headers are frozen for easy navigation</p>
                <p>• Use separate From/To layer filters to control rows and columns independently</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Click outside to close dropdowns - add this near the end of the return statement */}
      {Object.values(showDropdowns).some(Boolean) && <div className="fixed inset-0 z-0" onClick={() => setShowDropdowns({})} />}
    </div>
  );
};

export default AppMatrix;

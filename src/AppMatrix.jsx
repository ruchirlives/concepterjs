import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { manyChildren, setPosition } from "./api";
import { useAppContext } from "./AppContext";
import EdgeMenu, { useEdgeMenu } from "./flowEdgeMenu";
import toast from "react-hot-toast";
import StateDropdown from "./StateDropdown";

const AppMatrix = () => {
  const { rowData, edges, layerOptions } = useAppContext();
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

  const inputRef = useRef(null);

  // Setup EdgeMenu hook
  const flowWrapperRef = useRef(null);

  const { menuRef, handleEdgeMenu, onMenuItemClick, hideMenu } = useEdgeMenu(flowWrapperRef, null);

  // Handle state change callback
  const handleStateChange = useCallback((newState) => {
    console.log(`Matrix state changed to: ${newState}`);
  }, []);

  // Hide menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      // If menuRef exists and click is outside the menu, hide it
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        hideMenu();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuRef, hideMenu]);

  // Filter rowData by selected layers for "from" and "to" - only using dropdown filters
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

  // Use manyChildren to get all relationships efficiently
  const loadRelationships = useCallback(async () => {
    // Don't fetch if no data OR if collapsed
    if (combinedFilteredData.length === 0 || collapsed) return;

    setLoading(true);

    try {
      // Extract container IDs from combined filtered data
      const containerIds = combinedFilteredData.map((container) => container.id);

      // Use existing manyChildren API
      const parentChildMap = await manyChildren(containerIds);

      if (!parentChildMap) {
        setRelationships({});
        setLoading(false);
        return;
      }

      // Build relationships map from parent-child data
      const newRelationships = {};
      const newForwardMap = {};
      const newChildrenMap = {};

      // Process the parent-child map (same logic as flowFetchAndCreateEdges.js)
      parentChildMap.forEach(({ container_id, children }) => {
        const parentId = container_id.toString();
        newChildrenMap[parentId] = children.map((c) => c.id.toString());

        children.forEach((child) => {
          const childId = child.id.toString();
          const key = `${parentId}-${childId}`;

          // Extract relationship from position (same as flowFetchAndCreateEdges.js)
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

      // Initialize empty relationships for pairs that don't exist
      for (let i = 0; i < fromLayerFilteredData.length; i++) {
        for (let j = 0; j < toLayerFilteredData.length; j++) {
          const sourceId = fromLayerFilteredData[i].id;
          const targetId = toLayerFilteredData[j].id;
          const key = `${sourceId}-${targetId}`;

          // Only set if not already set from parent-child data
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
      // Initialize empty relationships on error
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

  // Load existing relationships when filtered data changes OR when collapsed state changes
  useEffect(() => {
    loadRelationships();
  }, [loadRelationships]);

  // Additional effect to trigger fetch when expanding with existing data
  useEffect(() => {
    // Only fetch if we have data, not collapsed, and no relationships loaded yet
    if (combinedFilteredData.length > 0 && !collapsed && Object.keys(relationships).length === 0) {
      loadRelationships();
    }
  }, [collapsed, combinedFilteredData.length, relationships, loadRelationships]);

  // Memoize event handlers
  const handleCellClick = useCallback((sourceId, targetId) => {
    if (sourceId === targetId) return;

    const key = `${sourceId}-${targetId}`;
    setEditingCell({ sourceId, targetId, key });
  }, []);

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
      } catch (error) {
        console.error("Error saving relationship:", error);
      }

      setEditingCell(null);
    },
    [editingCell]
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

  // Memoize filtered data based on hideEmpty setting and flipped state
  const { filteredSources, filteredTargets } = useMemo(() => {
    // Apply flipping first to determine which layer filter applies to which axis
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

  const handleExportExcel = useCallback(() => {
    const headers = ["", ...filteredTargets.map((c) => c.Name)];
    const rows = filteredSources.map((source) => {
      const values = [source.Name];
      filteredTargets.forEach((target) => {
        const key = `${source.id}-${target.id}`;
        values.push(relationships[key] || "");
      });
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
  }, [filteredSources, filteredTargets, relationships]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Fix the EmptyState component
  const EmptyState = useMemo(
    () => (
      <div className="bg-white rounded shadow p-4">
        <div onClick={() => setCollapsed((c) => !c)} className="flex justify-between items-center mb-4">
          <span className="font-semibold">Relationship Matrix</span>
          <button className="text-lg font-bold">{collapsed ? "▼" : "▲"}</button>
        </div>
        {!collapsed && (
          <div className="text-gray-500 text-center py-8">No data available. Filter containers in the grid above to populate the matrix.</div>
        )}
      </div>
    ),
    [collapsed]
  );

  if (combinedFilteredData.length === 0) {
    return EmptyState;
  }

  // Color coding for different relationship types
  const getRelationshipColor = (value) => {
    if (!value) return "bg-yellow-50"; // Default for empty relationships
    if (value.includes("parent")) return "bg-blue-50";
    if (value.includes("child")) return "bg-green-50";
    return "bg-yellow-50";
  };

  // Tooltip component
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

  return (
    <div ref={flowWrapperRef} className="bg-white rounded shadow">
      {/* Header with collapse button and controls */}
      <div className="flex justify-between items-center bg-white text-black px-4 py-2 cursor-pointer select-none">
        <div className="flex items-center gap-4">
          <span className="font-semibold">
            Relationship Matrix ({filteredSources.length}×{filteredTargets.length} of {rowData.length} containers)
          </span>

          {/* State Management Dropdown - simplified props */}
          <StateDropdown onStateChange={handleStateChange} />

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
                      </tr>
                    </thead>
                    <tbody>
                      {/* Only show filtered containers as rows */}
                      {filteredSources.map((sourceContainer) => (
                        <tr key={sourceContainer.id}>
                          {/* Row header */}
                          <th
                            className={`sticky left-0 z-10 p-2 border border-gray-300 text-xs font-medium text-left truncate whitespace-nowrap min-w-30 max-w-30 w-30 bg-gray-100 ${
                              hoveredFrom && childrenMap[hoveredFrom]?.includes(sourceContainer.id.toString())
                                ? "bg-yellow-100"
                                : hoveredRowId === sourceContainer.id.toString()
                                ? "bg-yellow-200"
                                : ""
                            }`}
                            onMouseEnter={() => {
                              setHoveredFrom(sourceContainer.id.toString());
                              setHoveredRowId(sourceContainer.id.toString()); // Also highlight when hovering row header itself
                            }}
                            onMouseLeave={() => {
                              setHoveredFrom(null);
                              setHoveredRowId(null); // Remove highlight when leaving row header
                            }}
                          >
                            <div title={sourceContainer.Name} className="whitespace-normal text-xs">
                              {sourceContainer.Name}
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
    </div>
  );
};

export default AppMatrix;

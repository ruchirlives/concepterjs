import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { manyChildren, setPosition } from "./api";
import { useAppContext } from "./AppContext";
import EdgeMenu, { useEdgeMenu } from "./flowEdgeMenu"; // Import EdgeMenu and useEdgeMenu
import toast from "react-hot-toast";

const AppMatrix = () => {
  const { rows: rowData } = useAppContext();
  const [relationships, setRelationships] = useState({});
  const [forwardExists, setForwardExists] = useState({});
  const [loading, setLoading] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [collapsed, setCollapsed] = useState(true);
  const [hideEmpty, setHideEmpty] = useState(true); // New state for hiding empty rows/columns
  const [hoveredCell, setHoveredCell] = useState(null); // Track hovered cell
  const inputRef = useRef(null);

  // Setup EdgeMenu hook
  const flowWrapperRef = useRef(null);
  const { menuRef, handleEdgeMenu, onMenuItemClick, hideMenu } = useEdgeMenu(flowWrapperRef, null);

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

  // Use manyChildren to get all relationships efficiently
  const loadRelationships = useCallback(async () => {
    // Don't fetch if no data OR if collapsed
    if (rowData.length === 0 || collapsed) return;

    setLoading(true);

    try {
      // Extract container IDs (same as flowFetchAndCreateEdges.js)
      const containerIds = rowData.map((container) => container.id);

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

      // Process the parent-child map (same logic as flowFetchAndCreateEdges.js)
      parentChildMap.forEach(({ container_id, children }) => {
        const parentId = container_id.toString();

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
      for (let i = 0; i < rowData.length; i++) {
        for (let j = 0; j < rowData.length; j++) {
          if (i !== j) {
            const sourceId = rowData[i].id;
            const targetId = rowData[j].id;
            const key = `${sourceId}-${targetId}`;

            // Only set if not already set from parent-child data
            if (!(key in newRelationships)) {
              newRelationships[key] = "";
            }
          }
        }
      }

      setRelationships(newRelationships);
      setForwardExists(newForwardMap);
    } catch (error) {
      console.error("Error loading relationships:", error);
      // Initialize empty relationships on error
      const newRelationships = {};
      for (let i = 0; i < rowData.length; i++) {
        for (let j = 0; j < rowData.length; j++) {
          if (i !== j) {
            const sourceId = rowData[i].id;
            const targetId = rowData[j].id;
            const key = `${sourceId}-${targetId}`;
            newRelationships[key] = "";
          }
        }
      }
      setRelationships(newRelationships);
      setForwardExists({});
    }

    setLoading(false);
  }, [rowData, collapsed]); // Add collapsed to dependencies

  // Load existing relationships when rowData changes OR when collapsed state changes
  useEffect(() => {
    loadRelationships();
  }, [loadRelationships]);

  // Additional effect to trigger fetch when expanding with existing data
  useEffect(() => {
    // Only fetch if we have data, not collapsed, and no relationships loaded yet
    if (rowData.length > 0 && !collapsed && Object.keys(relationships).length === 0) {
      loadRelationships();
    }
  }, [collapsed, rowData.length, relationships, loadRelationships]);

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

  // Memoize filtered data based on hideEmpty setting
  const { filteredSources, filteredTargets } = useMemo(() => {
    if (!hideEmpty || rowData.length === 0) {
      return { filteredSources: rowData, filteredTargets: rowData };
    }

    const sources = new Set();
    const targets = new Set();

    rowData.forEach((source) => {
      rowData.forEach((target) => {
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
      filteredSources: rowData.filter((c) => sources.has(c.id)),
      filteredTargets: rowData.filter((c) => targets.has(c.id)),
    };
  }, [rowData, forwardExists, hideEmpty]);

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
        <div className="text-xs mb-2 overflow-y-auto max-h-40 whitespace-pre-wrap font-mono">
          {tsv}
        </div>
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
          <button className="text-lg font-bold">
            {collapsed ? "▼" : "▲"}
          </button>
        </div>
        {!collapsed && (
          <div className="text-gray-500 text-center py-8">No data available. Filter containers in the grid above to populate the matrix.</div>
        )}
      </div>
    ),
    [collapsed] // ✅ useMemo uses dependency array correctly
  );

  if (rowData.length === 0) {
    return EmptyState;
  }

  // Color coding for different relationship types
  const getRelationshipColor = (value) => {
    if (!value) return "bg-white";
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
      {/* Header with collapse button and hide empty toggle */}
      <div className="flex justify-between items-center bg-white text-black px-4 py-2 cursor-pointer select-none">
        <div className="flex items-center gap-4">
          <span className="font-semibold">
            Relationship Matrix ({filteredSources.length} of {rowData.length} containers)
          </span>

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
                <div className="overflow-auto w-full h-full" style={{ maxHeight: "600px" }}>
                  <table className="border-collapse w-full">
                    <thead className="sticky top-0 z-20">
                      <tr>
                        {/* Top-left corner cell */}
                        <th className="sticky left-0 z-30 p-2 bg-gray-100 border border-gray-300 text-xs font-medium text-center min-w-[120px] max-w-[120px]">
                          <div className="w-0 h-0 border-l-[50px] border-l-transparent border-b-[30px] border-b-gray-400 relative">
                            <span className="absolute -bottom-6 -left-12 text-xs">From</span>
                            <span className="absolute -bottom-2 left-2 text-xs">To</span>
                          </div>
                        </th>
                        {/* Column headers - only show filtered containers */}
                        {filteredTargets.map((container) => (
                          <th
                            key={container.id}
                            className="p-2 bg-gray-100 border border-gray-300 text-xs font-medium text-center min-w-[100px] max-w-[100px] truncate whitespace-nowrap"
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
                          <th className="sticky left-0 z-10 p-2 bg-gray-100 border border-gray-300 text-xs font-medium text-center min-w-[120px] max-w-[120px] truncate whitespace-nowrap">
                            <div title={sourceContainer.Name}>{sourceContainer.Name}</div>
                          </th>
                          {/* Data cells - only show filtered containers as columns */}
                          {filteredTargets.map((targetContainer) => {
                            const key = `${sourceContainer.id}-${targetContainer.id}`;
                            const isEditing = editingCell?.key === key;
                            const value = relationships[key] || "";
                            const isDiagonal = sourceContainer.id === targetContainer.id;

                            if (isDiagonal) {
                              return (
                                <td key={key} className="p-2 bg-gray-200 border border-gray-300 text-center min-w-[100px] max-w-[100px]">
                                  —
                                </td>
                              );
                            }

                            // Construct a minimal edge object for useEdgeMenu
                            const edge = { id: key, source: sourceContainer.id, target: targetContainer.id };

                            return (
                              <td
                                key={key}
                                className={`p-1 border border-gray-300 text-center min-w-[100px] max-w-[200px] cursor-pointer hover:bg-gray-50 ${getRelationshipColor(value)}`}
                                onClick={() => handleCellClick(sourceContainer.id, targetContainer.id)}
                                onContextMenu={(e) => handleEdgeMenu(e, edge)}
                                onMouseEnter={(e) => {
                                  if (value) {
                                    const rect = e.target.getBoundingClientRect();
                                    setHoveredCell({
                                      key,
                                      text: value,
                                      position: { x: rect.left, y: rect.top },
                                    });
                                  }
                                }}
                                onMouseLeave={() => setHoveredCell(null)}
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
                                  <span className="text-xs block whitespace-pre-line break-words">
                                    {value || "—"}
                                  </span>
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
                    edges={filteredSources.map((source) =>
                      filteredTargets.map((target) => ({
                        id: `${source.id}-${target.id}`,
                        source: source.id,
                        target: target.id,
                      }))
                    ).flat()}
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
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppMatrix;

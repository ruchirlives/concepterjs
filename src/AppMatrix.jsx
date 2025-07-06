import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { manyChildren, setPosition } from "./api";
import { useAppContext } from "./AppContext";

const AppMatrix = () => {
  const { rows: rowData } = useAppContext();
  const [relationships, setRelationships] = useState({});
  const [loading, setLoading] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [collapsed, setCollapsed] = useState(true);
  const [hideEmpty, setHideEmpty] = useState(true); // New state for hiding empty rows/columns
  const inputRef = useRef(null);

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

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Memoize filtered data based on hideEmpty setting
  const filteredRowData = useMemo(() => {
    if (!hideEmpty || rowData.length === 0) {
      return rowData;
    }

    // Find containers that have at least one non-empty relationship (as source or target)
    const containersWithRelationships = new Set();

    rowData.forEach((sourceContainer) => {
      rowData.forEach((targetContainer) => {
        if (sourceContainer.id !== targetContainer.id) {
          const key = `${sourceContainer.id}-${targetContainer.id}`;
          const reverseKey = `${targetContainer.id}-${sourceContainer.id}`;

          // Safe check for non-empty relationships
          const hasForwardRelationship = relationships[key] && typeof relationships[key] === "string" && relationships[key].trim() !== "";

          const hasReverseRelationship =
            relationships[reverseKey] && typeof relationships[reverseKey] === "string" && relationships[reverseKey].trim() !== "";

          if (hasForwardRelationship || hasReverseRelationship) {
            containersWithRelationships.add(sourceContainer.id);
            containersWithRelationships.add(targetContainer.id);
          }
        }
      });
    });

    return rowData.filter((container) => containersWithRelationships.has(container.id));
  }, [rowData, relationships, hideEmpty]);

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

  return (
    <div className="bg-white rounded shadow">
      {/* Header with collapse button and hide empty toggle */}
      <div className="flex justify-between items-center bg-white text-black px-4 py-2 cursor-pointer select-none">
        <div className="flex items-center gap-4">
          <span className="font-semibold">
            Relationship Matrix ({filteredRowData.length} of {rowData.length} containers)
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
        </div>

        <button className="text-lg font-bold" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "Expand matrix" : "Collapse matrix"}>
          {collapsed ? "▼" : "▲"}
        </button>
      </div>

      {/* Matrix content */}
      <div className={`transition-all duration-300 overflow-auto`} style={{ height: collapsed ? 0 : 400 }}>
        <div className="h-full flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-500">Loading relationships...</div>
            </div>
          ) : (
            <>
              {/* Table container with freeze panes */}
              <div className="flex-1 m-4 mb-0 border border-gray-300 relative overflow-auto">
                <div className="overflow-auto w-full h-full" style={{ maxHeight: "300px" }}>
                  <table className="border-collapse w-full">
                    {/* Sticky header row */}
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
                        {filteredRowData.map((container) => (
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
                      {filteredRowData.map((sourceContainer) => (
                        <tr key={sourceContainer.id}>
                          {/* Row header */}
                          <th className="sticky left-0 z-10 p-2 bg-gray-100 border border-gray-300 text-xs font-medium text-center min-w-[120px] max-w-[120px] truncate whitespace-nowrap">
                            <div title={sourceContainer.Name}>{sourceContainer.Name}</div>
                          </th>
                          {/* Data cells - only show filtered containers as columns */}
                          {filteredRowData.map((targetContainer) => {
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

                            return (
                              <td
                                key={key}
                                className={`p-1 border border-gray-300 text-center min-w-[100px] max-w-[100px] cursor-pointer hover:bg-gray-50 ${getRelationshipColor(
                                  value
                                )}`}
                                onClick={() => handleCellClick(sourceContainer.id, targetContainer.id)}
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
                                  <span className="text-xs block truncate" title={value}>
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

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAppContext } from "./AppContext";
import { handleWriteBack, requestRefreshChannel } from "./hooks/effectsShared";
import ModalAddRow from "./components/ModalAddRow";
import { ContextMenu, useMenuHandlers } from "./hooks/useContextMenu";
import { setPosition } from "./api";

// Excel export button
function ExcelButton({ handleExportExcel }) {
  return (
    <button
      className="px-3 py-1 text-xs rounded bg-green-500 text-white hover:bg-green-600"
      onClick={handleExportExcel}
      title="Export current view to Excel"
    >
      Export to Excel
    </button>
  );
}

const AppLayers = () => {
  const {
    layerOptions,
    addLayer,
    removeLayer,
    activeLayers,
    toggleLayer,
    rowData,
    setRowData,
    selectedContentLayer, // <-- get from context
    setSelectedContentLayer, // <-- get from context
    layerOrdering,
    updateLayerOrderingForLayer,
    parentChildMap,
  } = useAppContext();
  const [collapsed, setCollapsed] = useState(false);
  const [newLayer, setNewLayer] = useState("");
  const [dragItem, setDragItem] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [dragLine, setDragLine] = useState(null);
  const dragSourceRef = useRef(null);
  const rafIdRef = useRef(null);
  const activeMouseHandlersRef = useRef({ move: null, up: null });
  const [highlightedChildren, setHighlightedChildren] = useState(() => new Set());

  // Modal state for adding a row
  const [modalOpen, setModalOpen] = useState(false);

  // Extract tags from rowData and add as layers, but only when not collapsed
  useEffect(() => {
    if (!rowData) return;
    const tagSet = new Set();
    rowData.forEach((row) => {
      if (row.Tags) {
        row.Tags.split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
          .forEach((tag) => tagSet.add(tag));
      }
    });
    tagSet.forEach((tag) => {
      if (!layerOptions.includes(tag)) {
        addLayer(tag);
      }
    });
    // eslint-disable-next-line
  }, [rowData, collapsed]);

  const handleAdd = () => {
    const name = newLayer.trim();
    console.log("Adding layer:", name);
    if (name) {
      addLayer(name);
      setNewLayer("");
    }
  };

  // Compute containers by layer and items with no layer
  const { containersByLayer, noLayerItems } = useMemo(() => {
    const map = {};
    layerOptions.forEach((layer) => {
      map[layer] = [];
    });
    const noLayer = [];
    rowData.forEach((row) => {
      const tags = (row.Tags || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      let found = false;
      tags.forEach((tag) => {
        if (map[tag]) {
          map[tag].push(row);
          found = true;
        }
      });
      if (!found) noLayer.push(row);
    });
    Object.keys(map).forEach((layer) => {
      const ordering = Array.isArray(layerOrdering?.[layer]) ? layerOrdering[layer] : [];
      if (ordering.length === 0) {
        map[layer].sort((a, b) => {
          const nameA = (a.Name || "").toLowerCase();
          const nameB = (b.Name || "").toLowerCase();
          if (nameA < nameB) return -1;
          if (nameA > nameB) return 1;
          return 0;
        });
        return;
      }
      const orderIndex = new Map(ordering.map((id, index) => [id, index]));
      map[layer].sort((a, b) => {
        const idA = a?.id != null ? a.id.toString() : "";
        const idB = b?.id != null ? b.id.toString() : "";
        const idxA = orderIndex.has(idA) ? orderIndex.get(idA) : Number.POSITIVE_INFINITY;
        const idxB = orderIndex.has(idB) ? orderIndex.get(idB) : Number.POSITIVE_INFINITY;
        if (idxA !== idxB) return idxA - idxB;
        const nameA = (a.Name || "").toLowerCase();
        const nameB = (b.Name || "").toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });
    });
    return { containersByLayer: map, noLayerItems: noLayer };
  }, [layerOptions, layerOrdering, rowData]);

  const relationships = useMemo(() => {
    const map = {};
    if (!Array.isArray(parentChildMap)) {
      return map;
    }
    parentChildMap.forEach((entry) => {
      if (!entry) return;
      const parentId = entry.container_id != null ? entry.container_id.toString() : null;
      if (!parentId || !Array.isArray(entry.children)) return;
      entry.children.forEach((child) => {
        if (!child) return;
        const childId = child.id != null ? child.id.toString() : null;
        if (!childId) return;
        const label = typeof child.label === "string"
          ? child.label
          : (child.position && typeof child.position.label === "string" ? child.position.label : "");
        map[`${parentId}--${childId}`] = label;
      });
    });
    return map;
  }, [parentChildMap]);

  const childIdsByParent = useMemo(() => {
    const lookup = {};
    if (!Array.isArray(parentChildMap)) {
      return lookup;
    }
    parentChildMap.forEach((entry) => {
      const parentId = entry?.container_id != null ? entry.container_id.toString() : null;
      if (!parentId) return;
      const ids = (entry.children || [])
        .map((child) => (child?.id != null ? child.id.toString() : null))
        .filter(Boolean);
      if (ids.length > 0) {
        lookup[parentId] = ids;
      }
    });
    return lookup;
  }, [parentChildMap]);

  const linkItems = useCallback(async (sourceId, targetId) => {
    if (sourceId == null || targetId == null) return;
    const source = sourceId.toString();
    const target = targetId.toString();
    if (!source || !target || source === target) return;
    const key = `${source}--${target}`;
    const currentLabel = relationships[key] ?? "";
    const newLabel = prompt("Enter new label:", currentLabel || "");
    if (newLabel === null) return;
    try {
      const response = await setPosition(source, target, newLabel);
      if (response) {
        requestRefreshChannel();
      }
    } catch (error) {
      console.error("Failed to link items:", error);
    }
  }, [relationships]);

  const beginCtrlLink = useCallback(({ logicalId, startPosition }) => {
    if (!logicalId) {
      setHighlightedChildren(new Set());
      return;
    }

    const existingHandlers = activeMouseHandlersRef.current || {};
    if (existingHandlers.move) window.removeEventListener("mousemove", existingHandlers.move);
    if (existingHandlers.up) window.removeEventListener("mouseup", existingHandlers.up);
    activeMouseHandlersRef.current = { move: null, up: null };

    dragSourceRef.current = logicalId;
    const childIds = childIdsByParent[logicalId] || [];
    setHighlightedChildren(new Set(childIds));

    const resolveStart = () => {
      if (startPosition && Number.isFinite(startPosition.x) && Number.isFinite(startPosition.y)) {
        return startPosition;
      }
      return null;
    };

    const initial = resolveStart();
    if (!initial) return;
    setDragLine({ from: initial, to: initial });

    const handleMouseMove = (event) => {
      if (rafIdRef.current != null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        setDragLine((line) =>
          line ? { ...line, to: { x: event.clientX, y: event.clientY } } : line
        );
        rafIdRef.current = null;
      });
    };

    const handleMouseUp = async (event) => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      activeMouseHandlersRef.current = { move: null, up: null };

      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      setDragLine(null);

      const sourceId = dragSourceRef.current;
      dragSourceRef.current = null;
      setHighlightedChildren(new Set());
      if (!sourceId) return;

      const element = document.elementFromPoint(event.clientX, event.clientY);
      const targetItem = element?.closest?.("[data-layer-item-id]");
      if (!targetItem) return;

      const targetId = targetItem.dataset.layerItemId;
      if (!targetId || targetId === sourceId) return;

      await linkItems(sourceId, targetId);
    };

    activeMouseHandlersRef.current = { move: handleMouseMove, up: handleMouseUp };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [childIdsByParent, linkItems]);

  useEffect(() => {
    return () => {
      const handlers = activeMouseHandlersRef.current || {};
      if (handlers.move) window.removeEventListener("mousemove", handlers.move);
      if (handlers.up) window.removeEventListener("mouseup", handlers.up);
      activeMouseHandlersRef.current = { move: null, up: null };
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      dragSourceRef.current = null;
      setHighlightedChildren(new Set());
    };
  }, []);

  const handleCtrlMouseDown = useCallback((row, event) => {
    if (!event?.ctrlKey) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.nativeEvent && typeof event.nativeEvent.stopImmediatePropagation === "function") {
      event.nativeEvent.stopImmediatePropagation();
    }
    setDragItem(null);
    const rect = event.currentTarget.getBoundingClientRect();
    const startPosition = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    const logicalId = row?.id != null ? row.id.toString() : null;
    beginCtrlLink({ logicalId, startPosition });
  }, [beginCtrlLink]);

  const moveItemWithinLayer = useCallback((layer, itemId, beforeId = null) => {
    if (!layer || itemId == null) return;
    const normalizedId = itemId.toString();
    const normalizedBefore = beforeId != null ? beforeId.toString() : null;
    updateLayerOrderingForLayer(layer, (order) => {
      const withoutItem = order.filter((id) => id !== normalizedId);
      if (!normalizedBefore) {
        return [...withoutItem, normalizedId];
      }
      const insertionIndex = withoutItem.indexOf(normalizedBefore);
      if (insertionIndex === -1) {
        return [...withoutItem, normalizedId];
      }
      const next = [...withoutItem];
      next.splice(insertionIndex, 0, normalizedId);
      return next;
    });
  }, [updateLayerOrderingForLayer]);

  const handleDrop = (layer, { beforeId = null } = {}) => {
    if (!dragItem) return;
    const { cid } = dragItem;
    if (!cid) {
      setDragItem(null);
      return;
    }

    setRowData((prev) => {
      let mutated = false;
      const updated = prev.map((row) => {
        if (row.id.toString() !== cid) return row;
        const tags = (row.Tags || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        if (!tags.includes(layer)) {
          tags.push(layer);
          mutated = true;
          return { ...row, Tags: tags.join(", ") };
        }
        return row;
      });
      if (!mutated) return prev;
      handleWriteBack(updated);
      return updated;
    });

    const normalizedBefore = beforeId != null ? beforeId.toString() : null;
    if (!normalizedBefore || normalizedBefore !== cid.toString()) {
      moveItemWithinLayer(layer, cid, normalizedBefore);
    }
    setDragItem(null);
  };

  // Handle double click to open modal for adding a row to a layer
  const handleCellDoubleClick = (layer) => {
    setSelectedContentLayer(layer); // <-- set context value
    setModalOpen(true);
  };

  // When a new row is added via modal, ensure it gets the correct layer tag
  const handleModalSelect = async (newRows) => {
    if (!selectedContentLayer || !newRows || !newRows.length) return;
    setRowData((prev) => {
      const updated = prev.map((row) => {
        if (!newRows.some((nr) => nr.id === row.id)) return row;
        // Ensure the new row has the selectedContentLayer in its Tags
        const tags = (row.Tags || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        if (!tags.includes(selectedContentLayer)) tags.push(selectedContentLayer);
        return { ...row, Tags: tags.join(", ") };
      });
      handleWriteBack(updated);
      return updated;
    });
  };

  // Add a handler to remove all tags from a row (move to "No Layer")
  const handleRemoveAllLayers = (cid) => {
    setRowData((prev) => {
      const updated = prev.map((row) => {
        if (row.id.toString() !== cid) return row;
        return { ...row, Tags: "" };
      });
      handleWriteBack(updated);
      return updated;
    });
  };

  // Export assign table to Excel/TSV
  const handleExportExcel = () => {
    // Headers: all layers, then "No Layer"
    const headers = [...layerOptions, "No Layer"];
    // For each column, join all item names with \n, wrap in quotes if not empty
    const row = [
      ...layerOptions.map((layer) => {
        const items = containersByLayer[layer] || [];
        const namesRaw = items.map((r) => r.Name).join("\n");
        return namesRaw ? `"${namesRaw}"` : "";
      }),
      (() => {
        const namesRaw = noLayerItems.map((r) => r.Name).join("\n");
        return namesRaw ? `"${namesRaw}"` : "";
      })(),
    ];
    const tsv = [headers.join("\t"), row.join("\t")].join("\n");

    // Copy to clipboard or alert
    if (navigator && navigator.clipboard) {
      navigator.clipboard.writeText(tsv);
      alert("Layer assignment table copied to clipboard as TSV!");
    } else {
      alert(tsv);
    }
  };

  const removeChildFromLayer = removeFromLayer(setRowData);

  const menuHandlers = useMenuHandlers({
    rowData,
    setRowData,
    removeChildFromLayer,
    flipped: false, // AppLayers doesn't use flipped
    childrenMap: {}, // Not needed here
  });

  const layerMenuOptions = [
    { label: "Remove from Layer", onClick: menuHandlers.handleRemoveLayer },
    { label: "Select", onClick: menuHandlers.handleSelect },
    { label: "Export", submenu: menuHandlers.exportMenu }, // <-- use submenu
  ];

  return (
    <>
      {dragLine && (
        <svg
          style={{
            position: "fixed",
            pointerEvents: "none",
            left: 0,
            top: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 1000,
          }}
        >
          <line
            x1={dragLine.from.x}
            y1={dragLine.from.y}
            x2={dragLine.to.x}
            y2={dragLine.to.y}
            stroke="red"
            strokeWidth="2"
          />
        </svg>
      )}
      <div className="bg-white rounded shadow">
      {/* Layers panel */}
      <div
        onClick={() => setCollapsed((c) => !c)}
        className="flex justify-between items-center bg-white text-black px-4 py-2 cursor-pointer select-none"
      >
        <span className="font-semibold">Layers</span>
        <button className="text-lg font-bold">{collapsed ? "▼" : "▲"}</button>
      </div>
      <div
        className={`transition-all duration-300 overflow-auto`}
        style={{ height: collapsed ? 0 : "auto" }}
      >
        <div className="p-4 space-y-2" onMouseDown={(e) => e.stopPropagation()}>
          <div className="flex space-x-2" onMouseDown={(e) => e.stopPropagation()}>
            <input
              className="border rounded px-2 py-1 text-sm flex-grow"
              type="text"
              value={newLayer}
              onChange={(e) => setNewLayer(e.target.value)}
              placeholder="New layer name"
            />
            <button
              onClick={handleAdd}
              onMouseDown={(e) => e.stopPropagation()}
              className="bg-blue-600 text-white text-sm px-2 py-1 rounded"
            >
              Add
            </button>
            <div onMouseDown={(e) => e.stopPropagation()}>
              <ExcelButton handleExportExcel={handleExportExcel} />
            </div>
          </div>
        </div>
        {/* Layer assignment table with checkboxes in headers and "No Layer" column */}
        <div className="p-4 pt-0">
          <div className="font-semibold mb-2 text-sm">
            Assign Containers to Layers
          </div>
          <table className="table-auto border-collapse border border-gray-300 w-full">
            <thead>
              <tr>
                {layerOptions.map((layer) => (
                  <th
                    key={layer}
                    className="sticky top-0 bg-gray-100 p-2 border border-gray-300 text-xs text-left"
                  >
                    <div className="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={activeLayers.includes(layer)}
                        onChange={() => toggleLayer(layer)}
                        className="h-3 w-3"
                        title="Toggle layer visibility"
                      />
                      <span>{layer}</span>
                      <button
                        onClick={() => removeLayer(layer)}
                        className="ml-1 text-red-500 text-xs"
                        title="Delete layer"
                        tabIndex={-1}
                        style={{ lineHeight: 1 }}
                      >
                        ×
                      </button>
                    </div>
                  </th>
                ))}
                <th
                  className="sticky top-0 bg-gray-100 p-2 border border-gray-300 text-xs text-left"
                  key="no-layer"
                >
                  <span className="font-semibold text-gray-600">No Layer</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {layerOptions.map((layer) => {
                  const items = containersByLayer[layer] || [];
                  return (
                    <td
                      key={layer}
                      className="p-2 border border-gray-300 align-top min-w-30 max-w-30 w-30"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(layer)}
                      onDoubleClick={() => handleCellDoubleClick(layer)}
                      style={{ cursor: "pointer" }}
                      title="Double-click to add a container to this layer"
                    >
                      {items.length > 0 ? (
                        <ul className="text-xs space-y-1">
                          {items.map((row) => {
                            const rowId = row?.id != null ? row.id.toString() : "";
                            const isHighlighted = highlightedChildren.has(rowId);
                            return (
                              <li
                                key={row.id}
                                draggable
                                data-layer-item-id={rowId}
                                onMouseDown={(e) => handleCtrlMouseDown(row, e)}
                                onDragStart={(e) => {
                                  if (e?.ctrlKey) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    return;
                                  }
                                  if (e?.dataTransfer) {
                                    e.dataTransfer.effectAllowed = "move";
                                  }
                                  setDragItem({ cid: rowId, layer });
                                }}
                                onDragOver={(e) => {
                                  if (!dragItem) return;
                                  if (dragItem.cid === rowId) return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (e?.dataTransfer) {
                                    e.dataTransfer.dropEffect = "move";
                                  }
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDrop(layer, { beforeId: rowId });
                                }}
                                onDragEnd={() => setDragItem(null)}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setContextMenu({
                                    x: e.clientX,
                                    y: e.clientY,
                                    layer,
                                    cid: rowId,
                                  });
                                }}
                                className={`px-2 py-1 rounded transition-colors ${isHighlighted ? "bg-yellow-200 border border-yellow-400" : ""}`}
                              >
                                {row.Name}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  );
                })}
                <td
                  key="no-layer"
                  className="p-2 border border-gray-300 align-top min-w-30 max-w-30 w-30 bg-gray-50"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (!dragItem) return;
                    const { cid } = dragItem;
                    setRowData((prev) => {
                      const updated = prev.map((row) => {
                        if (row.id.toString() !== cid) return row;
                        return { ...row, Tags: "" };
                      });
                      handleWriteBack(updated);
                      return updated;
                    });
                    setDragItem(null);
                  }}
                  onDoubleClick={() => handleCellDoubleClick(null)}
                  style={{ cursor: "pointer" }}
                  title="Double-click to add a container with no layer"
                >
                  {noLayerItems.length > 0 ? (
                    <ul className="text-xs space-y-1">
                      {noLayerItems.map((row) => {
                        const rowId = row?.id != null ? row.id.toString() : "";
                        const isHighlighted = highlightedChildren.has(rowId);
                        return (
                          <li
                            key={row.id}
                            draggable
                            data-layer-item-id={rowId}
                            onMouseDown={(e) => handleCtrlMouseDown(row, e)}
                            onDragStart={(e) => {
                              if (e?.ctrlKey) {
                                e.preventDefault();
                                e.stopPropagation();
                                return;
                              }
                              setDragItem({ cid: rowId, layer: null });
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              // Remove all layers from this row
                              handleRemoveAllLayers(rowId);
                            }}
                            className={`px-2 py-1 rounded transition-colors ${isHighlighted ? "bg-yellow-200 border border-yellow-400" : ""}`}
                          >
                            {row.Name}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <ContextMenu
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        menuOptions={layerMenuOptions}
      />
      {/* Modal for adding a row to a layer */}
      <ModalAddRow
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={handleModalSelect}
        // Remove selectedContentLayer prop, ModalAddRow will get it from context
      />
    </div>
    </>
  );
};

export default AppLayers;

export function removeFromLayer(setRowData) {
  return (layer, cid) => {
    setRowData((prev) => {
      const updated = prev.map((row) => {
        if (row.id.toString() !== cid) return row;
        const tags = (row.Tags || "")
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t && t !== layer);
        return { ...row, Tags: tags.join(", ") };
      });
      // Call writeback after updating
      handleWriteBack(updated);
      return updated;
    });
  };
}

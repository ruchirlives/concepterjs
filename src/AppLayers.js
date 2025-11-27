import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAppContext } from "./AppContext";
import { handleWriteBack, requestRefreshChannel } from "./hooks/effectsShared";
import ModalAddRow from "./components/ModalAddRow";
import { ContextMenu, useMenuHandlers } from "./hooks/useContextMenu";
import { setPosition, layerToContainer } from "./api";
import { getStateSetter } from "./stateSetterRegistry";

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
  const [newLayer, setNewLayer] = useState("");
  const [dragItem, setDragItem] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [headerContextMenu, setHeaderContextMenu] = useState(null);
  const [dragLine, setDragLine] = useState(null);
  const dragSourceRef = useRef(null);
  const rafIdRef = useRef(null);
  const activeMouseHandlersRef = useRef({ move: null, up: null });
  const [highlightedChildren, setHighlightedChildren] = useState(() => new Set());
  const [layerFilterOpen, setLayerFilterOpen] = useState(false);
  const [filteredLayerSelection, setFilteredLayerSelection] = useState([]);
  const layerFilterRef = useRef(null);

  // Modal state for adding a row
  const [modalOpen, setModalOpen] = useState(false);

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
  }, [rowData]);

  const handleAdd = () => {
    const name = newLayer.trim();
    console.log("Adding layer:", name);
    if (name) {
      addLayer(name);
      setNewLayer("");
    }
  };

  useEffect(() => {
    // Drop any selections that no longer exist
    setFilteredLayerSelection((prev) => prev.filter((layer) => layerOptions.includes(layer)));
  }, [layerOptions]);

  useEffect(() => {
    if (!layerFilterOpen) return;
    const handleClickOutside = (event) => {
      if (layerFilterRef.current && !layerFilterRef.current.contains(event.target)) {
        setLayerFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [layerFilterOpen]);

  const displayedLayers = useMemo(() => {
    if (!filteredLayerSelection.length) return layerOptions;
    const selectionSet = new Set(filteredLayerSelection);
    const ordered = layerOptions.filter((layer) => selectionSet.has(layer));
    return ordered.length ? ordered : layerOptions;
  }, [filteredLayerSelection, layerOptions]);

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

  const handleDrop = useCallback((layer, { beforeId = null } = {}) => {
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
  }, [dragItem, moveItemWithinLayer, setRowData]);

  // Handle double click to open modal for adding a row to a layer
  const handleCellDoubleClick = (layer) => {
    setSelectedContentLayer(layer); // <-- set context value
    setModalOpen(true);
  };

  // When a new row is added via modal, ensure it gets the correct layer tag
  const handleModalSelect = async (newRows) => {
    if (!selectedContentLayer || !Array.isArray(newRows) || newRows.length === 0) {
      return;
    }

    let pendingUpdated = null;
    setRowData((prev) => {
      let mutated = false;
      const updated = prev.map((row) => {
        if (!newRows.some((nr) => nr.id === row.id)) return row;
        const tags = (row.Tags || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        if (tags.includes(selectedContentLayer)) return row;
        mutated = true;
        return { ...row, Tags: [...tags, selectedContentLayer].join(", ") };
      });

      if (!mutated) {
        pendingUpdated = null;
        return prev;
      }

      pendingUpdated = updated;
      return updated;
    });

    if (pendingUpdated) {
      await handleWriteBack(pendingUpdated);
      requestRefreshChannel();
    }
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

  const renderLayerItems = useCallback(
    (layer) => {
      const items = containersByLayer[layer] || [];
      if (items.length === 0) {
        return <span className="text-xs text-gray-400">�?"</span>;
      }
      return (
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
                className={`px-2 py-1 rounded transition-colors ${
                  isHighlighted ? "bg-yellow-200 border border-yellow-400" : ""
                }`}
              >
                {row.Name}
              </li>
            );
          })}
        </ul>
      );
    },
    [containersByLayer, highlightedChildren, dragItem, handleCtrlMouseDown, handleDrop, setContextMenu]
  );

  const handleLayerFilterToggle = useCallback((layer) => {
    if (!layer) return;
    setFilteredLayerSelection((prev) => {
      if (prev.includes(layer)) {
        return prev.filter((name) => name !== layer);
      }
      return [...prev, layer];
    });
  }, []);

  const handleResetLayerFilters = useCallback(() => {
    setFilteredLayerSelection([]);
  }, []);

  const handleDeleteLayer = useCallback(async (layer) => {
    if (!layer) return;
    let pendingUpdated = null;
    setRowData((prev) => {
      let mutated = false;
      const updated = prev.map((row) => {
        const tags = (row.Tags || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        if (!tags.includes(layer)) return row;
        mutated = true;
        const filtered = tags.filter((tag) => tag !== layer);
        return { ...row, Tags: filtered.join(", ") };
      });
      if (!mutated) {
        pendingUpdated = null;
        return prev;
      }
      pendingUpdated = updated;
      return updated;
    });

    if (pendingUpdated) {
      await handleWriteBack(pendingUpdated);
      requestRefreshChannel();
    }
    removeLayer(layer);
    setFilteredLayerSelection((prev) => prev.filter((name) => name !== layer));
  }, [setRowData, removeLayer, ]);

  const menuHandlers = useMenuHandlers({
    rowData,
    setRowData,
    removeChildFromLayer,
    flipped: false, // AppLayers doesn't use flipped
    childrenMap: {}, // Not needed here
  });

  const clearLayerForAll = useCallback(async (layer) => {
    if (!layer) return;
    let pendingUpdated = null;
    setRowData((prev) => {
      let mutated = false;
      const updated = prev.map((row) => {
        const tags = (row.Tags || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        if (!tags.includes(layer)) return row;
        const filtered = tags.filter((tag) => tag !== layer);
        mutated = true;
        return { ...row, Tags: filtered.join(", ") };
      });
      if (!mutated) {
        pendingUpdated = null;
        return prev;
      }
      pendingUpdated = updated;
      return updated;
    });

    if (pendingUpdated) {
      await handleWriteBack(pendingUpdated);
      requestRefreshChannel();
    }

    updateLayerOrderingForLayer(layer, () => []);
  }, [setRowData, updateLayerOrderingForLayer, ]);

  const headerMenuOptions = [
    {
      label: "Clear layer",
      onClick: async (context) => {
        const { layer } = context;
        if (!layer) return;
        await clearLayerForAll(layer);
      },
    },
    // convert layer to container option
    {
      label: "Convert layer to container",
      onClick: async (context) => {
        const { layer } = context;
        if (!layer) return;
        const confirmMsg = `Are you sure you want to convert layer "${layer}" to a container? This will create a new container with the same name as the layer and parent the layer's containers to it. This action cannot be undone.`;
        if (!window.confirm(confirmMsg)) return;
        // Call API 
        try {
          const response = await layerToContainer(layer);
          if (response) {
            requestRefreshChannel();
          }
        } catch (error) {
          console.error("Error converting layer to container:", error);
        }
      }
    },
    {
      label: "Rename layer",
      onClick: async (context) => {
        const { layer } = context;
        if (!layer) return;
        const nextName = prompt("Rename layer:", layer);
        if (!nextName) return;
        const trimmed = nextName.trim();
        if (!trimmed || trimmed === layer) return;

        // Prevent duplicate names
        if (layerOptions.includes(trimmed)) {
          alert("Layer name already exists.");
          return;
        }

        const layerOptionsSetter = getStateSetter("layerOptions");
        const activeLayersSetter = getStateSetter("activeLayers");

        const wasActive = activeLayers.includes(layer);
        const layerIndex = layerOptions.indexOf(layer);

        let pendingRenamedRows = null;
        setRowData((prev) => {
          let mutated = false;
          const updated = prev.map((row) => {
            const tags = (row.Tags || "")
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);

            if (!tags.includes(layer)) return row;

            mutated = true;
            const nextTags = tags.map((tag) => (tag === layer ? trimmed : tag));
            return { ...row, Tags: nextTags.join(", ") };
          });

          if (!mutated) {
            pendingRenamedRows = null;
            return prev;
          }

          pendingRenamedRows = updated;
          return updated;
        });

        if (pendingRenamedRows) {
          await handleWriteBack(pendingRenamedRows);
          requestRefreshChannel();
        }

        if (typeof layerOptionsSetter === "function") {
          layerOptionsSetter((prev) => {
            const withoutNew = prev.filter((name) => name !== trimmed);
            const next = withoutNew.map((name) => (name === layer ? trimmed : name));
            if (!next.includes(trimmed)) {
              if (layerIndex >= 0 && layerIndex <= next.length) {
                next.splice(layerIndex, 0, trimmed);
              } else {
                next.push(trimmed);
              }
            }
            return next;
          });
        }

        updateLayerOrderingForLayer(trimmed, () => {
          const existing = Array.isArray(layerOrdering?.[layer]) ? layerOrdering[layer] : [];
          return [...existing];
        });
        updateLayerOrderingForLayer(layer, () => []);

        if (typeof activeLayersSetter === "function") {
          activeLayersSetter((prev) => {
            const next = prev.filter((name) => name !== layer && name !== trimmed);
            if (wasActive) {
              next.push(trimmed);
            }
            return next;
          });
        }
      },
    },
  ];

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
          className="flex justify-between items-center bg-white text-black px-4 py-2 cursor-pointer select-none"
        >
          <span className="font-semibold">Layers</span>
        </div>
        </div>
        <div
          className={`transition-all duration-300 overflow-auto`}
          style={{ height: "auto" }}
        >
          <div className="p-4 space-y-2" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex space-x-2 flex-wrap items-center" onMouseDown={(e) => e.stopPropagation()}>
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
              <div className="relative" ref={layerFilterRef}>
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => setLayerFilterOpen((open) => !open)}
                  className="bg-gray-100 text-gray-800 text-sm px-2 py-1 rounded border border-gray-300"
                  title="Choose which layers are shown"
                >
                  Layer Filter
                </button>
                {layerFilterOpen && (
                  <div
                    className="absolute right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg p-2 w-48 z-50"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-600">Visible Layers</span>
                      <button
                        className="text-xs text-blue-600 hover:underline"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleResetLayerFilters();
                        }}
                      >
                        Show All
                      </button>
                    </div>
                    {filteredLayerSelection.length === 0 && layerOptions.length > 0 && (
                      <div className="text-[10px] text-gray-500 mb-1">
                        No filters selected — showing all layers
                      </div>
                    )}
                    <div className="max-h-48 overflow-auto space-y-1">
                      {layerOptions.length === 0 && (
                        <span className="text-xs text-gray-400">No layers available</span>
                      )}
                      {layerOptions.map((layer) => (
                        <label key={layer} className="flex items-center gap-2 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={filteredLayerSelection.includes(layer)}
                            onChange={() => handleLayerFilterToggle(layer)}
                          />
                          <span className="truncate">{layer}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="md:hidden">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              {displayedLayers.map((layer) => (
                <div
                  key={layer}
                  className="border border-gray-300 rounded p-3 bg-white shadow-sm"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(layer)}
                  onDoubleClick={() => handleCellDoubleClick(layer)}
                  title={`Double-click to add a container to ${layer}`}
                >
                  <div
                    className="flex items-center justify-between gap-2"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setHeaderContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        layer,
                      });
                    }}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={activeLayers.includes(layer)}
                        onChange={() => toggleLayer(layer)}
                        className="h-4 w-4"
                        title="Toggle layer visibility"
                      />
                      <span className="text-sm font-medium truncate">{layer}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteLayer(layer)}
                      className="text-red-500 text-xs"
                      title="Delete layer"
                    >
                      �-
                    </button>
                  </div>
                  <div className="mt-2">{renderLayerItems(layer)}</div>
                </div>
              ))}
              <div
                key="no-layer-mobile"
                className="border border-dashed border-gray-300 rounded p-3 bg-gray-50"
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
                title="Double-click to add a container with no layer"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-600">No Layer</span>
                  <button
                    className="text-xs text-blue-600 underline"
                    onClick={() => handleCellDoubleClick(null)}
                  >
                    Add
                  </button>
                </div>
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
                            handleRemoveAllLayers(rowId);
                          }}
                          className={`px-2 py-1 rounded transition-colors ${
                            isHighlighted ? "bg-yellow-200 border border-yellow-400" : ""
                          }`}
                        >
                          {row.Name}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <span className="text-xs text-gray-400">�?"</span>
                )}
              </div>
            </div>
          </div>
          {/* Layer assignment table with checkboxes in headers and "No Layer" column */}
          <div className="p-4 pt-0">
          <div className="font-semibold mb-2 text-sm">
            Assign Containers to Layers
          </div>
          <div className="hidden md:block">
            <div
              className="border border-gray-300 rounded"
              style={{ maxHeight: "60vh", overflowY: "auto" }}
            >
              <table className="table-auto border-collapse w-full">
              <thead>
                <tr>
                  {displayedLayers.map((layer) => (
                    <th
                      key={layer}
                      className="sticky top-0 bg-gray-100 p-2 border border-gray-300 text-xs text-left z-0"
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setHeaderContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          layer,
                        });
                      }}
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
                          onClick={() => handleDeleteLayer(layer)}
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
                      className="sticky top-0 bg-gray-100 p-2 border border-gray-300 text-xs text-left z-0"
                    key="no-layer"
                  >
                    <span className="font-semibold text-gray-600">No Layer</span>
                  </th>
                </tr>
              </thead>
              <tbody>

                <tr>

                  {displayedLayers.map((layer) => (

                    <td

                      key={layer}

                      className="p-2 border border-gray-300 align-top min-w-30 max-w-30 w-30"

                      onDragOver={(e) => e.preventDefault()}

                      onDrop={() => handleDrop(layer)}

                      onDoubleClick={() => handleCellDoubleClick(layer)}

                      style={{ cursor: "pointer" }}

                      title="Double-click to add a container to this layer"

                    >

                      {renderLayerItems(layer)}

                    </td>

                  ))}

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

                      <span className="text-xs text-gray-400">??"</span>

                    )}

                  </td>

                </tr>

              </tbody>
            </table>
          </div>
        </div>
      </div>
        <ContextMenu
          contextMenu={contextMenu}
          setContextMenu={setContextMenu}
          menuOptions={layerMenuOptions}
        />
        <ContextMenu
          contextMenu={headerContextMenu}
          setContextMenu={setHeaderContextMenu}
          menuOptions={headerMenuOptions}
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

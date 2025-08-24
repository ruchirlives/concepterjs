import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAppContext } from "./AppContext";
import { handleWriteBack } from "./hooks/effectsShared";
import ModalAddRow from "./components/ModalAddRow";

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

// ContextMenu component
function ContextMenu({ contextMenu, onRemove, setContextMenu }) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!contextMenu) return;
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setContextMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [contextMenu, setContextMenu]);

  if (!contextMenu) return null;
  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white border border-gray-300 rounded shadow"
      style={{ top: contextMenu.y, left: contextMenu.x }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        className="block w-full px-3 py-1 text-left text-xs hover:bg-gray-100"
        onClick={() => {
          onRemove(contextMenu.layer, contextMenu.cid);
          setContextMenu(null);
        }}
      >
        Remove
      </button>
      <button
        className="block w-full px-3 py-1 text-left text-xs hover:bg-gray-100"
        onClick={() => {
          // Broadcast select event
          const channel = new BroadcastChannel('rowSelectChannel');
          const nodeId = contextMenu.cid;
          channel.postMessage({ nodeId });
          channel.close();
          setContextMenu(null);
        }}
      >
        Select
      </button>
    </div>
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
  } = useAppContext();
  const [collapsed, setCollapsed] = useState(true);
  const [newLayer, setNewLayer] = useState("");
  const [dragItem, setDragItem] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  // Modal state for adding a row
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLayer, setModalLayer] = useState(null);

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
    return { containersByLayer: map, noLayerItems: noLayer };
  }, [rowData, layerOptions]);

  const handleDrop = (layer) => {
    if (!dragItem) return;
    const { cid } = dragItem;
    setRowData((prev) => {
      const updated = prev.map((row) => {
        if (row.id.toString() !== cid) return row;
        const tags = (row.Tags || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        if (!tags.includes(layer)) {
          tags.push(layer);
        }
        return { ...row, Tags: tags.join(", ") };
      });
      // Call writeback after updating
      handleWriteBack(updated);
      return updated;
    });
    setDragItem(null);
  };

  const handleRemove = (layer, cid) => {
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

  // Handle double click to open modal for adding a row to a layer
  const handleCellDoubleClick = (layer) => {
    setModalLayer(layer);
    setModalOpen(true);
  };

  // When a new row is added via modal, ensure it gets the correct layer tag
  const handleModalSelect = async (newRows) => {
    if (!modalLayer || !newRows || !newRows.length) return;
    setRowData((prev) => {
      const updated = prev.map((row) => {
        if (!newRows.some((nr) => nr.id === row.id)) return row;
        // Ensure the new row has the modalLayer in its Tags
        const tags = (row.Tags || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        if (!tags.includes(modalLayer)) tags.push(modalLayer);
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

  return (
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
        <div className="p-4 space-y-2">
          <div className="flex space-x-2">
            <input
              className="border rounded px-2 py-1 text-sm flex-grow"
              type="text"
              value={newLayer}
              onChange={(e) => setNewLayer(e.target.value)}
              placeholder="New layer name"
            />
            <button
              onClick={handleAdd}
              className="bg-blue-600 text-white text-sm px-2 py-1 rounded"
            >
              Add
            </button>
            <ExcelButton handleExportExcel={handleExportExcel} />
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
                          {items.map((row) => (
                            <li
                              key={row.id}
                              draggable
                              onDragStart={() =>
                                setDragItem({ cid: row.id.toString(), layer })
                              }
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setContextMenu({
                                  x: e.clientX,
                                  y: e.clientY,
                                  layer,
                                  cid: row.id.toString(),
                                });
                              }}
                            >
                              {row.Name}
                            </li>
                          ))}
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
                      {noLayerItems.map((row) => (
                        <li
                          key={row.id}
                          draggable
                          onDragStart={() =>
                            setDragItem({ cid: row.id.toString(), layer: null })
                          }
                          onContextMenu={(e) => {
                            e.preventDefault();
                            // Remove all layers from this row
                            handleRemoveAllLayers(row.id.toString());
                          }}
                        >
                          {row.Name}
                        </li>
                      ))}
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
        onRemove={handleRemove}
        setContextMenu={setContextMenu}
      />
      {/* Modal for adding a row to a layer */}
      <ModalAddRow
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={handleModalSelect}
        selectedContentLayer={modalLayer}
      />
    </div>
  );
};

export default AppLayers;

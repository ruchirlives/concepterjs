import React, { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { useMatrixLogic } from './hooks/useMatrixLogic';
import { useAppContext } from "./AppContext";
import { addChildren, removeChildren, setPosition, getPosition, setNarrative } from "./api";
import ModalAddRow from "./components/ModalAddRow";
import { handleWriteBack, requestRefreshChannel } from "hooks/effectsShared";
import { removeFromLayer } from "./AppLayers";
import toast from 'react-hot-toast';

async function linkItems(sourceItem, targetItem, relationships) {
  // Get current label if it exists
  const key = `${sourceItem.cid}--${targetItem.id}`;
  const currentLabel = relationships[key] || null;

  // Inputbox
  const newLabel = prompt("Enter new label:", currentLabel);
  if (newLabel !== null) {
    // Update the label in the relationships
    await setPosition(sourceItem.cid, targetItem.id, newLabel);
    requestRefreshChannel();


  }
}

function ExcelButton(props) {
  return (
    <button
      className="px-3 py-1 text-xs rounded bg-green-500 text-white hover:bg-green-600"
      onClick={props.handleExportExcel}
      title="Export current view to Excel"
    >
      Export to Excel
    </button>
  );
}

function ContextMenu(props) {
  return (
    <div
      className="fixed z-50 bg-white border border-gray-300 rounded shadow"
      style={{
        top: props.contextMenu.y,
        left: props.contextMenu.x,
        maxHeight: "260px",
        overflowY: "auto",
        minWidth: "180px",
      }}
      onContextMenu={e => e.preventDefault()}
    >
      {/* Rename option */}
      <button
        className="block w-full px-3 py-1 text-left text-xs hover:bg-gray-100"
        onClick={async e => {
          e.stopPropagation();
          props.handleRename(props.contextMenu);
          props.setContextMenu(null);
        }}
      >
        Rename
      </button>
      {/* Remove from both layer and source */}
      <button
        className="block w-full px-3 py-1 text-left text-xs hover:bg-gray-100"
        onClick={e => {
          e.stopPropagation();
          props.handleRemove(props.contextMenu);
          props.setContextMenu(null);
        }}
      >
        Remove from Both
      </button>
      {/* Remove just from layer */}
      <button
        className="block w-full px-3 py-1 text-left text-xs hover:bg-gray-100"
        onClick={e => {
          e.stopPropagation();
          props.handleRemoveLayer(props.contextMenu);
          props.setContextMenu(null);
        }}
      >
        Remove from Layer
      </button>
      {/* Remove just from source */}
      <button
        className="block w-full px-3 py-1 text-left text-xs hover:bg-gray-100"
        onClick={e => {
          e.stopPropagation();
          props.handleRemoveSource(props.contextMenu);
          props.setContextMenu(null);
        }}
      >
        Remove from Source
      </button>
    </div>
  );
}

function ColumnContextMenu(props) {
  return (
    <div
      className="fixed z-50 bg-white border border-gray-300 rounded shadow"
      style={{
        top: props.contextMenu.y,
        left: props.contextMenu.x,
      }}
      onContextMenu={e => e.preventDefault()}
    >
      <button
        className="block w-full px-3 py-1 text-left text-xs hover:bg-gray-100"
        onClick={e => {
          e.stopPropagation();
          props.handleFlip(props.contextMenu.layer);
          props.setContextMenu(null);
        }}
      >
        Flip
      </button>
    </div>
  );
}

function RowContextMenu(props) {
  return (
    <div
      className="fixed z-50 bg-white border border-gray-300 rounded shadow"
      style={{
        top: props.contextMenu.y,
        left: props.contextMenu.x,
      }}
      onContextMenu={e => e.preventDefault()}
    >
      {/* Rename option */}
      <button
        className="block w-full px-3 py-1 text-left text-xs hover:bg-gray-100"
        onClick={async e => {
          e.stopPropagation();
          props.handleRename(props.contextMenu);
          props.setContextMenu(null);
        }}
      >
        Rename
      </button>
      {/* Select option */}
      <button
        className="block w-full px-3 py-1 text-left text-xs hover:bg-gray-100"
        onClick={e => {
          e.stopPropagation();
          props.handleSelect(props.contextMenu);
          props.setContextMenu(null);
        }}
      >
        Select
      </button>
    </div>
  );
}

// Utility: assign a visually distinct background color to each item ID (with memoized cache)
const __colorCache = new Map();
function getColorForId(id) {
  if (__colorCache.has(id)) return __colorCache.get(id);
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  const sat = 30 + (Math.abs(hash * 13) % 15);
  const light = 85 + (Math.abs(hash * 7) % 10);
  const color = `hsl(${hue}, ${sat}%, ${light}%)`;
  __colorCache.set(id, color);
  return color;
}

const TableLayersAsColumns = React.memo(function TableLayersAsColumns(props) {

  return (
    <table className="table-auto border-collapse border border-gray-300 w-full">
      <thead>
        <tr>
          <th className="sticky top-0 left-0 z-5 bg-gray-100 p-2 border border-gray-300" />
          {props.activeLayers.map(layer => (
            <th
              key={layer}
              className="sticky top-0 bg-gray-100 p-2 border border-gray-300 text-xs text-left"
              onContextMenu={e => props.onColumnContextMenu && props.onColumnContextMenu(e, layer)}
            >
              {layer}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {props.filteredSources.map(source => (
          <tr key={source.id}>
            <th
              className="sticky left-0 z-5 bg-gray-100 p-2 border border-gray-300 text-xs text-left"
              style={{
                minWidth: 120,
                maxWidth: 200,
                width: 150,
                overflow: "hidden",
              }}
              onContextMenu={e => props.handleRowHeaderContextMenu && props.handleRowHeaderContextMenu(e, source.id)}
            >
              {source.Name}
            </th>
            {props.activeLayers.map(layer => {
              // Prefer precomputed itemsByCell for efficiency; fallback to on-the-fly computation
              let items =
                props.itemsByCell &&
                props.itemsByCell[source.id] &&
                props.itemsByCell[source.id][layer]
                  ? props.itemsByCell[source.id][layer]
                  : (() => {
                      if (!props.flipped) {
                        return (props.childrenMap[source.id] || [])
                          .map(cid => props.rowData.find(r => r.id.toString() === cid))
                          .filter(child => child && (child.Tags || "").split(",").map(t => t.trim()).includes(layer));
                      } else {
                        return props.rowData.filter(row =>
                          (props.childrenMap[row.id] || []).includes(source.id.toString()) &&
                          (row.Tags || "").split(",").map(t => t.trim()).includes(layer)
                        );
                      }
                    })();

              return (
                <td
                  key={layer}
                  className="p-2 border border-gray-300 align-top min-w-30 max-w-30 w-30"
                  onDoubleClick={() => props.setEditingKey({ sourceId: source.id, layer })}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    if (props.dragItem) {
                      props.handleDrop({
                        fromSource: props.dragItem.fromSource,
                        fromLayer: props.dragItem.fromLayer,
                        cid: props.dragItem.cid,
                        toSource: source.id,
                        toLayer: layer,
                      });
                      props.setDragItem(null);
                    }
                  }}
                >
                  {items.length > 0 ? (
                    <ul className="text-xs space-y-1">
                      {items.map(item => {
                        // const count = itemCellCount[item.id] || 1;
                        // Scale red from 0 (1 cell) to 255 (maxCount cells)
                        // const red = Math.round(255 * (count - 1) / (maxCount - 1));
                        // const bgColor = count > 1 ? `rgba(${red},0,0,0.15)` : "transparent";
                        return (
                          <li
                            key={item.id}
                            data-kanban-item-id={item.id}
                            draggable={!props.ctrlDragging}
                            onDragStart={e => props.handleDragStart(item, source.id, layer, e)}
                            onMouseDown={e => {
                              if (e.ctrlKey) {
                                e.preventDefault();
                                props.handleCtrlMouseDown(item, source.id, layer, e);
                              }
                            }}
                            onContextMenu={e => props.handleCellContextMenu && props.handleCellContextMenu(e, { sourceId: source.id, layer, item })}
                            style={{
                              background: getColorForId(item.id),
                              borderRadius: "4px",
                              padding: "2px 4px",
                            }}
                          >
                            {item.Name}
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
          </tr>
        ))}
      </tbody>
    </table>
  );
});

function Header(props) {
  const [layerDropdownOpen, setLayerDropdownOpen] = useState(false);

  const handleLayerToggle = (layer) => {
    if (props.selectedLayers.includes(layer)) {
      props.setSelectedLayers(props.selectedLayers.filter(l => l !== layer));
    } else {
      props.setSelectedLayers([...props.selectedLayers, layer]);
    }
  };

  return (
    <div className="flex justify-between items-center bg-white text-black px-4 py-2 cursor-pointer select-none">
      <div className="flex items-center gap-4">
        <span className="font-semibold">
          Kanban Matrix ({props.length}×{props._length})
        </span>
        {/* From Layer Filter Dropdown */}
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-600">{props.flipped ? "To:" : "From:"}</label>
          <select
            value={props.flipped ? props.selectedToLayer : props.selectedFromLayer}
            onChange={e =>
              props.flipped
                ? props.setSelectedToLayer(e.target.value)
                : props.setSelectedFromLayer(e.target.value)
            }
            className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
            title={`Filter ${props.flipped ? "to" : "from"} layer`}
          >
            <option value="">All Layers</option>
            {props.layerOptions.map(layer => (
              <option key={layer} value={layer}>
                {layer}
              </option>
            ))}
          </select>
        </div>
        {/* To Layer Filter Dropdown */}
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-600">{props.flipped ? "From:" : "To:"}</label>
          <select
            value={props.flipped ? props.selectedFromLayer : props.selectedToLayer}
            onChange={e =>
              props.flipped
                ? props.setSelectedFromLayer(e.target.value)
                : props.setSelectedToLayer(e.target.value)
            }
            className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
            title={`Filter ${props.flipped ? "from" : "to"} layer`}
          >
            <option value="">All Layers</option>
            {props.layerOptions.map(layer => (
              <option key={layer} value={layer}>
                {layer}
              </option>
            ))}
          </select>
        </div>
        {/* Add Content Layer Dropdown */}
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-600">Content:</label>
          <select
            value={props.selectedContentLayer}
            onChange={e => props.setSelectedContentLayer(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
            title="Filter content layer"
          >
            <option value="">All Layers</option>
            {props.contentLayerOptions.map(layer => (
              <option key={layer} value={layer}>
                {layer}
              </option>
            ))}
          </select>
        </div>
        {/* Layer Selection Dropdown */}
        <div className="relative">
          <button
            className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
            onClick={() => setLayerDropdownOpen(o => !o)}
            title="Select layers to display"
          >
            Layers
          </button>
          {layerDropdownOpen && (
            <div
              className="absolute mt-1 bg-white border border-gray-300 rounded shadow p-2 max-h-60 overflow-auto"
              style={{ zIndex: 9999 }} // <-- Add this line
            >
              {props.layerOptions.map(layer => (
                <label key={layer} className="flex items-center gap-1 text-xs whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={props.selectedLayers.includes(layer)}
                    onChange={() => handleLayerToggle(layer)}
                  />
                  <span>{layer}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        {/* Export to Excel Button */}
        <ExcelButton handleExportExcel={props.handleExportExcel} />
        {/* Flip Button - moved here */}
        <button
          className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
          onClick={props.onFlip}
          title="Flip row/column relationship"
        >
          {props.flipped ? "Flip (flipped)" : "Flip"}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="text-lg font-bold"
          onClick={() => props.setCollapsed(c => !c)}
          aria-label={props.collapsed ? "Expand Kanban" : "Collapse Kanban"}
        >
          {props.collapsed ? "▼" : "▲"}
        </button>
      </div>
    </div>
  );
}

const AppKanban = () => {
  const { rowData, setRowData, activeLayers: contextActiveLayers, layerOptions } = useAppContext();
  const {
    kanbanFilteredSources: filteredSources,
    childrenMap,
    relationships,
    flowWrapperRef,
    collapsed,
    setCollapsed,
    selectedFromLayer,
    setSelectedFromLayer,
    selectedToLayer,
    setSelectedToLayer,
    selectedContentLayer,
    setSelectedContentLayer,
    contentLayerOptions = [],
    flipped,
    setFlipped

  } = useMatrixLogic();

  const [selectedLayers, setSelectedLayers] = useState(contextActiveLayers || []);
  const [dragItem, setDragItem] = useState(null);
  const dragItemRef = useRef(dragItem);
  const [ctrlDragging, setCtrlDragging] = useState(false); // NEW
  const [editingKey, setEditingKey] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [columnContextMenu, setColumnContextMenu] = useState(null);
  const [dragLine, setDragLine] = useState(null); // { from: {x, y}, to: {x, y} }
  const [rowHeaderContextMenu, setRowHeaderContextMenu] = useState(null);
  const [manualMouseTracking, setManualMouseTracking] = useState(false);
  const rafIdRef = useRef(null);


  useEffect(() => {
    dragItemRef.current = dragItem;
  }, [dragItem]);

  useEffect(() => {
    setSelectedLayers(contextActiveLayers || []);
  }, [contextActiveLayers]);

  // Use selectedLayers if available, otherwise fallback to layerOptions
  const columns = (selectedLayers && selectedLayers.length > 0) ? selectedLayers : layerOptions;
  const removeChildFromLayer = removeFromLayer(setRowData);

  // Memoized helpers for quick lookup and tag checks
  const rowById = useMemo(() => {
    const m = new Map();
    (rowData || []).forEach(r => m.set(r.id.toString(), r));
    return m;
  }, [rowData]);

  const tagsById = useMemo(() => {
    const m = new Map();
    (rowData || []).forEach(r => {
      const set = new Set((r.Tags || "").split(",").map(t => t.trim()).filter(Boolean));
      m.set(r.id.toString(), set);
    });
    return m;
  }, [rowData]);

  // Precompute items per visible cell [sourceId][layer]
  const itemsByCell = useMemo(() => {
    const result = {};
    const layerSet = new Set(columns || []);

    if (!flipped) {
      (filteredSources || []).forEach(source => {
        const sid = source.id.toString();
        if (!result[sid]) result[sid] = {};
        const childIds = (childrenMap[sid] || []);
        const children = childIds.map(cid => rowById.get(cid)).filter(Boolean);
        layerSet.forEach(layer => {
          result[sid][layer] = children.filter(child => tagsById.get(child.id.toString())?.has(layer));
        });
      });
    } else {
      // flipped: rows whose children include source.id
      (filteredSources || []).forEach(source => {
        const sid = source.id.toString();
        if (!result[sid]) result[sid] = {};
      });
      (rowData || []).forEach(row => {
        const rid = row.id.toString();
        const children = new Set(childrenMap[rid] || []);
        // Row contributes to any source it contains
        (filteredSources || []).forEach(source => {
          const sid = source.id.toString();
          if (children.has(sid)) {
            layerSet.forEach(layer => {
              if (tagsById.get(rid)?.has(layer)) {
                if (!result[sid]) result[sid] = {};
                if (!result[sid][layer]) result[sid][layer] = [];
                result[sid][layer].push(row);
              }
            });
          }
        });
      });
      // Ensure empty arrays for missing cells to keep shape predictable
      (filteredSources || []).forEach(source => {
        const sid = source.id.toString();
        layerSet.forEach(layer => {
          if (!result[sid][layer]) result[sid][layer] = [];
        });
      });
    }

    return result;
  }, [filteredSources, columns, flipped, childrenMap, rowData, rowById, tagsById]);

  // Export to Excel for Kanban (layers as columns)
  const handleExportExcel = useCallback(() => {
    const headers = ["", ...columns];
    const rows = filteredSources.map((source) => {
      const values = [source.Name];
      columns.forEach((layer) => {
        const children = (itemsByCell?.[source.id]?.[layer]) || [];
        const namesRaw = children.map(child => child.Name).join("\n");
        const names = namesRaw.includes("\n") ? `"${namesRaw}"` : namesRaw;
        values.push(names);
      });
      return values.join("\t");
    });
    const tsv = [headers.join("\t"), ...rows].join("\n");
    if (navigator && navigator.clipboard) {
      navigator.clipboard.writeText(tsv);
      alert("Kanban matrix copied to clipboard as TSV!");
    } else {
      alert(tsv);
    }
  }, [filteredSources, columns, itemsByCell]);

  // Add a child to a source and tag it with a layer
  const handleAddItem = async ({ sourceId, layer }, row) => {
    const cid = row.id.toString();
    if (!flipped) {
      // Normal: add child to source
      if (!(childrenMap[sourceId] || []).includes(cid)) {
        await addChildren(sourceId, [cid]);
      }
      // Add the layer tag to the child if not present
      const child = rowData.find(r => r.id.toString() === cid);
      if (child && !(child.Tags || "").split(",").map(t => t.trim()).includes(layer)) {
        child.Tags = child.Tags ? `${child.Tags}, ${layer}` : layer;
        setRowData([...rowData]);
      }
    } else {
      // Flipped: add source as child to row (parent)
      if (!(childrenMap[cid] || []).includes(sourceId.toString())) {
        await addChildren(cid, [sourceId.toString()]);
      }
      // Add the layer tag to the parent if not present
      if (row && !(row.Tags || "").split(",").map(t => t.trim()).includes(layer)) {
        row.Tags = row.Tags ? `${row.Tags}, ${layer}` : layer;
        setRowData([...rowData]);
      }
    }
  };

  const handleRename = async (context) => {
    const { cid } = context;
    const currname = rowData.find(item => item.id === cid)?.Name || "";
    const name = prompt("Enter new name:", currname);
    if (name) {
      // Update the nodes in rowData
      const updatedRowData = rowData.map(row =>
        row.id === cid ? { ...row, Name: name } : row
      );
      setRowData(updatedRowData);
      handleWriteBack(updatedRowData);
      toast.success("Node(s) renamed successfully!");
      requestRefreshChannel();
    }
  }

  const handleSelect = async (context) => {
    const { cid } = context;
    console.log("Selecting ", cid);
    const channel = new BroadcastChannel('selectNodeChannel');
    channel.postMessage({ nodeId: cid });
    // Add a small delay before closing to ensure message is sent
    setTimeout(() => channel.close(), 10);
  }

  // Remove a layer tag from a child in a source
  const handleRemove = async (context) => {
    const { sourceId, cid, layer } = context;
    if (!flipped) {
      await removeChildren(sourceId, [cid]);
    } else {
      await removeChildren(cid, [sourceId.toString()]);
    }
    await removeChildFromLayer(layer, cid);
    requestRefreshChannel();
  };

  const handleRemoveLayer = async (context) => {
    const { cid, layer } = context;
    await removeChildFromLayer(layer, cid);
    requestRefreshChannel();
  };

  const handleRemoveSource = async (context) => {
    const { sourceId, cid } = context;
    if (!flipped) {
      await removeChildren(sourceId, [cid]);
    } else {
      await removeChildren(cid, [sourceId.toString()]);
    }
    requestRefreshChannel();
  };

  // Column header context menu
  const handleColumnContextMenu = useCallback((e, layer) => {
    e.preventDefault();
    setColumnContextMenu({ x: e.clientX, y: e.clientY, layer });
  }, []);

  // Row header context menu
  const handleRowHeaderContextMenu = useCallback((e, sourceId) => {
    e.preventDefault();
    setRowHeaderContextMenu({
      x: e.clientX,
      y: e.clientY,
      cid: sourceId,
    });
  }, []);

  const handleColumnFlip = async (layer) => {
    for (const source of filteredSources) {
      let items = [];
      if (!flipped) {
        items = (childrenMap[source.id] || [])
          .map(cid => rowData.find(r => r.id.toString() === cid))
          .filter(child => child && (child.Tags || "").split(",").map(t => t.trim()).includes(layer));
      } else {
        items = rowData.filter(row =>
          (childrenMap[row.id] || []).includes(source.id.toString()) &&
          (row.Tags || "").split(",").map(t => t.trim()).includes(layer)
        );
      }
      for (const item of items) {
        if (!flipped) {
          const position = await getPosition(source.id, item.id);
          await removeChildren(source.id, [item.id.toString()]);
          await addChildren(item.id, [source.id.toString()]);
          if (position) {
            if (position.label) await setPosition(item.id, source.id.toString(), position.label);
            if (position.narrative) await setNarrative(item.id, source.id.toString(), position.narrative);
          }
        } else {
          const position = await getPosition(item.id, source.id);
          await removeChildren(item.id, [source.id.toString()]);
          await addChildren(source.id, [item.id.toString()]);
          if (position) {
            if (position.label) await setPosition(source.id, item.id.toString(), position.label);
            if (position.narrative) await setNarrative(source.id, item.id.toString(), position.narrative);
          }
        }
      }
    }
    requestRefreshChannel();
  };

  // Move child to new source if needed, but do NOT remove from previous cell (allow multi-cell presence)
  const handleDrop = useCallback(async ({ fromSource, fromLayer, cid, toSource, toLayer }) => {
    if (!cid || !toSource || !toLayer) return;

    if (!flipped) {
      // Normal: add child to new source
      if (!(childrenMap[toSource] || []).includes(cid)) {
        await addChildren(toSource, [cid]);
      }
      // Add new layer tag if not present
      const child = rowData.find(r => r.id.toString() === cid);
      if (child) {
        let tagsArr = (child.Tags || "")
          .split(",")
          .map(t => t.trim())
          .filter(Boolean);

        if (!tagsArr.includes(toLayer)) tagsArr.push(toLayer);

        child.Tags = tagsArr.join(", ");
        setRowData([...rowData]);
      }
    } else {
      // Flipped: add toSource (row header) as child to cid (parent)
      if (!(childrenMap[cid] || []).includes(toSource.toString())) {
        await addChildren(cid, [toSource.toString()]);
      }
      // Add new layer tag if not present
      const parent = rowData.find(r => r.id.toString() === cid);
      if (parent) {
        let tagsArr = (parent.Tags || "")
          .split(",")
          .map(t => t.trim())
          .filter(Boolean);

        if (!tagsArr.includes(toLayer)) tagsArr.push(toLayer);

        parent.Tags = tagsArr.join(", ");
        setRowData([...rowData]);
      }
    }
  }, [flipped, childrenMap, rowData, setRowData]);

  const handleDragStart = useCallback((child, sourceId, layer, event) => {
    if (event.ctrlKey) {
      setCtrlDragging(true);
      setDragItem({ cid: child.id.toString(), fromSource: sourceId, fromLayer: layer, ctrl: true });
      const startPos = getItemCenter(child.id);
      if (startPos) setDragLine({ from: startPos, to: startPos });
    } else {
      setCtrlDragging(false);
      setDragItem({ cid: child.id.toString(), fromSource: sourceId, fromLayer: layer, ctrl: false });
      setDragLine(null);
    }
  }, []);

  const handleCtrlMouseDown = useCallback((child, sourceId, layer, event) => {
    setCtrlDragging(true);
    setManualMouseTracking(true);
    setDragItem({ cid: child.id.toString(), fromSource: sourceId, fromLayer: layer, ctrl: true });

    // Use the actual element under the mouse
    const rect = event.target.getBoundingClientRect();
    const startPos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    setDragLine({ from: startPos, to: startPos });

    // Start listening for mousemove and mouseup
    const handleMouseMove = (e) => {
      if (rafIdRef.current != null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        setDragLine(line => (line ? { ...line, to: { x: e.clientX, y: e.clientY } } : line));
        rafIdRef.current = null;
      });
    };
    const handleMouseUp = (e) => {
      setCtrlDragging(false);
      setDragLine(null);
      setManualMouseTracking(false);

      const elem = document.elementFromPoint(e.clientX, e.clientY);
      if (elem && elem.dataset && elem.dataset.kanbanItemId) {
        const targetId = elem.dataset.kanbanItemId;
        const targetItem = rowData.find(r => r.id.toString() === targetId);
        if (targetItem && dragItemRef.current) {
          linkItems(dragItemRef.current, targetItem, relationships);
        }
      }
      setDragItem(null);

      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [relationships, rowData]);

  // NEW: Get the center position of a kanban item by child ID
  const getItemCenter = (childId) => {
    const el = document.querySelector(`[data-kanban-item-id="${childId}"]`);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
      setColumnContextMenu(null);
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    if (!ctrlDragging || !dragLine || manualMouseTracking) return;
    const handleMouseMove = (e) => {
      if (rafIdRef.current != null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        setDragLine(line => (line ? { ...line, to: { x: e.clientX, y: e.clientY } } : line));
        rafIdRef.current = null;
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [ctrlDragging, dragLine, manualMouseTracking]);

  useEffect(() => {
    if (!ctrlDragging) {
      setDragLine(null);
      return;
    }
    const handleDragEnd = () => {
      setCtrlDragging(false);
      setDragLine(null);
      setDragItem(null);
    };
    window.addEventListener("dragend", handleDragEnd);
    return () => window.removeEventListener("dragend", handleDragEnd);
  }, [ctrlDragging]);

  useEffect(() => {
    if (!rowHeaderContextMenu) return;
    const handleClick = () => setRowHeaderContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [rowHeaderContextMenu]);

  // Add this function inside AppKanban, before the return statement
  const handleCellContextMenu = useCallback((e, { sourceId, layer, item }) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      sourceId,
      layer,
      cid: item.id.toString(),
      rowData,
      setRowData
    });
  }, [rowData, setRowData]);

  return (
    <div ref={flowWrapperRef} className="bg-white rounded shadow">
      {/* Header */}
      <Header
        contentLayerOptions={contentLayerOptions}
        length={filteredSources.length}
        _length={columns.length}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        layerOptions={layerOptions}
        selectedLayers={selectedLayers}
        setSelectedLayers={setSelectedLayers}
        flipped={flipped}
        selectedFromLayer={selectedFromLayer}
        setSelectedFromLayer={setSelectedFromLayer}
        selectedToLayer={selectedToLayer}
        setSelectedToLayer={setSelectedToLayer}
        selectedContentLayer={selectedContentLayer}
        setSelectedContentLayer={setSelectedContentLayer}
        handleExportExcel={handleExportExcel}
        onFlip={() => setFlipped(f => !f)}
      />

      {/* Kanban Table */}
      <div className={`transition-all duration-300 overflow-auto`} style={{ height: collapsed ? 0 : 700 }}>
        <div className="h-full flex flex-col">
          {!collapsed && (
            <div className="flex-1 m-4 mb-0 border border-gray-300 relative overflow-auto">
              {/* Draw drag line if active */}
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
              <div className="overflow-x-auto overflow-y-auto w-full h-full" style={{ maxHeight: "600px" }}>
                <TableLayersAsColumns
                  rowData={rowData}
                  setRowData={setRowData}
                  filteredSources={filteredSources}
                  activeLayers={columns}
                  childrenMap={childrenMap}
                  itemsByCell={itemsByCell}
                  setEditingKey={setEditingKey}
                  dragItem={dragItem}
                  setDragItem={setDragItem}
                  setContextMenu={setContextMenu}
                  handleDrop={handleDrop}
                  handleDragStart={handleDragStart}
                  handleCtrlMouseDown={handleCtrlMouseDown}
                  ctrlDragging={ctrlDragging}
                  flipped={flipped}
                  onColumnContextMenu={handleColumnContextMenu}
                  handleRowHeaderContextMenu={handleRowHeaderContextMenu}
                  handleCellContextMenu={handleCellContextMenu}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal for adding rows */}
      {editingKey && (
        <ModalAddRow
          isOpen={!!editingKey}
          onClose={() => setEditingKey(null)}
          onSelect={rows => rows.forEach(row => handleAddItem(editingKey, row))}
          selectedContentLayer={selectedContentLayer}
          layer={editingKey.layer}
          initialSelectedIds={
            typeof editingKey === "object" && editingKey.layer
              ? rowData
                .filter(row =>
                  (row.Tags || "")
                    .split(",")
                    .map(t => t.trim())
                    .includes(editingKey.layer)
                )
                .map(row => row.id)
              : []
          }
        />
      )}

      {/* Context menu for cell actions */}
      {contextMenu && (
        <ContextMenu
          contextMenu={contextMenu}
          setContextMenu={setContextMenu}
          handleRename={handleRename}
          handleRemove={handleRemove}
          handleRemoveLayer={handleRemoveLayer}
          handleRemoveSource={handleRemoveSource}
        />
      )}
      {columnContextMenu && (
        <ColumnContextMenu
          contextMenu={columnContextMenu}
          setContextMenu={setColumnContextMenu}
          handleFlip={handleColumnFlip}
        />
      )}
      {rowHeaderContextMenu && (
        <RowContextMenu
          contextMenu={rowHeaderContextMenu}
          setContextMenu={setRowHeaderContextMenu}
          handleRename={handleRename}
          handleSelect={handleSelect}
        />
      )}
    </div>
  );
};

export default AppKanban;


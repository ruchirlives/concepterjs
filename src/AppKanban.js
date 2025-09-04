import React, { useCallback, useEffect, useState, useRef } from "react";
import { useMatrixLogic } from './hooks/useMatrixLogic';
import { useAppContext } from "./AppContext";
import { addChildren, removeChildren, setPosition } from "./api";
import ModalAddRow from "./components/ModalAddRow";
import { requestRefreshChannel } from "hooks/effectsShared";
import { removeFromLayer } from "./AppLayers";


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
      }}
      onContextMenu={e => e.preventDefault()}
    >
      {/* Remove from both layer and source */}
      <button
        className="block w-full px-3 py-1 text-left text-xs hover:bg-gray-100"
        onClick={e => {
          e.stopPropagation();
          props.handleRemove(props.contextMenu);
          props.setContextMenu(null);
        }}
      >
        Remove
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

// Calculate frequency of each item across all cells
// function getItemCellCount({ filteredSources, columns, childrenMap, rowData, flipped }) {
//   const itemCellCount = {};
//   filteredSources.forEach(source => {
//     columns.forEach(layer => {
//       let items = [];
//       if (!flipped) {
//         items = (childrenMap[source.id] || [])
//           .map(cid => rowData.find(r => r.id.toString() === cid))
//           .filter(child => child && (child.Tags || "").split(",").map(t => t.trim()).includes(layer));
//       } else {
//         items = rowData.filter(row =>
//           (childrenMap[row.id] || []).includes(source.id.toString()) &&
//           (row.Tags || "").split(",").map(t => t.trim()).includes(layer)
//         );
//       }
//       items.forEach(item => {
//         itemCellCount[item.id] = (itemCellCount[item.id] || 0) + 1;
//       });
//     });
//   });
//   return itemCellCount;
// }

// Utility: assign a visually distinct background color to each item ID
function getColorForId(id) {
  // Hash the id to a number
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Use hash to pick a hue (0-360), faded saturation (30-45%), and high lightness (85-95%)
  const hue = Math.abs(hash) % 360;
  const sat = 30 + (Math.abs(hash * 13) % 15); // 30-45%
  const light = 85 + (Math.abs(hash * 7) % 10); // 85-95%
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

function TableLayersAsColumns(props) {
  // Calculate item frequency for coloring
  // const itemCellCount = getItemCellCount({
  //   filteredSources: props.filteredSources,
  //   columns: props.activeLayers,
  //   childrenMap: props.childrenMap,
  //   rowData: props.rowData,
  //   flipped: props.flipped
  // });

  // Find max frequency for scaling
  // const maxCount = Math.max(2, ...Object.values(itemCellCount));

  return (
    <table className="table-auto border-collapse border border-gray-300 w-full">
      <thead>
        <tr>
          <th className="sticky top-0 left-0 z-10 bg-gray-100 p-2 border border-gray-300" />
          {props.activeLayers.map(layer => (
            <th
              key={layer}
              className="sticky top-0 bg-gray-100 p-2 border border-gray-300 text-xs text-left"
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
              className="sticky left-0 z-10 bg-gray-100 p-2 border border-gray-300 text-xs text-left"
              style={{
                minWidth: 120,
                maxWidth: 200,
                width: 150,
                overflow: "hidden",
              }}
            >
              {source.Name}
            </th>
            {props.activeLayers.map(layer => {
              let items = [];
              if (!props.flipped) {
                items = (props.childrenMap[source.id] || [])
                  .map(cid => props.rowData.find(r => r.id.toString() === cid))
                  .filter(child => child && (child.Tags || "").split(",").map(t => t.trim()).includes(layer));
              } else {
                items = props.rowData.filter(row =>
                  (props.childrenMap[row.id] || []).includes(source.id.toString()) &&
                  (row.Tags || "").split(",").map(t => t.trim()).includes(layer)
                );
              }

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
                            onContextMenu={e => {
                              e.preventDefault();
                              props.setContextMenu({
                                x: e.clientX,
                                y: e.clientY,
                                sourceId: source.id,
                                layer,
                                cid: item.id.toString(),
                              });
                            }}
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
}

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
          Flip
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
  const [dragLine, setDragLine] = useState(null); // { from: {x, y}, to: {x, y} }
  
  useEffect(() => {
    dragItemRef.current = dragItem;
  }, [dragItem]);

  useEffect(() => {
    setSelectedLayers(contextActiveLayers || []);
  }, [contextActiveLayers]);

  // Use selectedLayers if available, otherwise fallback to layerOptions
  const columns = (selectedLayers && selectedLayers.length > 0) ? selectedLayers : layerOptions;
  const removeChildFromLayer = removeFromLayer(setRowData);

  // Export to Excel for Kanban (layers as columns)
  const handleExportExcel = useCallback(() => {
    const headers = ["", ...columns];
    const rows = filteredSources.map((source) => {
      const values = [source.Name];
      columns.forEach((layer) => {
        // Find children of this source that have this layer as a tag
        const children = (childrenMap[source.id] || [])
          .map(cid => rowData.find(r => r.id.toString() === cid))
          .filter(child => child && (child.Tags || "").split(",").map(t => t.trim()).includes(layer));
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
  }, [filteredSources, columns, childrenMap, rowData]);

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

  // Move child to new source if needed, but do NOT remove from previous cell (allow multi-cell presence)
  const handleDrop = async ({ fromSource, fromLayer, cid, toSource, toLayer }) => {
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
  };

  const handleDragStart = (child, sourceId, layer, event) => {
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
  };

  const handleCtrlMouseDown = (child, sourceId, layer, event) => {
    setCtrlDragging(true);
    setDragItem({ cid: child.id.toString(), fromSource: sourceId, fromLayer: layer, ctrl: true });

    // Use the actual element under the mouse
    const rect = event.target.getBoundingClientRect();
    const startPos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    setDragLine({ from: startPos, to: startPos });

    // Start listening for mousemove and mouseup
    const handleMouseMove = (e) => {
      setDragLine(line => line ? { ...line, to: { x: e.clientX, y: e.clientY } } : line);
    };
    const handleMouseUp = (e) => {
      setCtrlDragging(false);
      setDragLine(null);

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
  };

  // NEW: Get the center position of a kanban item by child ID
  const getItemCenter = (childId) => {
    const el = document.querySelector(`[data-kanban-item-id="${childId}"]`);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    if (!ctrlDragging || !dragLine) return;
    const handleMouseMove = (e) => {
      setDragLine(line => line ? { ...line, to: { x: e.clientX, y: e.clientY } } : line);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [ctrlDragging, dragLine]);

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
                  filteredSources={filteredSources}
                  activeLayers={columns}
                  childrenMap={childrenMap}
                  setEditingKey={setEditingKey}
                  dragItem={dragItem}
                  setDragItem={setDragItem}
                  setContextMenu={setContextMenu}
                  handleDrop={handleDrop}
                  handleDragStart={handleDragStart}
                  handleCtrlMouseDown={handleCtrlMouseDown}
                  ctrlDragging={ctrlDragging}
                  flipped={flipped} // <-- Add this line
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
          handleRemove={handleRemove}
          handleRemoveLayer={handleRemoveLayer}
          handleRemoveSource={handleRemoveSource}
        />
      )}
    </div>
  );
};

export default AppKanban;


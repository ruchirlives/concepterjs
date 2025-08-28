import React, { useCallback, useEffect, useState } from "react";
import { useMatrixLogic } from './hooks/useMatrixLogic';
import { useAppContext } from "./AppContext";
import { addChildren, removeChildren } from "./api";
import ModalAddRow from "./components/ModalAddRow";

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
    </div>
  );
}

function TableLayersAsColumns(props) {
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
              // Find children of this source that have this layer as a tag
              const children = (props.childrenMap[source.id] || [])
                .map(cid => props.rowData.find(r => r.id.toString() === cid))
                .filter(child => child && (child.Tags || "").split(",").map(t => t.trim()).includes(layer));

              return (
                <td
                  key={layer}
                  className="p-2 border border-gray-300 align-top min-w-30 max-w-30 w-30"
                  onDoubleClick={() => props.setEditingKey({ sourceId: source.id, layer })}
                >
                  {children.length > 0 ? (
                    <ul className="text-xs space-y-1">
                      {children.map(child => (
                        <li
                          key={child.id}
                          draggable
                          onDragStart={() => props.setDragItem({ cid: child.id.toString(), fromSource: source.id, fromLayer: layer })}
                          onContextMenu={e => {
                            e.preventDefault();
                            props.setContextMenu({
                              x: e.clientX,
                              y: e.clientY,
                              sourceId: source.id,
                              layer,
                              cid: child.id.toString(),
                            });
                          }}
                        >
                          {child.Name}
                        </li>
                      ))}
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
        {/* Export to Excel Button */}
        <ExcelButton handleExportExcel={props.handleExportExcel} />
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
  const { rowData, setRowData, activeLayers } = useAppContext();
  const {
    kanbanFilteredSources: filteredSources,
    childrenMap,
    flowWrapperRef,
    collapsed,
    setCollapsed,
    layerOptions,
    flipped,
    selectedFromLayer,
    setSelectedFromLayer,
    selectedToLayer,
    setSelectedToLayer,
    selectedContentLayer,
    setSelectedContentLayer,
    contentLayerOptions = [],
  } = useMatrixLogic();

  const [dragItem, setDragItem] = useState(null);
  const [editingKey, setEditingKey] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  // Use activeLayers if available, otherwise fallback to layerOptions
  const columns = (activeLayers && activeLayers.length > 0) ? activeLayers : layerOptions;

  // Export to Excel for Kanban (layers as columns)
  const handleExportExcel = useCallback(() => {
    const headers = ["", ...activeLayers];
    const rows = filteredSources.map((source) => {
      const values = [source.Name];
      activeLayers.forEach((layer) => {
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
  }, [filteredSources, activeLayers, childrenMap, rowData]);

  // Add a child to a source and tag it with a layer
  const handleAddItem = async ({ sourceId, layer }, row) => {
    const cid = row.id.toString();
    // Add child to source if not already present
    if (!(childrenMap[sourceId] || []).includes(cid)) {
      await addChildren(sourceId, [cid]);
    }
    // Add the layer tag to the child if not present
    const child = rowData.find(r => r.id.toString() === cid);
    if (child && !(child.Tags || "").split(",").map(t => t.trim()).includes(layer)) {
      child.Tags = child.Tags ? `${child.Tags}, ${layer}` : layer;
      setRowData([...rowData]);
    }
  };

  // Remove a layer tag from a child in a source
  const handleRemove = async (context) => {
    const { sourceId, cid } = context;
    // Call the API to remove the child from the source/container
    await removeChildren(sourceId, [cid]);
    // Optionally, update your local state/UI here if needed
    // For example, you might want to refresh data or optimistically update rowData/childrenMap
  };

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

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
        flipped={flipped}
        selectedFromLayer={selectedFromLayer}
        setSelectedFromLayer={setSelectedFromLayer}
        selectedToLayer={selectedToLayer}
        setSelectedToLayer={setSelectedToLayer}
        selectedContentLayer={selectedContentLayer}
        setSelectedContentLayer={setSelectedContentLayer}
        handleExportExcel={handleExportExcel}
      />

      {/* Kanban Table */}
      <div className={`transition-all duration-300 overflow-auto`} style={{ height: collapsed ? 0 : 700 }}>
        <div className="h-full flex flex-col">
          {!collapsed && (
            <div className="flex-1 m-4 mb-0 border border-gray-300 relative overflow-auto">
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
        />
      )}
    </div>
  );
};

export default AppKanban;


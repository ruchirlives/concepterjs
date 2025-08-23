import React, { useMemo, useState } from "react";
import { useAppContext } from "./AppContext";

function ContextMenu({ contextMenu, onRemove, setContextMenu }) {
  if (!contextMenu) return null;
  return (
    <div
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
    </div>
  );
}

const AppLayerAssign = () => {
  const { rowData, setRowData, layerOptions } = useAppContext();
  const [collapsed, setCollapsed] = useState(true);
  const [dragItem, setDragItem] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  const containersByLayer = useMemo(() => {
    const map = {};
    layerOptions.forEach((layer) => {
      map[layer] = [];
    });
    rowData.forEach((row) => {
      const tags = (row.Tags || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      tags.forEach((tag) => {
        if (map[tag]) {
          map[tag].push(row);
        }
      });
    });
    return map;
  }, [rowData, layerOptions]);

  const handleDrop = (layer) => {
    if (!dragItem) return;
    const { cid } = dragItem;
    setRowData((prev) =>
      prev.map((row) => {
        if (row.id.toString() !== cid) return row;
        const tags = (row.Tags || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        if (!tags.includes(layer)) {
          tags.push(layer);
        }
        return { ...row, Tags: tags.join(", ") };
      })
    );
    setDragItem(null);
  };

  const handleRemove = (layer, cid) => {
    setRowData((prev) =>
      prev.map((row) => {
        if (row.id.toString() !== cid) return row;
        const tags = (row.Tags || "")
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t && t !== layer);
        return { ...row, Tags: tags.join(", ") };
      })
    );
  };

  return (
    <div className="bg-white rounded shadow">
      <div
        className="flex justify-between items-center bg-white text-black px-4 py-2 cursor-pointer select-none"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="font-semibold">Layer Assign</span>
        <button className="text-lg font-bold">{collapsed ? "▼" : "▲"}</button>
      </div>
      <div
        className="overflow-auto transition-all duration-300"
        style={{ height: collapsed ? 0 : "auto" }}
      >
        {!collapsed && (
          <table className="table-auto border-collapse border border-gray-300 w-full">
            <thead>
              <tr>
                {layerOptions.map((layer) => (
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
              <tr>
                {layerOptions.map((layer) => {
                  const items = containersByLayer[layer] || [];
                  return (
                    <td
                      key={layer}
                      className="p-2 border border-gray-300 align-top min-w-30 max-w-30 w-30"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(layer)}
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
              </tr>
            </tbody>
          </table>
        )}
      </div>
      <ContextMenu
        contextMenu={contextMenu}
        onRemove={handleRemove}
        setContextMenu={setContextMenu}
      />
    </div>
  );
};

export default AppLayerAssign;

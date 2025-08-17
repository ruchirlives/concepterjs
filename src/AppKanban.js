import React, { useCallback, useEffect, useState } from "react";
import { useMatrixLogic } from './hooks/useMatrixLogic';
import { useAppContext } from "./AppContext";
import { addChildren, removeChildren } from "./api";
import ModalAddRow from "./components/ModalAddRow";

const AppKanban = () => {
  const {
    filteredSources,
    filteredTargets,
    childrenMap,
    nameById,
    flowWrapperRef,
    collapsed,
    setCollapsed,
    layerOptions,
    flipped,
    selectedFromLayer,
    setSelectedFromLayer,
    selectedToLayer,
    setSelectedToLayer,
  } = useMatrixLogic();
  const { setChildrenMap } = useAppContext();

  const getCommonChildren = useCallback((sourceId, targetId) => {
    const sourceChildren = childrenMap[sourceId] || [];
    const targetChildren = childrenMap[targetId] || [];
    return sourceChildren.filter((cid) => targetChildren.includes(cid));
  }, [childrenMap]);

  const [cellContents, setCellContents] = useState({});
  const [dragItem, setDragItem] = useState(null);
  const [editingKey, setEditingKey] = useState(null);

  useEffect(() => {
    const initial = {};
    filteredSources.forEach((source) => {
      filteredTargets.forEach((target) => {
        const key = `${source.id}--${target.id}`;
        if (source.id === target.id) return;
        initial[key] = getCommonChildren(
          source.id.toString(),
          target.id.toString()
        );
      });
    });
    setCellContents(initial);
  }, [filteredSources, filteredTargets, childrenMap, getCommonChildren]);

  const handleDrop = async (toKey) => {
    if (!dragItem || dragItem.fromKey === toKey) return;

    setCellContents((prev) => {
      const next = { ...prev };
      next[dragItem.fromKey] = next[dragItem.fromKey].filter(
        (id) => id !== dragItem.cid
      );
      const dest = next[toKey] || [];
      if (!dest.includes(dragItem.cid)) {
        dest.push(dragItem.cid);
      }
      next[toKey] = dest;
      return next;
    });

    const cid = dragItem.cid;
    console.log("Moving item:", cid, "from", dragItem.fromKey, "to", toKey);
    const [fromSource, fromTarget] = dragItem.fromKey.split("--");
    const [toSource, toTarget] = toKey.split("--");

    const oldParents = [fromSource, fromTarget];
    const newParents = [toSource, toTarget];

    const parentsToRemove = oldParents.filter(p => !newParents.includes(p));
    const parentsToAdd = newParents.filter(p => !oldParents.includes(p));

    try {
      await Promise.all([
        ...parentsToRemove.map((pid) => removeChildren(pid, [cid])),
        ...parentsToAdd.map((pid) => addChildren(pid, [cid])),
      ]);

      setChildrenMap((prev) => {
        const next = { ...prev };
        parentsToRemove.forEach((pid) => {
          const arr = next[pid] || [];
          next[pid] = arr.filter((id) => id !== cid);
        });
        parentsToAdd.forEach((pid) => {
          const arr = next[pid] || [];
          if (!arr.includes(cid)) arr.push(cid);
          next[pid] = arr;
        });
        return next;
      });
    } catch (error) {
      console.error("Error updating parents:", error);
    }

    setDragItem(null);
  };

  const handleAddItem = async (key, row) => {
    const cid = row.id.toString();
    setCellContents((prev) => {
      const next = { ...prev };
      const arr = next[key] || [];
      if (!arr.includes(cid)) arr.push(cid);
      next[key] = arr;
      return next;
    });

    const [sourceId, targetId] = key.split("--");
    try {
      await Promise.all([
        addChildren(sourceId, [cid]),
        addChildren(targetId, [cid]),
      ]);
      setChildrenMap((prev) => {
        const next = { ...prev };
        [sourceId, targetId].forEach((pid) => {
          const arr = next[pid] || [];
          if (!arr.includes(cid)) arr.push(cid);
          next[pid] = arr;
        });
        return next;
      });
    } catch (error) {
      console.error("Error adding child:", error);
    }
  };

  return (
    <div ref={flowWrapperRef} className="bg-white rounded shadow">
      {/* Header */}
      <div className="flex justify-between items-center bg-white text-black px-4 py-2 cursor-pointer select-none">
        <div className="flex items-center gap-4">
          <span className="font-semibold">
            Kanban Matrix ({filteredSources.length}×{filteredTargets.length})
          </span>

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
        </div>
        <button
          className="text-lg font-bold"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand Kanban" : "Collapse Kanban"}
        >
          {collapsed ? "▼" : "▲"}
        </button>
      </div>

      {/* Matrix Table */}
      <div className={`overflow-auto transition-all duration-300`} style={{ height: collapsed ? 0 : "auto" }}>
        {!collapsed && (
          <table className="table-auto border-collapse border border-gray-300 w-full">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-10 bg-gray-100 p-2 border border-gray-300" />
                {filteredTargets.map((target) => (
                  <th
                    key={target.id}
                    className="sticky top-0 bg-gray-100 p-2 border border-gray-300 text-xs text-left"
                  >
                    {target.Name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredSources.map((source) => (
                <tr key={source.id}>
                  <th
                    className="sticky left-0 z-10 bg-gray-100 p-2 border border-gray-300 text-xs text-left"
                    style={{ minWidth: 120, maxWidth: 200, width: 150, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {source.Name}
                  </th>
                  {filteredTargets.map((target) => {
                    const key = `${source.id}--${target.id}`;
                    if (source.id === target.id) {
                      return (
                        <td key={key} className="p-2 bg-gray-200 border border-gray-300 text-left">
                          —
                        </td>
                      );
                    }

                    const items = cellContents[key] || [];

                    // Disallow drop if dragItem exists and its cid matches source or target
                    const dropDisabled =
                      dragItem &&
                      (dragItem.cid === source.id.toString() || dragItem.cid === target.id.toString());

                    return (
                      <td
                        key={key}
                        className={`p-2 border border-gray-300 align-top min-w-30 max-w-30 w-30 ${dropDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                        onDragOver={(e) => {
                          if (!dropDisabled) e.preventDefault();
                        }}
                        onDrop={() => {
                          if (!dropDisabled) handleDrop(key);
                        }}
                        onDoubleClick={() => setEditingKey(key)}
                      >
                        {items.length > 0 ? (
                          <ul className="text-xs space-y-1">
                            {items.map((cid) => (
                              <li
                                key={cid}
                                draggable
                                onDragStart={() => setDragItem({ cid, fromKey: key })}
                              >
                                {nameById[cid] || cid}
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
        )}
      </div>
      {editingKey && (
        <ModalAddRow
          isOpen={!!editingKey}
          onClose={() => setEditingKey(null)}
          onSelect={(row) => handleAddItem(editingKey, row)}
        />
      )}
    </div>
  );
};

export default AppKanban;


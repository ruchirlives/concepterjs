import React, { useCallback, useEffect, useState } from "react";
import { useMatrixLogic } from './hooks/useMatrixLogic';

const AppKanban = () => {
  const {
    filteredSources,
    filteredTargets,
    childrenMap,
    nameById,
    flowWrapperRef,
    collapsed,
    setCollapsed,
  } = useMatrixLogic();

  // Ensure relationships are loaded so filteredSources/Targets populate
  useEffect(() => {
    if (collapsed) {
      setCollapsed(false);
    }
  }, [collapsed, setCollapsed]);

  const getCommonChildren = useCallback((sourceId, targetId) => {
    const sourceChildren = childrenMap[sourceId] || [];
    const targetChildren = childrenMap[targetId] || [];
    return sourceChildren.filter((cid) => targetChildren.includes(cid));
  }, [childrenMap]);

  const [cellContents, setCellContents] = useState({});
  const [dragItem, setDragItem] = useState(null);

  useEffect(() => {
    const initial = {};
    filteredSources.forEach((source) => {
      filteredTargets.forEach((target) => {
        const key = `${source.id}-${target.id}`;
        if (source.id === target.id) return;
        initial[key] = getCommonChildren(
          source.id.toString(),
          target.id.toString()
        );
      });
    });
    setCellContents(initial);
  }, [filteredSources, filteredTargets, childrenMap, getCommonChildren]);

  const handleDrop = (toKey) => {
    if (!dragItem || dragItem.fromKey === toKey) return;
    setCellContents((prev) => {
      const next = { ...prev };
      next[dragItem.fromKey] = next[dragItem.fromKey].filter(
        (id) => id !== dragItem.cid
      );
      next[toKey] = [...(next[toKey] || []), dragItem.cid];
      return next;
    });
    setDragItem(null);
  };

  return (
    <div ref={flowWrapperRef} className="bg-white rounded shadow">
      {/* Header */}
      <div className="flex justify-between items-center bg-white text-black px-4 py-2 cursor-pointer select-none">
        <span className="font-semibold">
          Kanban Matrix ({filteredSources.length}×{filteredTargets.length})
        </span>
      </div>

      {/* Matrix Table */}
      <div className="overflow-auto">
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
                <th className="sticky left-0 z-10 bg-gray-100 p-2 border border-gray-300 text-xs text-left">
                  {source.Name}
                </th>
                {filteredTargets.map((target) => {
                  const key = `${source.id}-${target.id}`;
                  if (source.id === target.id) {
                    return (
                      <td key={key} className="p-2 bg-gray-200 border border-gray-300 text-left">
                        —
                      </td>
                    );
                  }

                  const items = cellContents[key] || [];

                  return (
                    <td
                      key={key}
                      className="p-2 border border-gray-300 align-top min-w-30 max-w-30 w-30"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(key)}
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
      </div>
    </div>
  );
};

export default AppKanban;


import React from "react";
// influencers fetching is provided via AppContext
import EdgeMenu from "./hooks/flowEdgeMenu";
import StateDropdown, { ComparatorDropdown } from "./components/StateDropdown";
import LayerDropdown from './components/LayerDropdown';
import { useMatrixLogic } from './hooks/useMatrixLogic';
import ModalAddRow from "./components/ModalAddRow";
import { addRelationship, removeRelationship } from "./api";
import { ContextMenu, useMenuHandlers } from "./hooks/useContextMenu";
import { useAppContext } from "./AppContext";

const AppMatrix = () => {
  const {
    // State
    relationships,      // derived from parentChildMap
    forwardExists,      // derived from parentChildMap
    childrenMap,        // derived from parentChildMap
    loading,
    editingCell,
    hideEmpty,
    setHideEmpty,
    hoveredCell,
    setHoveredCell,
    hoveredFrom,
    setHoveredFrom,
    hoveredRowId,
    setHoveredRowId,
    flipped,
    setFlipped,
    selectedFromLayer,
    setSelectedFromLayer,
    selectedToLayer,
    setSelectedToLayer,
    differences,
    loadingDifferences,
    showDropdowns,
    setShowDropdowns,

    // Refs
    inputRef,
    flowWrapperRef,

    // Data
    filteredSources,
    filteredTargets,
    nameById,
    rowData,
    setRowData,
    edgeMap,
    layerOptions,
    comparatorState,
    rawDifferences,

    // Actions
    handleStateChange,
    handleCellClick,
    handleKeyDown,
    handleBlur,
    handleExportExcel,
    handleCopyDiff,
    handleRevertDiff,
    toggleDropdown,
    getRelationshipColor,

    // Menu
    menuRef,
    handleEdgeMenu,
    onMenuItemClick,

    // State scores
    stateScores,
    handleCalculateStateScores,
    getHighestScoringContainer,
    clearStateScores,
  } = useMatrixLogic();

  // Add state for children tooltip
  const [childrenTooltip, setChildrenTooltip] = React.useState(null);
  const [headerContextMenu, setHeaderContextMenu] = React.useState(null);
  const [useInfluencersView, setUseInfluencersView] = React.useState(false);
  const [showAddInfluencerModal, setShowAddInfluencerModal] = React.useState(false);
  const [modalCell, setModalCell] = React.useState({ sourceId: null, targetId: null });
  const [influencerMenu, setInfluencerMenu] = React.useState({ open: false, x: 0, y: 0, sourceId: null, targetId: null, items: [] });

  // From context: shared influencers cache and helpers
  const { influencersMap, refreshInfluencers, refreshInfluencerPair } = useAppContext();

  // Create a stable signature for current visible pairs to avoid duplicate fetches
  const pairsSignature = React.useMemo(() => {
    const sigParts = [];
    for (const s of filteredSources) {
      for (const t of filteredTargets) {
        if (!s?.id || !t?.id) continue;
        if (s.id === t.id) continue;
        const sourceId = flipped ? t.id : s.id;
        const targetId = flipped ? s.id : t.id;
        sigParts.push(`${String(sourceId)}::${String(targetId)}`);
      }
    }
    // Preserve order; join to a single string
    return sigParts.join("|");
  }, [filteredSources, filteredTargets, flipped]);

  // Build and fetch influencers for currently visible pairs using shared context
  const refreshVisibleInfluencers = React.useCallback(async () => {
    if (!useInfluencersView) return;
    const pairs = pairsSignature
      ? pairsSignature.split("|").map(k => k.split("::"))
      : [];
    await refreshInfluencers(pairs);
  }, [useInfluencersView, pairsSignature, refreshInfluencers]);

  // Fetch influencers when toggled on or filters/flip change
  React.useEffect(() => {
    refreshVisibleInfluencers();
  }, [refreshVisibleInfluencers]);

  // Handle adding influencer containers to a relationship
  const handleAddItem = React.useCallback(async (newRows) => {
    const { sourceId, targetId } = modalCell;
    if (!Array.isArray(newRows) || !sourceId || !targetId) {
      setShowAddInfluencerModal(false);
      return;
    }
    for (const row of newRows) {
      const containerId = row?.id;
      if (!containerId) continue;
      await addRelationship(containerId, sourceId, targetId, { label: "influences" });
    }
    // Refresh only this cell's influencers
    await refreshInfluencerPair(sourceId, targetId);
    setShowAddInfluencerModal(false);
  }, [modalCell, refreshInfluencerPair]);

  const menuHandlers = useMenuHandlers({
    rowData,
    setRowData,
    removeChildFromLayer: async () => { }, // Not used for headers
    flipped,
    childrenMap,
  });

  const headerMenuOptions = [
    { label: "Rename", onClick: menuHandlers.handleRename },
    { label: "Select", onClick: menuHandlers.handleSelect },
    { label: "Export", submenu: menuHandlers.exportMenu }, // <-- use submenu
  ];

  // Color coding and tooltip functions
  const RelationshipTooltip = ({ text, position }) => {
    if (!text) return null;
    return (
      <div
        style={{
          position: "fixed",
          top: position.y + 12,
          left: position.x + 12,
          zIndex: 1000,
          background: "rgba(0,0,0,0.85)",
          color: "#fff",
          padding: "8px 12px",
          borderRadius: "6px",
          fontSize: "13px",
          maxWidth: "320px",
          wordBreak: "break-word",
          pointerEvents: "none",
        }}
      >
        {text}
      </div>
    );
  };

  // Children tooltip component
  const ChildrenTooltip = ({ children, position }) => {
    if (!children || children.length === 0) return null;
    return (
      <div
        style={{
          position: "fixed",
          top: position.y + 12,
          left: position.x + 12,
          zIndex: 1001,
          background: "rgba(0,0,0,0.9)",
          color: "#fff",
          padding: "8px 12px",
          borderRadius: "6px",
          fontSize: "12px",
          maxWidth: "300px",
          wordBreak: "break-word",
          pointerEvents: "none",
        }}
      >
        <div className="font-semibold mb-1">Children:</div>
        <div>{children.map((cid) => nameById[cid] || cid).join(", ")}</div>
      </div>
    );
  };

  return (
    <div ref={flowWrapperRef} className="bg-white rounded shadow">
      {/* Header */}
      <div className="flex justify-between items-center bg-white text-black px-4 py-2 cursor-pointer select-none">
        <div className="flex items-center gap-4">
          <span className="font-semibold">
            Relationship Matrix ({filteredSources.length}×{filteredTargets.length} of {rowData.length} containers)
          </span>

          {/* State Management Dropdown */}
          <StateDropdown onStateChange={handleStateChange} />

          {/* Comparator State Dropdown - Using the new component */}
          <ComparatorDropdown />

          {/* Add the LayerDropdown component here */}
          <LayerDropdown
            buttonText="Global Filter"
            title="Hide layers globally (affects both Flow and Matrix)"
            dropdownTitle="Hide Layers Globally"
          />

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

          {/* Hide Empty Toggle Button */}
          <button
            className={`px-3 py-1 text-xs rounded transition-colors ${hideEmpty ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            onClick={() => setHideEmpty(!hideEmpty)}
            title={hideEmpty ? "Show all containers" : "Hide empty rows/columns"}
          >
            {hideEmpty ? "Show All" : "Hide Empty"}
          </button>

          {/* Flip Axis Button */}
          <button
            className="px-3 py-1 text-xs rounded bg-purple-500 text-white hover:bg-purple-600"
            onClick={() => setFlipped((f) => !f)}
            title="Flip rows and columns"
          >
            Flip Axis
          </button>

          {/* Export to Excel Button */}
          <button
            className="px-3 py-1 text-xs rounded bg-green-500 text-white hover:bg-green-600"
            onClick={handleExportExcel}
            title="Export current view to Excel"
          >
            Export to Excel
          </button>

          {/* Influencers View Toggle */}
          <label className="flex items-center gap-2 ml-2 text-xs text-gray-700" title="Show influencer containers per relationship">
            <input
              type="checkbox"
              checked={useInfluencersView}
              onChange={(e) => setUseInfluencersView(e.target.checked)}
            />
            Influencers
          </label>

          <button
            className="px-3 py-1 text-xs rounded bg-purple-500 text-white hover:bg-purple-600"
            onClick={handleCalculateStateScores}
            title={`Calculate propagated change scores for ${comparatorState} state`}
            disabled={!comparatorState}
          >
            Calculate Scores
          </button>

          <button
            className="px-3 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600"
            onClick={clearStateScores}
            title="Clear all state scores and highlighting"
            disabled={Object.keys(stateScores).length === 0}
          >
            Clear Scores
          </button>
        </div>

      </div>

      {/* Matrix content */}
      <div className={`transition-all duration-300 overflow-auto`} style={{ height: 700 }}>
        <div className="h-full flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-500">Loading relationships...</div>
            </div>
          ) : filteredSources.length === 0 || filteredTargets.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-500">
                {rowData.length === 0
                  ? "No data available. Load containers to populate the matrix."
                  : "No containers match the current filters. Adjust layer filters or toggle 'Show All'."}
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 m-4 mb-0 border border-gray-300 relative overflow-auto">
                <div className="overflow-x-auto overflow-y-auto w-full h-full" style={{ maxHeight: "600px" }}>
                  <table className="table-fixed border-collapse w-full">
                    <thead className="sticky top-0 z-20">
                      <tr>
                        {/* Top-left corner cell */}
                        <th className="sticky left-0 z-30 p-2 bg-gray-100 border border-gray-300 text-xs font-medium text-left min-w-30 max-w-30 w-30">
                          <div className="w-0 h-0 border-l-[50px] border-l-transparent border-b-[30px] border-b-gray-400 relative">
                            <span className="absolute -bottom-6 -left-12 text-xs">{flipped ? "To" : "From"}</span>
                            <span className="absolute -bottom-2 left-2 text-xs">{flipped ? "From" : "To"}</span>
                          </div>
                        </th>
                        {/* Column headers - only show filtered containers */}
                        {filteredTargets.map((container) => (
                          <th
                            key={container.id}
                            className="p-2 bg-gray-100 border border-gray-300 text-xs font-medium text-left truncate whitespace-nowrap min-w-30 max-w-30 w-30"
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setHeaderContextMenu({
                                x: e.clientX,
                                y: e.clientY,
                                cid: container.id.toString(),
                              });
                            }}
                          >
                            <div title={container.Name}>{container.Name}</div>
                          </th>
                        ))}
                        {/* Difference to comparator state column header */}
                        <th className="p-2 bg-blue-100 border border-gray-300 text-xs font-medium text-left truncate whitespace-nowrap min-w-40 max-w-40 w-40">
                          <div title={`Differences compared to ${comparatorState} state`}>
                            Difference to {comparatorState}
                            {loadingDifferences && <span className="ml-1">⏳</span>}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Only show filtered containers as rows */}
                      {filteredSources.map((sourceContainer) => (
                        <tr key={sourceContainer.id}>
                          {/* Row header */}
                          <th
                            className={`sticky left-0 z-10 p-2 border border-gray-300 text-xs font-medium text-left truncate whitespace-nowrap min-w-30 max-w-30 w-30 ${
                              // Check if this is the highest scoring container
                              getHighestScoringContainer() === sourceContainer.id.toString()
                                ? "bg-yellow-400"
                                : hoveredFrom && childrenMap[hoveredFrom]?.includes(sourceContainer.id.toString())
                                  ? "bg-yellow-100"
                                  : hoveredRowId === sourceContainer.id.toString()
                                    ? "bg-yellow-200"
                                    : "bg-gray-100"
                              }`}
                            onMouseEnter={(e) => {
                              setHoveredFrom(sourceContainer.id.toString());
                              setHoveredRowId(sourceContainer.id.toString());

                              // Show children tooltip if there are children
                              if (childrenMap[sourceContainer.id.toString()]?.length > 0) {
                                const rect = e.target.getBoundingClientRect();
                                setChildrenTooltip({
                                  children: childrenMap[sourceContainer.id.toString()],
                                  position: { x: rect.left, y: rect.top }
                                });
                              }
                            }}
                            onMouseLeave={() => {
                              setHoveredFrom(null);
                              setHoveredRowId(null);
                              setChildrenTooltip(null);
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setHeaderContextMenu({
                                x: e.clientX,
                                y: e.clientY,
                                cid: sourceContainer.id.toString(),
                              });
                            }}
                          >
                            <div className="whitespace-normal text-xs">
                              {sourceContainer.Name}
                              {/* Show score if available */}
                              {stateScores[sourceContainer.id] !== undefined && (
                                <div className="text-gray-600 text-xs mt-1">Score: {stateScores[sourceContainer.id].toFixed(3)}</div>
                              )}
                            </div>
                          </th>
                          {/* Data cells - only show filtered containers as columns */}
                          {filteredTargets.map((targetContainer) => {
                            // Flip the key if flipped
                            const key = flipped ? `${targetContainer.id}--${sourceContainer.id}` : `${sourceContainer.id}--${targetContainer.id}`;
                            const isEditing = !useInfluencersView && (editingCell?.key === key);
                            const baseValue = relationships[key] || "";
                            // Build display value depending on mode
                            let value = baseValue;
                            if (useInfluencersView) {
                              const [sId, tId] = flipped
                                ? [String(targetContainer.id), String(sourceContainer.id)]
                                : [String(sourceContainer.id), String(targetContainer.id)];
                              const infKey = `${sId}::${tId}`;
                              const influencers = Array.isArray(influencersMap[infKey]) ? influencersMap[infKey] : [];
                              if (influencers.length > 0) {
                                const labels = influencers
                                  .map((it) => (it?.container_name || it?.container_id || "").toString())
                                  .filter(Boolean);
                                // Show all labels, spaced with a blank line between
                                value = labels.join("\n\n");
                              } else {
                                value = "";
                              }
                            }

                            // Check if there's a difference for this specific relationship
                            const isDifferentFromComparator = comparatorState && (
                              flipped
                                ? rawDifferences[targetContainer.id]?.[sourceContainer.id]
                                : rawDifferences[sourceContainer.id]?.[targetContainer.id]
                            );
                            const isDiagonal = sourceContainer.id === targetContainer.id;

                            if (isDiagonal) {
                              return (
                                <td key={key} className="p-2 bg-gray-200 border border-gray-300 text-left">
                                  —
                                </td>
                              );
                            }

                            const edge = edgeMap[key];

                            return (
                              <td
                                key={key}
                                className={`p-1 border border-gray-300 text-left cursor-pointer hover:bg-gray-50 min-w-30 max-w-30 w-30 ${forwardExists[key] ? getRelationshipColor(value, isDifferentFromComparator) : "bg-white"
                                  }`}
                                onClick={() => {
                                  if (useInfluencersView) return; // suppress editing while influencers view is active
                                  flipped
                                    ? handleCellClick(targetContainer.id, sourceContainer.id)
                                    : handleCellClick(sourceContainer.id, targetContainer.id);
                                }}
                                onDoubleClick={() => {
                                  if (!useInfluencersView) return;
                                  const sId = flipped ? String(targetContainer.id) : String(sourceContainer.id);
                                  const tId = flipped ? String(sourceContainer.id) : String(targetContainer.id);
                                  setModalCell({ sourceId: sId, targetId: tId });
                                  setShowAddInfluencerModal(true);
                                }}
                                onContextMenu={(event) => {
                                  event.preventDefault();
                                  if (useInfluencersView) {
                                    const sId = flipped ? String(targetContainer.id) : String(sourceContainer.id);
                                    const tId = flipped ? String(sourceContainer.id) : String(targetContainer.id);
                                    const infKey = `${sId}::${tId}`;
                                    const items = Array.isArray(influencersMap[infKey]) ? influencersMap[infKey] : [];
                                    setInfluencerMenu({
                                      open: true,
                                      x: event.clientX,
                                      y: event.clientY,
                                      sourceId: sId,
                                      targetId: tId,
                                      items,
                                    });
                                  } else {
                                    handleEdgeMenu(event, edge);
                                  }
                                }}
                                onMouseEnter={(e) => {
                                  setHoveredRowId(sourceContainer.id.toString()); // Highlight the row header
                                  if (value || forwardExists[key]) {
                                    const rect = e.target.getBoundingClientRect();
                                    setHoveredCell({
                                      key,
                                      text: value || "Add label",
                                      position: { x: rect.left, y: rect.top },
                                    });
                                  }
                                }}
                                onMouseLeave={() => {
                                  setHoveredRowId(null); // Remove row header highlight
                                  setHoveredCell(null);
                                }}
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
                                  <span className="text-xs block whitespace-pre-line break-words">{value || "—"}</span>
                                )}
                              </td>
                            );
                          })}
                          {/* Difference to comparator state column */}
                          <td className="p-2 bg-blue-50 border border-gray-300 text-left min-w-40 max-w-40 w-40 relative">
                            <div className="flex items-start justify-between">
                              <div className="text-xs whitespace-pre-line break-words flex-1 pr-2">
                                {loadingDifferences ? (
                                  <span className="text-gray-500">Loading...</span>
                                ) : (
                                  differences[sourceContainer.id] || "No difference"
                                )}
                              </div>

                              {/* Dropdown button - only show if there are differences */}
                              {differences[sourceContainer.id] && differences[sourceContainer.id] !== "No difference" && (
                                <button
                                  onClick={() => toggleDropdown(sourceContainer.id)}
                                  className="text-gray-500 hover:text-gray-700 focus:outline-none text-sm"
                                >
                                  ⋮
                                </button>
                              )}
                            </div>

                            {/* Dropdown Menu */}
                            {showDropdowns[sourceContainer.id] && (
                              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-[140px]">
                                <button
                                  onClick={() => handleCopyDiff(sourceContainer.id)}
                                  className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 border-b border-gray-100"
                                >
                                  Copy Diff to Context
                                </button>
                                <button
                                  onClick={() => handleRevertDiff(sourceContainer.id)}
                                  className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  Revert Diff
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Render the tooltip only once, outside the table */}
                  {hoveredCell && <RelationshipTooltip text={hoveredCell.text} position={hoveredCell.position} />}
                  {/* Render children tooltip */}
                  {childrenTooltip && <ChildrenTooltip children={childrenTooltip.children} position={childrenTooltip.position} />}
                  {/* EdgeMenu component */}
                  <EdgeMenu
                    ref={menuRef}
                    onMenuItemClick={onMenuItemClick}
                    rowData={rowData}
                    setRowData={() => { }}
                    edges={filteredSources
                      .map((source) =>
                        filteredTargets.map((target) => ({
                          id: `${source.id}--${target.id}`,
                          source: source.id,
                          target: target.id,
                        }))
                      )
                      .flat()}
                    setEdges={() => { }}
                  />

                  {/* Modal to add influencer containers to a relationship */}
                  <ModalAddRow
                    isOpen={showAddInfluencerModal}
                    onClose={() => setShowAddInfluencerModal(false)}
                    onSelect={handleAddItem}
                  />

                  {/* Influencer context menu */}
                  {influencerMenu.open && (
                    <div
                      className="fixed bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[280px] text-sm"
                      style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                      onMouseLeave={() => setInfluencerMenu((m) => ({ ...m, open: false }))}
                    >
                      <div className="px-3 py-2 text-gray-500 border-b border-gray-100">Remove</div>
                      {influencerMenu.items.length === 0 ? (
                        <div className="px-3 py-2 text-gray-400">No influencers</div>
                      ) : (
                        influencerMenu.items.map((it) => {
                          const label = (it?.container_name || it?.container_id || "").toString();
                          const cid = it?.container_id;
                          return (
                            <button
                              key={`${influencerMenu.sourceId}::${influencerMenu.targetId}::${cid}`}
                              className="block w-full text-left px-3 py-2 hover:bg-gray-100"
                              onClick={async () => {
                                if (!cid) return;
                                await removeRelationship(cid, influencerMenu.sourceId, influencerMenu.targetId);
                                await refreshInfluencerPair(influencerMenu.sourceId, influencerMenu.targetId);
                                setInfluencerMenu((m) => ({ ...m, open: false }));
                              }}
                            >
                              {label || cid}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Instructions below the table */}
              <div className="mt-4 text-sm text-gray-600 flex-shrink-0">
                <p>• Click on any cell to edit the relationship</p>
                <p>• Press Enter to save, Escape to cancel</p>
                <p>• Diagonal cells (same container) are disabled</p>
                <p>• Headers are frozen for easy navigation</p>
                <p>• Use separate From/To layer filters to control rows and columns independently</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Click outside to close dropdowns - add this near the end of the return statement */}
      {Object.values(showDropdowns).some(Boolean) && <div className="fixed inset-0 z-0" onClick={() => setShowDropdowns({})} />}

      <ContextMenu
        contextMenu={headerContextMenu}
        setContextMenu={setHeaderContextMenu}
        menuOptions={headerMenuOptions}
      />
    </div>
  );
};

export default AppMatrix;

import React from "react";
import StateDropdown, { ComparatorDropdown } from "./components/StateDropdown";
import LayerDropdown from './components/LayerDropdown';
import { useMatrixLogic } from './hooks/useMatrixLogic';
import MatrixTable from "./components/MatrixTable";

const AppMatrix = () => {
  const {
    // State
    relationships,
    forwardExists,
    loading,
    editingCell,
    collapsed,
    setCollapsed,
    hideEmpty,
    setHideEmpty,
    setHoveredCell,
    childrenMap,
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
    edgeMap,
    layerOptions,
    comparatorState,

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
    handleEdgeMenu,

    // State scores
    stateScores,
    handleCalculateStateScores,
    getHighestScoringContainer,
    clearStateScores,
  } = useMatrixLogic();


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

        <button className="text-lg font-bold" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "Expand matrix" : "Collapse matrix"}>
          {collapsed ? "▼" : "▲"}
        </button>
      </div>

      {/* Matrix content */}
      <div className={`transition-all duration-300 overflow-auto`} style={{ height: collapsed ? 0 : 700 }}>
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
            <MatrixTable
              filteredSources={filteredSources}
              filteredTargets={filteredTargets}
              flipped={flipped}
              comparatorState={comparatorState}
              loadingDifferences={loadingDifferences}
              stateScores={stateScores}
              getHighestScoringContainer={getHighestScoringContainer}
              childrenMap={childrenMap}
              hoveredFrom={hoveredFrom}
              hoveredRowId={hoveredRowId}
              setHoveredFrom={setHoveredFrom}
              setHoveredRowId={setHoveredRowId}
              nameById={nameById}
              relationships={relationships}
              forwardExists={forwardExists}
              edgeMap={edgeMap}
              editingCell={editingCell}
              inputRef={inputRef}
              handleCellClick={handleCellClick}
              handleEdgeMenu={handleEdgeMenu}
              handleKeyDown={handleKeyDown}
              handleBlur={handleBlur}
              setHoveredCell={setHoveredCell}
              getRelationshipColor={getRelationshipColor}
              differences={differences}
              showDropdowns={showDropdowns}
              toggleDropdown={toggleDropdown}
              handleCopyDiff={handleCopyDiff}
              handleRevertDiff={handleRevertDiff}
            />
          )}
        </div>
      </div>

      {/* Click outside to close dropdowns - add this near the end of the return statement */}
      {Object.values(showDropdowns).some(Boolean) && <div className="fixed inset-0 z-0" onClick={() => setShowDropdowns({})} />}
    </div>
  );
};

export default AppMatrix;

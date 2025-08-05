import React from 'react';
import StateDropdown, { ComparatorDropdown } from './StateDropdown';
import LayerDropdown from './LayerDropdown';

const MatrixHeader = ({
  collapsed,
  setCollapsed,
  filteredSources,
  filteredTargets,
  rowData,
  handleStateChange,
  flipped,
  setFlipped,
  selectedFromLayer,
  setSelectedFromLayer,
  selectedToLayer,
  setSelectedToLayer,
  hideEmpty,
  setHideEmpty,
  layerOptions,
  handleExportExcel,
  handleCalculateStateScores,
  clearStateScores,
  comparatorState,
  stateScores,
  loadingDifferences
}) => {
  return (
    <div className="flex justify-between items-center bg-white text-black px-4 py-2 cursor-pointer select-none">
      <div className="flex items-center gap-4">
        <span className="font-semibold">
          Relationship Matrix ({filteredSources.length}×{filteredTargets.length} of {rowData.length} containers)
        </span>

        <StateDropdown onStateChange={handleStateChange} />
        <ComparatorDropdown />

        {/* Add the reusable LayerDropdown component */}
        <LayerDropdown 
          buttonText="Filter Layers"
          title="Filter layers in Matrix"
          dropdownTitle="Hide Layers in Matrix"
        />

        {/* From Layer Filter */}
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

        {/* To Layer Filter */}
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

        <button
          className={`px-3 py-1 text-xs rounded transition-colors ${
            hideEmpty ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
          onClick={() => setHideEmpty(!hideEmpty)}
          title={hideEmpty ? "Show all containers" : "Hide empty rows/columns"}
        >
          {hideEmpty ? "Show All" : "Hide Empty"}
        </button>

        <button
          className="px-3 py-1 text-xs rounded bg-purple-500 text-white hover:bg-purple-600"
          onClick={() => setFlipped((f) => !f)}
          title="Flip rows and columns"
        >
          Flip Axis
        </button>

        <button
          className="px-3 py-1 text-xs rounded bg-green-500 text-white hover:bg-green-600"
          onClick={handleExportExcel}
          title="Export current view"
        >
          Export Excel
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

      <button 
        className="text-lg font-bold" 
        onClick={() => setCollapsed((c) => !c)} 
        aria-label={collapsed ? "Expand matrix" : "Collapse matrix"}
      >
        {collapsed ? "▼" : "▲"}
      </button>
    </div>
  );
};

export default MatrixHeader;
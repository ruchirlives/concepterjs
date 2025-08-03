import React from 'react';
import StateDropdown from '../StateDropdown';

const FlowHeader = ({
  collapsed,
  setCollapsed,
  handleStateChange,
  handleCalculateStateScores,
  clearStateScores,
  comparatorState,
  stateScores,
  layerDropdownOpen,
  setLayerDropdownOpen,
  hiddenLayers,
  setHiddenLayers,
  layerOptions,
  toggleLayerVisibility
}) => {
  return (
    <div className="flex justify-between items-center bg-white text-black px-4 py-2 cursor-pointer select-none">
      <div className="flex items-center gap-4">
        <span className="font-semibold" onClick={() => setCollapsed((c) => !c)}>
          Flow Diagram
        </span>

        <StateDropdown onStateChange={handleStateChange} />

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

        <div className="relative">
          <button
            onClick={() => setLayerDropdownOpen(!layerDropdownOpen)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              hiddenLayers.size > 0
                ? "bg-orange-500 text-white hover:bg-orange-600"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            title="Filter layers"
          >
            Layers {hiddenLayers.size > 0 && `(${layerOptions.length - hiddenLayers.size}/${layerOptions.length})`}
          </button>

          {layerDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 min-w-48">
              <div className="p-2 border-b border-gray-200 text-xs font-medium text-gray-600">
                Hide Layers in Flow
              </div>
              <div className="max-h-60 overflow-y-auto">
                {layerOptions.length === 0 ? (
                  <div className="p-3 text-xs text-gray-500">No layers available</div>
                ) : (
                  layerOptions.map((layer) => (
                    <label
                      key={layer}
                      className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={hiddenLayers.has(layer)}
                        onChange={() => toggleLayerVisibility(layer)}
                        className="rounded border-gray-300"
                      />
                      <span className={hiddenLayers.has(layer) ? 'line-through text-gray-500' : ''}>
                        {layer}
                      </span>
                    </label>
                  ))
                )}
              </div>
              {hiddenLayers.size > 0 && (
                <div className="p-2 border-t border-gray-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setHiddenLayers(new Set());
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Show All Layers
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <button
        className="text-lg font-bold"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand flow diagram" : "Collapse flow diagram"}
      >
        {collapsed ? "▼" : "▲"}
      </button>
    </div>
  );
};

export default FlowHeader;
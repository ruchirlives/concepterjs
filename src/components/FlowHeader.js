import React from 'react';
import StateDropdown from './StateDropdown';
import LayerDropdown from './LayerDropdown';

const FlowHeader = ({
  collapsed,
  setCollapsed,
  handleStateChange,
  handleCalculateStateScores,
  clearStateScores,
  comparatorState,
  stateScores,
  children, // <-- add this
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

        <LayerDropdown
          buttonText="Layers"
          title="Filter layers in Flow"
          dropdownTitle="Hide Layers in Flow"
        />

        {children} {/* <-- render children inline here */}
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
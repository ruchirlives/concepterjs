import React from 'react';

const FlowNavigation = ({ activeGroup, history, setHistory, setActiveGroup, rowData }) => {
  if (!activeGroup) return null;

  return (
    <div
      className="absolute top-2 left-20 z-50 flex items-center space-x-4 bg-white bg-opacity-80 rounded shadow p-3"
      style={{ backdropFilter: 'blur(4px)' }}
    >
      <button
        className="bg-gray-200 rounded p-3"
        onClick={() => {
          const prev = history[history.length - 1] || null;
          setHistory(h => h.slice(0, -1));
          setActiveGroup(prev);
        }}
      >
        ← Back
      </button>

      <h1 className="text-lg font-bold p-3">
        {rowData.find(n => n.id === activeGroup)?.Name || activeGroup}
      </h1>
    </div>
  );
};

export default FlowNavigation;
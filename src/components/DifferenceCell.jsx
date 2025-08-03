import React from 'react';

const DifferenceCell = ({
  sourceContainer,
  differences,
  loadingDifferences,
  showDropdowns,
  toggleDropdown,
  handleCopyDiff,
  handleRevertDiff
}) => {
  const hasDifferences = differences[sourceContainer.id] && differences[sourceContainer.id] !== "No difference";

  return (
    <td className="p-2 bg-blue-50 border border-gray-300 text-left min-w-40 max-w-40 w-40 relative">
      <div className="flex items-start justify-between">
        <div className="text-xs whitespace-pre-line break-words flex-1 pr-2">
          {loadingDifferences ? (
            <span className="text-gray-500">Loading...</span>
          ) : (
            differences[sourceContainer.id] || "No difference"
          )}
        </div>

        {hasDifferences && (
          <button
            onClick={() => toggleDropdown(sourceContainer.id)}
            className="text-gray-500 hover:text-gray-700 focus:outline-none text-sm"
          >
            ⋮
          </button>
        )}
      </div>

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
  );
};

export default DifferenceCell;
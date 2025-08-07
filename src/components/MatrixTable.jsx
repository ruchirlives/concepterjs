import React from "react";
import MatrixCell from "./MatrixCell";
import DifferenceCell from "./DifferenceCell";

const MatrixTable = ({
  filteredSources,
  filteredTargets,
  flipped,
  comparatorState,
  loadingDifferences,
  stateScores,
  getHighestScoringContainer,
  childrenMap,
  hoveredFrom,
  hoveredRowId,
  setHoveredFrom,
  setHoveredRowId,
  nameById,
  relationships,
  forwardExists,
  edgeMap,
  editingCell,
  inputRef,
  handleCellClick,
  handleEdgeMenu,
  handleKeyDown,
  handleBlur,
  setHoveredCell,
  getRelationshipColor,
  differences,
  showDropdowns,
  toggleDropdown,
  handleCopyDiff,
  handleRevertDiff,
}) => {
  return (
    <div className="overflow-x-auto overflow-y-auto w-full h-full" style={{ maxHeight: "600px" }}>
      <table className="table-fixed border-collapse w-full">
        <thead className="sticky top-0 z-20">
          <tr>
            <th className="sticky left-0 z-30 p-2 bg-gray-100 border border-gray-300 text-xs font-medium text-left min-w-30 max-w-30 w-30">
              <div className="w-0 h-0 border-l-[50px] border-l-transparent border-b-[30px] border-b-gray-400 relative">
                <span className="absolute -bottom-6 -left-12 text-xs">{flipped ? "To" : "From"}</span>
                <span className="absolute -bottom-2 left-2 text-xs">{flipped ? "From" : "To"}</span>
              </div>
            </th>
            {filteredTargets.map((container) => (
              <th
                key={container.id}
                className="p-2 bg-gray-100 border border-gray-300 text-xs font-medium text-left truncate whitespace-nowrap min-w-30 max-w-30 w-30"
              >
                <div title={container.Name}>{container.Name}</div>
              </th>
            ))}
            <th className="p-2 bg-blue-100 border border-gray-300 text-xs font-medium text-left truncate whitespace-nowrap min-w-40 max-w-40 w-40">
              <div title={`Differences compared to ${comparatorState} state`}>
                Difference to {comparatorState}
                {loadingDifferences && <span className="ml-1">⏳</span>}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredSources.map((sourceContainer) => (
            <tr key={sourceContainer.id}>
              <th
                className={`sticky left-0 z-10 p-2 border border-gray-300 text-xs font-medium text-left truncate whitespace-nowrap min-w-30 max-w-30 w-30 ${
                  getHighestScoringContainer() === sourceContainer.id.toString()
                    ? "bg-yellow-400"
                    : hoveredFrom && childrenMap[hoveredFrom]?.includes(sourceContainer.id.toString())
                    ? "bg-yellow-100"
                    : hoveredRowId === sourceContainer.id.toString()
                    ? "bg-yellow-200"
                    : "bg-gray-100"
                }`}
                onMouseEnter={() => {
                  setHoveredFrom(sourceContainer.id.toString());
                  setHoveredRowId(sourceContainer.id.toString());
                }}
                onMouseLeave={() => {
                  setHoveredFrom(null);
                  setHoveredRowId(null);
                }}
              >
                <div title={sourceContainer.Name} className="whitespace-normal text-xs">
                  {sourceContainer.Name}
                  {stateScores[sourceContainer.id] !== undefined && (
                    <div className="text-gray-600 text-xs mt-1">Score: {stateScores[sourceContainer.id].toFixed(3)}</div>
                  )}
                  {childrenMap[sourceContainer.id.toString()]?.length > 0 && (
                    <div className="text-gray-400 text-xs mt-1 break-words">
                      ({childrenMap[sourceContainer.id.toString()].map((cid) => nameById[cid] || cid).join(", ")})
                    </div>
                  )}
                </div>
              </th>
              {filteredTargets.map((targetContainer) => (
                <MatrixCell
                  key={`${sourceContainer.id}-${targetContainer.id}`}
                  sourceContainer={sourceContainer}
                  targetContainer={targetContainer}
                  flipped={flipped}
                  relationships={relationships}
                  forwardExists={forwardExists}
                  edgeMap={edgeMap}
                  editingCell={editingCell}
                  inputRef={inputRef}
                  handleCellClick={handleCellClick}
                  handleEdgeMenu={handleEdgeMenu}
                  handleKeyDown={handleKeyDown}
                  handleBlur={handleBlur}
                  setHoveredRowId={setHoveredRowId}
                  setHoveredCell={setHoveredCell}
                  getRelationshipColor={getRelationshipColor}
                />
              ))}
              <DifferenceCell
                sourceContainer={sourceContainer}
                differences={differences}
                loadingDifferences={loadingDifferences}
                showDropdowns={showDropdowns}
                toggleDropdown={toggleDropdown}
                handleCopyDiff={handleCopyDiff}
                handleRevertDiff={handleRevertDiff}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MatrixTable;

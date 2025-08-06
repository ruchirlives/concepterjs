import React from 'react';

const MatrixCell = ({
  sourceContainer,
  targetContainer,
  flipped,
  relationships,
  forwardExists,
  edges,
  editingCell,
  inputRef,
  handleCellClick,
  handleEdgeMenu,
  handleKeyDown,
  handleBlur,
  setHoveredRowId,
  setHoveredCell,
  getRelationshipColor
}) => {
  const key = flipped ? `${targetContainer.id}-${sourceContainer.id}` : `${sourceContainer.id}-${targetContainer.id}`;
  const isEditing = editingCell?.key === key;
  const value = relationships[key] || "";
  const isDiagonal = sourceContainer.id === targetContainer.id;

  if (isDiagonal) {
    return (
      <td key={key} className="p-2 bg-gray-200 border border-gray-300 text-left">
        —
      </td>
    );
  }

  const edge = edges.find(
    (e) =>
      e.source === String(flipped ? targetContainer.id : sourceContainer.id) &&
      e.target === String(flipped ? sourceContainer.id : targetContainer.id)
  );

  return (
    <td
      key={key}
      className={`p-1 border border-gray-300 text-left cursor-pointer hover:bg-gray-50 min-w-30 max-w-30 w-30 ${
        forwardExists[key] ? getRelationshipColor(value) : "bg-white"
      }`}
      onClick={() =>
        flipped
          ? handleCellClick(targetContainer.id, sourceContainer.id)
          : handleCellClick(sourceContainer.id, targetContainer.id)
      }
      onContextMenu={(event) => {
        event.preventDefault();
        if (edge) {
          handleEdgeMenu(event, edge);
        }
      }}
      onMouseEnter={(e) => {
        setHoveredRowId(sourceContainer.id.toString());
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
        setHoveredRowId(null);
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
};

export default MatrixCell;
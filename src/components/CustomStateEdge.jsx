import { getBezierPath, BaseEdge, EdgeLabelRenderer } from "@xyflow/react";
import React from "react";

// Custom edge component with count-based label
export const CustomStateEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, data, label }) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // If no label or no changes, don't show label
  if (!label || label === "No difference" || label === 0) {
    return <BaseEdge id={id} path={edgePath} style={style} />;
  }

  const handleClick = () => {
    if (data?.onClick) {
      data.onClick();
    }
  };

  // Create tooltip text with breakdown
  const getTooltipText = () => {
    if (data?.counts) {
      const { added, changed, removed } = data.counts;
      const parts = [];
      if (added > 0) parts.push(`${added} addition${added !== 1 ? "s" : ""}`);
      if (changed > 0) parts.push(`${changed} change${changed !== 1 ? "s" : ""}`);
      if (removed > 0) parts.push(`${removed} removal${removed !== 1 ? "s" : ""}`);

      const summary = parts.join(", ");
      const fullText = data.fullChanges ? `\n\nClick to view details:\n${data.fullChanges}` : "";
      return `${summary}${fullText}`;
    }
    return data?.fullChanges ? `Click to view changes:\n${data.fullChanges}` : label;
  };

  // Display the label as-is (it will be in format like "+2 ~1 -3")
  const displayLabel = label;

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: "11px",
            fontWeight: "600",
            color: "#fff",
            background: "#1976d2",
            padding: "3px 8px",
            borderRadius: "10px",
            border: "2px solid #fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            minWidth: "20px",
            maxWidth: "200px",
            lineHeight: "1.2",
            textAlign: "center",
            pointerEvents: "all",
            fontFamily: "system-ui, -apple-system, sans-serif",
            cursor: data?.onClick ? "pointer" : "default",
            whiteSpace: "pre-line",
            wordWrap: "break-word",
            overflowWrap: "break-word",
          }}
          className="nodrag nopan"
          onClick={handleClick}
          title={getTooltipText()}
        >
          {displayLabel}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

import { getBezierPath, BaseEdge, EdgeLabelRenderer } from "@xyflow/react";
import React from "react";

// Custom edge component with proper label handling
export const CustomStateEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style = {}, data, label }) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  if (!label || label === "No difference") {
    return <BaseEdge id={id} path={edgePath} style={style} />;
  }

  // Truncate label to first 100 characters with ellipsis
  const truncateLabel = (text, maxLength = 100) => {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + "...";
  };

  const displayLabel = truncateLabel(label);

  const handleClick = () => {
    if (data?.onClick) {
      data.onClick();
    }
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: "10px",
            fontWeight: "500",
            color: "#333",
            background: "rgba(255,255,255,0.96)",
            padding: "4px 8px",
            borderRadius: "4px",
            border: "1px solid #ddd",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            maxWidth: "600px", // Increased to accommodate 300 characters
            lineHeight: "1.3",
            textAlign: "center",
            pointerEvents: "all",
            fontFamily: "system-ui, -apple-system, sans-serif",
            cursor: data?.onClick ? "pointer" : "default",
            whiteSpace: "pre-wrap", // Allow wrapping for longer text
            wordBreak: "break-word", // Break long words if needed
            // Removed textOverflow: "ellipsis" - let JS handle truncation
          }}
          className="nodrag nopan"
          onClick={handleClick}
          title={label} // Show full text on hover
        >
          {displayLabel}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

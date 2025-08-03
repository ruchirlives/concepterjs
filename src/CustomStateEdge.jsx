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

  // Improved word wrapping logic
  const wrapText = (text, maxLineLength = 40) => {
    const lines = text.split("\n");
    const wrappedLines = [];

    lines.forEach((line) => {
      if (line.length <= maxLineLength) {
        wrappedLines.push(line);
        return;
      }

      const words = line.split(" ");
      let currentLine = "";

      words.forEach((word) => {
        // Check if adding this word would exceed the line length
        const testLine = currentLine ? `${currentLine} ${word}` : word;

        if (testLine.length <= maxLineLength) {
          currentLine = testLine;
        } else {
          // If current line has content, push it and start a new line
          if (currentLine) {
            wrappedLines.push(currentLine);
            currentLine = word;
          } else {
            // If single word is too long, break it
            if (word.length > maxLineLength) {
              for (let i = 0; i < word.length; i += maxLineLength) {
                wrappedLines.push(word.slice(i, i + maxLineLength));
              }
              currentLine = "";
            } else {
              currentLine = word;
            }
          }
        }
      });

      // Don't forget the last line
      if (currentLine) {
        wrappedLines.push(currentLine);
      }
    });

    return wrappedLines;
  };

  const wrappedLines = wrapText(label);

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
            padding: "8px 10px",
            borderRadius: "6px",
            border: "1px solid #ddd",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            maxWidth: "350px",
            lineHeight: "1.4",
            textAlign: "left",
            pointerEvents: "all",
            fontFamily: "system-ui, -apple-system, sans-serif",
            cursor: data?.onClick ? "pointer" : "default",
          }}
          className="nodrag nopan"
          onClick={handleClick}
        >
          {wrappedLines.map((line, index) => (
            <div
              key={index}
              style={{
                marginBottom: index < wrappedLines.length - 1 ? "3px" : "0",
                wordBreak: "break-word",
                hyphens: "auto",
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

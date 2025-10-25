import { forwardRef, useImperativeHandle } from "react";

const MIN_NODE_WIDTH = 140;
const MAX_NODE_WIDTH = 420;
const MIN_NODE_HEIGHT = 32;
const TEXT_PADDING_X = 24;
const TEXT_PADDING_Y = 24;
const BASE_CHAR_WIDTH = 7.2;
const BASE_FONT_SIZE = 12;
const BASE_LINE_HEIGHT = 17;
const MARGIN = 32;
const LABEL_BAND_SIZE = 64;
const LABEL_TEXT_PADDING = 14;
const EDGE_ANCHOR_PADDING = 18;

const ROW_COLOR_PALETTE = [
  "#fef3c7",
  "#e0f2fe",
  "#ede9fe",
  "#fce7f3",
  "#dcfce7",
  "#fee2e2",
  "#f1f5f9",
];
const LABEL_CELL_BORDER = "rgba(148,163,184,0.7)";

const safeNumber = (value, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;

const escapeXml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const getMeasureContext = (() => {
  let canvas = null;
  let context = null;
  return () => {
    if (context) return context;
    if (typeof document === "undefined") return null;
    canvas = canvas || document.createElement("canvas");
    context = canvas.getContext("2d");
    if (context) {
      context.font = `${BASE_FONT_SIZE}px Inter, Arial, sans-serif`;
    }
    return context;
  };
})();

const measureLineWidth = (text = "") => {
  const ctx = getMeasureContext();
  if (ctx) {
    ctx.font = `${BASE_FONT_SIZE}px Inter, Arial, sans-serif`;
    return ctx.measureText(text).width;
  }
  return text.length * BASE_CHAR_WIDTH;
};

const splitLongWord = (word = "", maxWidth = 0) => {
  if (!word.length) return [""];
  if (!(maxWidth > 0)) return [word];
  const segments = [];
  let current = "";
  for (const char of word) {
    const candidate = `${current}${char}`;
    if (measureLineWidth(candidate) <= maxWidth || !current.length) {
      current = candidate;
    } else {
      segments.push(current);
      current = char;
    }
  }
  if (current.length) segments.push(current);
  return segments.length > 0 ? segments : [word];
};

const wrapWords = (words, maxWidth) => {
  if (!Array.isArray(words) || words.length === 0) {
    return [""];
  }
  if (!(maxWidth > 0)) {
    return [words.join(" ")];
  }
  const lines = [];
  let current = "";
  words.forEach((word) => {
    if (!word.length) return;
    const tentative = current.length ? `${current} ${word}` : word;
    if (measureLineWidth(tentative) <= maxWidth) {
      current = tentative;
      return;
    }

    if (current.length) {
      lines.push(current);
      current = "";
    }

    if (measureLineWidth(word) <= maxWidth) {
      current = word;
      return;
    }

    const segments = splitLongWord(word, maxWidth);
    segments.forEach((segment, index) => {
      if (measureLineWidth(segment) <= maxWidth) {
        if (index === segments.length - 1) {
          current = segment;
        } else {
          lines.push(segment);
        }
      } else {
        // Fallback to basic chunking if measurement fails to constrain width.
        const fallbackSize = Math.max(1, Math.floor(maxWidth / BASE_CHAR_WIDTH));
        const fallbackParts = segment.match(new RegExp(`.{1,${fallbackSize}}`, "g")) || [segment];
        fallbackParts.slice(0, -1).forEach((part) => lines.push(part));
        current = fallbackParts.at(-1) || "";
      }
    });
  });
  if (current.length) lines.push(current);
  return lines.length > 0 ? lines : [""];
};

const measureLabel = (label = "") => {
  const text = label ? label.toString().trim() : "";
  if (!text.length) {
    return {
      width: MIN_NODE_WIDTH,
      height: MIN_NODE_HEIGHT,
      lines: [""],
    };
  }

  const words = text.split(/\s+/).filter(Boolean);

  let width = MIN_NODE_WIDTH;
  const minContentWidth = Math.max(40, MIN_NODE_WIDTH - TEXT_PADDING_X);
  const maxContentWidth = Math.max(minContentWidth, MAX_NODE_WIDTH - TEXT_PADDING_X);

  let lines = wrapWords(words, maxContentWidth);
  if (!Array.isArray(lines) || !lines.length) {
    lines = [text];
  }

  const widestLine = lines.reduce((max, line) => {
    const measured = measureLineWidth(line);
    return Math.max(max, measured);
  }, 0);

  width = Math.max(width, Math.min(MAX_NODE_WIDTH, widestLine + TEXT_PADDING_X));
  if (width - TEXT_PADDING_X > maxContentWidth) {
    const adjustedMax = Math.max(40, width - TEXT_PADDING_X);
    lines = wrapWords(words, adjustedMax);
    const fallbackWidest = lines.reduce((max, line) => {
      const measured = measureLineWidth(line);
      return Math.max(max, measured);
    }, 0);
    width = Math.max(MIN_NODE_WIDTH, Math.min(MAX_NODE_WIDTH, fallbackWidest + TEXT_PADDING_X));
  }

  const height = Math.max(
    MIN_NODE_HEIGHT,
    TEXT_PADDING_Y + lines.length * BASE_LINE_HEIGHT
  );

  return {
    width,
    height,
    lines,
  };
};

const simplifyOrthogonalPath = (points = []) => {
  if (!Array.isArray(points)) return [];
  const simplified = [];
  points.forEach((point) => {
    if (!point) return;
    const { x, y } = point;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const last = simplified[simplified.length - 1];
    if (last && last.x === x && last.y === y) return;
    simplified.push({ x, y });
    if (simplified.length >= 3) {
      const a = simplified[simplified.length - 3];
      const b = simplified[simplified.length - 2];
      const c = simplified[simplified.length - 1];
      if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) {
        simplified.splice(simplified.length - 2, 1);
      }
    }
  });
  return simplified;
};

const FlowSvgExporter = forwardRef(
  (
    {
      nodes = [],
      edges = [],
      grid,
      viewport = { x: 0, y: 0, zoom: 1 },
      includeRows = true,
      includeColumns = true,
      fileName = "flow-grid-export.svg",
    },
    ref
  ) => {
    const serializeSvg = () => {
      const zoom = safeNumber(viewport?.zoom, 1);
      const translateX = safeNumber(viewport?.x, 0);
      const translateY = safeNumber(viewport?.y, 0);

      const boundsWidth = safeNumber(grid?.bounds?.width, 0);
      const boundsHeight = safeNumber(grid?.bounds?.height, 0);
      const rawRows = Array.isArray(grid?.rows) ? grid.rows : [];
      const rawColumns = Array.isArray(grid?.columns) ? grid.columns : [];
      const rows = includeRows ? rawRows : [];
      const columns = includeColumns ? rawColumns : [];
      const hasRows = rows.length > 0;
      const hasColumns = columns.length > 0;

      const resolveCellOption = (value) =>
        Number.isFinite(value) && value > 0 ? value : null;
      const optionWidth = resolveCellOption(grid?.cellOptions?.width);
      const optionHeight = resolveCellOption(grid?.cellOptions?.height);
      const optionAdjustedWidth = resolveCellOption(
        grid?.cellOptions?.adjustedWidth
      );
      const optionAdjustedHeight = resolveCellOption(
        grid?.cellOptions?.adjustedHeight
      );
      const effectiveCellWidth = optionAdjustedWidth ?? optionWidth;
      const effectiveCellHeight = optionAdjustedHeight ?? optionHeight;

      const ensurePositive = (value) =>
        Number.isFinite(value) && value > 0 ? value : null;

      const resolvedBoundsWidth = (() => {
        const columnCount = rawColumns.length;
        if (columnCount > 0) {
          if (ensurePositive(effectiveCellWidth)) {
            return effectiveCellWidth * columnCount;
          }
          const lastColumn = rawColumns[columnCount - 1];
          const span = ensurePositive(safeNumber(lastColumn?.right, null));
          if (span != null) return span;
        }
        return ensurePositive(boundsWidth) ?? 0;
      })();

      const resolvedBoundsHeight = (() => {
        const rowCount = rawRows.length;
        if (rowCount > 0) {
          if (ensurePositive(effectiveCellHeight)) {
            return effectiveCellHeight * rowCount;
          }
          const lastRow = rawRows[rowCount - 1];
          const span = ensurePositive(safeNumber(lastRow?.bottom, null));
          if (span != null) return span;
        }
        return ensurePositive(boundsHeight) ?? 0;
      })();

      let longestRowLabelWidth = 0;
      if (hasRows) {
        longestRowLabelWidth = rows.reduce((acc, row) => {
          const label = (row?.label || "").toString().trim();
          if (!label.length) return acc;
          const approximateWidth = label.length * BASE_CHAR_WIDTH;
          return Math.max(acc, approximateWidth);
        }, 0);
      }

      const rowLabelThickness = hasRows
        ? Math.max(LABEL_BAND_SIZE, longestRowLabelWidth + LABEL_TEXT_PADDING * 2)
        : 0;
      const columnLabelThickness = hasColumns ? LABEL_BAND_SIZE : 0;
      const contentTranslateX = translateX + rowLabelThickness;
      const contentTranslateY = translateY + columnLabelThickness;

      const shapes = [];
      const edgesOutput = [];
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      const registerBounds = (x, y, width, height) => {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const w = Number.isFinite(width) ? width : 0;
        const h = Number.isFinite(height) ? height : 0;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
      };

      const rowLabelCells = [];
      const columnLabelCells = [];
      // const rowColorEntries = [];
      const rowColorEntries = [];

      if (hasRows) {
        rows.forEach((row) => {
          const height = safeNumber(row?.height) * zoom;
          const contentTop = safeNumber(row?.top) * zoom + contentTranslateY;
          const rectWidth = resolvedBoundsWidth * zoom;
          const x = contentTranslateX;
          shapes.push({
            type: "row",
            x,
            y: contentTop,
            width: rectWidth,
            height,
            label: row?.label || "",
            labelCenterX: translateX + rowLabelThickness / 2,
            labelCenterY: contentTop + height / 2,
          });
          registerBounds(x, contentTop, rectWidth, height);
          registerBounds(translateX, contentTop, rowLabelThickness, height);

          rowLabelCells.push({
            x: translateX,
            y: contentTop,
            width: rowLabelThickness,
            height,
            label: row?.label || "",
          });

          const rawTop = safeNumber(row?.top);
          const rawBottom = safeNumber(row?.bottom);
          if (Number.isFinite(rawTop) && Number.isFinite(rawBottom)) {
            const color =
              ROW_COLOR_PALETTE[rowColorEntries.length % ROW_COLOR_PALETTE.length];
            rowColorEntries.push({
              top: rawTop,
              bottom: rawBottom,
              color,
            });
          }
        });
      }

      if (hasColumns) {
        columns.forEach((column) => {
          const width = safeNumber(column?.width) * zoom;
          const contentLeft = safeNumber(column?.left) * zoom + contentTranslateX;
          const rectHeight = resolvedBoundsHeight * zoom;
          const y = contentTranslateY;
          shapes.push({
            type: "column",
            x: contentLeft,
            y,
            width,
            height: rectHeight,
            label: column?.label || "",
            labelCenterX: contentLeft + width / 2,
            labelCenterY: translateY + columnLabelThickness / 2,
          });
          registerBounds(contentLeft, y, width, rectHeight);
          registerBounds(contentLeft, translateY, width, columnLabelThickness);

          columnLabelCells.push({
            x: contentLeft,
            y: translateY,
            width,
            height: columnLabelThickness,
            label: column?.label || "",
          });
        });
      }

      const nodeLayoutMap = new Map();
      const nodeRenderMap = new Map();
      nodes.forEach((node) => {
        const metrics = measureLabel(node?.data?.Name || node?.id);
        nodeLayoutMap.set(node.id, {
          width: metrics.width,
          height: metrics.height,
          lines: metrics.lines,
        });
      });

      nodes.forEach((node) => {
        const layout = nodeLayoutMap.get(node.id) || {
          width: MIN_NODE_WIDTH,
          height: MIN_NODE_HEIGHT,
          lines: [node?.data?.Name || node?.id || ""],
        };
        const baseX = safeNumber(node?.position?.x);
        const baseY = safeNumber(node?.position?.y);
        const widthUnits = layout.width;
        const heightUnits = layout.height;
        const x = contentTranslateX + baseX * zoom;
        const y = contentTranslateY + baseY * zoom;
        const width = widthUnits * zoom;
        const height = heightUnits * zoom;
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const flowCenterY = baseY + heightUnits / 2;
        let nodeFill = "#ffffff";
        for (let i = 0; i < rowColorEntries.length; i += 1) {
          const entry = rowColorEntries[i];
          if (
            Number.isFinite(entry.top) &&
            Number.isFinite(entry.bottom) &&
            flowCenterY >= entry.top &&
            flowCenterY <= entry.bottom
          ) {
            nodeFill = entry.color;
            break;
          }
        }
        shapes.push({
          type: "node",
          x,
          y,
          width,
          height,
          lines: layout.lines,
          fill: nodeFill,
        });
        registerBounds(x, y, width, height);
        nodeRenderMap.set(node.id, { x, y, width, height, centerX, centerY });
      });

      const edgeGroupCounts = new Map();
      (edges || []).forEach((edge) => {
        if (!edge?.source || !edge?.target) return;
        const key = `${edge.source}||${edge.target}`;
        edgeGroupCounts.set(key, (edgeGroupCounts.get(key) || 0) + 1);
      });
      const edgeGroupIndex = new Map();

      edges.forEach((edge) => {
        const sourceRect = nodeRenderMap.get(edge?.source);
        const targetRect = nodeRenderMap.get(edge?.target);
        if (!sourceRect || !targetRect) return;
        if (edge?.source === edge?.target) return;

        const key = `${edge.source}||${edge.target}`;
        const currentIndex = edgeGroupIndex.get(key) || 0;
        edgeGroupIndex.set(key, currentIndex + 1);
        const totalInGroup = edgeGroupCounts.get(key) || 1;
        const centeredIndex = totalInGroup > 1 ? currentIndex - (totalInGroup - 1) / 2 : 0;
        const offsetSpacing = 28;
        const maxOffset = 120;
        let perpendicularOffset = centeredIndex * offsetSpacing;
        perpendicularOffset = Math.max(-maxOffset, Math.min(maxOffset, perpendicularOffset));

        const sourceCenterX = sourceRect.x + sourceRect.width / 2;
        const sourceCenterY = sourceRect.y + sourceRect.height / 2;
        const targetCenterX = targetRect.x + targetRect.width / 2;
        const targetCenterY = targetRect.y + targetRect.height / 2;
        const dx = targetCenterX - sourceCenterX;
        const dy = targetCenterY - sourceCenterY;

        const dominantHorizontal = Math.abs(dx) >= Math.abs(dy);
        const points = [];
        const elbowPaddingMax = 36;
        const arrowGuard = 18;

        if (dominantHorizontal) {
          const direction = dx >= 0 ? 1 : -1;
          const rawStartX =
            direction >= 0 ? sourceRect.x + sourceRect.width : sourceRect.x;
          const rawEndX =
            direction >= 0 ? targetRect.x : targetRect.x + targetRect.width;
          const available = Math.max(0, Math.abs(rawEndX - rawStartX));
          const anchorPadding = Math.min(EDGE_ANCHOR_PADDING, available / 3);
          const start = {
            x: rawStartX + direction * anchorPadding,
            y: sourceCenterY,
          };
          const end = {
            x: rawEndX - direction * anchorPadding,
            y: targetCenterY,
          };
          const horizontalDistance = Math.max(0, Math.abs(end.x - start.x));
          const elbowLimit = Math.max(0, horizontalDistance / 2 - 6);
          const elbowPadding = Math.min(elbowPaddingMax, elbowLimit, Math.max(0, horizontalDistance / 3));
          const firstX = start.x + direction * elbowPadding;
          const lastX = end.x - direction * elbowPadding;
          const bendY = start.y + perpendicularOffset;
          const verticalSign = perpendicularOffset !== 0 ? Math.sign(perpendicularOffset) : (dy === 0 ? 1 : Math.sign(dy));
          const approachBendY = bendY === start.y ? bendY + verticalSign * arrowGuard : bendY;
          points.push(
            start,
            { x: firstX, y: start.y },
            { x: firstX, y: approachBendY },
            { x: lastX, y: approachBendY },
            { x: lastX, y: end.y },
            end
          );
        } else {
          const direction = dy >= 0 ? 1 : -1;
          const rawStartY =
            direction >= 0 ? sourceRect.y + sourceRect.height : sourceRect.y;
          const rawEndY =
            direction >= 0 ? targetRect.y : targetRect.y + targetRect.height;
          const available = Math.max(0, Math.abs(rawEndY - rawStartY));
          const anchorPadding = Math.min(EDGE_ANCHOR_PADDING, available / 3);
          const start = {
            x: sourceCenterX,
            y: rawStartY + direction * anchorPadding,
          };
          const end = {
            x: targetCenterX,
            y: rawEndY - direction * anchorPadding,
          };
          const verticalDistance = Math.max(0, Math.abs(end.y - start.y));
          const elbowLimit = Math.max(0, verticalDistance / 2 - 6);
          const elbowPadding = Math.min(elbowPaddingMax, elbowLimit, Math.max(0, verticalDistance / 3));
          const firstY = start.y + direction * elbowPadding;
          const lastY = end.y - direction * elbowPadding;
          const bendX = start.x + perpendicularOffset;
          const horizontalSign = perpendicularOffset !== 0 ? Math.sign(perpendicularOffset) : (dx === 0 ? 1 : Math.sign(dx));
          const approachBendX = bendX === start.x ? bendX + horizontalSign * arrowGuard : bendX;
          points.push(
            start,
            { x: start.x, y: firstY },
            { x: approachBendX, y: firstY },
            { x: approachBendX, y: lastY },
            { x: end.x, y: lastY },
            end
          );
        }

        // const xs = points.map((pt) => pt.x);
        // const ys = points.map((pt) => pt.y);
        // const minEdgeX = Math.min(...xs);
        // const maxEdgeX = Math.max(...xs);
        // const minEdgeY = Math.min(...ys);
        // const maxEdgeY = Math.max(...ys);
        const simplifiedPoints = simplifyOrthogonalPath(points);
        if (simplifiedPoints.length < 2) return;
        const xs = simplifiedPoints.map((pt) => pt.x);
        const ys = simplifiedPoints.map((pt) => pt.y);
        const minEdgeX = Math.min(...xs);
        const maxEdgeX = Math.max(...xs);
        const minEdgeY = Math.min(...ys);
        const maxEdgeY = Math.max(...ys);
        registerBounds(minEdgeX, minEdgeY, maxEdgeX - minEdgeX, maxEdgeY - minEdgeY);

        edgesOutput.push({ points: simplifiedPoints });
      });

      if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
        minX = 0;
        minY = 0;
        maxX = resolvedBoundsWidth || 0;
        maxY = resolvedBoundsHeight || 0;
      }

      const width = Math.max(1, maxX - minX);
      const height = Math.max(1, maxY - minY);
      const totalWidth = width + MARGIN * 2;
      const totalHeight = height + MARGIN * 2;
      const offsetX = MARGIN - minX;
      const offsetY = MARGIN - minY;

      const parts = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" font-family="Inter, Arial, sans-serif" font-size="12" fill="#0f172a">`,
        `<rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="#f8fafc" />`,
      ];
      parts.push(
        `<defs>
          <marker id="flowSvgArrow" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M 0 0 L 6 3 L 0 6 z" fill="#334155" />
          </marker>
        </defs>`
      );

      if (hasRows) {
        rowLabelCells.forEach((cell) => {
          const cellX = cell.x + offsetX;
          const cellY = cell.y + offsetY;
          parts.push(
            `<rect x="${cellX}" y="${cellY}" width="${cell.width}" height="${cell.height}" fill="#e2e8f0" stroke="${LABEL_CELL_BORDER}" />`
          );
          if (cell.label) {
            parts.push(
              `<text x="${cellX + LABEL_TEXT_PADDING}" y="${cellY + cell.height / 2}" fill="#0f172a" font-size="${Math.max(10, BASE_FONT_SIZE * 0.95)}" font-weight="600" dominant-baseline="middle">${escapeXml(cell.label)}</text>`
            );
          }
        });
      }

      if (hasColumns) {
        columnLabelCells.forEach((cell) => {
          const cellX = cell.x + offsetX;
          const cellY = cell.y + offsetY;
          parts.push(
            `<rect x="${cellX}" y="${cellY}" width="${cell.width}" height="${cell.height}" fill="#e2e8f0" stroke="${LABEL_CELL_BORDER}" />`
          );
          if (cell.label) {
            parts.push(
              `<text x="${cellX + cell.width / 2}" y="${cellY + cell.height / 2}" text-anchor="middle" fill="#0f172a" font-size="${Math.max(10, BASE_FONT_SIZE * 0.95)}" font-weight="600" dominant-baseline="middle">${escapeXml(cell.label)}</text>`
            );
          }
        });
      }

      shapes
        .filter((shape) => shape.type === "row")
        .forEach((row) => {
          const x = row.x + offsetX;
          const y = row.y + offsetY;
          parts.push(
            `<rect x="${x}" y="${y}" width="${row.width}" height="${row.height}" fill="rgba(148,163,184,0.08)" stroke="rgba(148,163,184,0.5)" />`
          );
          if (row.label && !hasRows) {
            const labelX = row.labelCenterX + offsetX;
            const labelY = row.labelCenterY + offsetY;
            parts.push(
              `<text x="${labelX}" y="${labelY}" fill="#0f172a" font-size="${Math.max(10, BASE_FONT_SIZE * 0.95)}" font-weight="600" dominant-baseline="middle" text-anchor="middle">${escapeXml(row.label)}</text>`
            );
          }
        });

      shapes
        .filter((shape) => shape.type === "column")
        .forEach((column) => {
          const x = column.x + offsetX;
          const y = column.y + offsetY;
          parts.push(
            `<rect x="${x}" y="${y}" width="${column.width}" height="${column.height}" fill="rgba(16,185,129,0.08)" stroke="rgba(16,185,129,0.4)" />`
          );
          if (column.label && !hasColumns) {
            const labelX = column.labelCenterX + offsetX;
            const labelY = column.labelCenterY + offsetY;
            parts.push(
              `<text x="${labelX}" y="${labelY}" text-anchor="middle" fill="#0f172a" font-size="${Math.max(10, BASE_FONT_SIZE * 0.95)}" font-weight="600" dominant-baseline="middle">${escapeXml(
                column.label
              )}</text>`
            );
          }
        });

      edgesOutput.forEach((edge) => {
        const pathData = edge.points
          .map((pt, index) => `${index === 0 ? "M" : "L"} ${pt.x + offsetX} ${pt.y + offsetY}`)
          .join(" ");
        parts.push(
          `<path d="${pathData}" stroke="#334155" stroke-width="2" fill="none" stroke-linecap="round" marker-end="url(#flowSvgArrow)" />`
        );
      });

      shapes
        .filter((shape) => shape.type === "node")
        .forEach((node) => {
          const x = node.x + offsetX;
          const y = node.y + offsetY;
          const cornerRadius = Math.max(4, 12 * zoom);
          const strokeWidth = Math.max(1, 1.5 * zoom);
          const fontSize = Math.max(8, BASE_FONT_SIZE * zoom);
          const lineSpacing = Math.max(fontSize * 1.35, BASE_LINE_HEIGHT * zoom);
          const textPaddingX = Math.max(8, (TEXT_PADDING_X / 2) * zoom);
          const textPaddingY = Math.max(8, (TEXT_PADDING_Y / 2) * zoom);
          const textX = x + textPaddingX;
          const firstLineY = y + textPaddingY;
          const lines = Array.isArray(node.lines) && node.lines.length
            ? node.lines
            : [""];
          const fillColor = node.fill || "#ffffff";
          parts.push(
            `<rect x="${x}" y="${y}" width="${node.width}" height="${node.height}" rx="${cornerRadius}" ry="${cornerRadius}" fill="${fillColor}" stroke="#1e293b" stroke-width="${strokeWidth}" />`
          );
          let textContent = `<text x="${textX}" y="${firstLineY}" fill="#0f172a" font-size="${fontSize}" dominant-baseline="hanging">`;
          lines.forEach((line, index) => {
            const content = escapeXml(line) || " ";
            if (index === 0) {
              textContent += content;
            } else {
              textContent += `<tspan x="${textX}" dy="${lineSpacing}">${content}</tspan>`;
            }
          });
          textContent += "</text>";
          parts.push(textContent);
        });

      parts.push("</svg>");
      return parts.join("");
    };

    const triggerDownload = (svgString, targetFileName) => {
      if (!svgString) return;
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = targetFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    useImperativeHandle(ref, () => ({
      exportSvg(customFileName) {
        const svgString = serializeSvg();
        if (!svgString) return false;
        const chosenName =
          typeof customFileName === "string" && customFileName.trim()
            ? customFileName.trim()
            : fileName;
        triggerDownload(svgString, chosenName);
        return true;
      },
    }));

    return null;
  }
);

export default FlowSvgExporter;

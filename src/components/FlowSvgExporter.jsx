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

const wrapWords = (words, maxChars) => {
  if (!Array.isArray(words) || words.length === 0) {
    return [""];
  }
  const chunkSize = Math.max(1, maxChars);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const segment = current.length ? `${current} ${word}` : word;
    if (segment.length <= chunkSize) {
      current = segment;
    } else {
      if (current.length) lines.push(current);
      if (word.length > chunkSize) {
        const parts = word.match(new RegExp(`.{1,${chunkSize}}`, "g")) || [word];
        lines.push(...parts.slice(0, -1));
        current = parts.at(-1) || "";
      } else {
        current = word;
      }
    }
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
  const longestWord = words.reduce((max, word) => Math.max(max, word.length), 0);

  let width = Math.max(
    MIN_NODE_WIDTH,
    Math.min(MAX_NODE_WIDTH, text.length * BASE_CHAR_WIDTH + TEXT_PADDING_X)
  );
  width = Math.max(width, Math.min(MAX_NODE_WIDTH, longestWord * BASE_CHAR_WIDTH + TEXT_PADDING_X));

  const maxCharsPerLine = Math.max(
    8,
    Math.floor((width - TEXT_PADDING_X) / BASE_CHAR_WIDTH)
  );

  let lines = wrapWords(words, maxCharsPerLine);
  const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
  width = Math.max(
    width,
    Math.min(MAX_NODE_WIDTH, longestLine * BASE_CHAR_WIDTH + TEXT_PADDING_X)
  );

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
      const rows = includeRows && Array.isArray(grid?.rows) ? grid.rows : [];
      const columns =
        includeColumns && Array.isArray(grid?.columns) ? grid.columns : [];
      const hasRows = includeRows && rows.length > 0;
      const hasColumns = includeColumns && columns.length > 0;

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

      if (hasRows) {
        rows.forEach((row) => {
          const height = safeNumber(row?.height) * zoom;
          const contentTop = safeNumber(row?.top) * zoom + contentTranslateY;
          const rectWidth = boundsWidth * zoom;
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
        });
      }

      if (hasColumns) {
        columns.forEach((column) => {
          const width = safeNumber(column?.width) * zoom;
          const contentLeft = safeNumber(column?.left) * zoom + contentTranslateX;
          const rectHeight = boundsHeight * zoom;
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
        shapes.push({
          type: "node",
          x,
          y,
          width,
          height,
          lines: layout.lines,
        });
        registerBounds(x, y, width, height);
        nodeRenderMap.set(node.id, { x, y, width, height, centerX, centerY });
      });

      const nodeCenter = (nodeId) => {
        const metrics = nodeRenderMap.get(nodeId);
        if (!metrics) return null;
        return { x: metrics.centerX, y: metrics.centerY };
      };

      edges.forEach((edge) => {
        const source = nodeCenter(edge?.source);
        const target = nodeCenter(edge?.target);
        if (!source || !target) return;
        const minEdgeX = Math.min(source.x, target.x);
        const minEdgeY = Math.min(source.y, target.y);
        const maxEdgeX = Math.max(source.x, target.x);
        const maxEdgeY = Math.max(source.y, target.y);
        registerBounds(minEdgeX, minEdgeY, maxEdgeX - minEdgeX, maxEdgeY - minEdgeY);
        edgesOutput.push({
          x1: source.x,
          y1: source.y,
          x2: target.x,
          y2: target.y,
        });
      });

      if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
        minX = 0;
        minY = 0;
        maxX = boundsWidth || 0;
        maxY = boundsHeight || 0;
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
        parts.push(
          `<line x1="${edge.x1 + offsetX}" y1="${edge.y1 + offsetY}" x2="${edge.x2 + offsetX}" y2="${edge.y2 + offsetY}" stroke="#334155" stroke-width="2" stroke-linecap="round" />`
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
          parts.push(
            `<rect x="${x}" y="${y}" width="${node.width}" height="${node.height}" rx="${cornerRadius}" ry="${cornerRadius}" fill="#ffffff" stroke="#1e293b" stroke-width="${strokeWidth}" />`
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

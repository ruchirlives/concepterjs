import { forwardRef, useImperativeHandle } from "react";

const MIN_NODE_WIDTH = 140;
const MAX_NODE_WIDTH = 600;
const MIN_NODE_HEIGHT = 32;
const TEXT_PADDING_X = 24;
const TEXT_PADDING_Y = 24;
const BASE_CHAR_WIDTH = 7.2;
const BASE_FONT_SIZE = 12;
const BASE_LINE_HEIGHT = 17;
const META_FONT_SIZE = 10;
const META_LINE_HEIGHT = 15;
const TITLE_FONT_WEIGHT = 600;
const META_FONT_WEIGHT = 500;
const PRIMARY_TEXT_COLOR = "#0f172a";
const SECONDARY_TEXT_COLOR = "#475569";
const BUDGET_TEXT_COLOR = "#1d4ed8";
const NODE_FILL_COLOR = "#ffffff";
const NODE_STROKE_COLOR = "#1e293b";
const EDGE_STROKE_COLOR = "#334155";
const BACKGROUND_COLOR = "#f8fafc";
const LABEL_CELL_FILL = "#e2e8f0";
const ROW_BAND_FILL = "rgba(148,163,184,0.08)";
const ROW_BORDER_COLOR = "rgba(148,163,184,0.5)";
const COLUMN_BAND_FILL = "rgba(16,185,129,0.08)";
const COLUMN_BORDER_COLOR = "rgba(16,185,129,0.4)";
const MARGIN = 32;
const LABEL_BAND_SIZE = 64;
const LABEL_TEXT_PADDING = 14;
const EDGE_ANCHOR_PADDING = 18;
const LABEL_FONT_SIZE = 12;
const LABEL_LINE_HEIGHT = 16;
const LABEL_CELL_CORNER_RADIUS = 12;
const ROW_BAND_FILL_ALT = "rgba(148,163,184,0.03)";
const COLUMN_BAND_FILL_ALT = "rgba(16,185,129,0.03)";
const FRAME_BORDER_COLOR = "rgba(15,23,42,0.12)";
const FRAME_BORDER_WIDTH = 1;
const BACKGROUND_PATTERN_ID = "flowBackgroundGrid";
const BACKGROUND_GRID_SIZE = 24;
const BACKGROUND_GRID_STROKE_COLOR = "#cbd5f5";
const BACKGROUND_GRID_STROKE_OPACITY = 0.4;
const BACKGROUND_GRID_STROKE_WIDTH = 0.6;
const BACKGROUND_PATTERN_OPACITY = 0.45;
const NODE_SHADOW_FILTER_ID = "flowNodeShadow";
const LABEL_SHADOW_FILTER_ID = "flowLabelShadow";
const NODE_SHADOW_COLOR = "#0f172a";
const NODE_SHADOW_OPACITY = 0.18;
const LABEL_SHADOW_COLOR = "#1e293b";
const LABEL_SHADOW_OPACITY = 0.16;
const NODE_TEXT_STROKE_COLOR = "rgba(255,255,255,0.75)";
const NODE_TEXT_STROKE_WIDTH = 1.1;
const EDGE_HALO_COLOR = "#f8fafc";
const EDGE_HALO_OPACITY = 0.7;
const EDGE_HALO_EXTRA_WIDTH = 2.4;

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
    return context;
  };
})();

const resolveFontSize = (value, fallback = BASE_FONT_SIZE) => {
  const size = Number(value);
  if (Number.isFinite(size) && size > 0) {
    return size;
  }
  return fallback;
};

const measureLineWidth = (text = "", fontSize = BASE_FONT_SIZE) => {
  const ctx = getMeasureContext();
  if (ctx) {
    const resolvedFontSize = resolveFontSize(fontSize);
    ctx.font = `${resolvedFontSize}px Inter, Arial, sans-serif`;
    return ctx.measureText(text).width;
  }
  const resolvedFontSize = resolveFontSize(fontSize);
  const charWidth = (resolvedFontSize / BASE_FONT_SIZE) * BASE_CHAR_WIDTH;
  return (text.length * charWidth) + 50;
};

const splitLongWord = (word = "", maxWidth = 0, fontSize = BASE_FONT_SIZE) => {
  if (!word.length) return [""];
  if (!(maxWidth > 0)) return [word];
  const segments = [];
  let current = "";
  for (const char of word) {
    const candidate = `${current}${char}`;
    if (measureLineWidth(candidate, fontSize) <= maxWidth || !current.length) {
      current = candidate;
    } else {
      segments.push(current);
      current = char;
    }
  }
  if (current.length) segments.push(current);
  return segments.length > 0 ? segments : [word];
};

const wrapWords = (words, maxWidth, fontSize = BASE_FONT_SIZE) => {
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
    if (measureLineWidth(tentative, fontSize) + TEXT_PADDING_Y <= maxWidth) {
      current = tentative;
      return;
    }

    if (current.length) {
      lines.push(current);
      current = "";
    }

    if (measureLineWidth(word, fontSize) <= maxWidth) {
      current = word;
      return;
    }

    const segments = splitLongWord(word, maxWidth, fontSize);
    segments.forEach((segment, index) => {
      if (measureLineWidth(segment, fontSize) <= maxWidth) {
        if (index === segments.length - 1) {
          current = segment;
        } else {
          lines.push(segment);
        }
      } else {
        // Fallback to basic chunking if measurement fails to constrain width.
        const fallbackCharWidth =
          (resolveFontSize(fontSize) / BASE_FONT_SIZE) * BASE_CHAR_WIDTH;
        const fallbackSize = Math.max(1, Math.floor(maxWidth / fallbackCharWidth));
        const fallbackParts = segment.match(new RegExp(`.{1,${fallbackSize}}`, "g")) || [segment];
        fallbackParts.slice(0, -1).forEach((part) => lines.push(part));
        current = fallbackParts.at(-1) || "";
      }
    });
  });
  if (current.length) lines.push(current);
  return lines.length > 0 ? lines : [""];
};

const TEXT_STYLE_KEYS = ["fontSize", "lineHeight", "fontWeight", "color"];

const collectStyleOverrides = (segment) => {
  const overrides = {};
  const sources = [];
  if (segment && typeof segment === "object") {
    sources.push(segment);
    if (segment.style && typeof segment.style === "object") {
      sources.push(segment.style);
    }
  }
  sources.forEach((source) => {
    TEXT_STYLE_KEYS.forEach((key) => {
      if (overrides[key] != null) return;
      const value = source[key];
      if (value == null) return;
      if (key === "color") {
        if (typeof value === "string" && value.trim()) {
          overrides.color = value.trim();
        }
        return;
      }
      const numericValue = Number(value);
      if (Number.isFinite(numericValue)) {
        overrides[key] = numericValue;
      }
    });
  });
  return overrides;
};

const baseTextStyleForSegment = (segment, index = 0) => {
  const type = segment?.type;
  if (type === "title" || index === 0) {
    return {
      fontSize: BASE_FONT_SIZE,
      lineHeight: BASE_LINE_HEIGHT,
      fontWeight: TITLE_FONT_WEIGHT,
      color: PRIMARY_TEXT_COLOR,
    };
  }
  if (type === "score") {
    return {
      fontSize: META_FONT_SIZE,
      lineHeight: META_LINE_HEIGHT,
      fontWeight: META_FONT_WEIGHT,
      color: SECONDARY_TEXT_COLOR,
    };
  }
  if (type === "budget") {
    return {
      fontSize: META_FONT_SIZE,
      lineHeight: META_LINE_HEIGHT,
      fontWeight: META_FONT_WEIGHT,
      color: BUDGET_TEXT_COLOR,
    };
  }
  return {
    fontSize: META_FONT_SIZE,
    lineHeight: META_LINE_HEIGHT,
    fontWeight: META_FONT_WEIGHT,
    color: PRIMARY_TEXT_COLOR,
  };
};

const normalizeSegment = (segment, index = 0) => {
  const baseStyle = baseTextStyleForSegment(segment, index);
  const overrides = collectStyleOverrides(segment);
  const fontSize = resolveFontSize(overrides.fontSize, baseStyle.fontSize);
  const defaultLineHeight = baseStyle.lineHeight > 0
    ? baseStyle.lineHeight
    : Math.ceil(fontSize * 1.35);
  const lineHeight = Number.isFinite(overrides.lineHeight) && overrides.lineHeight > 0
    ? overrides.lineHeight
    : Math.max(defaultLineHeight, Math.ceil(fontSize * 1.3));
  const fontWeight = Number.isFinite(overrides.fontWeight)
    ? overrides.fontWeight
    : baseStyle.fontWeight;
  const color = overrides.color || baseStyle.color;
  const rawText = (() => {
    if (!segment) return "";
    if (typeof segment === "string") return segment;
    if (typeof segment.text === "string") return segment.text;
    if (segment.text != null) return String(segment.text);
    return "";
  })();
  const text = rawText.replace(/\s+/g, " ").trim();
  return {
    text,
    fontSize,
    lineHeight: Math.max(8, lineHeight),
    fontWeight,
    color,
  };
};

const buildNodeTextSegments = (node = {}) => {
  const segments = [];
  const data = node?.data ?? {};

  const normalize = (value) => {
    if (value == null) return "";
    return String(value).replace(/\s+/g, " ").trim();
  };

  const primary = normalize(data?.Name ?? node?.id ?? "");
  segments.push({
    text: primary || "",
    type: "title",
  });

  const formatScore = (value) => {
    if (!Number.isFinite(value)) return null;
    return value.toFixed(3);
  };
  const formatPercent = (value) => {
    if (!Number.isFinite(value)) return null;
    return `${Math.round(value * 100)}%`;
  };

  const scoreValue = formatScore(data?.score);
  if (scoreValue != null) {
    const scoreParts = [`Score: ${scoreValue}`];
    const normalizedPercent = formatPercent(data?.normalizedScore);
    if (normalizedPercent) {
      scoreParts.push(`(${normalizedPercent})`);
    }
    segments.push({
      text: scoreParts.join(" "),
      type: "score",
    });
  }

  const hasBudget = data?.Budget !== undefined && data?.Budget !== null;
  if (hasBudget) {
    const budgetText = normalize(data?.Budget);
    const costText = data?.Cost !== undefined && data?.Cost !== null ? normalize(data?.Cost) : null;
    const hasBudgetValue = budgetText.length > 0;
    const hasCostValue = costText && costText.length > 0;
    if (hasBudgetValue || hasCostValue) {
      const combined = hasCostValue
        ? `Budget: ${hasBudgetValue ? budgetText : "--"} (funds: ${costText})`
        : `Budget: ${budgetText}`;
      segments.push({
        text: combined,
        type: "budget",
      });
    }
  }

  return segments;
};

const clampValue = (value, min, max) => {
  if (!Number.isFinite(value)) return Number.isFinite(min) ? min : value;
  let next = value;
  if (Number.isFinite(min)) {
    next = Math.max(min, next);
  }
  if (Number.isFinite(max)) {
    next = Math.min(max, next);
  }
  return next;
};

const pickPositive = (...values) => {
  for (const value of values) {
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return null;
};

const extractNodeSize = (node = {}) => {
  const width = pickPositive(
    node?.width,
    node?.measured?.width,
    node?.style?.width,
    node?.__rf?.width,
    node?.data?.width
  );
  const height = pickPositive(
    node?.height,
    node?.measured?.height,
    node?.style?.height,
    node?.__rf?.height,
    node?.data?.height
  );
  return { width, height };
};

const measureNodeContent = (node = {}, options = {}) => {
  const builtSegments = buildNodeTextSegments(node);
  const rawSegments = Array.isArray(builtSegments) ? builtSegments : [];
  const segments = (rawSegments.length ? rawSegments : [{ text: "", type: "title" }])
    .map((segment, index) => normalizeSegment(segment, index));
  const paddingX = Number.isFinite(options?.paddingX) && options.paddingX > 0
    ? options.paddingX
    : TEXT_PADDING_X;
  const paddingY = Number.isFinite(options?.paddingY) && options.paddingY > 0
    ? options.paddingY
    : TEXT_PADDING_Y;
  const resolvedPreferredWidth = Number.isFinite(options?.preferredWidth)
    && options.preferredWidth > 0
    ? options.preferredWidth
    : null;
  const resolvedPreferredHeight = Number.isFinite(options?.preferredHeight)
    && options.preferredHeight > 0
    ? options.preferredHeight
    : null;

  const minNodeWidth = resolvedPreferredWidth != null
    ? Math.max(24, resolvedPreferredWidth)
    : MIN_NODE_WIDTH;
  const maxNodeWidth = resolvedPreferredWidth != null
    ? Math.max(minNodeWidth, resolvedPreferredWidth)
    : MAX_NODE_WIDTH;

  const minContentWidth = Math.max(32, minNodeWidth - paddingX);
  const maxContentWidth = Math.max(minContentWidth, maxNodeWidth - paddingX);

  const wrapSegments = (limit) => {
    const contentLimit = Math.max(minContentWidth, Math.min(limit, maxContentWidth));
    const wrappedLines = [];
    let computedWidth = minNodeWidth;
    segments.forEach((segment) => {
      const textValue = segment.text || "";
      const words = textValue.length ? textValue.split(/\s+/) : [""];
      const lines = wrapWords(words, contentLimit, segment.fontSize);
      const safeLines = Array.isArray(lines) && lines.length ? lines : [textValue || ""];
      safeLines.forEach((line) => {
        const normalizedLine = typeof line === "string" ? line.trim() : String(line || "").trim();
        wrappedLines.push({
          text: normalizedLine,
          fontSize: segment.fontSize,
          lineHeight: segment.lineHeight,
          fontWeight: segment.fontWeight,
          color: segment.color,
        });
        const measured = measureLineWidth(normalizedLine, segment.fontSize);
        const widthWithPadding = Math.min(
          maxNodeWidth,
          Math.max(minNodeWidth, measured + paddingX)
        );
        computedWidth = Math.max(computedWidth, widthWithPadding);
      });
    });
    return { width: computedWidth, lines: wrappedLines };
  };

  let { width, lines } = wrapSegments(maxContentWidth);
  width = clampValue(width, minNodeWidth, maxNodeWidth);

  const targetContentWidth = Math.max(minContentWidth, width - paddingX);
  if (resolvedPreferredWidth == null && targetContentWidth < maxContentWidth) {
    const rerun = wrapSegments(targetContentWidth);
    width = clampValue(rerun.width, minNodeWidth, maxNodeWidth);
    lines = rerun.lines;
  } else if (resolvedPreferredWidth != null) {
    const rerun = wrapSegments(targetContentWidth);
    width = clampValue(Math.max(width, resolvedPreferredWidth), minNodeWidth, maxNodeWidth);
    lines = rerun.lines;
  }

  if (!Array.isArray(lines) || !lines.length) {
    const fallback = segments[0] || normalizeSegment({ text: "" }, 0);
    lines = [
      {
        text: "",
        fontSize: fallback.fontSize,
        lineHeight: fallback.lineHeight,
        fontWeight: fallback.fontWeight,
        color: fallback.color,
      },
    ];
  }

  const totalLineHeight = lines.reduce((sum, line) => {
    const value = Number(line?.lineHeight);
    const safeValue = Number.isFinite(value) && value > 0 ? value : BASE_LINE_HEIGHT;
    return sum + safeValue;
  }, 0);

  const minNodeHeight = resolvedPreferredHeight != null
    ? Math.max(24, resolvedPreferredHeight)
    : MIN_NODE_HEIGHT;

  const height = Math.max(
    minNodeHeight,
    paddingY + totalLineHeight
  );

  return {
    width,
    height,
    lines,
  };
};

const createVisualSizing = (zoom = 1) => {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const scale = Math.sqrt(safeZoom);
  const clampedScale = clampValue(scale, 0.7, 1.6);
  const nodePaddingX = clampValue(14 * clampedScale, 10, 28);
  const nodePaddingY = clampValue(18 * clampedScale, 12, 36);
  const cornerRadius = clampValue(12 * clampedScale, 6, 22);
  const strokeWidth = clampValue(1.6 * clampedScale, 1, 3);
  const textScale = clampValue(clampedScale, 0.8, 1.45);
  const lineSpacingFactor = clampValue(1.18 + (clampedScale - 1) * 0.35, 1.15, 1.5);
  const edgeStrokeWidth = clampValue(2 * clampedScale, 1.5, 3.2);
  const arrowHeadLength = clampValue(7 * clampedScale, 5, 9.5);
  const arrowHeadWidth = clampValue(arrowHeadLength * 0.6, 3.5, 6.4);
  return {
    nodePaddingX,
    nodePaddingY,
    cornerRadius,
    strokeWidth,
    textScale,
    lineSpacingFactor,
    edge: {
      strokeWidth: edgeStrokeWidth,
      headLength: arrowHeadLength,
      headWidth: arrowHeadWidth,
    },
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

export const serializeFlowSvg = ({
  nodes = [],
  edges = [],
  grid,
  viewport = { x: 0, y: 0, zoom: 1 },
  includeRows = true,
  includeColumns = true,
} = {}) => {
  const zoom = safeNumber(viewport?.zoom, 1);
  const visualSizing = createVisualSizing(zoom);
  const zoomUnit = zoom > 0 ? zoom : 1;
  const layoutPaddingX = (visualSizing.nodePaddingX * 2) / zoomUnit;
  const layoutPaddingY = (visualSizing.nodePaddingY * 2) / zoomUnit;
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
  const effectiveCellWidth = optionWidth;
  const effectiveCellHeight = optionHeight;

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
      const measuredWidth = measureLineWidth(label, LABEL_FONT_SIZE);
      return Math.max(acc, measuredWidth);
    }, 0);
  }

  const rowLabelThickness = hasRows
    ? Math.max(LABEL_BAND_SIZE, longestRowLabelWidth + LABEL_TEXT_PADDING * 2)
    : 0;
  const columnLabelThickness = hasColumns
    ? Math.max(LABEL_BAND_SIZE, LABEL_TEXT_PADDING * 2 + LABEL_LINE_HEIGHT)
    : 0;
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
  const rowColorEntries = [];

  if (hasRows) {
    rows.forEach((row, rowIndex) => {
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
        index: rowIndex,
      });
      registerBounds(x, contentTop, rectWidth, height);
      registerBounds(translateX, contentTop, rowLabelThickness, height);

      rowLabelCells.push({
        x: translateX,
        y: contentTop,
        width: rowLabelThickness,
        height,
        label: row?.label || "",
        index: rowIndex,
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
    columns.forEach((column, columnIndex) => {
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
        index: columnIndex,
      });
      registerBounds(contentLeft, y, width, rectHeight);
      registerBounds(contentLeft, translateY, width, columnLabelThickness);

      columnLabelCells.push({
        x: contentLeft,
        y: translateY,
        width,
        height: columnLabelThickness,
        label: column?.label || "",
        index: columnIndex,
      });
    });
  }

  const nodeLayoutMap = new Map();
  const nodeRenderMap = new Map();
  nodes.forEach((node) => {
    const explicitSize = extractNodeSize(node);
    const metrics = measureNodeContent(node, {
      preferredWidth: explicitSize.width,
      preferredHeight: explicitSize.height,
      paddingX: layoutPaddingX,
      paddingY: layoutPaddingY,
    });
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
      lines: [
        {
          text: node?.data?.Name || node?.id || "",
          fontSize: BASE_FONT_SIZE,
          lineHeight: BASE_LINE_HEIGHT,
          fontWeight: TITLE_FONT_WEIGHT,
          color: PRIMARY_TEXT_COLOR,
        },
      ],
    };
    const basePosition =
      (node && node.positionAbsolute) || node?.position || { x: 0, y: 0 };
    const baseX = safeNumber(basePosition?.x);
    const baseY = safeNumber(basePosition?.y);
    const widthUnits = layout.width;
    const heightUnits = layout.height;
    const x = contentTranslateX + baseX * zoom;
    const y = contentTranslateY + baseY * zoom;
    const width = widthUnits * zoom;
    const height = heightUnits * zoom;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const flowCenterY = baseY + heightUnits / 2;
    let nodeFill = NODE_FILL_COLOR;
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
    const centeredIndex =
      totalInGroup > 1 ? currentIndex - (totalInGroup - 1) / 2 : 0;
    const offsetSpacing = 28;
    const maxOffset = 120;
    let perpendicularOffset = centeredIndex * offsetSpacing;
    perpendicularOffset = Math.max(
      -maxOffset,
      Math.min(maxOffset, perpendicularOffset)
    );

    const sourceCenterX = sourceRect.x + sourceRect.width / 2;
    const sourceCenterY = sourceRect.y + sourceRect.height / 2;
    const targetCenterX = targetRect.x + targetRect.width / 2;
    const targetCenterY = targetRect.y + targetRect.height / 2;
    const dx = targetCenterX - sourceCenterX;
    const dy = targetCenterY - sourceCenterY;

    const dominantHorizontal = Math.abs(dx) >= Math.abs(dy);
    const points = [];
    const elbowPaddingMax = 36;
    const arrowGuard = Math.max(10, (visualSizing.edge.headLength * 1.2) / zoomUnit);
    const targetOverlap = Math.max(4, (visualSizing.edge.headWidth * 0.6) / zoomUnit);

    if (dominantHorizontal) {
      const direction = dx >= 0 ? 1 : -1;
      const rawStartX =
        direction >= 0 ? sourceRect.x + sourceRect.width : sourceRect.x;
      const rawEndX =
        direction >= 0 ? targetRect.x : targetRect.x + targetRect.width;
      const available = Math.max(0, Math.abs(rawEndX - rawStartX));
      const anchorPadding = Math.min(EDGE_ANCHOR_PADDING, available / 3);
      const exitPadding = Math.min(anchorPadding, Math.max(0, available / 2));
      const insetPadding = Math.min(
        Math.max(2, exitPadding),
        sourceRect.width / 2
      );
      const exit = {
        x: rawStartX + direction * exitPadding,
        y: sourceCenterY,
      };
      const start = {
        x: rawStartX - direction * insetPadding,
        y: sourceCenterY,
      };
      const maxEntryInset = Math.max(
        targetOverlap,
        Math.min(targetRect.width / 2, EDGE_ANCHOR_PADDING)
      );
      const entryPadding = Math.max(
        targetOverlap,
        Math.min(maxEntryInset, anchorPadding)
      );
      const unclampedEndX = rawEndX + direction * entryPadding;
      const end = {
        x: clampValue(
          unclampedEndX,
          targetRect.x + 1,
          targetRect.x + targetRect.width - 1
        ),
        y: targetCenterY,
      };
      const horizontalDistance = Math.max(0, Math.abs(end.x - exit.x));
      const elbowLimit = Math.max(0, horizontalDistance / 2 - 6);
      const elbowPadding = Math.min(
        elbowPaddingMax,
        elbowLimit,
        Math.max(0, horizontalDistance / 3)
      );
      const firstX = exit.x + direction * elbowPadding;
      const lastX = end.x - direction * elbowPadding;
      const bendY = exit.y + perpendicularOffset;
      const verticalSign =
        perpendicularOffset !== 0
          ? Math.sign(perpendicularOffset)
          : dy === 0
            ? 1
            : Math.sign(dy);
      const approachBendY =
        bendY === exit.y ? bendY + verticalSign * arrowGuard : bendY;
      points.push(
        start,
        exit,
        { x: firstX, y: exit.y },
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
      const exitPadding = Math.min(anchorPadding, Math.max(0, available / 2));
      const insetPadding = Math.min(
        Math.max(2, exitPadding),
        sourceRect.height / 2
      );
      const exit = {
        x: sourceCenterX,
        y: rawStartY + direction * exitPadding,
      };
      const start = {
        x: sourceCenterX,
        y: rawStartY - direction * insetPadding,
      };
      const maxEntryInset = Math.max(
        targetOverlap,
        Math.min(targetRect.height / 2, EDGE_ANCHOR_PADDING)
      );
      const entryPadding = Math.max(
        targetOverlap,
        Math.min(maxEntryInset, anchorPadding)
      );
      const unclampedEndY = rawEndY + direction * entryPadding;
      const end = {
        x: targetCenterX,
        y: clampValue(
          unclampedEndY,
          targetRect.y + 1,
          targetRect.y + targetRect.height - 1
        ),
      };
      const verticalDistance = Math.max(0, Math.abs(end.y - exit.y));
      const elbowLimit = Math.max(0, verticalDistance / 2 - 6);
      const elbowPadding = Math.min(
        elbowPaddingMax,
        elbowLimit,
        Math.max(0, verticalDistance / 3)
      );
      const firstY = exit.y + direction * elbowPadding;
      const lastY = end.y - direction * elbowPadding;
      const bendX = exit.x + perpendicularOffset;
      const horizontalSign =
        perpendicularOffset !== 0
          ? Math.sign(perpendicularOffset)
          : dx === 0
            ? 1
            : Math.sign(dx);
      const approachBendX =
        bendX === exit.x ? bendX + horizontalSign * arrowGuard : bendX;
      points.push(
        start,
        exit,
        { x: exit.x, y: firstY },
        { x: approachBendX, y: firstY },
        { x: approachBendX, y: lastY },
        { x: end.x, y: lastY },
        end
      );
    }

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

  const markerId = "flowSvgArrow";
  const edgeStrokeWidth = Number(visualSizing.edge.strokeWidth.toFixed(2));
  const markerWidth = Number(visualSizing.edge.headLength.toFixed(2));
  const markerHeight = Number(visualSizing.edge.headWidth.toFixed(2));
  const markerRefY = Number((markerHeight / 2).toFixed(2));
  const haloStrokeWidth = Number(
    (edgeStrokeWidth + EDGE_HALO_EXTRA_WIDTH).toFixed(2)
  );

  const styleBlock = [
    "<style>",
    "  text { text-rendering: optimizeLegibility; font-kerning: normal; }",
    `  .flow-node-text { paint-order: stroke fill; stroke: ${NODE_TEXT_STROKE_COLOR}; stroke-width: ${NODE_TEXT_STROKE_WIDTH}px; }`,
    "  .flow-label-text { letter-spacing: 0.04em; text-rendering: geometricPrecision; }",
    "  .flow-edge, .flow-edge-halo { vector-effect: non-scaling-stroke; }",
    "</style>",
  ].join("\n");

  const defsParts = [
    styleBlock,
    `<filter id="${NODE_SHADOW_FILTER_ID}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="${NODE_SHADOW_COLOR}" flood-opacity="${NODE_SHADOW_OPACITY}" /></filter>`,
    `<filter id="${LABEL_SHADOW_FILTER_ID}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="${LABEL_SHADOW_COLOR}" flood-opacity="${LABEL_SHADOW_OPACITY}" /></filter>`,
    `<pattern id="${BACKGROUND_PATTERN_ID}" width="${BACKGROUND_GRID_SIZE}" height="${BACKGROUND_GRID_SIZE}" patternUnits="userSpaceOnUse"><rect width="${BACKGROUND_GRID_SIZE}" height="${BACKGROUND_GRID_SIZE}" fill="${BACKGROUND_COLOR}" /><path d="M ${BACKGROUND_GRID_SIZE} 0 L 0 0 0 ${BACKGROUND_GRID_SIZE}" fill="none" stroke="${BACKGROUND_GRID_STROKE_COLOR}" stroke-opacity="${BACKGROUND_GRID_STROKE_OPACITY}" stroke-width="${BACKGROUND_GRID_STROKE_WIDTH}" /></pattern>`,
    `<marker id="${markerId}" markerWidth="${markerWidth}" markerHeight="${markerHeight}" refX="${markerWidth}" refY="${markerRefY}" orient="auto" markerUnits="userSpaceOnUse"><path d="M 0 0 L ${markerWidth} ${markerRefY} L 0 ${markerHeight} z" fill="${EDGE_STROKE_COLOR}" /></marker>`,
  ];

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" font-family="Inter, Arial, sans-serif" font-size="12" fill="${PRIMARY_TEXT_COLOR}" shape-rendering="geometricPrecision">`,
    `<defs>${defsParts.join("")}</defs>`,
    `<rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="${BACKGROUND_COLOR}" />`,
    `<rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="url(#${BACKGROUND_PATTERN_ID})" opacity="${BACKGROUND_PATTERN_OPACITY}" />`,
    `<rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="none" stroke="${FRAME_BORDER_COLOR}" stroke-width="${FRAME_BORDER_WIDTH}" />`,
  ];

  if (hasRows) {
    rowLabelCells.forEach((cell) => {
      const cellX = cell.x + offsetX;
      const cellY = cell.y + offsetY;
      parts.push(
        `<rect x="${cellX}" y="${cellY}" width="${cell.width}" height="${cell.height}" rx="${LABEL_CELL_CORNER_RADIUS}" ry="${LABEL_CELL_CORNER_RADIUS}" fill="${LABEL_CELL_FILL}" stroke="${LABEL_CELL_BORDER}" filter="url(#${LABEL_SHADOW_FILTER_ID})" />`
      );
      if (cell.label) {
        parts.push(
          `<text class="flow-label-text" x="${cellX + LABEL_TEXT_PADDING}" y="${cellY + cell.height / 2}" fill="${PRIMARY_TEXT_COLOR}" font-size="${Math.max(10, LABEL_FONT_SIZE)}" font-weight="600" dominant-baseline="middle">${escapeXml(cell.label)}</text>`
        );
      }
    });
  }

  if (hasColumns) {
    columnLabelCells.forEach((cell) => {
      const cellX = cell.x + offsetX;
      const cellY = cell.y + offsetY;
      parts.push(
        `<rect x="${cellX}" y="${cellY}" width="${cell.width}" height="${cell.height}" rx="${LABEL_CELL_CORNER_RADIUS}" ry="${LABEL_CELL_CORNER_RADIUS}" fill="${LABEL_CELL_FILL}" stroke="${LABEL_CELL_BORDER}" filter="url(#${LABEL_SHADOW_FILTER_ID})" />`
      );
      if (cell.label) {
        parts.push(
          `<text class="flow-label-text" x="${cellX + cell.width / 2}" y="${cellY + cell.height / 2}" text-anchor="middle" fill="${PRIMARY_TEXT_COLOR}" font-size="${Math.max(10, LABEL_FONT_SIZE)}" font-weight="600" dominant-baseline="middle">${escapeXml(cell.label)}</text>`
        );
      }
    });
  }

  shapes
    .filter((shape) => shape.type === "row")
    .forEach((row) => {
      const x = row.x + offsetX;
      const y = row.y + offsetY;
      const isAltRow = Number.isFinite(row.index) && row.index % 2 === 1;
      const rowFill = isAltRow ? ROW_BAND_FILL_ALT : ROW_BAND_FILL;
      parts.push(
        `<rect x="${x}" y="${y}" width="${row.width}" height="${row.height}" fill="${rowFill}" stroke="${ROW_BORDER_COLOR}" />`
      );
      if (row.label && !hasRows) {
        const labelX = row.labelCenterX + offsetX;
        const labelY = row.labelCenterY + offsetY;
        parts.push(
          `<text class="flow-label-text" x="${labelX}" y="${labelY}" fill="${PRIMARY_TEXT_COLOR}" font-size="${Math.max(10, LABEL_FONT_SIZE)}" font-weight="600" dominant-baseline="middle" text-anchor="middle">${escapeXml(row.label)}</text>`
        );
      }
    });

  shapes
    .filter((shape) => shape.type === "column")
    .forEach((column) => {
      const x = column.x + offsetX;
      const y = column.y + offsetY;
      const isAltColumn = Number.isFinite(column.index) && column.index % 2 === 1;
      const columnFill = isAltColumn ? COLUMN_BAND_FILL_ALT : COLUMN_BAND_FILL;
      parts.push(
        `<rect x="${x}" y="${y}" width="${column.width}" height="${column.height}" fill="${columnFill}" stroke="${COLUMN_BORDER_COLOR}" />`
      );
      if (column.label && !hasColumns) {
        const labelX = column.labelCenterX + offsetX;
        const labelY = column.labelCenterY + offsetY;
        parts.push(
          `<text class="flow-label-text" x="${labelX}" y="${labelY}" text-anchor="middle" fill="${PRIMARY_TEXT_COLOR}" font-size="${Math.max(10, LABEL_FONT_SIZE)}" font-weight="600" dominant-baseline="middle">${escapeXml(
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
      `<path class="flow-edge-halo" d="${pathData}" stroke="${EDGE_HALO_COLOR}" stroke-width="${haloStrokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="${EDGE_HALO_OPACITY}" />`
    );
    parts.push(
      `<path class="flow-edge" d="${pathData}" stroke="${EDGE_STROKE_COLOR}" stroke-width="${edgeStrokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#${markerId})" />`
    );
  });

  shapes
    .filter((shape) => shape.type === "node")
    .forEach((node) => {
      const x = node.x + offsetX;
      const y = node.y + offsetY;
      const cornerRadius = visualSizing.cornerRadius;
      const strokeWidth = visualSizing.strokeWidth;
      const textPaddingX = visualSizing.nodePaddingX;
      const textPaddingTop = visualSizing.nodePaddingY;
      const textX = x + textPaddingX;
      let currentY = y + textPaddingTop;
      const rawLines = Array.isArray(node.lines) && node.lines.length
        ? node.lines
        : [
            {
              text: "",
              fontSize: BASE_FONT_SIZE,
              lineHeight: BASE_LINE_HEIGHT,
              fontWeight: TITLE_FONT_WEIGHT,
              color: PRIMARY_TEXT_COLOR,
            },
          ];
      const normalizedLines = rawLines.map((line, index) => {
        if (line && typeof line === "object" && !(line instanceof String)) {
          return {
            text: line.text ?? "",
            fontSize: resolveFontSize(line.fontSize, BASE_FONT_SIZE),
            lineHeight: Number.isFinite(line.lineHeight)
              ? line.lineHeight
              : index === 0
                ? BASE_LINE_HEIGHT
                : META_LINE_HEIGHT,
            fontWeight: Number.isFinite(line.fontWeight)
              ? line.fontWeight
              : index === 0
                ? TITLE_FONT_WEIGHT
                : META_FONT_WEIGHT,
            color: line.color || PRIMARY_TEXT_COLOR,
          };
        }
        const textValue = line == null ? "" : String(line);
        return {
          text: textValue,
          fontSize: BASE_FONT_SIZE,
          lineHeight: index === 0 ? BASE_LINE_HEIGHT : META_LINE_HEIGHT,
          fontWeight: index === 0 ? TITLE_FONT_WEIGHT : META_FONT_WEIGHT,
          color: PRIMARY_TEXT_COLOR,
        };
      });
      const fillColor = node.fill || NODE_FILL_COLOR;
      parts.push(
        `<rect x="${x}" y="${y}" width="${node.width}" height="${node.height}" rx="${cornerRadius}" ry="${cornerRadius}" fill="${fillColor}" stroke="${NODE_STROKE_COLOR}" stroke-width="${strokeWidth}" filter="url(#${NODE_SHADOW_FILTER_ID})" />`
      );
      normalizedLines.forEach((line) => {
        const baseFontSize = resolveFontSize(line.fontSize, BASE_FONT_SIZE);
        const scaledFontSize = Math.max(6, baseFontSize * visualSizing.textScale);
        const fontSizeValue = Number(scaledFontSize.toFixed(2));
        const baseLineHeight = Number.isFinite(line.lineHeight)
          ? line.lineHeight
          : BASE_LINE_HEIGHT;
        const lineSpacingRaw = Math.max(
          scaledFontSize * visualSizing.lineSpacingFactor,
          baseLineHeight * visualSizing.textScale
        );
        const lineSpacing = Number(lineSpacingRaw.toFixed(2));
        const fontWeight = Number.isFinite(line.fontWeight)
          ? line.fontWeight
          : TITLE_FONT_WEIGHT;
        const lineColor = line.color || PRIMARY_TEXT_COLOR;
        const textValue = escapeXml(line.text) || " ";
        parts.push(
          `<text class="flow-node-text" x="${textX}" y="${currentY}" fill="${lineColor}" font-size="${fontSizeValue}" font-weight="${fontWeight}" dominant-baseline="hanging">${textValue}</text>`
        );
        currentY += lineSpacing;
      });
    });

  parts.push("</svg>");
  return parts.join("");
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
    const serializeSvg = () =>
      serializeFlowSvg({
        nodes,
        edges,
        grid,
        viewport,
        includeRows,
        includeColumns,
      });

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

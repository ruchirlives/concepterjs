import { forwardRef, useImperativeHandle } from "react";

const safeNumber = (value, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value];
};

const describeSegment = (segment, fallbackLabel, axis) => {
  if (segment == null) return fallbackLabel;
  if (typeof segment === "string" || typeof segment === "number" || typeof segment === "bigint") {
    const text = segment.toString().trim();
    return text.length ? text : fallbackLabel;
  }
  if (typeof segment !== "object") return fallbackLabel;
  const labelCandidates = [segment.label, segment.name, segment.id, segment.key];
  for (const candidate of labelCandidates) {
    if (candidate == null) continue;
    const text = String(candidate).trim();
    if (text.length) return text;
  }
  const start = axis === "row" ? segment.top : segment.left;
  const end = axis === "row" ? segment.bottom : segment.right;
  if (Number.isFinite(start) && Number.isFinite(end)) {
    return `${fallbackLabel} (${start}–${end})`;
  }
  return fallbackLabel;
};

const formatValue = (value) => {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => formatValue(entry))
      .filter((entry) => entry.length)
      .join(", ");
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return "[unserializable object]";
    }
  }
  return String(value);
};

const buildMetadataLines = (payload, indent = "      ") => {
  if (!payload || typeof payload !== "object") return [];
  const entries = Object.entries(payload).filter(([, value]) => value != null);
  if (!entries.length) return [];
  return entries.map(([key, value]) => `${indent}- ${key}: ${formatValue(value)}`);
};

const extractNodeTitle = (node, fallbackIndex) => {
  const candidates = [
    node?.data?.Name,
    node?.data?.title,
    node?.data?.label,
    node?.data?.id,
    node?.id,
  ];
  for (const candidate of candidates) {
    if (candidate == null) continue;
    const text = String(candidate).trim();
    if (text.length) return text;
  }
  return `Node ${fallbackIndex + 1}`;
};

const formatNumberValue = (value, decimals = 1) => {
  if (!Number.isFinite(value)) return "n/a";
  const fixed = value.toFixed(decimals);
  return Number(fixed).toString();
};

const describeRow = (row, index) => {
  const label = describeSegment(row, `Row ${index + 1}`, "row");
  const details = [];
  if (Number.isFinite(row?.top)) details.push(`top ${row.top}`);
  if (Number.isFinite(row?.bottom)) details.push(`bottom ${row.bottom}`);
  if (Number.isFinite(row?.height)) details.push(`height ${row.height}`);
  const detailText = details.length ? ` (${details.join(", ")})` : "";
  const nodeList = Array.isArray(row?.nodeIds) && row.nodeIds.length
    ? `\n    nodes: ${row.nodeIds.join(", ")}`
    : "";
  return `  ${index + 1}. ${label}${detailText}${nodeList}`;
};

const describeColumn = (column, index) => {
  const label = describeSegment(column, `Column ${index + 1}`, "column");
  const details = [];
  if (Number.isFinite(column?.left)) details.push(`left ${column.left}`);
  if (Number.isFinite(column?.right)) details.push(`right ${column.right}`);
  if (Number.isFinite(column?.width)) details.push(`width ${column.width}`);
  const detailText = details.length ? ` (${details.join(", ")})` : "";
  return `  ${index + 1}. ${label}${detailText}`;
};

const resolveEdgeLabel = (edge = {}) => {
  if (!edge) return "";
  const candidates = [
    edge.label,
    edge.data?.fullLabel,
    edge.data?.label,
    edge.data?.position?.label,
    edge.data?.positionLabel,
    edge.data?.position_label,
  ];
  for (const candidate of candidates) {
    if (candidate == null) continue;
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed.length) return trimmed;
      continue;
    }
    if (typeof candidate === "number" || typeof candidate === "bigint") {
      return String(candidate);
    }
    if (typeof candidate === "boolean") {
      return candidate ? "true" : "false";
    }
  }
  return "";
};

const resolveAssignments = (lookup = {}, nodeId, axis) => {
  if (!nodeId) return [];
  const rawValue = lookup[nodeId];
  if (!rawValue) return [];
  const segments = toArray(rawValue);
  return segments.map((segment, index) =>
    describeSegment(segment, `${axis === "row" ? "Row" : "Column"} ${index + 1}`, axis)
  );
};

const serializeBounds = (bounds = {}) => {
  const width = Number.isFinite(bounds.width) ? bounds.width : null;
  const height = Number.isFinite(bounds.height) ? bounds.height : null;
  if (width == null && height == null) return null;
  return `Grid bounds: ${width ?? "?"} × ${height ?? "?"}`;
};

const serializeCellOptions = (cellOptions = {}) => {
  const parts = [];
  if (Number.isFinite(cellOptions.width)) parts.push(`cell width ${cellOptions.width}`);
  if (Number.isFinite(cellOptions.height)) parts.push(`cell height ${cellOptions.height}`);
  if (Number.isFinite(cellOptions.adjustedWidth)) parts.push(`adjusted width ${cellOptions.adjustedWidth}`);
  if (Number.isFinite(cellOptions.adjustedHeight)) parts.push(`adjusted height ${cellOptions.adjustedHeight}`);
  if (!parts.length) return null;
  return `Grid settings: ${parts.join(", ")}`;
};

export const serializeFlowAiSummary = ({
  nodes = [],
  edges = [],
  grid = {},
  viewport = { x: 0, y: 0, zoom: 1 },
  includeRows = true,
  includeColumns = true,
  filterEdgesByHandleX = false,
} = {}) => {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeEdges = Array.isArray(edges) ? edges : [];
  const rows = includeRows && Array.isArray(grid?.rows) ? grid.rows : [];
  const columns = includeColumns && Array.isArray(grid?.columns) ? grid.columns : [];
  const lookup = grid?.lookup || {};
  const rowLookup = lookup.rowsByNodeId || {};
  const columnLookup = lookup.columnsByNodeId || {};
  const lines = [];

  lines.push("Flow Diagram AI Summary");
  lines.push("================================");
  const viewportX = formatNumberValue(viewport?.x ?? 0);
  const viewportY = formatNumberValue(viewport?.y ?? 0);
  const viewportZoom = formatNumberValue(viewport?.zoom ?? 1, 2);
  lines.push(`Viewport origin: (${viewportX}, ${viewportY}) | zoom ${viewportZoom}`);

  const boundsLine = serializeBounds(grid?.bounds);
  if (boundsLine) lines.push(boundsLine);
  const cellOptionsLine = serializeCellOptions(grid?.cellOptions);
  if (cellOptionsLine) lines.push(cellOptionsLine);

  lines.push("");
  if (includeRows) {
    lines.push(`Rows (${rows.length} total)`);
    if (rows.length) {
      rows.forEach((row, index) => {
        lines.push(describeRow(row, index));
      });
    } else {
      lines.push("  - No row grid segments available.");
    }
  } else {
    lines.push("Rows: (excluded from export)");
  }

  lines.push("");
  if (includeColumns) {
    lines.push(`Columns (${columns.length} total)`);
    if (columns.length) {
      columns.forEach((column, index) => {
        lines.push(describeColumn(column, index));
      });
    } else {
      lines.push("  - No column grid segments available.");
    }
  } else {
    lines.push("Columns: (excluded from export)");
  }

  lines.push("");
  lines.push(`Nodes (${safeNodes.length} total)`);
  if (!safeNodes.length) {
    lines.push("  - No nodes available in this view.");
  }

  const nodeMetadata = new Map();
  safeNodes.forEach((node, index) => {
    const title = extractNodeTitle(node, index);
    const position = (node && (node.positionAbsolute || node.position)) || { x: 0, y: 0 };
    const x = safeNumber(position?.x, 0);
    const y = safeNumber(position?.y, 0);
    const rowAssignments = resolveAssignments(rowLookup, node?.id, "row");
    const columnAssignments = resolveAssignments(columnLookup, node?.id, "column");
    const rowSummary = rowAssignments.length ? rowAssignments.join(", ") : "unassigned";
    const columnSummary = columnAssignments.length ? columnAssignments.join(", ") : "unassigned";
    lines.push(`  ${index + 1}. ${title}`);
    lines.push(`      id: ${node?.id ?? "(no id)"}`);
    lines.push(`      position: x=${formatNumberValue(x)}, y=${formatNumberValue(y)}`);
    lines.push(`      grid rows: ${rowSummary}`);
    lines.push(`      grid columns: ${columnSummary}`);
    const metadataLines = buildMetadataLines(node?.data);
    if (metadataLines.length) {
      lines.push("      metadata:");
      metadataLines.forEach((line) => lines.push(line));
    }
    nodeMetadata.set(node?.id, {
      title,
      position: { x, y },
    });
  });

  const includedEdges = safeEdges.filter((edge) => {
    if (!edge?.source || !edge?.target) return false;
    if (!filterEdgesByHandleX) return true;
    const sourceMeta = nodeMetadata.get(edge.source);
    const targetMeta = nodeMetadata.get(edge.target);
    if (!sourceMeta || !targetMeta) return false;
    const dx = targetMeta.position.x - sourceMeta.position.x;
    return dx > 0;
  });

  lines.push("");
  lines.push(`Edges (${includedEdges.length} total)`);
  if (!includedEdges.length) {
    lines.push("  - No edges available with the current filters.");
  } else {
    includedEdges.forEach((edge, index) => {
      const sourceTitle = nodeMetadata.get(edge.source)?.title || edge.source || "(unknown source)";
      const targetTitle = nodeMetadata.get(edge.target)?.title || edge.target || "(unknown target)";
      lines.push(`  ${index + 1}. ${sourceTitle} -> ${targetTitle}`);
      if (edge?.id) {
        lines.push(`      id: ${edge.id}`);
      }
      const edgeLabel = resolveEdgeLabel(edge);
      if (edgeLabel) {
        lines.push(`      label: ${edgeLabel}`);
      }
      const metadataLines = buildMetadataLines(edge?.data);
      if (metadataLines.length) {
        lines.push("      metadata:");
        metadataLines.forEach((line) => lines.push(line));
      }
    });
  }

  return lines.join("\n").trim();
};

const copyToClipboard = async (text) => {
  if (!text) return false;
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Fallback to manual method
    }
  }
  if (typeof document === "undefined") return false;
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const succeeded = document.execCommand && document.execCommand("copy");
    document.body.removeChild(textarea);
    return Boolean(succeeded);
  } catch (error) {
    return false;
  }
};

const FlowAIExporter = forwardRef(
  (
    {
      nodes = [],
      edges = [],
      grid,
      viewport = { x: 0, y: 0, zoom: 1 },
      includeRows = true,
      includeColumns = true,
      filterEdgesByHandleX = false,
    },
    ref
  ) => {
    const serializeSummary = () =>
      serializeFlowAiSummary({
        nodes,
        edges,
        grid,
        viewport,
        includeRows,
        includeColumns,
        filterEdgesByHandleX,
      });

    useImperativeHandle(ref, () => ({
      async exportText() {
        const summary = serializeSummary();
        if (!summary) return false;
        const copied = await copyToClipboard(summary);
        return copied;
      },
    }));

    return null;
  }
);

export default FlowAIExporter;

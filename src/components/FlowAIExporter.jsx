import { forwardRef, useImperativeHandle } from "react";

const safeNumber = (value, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;

const asStringOrNull = (value) => {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};

const extractSegmentId = (segment, prefix, index) => {
  const candidates = [segment?.id, segment?.uuid, segment?.key, segment?.nodeId, segment?.originalId];
  for (const candidate of candidates) {
    const normalized = asStringOrNull(candidate);
    if (normalized) return normalized;
  }
  return `${prefix}-${index + 1}`;
};

const extractSegmentName = (segment, fallback) => {
  if (!segment) return fallback;
  const candidates = [segment.label, segment.name, segment.title, segment.id, segment.key];
  for (const candidate of candidates) {
    const normalized = asStringOrNull(candidate);
    if (normalized) return normalized;
  }
  return fallback;
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

const resolveNodeId = (node, fallbackIndex) => {
  const candidates = [node?.id, node?.data?.id, node?.data?.originalId];
  for (const candidate of candidates) {
    const normalized = asStringOrNull(candidate);
    if (normalized) return normalized;
  }
  return `node-${fallbackIndex + 1}`;
};

const normalizeTags = (node) => {
  const tagSources = [
    node?.data?.tags,
    node?.data?.Tags,
    node?.data?.tagList,
    node?.data?.tag_list,
    node?.data?.Layers,
  ];
  const tags = [];
  const seen = new Set();

  const addTag = (tag) => {
    const normalized = asStringOrNull(tag);
    if (!normalized) return;
    const lower = normalized.toLowerCase();
    if (seen.has(lower)) return;
    seen.add(lower);
    tags.push(lower);
  };

  const visit = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === "string") {
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach(addTag);
      return;
    }
    if (typeof value === "object") {
      const candidate = value?.name ?? value?.label ?? value?.id;
      if (candidate != null) visit(candidate);
      return;
    }
    visit(String(value));
  };

  tagSources.forEach(visit);
  return tags;
};

const collectChildIds = (node) => {
  const childSources = [node?.data?.children, node?.children];
  const ids = [];
  const seen = new Set();

  const addChild = (value) => {
    const normalized = asStringOrNull(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    ids.push(normalized);
  };

  const visit = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === "object") {
      const candidate = value?.id ?? value?.childId ?? value?.data?.id;
      addChild(candidate);
      return;
    }
    addChild(value);
  };

  childSources.forEach(visit);
  return ids;
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

const buildSegmentExports = (segments = [], axis) =>
  segments.map((segment, index) => ({
    id: extractSegmentId(segment, axis === "row" ? "row" : "column", index),
    name: extractSegmentName(segment, `${axis === "row" ? "Row" : "Column"} ${index + 1}`),
  }));

const normalizeAssignmentId = (value) => asStringOrNull(value) ?? null;

export const serializeFlowAiSummary = ({
  nodes = [],
  edges = [],
  grid = {},
  includeRows = true,
  includeColumns = true,
  filterEdgesByHandleX = false,
} = {}) => {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeEdges = Array.isArray(edges) ? edges : [];
  const rows = includeRows && Array.isArray(grid?.rows) ? grid.rows : [];
  const columns = includeColumns && Array.isArray(grid?.columns) ? grid.columns : [];

  const rowExports = includeRows ? buildSegmentExports(rows, "row") : [];
  const columnExports = includeColumns ? buildSegmentExports(columns, "column") : [];

  const nodeMetadata = new Map();

  const nodeExports = safeNodes.map((node, index) => {
    const nodeId = resolveNodeId(node, index);
    const name = extractNodeTitle(node, index);
    const assignment = node?.data?.gridAssignment ?? node?.gridAssignment ?? {};
    const row = normalizeAssignmentId(assignment?.rowId);
    const column = normalizeAssignmentId(assignment?.columnId);
    const tags = normalizeTags(node);
    const children = collectChildIds(node);
    const position = (node && (node.positionAbsolute || node.position)) || { x: 0, y: 0 };
    const x = safeNumber(position?.x, 0);
    const y = safeNumber(position?.y, 0);
    const meta = {
      title: name,
      position: { x, y },
    };
    if (node?.id != null) {
      nodeMetadata.set(node.id, meta);
    }
    nodeMetadata.set(nodeId, meta);
    return {
      id: nodeId,
      name,
      tags,
      row,
      column,
      children,
    };
  });

  const includedEdges = safeEdges.filter((edge) => {
    if (!edge?.source || !edge?.target) return false;
    if (!filterEdgesByHandleX) return true;
    const sourceMeta = nodeMetadata.get(edge.source) || nodeMetadata.get(asStringOrNull(edge.source));
    const targetMeta = nodeMetadata.get(edge.target) || nodeMetadata.get(asStringOrNull(edge.target));
    if (!sourceMeta || !targetMeta) return false;
    const dx = targetMeta.position.x - sourceMeta.position.x;
    return dx > 0;
  });

  const edgeExports = includedEdges
    .map((edge) => {
      const from = asStringOrNull(edge.source);
      const to = asStringOrNull(edge.target);
      if (!from || !to) return null;
      const exportEdge = { from, to };
      const label = resolveEdgeLabel(edge);
      if (label) {
        exportEdge.label = label;
      }
      return exportEdge;
    })
    .filter(Boolean);

  const exportObject = {
    rows: rowExports,
    columns: columnExports,
    nodes: nodeExports,
    edges: edgeExports,
  };

  return JSON.stringify(exportObject, null, 2);
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

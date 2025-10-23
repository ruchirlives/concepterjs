import { forwardRef, useImperativeHandle } from "react";

const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 120;
const MARGIN = 32;

const safeNumber = (value, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;

const getNodeSize = (node) => {
  const width =
    safeNumber(node?.width) ||
    safeNumber(node?.style?.width) ||
    DEFAULT_NODE_WIDTH;
  const height =
    safeNumber(node?.height) ||
    safeNumber(node?.style?.height) ||
    DEFAULT_NODE_HEIGHT;
  return { width, height };
};

const escapeXml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

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

      if (includeRows && rows.length > 0) {
        rows.forEach((row) => {
          const height = safeNumber(row?.height) * zoom;
          const top = safeNumber(row?.top) * zoom + translateY;
          const rectWidth = boundsWidth * zoom;
          const x = translateX;
          shapes.push({
            type: "row",
            x,
            y: top,
            width: rectWidth,
            height,
            label: row?.label || "",
          });
          registerBounds(x, top, rectWidth, height);
        });
      }

      if (includeColumns && columns.length > 0) {
        columns.forEach((column) => {
          const width = safeNumber(column?.width) * zoom;
          const left = safeNumber(column?.left) * zoom + translateX;
          const rectHeight = boundsHeight * zoom;
          const y = translateY;
          shapes.push({
            type: "column",
            x: left,
            y,
            width,
            height: rectHeight,
            label: column?.label || "",
          });
          registerBounds(left, y, width, rectHeight);
        });
      }

      const nodeSizeMap = new Map();
      const nodeMap = new Map(nodes.map((node) => [node.id, node]));
      nodes.forEach((node) => {
        const { width, height } = getNodeSize(node);
        nodeSizeMap.set(node.id, { width, height });
      });

      nodes.forEach((node) => {
        const size = nodeSizeMap.get(node.id) || {
          width: DEFAULT_NODE_WIDTH,
          height: DEFAULT_NODE_HEIGHT,
        };
        const baseX = safeNumber(node?.position?.x);
        const baseY = safeNumber(node?.position?.y);
        const x = translateX + baseX * zoom;
        const y = translateY + baseY * zoom;
        const width = size.width * zoom;
        const height = size.height * zoom;
        shapes.push({
          type: "node",
          x,
          y,
          width,
          height,
          label: node?.data?.Name || node?.id,
        });
        registerBounds(x, y, width, height);
      });

      const nodeCenter = (nodeId) => {
        const node = nodeMap.get(nodeId);
        if (!node) return null;
        const size = nodeSizeMap.get(node.id) || {
          width: DEFAULT_NODE_WIDTH,
          height: DEFAULT_NODE_HEIGHT,
        };
        const centerX =
          translateX + (safeNumber(node?.position?.x) + size.width / 2) * zoom;
        const centerY =
          translateY + (safeNumber(node?.position?.y) + size.height / 2) * zoom;
        return { x: centerX, y: centerY };
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

      shapes
        .filter((shape) => shape.type === "row")
        .forEach((row) => {
          const x = row.x + offsetX;
          const y = row.y + offsetY;
          parts.push(
            `<rect x="${x}" y="${y}" width="${row.width}" height="${row.height}" fill="rgba(148,163,184,0.08)" stroke="rgba(148,163,184,0.5)" />`
          );
          if (row.label) {
            parts.push(
              `<text x="${x + 6}" y="${y + row.height / 2 + 4}" fill="#0f172a">${escapeXml(
                row.label
              )}</text>`
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
          if (column.label) {
            parts.push(
              `<text x="${x + column.width / 2}" y="${y + 18}" text-anchor="middle" fill="#0f172a">${escapeXml(
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
          parts.push(
            `<rect x="${x}" y="${y}" width="${node.width}" height="${node.height}" rx="12" ry="12" fill="#ffffff" stroke="#1e293b" stroke-width="1.5" />`
          );
          if (node.label) {
            parts.push(
              `<text x="${x + 12}" y="${y + 24}" fill="#0f172a">${escapeXml(
                node.label
              )}</text>`
            );
          }
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

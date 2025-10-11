// Consolidated Donut visualization entry point.
// Provides a single place for the ancestry renderer logic so AppD3Vis
// can initialize, update and destroy it cleanly.

import * as d3 from "d3";

const CLAMPED_TRUNCATION_SUFFIX = "...";

function buildHierarchy(donutTree) {
  if (!donutTree || donutTree.length === 0) return null;

  const itemsByKey = {};

  donutTree.forEach((item) => {
    const key = `${item.id}-${item.level}`;
    itemsByKey[key] = {
      id: item.id,
      name: item.label,
      level: item.level,
      parentId: item.parentId,
      parentLevel: item.level > 0 ? item.level - 1 : null,
      children: [],
    };
  });

  let rootKey = null;
  let minLevel = Infinity;
  donutTree.forEach((item) => {
    if (item.parentId === null || item.level < minLevel) {
      minLevel = item.level;
      rootKey = `${item.id}-${item.level}`;
    }
  });

  const rootItem = rootKey ? itemsByKey[rootKey] : null;
  if (!rootItem) return null;

  donutTree.forEach((item) => {
    if (item.parentId !== null && item.level > 0) {
      const parentKey = `${item.parentId}-${item.level - 1}`;
      const childKey = `${item.id}-${item.level}`;
      if (itemsByKey[parentKey] && itemsByKey[childKey]) {
        itemsByKey[parentKey].children.push(itemsByKey[childKey]);
      }
    }
  });

  return rootItem;
}

// createDonut returns a controller with update/destroy so AppD3Vis can
// initialize, update and tear down the donut renderer.
export function createDonut({ svgEl, data, options = {} }) {
  const handlers = options?.handlers || {};

  const render = (payload) => {
    const payloadData = payload?.data || payload || data || {};
    const donutTree = payloadData.donutTree || [];
    const clickedSegmentId = payloadData.clickedSegmentId ?? null;
    const relatedIds = payloadData.relatedIds instanceof Set ? payloadData.relatedIds : new Set(payloadData.relatedIds || []);
    const ancestorIds = payloadData.ancestorIds instanceof Set ? payloadData.ancestorIds : new Set(payloadData.ancestorIds || []);

    const fallbackWidth = svgEl?.clientWidth || 700;
    const width = options?.width ?? fallbackWidth;
    const fallbackHeight = svgEl?.clientHeight || fallbackWidth;
    const height = options?.height ?? fallbackHeight;
    const radius = Math.min(width, height) / 2 - 30;

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const g = svg
      .attr("viewBox", `${-width / 2} ${-height / 2} ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .append("g");

    if (!donutTree.length || radius <= 0) {
      return;
    }

    const treeData = buildHierarchy(donutTree);
    if (!treeData) return;

    const root = d3
      .hierarchy(treeData)
      .sum(() => 1)
      .sort((a, b) => d3.ascending(a.data.name, b.data.name));

    d3.partition().size([2 * Math.PI, radius])(root);

    const arc = d3
      .arc()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .innerRadius((d) => d.y0)
      .outerRadius((d) => d.y1);

    g
      .selectAll("path")
      .data(root.descendants())
      .join("path")
      .attr("fill", (d) => {
        const id = d.data.id?.toString?.() ?? d.data.id;
        if (!clickedSegmentId) return "#ddd";
        if (id === clickedSegmentId?.toString()) return "#ff4444";
        if (relatedIds.has(id)) return "rgba(245, 158, 11, 0)";
        if (ancestorIds.has(id)) return "rgba(59, 130, 246, 0)";
        return "#9ca3af";
      })
      .attr("stroke", (d) => {
        const id = d.data.id?.toString?.() ?? d.data.id;
        if (!clickedSegmentId) return "#fff";
        if (id === clickedSegmentId?.toString()) return "#cc0000";
        if (relatedIds.has(id)) return "#f59e0b";
        if (ancestorIds.has(id)) return "#3b82f6";
        return "#fff";
      })
      .attr("stroke-width", (d) => {
        const id = d.data.id?.toString?.() ?? d.data.id;
        if (!clickedSegmentId) return 1;
        if (id === clickedSegmentId?.toString()) return 2;
        if (relatedIds.has(id)) return 2;
        if (ancestorIds.has(id)) return 2;
        return 1;
      })
      .attr("d", arc)
      .style("cursor", "pointer")
      .on("click", (event, d) => handlers.handleSegmentClick?.(event, d))
      .on("contextmenu", (event, d) => handlers.handleSegmentContextMenu?.(event, d))
      .on("mousedown", (event, d) => handlers.handleSegmentMouseDown?.(event, d));

    g
      .append("g")
      .attr("pointer-events", "none")
      .attr("text-anchor", "middle")
      .selectAll("text")
      .data(root.descendants())
      .join("text")
      .attr("transform", (d) => {
        const x = (d.x0 + d.x1) / 2;
        const y = (d.y0 + d.y1) / 2;
        return `rotate(${(x * 180) / Math.PI - 90}) translate(${y},0) rotate(${x >= Math.PI ? 180 : 0})`;
      })
      .attr("dy", "0.35em")
      .style("font-size", "10px")
      .style("fill", "#374151")
      .text((d) => {
        const arcLength = Math.abs(d.x1 - d.x0);
        const r = (d.y0 + d.y1) / 2;
        const estMaxChars = Math.floor((arcLength * r) / (10 * 0.7));
        const scrub = handlers.stripCommonWords || ((name) => name);
        let name = scrub(d.data.name || "");
        if (arcLength < 0.35 || estMaxChars < 3) {
          return name.length >= 5 ? name.substring(0, 5) : name;
        }
        if (name.length > estMaxChars && estMaxChars > 1) {
          return name.substring(0, estMaxChars - 1) + CLAMPED_TRUNCATION_SUFFIX;
        }
        return name;
      });
  };

  render({ data, options });

  return {
    update(next) {
      render({ data: next, options });
    },
    destroy() {}
  };
}
export default createDonut;

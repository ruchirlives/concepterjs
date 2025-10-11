// Consolidated Donut visualization entry point.
// Provides ancestry and layer ring rendering so AppD3Vis stays slim.

import * as d3 from "d3";

const CLAMPED_TRUNCATION_SUFFIX = "...";

function buildHierarchy(donutTree = []) {
  if (!donutTree.length) return null;

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

function renderAncestryPartition({
  svg,
  width,
  height,
  donutTree,
  clickedSegmentId,
  relatedIds,
  ancestorIds,
  handlers,
}) {
  const radius = Math.min(width, height) / 2 - 30;
  if (radius <= 0 || !donutTree.length) return;

  const treeData = buildHierarchy(donutTree);
  if (!treeData) return;

  const scrub = handlers.stripCommonWords || ((name) => name);

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

  const g = svg.append("g");

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
      const angle = (d.x0 + d.x1) / 2 - Math.PI / 2;
      const radiusAtMid = (d.y0 + d.y1) / 2;
      const x = Math.cos(angle) * radiusAtMid;
      const y = Math.sin(angle) * radiusAtMid;
      return `translate(${x},${y})`;
    })
    .attr("dy", "0.35em")
    .style("font-size", "10px")
    .style("fill", "#374151")
    .text((d) => {
      const arcLength = Math.abs(d.x1 - d.x0);
      const r = (d.y0 + d.y1) / 2;
      const estMaxChars = Math.floor((arcLength * r) / (10 * 0.7));
      let name = scrub(d.data.name || "");
      if (arcLength < 0.35 || estMaxChars < 3) {
        return name.length >= 5 ? name.substring(0, 5) : name;
      }
      if (name.length > estMaxChars && estMaxChars > 1) {
        return name.substring(0, estMaxChars - 1) + CLAMPED_TRUNCATION_SUFFIX;
      }
      return name;
    });
}

function renderLayerRings({
  svg,
  width,
  height,
  layersWithItems,
  colorByTag,
  clickedSegmentId,
  relatedIds,
  ancestorIds,
  handlers,
  tooltipEl,
}) {
  if (!layersWithItems.length) return;

  const radius = Math.min(width, height) / 2 - 20;
  if (radius <= 0) return;

  const g = svg.append("g");

  const ringCount = layersWithItems.length + 1;
  const ringWidth = ringCount === 0 ? radius : radius / ringCount;

  g.append("circle")
    .attr("r", ringWidth)
    .attr("fill", "none")
    .attr("stroke", "#eee")
    .attr("stroke-width", 1);

  const layerPie = d3.pie().sort(null).value(() => 1);
  const scrub = handlers.stripCommonWords || ((name) => name);

  layersWithItems.forEach((layerEntry, layerIndex) => {
    const innerRadius = ringWidth * (layerIndex + 1);
    const outerRadius = ringWidth * (layerIndex + 2);

    const arcGenerator = d3
      .arc()
      .startAngle((d) => d.startAngle)
      .endAngle((d) => d.endAngle)
      .innerRadius(innerRadius)
      .outerRadius(outerRadius);

    const augmentedItems = layerEntry.items.map((item) => ({
      ...item,
      level: layerIndex,
      layer: layerEntry.layer,
    }));

    const arcs = layerPie(augmentedItems);
    const ringGroup = g.append("g").attr("data-layer", layerEntry.layer);

    ringGroup
      .selectAll("path")
      .data(arcs)
      .enter()
      .append("path")
      .attr("d", arcGenerator)
      .attr("fill", (d) => {
        const base = colorByTag ? colorByTag(layerEntry.layer) : "#ccc";
        if (d.data.id?.toString() === clickedSegmentId?.toString()) return "#ff4444";
        return base;
      })
      .attr("stroke", (d) => {
        const id = d.data.id?.toString();
        if (id === clickedSegmentId?.toString()) return "#cc0000";
        if (relatedIds.has(id)) return "#f59e0b";
        if (ancestorIds.has(id)) return "#3b82f6";
        return "#fff";
      })
      .attr("stroke-width", (d) => {
        const id = d.data.id?.toString();
        if (id === clickedSegmentId?.toString()) return 3;
        if (relatedIds.has(id)) return 2;
        if (ancestorIds.has(id)) return 2;
        return 1;
      })
      .style("opacity", (d) => {
        if (!clickedSegmentId) return 1;
        const id = d.data.id?.toString();
        return relatedIds.has(id) || ancestorIds.has(id) || id === clickedSegmentId?.toString() ? 1 : 0.35;
      })
      .style("cursor", "pointer")
      .on("click", (event, d) => handlers.handleSegmentClick?.(event, d))
      .on("contextmenu", (event, d) => handlers.handleSegmentContextMenu?.(event, d))
      .on("mousedown", (event, d) => handlers.handleSegmentMouseDown?.(event, d))
      .attr("data-donut-item-id", (d) => d.data.id)
      .on("mousemove", (event, d) => {
        if (!tooltipEl) return;
        tooltipEl.style.display = "block";
        tooltipEl.style.left = `${event.clientX + 10}px`;
        tooltipEl.style.top = `${event.clientY + 10}px`;
        tooltipEl.textContent = `${d.data.name} (${layerEntry.layer})`;
      })
      .on("mouseleave", () => {
        if (!tooltipEl) return;
        tooltipEl.style.display = "none";
      });

    const fontSize = 10;
    ringGroup
      .selectAll("text")
      .data(arcs)
      .enter()
      .append("text")
      .attr("transform", (d) => {
        const [cx, cy] = arcGenerator.centroid(d);
        return `translate(${cx},${cy})`;
      })
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "#374151")
      .style("font-size", `${fontSize}px`)
      .text((d) => {
        const arcLen = Math.abs(d.endAngle - d.startAngle);
        const rMid = (innerRadius + outerRadius) / 2;
        const estMaxChars = Math.floor((arcLen * rMid) / (fontSize * 0.7));
        const label = scrub(d.data.name || "");
        if (arcLen < 0.25 || estMaxChars < 3) {
          return label.length >= 5 ? label.substring(0, 5) : label;
        }
        if (label.length > estMaxChars) {
          return label.substring(0, Math.max(1, estMaxChars - 1)) + CLAMPED_TRUNCATION_SUFFIX;
        }
        return label;
      });

    const labelRadius = innerRadius + ringWidth / 2;
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "#1d4ed8")
      .attr("font-size", "10px")
      .attr("transform", `rotate(0) translate(0, ${-labelRadius})`)
      .text(layerEntry.layer);
  });
}

// createDonut returns a controller with update/destroy so AppD3Vis can
// initialize, update and tear down the donut renderer.
export function createDonut({ svgEl, data, options = {} }) {
  const modePreference = options.useLayers ?? data?.useLayers;
  const mode = modePreference ? "layers" : (options.mode || "donut");
  const handlers = options.handlers || {};
  const colorByTag = options.colorByTag;
  const tooltipEl = options.tooltipEl ?? null;

  const render = (payload) => {
    const payloadData = payload?.data || payload || data || {};
    const donutTree = payloadData.donutTree || [];
    const layersWithItems = payloadData.layersWithItems || [];
    const clickedSegmentId = payloadData.clickedSegmentId ?? null;
    const relatedIds = payloadData.relatedIds instanceof Set ? payloadData.relatedIds : new Set(payloadData.relatedIds || []);
    const ancestorIds = payloadData.ancestorIds instanceof Set ? payloadData.ancestorIds : new Set(payloadData.ancestorIds || []);

    const fallbackWidth = svgEl?.clientWidth || 700;
    const width = options.width ?? fallbackWidth;
    const fallbackHeight = svgEl?.clientHeight || fallbackWidth;
    const height = options.height ?? fallbackHeight;

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    svg
      .attr("viewBox", `${-width / 2} ${-height / 2} ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    if (mode === "layers") {
      renderLayerRings({
        svg,
        width,
        height,
        layersWithItems,
        colorByTag,
        clickedSegmentId,
        relatedIds,
        ancestorIds,
        handlers,
        tooltipEl,
      });
      return;
    }

    renderAncestryPartition({
      svg,
      width,
      height,
      donutTree,
      clickedSegmentId,
      relatedIds,
      ancestorIds,
      handlers,
    });
  };

  render({ data, options });

  return {
    update(next) {
      render({ data: next, options });
    },
    destroy() {},
  };
}

export default createDonut;

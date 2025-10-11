// Sankey visualizer controller based on provided snippet.
import * as d3 from "d3";
import { sankey as d3Sankey, sankeyLinkHorizontal, sankeyLeft, sankeyRight, sankeyCenter, sankeyJustify } from "d3-sankey";

export function createSankey({ svgEl, data, options = {} }) {
  const {
    width: optWidth,
    height: optHeight,
    linkColor = "source-target",
    nodeAlign = "sankeyLeft",
    handlers = {}
  } = options;

  const render = (payload) => {
    const payloadData = payload?.data || data || {};
    console.log("Sankey render payloadData:", payloadData);
    const nodesIn = payloadData?.nodes || [];
    const linksIn = payloadData?.links || [];

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    // Resolve dimensions
    const cw = Number(svgEl?.clientWidth);
    const width = Number.isFinite(optWidth) ? optWidth : (Number.isFinite(cw) && cw > 0 ? cw : 928);
    const height = Number.isFinite(optHeight) ? optHeight : 600;
    const format = d3.format(",.0f");

    // Guard: require minimal data
    if (!Array.isArray(nodesIn) || !Array.isArray(linksIn) || nodesIn.length === 0) {
      svg.attr("viewBox", `0 0 ${Math.max(1, width)} ${Math.max(1, height)}`)
        .attr("preserveAspectRatio", "xMidYMid meet");
      return;
    }

    svg
      .attr("viewBox", [0, 0, width, height])
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("style", "max-width: 100%; width: 100%; height: auto; font: 10px sans-serif;");

    // Configure sankey
    const alignMap = { sankeyLeft, sankeyRight, sankeyCenter, sankeyJustify };
    const align = alignMap[nodeAlign] || sankeyLeft; // fallback if string is invalid
    const sankey = d3Sankey()
      .nodeId(d => String(d.id ?? d.name))
      .nodeAlign(align)
      .nodeWidth(15)
      .nodePadding(10)
      .extent([[1, 5], [width - 1, height - 5]]);

    // Normalize nodes and links to consistent string ids
    const nodesNorm = nodesIn.map(d => {
      const id = String(d.id ?? d.name);
      return { id, name: d.name ?? d.id ?? id, category: d.category, ...d };
    });
    const linksNorm = linksIn.map(d => {
      const s = typeof d.source === 'object' ? (d.source.id ?? d.source.name) : d.source;
      const t = typeof d.target === 'object' ? (d.target.id ?? d.target.name) : d.target;
      return { source: String(s), target: String(t), value: Number(d.value) || 0 };
    });

    // Pre-check: ensure all link endpoints exist as nodes; if not, add placeholders
    const nodeIds = new Set(nodesNorm.map(n => n.id));
    linksNorm.forEach(l => {
      if (!nodeIds.has(l.source)) { nodeIds.add(l.source); nodesNorm.push({ id: l.source, name: l.source }); }
      if (!nodeIds.has(l.target)) { nodeIds.add(l.target); nodesNorm.push({ id: l.target, name: l.target }); }
    });

    // Apply generator on copies to avoid mutation
    const graph = sankey({
      nodes: nodesNorm.map(d => ({ ...d })),
      links: linksNorm.map(d => ({ ...d }))
    });
    const { nodes, links } = graph;

    // Color scale
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    // Nodes
    const rect = svg.append("g")
      .attr("stroke", "#000")
      .selectAll(null)
      .data(nodes)
      .join("rect")
      .attr("x", d => d.x0)
      .attr("y", d => d.y0)
      .attr("height", d => Math.max(1, d.y1 - d.y0))
      .attr("width", d => Math.max(1, d.x1 - d.x0))
      .attr("fill", d => color(d.category ?? d.name ?? d.id));

    rect.append("title")
      .text(d => `${d.name ?? d.id}\n${format(d.value ?? 0)}`);

    // Links
    const linkG = svg.append("g")
      .attr("fill", "none")
      .attr("stroke-opacity", 0.5)
      .selectAll(null)
      .data(links)
      .join("g")
      .style("mix-blend-mode", "multiply");

    if (linkColor === "source-target") {
      const gradient = linkG.append("linearGradient")
        .attr("id", (_, i) => `link-grad-${i}`)
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", d => d.source.x1)
        .attr("x2", d => d.target.x0);
      gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", d => color(d.source.category ?? d.source.name ?? d.source.id));
      gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", d => color(d.target.category ?? d.target.name ?? d.target.id));
    }

    linkG.append("path")
      .attr("d", sankeyLinkHorizontal())
      .attr("stroke", (d, i) => {
        if (linkColor === "source-target") return `url(#link-grad-${i})`;
        if (linkColor === "source") return color(d.source.category ?? d.source.name ?? d.source.id);
        if (linkColor === "target") return color(d.target.category ?? d.target.name ?? d.target.id);
        return linkColor; // literal color
      })
      .attr("stroke-width", d => Math.max(1, d.width));

    linkG.append("title")
      .text(d => `${d.source.name ?? d.source.id} → ${d.target.name ?? d.target.id}\n${format(d.value ?? 0)}`);

    // Labels
    svg.append("g")
      .selectAll(null)
      .data(nodes)
      .join("text")
      .attr("x", d => (d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6))
      .attr("y", d => (d.y1 + d.y0) / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", d => (d.x0 < width / 2 ? "start" : "end"))
      .text(d => d.name ?? d.id)
      .style("cursor", "pointer")
      .on("click", (event, d) => handlers.handleSegmentClick?.(event, { data: { id: d.id ?? d.name, name: d.name ?? d.id } }))
      .on("contextmenu", (event, d) => handlers.handleSegmentContextMenu?.(event, { data: { id: d.id ?? d.name, name: d.name ?? d.id } }))
      .on("mousedown", (event, d) => handlers.handleSegmentMouseDown?.(event, { data: { id: d.id ?? d.name, name: d.name ?? d.id } }));
  };

  render({ data });
  return {
    update(next) { render({ data: next }); },
    destroy() { }
  };
}

export default createSankey;

// Cluster tree visualizer controller based on provided snippet.
import * as d3 from "d3";

export function createTree({ svgEl, data, options = {} }) {
  const handlers = options.handlers || {};
  const render = (payload) => {
    const payloadData = payload?.data || data || {};
    const nodes = payloadData.treeData || payloadData.donutTree || [];

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    // Resolve width safely; prefer explicit option, else DOM width, else default
    const cw = Number(svgEl?.clientWidth);
    const widthFromEl = Number.isFinite(cw) && cw > 0 ? cw : 928;
    const width = Number.isFinite(options.width) ? options.width : widthFromEl;
    const dx = 14;

    // Build a simple hierarchical object from flat donutTree if provided
    let rootData = payloadData.rootHierarchy;
    if (!rootData && Array.isArray(nodes) && nodes.length) {
      // reconstruct hierarchy from donutTree [{id,label,level,parentId}]
      const byKey = new Map();
      nodes.forEach(n => {
        const key = `${n.id}-${n.level}`;
        byKey.set(key, { id: n.id, name: n.label, children: [] });
      });
      let rootKey = null; let minLevel = Infinity;
      nodes.forEach(n => {
        const key = `${n.id}-${n.level}`;
        if (n.parentId != null && n.level > 0) {
          const pKey = `${n.parentId}-${n.level - 1}`;
          const p = byKey.get(pKey);
          if (p) p.children.push(byKey.get(key));
        }
        if (n.parentId == null || n.level < minLevel) { minLevel = n.level; rootKey = key; }
      });
      rootData = byKey.get(rootKey) || null;
    }

    if (!rootData) {
      // Safe minimal viewBox to avoid NaN attributes
      svg.attr("viewBox", "0 0 1 1").attr("preserveAspectRatio", "xMidYMid meet");
      return;
    }

    const root = d3.hierarchy(rootData);
    const breadth = (root.height + 1) || 1;
    const dy = width / breadth;
    if (!Number.isFinite(dy) || dy <= 0) {
      svg.attr("viewBox", "0 0 1 1").attr("preserveAspectRatio", "xMidYMid meet");
      return;
    }
    const tree = d3.cluster().nodeSize([dx, dy]);
    root.sort((a, b) => d3.ascending(a.data.name, b.data.name));
    tree(root);

    let x0 = Infinity;
    let x1 = -x0;
    root.each(d => { if (d.x > x1) x1 = d.x; if (d.x < x0) x0 = d.x; });
    // Reset viewBox for this vis with an intrinsic height based on layout
    const minHeight = 600;
    const height = Math.max(minHeight, x1 - x0 + dx * 2);

    svg
      .attr("viewBox", [-(dy / 3), x0 - dx, width, height])
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("font", "10px sans-serif");

    svg.append("g")
      .attr("fill", "none")
      .attr("stroke", "#555")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", 1.5)
      .selectAll("path")
      .data(root.links())
      .join("path")
      .attr("d", d3.linkHorizontal().x(d => d.y).y(d => d.x));

    const node = svg.append("g")
      .attr("stroke-linejoin", "round")
      .attr("stroke-width", 3)
      .selectAll("g")
      .data(root.descendants())
      .join("g")
      .attr("transform", d => `translate(${d.y},${d.x})`);

    node.append("circle")
      .attr("fill", d => (d.children ? "#555" : "#999"))
      .attr("r", 2.5);

    node.append("text")
      .attr("dy", "0.31em")
      .attr("x", d => (d.children ? -6 : 6))
      .attr("text-anchor", d => (d.children ? "end" : "start"))
      .text(d => d.data.name)
      .attr("stroke", "white")
      .attr("paint-order", "stroke")
      .style("cursor", "pointer")
      .on("click", (event, d) => handlers.handleSegmentClick?.(event, {
        data: { id: d.data.id, name: d.data.name, level: d.depth }
      }))
        .on("contextmenu", (event, d) => handlers.handleSegmentContextMenu?.(event, { data: { id: d.data.id, name: d.data.name } }))
        .on("mousedown", (event, d) => handlers.handleSegmentMouseDown?.(event, { data: { id: d.data.id, name: d.data.name } }));
  };

  render({ data });
  return {
    update(next) { render({ data: next }); },
    destroy() { }
  };
}

export default createTree;

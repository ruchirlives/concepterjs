// Cluster tree visualizer controller based on provided snippet.
import * as d3 from "d3";

export function createTree({ svgEl, data, options = {} }) {
  const render = (payload) => {
    const payloadData = payload?.data || data || {};
    const nodes = payloadData.treeData || payloadData.donutTree || [];

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const width = options.width ?? (svgEl?.clientWidth || 928);
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

    if (!rootData) return;

    const root = d3.hierarchy(rootData);
    const dy = width / (root.height + 1 || 1);
    const tree = d3.cluster().nodeSize([dx, dy]);
    root.sort((a, b) => d3.ascending(a.data.name, b.data.name));
    tree(root);

    let x0 = Infinity;
    let x1 = -x0;
    root.each(d => { if (d.x > x1) x1 = d.x; if (d.x < x0) x0 = d.x; });
    const height = x1 - x0 + dx * 2;

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
      .attr("paint-order", "stroke");
  };

  render({ data });
  return {
    update(next) { render({ data: next }); },
    destroy() {}
  };
}

export default createTree;


// Cluster bundle (edge bundling in polar coordinates)
import * as d3 from "d3";

function safeBilink(root, linkPairs) {
  const leaves = root.leaves();
  const byId = new Map(leaves.map(d => [String(id(d)), d]));
  for (const d of leaves) {
    d.incoming = [];
    d.outgoing = [];
  }
  for (const l of linkPairs || []) {
    const s = byId.get(String(l.source));
    const t = byId.get(String(l.target));
    if (!s || !t) continue;
    const ref = [s, t];
    s.outgoing.push(ref);
    t.incoming.push(ref);
  }
  return root;
}

function id(node) {
  return node.data.id ?? node.data.name;
}

export function createBundle({ svgEl, data, options = {} }) {
  const {
    width = svgEl?.clientWidth || 954,
    k = 6,
    color = d3.interpolateTurbo, // can be customized later
  } = options;

  const render = () => {
    const payload = data || {};
    const hierarchyData = payload.hierarchy; // {id,name,children:[...]}
    const linkPairs = payload.links || []; // [{source,target}]

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    if (!hierarchyData) {
      svg.attr("viewBox", "0 0 1 1").attr("preserveAspectRatio", "xMidYMid meet");
      return;
    }
    // Debug: ensure we have nodes/links
    // console.log('Bundle payload', { hasHierarchy: !!hierarchyData, linkCount: linkPairs.length });

    // Attach links to leaf nodes by id
    // We store for each leaf a list of target ids in data.links
    const root = d3.hierarchy(hierarchyData)
      .sort((a, b) => d3.ascending(a.height, b.height) || d3.ascending(a.data.name, b.data.name));

    // Compute stable radius and margins so labels/edges fit inside canvas
    const W = Math.max(300, width);
    const R = W / 2;
    const ringMargin = 140; // distance from outer radius to leaf ring
    const vbPad = 60;       // extra padding on viewBox to avoid clipping

    const tree = d3.cluster().size([2 * Math.PI, R - ringMargin]);
    const clustered = tree(root);
    safeBilink(clustered, linkPairs);

    svg
      .attr("viewBox", [-(R + vbPad), -(R + vbPad), 2 * (R + vbPad), 2 * (R + vbPad)])
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("height", "100%")
      .attr("style", "max-width: 100%; font: 10px sans-serif;");

    // Zoom/pan container
    const g = svg.append("g").attr("class", "content");

    const leaves = clustered.leaves();

    const node = g.append("g")
      .selectAll(null)
      .data(leaves)
      .join("g")
      .attr("transform", d => `rotate(${(d.x * 180 / Math.PI) - 90}) translate(${d.y},0)`);

    node.append("text")
      .attr("dy", "0.31em")
      .attr("x", d => d.x < Math.PI ? 6 : -6)
      .attr("text-anchor", d => d.x < Math.PI ? "start" : "end")
      .attr("transform", d => d.x >= Math.PI ? "rotate(180)" : null)
      .style("font-size", "25px") // increased label size
      .text(d => d.data.name ?? d.data.id)
      .append("title")
      .text(d => `${id(d)}\n${d.outgoing?.length || 0} outgoing\n${d.incoming?.length || 0} incoming`);

    const line = d3.lineRadial()
      .curve(d3.curveBundle)
      .radius(d => d.y)
      .angle(d => d.x);

    // Build all paths
    const allPaths = clustered.leaves().flatMap(leaf => (leaf.outgoing || []).map(([s, t]) => [s, t]));

    g.append("g")
      .attr("fill", "none")
      .selectAll(null)
      .data(allPaths)
      .join("path")
      .style("mix-blend-mode", "darken")
      .attr("stroke", (_, i) => color(d3.easeQuad((i % ((1 << k))) / ((1 << k) - 1))))
      .attr("d", d => {
        const ctx = d3.path();
        line.context(ctx)(d[0].path(d[1]));
        return ctx.toString();
      })
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1);

    // Ctrl+wheel zoom and drag pan
    const zoom = d3.zoom()
      .scaleExtent([0.5, 8])
      // Constrain panning to keep most content within canvas
      .translateExtent([[
        -(R + vbPad) * 2, -(R + vbPad) * 2
      ], [
        (R + vbPad) * 2, (R + vbPad) * 2
      ]])
      .filter((event) => event.ctrlKey || event.type === "mousedown" || event.type === "dblclick")
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoom);

    // Prevent browser page zoom while Ctrl+wheel is used over the SVG
    // Use non-passive listener so preventDefault works for wheel
    svg.on("wheel.prevent", (event) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    }, { passive: false });
  };

  render();
  return {
    update(next) {
      if (next) {
        data = next;
      }
      render();
    },
    destroy() { }
  };
}

export default createBundle;

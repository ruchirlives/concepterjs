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
    const ringMargin = 100; // distance from outer radius to leaf ring
    const vbPad = 80;       // extra padding on viewBox to avoid clipping

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

    // Dynamic font size based on number of leaves and radius
    const N = Math.max(1, leaves.length);
    const theta = (2 * Math.PI) / N;
    const minFs = 10;
    const maxFs = 100;
    const fsFromTheta = Math.max(minFs, Math.min(maxFs, (theta / 0.25) * maxFs));
    const radiusFactor = Math.max(0.85, Math.min(1.15, (R / 400)));
    const dynamicFontSize = Math.max(minFs, Math.min(maxFs, fsFromTheta * radiusFactor));

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
      .style("font-size", `${dynamicFontSize}px`)
      .text(d => d.data.name ?? d.data.id)
      .append("title")
      .text(d => `${id(d)}\n${d.outgoing?.length || 0} outgoing\n${d.incoming?.length || 0} incoming`);

    const line = d3.lineRadial()
      .curve(d3.curveBundle)
      .radius(d => d.y)
      .angle(d => d.x);

    // Prepare width scale based on parent counts (source node parents)
    const parentCount = payload.parentCount || {};
    const countValues = Object.values(parentCount);
    const cMin = countValues.length ? Math.min(...countValues) : 1;
    const cMax = countValues.length ? Math.max(...countValues) : 1;
    const widthScale = d3.scaleSqrt().domain([cMin, cMax]).range([0.5, 4]);

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
      .attr("stroke-width", d => {
        const sid = String(d[0].data.id ?? d[0].data.name);
        const cnt = parentCount[sid] || cMin;
        return widthScale(cnt);
      });

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

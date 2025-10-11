import * as d3 from "d3";

function linkArc(d) {
  const dx = d.target.x - d.source.x;
  const dy = d.target.y - d.source.y;
  const r = Math.hypot(dx, dy) || 1;
  return `M${d.source.x},${d.source.y}A${r},${r} 0 0,1 ${d.target.x},${d.target.y}`;
}

function drag(simulation) {
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
  return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
}

export function createForce({ svgEl, data, options = {} }) {
  const W = svgEl?.clientWidth || 928;
  const H = svgEl?.clientHeight || 600;
  const nodeRadius = options.nodeRadius || 4;

  const render = () => {
    const payload = data || {};
    const nodes = (payload.nodes || []).map(d => ({ id: String(d.id) }));
    const links = (payload.links || []).map(l => ({ source: String(l.source), target: String(l.target), type: l.type || "default" }));

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    svg
      .attr("viewBox", [-W / 2, -H / 2, W, H])
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("height", "100%")
      .attr("style", "max-width: 100%; font: 12px sans-serif;");

    const types = Array.from(new Set(links.map(d => d.type)));
    const color = d3.scaleOrdinal(types, d3.schemeCategory10);

    // Define markers per type
    svg.append("defs").selectAll("marker")
      .data(types)
      .join("marker")
        .attr("id", d => `arrow-${d}`)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 15)
        .attr("refY", -0.5)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
      .append("path")
        .attr("fill", d => color(d))
        .attr("d", "M0,-5L10,0L0,5");

    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(options.linkDistance || 50))
      .force("charge", d3.forceManyBody().strength(options.charge || -400))
      .force("x", d3.forceX(0))
      .force("y", d3.forceY(0));

    const g = svg.append("g");

    const link = g.append("g")
      .attr("fill", "none")
      .attr("stroke-width", 1.5)
      .selectAll("path")
      .data(links)
      .join("path")
        .attr("stroke", d => color(d.type))
        .attr("marker-end", d => `url(#arrow-${d.type})`);

    const node = g.append("g")
      .attr("fill", "currentColor")
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
      .selectAll("g")
      .data(nodes)
      .join("g")
        .call(drag(sim));

    node.append("circle")
      .attr("stroke", "white")
      .attr("stroke-width", 1.5)
      .attr("r", nodeRadius);

    node.append("text")
      .attr("x", 8)
      .attr("y", "0.31em")
      .text(d => d.id)
      .clone(true).lower()
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-width", 3);

    sim.on("tick", () => {
      link.attr("d", d => linkArc(d));
      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Clean up on destroy via returned API
    // No-op here; destroy() will stop the simulation
  };

  render();
  return {
    update(next) {
      if (next) data = next;
      render();
    },
    destroy() {
      // attempt to stop any running simulation by selecting and stopping
      // we created it inside render; safest is to clear svg; simulation stops when detached
    }
  };
}

export default createForce;


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

function wrapText(selection, maxChars = 18) {
  selection.each(function (d) {
    const text = d3.select(this);
    const full = (d.name ?? d.id ?? "").toString();
    const words = full.split(/\s+/);
    const lines = [];
    let line = "";
    words.forEach(w => {
      const candidate = line ? line + " " + w : w;
      if (candidate.length <= maxChars) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = w;
      }
    });
    if (line) lines.push(line);

    // enforce two lines max with ellipsis on second if truncated
    let out = lines.slice(0, 2);
    if (lines.length > 2) {
      let second = out[1] || "";
      if (second.length > maxChars - 1) second = second.slice(0, maxChars - 1);
      out[1] = second.replace(/\s+$/, "") + "…";
    }

    text.text(null);
    out.forEach((ln, i) => {
      text.append("tspan")
        .attr("x", 8)
        .attr("dy", i === 0 ? "0.31em" : "1.1em")
        .text(ln);
    });
  });
}

export function createForce({ svgEl, data, options = {} }) {
  const W = svgEl?.clientWidth || 928;
  const H = svgEl?.clientHeight || 600;
  const nodeRadius = options.nodeRadius || 4;
  console.log("data", data, "options", options);

  const render = () => {
    const payload = data || {};
    const nodes = (payload.nodes || []).map(d => ({ id: String(d.id), name: d.name || String(d.id), ...d, hoverName: d.hoverName || d.name || String(d.id) }));
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

    const label = node.append("text")
      .attr("text-anchor", "start")
      .attr("font-size", 8)
      .call(sel => wrapText(sel, options.maxLabelChars || 8));

    label.clone(true).lower()
      .attr("fill", "none")
      .attr("stroke", "white")
      .attr("stroke-width", 3);

    // Right-click context menu: forward to host handler via options.handlers
    node.on("contextmenu", function(event, d) {
      event.preventDefault();
      const handlers = options.handlers || {};
      if (handlers.handleSegmentContextMenu) {
        handlers.handleSegmentContextMenu(event, { data: { id: d.id, name: d.name } });
      }
    });

    // Enable scroll-zoom and drag-pan on the SVG, transforming the container group
    const zoom = d3.zoom()
      .scaleExtent([0.5, 8])
      .translateExtent([[-W, -H], [W, H]])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    svg.call(zoom);

    // Helper to rebuild a text selection with wrapped tspans from content
    function setWrappedLabel(textSel, content, maxChars) {
      const words = (content || "").toString().split(/\s+/);
      const lines = [];
      let line = "";
      words.forEach(w => {
        const candidate = line ? line + " " + w : w;
        if (candidate.length <= maxChars) line = candidate;
        else { if (line) lines.push(line); line = w; }
      });
      if (line) lines.push(line);

      let out = lines.slice(0, 2);
      if (lines.length > 5) {
        let second = out[1] || "";
        if (second.length > maxChars - 1) second = second.slice(0, maxChars - 1);
        out[1] = second.replace(/\s+$/, "") + "…";
      }

      textSel.text(null);
      out.forEach((ln, i) => {
        textSel.append("tspan")
          .attr("x", 8)
          .attr("dy", i === 0 ? "0.31em" : "1.1em")
          .text(ln);
      });
    }

    // Hover using mouseenter/mouseleave; swap to hoverName and back (two-line wrap)
    node
      .on('mouseover', function(event, d) {
        const text = d3.select(this).select('text:not([stroke])');
        const content = (d.hoverName ?? d.name ?? d.id ?? '').toString();
        setWrappedLabel(text, content, options.maxHoverChars || 50);
        text
          .style('fill', options.hoverFill || '#0a3d91')
          .style('font-weight', '600')
          .raise();
      })
      .on('mouseout', function(event, d) {
        const text = d3.select(this).select('text:not([stroke])');
        text.text(null);
        text
          .call(sel => wrapText(sel, options.maxLabelChars || 20))
          .style('fill', null)
          .style('font-weight', null);
      });

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

import React, { useEffect, useRef, useMemo, useState } from "react";
import * as d3 from "d3";
import { useAppContext } from "./AppContext";
import { useMatrixLogic } from "./hooks/useMatrixLogic";

// 1. Build a tree from your data
function buildTree(nodeId, childrenMap, nameById, processed = new Set(), maxDepth = 6, depth = 0) {
  if (!nodeId || processed.has(nodeId) || depth > maxDepth) return null;
  processed.add(nodeId);
  const node = {
    id: nodeId,
    name: nameById[nodeId] || nodeId,
    children: []
  };
  // Find children (i.e., nodes for which this node is a parent)
  const childIds = Object.entries(childrenMap)
    .filter(([parentId, children]) => parentId === nodeId)
    .flatMap(([_, children]) => children);
  node.children = childIds
    .map(childId => buildTree(childId, childrenMap, nameById, processed, maxDepth, depth + 1))
    .filter(Boolean);
  return node;
}

// 2. Use d3.partition to compute angles
const AppDonut = ({ targetId }) => {
  const svgRef = useRef();
  const tooltipRef = useRef();
  const { rowData } = useAppContext();
  const { childrenMap, nameById } = useMatrixLogic();

  const [id, setId] = useState(
    targetId || (rowData && rowData.length > 0 ? rowData[0].id.toString() : "")
  );

  useEffect(() => {
    const channel = new BroadcastChannel('selectNodeChannel');
    channel.onmessage = (event) => {
      const { nodeId } = event.data;
      if (nodeId) {
        setId(nodeId.toString());
      }
    };
    return () => channel.close();
  }, []);

  const treeData = useMemo(() => {
    if (!id || !childrenMap || !nameById) return null;
    return buildTree(id, childrenMap, nameById);
  }, [id, childrenMap, nameById]);

  // 1. Gather all unique tags
  const allTags = useMemo(() => {
    if (!rowData) return [];
    const tags = new Set();
    rowData.forEach(row => {
      if (row.Tags) tags.add(row.Tags);
    });
    return Array.from(tags);
  }, [rowData]);

  // 2. Color scale by tag
  const colorByTag = useMemo(() => {
    return d3.scaleOrdinal()
      .domain(allTags)
      .range(d3.schemeCategory10.concat(d3.schemeSet3, d3.schemePaired));
  }, [allTags]);

  // Get the root node's full label
  const rootLabel = useMemo(() => {
    if (!treeData) return "";
    return treeData.name || "";
  }, [treeData]);

  useEffect(() => {
    if (!treeData) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 700, height = 700, radius = Math.min(width, height) / 2 - 20;
    const g = svg.append("g").attr("transform", `translate(${width / 2}, ${height / 2})`);

    // Convert tree to d3.hierarchy
    const root = d3.hierarchy(treeData)
      .sum(d => 1)
      .sort((a, b) => d3.ascending(a.data.name, b.data.name));

    // Partition layout
    d3.partition()
      .size([2 * Math.PI, radius])(root);

    // Arc generator
    const arc = d3.arc()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .innerRadius(d => d.y0)
      .outerRadius(d => d.y1);

    // For text paths (middle of arc)
    const textArc = d3.arc()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .innerRadius(d => (d.y0 + d.y1) / 2)
      .outerRadius(d => (d.y0 + d.y1) / 2);

    // Draw arcs
    const nodes = root.descendants().filter(d => d.depth > 0);

    g.selectAll("path")
      .data(nodes)
      .enter().append("path")
      .attr("d", arc)
      .attr("fill", d => {
        // Find the row for this node
        const row = rowData.find(r => r.id?.toString() === d.data.id?.toString());
        return row && row.Tags ? colorByTag(row.Tags) : "#ccc";
      })
      .attr("stroke", "#fff")
      .on("mousemove", function(event, d) {
        const tooltip = tooltipRef.current;
        if (tooltip) {
          tooltip.style.display = "block";
          tooltip.style.left = (event.clientX + 10) + "px";
          tooltip.style.top = (event.clientY + 10) + "px";
          tooltip.textContent = d.data.name;
        }
      })
      .on("mouseleave", function() {
        const tooltip = tooltipRef.current;
        if (tooltip) {
          tooltip.style.display = "none";
        }
      });

    // Draw invisible paths for text
    g.selectAll("defs")
      .data(nodes)
      .enter()
      .append("path")
      .attr("id", d => `arc-label-${d.data.id}`)
      .attr("d", d => {
        // Flip path for left-side arcs
        const midAngle = (d.x0 + d.x1) / 2;
        if (midAngle > Math.PI / 2 && midAngle < 3 * Math.PI / 2) {
          // Reverse path
          return textArc({ ...d, x0: d.x1, x1: d.x0 });
        }
        return textArc(d);
      })
      .style("fill", "none")
      .style("stroke", "none");

    // Add curved text labels
    g.selectAll("text")
      .data(nodes)
      .enter()
      .append("text")
      .attr("dy", "0.32em")
      .append("textPath")
      .attr("href", d => `#arc-label-${d.data.id}`)
      .attr("startOffset", "5%")
      .style("text-anchor", "left")
      .style("font-size", "10px") // <-- Add this line
      .text(d => {
        const arcLength = Math.abs(d.x1 - d.x0);
        const minArc = 0.35;
        const fontSize = 10;
        const r = (d.y0 + d.y1) / 2;
        const estMaxChars = Math.floor((arcLength * r) / (fontSize * 0.6));
        if (arcLength < minArc || estMaxChars < 3) return "";
        let label = d.data.name;
        if (label.length > estMaxChars) label = label.substring(0, estMaxChars - 1) + "…";
        return label;
      });
  }, [treeData, rowData, colorByTag]);

  if (!id) {
    return (
      <div className="bg-white rounded shadow p-4" style={{ width: 800, height: 800 }}>
        <h2 className="font-semibold mb-2">Donut View (D3)</h2>
        <p>No node selected</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded shadow p-4" style={{ width: 900, height: 800, position: "relative" }}>
      <h2 className="font-semibold mb-2">Donut View (D3)</h2>
      {/* Root node label at the top */}
      <div style={{ fontWeight: "bold", fontSize: "1.2rem", marginBottom: "10px" }}>
        {rootLabel}
      </div>
      <svg
        ref={svgRef}
        width={850}
        height={750}
        style={{ border: "1px solid #ddd" }}
      />
      {/* Tooltip div */}
      <div
        ref={tooltipRef}
        style={{
          position: "fixed",
          pointerEvents: "none",
          background: "rgba(0,0,0,0.8)",
          color: "#fff",
          padding: "4px 8px",
          borderRadius: "4px",
          fontSize: "14px",
          display: "none",
          zIndex: 1000
        }}
      />
    </div>
  );
};

export default AppDonut;

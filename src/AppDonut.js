import React, { useEffect, useRef, useMemo, useState, useCallback } from "react";
import * as d3 from "d3";
import { useAppContext } from "./AppContext";
import { useMatrixLogic } from "./hooks/useMatrixLogic";

// Build ancestry tree as flat array: [{id, level, label, parentId}, ...]
function buildAncestryTree(nodeId, nameById, childrenMap, maxDepth = 6, startingLevel = 0) {
  const tree = [];

  // Step 1: Add root item at level 0
  if (startingLevel === 0) {
    tree.push({
      id: nodeId,
      level: 0,
      label: nameById[nodeId] || nodeId,
      parentId: null // Root has no parent
    });
  }

  // Step 2: Build levels iteratively
  for (let level = startingLevel; level < maxDepth; level++) {
    // Get all items at current level
    let currentLevelItems = tree.filter(item => item.level === level);

    // Special case: if we're at startingLevel > 0 and there are no items yet, add the starting node
    if (currentLevelItems.length === 0 && level === startingLevel && startingLevel > 0) {
      const startingItem = {
        id: nodeId,
        level: startingLevel,
        label: nameById[nodeId] || nodeId,
        parentId: null // Will be set by the calling function if needed
      };
      tree.push(startingItem);
      // Update currentLevelItems to include the node we just added
      currentLevelItems = [startingItem];
    }

    // If still no items at this level, break
    if (currentLevelItems.length === 0) {
      break;
    }

    // Take the first item of current level
    const firstItem = currentLevelItems[0];

    // Find all parents of this item
    const parentIds = [];
    Object.entries(childrenMap).forEach(([parentId, children]) => {
      if (children.includes(firstItem.id)) {
        parentIds.push(parentId);
      }
    });


    // Add parents as next level
    parentIds.forEach(parentId => {
      // Check if this parent is already in the tree
      if (!tree.find(item => item.id === parentId)) {
        const parentItem = {
          id: parentId,
          level: level + 1,
          label: nameById[parentId] || parentId,
          parentId: firstItem.id // This parent's child is the firstItem
        };
        tree.push(parentItem);
      }
    });

    if (parentIds.length === 0) {
      break;
    }
  }

  return tree;
}

const AppDonut = ({ targetId }) => {
  const svgRef = useRef();
  const tooltipRef = useRef();
  const { rowData } = useAppContext();
  const { childrenMap, nameById } = useMatrixLogic();

  const [id, setId] = useState(
    targetId || (rowData && rowData.length > 0 ? rowData[0].id.toString() : "")
  );
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  const [donutTree, setDonutTree] = useState([]);
  const [clickedSegmentId, setClickedSegmentId] = useState(null); // New state for clicked segment
  const [isInternalClick, setIsInternalClick] = useState(false); // Add this flag

  useEffect(() => {
    const channel = new BroadcastChannel('selectNodeChannel');
    channel.onmessage = (event) => {
      const { nodeId } = event.data;
      if (nodeId && !isInternalClick) { // Only respond to external broadcasts
        setId(nodeId.toString());
        setFocusedNodeId(null); // Reset focus when changing root
        setClickedSegmentId(null); // Clear any clicked segment highlighting
      }
      // Reset the flag after processing
      setIsInternalClick(false);
    };
    return () => channel.close();
  }, [isInternalClick]);

  // Build the donut tree whenever id changes
  useEffect(() => {
    // Determine which node to use as the root
    const rootNodeId = focusedNodeId || id;

    if (!rootNodeId || !childrenMap || !nameById) {
      setDonutTree([]);
      return;
    }

    // Build ancestry tree starting from the determined root node
    const tree = buildAncestryTree(rootNodeId, nameById, childrenMap);
    setDonutTree(tree);
  }, [id, focusedNodeId, nameById, childrenMap]);

  // 1. Gather all unique tags
  const allTags = useMemo(() => {
    if (!rowData) return [];
    const tags = new Set();
    rowData.forEach(row => {
      if (row.Tags) tags.add(row.Tags);
    });
    return Array.from(tags);
  }, [rowData]);

  // 2. Color scale by tag (lighten the colors)
  const colorByTag = useMemo(() => {
    const pastel = d3.schemePastel1;
    if (allTags.length <= pastel.length) {
      return d3.scaleOrdinal().domain(allTags).range(pastel);
    }
    return d3.scaleOrdinal()
      .domain(allTags)
      .range(allTags.map((_, i) => {
        const c = d3.color(d3.interpolateRainbow(i / allTags.length));
        c.opacity = 1;
        const r = Math.round((c.r + 255) / 2);
        const g = Math.round((c.g + 255) / 2);
        const b = Math.round((c.b + 255) / 2);
        return `rgb(${r},${g},${b})`;
      }));
  }, [allTags]);

  // Get the root node's full label
  const rootLabel = useMemo(() => {
    if (donutTree.length === 0) return "";
    const rootItem = donutTree.find(item => item.level === 0);
    return rootItem ? rootItem.label : "";
  }, [donutTree]);

  // Function to handle segment clicks
  const handleSegmentClick = useCallback((event, d) => {
    event.stopPropagation();

    // Extract the level and id from the clicked segment
    const clickedId = d.data.id;
    const clickedLevel = d.data.level;

    // Set flag to indicate this is an internal click
    setIsInternalClick(true);

    // Broadcast the selected segment's id
    const channel = new BroadcastChannel('selectNodeChannel');
    channel.postMessage({ nodeId: clickedId });

    // Set the clicked segment for highlighting
    setClickedSegmentId(clickedId);

    // Step 1: Clear all items with level > clickedLevel from donutTree (keep the clicked level)
    const filteredTree = donutTree.filter(item => item.level <= clickedLevel);

    // Step 2: Get the subtree starting from the clicked segment (but starting at level 0)
    const subtree = buildAncestryTree(clickedId, nameById, childrenMap, 1, 0);

    // Step 3: Adjust subtree levels to be children of the clicked segment
    // Remove the root of subtree (which is the clicked segment itself) and shift all other levels
    const adjustedSubtree = subtree
      .filter(item => item.level > 0) // Remove the root (level 0) which duplicates clicked segment
      .map((item, index, array) => ({
        ...item,
        level: item.level + clickedLevel, // Shift levels to be children of clicked segment
        parentId: item.level === 1 ? clickedId : item.parentId // First level's parent is clicked segment
      }));

    // Step 4: Merge the filtered tree with the adjusted subtree
    const mergedTree = [...filteredTree, ...adjustedSubtree];

    // Step 5: Remove duplicates (keep items from adjustedSubtree if there are conflicts)
    const uniqueTree = [];
    const seen = new Set();

    // Process in reverse order so adjustedSubtree items take precedence
    [...mergedTree].reverse().forEach(item => {
      const key = `${item.id}-${item.level}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueTree.unshift(item);
      }
    });

    setDonutTree(uniqueTree);
  }, [donutTree, nameById, childrenMap]);

  useEffect(() => {
    if (donutTree.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 700, height = 700, radius = Math.min(width, height) / 2 - 20;
    const g = svg.append("g").attr("transform", `translate(${width / 2}, ${height / 2})`);

    // Group items by level
    const levels = {};
    donutTree.forEach(item => {
      if (!levels[item.level]) levels[item.level] = [];
      levels[item.level].push(item);
    });

    // Build proper hierarchy: level 0 → level 1 as children → level 2 as children of first level 1, etc.
    // Build proper hierarchy using parentId relationships
    function buildProperHierarchy() {
      if (donutTree.length === 0) return null;

      // Use composite key: id-level
      const itemsByKey = {};
      donutTree.forEach(item => {
        const key = `${item.id}-${item.level}`;
        itemsByKey[key] = {
          id: item.id,
          name: item.label,
          level: item.level,
          parentId: item.parentId,
          parentLevel: item.level > 0 ? item.level - 1 : null,
          children: []
        };
      });

      // Find the root (lowest level, or parentId === null)
      let root = null;
      let minLevel = Infinity;
      let rootKey = null;
      donutTree.forEach(item => {
        if ((item.level < minLevel || item.parentId === null)) {
          minLevel = item.level;
          rootKey = `${item.id}-${item.level}`;
        }
      });
      root = itemsByKey[rootKey];
      if (!root) return null;

      // Link children using composite keys
      donutTree.forEach(item => {
        if (item.parentId !== null && item.level > 0) {
          const parentKey = `${item.parentId}-${item.level - 1}`;
          const childKey = `${item.id}-${item.level}`;
          if (itemsByKey[parentKey]) {
            itemsByKey[parentKey].children.push(itemsByKey[childKey]);
          }
        }
      });

      return root;
    }

    const treeData = buildProperHierarchy();

    if (!treeData) return;

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
    const nodes = root.descendants().filter(d => d.depth >= 0);

    g.selectAll("path")
      .data(nodes)
      .enter().append("path")
      .attr("d", arc)
      .attr("fill", d => {
        // Check if this is the clicked segment
        if (d.data.id === clickedSegmentId) {
          return "#ff4444"; // Strong red color for clicked segment
        }

        // Normal coloring for other segments
        const row = rowData.find(r => r.id?.toString() === d.data.id?.toString());
        return row && row.Tags ? colorByTag(row.Tags) : "#ccc";
      })
      .attr("stroke", d => {
        // Add a thicker stroke to the clicked segment
        return d.data.id === clickedSegmentId ? "#cc0000" : "#fff";
      })
      .attr("stroke-width", d => {
        // Thicker stroke for clicked segment
        return d.data.id === clickedSegmentId ? 3 : 1;
      })
      .style("cursor", "pointer")
      .on("click", handleSegmentClick)
      .on("mousemove", function (event, d) {
        const tooltip = tooltipRef.current;
        if (tooltip) {
          tooltip.style.display = "block";
          tooltip.style.left = (event.clientX + 10) + "px";
          tooltip.style.top = (event.clientY + 10) + "px";
          tooltip.textContent = d.data.name;
        }
      })
      .on("mouseleave", function () {
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
        const midAngle = (d.x0 + d.x1) / 2;
        if (midAngle > Math.PI / 2 && midAngle < 3 * Math.PI / 2) {
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
      .style("font-size", "9px")
      .text(d => {
        const arcLength = Math.abs(d.x1 - d.x0);
        const minArc = 0.35;
        const fontSize = 9;
        const r = (d.y0 + d.y1) / 2;
        const estMaxChars = Math.floor((arcLength * r) / (fontSize * 0.7));

        let label = d.data.name;

        // If the segment would normally be blank, show first 5 chars
        if (arcLength < minArc || estMaxChars < 3) {
          return label.length >= 5 ? label.substring(0, 5) : label;
        }

        // Normal truncation logic for segments that have enough space
        if (label.length > estMaxChars) {
          label = label.substring(0, estMaxChars - 1) + "…";
        }
        return label;
      });
  }, [donutTree, rowData, colorByTag, handleSegmentClick, clickedSegmentId]); // Added clickedSegmentId to dependencies

  // Reset clicked segment when changing root
  useEffect(() => {
    setClickedSegmentId(null);
  }, [id]);

  if (!id) {
    return (
      <div className="bg-white rounded shadow p-4" style={{ width: 800, height: 800 }}>
        <h2 className="font-semibold mb-2">Donut View (D3)</h2>
        <p>No node selected</p>
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded shadow p-4"
      style={{
        width: 900,
        height: 1000,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
      }}
    >
      <h2 className="font-semibold mb-2">Donut View (D3)</h2>
      <div style={{ fontWeight: "bold", fontSize: "1.2rem", marginBottom: "10px" }}>
        {rootLabel}
        {focusedNodeId && (
          <div style={{ fontSize: "0.9rem", color: "#666", fontWeight: "normal" }}>
            Focused on: {nameById[focusedNodeId]}
          </div>
        )}
      </div>
      {focusedNodeId && (
        <button
          onClick={() => setFocusedNodeId(null)}
          style={{
            marginBottom: "10px",
            padding: "5px 10px",
            background: "#f0f0f0",
            border: "1px solid #ccc",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Show All Lineage
        </button>
      )}
      <svg
        ref={svgRef}
        width={850}
        height={750}
        style={{
          border: "1px solid #ddd",
          display: "block",
          margin: "0 auto"
        }}
      />
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

import React, { useEffect, useRef, useMemo, useState, useCallback } from "react";
import * as d3 from "d3";
import { useAppContext } from "./AppContext";
import { useMatrixLogic } from "./hooks/useMatrixLogic";

// Build ancestry tree as flat array: [{id, level, label}, ...]
function buildAncestryTree(nodeId, nameById, childrenMap, maxDepth = 6, startingLevel = 0) {
  const tree = [];
  console.log(`Building ancestry tree for nodeId: ${nodeId}, startingLevel: ${startingLevel}`);

  // Step 1: Add root item at level 0
  if (startingLevel === 0) {
    tree.push({
      id: nodeId,
      level: 0,
      label: nameById[nodeId] || nodeId
    });
    console.log(`Added root at level 0:`, tree[tree.length - 1]);
  }

  // Step 2: Build levels iteratively
  for (let level = startingLevel; level < maxDepth; level++) {
    console.log(`Processing level ${level}`);
    
    // Get all items at current level
    let currentLevelItems = tree.filter(item => item.level === level);
    console.log(`Items at level ${level}:`, currentLevelItems);

    // Special case: if we're at startingLevel > 0 and there are no items yet, add the starting node
    if (currentLevelItems.length === 0 && level === startingLevel && startingLevel > 0) {
      const startingItem = {
        id: nodeId,
        level: startingLevel,
        label: nameById[nodeId] || nodeId
      };
      tree.push(startingItem);
      console.log(`Added starting node at level ${startingLevel}:`, startingItem);
      
      // Update currentLevelItems to include the node we just added
      currentLevelItems = [startingItem];
    }

    // If still no items at this level, break
    if (currentLevelItems.length === 0) {
      console.log(`Breaking at level ${level} - no items to process`);
      break;
    }

    // Take the first item of current level
    const firstItem = currentLevelItems[0];
    console.log(`Processing first item at level ${level}:`, firstItem);

    // Find all parents of this item
    const parentIds = [];
    Object.entries(childrenMap).forEach(([parentId, children]) => {
      if (children.includes(firstItem.id)) {
        parentIds.push(parentId);
      }
    });

    console.log(`Found ${parentIds.length} parents for ${firstItem.id}:`, parentIds);

    // Add parents as next level
    parentIds.forEach(parentId => {
      // Check if this parent is already in the tree
      if (!tree.find(item => item.id === parentId)) {
        const parentItem = {
          id: parentId,
          level: level + 1,
          label: nameById[parentId] || parentId
        };
        tree.push(parentItem);
        console.log(`Added parent at level ${level + 1}:`, parentItem);
      } else {
        console.log(`Parent ${parentId} already exists in tree`);
      }
    });

    if (parentIds.length === 0) {
      console.log(`No parents found for ${firstItem.id}, stopping at level ${level}`);
      break;
    }
  }

  console.log(`Final tree:`, tree);
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
  const [donutTree, setDonutTree] = useState([]); // New state variable

  useEffect(() => {
    const channel = new BroadcastChannel('selectNodeChannel');
    channel.onmessage = (event) => {
      const { nodeId } = event.data;
      if (nodeId) {
        setId(nodeId.toString());
        setFocusedNodeId(null); // Reset focus when changing root
      }
    };
    return () => channel.close();
  }, []);

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

    console.log(`Clicked segment - ID: ${clickedId}, Level: ${clickedLevel}`);

    // Step 1: Clear all items with level >= clickedLevel + 1 from donutTree
    const filteredTree = donutTree.filter(item => item.level <= clickedLevel);

    console.log('Original donutTree:', donutTree);
    console.log('Filtered donutTree (cleared levels beyond clicked level):', filteredTree);

    // Step 2: Get the subtree starting from the clicked segment
    const subtree = buildAncestryTree(clickedId, nameById, childrenMap, 6, clickedLevel);

    console.log('Subtree built from clicked segment:', subtree);

    // Step 3: Merge the filtered tree with the new subtree
    const mergedTree = [...filteredTree, ...subtree];

    // Step 4: Remove duplicates (keep items from subtree if there are conflicts)
    const uniqueTree = [];
    const seen = new Set();

    // Process in reverse order so subtree items take precedence
    [...mergedTree].reverse().forEach(item => {
      const key = `${item.id}-${item.level}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueTree.unshift(item);
      }
    });

    console.log('Final merged and deduplicated tree:', uniqueTree);

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
    function buildProperHierarchy() {
      if (!levels[0] || levels[0].length === 0) return null;

      // Start with level 0 (root)
      const root = {
        id: levels[0][0].id,
        name: levels[0][0].label,
        level: 0,
        children: []
      };

      // Recursive function to add children at each level
      function addChildrenAtLevel(parentNode, level) {
        if (!levels[level] || levels[level].length === 0) return;

        // Add all items at this level as children
        parentNode.children = levels[level].map(item => ({
          id: item.id,
          name: item.label,
          level: level,
          children: []
        }));

        // Recursively add children to the first child (to maintain linear chain)
        if (parentNode.children.length > 0) {
          addChildrenAtLevel(parentNode.children[0], level + 1);
        }
      }

      // Start adding children from level 1
      addChildrenAtLevel(root, 1);

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
        const row = rowData.find(r => r.id?.toString() === d.data.id?.toString());
        return row && row.Tags ? colorByTag(row.Tags) : "#ccc";
      })
      .attr("stroke", "#fff")
      .style("cursor", "pointer")
      .on("click", handleSegmentClick) // Use the new function
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
      .style("font-size", "10px")
      .text(d => {
        const arcLength = Math.abs(d.x1 - d.x0);
        const minArc = 0.35;
        const fontSize = 10;
        const r = (d.y0 + d.y1) / 2;
        const estMaxChars = Math.floor((arcLength * r) / (fontSize * 0.7));
        if (arcLength < minArc || estMaxChars < 3) return "";
        let label = d.data.name;
        if (label.length > estMaxChars) label = label.substring(0, estMaxChars - 1) + "…";
        return label;
      });
  }, [donutTree, rowData, colorByTag, handleSegmentClick]); // Dependencies stay the same for now

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

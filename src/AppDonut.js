import React, { useEffect, useRef, useMemo, useState, useCallback } from "react";
import * as d3 from "d3";
import { useAppContext } from "./AppContext";
import { useMatrixLogic } from "./hooks/useMatrixLogic";
import { ContextMenu, useMenuHandlers } from "./hooks/useContextMenu"; // <-- Add this import
import LayerDropdown from "./components/LayerDropdown";

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
  const { rowData, setRowData, hiddenLayers } = useAppContext();
  const { childrenMap, nameById, layerOptions: availableLayerOptions } = useMatrixLogic();

  const [id, setId] = useState(
    targetId || (rowData && rowData.length > 0 ? rowData[0].id.toString() : "")
  );
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  const [donutTree, setDonutTree] = useState([]);
  const [clickedSegmentId, setClickedSegmentId] = useState(null);
  const [isInternalClick, setIsInternalClick] = useState(false);
  const [showLayerRings, setShowLayerRings] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null);

  // Use menu handlers (no removeChildFromLayer or flipped needed here)
  const menuHandlers = useMenuHandlers({
    rowData,
    setRowData,
    removeChildFromLayer: async () => {},
    flipped: false,
    childrenMap,
  });

  // Menu options for donut segments
  const donutMenuOptions = [
    { label: "Rename", onClick: menuHandlers.handleRename },
    { label: "Export", submenu: menuHandlers.exportMenu }, // <-- use submenu
  ];

  useEffect(() => {
    const channel = new BroadcastChannel('selectNodeChannel');
    channel.onmessage = (event) => {
      const { nodeId } = event.data;
      if (nodeId && !isInternalClick) {
        setId(nodeId.toString());
        setFocusedNodeId(null);
        setClickedSegmentId(null);
      }
      setIsInternalClick(false);
    };
    return () => channel.close();
  }, [isInternalClick]);

  // Build the donut tree whenever id changes
  useEffect(() => {
    if (showLayerRings) {
      setFocusedNodeId(null);
      return;
    }

    // Determine which node to use as the root
    const rootNodeId = focusedNodeId || id;

    if (!rootNodeId || !childrenMap || !nameById) {
      setDonutTree([]);
      return;
    }

    // Build ancestry tree starting from the determined root node
    const tree = buildAncestryTree(rootNodeId, nameById, childrenMap);
    setDonutTree(tree);
  }, [id, focusedNodeId, nameById, childrenMap, showLayerRings]);

  // 1. Gather all unique tags
  const allTags = useMemo(() => {
    if (!rowData) return [];
    const tags = new Set();
    rowData.forEach(row => {
      if (!row.Tags) return;
      row.Tags.split(",")
        .map(tag => tag.trim())
        .filter(Boolean)
        .forEach(tag => tags.add(tag));
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
    if (showLayerRings) {
      return "Layer View";
    }
    if (donutTree.length === 0) return "";
    const rootItem = donutTree.find(item => item.level === 0);
    return rootItem ? rootItem.label : "";
  }, [donutTree, showLayerRings]);

  const visibleLayers = useMemo(() => {
    return (availableLayerOptions || []).filter(layer => !hiddenLayers.has(layer));
  }, [availableLayerOptions, hiddenLayers]);

  const layersWithItems = useMemo(() => {
    if (!showLayerRings) return [];
    const sanitizeTags = tags =>
      (tags || "")
        .split(",")
        .map(t => t.trim())
        .filter(Boolean);

    return visibleLayers
      .map(layer => {
        const items = rowData
          .filter(row => {
            const tags = sanitizeTags(row.Tags);
            if (tags.length === 0) return false;
            const inLayer = tags.includes(layer);
            const notHidden = !tags.some(t => hiddenLayers.has(t));
            return inLayer && notHidden;
          })
          .map(row => ({
            id: row.id?.toString(),
            name: row.Name || row.id?.toString(),
            layer,
            original: row,
            level: layer
          }));
        return { layer, items };
      })
      .filter(entry => entry.items.length > 0);
  }, [showLayerRings, visibleLayers, rowData, hiddenLayers]);

  // Track viewport size to re-render responsive chart on resize
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const onResize = () => setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Function to handle segment clicks
  const handleSegmentClick = useCallback((event, d) => {
    event.stopPropagation();

    // Extract the level and id from the clicked segment
    const clickedId = d.data.id;
    const clickedLevel = d.data.level;

    setIsInternalClick(true);

    // Broadcast the selected segment's id
    const channel = new BroadcastChannel('selectNodeChannel');
    channel.postMessage({ nodeId: clickedId });

    setClickedSegmentId(clickedId);

    if (showLayerRings || typeof clickedLevel !== "number") {
      setFocusedNodeId(null);
      return;
    }

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
  }, [donutTree, nameById, childrenMap, showLayerRings]);

  // Add right-click handler for donut segments
  const handleSegmentContextMenu = useCallback((event, d) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      cid: d.data.id,
    });
  }, []);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const svgEl = svgRef.current;
    const width = svgEl ? svgEl.clientWidth : 700;
    const height = svgEl ? svgEl.clientHeight : width; // keep square if auto
    const radius = Math.min(width, height) / 2 - 20;
    const g = svg.append("g").attr("transform", `translate(${width / 2}, ${height / 2})`);

    if (showLayerRings) {
      if (layersWithItems.length === 0) {
        return;
      }

      const ringCount = layersWithItems.length;
      const ringWidth = ringCount === 0 ? radius : radius / ringCount;
      const layerPie = d3.pie().sort(null).value(() => 1);

      layersWithItems.forEach((layerEntry, layerIndex) => {
        const innerRadius = ringWidth * layerIndex;
        const outerRadius = ringWidth * (layerIndex + 1);
        const arcGenerator = d3.arc()
          .startAngle(d => d.startAngle)
          .endAngle(d => d.endAngle)
          .innerRadius(innerRadius)
          .outerRadius(outerRadius);

        const augmentedItems = layerEntry.items.map(item => ({
          ...item,
          level: layerIndex,
          layer: layerEntry.layer
        }));

        const arcs = layerPie(augmentedItems);

        const ringGroup = g.append("g").attr("data-layer", layerEntry.layer);

        // Draw the ring segments
        ringGroup.selectAll("path")
          .data(arcs)
          .enter()
          .append("path")
          .attr("d", arcGenerator)
          .attr("fill", d => {
            if (d.data.id === clickedSegmentId) {
              return "#ff4444";
            }
            return colorByTag(layerEntry.layer) || "#ccc";
          })
          .attr("stroke", d => d.data.id === clickedSegmentId ? "#cc0000" : "#fff")
          .attr("stroke-width", d => d.data.id === clickedSegmentId ? 3 : 1)
          .style("cursor", "pointer")
          .on("click", handleSegmentClick)
          .on("contextmenu", handleSegmentContextMenu)
          .on("mousemove", function (event, d) {
            const tooltip = tooltipRef.current;
            if (tooltip) {
              tooltip.style.display = "block";
              tooltip.style.left = (event.clientX + 10) + "px";
              tooltip.style.top = (event.clientY + 10) + "px";
              tooltip.textContent = `${d.data.name} (${layerEntry.layer})`;
            }
          })
          .on("mouseleave", function () {
            const tooltip = tooltipRef.current;
            if (tooltip) {
              tooltip.style.display = "none";
            }
          });

        // Add container labels on segments (truncated to fit)
        const fontSize = 9;
        ringGroup.selectAll("text")
          .data(arcs)
          .enter()
          .append("text")
          .attr("transform", d => {
            const [cx, cy] = arcGenerator.centroid(d);
            return `translate(${cx},${cy})`;
          })
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle")
          .attr("fill", "#374151")
          .style("font-size", `${fontSize}px`)
          .text(d => {
            const arcLen = Math.abs(d.endAngle - d.startAngle);
            const rMid = (innerRadius + outerRadius) / 2;
            const estMaxChars = Math.floor((arcLen * rMid) / (fontSize * 0.7));
            const label = d.data.name || "";
            if (arcLen < 0.25 || estMaxChars < 3) {
              return label.length >= 5 ? label.substring(0, 5) : label;
            }
            if (label.length > estMaxChars) {
              return label.substring(0, Math.max(1, estMaxChars - 1)) + "…";
            }
            return label;
          });

        // Layer label
        const labelRadius = innerRadius + (ringWidth / 2);
        // Layer label in a distinct color
        g.append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "0.35em")
          .attr("fill", "#1d4ed8")
          .attr("font-size", "10px")
          .attr("transform", `rotate(0) translate(0, ${-labelRadius})`)
          .text(layerEntry.layer);
      });

      return;
    }

    if (donutTree.length === 0) return;
    // Default ancestry view below

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
        if (d.data.id === clickedSegmentId) {
          return "#ff4444";
        }
        const row = rowData.find(r => r.id?.toString() === d.data.id?.toString());
        return row && row.Tags ? colorByTag(row.Tags) : "#ccc";
      })
      .attr("stroke", d => d.data.id === clickedSegmentId ? "#cc0000" : "#fff")
      .attr("stroke-width", d => d.data.id === clickedSegmentId ? 3 : 1)
      .style("cursor", "pointer")
      .on("click", handleSegmentClick)
      .on("contextmenu", handleSegmentContextMenu) // <-- Add this line
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
  }, [
    donutTree,
    rowData,
    colorByTag,
    handleSegmentClick,
    handleSegmentContextMenu,
    clickedSegmentId,
    showLayerRings,
    layersWithItems,
    viewportSize
  ]); // Added clickedSegmentId to dependencies

  // Reset clicked segment when changing root
  useEffect(() => {
    setClickedSegmentId(null);
  }, [id, showLayerRings]);

  const [collapsed, setCollapsed] = useState(false);

  if (!id) {
    return (
      <div style={{ width: '100%', height: collapsed ? 48 : 800, transition: 'height 0.3s', overflow: 'hidden' }} className="bg-white rounded shadow p-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold">Donut View (D3)</h2>
          <button
            className="px-2 py-1 border rounded text-sm"
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? "Expand donut view" : "Collapse donut view"}
          >
            {collapsed ? "▼" : "▲"}
          </button>
        </div>
        {!collapsed && <p>No node selected</p>}
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded shadow p-4"
      style={{
        width: '100%',
        height: collapsed ? 48 : 'auto',
        transition: 'height 0.3s',
        overflow: 'hidden',
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch"
      }}
    >
      <div className="flex justify-between items-center mb-2 w-full gap-4">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">Donut View (D3)</h2>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={showLayerRings}
              onChange={e => setShowLayerRings(e.target.checked)}
            />
            <span>Layer Rings</span>
          </label>
          {showLayerRings && (
            <LayerDropdown
              buttonText="Layers"
              title="Select layers to display"
              dropdownTitle="Toggle Layers"
            />
          )}
        </div>
        <button
          className="px-2 py-1 border rounded text-sm"
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? "Expand donut view" : "Collapse donut view"}
        >
          {collapsed ? "▼" : "▲"}
        </button>
      </div>
      {!collapsed && <>
        <div style={{ fontWeight: "bold", fontSize: "1.2rem", marginBottom: "10px" }}>
          {rootLabel}
          {!showLayerRings && focusedNodeId && (
            <div style={{ fontSize: "0.9rem", color: "#666", fontWeight: "normal" }}>
              Focused on: {nameById[focusedNodeId]}
            </div>
          )}
        </div>
        {!showLayerRings && focusedNodeId && (
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
        {showLayerRings && layersWithItems.length === 0 && (
          <div style={{ marginBottom: "10px", color: "#666" }}>
            No visible layers with items to display.
          </div>
        )}
        <svg
          ref={svgRef}
          width="100%"
          height="auto"
          style={{
            border: "1px solid #ddd",
            display: "block",
            aspectRatio: '1 / 1'
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
        {/* Context menu for donut segments */}
        <ContextMenu
          contextMenu={contextMenu}
          setContextMenu={setContextMenu}
          menuOptions={donutMenuOptions}
        />
      </>}
    </div>
  );
};

export default AppDonut;

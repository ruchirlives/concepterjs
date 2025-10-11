import React, { useEffect, useRef, useMemo, useState, useCallback } from "react";
import * as d3 from "d3";
// Use consolidated donut entry point
import { createDonut } from "./vis/donut";
import { useAppContext } from "./AppContext";
import { useMatrixLogic } from "./hooks/useMatrixLogic";
import { ContextMenu, useMenuHandlers } from "./hooks/useContextMenu"; // <-- Add this import
import LayerDropdown from "./components/LayerDropdown";
import { setPosition } from "./api";
import { requestRefreshChannel } from "hooks/effectsShared";

// Match AppKanban behavior: prompt for label and save link
async function linkItems(sourceItem, targetItem, relationships) {
  const key = `${sourceItem.cid}--${targetItem.id}`;
  const currentLabel = relationships[key] || null;
  const newLabel = prompt("Enter new label:", currentLabel);
  if (newLabel !== null) {
    await setPosition(sourceItem.cid, targetItem.id, newLabel);
    requestRefreshChannel();
  }
}

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

const AppD3Vis = ({ targetId }) => {
  const svgRef = useRef();
  const tooltipRef = useRef();
  const { rowData, setRowData, hiddenLayers } = useAppContext();
  const { childrenMap, nameById, layerOptions: availableLayerOptions, relationships } = useMatrixLogic();
  // Simple visualization selector state
  const [visType, setVisType] = useState("donut");

  const [id, setId] = useState(
    targetId || (rowData && rowData.length > 0 ? rowData[0].id.toString() : "")
  );
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  const [donutTree, setDonutTree] = useState([]);
  const [clickedSegmentId, setClickedSegmentId] = useState(null);
  const [isInternalClick, setIsInternalClick] = useState(false);
  const [useLayers, setUseLayers] = useState(true);
  // Drag/link state (mirrors AppKanban)
  const [dragItem, setDragItem] = useState(null); // { cid, ctrl }
  const dragItemRef = useRef(dragItem);
  const [ctrlDragging, setCtrlDragging] = useState(false);
  const [dragLine, setDragLine] = useState(null); // { from: {x,y}, to: {x,y} }
  const [manualMouseTracking, setManualMouseTracking] = useState(false);
  const rafIdRef = useRef(null);

  useEffect(() => { dragItemRef.current = dragItem; }, [dragItem]);

  // Compute related IDs (clicked + direct children only)
  const relatedIds = useMemo(() => {
    if (!clickedSegmentId) return new Set();
    const rootId = clickedSegmentId?.toString();
    const rel = new Set([rootId]);
    const children = childrenMap?.[rootId] || [];
    children.forEach(c => rel.add(c.toString()));
    return rel;
  }, [clickedSegmentId, childrenMap]);

  // Compute ancestor IDs (direct parent(s) only) for separate highlighting
  const ancestorIds = useMemo(() => {
    if (!clickedSegmentId || !childrenMap) return new Set();
    const rootId = clickedSegmentId?.toString();
    const directParents = new Set();
    Object.entries(childrenMap).forEach(([parent, kids]) => {
      if (kids.includes(rootId)) {
        directParents.add(parent.toString());
      }
    });
    return directParents;
  }, [clickedSegmentId, childrenMap]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null);

  // Use menu handlers (no removeChildFromLayer or flipped needed here)
  const menuHandlers = useMenuHandlers({
    rowData,
    setRowData,
    removeChildFromLayer: async () => { },
    flipped: false,
    childrenMap,
  });

  // Menu options for donut segments
  const visMenuOptions = [
    { label: "Rename", onClick: menuHandlers.handleRename },
    { label: "Export", submenu: menuHandlers.exportMenu }, // <-- use submenu
  ];

  // Helper to strip common short words from labels
  const stripCommonWords = useCallback((text) => {
    if (!text) return "";
    const stop = new Set(["the", "to", "and", "of", "as", "in", "on", "for", "a", "an", "is", "it", "by", "at", "from", "or", "but", "with", "that"]);
    return String(text)
      .split(/\s+/)
      .filter(w => !stop.has(w.toLowerCase()))
      .join(" ")
      .trim();
  }, []);

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
    if (useLayers) {
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
  }, [id, focusedNodeId, nameById, childrenMap, useLayers]);

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
  const visibleLayers = useMemo(() => {
    return (availableLayerOptions || []).filter(layer => !hiddenLayers.has(layer));
  }, [availableLayerOptions, hiddenLayers]);

  const layersWithItems = useMemo(() => {
    if (!useLayers) return [];
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
            const layerVisible = !hiddenLayers.has(layer);
            // Show items that belong to this ticked layer even if they also
            // have other tags that are currently hidden.
            return inLayer && layerVisible;
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
  }, [useLayers, visibleLayers, rowData, hiddenLayers]);

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

    if (useLayers || typeof clickedLevel !== "number") {
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
  }, [donutTree, nameById, childrenMap, useLayers]);

  // Add right-click handler for donut segments
  const handleSegmentContextMenu = useCallback((event, d) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      cid: d.data.id,
    });
  }, []);

  // Ctrl+mousedown to start linking; draw a line following the mouse until mouseup.
  const handleSegmentMouseDown = useCallback((event, d) => {
    if (!event.ctrlKey) return;
    event.stopPropagation();
    event.preventDefault(); // prevent text selection during ctrl-drag
    setCtrlDragging(true);
    setManualMouseTracking(true);
    const cid = d?.data?.id?.toString();
    setDragItem({ cid, ctrl: true });

    // Disable user selection globally while dragging
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    const rect = event.target.getBoundingClientRect();
    const startPos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    setDragLine({ from: startPos, to: startPos });

    const handleMouseMove = (e) => {
      if (rafIdRef.current != null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        setDragLine(line => (line ? { ...line, to: { x: e.clientX, y: e.clientY } } : line));
        rafIdRef.current = null;
      });
    };
    const handleMouseUp = (e) => {
      setCtrlDragging(false);
      setDragLine(null);
      setManualMouseTracking(false);

      const elem = document.elementFromPoint(e.clientX, e.clientY);
      if (elem && elem.dataset && elem.dataset.donutItemId) {
        const targetId = elem.dataset.donutItemId;
        const targetItem = rowData.find(r => r.id.toString() === targetId);
        if (targetItem && dragItemRef.current) {
          linkItems(dragItemRef.current, targetItem, relationships);
        }
      }
      setDragItem(null);

      // Restore selection behavior
      document.body.style.userSelect = prevUserSelect;

      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [relationships, rowData]);

  // Mirror AppKanban: if ctrlDragging and not manually tracking, update line on global mousemove
  useEffect(() => {
    if (!ctrlDragging || !dragLine || manualMouseTracking) return;
    const handleMouseMove = (e) => {
      if (rafIdRef.current != null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        setDragLine(line => (line ? { ...line, to: { x: e.clientX, y: e.clientY } } : line));
        rafIdRef.current = null;
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [ctrlDragging, dragLine, manualMouseTracking]);

  // Mirror AppKanban: clear drag line on dragend
  useEffect(() => {
    if (!ctrlDragging) {
      setDragLine(null);
      return;
    }
    const handleDragEnd = () => {
      setCtrlDragging(false);
      setDragLine(null);
      setDragItem(null);
      // Ensure text selection is re-enabled if drag ends unexpectedly
      document.body.style.userSelect = '';
    };
    window.addEventListener("dragend", handleDragEnd);
    return () => window.removeEventListener("dragend", handleDragEnd);
  }, [ctrlDragging]);

  const controllerRegistry = useMemo(() => ({
    donut: createDonut,
  }), []);

  const activeVisKey = useLayers ? "layers" : visType;

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const width = svgEl.clientWidth || 700;
    const height = svgEl.clientHeight || width; // keep square if auto

    svg
      .attr("viewBox", `${-width / 2} ${-height / 2} ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    if (activeVisKey === "layers") {
      if (layersWithItems.length === 0) {
        return;
      }

      const radius = Math.min(width, height) / 2 - 20;
      const g = svg.append("g");

      // Reserve an inner blank root circle by adding one extra ring slot
      const ringCount = layersWithItems.length + 1;
      const ringWidth = ringCount === 0 ? radius : radius / ringCount;
      // Draw a subtle boundary for the blank root circle
      g.append("circle")
        .attr("r", ringWidth)
        .attr("fill", "none")
        .attr("stroke", "#eee")
        .attr("stroke-width", 1);

      const layerPie = d3.pie().sort(null).value(() => 1);

      layersWithItems.forEach((layerEntry, layerIndex) => {
        // Shift all rings outward by one ringWidth to keep center blank
        const innerRadius = ringWidth * (layerIndex + 1);
        const outerRadius = ringWidth * (layerIndex + 2);
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
            const base = colorByTag(layerEntry.layer) || "#ccc";
            if (d.data.id?.toString() === clickedSegmentId?.toString()) return "#ff4444";
            return base;
          })
          .attr("stroke", d => {
            const id = d.data.id?.toString();
            if (id === clickedSegmentId?.toString()) return "#cc0000";
            if (relatedIds.has(id)) return "#f59e0b"; // amber for descendants
            if (ancestorIds.has(id)) return "#3b82f6"; // blue for ancestors
            return "#fff";
          })
          .attr("stroke-width", d => {
            const id = d.data.id?.toString();
            if (id === clickedSegmentId?.toString()) return 3;
            if (relatedIds.has(id)) return 2;
            if (ancestorIds.has(id)) return 2;
            return 1;
          })
          .style("opacity", d => {
            if (!clickedSegmentId) return 1;
            const id = d.data.id?.toString();
            return relatedIds.has(id) || ancestorIds.has(id) || id === clickedSegmentId?.toString() ? 1 : 0.35;
          })
          .style("cursor", "pointer")
          .on("click", handleSegmentClick)
          .on("contextmenu", handleSegmentContextMenu)
          .on("mousedown", handleSegmentMouseDown)
          .attr("data-donut-item-id", d => d.data.id)
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
        const fontSize = 10;
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
            const label = stripCommonWords(d.data.name || "");
            if (arcLen < 0.25 || estMaxChars < 3) {
              return label.length >= 5 ? label.substring(0, 5) : label;
            }
            if (label.length > estMaxChars) {
              return label.substring(0, Math.max(1, estMaxChars - 1)) + "ǟ�'�'��ǟ��ǽ�'����'��ǟ�?s�'��";
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

    const controllerFactory = controllerRegistry[activeVisKey];
    if (!controllerFactory) {
      return;
    }

    const controller = controllerFactory({
      svgEl,
      data: {
        donutTree,
        colorByTag,
        clickedSegmentId,
        relatedIds,
        ancestorIds,
      },
      options: {
        width,
        height,
        handlers: {
          handleSegmentClick,
          handleSegmentContextMenu,
          handleSegmentMouseDown,
          stripCommonWords,
        },
      },
    });

    controller.update({ donutTree, colorByTag, clickedSegmentId, relatedIds, ancestorIds });

    return () => controller.destroy?.();

  }, [
    activeVisKey,
    ancestorIds,
    clickedSegmentId,
    colorByTag,
    controllerRegistry,
    donutTree,
    handleSegmentClick,
    handleSegmentContextMenu,
    handleSegmentMouseDown,
    layersWithItems,
    relatedIds,
    stripCommonWords,
    viewportSize
  ]);

  // Reset clicked segment when changing root
  useEffect(() => {
    setClickedSegmentId(null);
  }, [id, useLayers]);

  if (!id) {
    return (
      <div
        className="bg-white rounded shadow p-4"
        style={{ width: "100%", height: "100vh", overflow: "hidden" }}
      >
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold">Donut View (D3)</h2>
        </div>
        <p>No node selected</p>
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded shadow p-4"
      style={{
        width: "100%",
        height: "100vh",
        transition: "height 0.3s",
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch"
      }}
    >
      {dragLine && (
        <svg
          style={{ position: "fixed", pointerEvents: "none", left: 0, top: 0, width: "100vw", height: "100vh", zIndex: 1000 }}
        >
          <line x1={dragLine.from.x} y1={dragLine.from.y} x2={dragLine.to.x} y2={dragLine.to.y} stroke="red" strokeWidth="2" />
        </svg>
      )}
      <div className="flex justify-between items-center mb-2 w-full gap-4">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">Donut View (D3)</h2>
          <select
            value={visType}
            onChange={(e) => setVisType(e.target.value)}
            className="px-2 py-1 border rounded text-sm"
            aria-label="Select visualization"
          >
            <option value="donut">Ancestry Donut</option>
            <option value="layers">Layer Rings</option>
          </select>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={useLayers}
              onChange={e => setUseLayers(e.target.checked)}
            />
            <span>Layer Rings</span>
          </label>
          {useLayers && (
            <LayerDropdown
              buttonText="Layers"
              title="Select layers to display"
              dropdownTitle="Toggle Layers"
            />
          )}
        </div>
      </div>
      {useLayers && layersWithItems.length === 0 && (
        <div style={{ marginBottom: "10px", color: "#666" }}>
          No visible layers with items to display.
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{
            display: "block"
          }}
          preserveAspectRatio="xMidYMid meet"
        />
      </div>
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
        menuOptions={visMenuOptions}
      />
    </div>
  );
};

export default AppD3Vis;

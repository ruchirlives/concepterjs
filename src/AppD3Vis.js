import React, { useEffect, useRef, useMemo, useState, useCallback } from "react";
import * as d3 from "d3";
// Use consolidated donut entry point
import { createDonut } from "./vis/donut";
import { createTree } from "./vis/tree";
import { createSankey } from "./vis/sankey";
import getVisOptions from "./vis/visOptions";
import { useAppContext } from "./AppContext";
import { useMatrixLogic } from "./hooks/useMatrixLogic";
import { ContextMenu, useMenuHandlers } from "./hooks/useContextMenu"; // <-- Add this import
import LayerDropdown from "./components/LayerDropdown";
import { setPosition } from "./api";
import { requestRefreshChannel } from "hooks/effectsShared";
import { buildAncestryTree } from "buildAncestryTree";
import { buildNodesLinks } from "buildNodesLinks";

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

const AppD3Vis = ({ targetId }) => {
  const svgRef = useRef();
  const tooltipRef = useRef();
  const controllerRef = useRef(null);
  const { rowData, setRowData, hiddenLayers } = useAppContext();
  const { childrenMap, nameById, layerOptions: availableLayerOptions, relationships } = useMatrixLogic();
  // Simple visualization selector state
  const [visType, setVisType] = useState("donut");

  const [id, setId] = useState(
    targetId || (rowData && rowData.length > 0 ? rowData[0].id.toString() : "")
  );
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  const [donutTree, setDonutTree] = useState([]);
  const [reverseAncestry, setReverseAncestry] = useState(false);
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
    if (reverseAncestry) return new Set();
    const rootId = clickedSegmentId?.toString();
    const directParents = new Set();
    Object.entries(childrenMap).forEach(([parent, kids]) => {
      if (kids.includes(rootId)) {
        directParents.add(parent.toString());
      }
    });
    return directParents;
  }, [clickedSegmentId, childrenMap, reverseAncestry]);

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
    const tree = reverseAncestry
      ? buildAncestryTree(rootNodeId, nameById, childrenMap, 6, 0, true)
      : buildAncestryTree(rootNodeId, nameById, childrenMap);
    setDonutTree(tree);
  }, [id, focusedNodeId, nameById, childrenMap, useLayers, reverseAncestry]);

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

  const activeVisKey = visType;
  // Track viewport size to re-render responsive chart on resize
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const onResize = () => setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Force a rebuild of the vis (recompute trees and re-init controller)
  const handleRebuild = useCallback(() => {
    setFocusedNodeId(null);
    setClickedSegmentId(null);
    setUseLayers(false);
    setReverseAncestry(false);
    setId(id); // trigger useEffect
  }, [id]);
  // Function to handle segment clicks
  const handleSegmentClick = useCallback((event, d) => {
    event.stopPropagation();
    // Normalize payload from donut (d.data.*) and tree (custom payload)
    const clickedId = d?.data?.id?.toString?.() ?? d?.data?.id ?? d?.id;
    const clickedLevel = d?.data?.level;

    if (!clickedId) return;

    setIsInternalClick(true);
    setClickedSegmentId(clickedId);

    // 1) Layers mode: do not rebuild
    if (useLayers) {
      setFocusedNodeId(null);
      return;
    }

    // 3) Donut mode: one-level expand only if we have a numeric level
    if (typeof clickedLevel !== 'number') {
      // Optional: fallback to re-root in donut if no level is provided
      setFocusedNodeId(null);
      setId(clickedId);
      return;
    }

    // Donut one-level expand logic (your existing code, with a tiny guard)
    // Step 1: Clear all items with level > clickedLevel
    const filteredTree = donutTree.filter(item => Number.isFinite(item.level) && item.level <= clickedLevel);

    // Step 2: Build a subtree (depth 1) from clickedId (respect reverseAncestry)
    const subtree = buildAncestryTree(clickedId, nameById, childrenMap, 1, 0, reverseAncestry);

    // Step 3: Shift subtree levels to be children of the clicked segment
    const adjustedSubtree = (subtree || [])
      .filter(item => Number.isFinite(item.level) && item.level > 0) // remove root (level 0)
      .map(item => ({
        ...item,
        level: item.level + clickedLevel, // shift
        parentId: item.level === 1 ? clickedId : item.parentId
      }));

    // Step 4/5: Merge + de-dupe (keep subtree preference)
    const mergedTree = [...filteredTree, ...adjustedSubtree];
    const uniqueTree = [];
    const seen = new Set();
    [...mergedTree].reverse().forEach(item => {
      const key = `${ item.id }-${ item.level }`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueTree.unshift(item);
      }
    });

    setDonutTree(uniqueTree);
  }, [
    useLayers,
    donutTree,
    nameById,
    childrenMap,
    reverseAncestry,
    setId,
    setFocusedNodeId,
  ]);

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

  const controllerRegistry = useMemo(() => ({ donut: createDonut, layers: createDonut, tree: createTree, sankey: createSankey }), []);
  const [sankeyLinkColor, setSankeyLinkColor] = useState('source-target');
  const [sankeyNodeAlign, setSankeyNodeAlign] = useState('sankeyLeft');

  // Remove in-component builder (moved to module scope)

  // Visualization configuration map: controller + data builder + defaults
  const visOptions = useMemo(() => getVisOptions({
    state: {
      donutTree,
      layersWithItems,
      clickedSegmentId,
      relatedIds,
      ancestorIds,
      useLayers,
      reverseAncestry,
      rowData,
      relationships,
      sankeyLinkColor,
      sankeyNodeAlign,
    },
    builders: { buildNodesLinks },
    controllers: { createDonut, createTree, createSankey },
  }), [
    donutTree,
    layersWithItems,
    clickedSegmentId,
    relatedIds,
    ancestorIds,
    useLayers,
    reverseAncestry,
    rowData,
    relationships,
    sankeyLinkColor,
    sankeyNodeAlign,
  ]);

  

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const cfg = visOptions[activeVisKey];
    if (!cfg) return;

    const baseOptions = {
      mode: activeVisKey,
      useLayers,
      reverseAncestry,
      colorByTag,
      width: svgRef.current?.clientWidth || undefined,
      height: svgRef.current?.clientHeight || undefined,
      tooltipEl: tooltipRef.current,
      handlers: {
        handleSegmentClick,
        handleSegmentContextMenu,
        handleSegmentMouseDown,
        stripCommonWords,
      },
    };

    const dataPayload = cfg.buildData ? cfg.buildData() : {};
    if (activeVisKey === 'sankey') {
      if (!dataPayload || !Array.isArray(dataPayload.nodes) || dataPayload.nodes.length === 0) return;
    }

    // Clear SVG before creating the new controller
    d3.select(svgEl).selectAll('*').remove();

    const controller = cfg.controller({
      svgEl,
      data: dataPayload,
      options: { ...baseOptions, ...(cfg.options || {}) },
    });

    // Keep a ref and ensure cleanup clears the SVG
    controllerRef.current = controller;
    return () => {
      try { controllerRef.current?.destroy?.(); } catch {}
      d3.select(svgEl).selectAll('*').remove();
      controllerRef.current = null;
    };

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
    useLayers,
    stripCommonWords,
    viewportSize,
    reverseAncestry,
    visOptions,
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
          <h2 className="font-semibold">Vis View (D3)</h2>
        </div>
        <p>No node selected</p>
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded shadow p-4 "
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
          <h2 className="font-semibold">Vis View (D3)</h2>
          <select
            value={visType}
            onChange={(e) => setVisType(e.target.value)}
            className="px-2 py-1 border rounded text-sm"
            aria-label="Select visualization"
          >
            <option value="donut">Ancestry Donut</option>
            <option value="tree">Cluster Tree</option>
            <option value="sankey">Sankey</option>
          </select>
          {visType === 'sankey' && (
            <div className="flex items-center gap-2 text-sm">
              <label className="flex items-center gap-1">
                <span>Link</span>
                <select
                  value={sankeyLinkColor}
                  onChange={(e) => setSankeyLinkColor(e.target.value)}
                  className="px-1 py-0.5 border rounded text-sm"
                >
                  <option value="source-target">Source→Target</option>
                  <option value="source">Source</option>
                  <option value="target">Target</option>
                  <option value="#999">#999</option>
                </select>
              </label>
              <label className="flex items-center gap-1">
                <span>Align</span>
                <select
                  value={sankeyNodeAlign}
                  onChange={(e) => setSankeyNodeAlign(e.target.value)}
                  className="px-1 py-0.5 border rounded text-sm"
                >
                  <option value="sankeyLeft">Left</option>
                  <option value="sankeyRight">Right</option>
                  <option value="sankeyCenter">Center</option>
                  <option value="sankeyJustify">Justify</option>
                </select>
              </label>
            </div>
          )}
          <button
            type="button"
            onClick={handleRebuild}
            className="px-2 py-1 border rounded text-sm"
            aria-label="Rebuild visualization"
            title="Rebuild visualization"
          >
            Rebuild
          </button>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={useLayers}
              onChange={e => setUseLayers(e.target.checked)}
            />
            <span>Use Layers</span>
          </label>
          {!useLayers && (
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={reverseAncestry}
                onChange={e => setReverseAncestry(e.target.checked)}
              />
              <span>Show Descendants</span>
            </label>
          )}
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
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{
            display: "block"
          }}
          preserveAspectRatio="xMidYMid meet"
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
        menuOptions={visMenuOptions}
      />
    </div>
  );
};

export default AppD3Vis;







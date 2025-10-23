import React, { useEffect, useMemo, useState, useCallback, useLayoutEffect, useRef } from "react";
import {
  ReactFlow, ReactFlowProvider, MiniMap, Controls, Background,
  addEdge, ControlButton
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  useCreateNodesAndEdges, useOnConnect, useOnEdgeChange,
  useOnConnectEnd, useTagsChange, useSelectNode, useOnEdgeDoubleClick
} from './hooks/flowEffects';
import FlowNode from './hooks/flowNode';
import GroupNode from './hooks/flowGroupNodes';
import GhostNode from './nodes/GhostNode';
import ContextMenu from "./components/ContextMenu";
import { useContextMenu, menuItems } from "./hooks/flowContextMenu";
import EdgeMenu, { useEdgeMenu } from "./hooks/flowEdgeMenu";
import { FlowMenuProvider } from './components/FlowMenuContext';
import { GearIcon } from '@radix-ui/react-icons'
import CustomEdge from './hooks/customEdge';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { saveNodes, addChildren } from './api';
import FlowHeader from './components/FlowHeader';
import { useFlowLogic } from './hooks/useFlowLogic';
import ModalAddRow from './components/ModalAddRow';
import { requestRefreshChannel } from './hooks/effectsShared';

const PRECISION_FACTOR = 1000;

const clampToPrecision = (value) => {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * PRECISION_FACTOR) / PRECISION_FACTOR;
};

const buildAxisSegments = (items = [], totalSize = 0, axis = 'row') => {
  if (!Array.isArray(items) || items.length === 0 || !Number.isFinite(totalSize) || totalSize <= 0) return [];
  const segmentSize = totalSize / items.length;

  return items.map((item, index) => {
    const { label = '', nodeId, originalId } = item || {};
    const start = clampToPrecision(segmentSize * index);
    const end = index === items.length - 1
      ? clampToPrecision(totalSize)
      : clampToPrecision(start + segmentSize);
    const common = {
      id: `${axis}-${index}-${originalId || nodeId || 'unlabeled'}`,
      key: originalId || nodeId || `unknown-${index}`,
      label: label || '',
      nodeId: nodeId || null,
      originalId: originalId || null,
      index,
      isActive: index % 2 === 0,
    };

    if (axis === 'row') {
      return {
        ...common,
        top: start,
        bottom: end,
        height: clampToPrecision(end - start),
      };
    }

    return {
      ...common,
      left: start,
      right: end,
      width: clampToPrecision(end - start),
    };
  });
};

const NUMERIC_PROPS = ['top', 'bottom', 'height', 'left', 'right', 'width'];
const IDENTITY_PROPS = ['key', 'label', 'nodeId', 'originalId'];

const segmentsEqual = (a = [], b = []) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const segA = a[i];
    const segB = b[i];
    if (!segA || !segB) return false;
    if (segA.index !== segB.index) return false;
    for (const key of IDENTITY_PROPS) {
      if (segA[key] !== segB[key]) return false;
    }
    if (Boolean(segA.isActive) !== Boolean(segB.isActive)) return false;
    for (const prop of NUMERIC_PROPS) {
      const valA = segA[prop];
      const valB = segB[prop];
      if (valA == null && valB == null) continue;
      if (valA == null || valB == null) return false;
      if (Math.abs(valA - valB) > 0.001) return false;
    }
  }

  return true;
};

const boundsEqual = (a = {}, b = {}) => {
  const numericKeys = ['width', 'height', 'top', 'left', 'clientTop', 'clientLeft'];
  for (const key of numericKeys) {
    const valA = a[key] ?? 0;
    const valB = b[key] ?? 0;
    if (Math.abs(valA - valB) > 0.001) return false;
  }
  return true;
};

const gridsEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  return segmentsEqual(a.rows, b.rows)
    && segmentsEqual(a.columns, b.columns)
    && boundsEqual(a.bounds, b.bounds);
};

const buildGridLookup = (rows = [], columns = []) => {
  const build = (segments = []) => {
    const byOriginalId = {};
    const byNodeId = {};
    segments.forEach(segment => {
      if (!segment) return;
      if (segment.originalId) byOriginalId[segment.originalId] = segment;
      if (segment.nodeId) byNodeId[segment.nodeId] = segment;
    });
    return { byOriginalId, byNodeId };
  };

  const rowLookup = build(rows);
  const columnLookup = build(columns);

  return {
    rowsByOriginalId: rowLookup.byOriginalId,
    rowsByNodeId: rowLookup.byNodeId,
    columnsByOriginalId: columnLookup.byOriginalId,
    columnsByNodeId: columnLookup.byNodeId,
  };
};

const App = ({ keepLayout, setKeepLayout }) => {
  const flowWrapperRef = React.useRef(null);

  const {
    collapsed, setCollapsed,
    layoutPositions, setLayoutPositions,
    flowFilteredRowData,
    comparatorState,
    handleStateChange,
    centerNode,
    handleTransform,
    stateScores,
    handleCalculateStateScores,
    getHighestScoringContainer,
    clearStateScores,
    rowData, setRowData,
    nodes, setNodes,
    edges, setEdges,
    onNodesChange,
    screenToFlowPosition,
    selectedContentLayer, setSelectedContentLayer, layerOptions,
    rowSelectedLayer, setRowSelectedLayer,
    columnSelectedLayer, setColumnSelectedLayer,
    groupByLayers, setGroupByLayers,
    showGroupNodes, setShowGroupNodes,
    flowGridDimensions,
    setFlowGridDimensions,
    layerOrdering,
  } = useFlowLogic();


  const [showGhostConnections, setShowGhostConnections] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [gridRows, setGridRows] = useState([]);
  const [gridColumns, setGridColumns] = useState([]);
  const [viewportTransform, setViewportTransform] = useState({ x: 0, y: 0, zoom: 1 });
  const viewportInteractionRef = useRef(false);
  const [cellMenuContext, setCellMenuContext] = useState(null);
  const cellMenuRef = useRef(null);
  const [pendingCellContext, setPendingCellContext] = useState(null);
  const [isAddRowModalOpen, setIsAddRowModalOpen] = useState(false);
  const cellMenuRowLabel = cellMenuContext?.rowSegment?.label || 'Row';
  const cellMenuColumnLabel = cellMenuContext?.columnSegment?.label || 'Column';

  const showRowGrid = Boolean(rowSelectedLayer);
  const showColumnGrid = Boolean(columnSelectedLayer);

  const normalizeTags = useCallback((raw = '') => raw
    .split(',')
    .map(tag => tag.trim().toLowerCase())
    .filter(Boolean), []);

  const collectLayerNodes = useCallback((layerName) => {
    if (!layerName) return [];

    const normalizedLayerKey = layerName.trim();
    const target = normalizedLayerKey.toLowerCase();
    if (!target) return [];

    const sourceRows = Array.isArray(flowFilteredRowData) && flowFilteredRowData.length > 0
      ? flowFilteredRowData
      : (rowData || []);

    let orderingList = [];
    if (layerOrdering && typeof layerOrdering === 'object') {
      if (Array.isArray(layerOrdering?.[normalizedLayerKey])) {
        orderingList = layerOrdering[normalizedLayerKey];
      } else {
        const fallbackKey = Object.keys(layerOrdering).find(
          (key) => key?.toLowerCase() === target
        );
        if (fallbackKey && Array.isArray(layerOrdering[fallbackKey])) {
          orderingList = layerOrdering[fallbackKey];
        }
      }
    }

    const orderIndex = new Map(
      Array.isArray(orderingList)
        ? orderingList.map((id, idx) => [id != null ? id.toString() : '', idx])
        : []
    );

    const seen = new Map();
    sourceRows.forEach((item) => {
      if (!item) return;
      const originalId = item.id != null ? item.id.toString() : null;
      if (!originalId) return;
      const tags = normalizeTags(item.Tags || '');
      if (!tags.includes(target)) return;

      if (seen.has(originalId)) return;
      const label = item.Name || originalId;
      seen.set(originalId, {
        nodeId: originalId,
        originalId,
        label,
      });
    });

    const sorted = Array.from(seen.values()).sort((a, b) => {
      const idA = a.originalId != null ? a.originalId.toString() : a.nodeId;
      const idB = b.originalId != null ? b.originalId.toString() : b.nodeId;
      const idxA = orderIndex.has(idA) ? orderIndex.get(idA) : Number.POSITIVE_INFINITY;
      const idxB = orderIndex.has(idB) ? orderIndex.get(idB) : Number.POSITIVE_INFINITY;
      if (idxA !== idxB) return idxA - idxB;

      const labelA = (a.label || '').toLowerCase();
      const labelB = (b.label || '').toLowerCase();
      if (labelA < labelB) return -1;
      if (labelA > labelB) return 1;
      return 0;
    });

    return sorted;
  }, [flowFilteredRowData, layerOrdering, normalizeTags, rowData]);

  useEffect(() => {
    if (!cellMenuContext) return undefined;

    const handleMouseDown = (event) => {
      const menuEl = cellMenuRef.current;
      if (menuEl && menuEl.contains(event.target)) return;
      setCellMenuContext(null);
    };

    const handleWheel = (event) => {
      const menuEl = cellMenuRef.current;
      if (menuEl && menuEl.contains(event.target)) return;
      setCellMenuContext(null);
    };

    const handleBlur = () => setCellMenuContext(null);

    window.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('wheel', handleWheel, true);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('wheel', handleWheel, true);
      window.removeEventListener('blur', handleBlur);
    };
  }, [cellMenuContext]);

  const rowLayerNodes = useMemo(() => collectLayerNodes(rowSelectedLayer), [collectLayerNodes, rowSelectedLayer]);
  const columnLayerNodes = useMemo(() => collectLayerNodes(columnSelectedLayer), [collectLayerNodes, columnSelectedLayer]);

  const updateViewportTransform = useCallback((nextViewport) => {
    if (!nextViewport) return;
    setViewportTransform(prev => {
      const next = {
        x: Number.isFinite(nextViewport.x) ? nextViewport.x : prev.x,
        y: Number.isFinite(nextViewport.y) ? nextViewport.y : prev.y,
        zoom: Number.isFinite(nextViewport.zoom) ? nextViewport.zoom : prev.zoom,
      };
      if (
        Math.abs(next.x - prev.x) < 0.5 &&
        Math.abs(next.y - prev.y) < 0.5 &&
        Math.abs(next.zoom - prev.zoom) < 0.001
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const updateGridDimensions = useCallback(() => {
    const wrapperEl = flowWrapperRef.current;
    if (!wrapperEl) {
      const emptyGrid = {
        rows: [],
        columns: [],
        bounds: { width: 0, height: 0, top: 0, left: 0, clientTop: 0, clientLeft: 0 },
        lookup: buildGridLookup([], []),
      };
      setGridRows((prev) => (prev.length === 0 ? prev : []));
      setGridColumns((prev) => (prev.length === 0 ? prev : []));
      setFlowGridDimensions((prev) => (gridsEqual(prev, emptyGrid) ? prev : emptyGrid));
      return;
    }

    const rect = wrapperEl.getBoundingClientRect();

    const rows = showRowGrid
      ? buildAxisSegments(rowLayerNodes, rect.height, 'row')
      : [];
    const columns = showColumnGrid
      ? buildAxisSegments(columnLayerNodes, rect.width, 'column')
      : [];

    setGridRows((prev) => (segmentsEqual(prev, rows) ? prev : rows));
    setGridColumns((prev) => (segmentsEqual(prev, columns) ? prev : columns));

    const nextGrid = {
      rows,
      columns,
      bounds: {
        width: clampToPrecision(rect.width),
        height: clampToPrecision(rect.height),
        top: 0,
        left: 0,
        clientTop: clampToPrecision(rect.top),
        clientLeft: clampToPrecision(rect.left),
      },
      lookup: buildGridLookup(rows, columns),
    };

    setFlowGridDimensions((prev) => (gridsEqual(prev, nextGrid) ? prev : nextGrid));
  }, [
    columnLayerNodes,
    rowLayerNodes,
    setFlowGridDimensions,
    showColumnGrid,
    showRowGrid,
  ]);

  useLayoutEffect(() => {
    updateGridDimensions();
  }, [updateGridDimensions]);



  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      if (viewportInteractionRef.current) return;
      updateGridDimensions();
    });
    const el = flowWrapperRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [updateGridDimensions]);

  const overlayStyle = useMemo(() => ({
    zIndex: 2,
    transform: `translate(${viewportTransform.x}px, ${viewportTransform.y}px) scale(${viewportTransform.zoom})`,
    transformOrigin: '0 0',
  }), [viewportTransform]);

  const handleCellMenuAddRow = useCallback(() => {
    if (!cellMenuContext) return;
    setPendingCellContext({
      rowSegment: cellMenuContext.rowSegment,
      columnSegment: cellMenuContext.columnSegment,
    });
    setCellMenuContext(null);
    setIsAddRowModalOpen(true);
  }, [cellMenuContext]);

  const handleModalClose = useCallback(() => {
    setIsAddRowModalOpen(false);
    setPendingCellContext(null);
  }, []);

  const handleModalSelect = useCallback(async (newRows = []) => {
    if (!pendingCellContext) return;
    if (!Array.isArray(newRows) || newRows.length === 0) {
      setPendingCellContext(null);
      return;
    }

    const childIds = newRows
      .map((row) => (row?.id != null ? row.id.toString() : null))
      .filter(Boolean);
    if (childIds.length === 0) {
      setPendingCellContext(null);
      return;
    }

    const parents = new Set();
    const pushParent = (segment) => {
      if (!segment) return;
      const parentId = segment.originalId || segment.nodeId;
      if (!parentId) return;
      parents.add(parentId.toString());
    };
    pushParent(pendingCellContext.rowSegment);
    pushParent(pendingCellContext.columnSegment);

    if (parents.size === 0) {
      setPendingCellContext(null);
      return;
    }

    let successCount = 0;
    for (const parentId of parents) {
      try {
        const response = await addChildren(parentId, childIds);
        if (response && !response.error) {
          successCount += 1;
        } else {
          const message = response?.message || `Failed to link containers to parent ${parentId}`;
          toast.error(message);
        }
      } catch (error) {
        console.error("Failed to add children to parent", parentId, error);
        toast.error(`Failed to link containers to parent ${parentId}`);
      }
    }

    if (successCount > 0) {
      toast.success(`Linked ${childIds.length} container${childIds.length > 1 ? 's' : ''} to ${successCount} parent${successCount > 1 ? 's' : ''}.`);
      requestRefreshChannel();
    }

    setPendingCellContext(null);
  }, [pendingCellContext]);

  const handleFlowMove = useCallback((_, viewport) => {
    viewportInteractionRef.current = true;
    updateViewportTransform(viewport);
  }, [updateViewportTransform]);

  const handleFlowMoveEnd = useCallback((_, viewport) => {
    viewportInteractionRef.current = false;
    updateViewportTransform(viewport);
    requestAnimationFrame(() => {
      updateGridDimensions();
    });
  }, [updateGridDimensions, updateViewportTransform]);

  const handleFlowInit = useCallback((instance) => {
    if (instance?.getViewport) {
      updateViewportTransform(instance.getViewport());
    }
    updateGridDimensions();
  }, [updateGridDimensions, updateViewportTransform]);

  // Memoize edgeTypes so it's not recreated on every render
  const edgeTypes = useMemo(() => ({
    customEdge: (edgeProps) => (
      <CustomEdge {...edgeProps} setEdges={setEdges} />
    ),
  }), [setEdges]);

  // Snapshot positions when Keep Layout toggles on; avoid running on every drag frame
  useEffect(() => {
    if (!keepLayout) return;
    if (!nodes || nodes.length === 0) return;
    const takeSnapshot = () => {
      const storedPositions = {};
      nodes.forEach(node => {
        storedPositions[node.id] = {
          x: node.position.x,
          y: node.position.y,
          ...(node.style?.width && node.style?.height
            ? { width: node.style.width, height: node.style.height }
            : {}),
        };
      });
      setLayoutPositions(storedPositions);
    };
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(takeSnapshot, { timeout: 1000 });
      return () => window.cancelIdleCallback && window.cancelIdleCallback(id);
    }
    const t = setTimeout(takeSnapshot, 0);
    return () => clearTimeout(t);
  }, [keepLayout, setLayoutPositions, nodes]);

  // Update persisted layout for the specific node when a drag stops
  const onNodeDragStop = useCallback((evt, node) => {
    setDragging(false);
    if (!keepLayout || !node) return;
    setLayoutPositions(prev => ({
      ...(prev || {}),
      [node.id]: {
        x: node.position.x,
        y: node.position.y,
        ...(node.style?.width && node.style?.height
          ? { width: node.style.width, height: node.style.height }
          : {}),
      },
    }));
  }, [keepLayout, setLayoutPositions]);

  const onNodeDragStart = useCallback(() => {
    setDragging(true);
  }, []);

  // Removed activeGroup broadcasting

  // Flow effects hooks
  useCreateNodesAndEdges({
    nodes, setNodes, setEdges, rowData: flowFilteredRowData, keepLayout,
    setLayoutPositions, layoutPositions, setRowData,
    stateScores, getHighestScoringContainer,
    groupByLayers,
    showGhostConnections,
    showGroupNodes,
    rowSelectedLayer,
    columnSelectedLayer,
    flowGridDimensions,
    // Pass explicit hint for early filtering
    selectedContentLayer,
    // Disable auto-fit to avoid forced reflows during updates
    autoFit: false,
  });

  const onEdgesChange = useOnEdgeChange(setEdges);
  const onEdgeConnect = useOnConnect(setEdges, addEdge, rowData);
  const onConnectEnd = useOnConnectEnd({
    setEdges, setNodes, screenToFlowPosition, setRowData, addEdge,
    setLayoutPositions
  });
  const onEdgeDoubleClick = useOnEdgeDoubleClick(setEdges);

  useTagsChange(rowData, setRowData, keepLayout);
  useSelectNode(nodes, edges, setNodes, rowData, handleTransform, centerNode);

  const {
    menuRef: contextMenuRef,
    menuItems: contextMenuItems,
    handleContextMenu,
    onMenuItemClick: onContextMenuItemClick,
    hideMenu: hideContextMenu,
    selectionContextMenu,
    gearContextMenu,
  } = useContextMenu(
    flowWrapperRef, undefined, menuItems, nodes, rowData, setRowData
  );

  const {
    menuRef: edgeMenuRef,
    handleEdgeMenu,
    onMenuItemClick: onEdgeMenuItemClick,
    hideMenu: hideEdgeMenu,
    edge: edgeMenuEdge,
  } = useEdgeMenu(flowWrapperRef);

  const hideMenu = useCallback(() => {
    hideContextMenu();
    hideEdgeMenu();
    setCellMenuContext(null);
  }, [hideContextMenu, hideEdgeMenu, setCellMenuContext]);

  const handlePaneContextMenu = useCallback((event) => {
    if (!showRowGrid || !showColumnGrid) return;
    if (!Array.isArray(gridRows) || gridRows.length === 0) return;
    if (!Array.isArray(gridColumns) || gridColumns.length === 0) return;

    const flowPoint = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    if (!flowPoint) return;

    const rowSegment = gridRows.find((segment) => flowPoint.y >= segment.top && flowPoint.y <= segment.bottom);
    const columnSegment = gridColumns.find((segment) => flowPoint.x >= segment.left && flowPoint.x <= segment.right);

    if (!rowSegment || !columnSegment) return;

    event.preventDefault();
    event.stopPropagation();
    hideMenu();
    setCellMenuContext({
      x: event.clientX,
      y: event.clientY,
      rowSegment,
      columnSegment,
    });
  }, [
    gridColumns,
    gridRows,

    screenToFlowPosition,
    showColumnGrid,
    showRowGrid,
    hideMenu
  ]);

  return (
    <div className="bg-white rounded shadow">
      <FlowHeader
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        handleStateChange={handleStateChange}
        handleCalculateStateScores={handleCalculateStateScores}
        clearStateScores={clearStateScores}
        comparatorState={comparatorState}
        stateScores={stateScores}
      >
        {/* Save visible nodes */}
        <button
          className="ml-4 px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
          onClick={async () => {
            try {
              const ids = (flowFilteredRowData || []).map(c => c.id).filter(Boolean);
              if (!ids.length) {
                toast("No nodes to save from current filter.");
                return;
              }
              const res = await saveNodes(ids);
              const msg = res?.message || "Nodes saved successfully";
              toast.success(msg);
            } catch (e) {
              console.error("Save nodes failed", e);
              toast.error("Failed to save nodes");
            }
          }}
          title="Save all currently visible nodes"
        >
          Save Nodes
        </button>
        {/* Group By Layers tickbox */}
        <div className="flex items-center gap-2 ml-4">
          <input
            type="checkbox"
            id="groupByLayers"
            checked={groupByLayers}
            onChange={e => setGroupByLayers(e.target.checked)}
          />
          <label htmlFor="groupByLayers" className="text-sm">Group By Layers</label>
        </div>
        {/* Show group nodes as groups */}
        <div className="flex items-center gap-2 ml-4">
          <input
            type="checkbox"
            id="showGroupNodes"
            checked={showGroupNodes}
            onChange={e => setShowGroupNodes(e.target.checked)}
          />
          <label htmlFor="showGroupNodes" className="text-sm">Display Group Nodes</label>
        </div>
        {/* Toggle ghost connections */}
        <div className="flex items-center gap-2 ml-4">
          <input
            type="checkbox"
            id="toggleGhostConnections"
            checked={showGhostConnections}
            onChange={e => setShowGhostConnections(e.target.checked)}
          />
          <label htmlFor="toggleGhostConnections" className="text-sm">Show Ghost Connections</label>
        </div>
        {/* Keep Layout toggle */}
        <label className="inline-flex items-center space-x-2 text-sm ml-4">
          <input
            type="checkbox"
            id="keepLayoutToggle"
            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            checked={keepLayout}
            onChange={e => setKeepLayout(e.target.checked)}
          />
          <span>Keep Layout</span>
        </label>
        {/* Add Content Layer Dropdown */}
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-600">Content:</label>
          <select
            value={selectedContentLayer}
            onChange={e => setSelectedContentLayer(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
            title="Filter content layer"
          >
            <option value="">All Layers</option>
            {layerOptions.map(layer => (
              <option key={layer} value={layer}>
                {layer}
              </option>
            ))}
          </select>
        </div>
        {/* Row Layer Dropdown (dummy wired) */}
        <div className="flex items-center gap-1 ml-2">
          <label className="text-xs text-gray-600">Rows:</label>
          <select
            value={rowSelectedLayer}
            onChange={e => setRowSelectedLayer(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
            title="Select Row layer (dummy)"
          >
            <option value="">All Rows</option>
            {layerOptions.map(layer => (
              <option key={layer} value={layer}>
                {layer}
              </option>
            ))}
          </select>
        </div>

        {/* Column Layer Dropdown (dummy wired) */}
        <div className="flex items-center gap-1 ml-2">
          <label className="text-xs text-gray-600">Columns:</label>
          <select
            value={columnSelectedLayer}
            onChange={e => setColumnSelectedLayer(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
            title="Select Column layer (dummy)"
          >
            <option value="">All Columns</option>
            {layerOptions.map(layer => (
              <option key={layer} value={layer}>
                {layer}
              </option>
            ))}
          </select>
        </div>

      </FlowHeader>

      <div className={`transition-all duration-300 overflow-auto`} style={{ height: collapsed ? 0 : 600 }}>
        <div
          ref={flowWrapperRef}
          className="w-full bg-white relative"
          style={{ height: 600 }}
          onClick={hideMenu}
        >
          {/* FlowNavigation removed with activeGroup */}

          <FlowMenuProvider handleNodeMenu={handleContextMenu} handleEdgeMenu={handleEdgeMenu}>
              {(showRowGrid || showColumnGrid) && (
                <div
                className="absolute inset-0 pointer-events-none"
                style={overlayStyle}
                aria-hidden="true"
              >
                {showRowGrid && gridRows.map((row, index) => (
                  <div
                    key={row.id}
                    style={{
                      position: 'absolute',
                      top: `${row.top}px`,
                      left: 0,
                      right: 0,
                      height: `${row.height}px`,
                      borderTop: '1px solid rgba(148, 163, 184, 0.6)',
                      borderBottom: index === gridRows.length - 1
                        ? '1px solid rgba(148, 163, 184, 0.6)'
                        : 'none',
                      backgroundColor: row.isActive
                        ? 'rgba(59, 130, 246, 0.08)'
                        : 'rgba(148, 163, 184, 0.04)',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '-100px',
                        transform: 'translateY(-50%)',
                        fontSize: '12px',
                        fontWeight: row.isActive ? 600 : 500,
                        color: row.isActive ? '#1f2937' : '#4b5563',
                        backgroundColor: 'rgba(255, 255, 255, 0.85)',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.15)',
                        pointerEvents: 'none',
                      }}
                    >
                      {row.label}
                    </div>
                  </div>
                ))}

                {showColumnGrid && gridColumns.map((column, index) => (
                  <div
                    key={column.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: `${column.left}px`,
                      width: `${column.width}px`,
                      borderLeft: '1px solid rgba(148, 163, 184, 0.6)',
                      borderRight: index === gridColumns.length - 1
                        ? '1px solid rgba(148, 163, 184, 0.6)'
                        : 'none',
                      backgroundColor: column.isActive
                        ? 'rgba(16, 185, 129, 0.08)'
                        : 'rgba(148, 163, 184, 0.03)',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: '-50px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: '12px',
                        fontWeight: column.isActive ? 600 : 500,
                        color: column.isActive ? '#065f46' : '#4b5563',
                        backgroundColor: 'rgba(255, 255, 255, 0.85)',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.15)',
                        pointerEvents: 'none',
                      }}
                    >
                      {column.label}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <ReactFlow
              fitView
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onNodeDragStart={onNodeDragStart}
              onNodeDragStop={onNodeDragStop}
              onEdgesChange={onEdgesChange}
              onEdgeDoubleClick={onEdgeDoubleClick}
              onConnect={onEdgeConnect}
              nodeTypes={{ custom: FlowNode, ghost: GhostNode, group: GroupNode }} // <-- add group here
              edgeTypes={edgeTypes}
              defaultMarkerColor="#000000"
              onConnectEnd={onConnectEnd}
              onEdgeContextMenu={handleEdgeMenu}
              onNodeContextMenu={handleContextMenu}
              onSelectionContextMenu={selectionContextMenu}
              onNodeDoubleClick={undefined}
              onPaneContextMenu={handlePaneContextMenu}
              minZoom={0.1} // <-- Add this line
              onMove={handleFlowMove}
              onMoveEnd={handleFlowMoveEnd}
              onInit={handleFlowInit}
            >
              <Controls position="top-left">
                <ControlButton onClick={(e) => gearContextMenu(e)}>
                  <GearIcon />
                </ControlButton>
              </Controls>
              {!dragging && <MiniMap />}
              <Background
                variant="dots"
                gap={12}
                size={1}
                color="#e5e7eb"
                style={{ backgroundColor: '#f9fafb' }}
              />
            </ReactFlow>
            <ContextMenu
              ref={contextMenuRef}
              onMenuItemClick={onContextMenuItemClick}
              menuItems={contextMenuItems}
            />
            <EdgeMenu
              ref={edgeMenuRef}
              onMenuItemClick={onEdgeMenuItemClick}
              rowData={rowData}
              setRowData={setRowData}
              edges={edges}
              setEdges={setEdges}
              edge={edgeMenuEdge}
            />
            {cellMenuContext && (
              <div
                ref={cellMenuRef}
                className="fixed z-50 bg-white border border-gray-200 rounded-md shadow-lg py-1"
                style={{
                  top: cellMenuContext.y,
                  left: cellMenuContext.x,
                  minWidth: '220px',
                }}
              >
                <button
                  type="button"
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={handleCellMenuAddRow}
                >
                  Add row to {cellMenuRowLabel} × {cellMenuColumnLabel}
                </button>
              </div>
            )}
            <ModalAddRow
              isOpen={isAddRowModalOpen}
              onClose={handleModalClose}
              onSelect={handleModalSelect}
              layer={selectedContentLayer}
            />
            <Toaster position="top-right" />
          </FlowMenuProvider>
        </div>
      </div>
    </div>
  );
};

const AppWithProvider = (props) => (
  <ReactFlowProvider>
    <App {...props} />
  </ReactFlowProvider>
);

export default AppWithProvider;

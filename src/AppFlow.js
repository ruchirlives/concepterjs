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
import { saveNodes, addChildren, removeChildren } from './api';
import FlowHeader from './components/FlowHeader';
import { useFlowLogic } from './hooks/useFlowLogic';
import ModalAddRow from './components/ModalAddRow';
import FlowSvgExporter from './components/FlowSvgExporter';
import { requestRefreshChannel } from './hooks/effectsShared';
import { useAppContext } from './AppContext';

const PRECISION_FACTOR = 1000;

const clampToPrecision = (value) => {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * PRECISION_FACTOR) / PRECISION_FACTOR;
};

const buildAxisSegments = (items = [], totalSize = 0, axis = 'row', explicitSize = null) => {
  if (!Array.isArray(items) || items.length === 0) {
    return { segments: [], totalSize: 0 };
  }

  const hasExplicitSize = Number.isFinite(explicitSize) && explicitSize > 0;
  const fallbackTotal = Number.isFinite(totalSize) && totalSize > 0 ? totalSize : 0;
  const effectiveSegmentSize = hasExplicitSize
    ? explicitSize
    : (fallbackTotal > 0 ? fallbackTotal / items.length : 0);

  if (!Number.isFinite(effectiveSegmentSize) || effectiveSegmentSize <= 0) {
    return { segments: [], totalSize: 0 };
  }

  const effectiveTotalSize = clampToPrecision(effectiveSegmentSize * items.length);

  const segments = items.map((item, index) => {
    const { label = '', nodeId, originalId } = item || {};
    const start = clampToPrecision(effectiveSegmentSize * index);
    const end = index === items.length - 1
      ? effectiveTotalSize
      : clampToPrecision(start + effectiveSegmentSize);
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
  return { segments, totalSize: effectiveTotalSize };
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

const dimensionEqual = (a, b) => {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= 0.001;
};

const cellOptionsEqual = (a = {}, b = {}) => (
  dimensionEqual(Number.isFinite(a.width) ? a.width : null, Number.isFinite(b.width) ? b.width : null)
  && dimensionEqual(Number.isFinite(a.height) ? a.height : null, Number.isFinite(b.height) ? b.height : null)
  && dimensionEqual(Number.isFinite(a.adjustedWidth) ? a.adjustedWidth : null, Number.isFinite(b.adjustedWidth) ? b.adjustedWidth : null)
  && dimensionEqual(Number.isFinite(a.adjustedHeight) ? a.adjustedHeight : null, Number.isFinite(b.adjustedHeight) ? b.adjustedHeight : null)
);

const computeAdjustedDimension = (segments = [], fallbackTotal = null, explicitValue = null, axis = 'column') => {
  const values = [];
  const sizeKey = axis === 'row' ? 'height' : 'width';

  if (Array.isArray(segments) && segments.length > 0) {
    let sum = 0;
    segments.forEach((segment) => {
      const size = Number.isFinite(segment?.[sizeKey]) ? segment[sizeKey] : null;
      if (Number.isFinite(size) && size > 0) {
        sum += size;
      }
    });
    if (sum > 0) {
      values.push(clampToPrecision(sum / segments.length));
    }
    if (Number.isFinite(fallbackTotal) && fallbackTotal > 0) {
      values.push(clampToPrecision(fallbackTotal / segments.length));
    }
  }

  if (Number.isFinite(explicitValue) && explicitValue > 0) {
    values.push(clampToPrecision(explicitValue));
  }

  if (values.length === 0) return null;

  const adjusted = values.reduce((min, value) => Math.min(min, value), values[0]);
  return adjusted > 0 ? adjusted : null;
};

const gridsEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  return segmentsEqual(a.rows, b.rows)
    && segmentsEqual(a.columns, b.columns)
    && boundsEqual(a.bounds, b.bounds)
    && cellOptionsEqual(a.cellOptions, b.cellOptions);
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

  const { setParentChildMap, cellWidthInput, setCellWidthInput, cellHeightInput, setCellHeightInput } = useAppContext();


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
  const svgExporterRef = useRef(null);
  const cellMenuRowLabel = cellMenuContext?.rowSegment?.label || 'Row';
  const cellMenuColumnLabel = cellMenuContext?.columnSegment?.label || 'Column';



  const cellWidth = useMemo(() => {
    const value = parseFloat(cellWidthInput);
    if (!Number.isFinite(value) || value <= 0) return null;
    return value;
  }, [cellWidthInput]);

  const cellHeight = useMemo(() => {
    const value = parseFloat(cellHeightInput);
    if (!Number.isFinite(value) || value <= 0) return null;
    return value;
  }, [cellHeightInput]);

  const showRowGrid = Boolean(rowSelectedLayer);
  const showColumnGrid = Boolean(columnSelectedLayer);
  const exportEnabled = showRowGrid || showColumnGrid;

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

  const handleCellWidthInputChange = useCallback((event) => {
    setCellWidthInput(event.target.value);
  }, [setCellWidthInput]);

  const handleCellHeightInputChange = useCallback((event) => {
    setCellHeightInput(event.target.value);
  }, [setCellHeightInput]);

  const handleCellWidthInputBlur = useCallback(() => {
    if (cellWidthInput === '') return;
    const value = parseFloat(cellWidthInput);
    if (!Number.isFinite(value) || value <= 0) {
      setCellWidthInput('');
      return;
    }
    setCellWidthInput(value.toString());
  }, [cellWidthInput, setCellWidthInput]);

  const handleCellHeightInputBlur = useCallback(() => {
    if (cellHeightInput === '') return;
    const value = parseFloat(cellHeightInput);
    if (!Number.isFinite(value) || value <= 0) {
      setCellHeightInput('');
      return;
    }
    setCellHeightInput(value.toString());
  }, [cellHeightInput, setCellHeightInput]);

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
        cellOptions: {
          width: cellWidth,
          height: cellHeight,
          adjustedWidth: computeAdjustedDimension([], null, cellWidth, 'column'),
          adjustedHeight: computeAdjustedDimension([], null, cellHeight, 'row'),
        },
      };
      setGridRows((prev) => (prev.length === 0 ? prev : []));
      setGridColumns((prev) => (prev.length === 0 ? prev : []));
      setFlowGridDimensions((prev) => (gridsEqual(prev, emptyGrid) ? prev : emptyGrid));
      return;
    }

    const rect = wrapperEl.getBoundingClientRect();

    const {
      segments: rowSegments,
      totalSize: rowTotalSize,
    } = showRowGrid
      ? buildAxisSegments(rowLayerNodes, rect.height, 'row', cellHeight)
      : { segments: [], totalSize: 0 };

    const {
      segments: columnSegments,
      totalSize: columnTotalSize,
    } = showColumnGrid
      ? buildAxisSegments(columnLayerNodes, rect.width, 'column', cellWidth)
      : { segments: [], totalSize: 0 };

    setGridRows((prev) => (segmentsEqual(prev, rowSegments) ? prev : rowSegments));
    setGridColumns((prev) => (segmentsEqual(prev, columnSegments) ? prev : columnSegments));

    const nextBoundsWidth = columnSegments.length > 0
      ? columnTotalSize
      : clampToPrecision(rect.width);

    const nextBoundsHeight = rowSegments.length > 0
      ? rowTotalSize
      : clampToPrecision(rect.height);

    const adjustedColumnWidth = computeAdjustedDimension(columnSegments, rect.width, cellWidth, 'column');
    const adjustedRowHeight = computeAdjustedDimension(rowSegments, rect.height, cellHeight, 'row');

    const nextGrid = {
      rows: rowSegments,
      columns: columnSegments,
      bounds: {
        width: nextBoundsWidth,
        height: nextBoundsHeight,
        top: 0,
        left: 0,
        clientTop: clampToPrecision(rect.top),
        clientLeft: clampToPrecision(rect.left),
      },
      lookup: buildGridLookup(rowSegments, columnSegments),
      cellOptions: {
        width: cellWidth,
        height: cellHeight,
        adjustedWidth: adjustedColumnWidth,
        adjustedHeight: adjustedRowHeight,
      },
    };

    setFlowGridDimensions((prev) => (gridsEqual(prev, nextGrid) ? prev : nextGrid));
  }, [
    cellHeight,
    cellWidth,
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

  const overlayStyle = useMemo(() => {
    const bounds = flowGridDimensions?.bounds || {};
    const style = {
      zIndex: 2,
      top: 0,
      left: 0,
      transform: `translate(${viewportTransform.x}px, ${viewportTransform.y}px) scale(${viewportTransform.zoom})`,
      transformOrigin: '0 0',
    };

    const widthValue = Number.isFinite(bounds.width) && bounds.width > 0 ? bounds.width : null;
    const heightValue = Number.isFinite(bounds.height) && bounds.height > 0 ? bounds.height : null;

    style.width = widthValue != null ? `${widthValue}px` : '100%';
    style.height = heightValue != null ? `${heightValue}px` : '100%';

    return style;
  }, [flowGridDimensions, viewportTransform]);

  const wrapperStyle = useMemo(() => {
    const bounds = flowGridDimensions?.bounds || {};
    const widthValue = Number.isFinite(bounds.width) && bounds.width > 0 ? bounds.width : null;
    const heightValue = Number.isFinite(bounds.height) && bounds.height > 0 ? bounds.height : null;

    const style = {
      height: heightValue != null ? heightValue : 600,
    };

    if (widthValue != null) {
      style.width = widthValue;
    }

    return style;
  }, [flowGridDimensions]);

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

  const handleExportSvg = useCallback(() => {
    if (!exportEnabled) return;
    const exported = svgExporterRef.current?.exportSvg();
    if (!exported) {
      toast.error('Unable to generate SVG export.');
    }
  }, [exportEnabled]);

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

  const handleGridDrop = useCallback(async (event, node) => {
    // console.log("handleGridDrop called with node:", node);
    if (!node) return;
    if (!showRowGrid && !showColumnGrid) return;
    if (!screenToFlowPosition) return;

    const grid = flowGridDimensions || {};
    const pointer = (event && typeof event.clientX === 'number' && typeof event.clientY === 'number')
      ? screenToFlowPosition({ x: event.clientX, y: event.clientY })
      : null;

    const fallbackPoint = node?.positionAbsolute || node?.position || null;
    const flowPoint = pointer || fallbackPoint;
    if (!flowPoint) return;

    const extractParentId = (segment) => {
      if (!segment) return null;
      const candidate = segment.originalId ?? segment.nodeId ?? null;
      return candidate != null ? candidate.toString() : null;
    };

    const segmentsByAxis = (axis) => {
      if (axis === 'row') {
        if (Array.isArray(gridRows) && gridRows.length > 0) return gridRows;
        return Array.isArray(grid.rows) ? grid.rows : [];
      }
      if (Array.isArray(gridColumns) && gridColumns.length > 0) return gridColumns;
      return Array.isArray(grid.columns) ? grid.columns : [];
    };

    const locateSegment = (segments, axis) => segments.find((segment) => {
      if (!segment) return false;
      return axis === 'row'
        ? flowPoint.y >= segment.top && flowPoint.y <= segment.bottom
        : flowPoint.x >= segment.left && flowPoint.x <= segment.right;
    });

    const rowSegment = showRowGrid ? locateSegment(segmentsByAxis('row'), 'row') : null;
    const columnSegment = showColumnGrid ? locateSegment(segmentsByAxis('column'), 'column') : null;

    const rawChildId = node?.data?.originalId ?? node?.data?.id ?? node?.id;
    if (rawChildId == null) return;
    const childId = rawChildId.toString().split('__in__')[0];
    if (!childId) return;

    const nextRowId = showRowGrid ? extractParentId(rowSegment) : null;
    const nextColumnId = showColumnGrid ? extractParentId(columnSegment) : null;

    const previousAssignment = node?.data?.gridAssignment ?? node?.gridAssignment ?? {};
    const normalizeId = (value) => (value != null ? value.toString() : null);
    const prevRowId = normalizeId(previousAssignment?.rowId ?? (Array.isArray(previousAssignment?.rowIds) ? previousAssignment.rowIds[0] : null));
    const prevColumnId = normalizeId(previousAssignment?.columnId ?? (Array.isArray(previousAssignment?.columnIds) ? previousAssignment.columnIds[0] : null));

    const rowChanged = Boolean(showRowGrid && nextRowId && nextRowId !== prevRowId);
    const columnChanged = Boolean(showColumnGrid && nextColumnId && nextColumnId !== prevColumnId);

    if (!rowChanged && !columnChanged) return;

    const parseId = (value) => {
      if (value == null) return value;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : value;
    };

    const applyAssignmentUpdates = (assignment) => {
      const next = { ...(assignment || {}) };
      if (rowChanged) {
        next.rowId = nextRowId || null;
        next.rowIds = nextRowId ? [nextRowId] : [];
      }
      if (columnChanged) {
        next.columnId = nextColumnId || null;
        next.columnIds = nextColumnId ? [nextColumnId] : [];
      }
      return next;
    };

    try {
      if (rowChanged && prevRowId) {
        await removeChildren(prevRowId, [childId]);
      }
      if (columnChanged && prevColumnId) {
        await removeChildren(prevColumnId, [childId]);
      }
      if (rowChanged && nextRowId) {
        await addChildren(nextRowId, [childId]);
      }
      if (columnChanged && nextColumnId) {
        await addChildren(nextColumnId, [childId]);
      }

      setNodes((existingNodes) => existingNodes.map((existing) => {
        const candidateId = existing?.data?.originalId ?? existing?.data?.id ?? existing?.id;
        const normalizedCandidate = candidateId != null ? candidateId.toString().split('__in__')[0] : null;
        if (normalizedCandidate !== childId) {
          return existing;
        }
        const nextAssignment = applyAssignmentUpdates(existing?.data?.gridAssignment ?? existing?.gridAssignment);
        return {
          ...existing,
          gridAssignment: applyAssignmentUpdates(existing?.gridAssignment),
          data: {
            ...existing.data,
            gridAssignment: nextAssignment,
          },
        };
      }));

      setParentChildMap((prev) => {
        if (!Array.isArray(prev)) return prev;
        let mutated = false;
        const ensureArray = (value) => (Array.isArray(value) ? value : []);
        const comparable = (value) => (value != null ? value.toString() : null);

        const removeFromParent = (entries, parentId) => entries.map((entry) => {
          if (!entry) return entry;
          if (comparable(entry.container_id) !== parentId) return entry;
          const children = ensureArray(entry.children);
          const filtered = children.filter((child) => comparable(child?.id) !== childId);
          if (filtered.length === children.length) return entry;
          mutated = true;
          return { ...entry, children: filtered };
        });

        let nextMap = prev;
        if (rowChanged && prevRowId) {
          nextMap = removeFromParent(nextMap, prevRowId);
        }
        if (columnChanged && prevColumnId) {
          nextMap = removeFromParent(nextMap, prevColumnId);
        }

        const addToParent = (entries, parentId) => {
          if (!parentId) return entries;
          const parentKey = parentId.toString();
          let index = entries.findIndex((entry) => comparable(entry?.container_id) === parentKey);
          let working = entries;
          if (index === -1) {
            const containerValue = parseId(parentId);
            working = [...working, { container_id: containerValue, children: [] }];
            index = working.length - 1;
            mutated = true;
          }
          const entry = working[index];
          const children = ensureArray(entry.children);
          if (children.some((child) => comparable(child?.id) === childId)) {
            return working;
          }
          const childValue = parseId(childId);
          const updatedEntry = {
            ...entry,
            children: [...children, { id: childValue, label: 'child' }],
          };
          const copy = [...working];
          copy[index] = updatedEntry;
          mutated = true;
          return copy;
        };

        if (rowChanged && nextRowId) {
          nextMap = addToParent(nextMap, nextRowId);
        }
        if (columnChanged && nextColumnId) {
          nextMap = addToParent(nextMap, nextColumnId);
        }

        return mutated ? nextMap : prev;
      });

      requestRefreshChannel();
    } catch (error) {
      console.error('Failed to update grid assignment on drop', error);
      toast.error('Failed to move item to the selected grid cell.');
    }
  }, [
    flowGridDimensions,
    gridColumns,
    gridRows,
    screenToFlowPosition,
    setNodes,
    setParentChildMap,
    showColumnGrid,
    showRowGrid,
  ]);

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
    // console.log("onNodeDragStop called with node:", node);
    setDragging(false);
    handleGridDrop(evt, node);
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
  }, [handleGridDrop, keepLayout, setLayoutPositions]);

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
          <button
            className={`ml-4 px-3 py-1 text-xs rounded ${exportEnabled ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
            onClick={handleExportSvg}
            disabled={!exportEnabled}
            title={exportEnabled ? 'Export the current grid view as SVG' : 'Activate a row or column grid to export'}
          >
            Export Grid SVG
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

        <div className="flex items-center gap-1 ml-4">
          <label className="text-xs text-gray-600" htmlFor="flowCellWidthInput">
            Cell W:
          </label>
          <input
            id="flowCellWidthInput"
            type="number"
            min="0"
            step="10"
            value={cellWidthInput}
            onChange={handleCellWidthInputChange}
            onBlur={handleCellWidthInputBlur}
            placeholder="auto"
            className="px-2 py-1 w-20 text-xs border border-gray-300 rounded bg-white"
            title="Custom width for cells that contain nodes (leave blank for auto)"
          />
        </div>

        <div className="flex items-center gap-1 ml-2">
          <label className="text-xs text-gray-600" htmlFor="flowCellHeightInput">
            Cell H:
          </label>
          <input
            id="flowCellHeightInput"
            type="number"
            min="0"
            step="10"
            value={cellHeightInput}
            onChange={handleCellHeightInputChange}
            onBlur={handleCellHeightInputBlur}
            placeholder="auto"
            className="px-2 py-1 w-20 text-xs border border-gray-300 rounded bg-white"
            title="Custom height for cells that contain nodes (leave blank for auto)"
          />
        </div>

      </FlowHeader>

      <div className={`transition-all duration-300 overflow-auto`} style={{ height: collapsed ? 0 : 600 }}>
        <div
          ref={flowWrapperRef}
          className="w-full bg-white relative"
          style={wrapperStyle}
          onClick={hideMenu}
        >
          {/* FlowNavigation removed with activeGroup */}

          <FlowMenuProvider handleNodeMenu={handleContextMenu} handleEdgeMenu={handleEdgeMenu}>
              {(showRowGrid || showColumnGrid) && (
                <div
                className="absolute pointer-events-none"
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
            <FlowSvgExporter
              ref={svgExporterRef}
              nodes={nodes}
              edges={edges}
              grid={flowGridDimensions}
              viewport={viewportTransform}
              includeRows={showRowGrid}
              includeColumns={showColumnGrid}
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
                  Add row to {cellMenuRowLabel} x {cellMenuColumnLabel}
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

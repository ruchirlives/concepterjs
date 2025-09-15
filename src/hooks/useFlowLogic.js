import { useState, useCallback, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useAppContext } from '../AppContext';
import { useStateScores } from './useStateScores';

export const useFlowLogic = () => {
  const [collapsed, setCollapsed] = useState(true);

  const [history, setHistory] = useState([]);
  const [layoutPositions, setLayoutPositions] = useState({});

  const { rowData, setRowData, nodes, setNodes, edges, setEdges, onNodesChange, hiddenLayers, layerOptions, comparatorState, activeGroup, setActiveGroup, selectedContentLayer, setSelectedContentLayer } = useAppContext();
  const { screenToFlowPosition, getViewport, setViewport, getZoom } = useReactFlow();
  const { stateScores, handleCalculateStateScores, getHighestScoringContainer, clearStateScores } = useStateScores();

  // Filter rowData based on hidden layers for Flow only
  const flowFilteredRowData = useMemo(() => {
    // console.log('Original rowData count:', rowData.length);
    // console.log('Hidden layers:', [...hiddenLayers]);
    // console.log('Available layer options:', layerOptions);

    if (hiddenLayers.size === 0) return rowData;

    const filtered = rowData.filter(container => {
      // Keep containers without Tags (no layer assigned)
      if (!container.Tags || container.Tags.trim() === '') return true;

      const containerTags = container.Tags
        .split(",")
        .map(tag => tag.trim())
        .filter(Boolean);

      // Keep containers with empty tags after filtering
      if (containerTags.length === 0) return true;

      // Only filter out containers if their tags are:
      // 1. In the layerOptions (recognized layers)
      // 2. AND in hiddenLayers (unticked)
      const shouldHide = containerTags.some(tag =>
        layerOptions.includes(tag) && hiddenLayers.has(tag)
      );

      return !shouldHide;
    });

    console.log('Filtered rowData count:', filtered.length);
    return filtered;
  }, [rowData, hiddenLayers, layerOptions]);

  // Handle state change callback
  const handleStateChange = useCallback((newState) => {
    console.log(`State changed to: ${newState}`);
  }, []);

  // Viewport and centering logic
  const centerNode = (node) => {
    const zoom = getZoom();
    const nodeWidth = node?.width || 200;
    const nodeHeight = node?.height || 100;
    const nodeCenterX = node.position.x + nodeWidth / 2;
    const nodeCenterY = node.position.y + nodeHeight / 2;

    const wrapper = document.querySelector('.react-flow__viewport')?.parentElement;
    const wrapperRect = wrapper.getBoundingClientRect();

    const screenCenter = {
      x: wrapperRect.left + wrapperRect.width / 2,
      y: wrapperRect.top + wrapperRect.height / 2,
    };

    const x = screenCenter.x - nodeCenterX * zoom;
    const y = screenCenter.y - nodeCenterY * zoom;

    setViewport({ x, y, zoom }, { duration: 800 });
  };

  const handleTransform = useCallback((x, y) => {
    console.log('Zooming');
    const { zoom } = getViewport();
    setViewport({ x: x, y: y, zoom: zoom }, { duration: 800 });
  }, [setViewport, getViewport]);

  return {
    // State
    collapsed, setCollapsed,
    activeGroup, setActiveGroup,
    history, setHistory,
    layoutPositions, setLayoutPositions,

    // Data
    flowFilteredRowData,
    comparatorState,

    // Layers
    selectedContentLayer, setSelectedContentLayer, layerOptions,

    // Actions
    handleStateChange,
    centerNode,
    handleTransform,

    // State scores
    stateScores,
    handleCalculateStateScores,
    getHighestScoringContainer,
    clearStateScores,

    // Context data
    rowData, setRowData,
    nodes, setNodes,
    edges, setEdges,
    onNodesChange,
    screenToFlowPosition
  };
};
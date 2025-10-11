import { useState, useCallback, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useAppContext } from '../AppContext';
import { useStateScores } from './useStateScores';

export const useFlowLogic = () => {
  const [collapsed, setCollapsed] = useState(false);

  const [history, setHistory] = useState([]);
  const [layoutPositions, setLayoutPositions] = useState({});

  const [groupByLayers, setGroupByLayers] = useState(false);
  const [showGroupNodes, setShowGroupNodes] = useState(false);

  const { rowData, setRowData, nodes, setNodes, edges, setEdges, onNodesChange, hiddenLayers, layerOptions, comparatorState, selectedContentLayer, setSelectedContentLayer } = useAppContext();
  const { screenToFlowPosition, getViewport, setViewport, getZoom } = useReactFlow();
  const { stateScores, handleCalculateStateScores, getHighestScoringContainer, clearStateScores } = useStateScores();

  // Filter rowData based on ticked layers (positive screen) for Flow only
  const flowFilteredRowData = useMemo(() => {
    // console.log('Original rowData count:', rowData.length);
    // console.log('Hidden layers:', [...hiddenLayers]);
    // console.log('Available layer options:', layerOptions);

    // 1) Positive filter by selected content layer (if any)
    const positivelyFiltered = selectedContentLayer
      ? rowData.filter(container => {
          const containerTags = (container.Tags || '')
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean);
          return containerTags.includes(selectedContentLayer);
        })
      : rowData;

    // 2) Positive filter by ticked layers (visibleLayers)
    // visibleLayers = all layerOptions that are NOT in hiddenLayers
    const visibleLayers = new Set(
      (layerOptions || []).filter(l => !hiddenLayers.has(l))
    );

    const filtered = positivelyFiltered.filter(container => {
      const containerTags = (container.Tags || '')
        .split(",")
        .map(tag => tag.trim())
        .filter(Boolean);

      if (containerTags.length === 0) {
        return !hiddenLayers.has('__UNTAGGED__');
      }      // Include only if the container has at least one tag in visibleLayers
      return visibleLayers.size > 0 && containerTags.some(tag => visibleLayers.has(tag));
    });

    console.log('Filtered rowData count:', filtered.length);
    return filtered;
  }, [rowData, hiddenLayers, layerOptions, selectedContentLayer]);

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
    history, setHistory,
    layoutPositions, setLayoutPositions,

    // Data
    flowFilteredRowData,
    comparatorState,

    // Layers
    selectedContentLayer, setSelectedContentLayer, layerOptions,
    groupByLayers, setGroupByLayers,
    showGroupNodes, setShowGroupNodes,

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


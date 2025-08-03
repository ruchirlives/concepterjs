import { useState, useCallback, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useAppContext } from '../AppContext';
import { useStateScores } from './useStateScores';

export const useFlowLogic = () => {
  const [collapsed, setCollapsed] = useState(true);
  const [activeGroup, setActiveGroup] = useState(null);
  const [history, setHistory] = useState([]);
  const [hiddenLayers, setHiddenLayers] = useState(new Set());
  const [layerDropdownOpen, setLayerDropdownOpen] = useState(false);
  const [layoutPositions, setLayoutPositions] = useState({});

  const { rowData, setRowData, nodes, setNodes, edges, setEdges, onNodesChange, layerOptions, comparatorState } = useAppContext();
  const { screenToFlowPosition, getViewport, setViewport, getZoom } = useReactFlow();
  const { stateScores, handleCalculateStateScores, getHighestScoringContainer, clearStateScores } = useStateScores();

  // Filter rowData based on hidden layers for Flow only
  const flowFilteredRowData = useMemo(() => {
    if (hiddenLayers.size === 0) return rowData;

    return rowData.filter(container => {
      if (!container.Tags) return true;

      const containerTags = container.Tags
        .split(",")
        .map(tag => tag.trim())
        .filter(Boolean);

      return !containerTags.some(tag => hiddenLayers.has(tag));
    });
  }, [rowData, hiddenLayers]);

  // Toggle layer visibility
  const toggleLayerVisibility = useCallback((layer) => {
    setHiddenLayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(layer)) {
        newSet.delete(layer);
      } else {
        newSet.add(layer);
      }
      return newSet;
    });
  }, []);

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
    hiddenLayers, setHiddenLayers,
    layerDropdownOpen, setLayerDropdownOpen,
    layoutPositions, setLayoutPositions,
    
    // Data
    flowFilteredRowData,
    layerOptions,
    comparatorState,
    
    // Actions
    toggleLayerVisibility,
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
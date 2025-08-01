import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useAppContext } from './AppContext';
import {
  ReactFlow, ReactFlowProvider,
  MiniMap, Controls, Background, useReactFlow, addEdge, ControlButton
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCreateNodesAndEdges, useOnConnect, useOnEdgeChange, useOnConnectEnd, useTagsChange, useSelectNode, useOnEdgeDoubleClick } from './flowEffects';
import FlowNode from './flowNode';
import GroupNode from './flowGroupNodes';
import ContextMenu from "./ContextMenu";
import { useContextMenu, menuItems } from "./flowContextMenu";
import EdgeMenu, { useEdgeMenu } from "./flowEdgeMenu";
import { FlowMenuProvider } from './FlowMenuContext';
import { GearIcon } from '@radix-ui/react-icons'
import CustomEdge from './customEdge';
import { Toaster } from 'react-hot-toast';
import StateDropdown from './StateDropdown';

const App = ({ keepLayout, setKeepLayout }) => {
  const [collapsed, setCollapsed] = useState(true);
  // Step 1: Active group state and history ---
  const [activeGroup, setActiveGroup] = useState(null);
  const [history, setHistory] = useState([]);

  // New state for layer visibility in Flow
  const [hiddenLayers, setHiddenLayers] = useState(new Set());
  const [layerDropdownOpen, setLayerDropdownOpen] = useState(false);

  // // State management
  // const [activeState, setActiveState] = useState("base");

  // Step 2: Zustand store for nodes and edges ---
  const flowWrapperRef = React.useRef(null);
  const { rowData, setRowData, nodes, setNodes, edges, setEdges, onNodesChange, layerOptions } = useAppContext();
  const [layoutPositions, setLayoutPositions] = useState({});
  // const [nodes, setNodes, onNodesChange] = useNodesState([]);
  // const [edges, setEdges] = useEdgesState();

  // Filter rowData based on hidden layers for Flow only
  const flowFilteredRowData = useMemo(() => {
    if (hiddenLayers.size === 0) return rowData;

    return rowData.filter(container => {
      if (!container.Tags) return true; // Show containers without tags

      const containerTags = container.Tags
        .split(",")
        .map(tag => tag.trim())
        .filter(Boolean);

      // Hide if any of the container's tags are in hiddenLayers
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
    // Additional logic when state changes if needed
    console.log(`State changed to: ${newState}`);
  }, []);

  // Memoize edgeTypes so it's not recreated on every render
  const edgeTypes = useMemo(() => ({
    customEdge: (edgeProps) => (
      <CustomEdge {...edgeProps} setEdges={setEdges} />
    ),
  }), [setEdges]);

  // Step 3: Viewport transformation ---
  const { screenToFlowPosition, getViewport, setViewport, getZoom } = useReactFlow();

  const centerNode = (node) => {
    const zoom = getZoom();

    // Use actual bounding box if possible (fallback to estimates)
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

  useEffect(() => {
    if (!keepLayout) return;
    // Build a fresh map of *current* positions
    const storedPositions = {};
    nodes.forEach(node => {
      // Grab the live position you just dragged
      storedPositions[node.id] = node.position;
    });
    setLayoutPositions(storedPositions);
  }, [keepLayout, nodes, setLayoutPositions]);

  // Broadcast activeGroup to activeGroupChannel
  useEffect(() => {
    const activeGroupChannel = new BroadcastChannel('activeGroupChannel');
    console.log('Broadcasting activeGroup:', activeGroup);
    activeGroupChannel.postMessage({ activeGroup });
    return () => {
      activeGroupChannel.close();
    }
  }, [activeGroup]);

  // Step 4: Custom hook to create nodes and edges (use filtered data)
  useCreateNodesAndEdges({ nodes, setNodes, setEdges, rowData: flowFilteredRowData, keepLayout, activeGroup, setLayoutPositions, layoutPositions, setRowData });
  const onEdgesChange = useOnEdgeChange(setEdges);
  const onEdgeConnect = useOnConnect(setEdges, addEdge, rowData);
  const onConnectEnd = useOnConnectEnd({ setEdges, setNodes, screenToFlowPosition, setRowData, addEdge, activeGroup, setLayoutPositions });
  const onEdgeDoubleClick = useOnEdgeDoubleClick(setEdges);

  // Step 5: Context menu and edge menu logic ---
  useTagsChange(rowData, setRowData, keepLayout);
  useSelectNode(nodes, edges, setNodes, rowData, handleTransform, centerNode); // Use the custom context menu logic

  const {
    menuRef: contextMenuRef,
    menuItems: contextMenuItems,
    handleContextMenu,
    onMenuItemClick: onContextMenuItemClick,
    hideMenu: hideContextMenu,
    selectionContextMenu,
    gearContextMenu,
  } = useContextMenu(
    flowWrapperRef,
    activeGroup,
    menuItems,
    nodes,
    rowData,
    setRowData,
    history
  ); // Custom onConnect and onDisconnect hooks

  const { menuRef: edgeMenuRef, handleEdgeMenu, onMenuItemClick: onEdgeMenuItemClick, hideMenu: hideEdgeMenu,
  } = useEdgeMenu(flowWrapperRef, activeGroup); // Custom edge menu logic

  const hideMenu = () => { hideContextMenu(); hideEdgeMenu(); };

  // Close layer dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (layerDropdownOpen && !event.target.closest('.layer-dropdown')) {
        setLayerDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [layerDropdownOpen]);

  return (
    <div className="bg-white rounded shadow">
      {/* Header with collapse button, layer filter, and state management */}
      <div className="flex justify-between items-center bg-white text-black px-4 py-2 cursor-pointer select-none">
        <div className="flex items-center gap-4">
          <span className="font-semibold" onClick={() => setCollapsed((c) => !c)}>
            Flow Diagram
          </span>

          {/* State Management Dropdown */}
          <StateDropdown 
            onStateChange={handleStateChange}
          />

          {/* Layer Filter Dropdown */}
          <div className="relative layer-dropdown">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLayerDropdownOpen(!layerDropdownOpen);
              }}
              className="px-3 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center gap-1"
              title="Hide/Show layers"
            >
              <span>Layers</span>
              <span className="text-gray-500">
                {hiddenLayers.size > 0 && `(${hiddenLayers.size} hidden)`}
              </span>
              <span className={`transform transition-transform ${layerDropdownOpen ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>

            {layerDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 min-w-48">
                <div className="p-2 border-b border-gray-200 text-xs font-medium text-gray-600">
                  Hide Layers in Flow
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {layerOptions.length === 0 ? (
                    <div className="p-3 text-xs text-gray-500">No layers available</div>
                  ) : (
                    layerOptions.map((layer) => (
                      <label
                        key={layer}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={hiddenLayers.has(layer)}
                          onChange={() => toggleLayerVisibility(layer)}
                          className="rounded border-gray-300"
                        />
                        <span className={hiddenLayers.has(layer) ? 'line-through text-gray-500' : ''}>
                          {layer}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                {hiddenLayers.size > 0 && (
                  <div className="p-2 border-t border-gray-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setHiddenLayers(new Set());
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Show All Layers
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <button
          className="text-lg font-bold"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand flow diagram" : "Collapse flow diagram"}
        >
          {collapsed ? "▼" : "▲"}
        </button>
      </div>

      {/* Flow content */}
      <div className={`transition-all duration-300 overflow-auto`} style={{ height: collapsed ? 0 : 600 }}>
        <div
          ref={flowWrapperRef}
          className="w-full bg-white relative"
          style={{ height: 600 }}
          onClick={hideMenu}
        >

          {/* [ADDED] Back button and name of activegroup when in a subgroup */}
          {activeGroup && (
            <div
              className="absolute top-2 left-20 z-50 flex items-center space-x-4 bg-white bg-opacity-80 rounded shadow p-3"
              style={{ backdropFilter: 'blur(4px)' }}
            >
              <button
                className="bg-gray-200 rounded p-3"
                onClick={() => {
                  const prev = history[history.length - 1] || null;
                  setHistory(h => h.slice(0, -1));
                  setActiveGroup(prev);
                }}
              >
                ← Back
              </button>

              <h1 className="text-lg font-bold p-3">
                {rowData.find(n => n.id === activeGroup)?.Name || activeGroup}
              </h1>
            </div>
          )}

          <FlowMenuProvider handleNodeMenu={handleContextMenu} handleEdgeMenu={handleEdgeMenu}>
            <ReactFlow
              fitView
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onEdgeDoubleClick={onEdgeDoubleClick}
              onConnect={onEdgeConnect}
              nodeTypes={{ custom: FlowNode, group: GroupNode }}
              edgeTypes={edgeTypes}
              defaultMarkerColor="#000000"
              onConnectEnd={onConnectEnd} onEdgeContextMenu={handleEdgeMenu} onNodeContextMenu={handleContextMenu} onSelectionContextMenu={selectionContextMenu} // Handle right-click for context menu
              // [ADDED] onNodeDoubleClick drills into group
              onNodeDoubleClick={(e, node) => {
                if (node.type === 'group') {
                  // [ADDED] push current activeGroup onto history
                  setHistory(h => [...h, activeGroup]);
                  setActiveGroup(node.id);
                  // If setKeepLayout exists, set it to false
                  if (typeof setKeepLayout === 'function') {
                    setKeepLayout(false);
                  }
                  // Refresh the nodes and edges

                }
              }}
            >
              <Controls position="top-left">
                <ControlButton onClick={(e) => gearContextMenu(e)}>
                  <GearIcon />
                </ControlButton>
              </Controls>
              <MiniMap />
              <Background
                variant="dots"
                gap={12}
                size={1}
                color="#e5e7eb" // Tailwind's gray-200
                style={{ backgroundColor: '#f9fafb' }} // Tailwind's gray-50
              />
            </ReactFlow>
            <ContextMenu
              ref={contextMenuRef}
              onMenuItemClick={onContextMenuItemClick}
              menuItems={contextMenuItems}
            />
            <EdgeMenu ref={edgeMenuRef} onMenuItemClick={onEdgeMenuItemClick} rowData={rowData} setRowData={setRowData} edges={edges} setEdges={setEdges} />
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

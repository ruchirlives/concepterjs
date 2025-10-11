import React, { useEffect, useMemo, useState, useCallback } from "react";
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
import { saveNodes } from './api';
import FlowHeader from './components/FlowHeader';
import { useFlowLogic } from './hooks/useFlowLogic';

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
  } = useFlowLogic();

  const [groupByLayers, setGroupByLayers] = useState(false);
  const [showGroupNodes, setShowGroupNodes] = useState(false);
  const [showGhostConnections, setShowGhostConnections] = useState(false);
  const [dragging, setDragging] = useState(false);

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

  const hideMenu = () => {
    hideContextMenu();
    hideEdgeMenu();
  };

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
              minZoom={0.1} // <-- Add this line
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

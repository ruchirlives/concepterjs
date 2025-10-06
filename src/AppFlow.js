import React, { useEffect, useMemo, useState } from "react";
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
  const [showGhostConnections, setShowGhostConnections] = useState(true);

  // Memoize edgeTypes so it's not recreated on every render
  const edgeTypes = useMemo(() => ({
    customEdge: (edgeProps) => (
      <CustomEdge {...edgeProps} setEdges={setEdges} />
    ),
  }), [setEdges]);

  useEffect(() => {
    if (!keepLayout) return;
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
  }, [keepLayout, nodes, setLayoutPositions]);

  // Removed activeGroup broadcasting

  // Flow effects hooks
  useCreateNodesAndEdges({
    nodes, setNodes, setEdges, rowData: flowFilteredRowData, keepLayout,
    setLayoutPositions, layoutPositions, setRowData,
    stateScores, getHighestScoringContainer,
    groupByLayers,
    showGhostConnections,
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
              <MiniMap />
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

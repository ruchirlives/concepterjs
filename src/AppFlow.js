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
import FlowNavigation from './components/FlowNavigation';
import { useFlowLogic } from './hooks/useFlowLogic';

const App = ({ keepLayout, setKeepLayout }) => {
  const flowWrapperRef = React.useRef(null);

  const {
    collapsed, setCollapsed,
    activeGroup, setActiveGroup,
    history, setHistory,
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
    screenToFlowPosition
  } = useFlowLogic();

  const [groupByLayers, setGroupByLayers] = useState(false); // <-- Add this

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

  // Broadcast activeGroup to activeGroupChannel
  useEffect(() => {
    const activeGroupChannel = new BroadcastChannel('activeGroupChannel');
    console.log('Broadcasting activeGroup:', activeGroup);
    activeGroupChannel.postMessage({ activeGroup });
    return () => {
      activeGroupChannel.close();
    }
  }, [activeGroup]);

  // Flow effects hooks
  useCreateNodesAndEdges({
    nodes, setNodes, setEdges, rowData: flowFilteredRowData, keepLayout,
    activeGroup, setLayoutPositions, layoutPositions, setRowData,
    stateScores, getHighestScoringContainer,
    groupByLayers,
  });

  const onEdgesChange = useOnEdgeChange(setEdges);
  const onEdgeConnect = useOnConnect(setEdges, addEdge, rowData);
  const onConnectEnd = useOnConnectEnd({
    setEdges, setNodes, screenToFlowPosition, setRowData, addEdge,
    activeGroup, setLayoutPositions
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
    flowWrapperRef, activeGroup, menuItems, nodes, rowData, setRowData, history
  );

  const {
    menuRef: edgeMenuRef,
    handleEdgeMenu,
    onMenuItemClick: onEdgeMenuItemClick,
    hideMenu: hideEdgeMenu,
  } = useEdgeMenu(flowWrapperRef, activeGroup);

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
      </FlowHeader>

      <div className={`transition-all duration-300 overflow-auto`} style={{ height: collapsed ? 0 : 600 }}>
        <div
          ref={flowWrapperRef}
          className="w-full bg-white relative"
          style={{ height: 600 }}
          onClick={hideMenu}
        >
          <FlowNavigation
            activeGroup={activeGroup}
            history={history}
            setHistory={setHistory}
            setActiveGroup={setActiveGroup}
            rowData={rowData}
          />

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
              onNodeDoubleClick={(e, node) => {
                if (node.type === 'group') {
                  setHistory(h => [...h, activeGroup]);
                  setActiveGroup(node.id);
                  if (typeof setKeepLayout === 'function') {
                    setKeepLayout(false);
                  }
                }
              }}
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

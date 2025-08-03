import React, { useEffect, useMemo } from "react";
import {
  ReactFlow, ReactFlowProvider, MiniMap, Controls, Background,
  addEdge, ControlButton
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  useCreateNodesAndEdges, useOnConnect, useOnEdgeChange,
  useOnConnectEnd, useTagsChange, useSelectNode, useOnEdgeDoubleClick
} from './flowEffects';
import FlowNode from './flowNode';
import GroupNode from './flowGroupNodes';
import ContextMenu from "./ContextMenu";
import { useContextMenu, menuItems } from "./flowContextMenu";
import EdgeMenu, { useEdgeMenu } from "./flowEdgeMenu";
import { FlowMenuProvider } from './FlowMenuContext';
import { GearIcon } from '@radix-ui/react-icons'
import CustomEdge from './customEdge';
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
    hiddenLayers, setHiddenLayers,
    layerDropdownOpen, setLayerDropdownOpen,
    layoutPositions, setLayoutPositions,
    flowFilteredRowData,
    layerOptions,
    comparatorState,
    toggleLayerVisibility,
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
  }, [layerDropdownOpen, setLayerDropdownOpen]);

  // Flow effects hooks
  useCreateNodesAndEdges({
    nodes, setNodes, setEdges, rowData: flowFilteredRowData, keepLayout,
    activeGroup, setLayoutPositions, layoutPositions, setRowData,
    stateScores, getHighestScoringContainer
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
        layerDropdownOpen={layerDropdownOpen}
        setLayerDropdownOpen={setLayerDropdownOpen}
        hiddenLayers={hiddenLayers}
        setHiddenLayers={setHiddenLayers}
        layerOptions={layerOptions}
        toggleLayerVisibility={toggleLayerVisibility}
      />

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
              nodeTypes={{ custom: FlowNode, group: GroupNode }}
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

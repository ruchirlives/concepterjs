import React, { useEffect, useRef } from 'react';
import { Stage, Container, Graphics, Text, PixiComponent, useApp } from '@pixi/react';
import { Viewport as PixiViewport } from 'pixi-viewport';
import useZoomLevel from './useZoomLevel';
import useAppMapData from './useAppMapData';

// PixiComponent wrapper for pixi-viewport
const Viewport = PixiComponent('Viewport', {
  create: ({ app }) => {
    const viewport = new PixiViewport({
      screenWidth: app.renderer.width,
      screenHeight: app.renderer.height,
      worldWidth: 100000,
      worldHeight: 100000,
      interaction: app.renderer.plugins.interaction,
    });

    // Enable common interactions
    viewport.drag().pinch().wheel().decelerate();
    return viewport;
  },
});

const AppMapInner = () => {
  const app = useApp();
  const viewportRef = useRef(null);
  const { nodes, loadContainers, loadChildren, updateNodePosition } = useAppMapData();
  const zoom = useZoomLevel(viewportRef);
  const dragData = useRef(null);

  useEffect(() => {
    loadContainers();
  }, [loadContainers]);

  const onNodeClick = async (node) => {
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.animate({ position: { x: node.x, y: node.y }, scale: Math.max(1, viewport.scale.x) });
    }
    await loadChildren(node.id, { x: node.x, y: node.y });
  };

  const onDragStart = (event, node) => {
    event.stopPropagation();
    dragData.current = { id: node.id, data: event.data };
  };

  const onDragEnd = (event, node) => {
    if (dragData.current?.id === node.id) {
      updateNodePosition(node.id, node.x, node.y, true);
      dragData.current = null;
    }
  };

  const onDragMove = (event, node) => {
    if (!dragData.current || dragData.current.id !== node.id) return;
    const newPosition = dragData.current.data.getLocalPosition(viewportRef.current);
    updateNodePosition(node.id, newPosition.x, newPosition.y, false);
  };

  return (
    <Viewport ref={viewportRef} app={app} worldWidth={100000} worldHeight={100000}>
      {nodes.map((node) => {
        const label =
          zoom < 0.2
            ? ''
            : zoom < 1
            ? node.name
            : `${node.name}${node.description ? ' - ' + node.description : ''}`;
        return (
          <Container
            key={node.id}
            x={node.x}
            y={node.y}
            eventMode="dynamic"
            cursor="pointer"
            pointerdown={(e) => onDragStart(e, node)}
            pointerup={(e) => onDragEnd(e, node)}
            pointerupoutside={(e) => onDragEnd(e, node)}
            pointermove={(e) => onDragMove(e, node)}
            onclick={() => onNodeClick(node)}
          >
            <Graphics
              draw={(g) => {
                g.clear();
                g.beginFill(0x3498db);
                g.drawCircle(0, 0, 10);
                g.endFill();
              }}
            />
            {label && (
              <Text text={label} anchor={0.5} y={-20} style={{ fill: '#000', fontSize: 14 / zoom }} />
            )}
          </Container>
        );
      })}
    </Viewport>
  );
};

const AppMap = () => (
  <Stage
    width={window.innerWidth}
    height={window.innerHeight}
    options={{ backgroundColor: 0xffffff }}
    style={{ width: '100vw', height: '100vh' }}
  >
    <AppMapInner />
  </Stage>
);

export default AppMap;

import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { useAppContext } from '../AppContext';

export const useNodes = (container, rowData, updateNodePosition, dragStateRef) => {
  const nodesRef = useRef(new Map());
  const { parentChildMap } = useAppContext();

  const createNodeGraphics = (radius = 20, color = 0x3498db) => {
    const graphics = new PIXI.Graphics();
    graphics.beginFill(color);
    graphics.drawCircle(0, 0, radius);
    graphics.endFill();
    return graphics;
  };

  const createNodeText = (label, fontSize = 12) => {
    return new PIXI.Text(label, {
      fontFamily: "Arial",
      fontSize,
      fill: 0x000000,
      align: "center",
    });
  };

  useEffect(() => {
    if (!container || !rowData || rowData.length === 0) return;

    // Clear existing nodes
    nodesRef.current.forEach((nodeContainer) => {
      container.removeChild(nodeContainer);
    });
    nodesRef.current.clear();

    // Helper to find children for a parent id
    const getChildren = (parentId) => {
      const entry = parentChildMap?.find(e => e.container_id === parentId);
      return entry?.children || [];
    };

    // Helper to find a node by id in rowData
    const getNodeById = (id) => rowData.find(r => r.id === id);

    // Recursive function to add a node and its children
    const addNode = (row, index, parentPos = null) => {
      const isChild = !!parentPos;
      const radius = isChild ? 10 : 20;
      const fontSize = isChild ? 6 : 12;
      const offsetX = isChild ? 30 : 0; // Offset child to the right of parent
      const offsetY = isChild ? 0 : 0;

      const nodeContainer = new PIXI.Container();

      // Position: if child, position relative to parent; else grid or saved position
      nodeContainer.x = parentPos
        ? parentPos.x + offsetX
        : row.position?.x ?? 100 + (index % 5) * 150;
      nodeContainer.y = parentPos
        ? parentPos.y + offsetY
        : row.position?.y ?? 100 + Math.floor(index / 5) * 100;

      nodeContainer.eventMode = "static";
      nodeContainer.cursor = "pointer";

      // Circle
      const graphics = createNodeGraphics(radius);
      nodeContainer.addChild(graphics);

      // Text
      const label = row.Name || row.id || "Unknown";
      const text = createNodeText(label, fontSize);
      text.anchor.set(0.5);
      text.y = -radius - (isChild ? 8 : 20); // Above the circle
      nodeContainer.addChild(text);

      // Drag logic (only for parent nodes)
      if (!isChild) {
        let isNodeDragging = false;
        let nodeDragOffset = null;

        const onNodeDragStart = (event) => {
          event.stopPropagation();
          isNodeDragging = true;
          dragStateRef.current.isDraggingNode = true;

          const globalPos = event.global;
          const localPos = container.toLocal(globalPos);
          nodeDragOffset = {
            x: localPos.x - nodeContainer.x,
            y: localPos.y - nodeContainer.y,
          };

          nodeContainer.alpha = 0.7;
          nodeContainer.cursor = "grabbing";
        };

        const onNodeDragMove = (event) => {
          if (!isNodeDragging || !nodeDragOffset) return;

          const globalPos = event.global;
          const localPos = container.toLocal(globalPos);

          nodeContainer.x = localPos.x - nodeDragOffset.x;
          nodeContainer.y = localPos.y - nodeDragOffset.y;
        };

        const onNodeDragEnd = () => {
          if (isNodeDragging) {
            isNodeDragging = false;
            dragStateRef.current.isDraggingNode = false;
            nodeDragOffset = null;
            nodeContainer.alpha = 1;
            nodeContainer.cursor = "pointer";

            updateNodePosition(row.id, nodeContainer.x, nodeContainer.y);
          }
        };

        const onNodeClick = () => {
          console.log(`Clicked node: ${label}`);
        };

        nodeContainer.on("pointerdown", onNodeDragStart);
        nodeContainer.on("pointermove", onNodeDragMove);
        nodeContainer.on("pointerup", onNodeDragEnd);
        nodeContainer.on("pointerupoutside", onNodeDragEnd);
        nodeContainer.on("click", onNodeClick);
      }

      container.addChild(nodeContainer);
      // Note: we don't prevent duplicate nodes in nodesRef, as per your requirement
      nodesRef.current.set(`${row.id}_${isChild ? 'child' : 'parent'}_${Math.random()}`, nodeContainer);

      // Render children from parentChildMap
      const children = getChildren(row.id);
      if (Array.isArray(children)) {
        children.forEach((child, childIdx) => {
          // If child is just an id, look up the node in rowData
          const childRow = typeof child === "object" ? child : getNodeById(child);
          if (childRow) {
            addNode(childRow, childIdx, { x: nodeContainer.x, y: nodeContainer.y });
          }
        });
      }
    };

    // Add all top-level nodes (those that are not children in parentChildMap)
    const childIds = new Set();
    parentChildMap?.forEach(entry => {
      (entry.children || []).forEach(child => childIds.add(child.id || child));
    });
    rowData.forEach((row, index) => {
      if (!childIds.has(row.id)) {
        addNode(row, index);
      }
    });

  }, [container, rowData, updateNodePosition, dragStateRef, parentChildMap]);

  console.log("parentChildMap", parentChildMap);
  console.log("rowData", rowData);

  return {
    nodes: nodesRef.current
  };
};
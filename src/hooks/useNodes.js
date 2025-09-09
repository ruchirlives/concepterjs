import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import { useAppContext } from '../AppContext';

export const useNodes = (viewport, rowData, updateNodePosition, dragStateRef, zoom = 1) => {
    const nodesRef = useRef(new Map());
    const { parentChildMap } = useAppContext();

    const createNodeGraphics = (radius = 20, color = 0x3498db) => {
        const graphics = new PIXI.Graphics();
        graphics.beginFill(color);
        graphics.drawCircle(0, 0, radius);
        graphics.endFill();
        return graphics;
    };

    const createNodeText = (label, fontSize = 12, wrapWidth = 60) => {
        return new PIXI.Text(label, {
            fontFamily: "Arial",
            fontSize,
            fill: 0x000000,
            align: "center",
            wordWrap: true,
            wordWrapWidth: wrapWidth,
        });
    };

    // Main effect: create nodes
    useEffect(() => {
        if (!viewport || !rowData || rowData.length === 0) return;

        // Remove old nodes
        nodesRef.current.forEach(nodeContainer => {
            viewport.removeChild(nodeContainer);
        });
        nodesRef.current.clear();

        // Helpers
        const getChildren = (parentId) => {
            const entry = parentChildMap?.find(e => e.container_id === parentId);
            return entry?.children || [];
        };
        const getNodeById = (id) => rowData.find(r => r.id === id);

        // Recursive node adder
        const addNode = (row, index, parentPos = null, visited = new Set()) => {
            if (visited.has(row.id)) return;
            visited.add(row.id);

            const isChild = !!parentPos;
            const baseScale = 0.5;

            const radius = (isChild ? 10 : 20) * 2;
            const fontSize = (isChild ? 4 : 12) * 2;
            const wrapWidth = (isChild ? 15 : 60) * 2;
            const offsetX = isChild ? 30 : 0;

            const nodeContainer = new PIXI.Container();
            nodeContainer.scale.set(baseScale);

            nodeContainer.x = parentPos
                ? parentPos.x + offsetX
                : row.position?.x ?? 100 + (index % 5) * 150;
            nodeContainer.y = parentPos
                ? parentPos.y
                : row.position?.y ?? 100 + Math.floor(index / 5) * 100;

            nodeContainer.eventMode = "static";
            nodeContainer.cursor = "pointer";

            // Circle
            const graphics = createNodeGraphics(radius);
            nodeContainer.addChild(graphics);

            // Label
            const label = row.name || row.Name || row.id || "Unknown";
            const text = createNodeText(label, fontSize, wrapWidth);
            text.anchor.set(0.5);
            text.y = -radius - (isChild ? 8 : 20) * 2;
            nodeContainer.addChild(text);

            // Replace Pixi v7 event system with v6:
            nodeContainer.interactive = true;
            nodeContainer.buttonMode = true;

            // Drag logic (only for parent nodes)
            let isNodeDragging = false;
            let nodeDragOffset = null;

            const onNodeDragStart = (event) => {
                event.stopPropagation();
                isNodeDragging = true;
                dragStateRef.current.isDraggingNode = true;

                // For Pixi v6, use event.data.global
                const globalPos = event.data.global;
                const localPos = viewport.toLocal(globalPos);
                nodeDragOffset = {
                    x: localPos.x - nodeContainer.x,
                    y: localPos.y - nodeContainer.y,
                };

                nodeContainer.alpha = 0.7;
                nodeContainer.cursor = "grabbing";
            };

            const onNodeDragMove = (event) => {
                if (!isNodeDragging || !nodeDragOffset) return;
                const globalPos = event.data.global;
                const localPos = viewport.toLocal(globalPos);
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

            nodeContainer.on("mousedown", onNodeDragStart);
            nodeContainer.on("mousemove", onNodeDragMove);
            nodeContainer.on("mouseup", onNodeDragEnd);
            nodeContainer.on("mouseupoutside", onNodeDragEnd);
            nodeContainer.on("touchstart", onNodeDragStart);
            nodeContainer.on("touchmove", onNodeDragMove);
            nodeContainer.on("touchend", onNodeDragEnd);
            nodeContainer.on("touchendoutside", onNodeDragEnd);
            nodeContainer.on("click", () => {
                console.log(`Clicked node: ${label}`);
            });

            viewport.addChild(nodeContainer);
            nodesRef.current.set(`${row.id}_${isChild ? 'child' : 'parent'}_${Math.random()}`, nodeContainer);

            // Render children
            const children = getChildren(row.id);
            if (Array.isArray(children)) {
                children.forEach((child, childIdx) => {
                    const childRow = typeof child === "object" ? child : getNodeById(child);
                    if (childRow) {
                        addNode(childRow, childIdx, { x: nodeContainer.x, y: nodeContainer.y }, new Set(visited));
                    }
                });
            }
        };

        // Add all top-level nodes (not children in parentChildMap)
        const childIds = new Set();
        parentChildMap?.forEach(entry => {
            (entry.children || []).forEach(child => childIds.add(child.id || child));
        });
        rowData.forEach((row, index) => {
            if (!childIds.has(row.id)) {
                addNode(row, index, null, new Set());
            }
        });

    }, [viewport, rowData, updateNodePosition, dragStateRef, parentChildMap]);

    // Effect: update label visibility on zoom
    useEffect(() => {
        nodesRef.current.forEach((nodeContainer) => {
            const textObj = nodeContainer.children.find(
                child => child instanceof PIXI.Text
            );
            if (textObj) {
                textObj.visible = zoom >= 1;
            }
        });
    }, [zoom, viewport]);

    return {
        nodes: nodesRef.current
    };
};
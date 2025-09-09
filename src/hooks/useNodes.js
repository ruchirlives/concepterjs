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
            resolution: 4, // Sharper text at high zoom
        });
    };

    // Main effect: create nodes
    useEffect(() => {
        if (!viewport || !rowData) return;

        let cancelled = false;
        const nodesMap = nodesRef.current; // Capture ref value

        const renderNodes = () => {
            if (cancelled) return;

            // Remove old nodes
            nodesMap.forEach(nodeContainer => {
                viewport.removeChild(nodeContainer);
            });
            nodesMap.clear();

            // Get visible bounds with margin
            const visibleBounds = viewport.getVisibleBounds();
            const margin = 200;
            const expandedBounds = {
                x: visibleBounds.x - margin,
                y: visibleBounds.y - margin,
                width: visibleBounds.width + margin * 2,
                height: visibleBounds.height + margin * 2,
            };

            // console.log("parentChildMap:", parentChildMap);
            // Helpers
            const getChildren = (parentId) => {
                const entry = parentChildMap?.find(e => e.container_id === parentId);
                return entry?.children || [];
            };
            const getNodeById = (id) => rowData.find(r => r.id === id);

            // Recursive node adder, now with level limit
            const addNode = (row, index, parentPos = null, level = 0) => {
                if (level > 2) return; // Only render up to grandchildren
                const isChild = level > 0;

                const getNodeColor = (level) => {
                    if (level === 0) return 0x3498db;      // Parent: blue
                    if (level === 1) return 0xe67e22;      // Child: orange
                    if (level === 2) return 0x27ae60;      // Grandchild: green
                    return 0x95a5a6;                       // Others: gray
                };

                // Parameters for scaling
                const BASE_RADIUS = 100;      // Size for level 0 (root)
                const RADIUS_SCALE = 0.2;     // Each level is 40% the size of the previous
                const BASE_FONT_SIZE = 24;    // Font size for level 0
                const FONT_SCALE = 0.1;       // Each level is 40% the font size of the previous
                const BASE_WRAP = 200;        // Wrap width for level 0
                const WRAP_SCALE = 0.5;       // Each level is 50% the wrap width of the previous

                // Calculate mathematically for each level
                const radius = Math.max(8, BASE_RADIUS * Math.pow(RADIUS_SCALE, level));
                const fontSize = Math.max(6, BASE_FONT_SIZE * Math.pow(FONT_SCALE, level));
                const wrapWidth = Math.max(16, BASE_WRAP * Math.pow(WRAP_SCALE, level));

                // For root nodes, use their own position or grid
                let nodeX = parentPos
                    ? parentPos.x
                    : row.position?.x ?? 100 + (index % 5) * 150;
                let nodeY = parentPos
                    ? parentPos.y
                    : row.position?.y ?? 100 + Math.floor(index / 5) * 100;

                // For children/grandchildren, arrange in a circle inside parent
                if (parentPos && parentPos.childCount > 1) {
                    // Calculate orbit radius so children fit inside parent
                    const orbit = Math.max(0, radius * 2, (BASE_RADIUS - radius - 4));
                    const angle = (2 * Math.PI * index) / parentPos.childCount;
                    nodeX = parentPos.x + Math.cos(angle) * orbit;
                    nodeY = parentPos.y + Math.sin(angle) * orbit;
                }

                // Only render if in expanded bounds
                if (
                    nodeX < expandedBounds.x ||
                    nodeX > expandedBounds.x + expandedBounds.width ||
                    nodeY < expandedBounds.y ||
                    nodeY > expandedBounds.y + expandedBounds.height
                ) {
                    return;
                }

                // LOD: Only render grandchildren if zoomed in
                // if (level === 2 && zoom < 1.2) return;

                const color = getNodeColor(level);

                const nodeContainer = new PIXI.Container();
                nodeContainer.x = nodeX;
                nodeContainer.y = nodeY;
                nodeContainer.interactive = true;
                nodeContainer.buttonMode = true;

                // Circle with color by level
                const graphics = createNodeGraphics(radius, color);
                nodeContainer.addChild(graphics);

                // Label
                const label = row.name || row.Name || row.id || "Unknown";
                const text = createNodeText(label, fontSize, wrapWidth);
                text.anchor.set(0.5);
                text.y = -radius - (isChild ? 8 : 20) * 2;
                nodeContainer.addChild(text);

                // Drag logic (only for parent nodes)
                let isNodeDragging = false;
                let nodeDragOffset = null;

                const onNodeDragStart = (event) => {
                    isNodeDragging = true;
                    dragStateRef.current.isDraggingNode = true;
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
                nodesMap.set(`${row.id}_${isChild ? 'child' : 'parent'}_${Math.random()}`, nodeContainer);

                // Render children (only if zoomed in enough and within level limit)
                if (level < 2) {
                    const children = getChildren(row.id);
                    children.forEach((child, childIdx) => {
                        let childRow;
                        if (typeof child === "object") {
                            childRow = child.id
                                ? child
                                : getNodeById(child.container_id); // fallback if no id, but has container_id
                        } else {
                            childRow = getNodeById(child);
                        }
                        if (childRow) {
                            addNode(
                                childRow,
                                childIdx,
                                { x: nodeContainer.x, y: nodeContainer.y, childCount: children.length },
                                level + 1
                            );
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
                    addNode(row, index, null, 0); // Start at level 0
                }
            });
        };

        renderNodes();

        // Listen for viewport move/zoom
        viewport.on("moved", renderNodes);
        viewport.on("zoomed", renderNodes);

        return () => {
            cancelled = true;
            viewport.off("moved", renderNodes);
            viewport.off("zoomed", renderNodes);
            // Clean up nodes using captured nodesMap
            nodesMap.forEach(nodeContainer => {
                viewport.removeChild(nodeContainer);
            });
            nodesMap.clear();
        };
    }, [viewport, rowData, updateNodePosition, dragStateRef, parentChildMap, zoom]);

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
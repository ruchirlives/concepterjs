import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ContextMenu, useMenuHandlers } from "./useContextMenu";
import { handleWriteBack } from "./effectsShared";
import { useAppContext } from "../AppContext";

/**
 * Hook integrating nodes rendering and dragging with an InfiniteCanvas instance.
 * @param {InfiniteCanvas} infiniteCanvas - instance returned from `new InfiniteCanvas(canvas)`
 * @param {Array} incomingNodes - array of node objects with optional { id, label, x, y }
 * @param {string} selectedLayer - (optional) filter for top-level nodes by this layer/tag
 */
export const useNodes = (infiniteCanvas, incomingNodes = [], drawUnderlay, selectedLayerRef, dragModeRef, drawUnderlayVector) => {
    const [nodes, setNodes] = useState([]);
    const selectedRef = useRef(null);
    const nodesRef = useRef(nodes);
    // Context menu state
    const [contextMenu, setContextMenu] = useState(null);

    const dragStartRef = useRef(null); // { x, y, radius }
    const rafIdRef = useRef(null);
    const pendingPosRef = useRef(null);
    const lastAppliedRef = useRef(null);
    const { parentChildMap, rowData, setRowData } = useAppContext() || {};

    // Keep refs in sync
    useEffect(() => {
        nodesRef.current = nodes;
    }, [nodes]);

    // Initialize node Positions whenever incoming list changes
    const BASE_RADIUS = 40;
    const RADIUS_SCALE = 0.3;
    const BASE_FONT_SIZE = 16;
    // Dynamically set LEVELS based on node count
    let LEVELS = 1;
    if (rowData.length < 40) LEVELS = 6;
    else if (rowData.length < 60) LEVELS = 5;
    else if (rowData.length < 80) LEVELS = 4;
    else if (rowData.length < 100) LEVELS = 3;
    else if (rowData.length < 150) LEVELS = 2;
    else LEVELS = 1;


    useEffect(() => {
        if (!incomingNodes) return;

        const safeParentChildMap = parentChildMap || [];
        // Helper: get children for a parent node
        const getChildren = (parentId) => {
            const entry = safeParentChildMap.find(e => e.container_id === parentId);
            return entry?.children || [];
        };
        // Helper: get node by id
        const getNodeById = (id) => incomingNodes.find(r => r.id === id);

        // Recursive node adder for levels
        const positioned = [];
        const addNode = (row, index, parentPos = null, level = 0, parentRadius = null) => {
            if (level > LEVELS) return; // Only render up to grandchildren

            // Color and size by level
            // Programmatic color: use HSL for visually distinct colors by level
            // Hash node id to generate a unique HSL color per node
            const getNodeColor = (level, id) => {
                // Simple hash function for string/number id
                let hash = 0;
                const str = String(id ?? "");
                for (let i = 0; i < str.length; i++) {
                    hash = str.charCodeAt(i) + ((hash << 5) - hash);
                }
                // Use hash to get hue (0-359)
                const hue = Math.abs(hash) % 360;
                const saturation = 70;
                const lightness = 70;
                return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            };

            const radius =
                level === 0 && row.MapRadius != null ? row.MapRadius
                    : parentRadius != null ? parentRadius * RADIUS_SCALE
                        : BASE_RADIUS * Math.pow(RADIUS_SCALE, level);
            const fontSize = BASE_FONT_SIZE * radius / BASE_RADIUS

            // For root nodes, use their own Position or grid
            let nodeX = parentPos
                ? parentPos.x
                : row.x ?? row.Position?.x ?? 100 + (index % 5) * 150;
            let nodeY = parentPos
                ? parentPos.y
                : row.y ?? row.Position?.y ?? 100 + Math.floor(index / 5) * 100;

            // For children/grandchildren, arrange in a circle inside parent
            if (parentPos) {
                // Orbit scales exponentially with level, just like radius
                const orbit = radius * 3;
                const angle = (2 * Math.PI * index) / parentPos.childCount;
                nodeX = parentPos.x + Math.cos(angle) * orbit;
                nodeY = parentPos.y + Math.sin(angle) * orbit;
            }

            // Label logic: prefer label, then name/Name, then id, wrapped to multiple lines
            let label = row.label || row.name || row.Name || row.id || `Node ${index}`;
            // Wrap label into lines of max 16 chars, up to 6 lines
            function wrapLabel(text, maxLen = 16, maxLines = 10) {
                if (typeof text !== "string") return [String(text)];
                const words = text.split(' ');
                const lines = [];
                let current = '';
                for (const word of words) {
                    if ((current + ' ' + word).trim().length > maxLen) {
                        if (current) lines.push(current);
                        current = word;
                        if (lines.length >= maxLines - 1) break;
                    } else {
                        current = (current + ' ' + word).trim();
                    }
                }
                if (current && lines.length < maxLines) lines.push(current);
                return lines;
            }
            const labelLines = wrapLabel(label);

            positioned.push({
                id: row.id ?? index,
                label: labelLines,
                x: nodeX,
                y: nodeY,
                color: getNodeColor(level, row.id ?? index),
                radius,
                fontSize,
                level,
                parentId: parentPos ? parentPos.id : null,
            });

            // Render children (only if within level limit)
            if (level < LEVELS) {
                const children = getChildren(row.id);
                children.forEach((child, childIdx) => {
                    let childRow;
                    if (typeof child === "object") {
                        childRow = child.id
                            ? child
                            : getNodeById(child.container_id);
                    } else {
                        childRow = getNodeById(child);
                    }
                    if (childRow) {
                        addNode(
                            childRow,
                            childIdx,
                            { x: nodeX, y: nodeY, childCount: children.length, id: row.id },
                            level + 1,
                            radius
                        );
                    }
                });
            }
        };


        // Add all top-level nodes (not children in parentChildMap) in a circular arrangement
        const childIds = new Set();
        safeParentChildMap.forEach(entry => {
            (entry.children || []).forEach(child => childIds.add(child.id || child));
        });

        let topLevelNodes;
        const selectedLayer = selectedLayerRef && selectedLayerRef.current;
        if (selectedLayer) {
            // If filtering by layer, include all nodes with the tag, regardless of child/parent status
            topLevelNodes = incomingNodes.filter(row => (row.Tags || "").split(",").map(t => t.trim()).includes(selectedLayer));
        } else {
            // Default: only nodes not children in parentChildMap
            topLevelNodes = incomingNodes.filter((row) => !childIds.has(row.id));
        }

        // Defensive: if no nodes, don't update state
        if (!topLevelNodes || topLevelNodes.length === 0) return;

        const N = topLevelNodes.length;
        // Center and radius for the circle
        const centerX = 0;
        const centerY = 0;
        // Scale radius so nodes don't overlap: base radius + extra per node
        const minSpacing = topLevelNodes.length > 0 && topLevelNodes[0].MapRadius
            ? topLevelNodes[0].MapRadius
            : BASE_RADIUS * 2.5;
        const circleRadius = Math.max(350, (N * minSpacing) / (2 * Math.PI));
        topLevelNodes.forEach((row, index) => {
            // If the node already has a Position (x/y or Position.x/Position.y), use it; otherwise, lay out in a circle
            let x = row.x;
            let y = row.y;
            if (x == null && row.Position && row.Position.x != null) x = row.Position.x;
            if (y == null && row.Position && row.Position.y != null) y = row.Position.y;
            if (x == null || y == null) {
                const angle = (2 * Math.PI * index) / N;
                x = centerX + Math.cos(angle) * circleRadius;
                y = centerY + Math.sin(angle) * circleRadius;
            }
            // Use MapRadius if present, otherwise fallback to BASE_RADIUS
            const nodeRadius = row.MapRadius != null ? row.MapRadius : BASE_RADIUS;
            addNode({ ...row, x, y, radius: nodeRadius }, index, null, 0);
        });

        setNodes(positioned);
    }, [incomingNodes, parentChildMap, LEVELS, selectedLayerRef]);

    // Drawing helpers
    const drawGrid = (ctx) => {
        ctx.strokeStyle = "#ccc";
        for (let x = -1000; x <= 1000; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, -1000);
            ctx.lineTo(x, 1000);
            ctx.stroke();
        }
        for (let y = -1000; y <= 1000; y += 50) {
            ctx.beginPath();
            ctx.moveTo(-1000, y);
            ctx.lineTo(1000, y);
            ctx.stroke();
        }
    };

    const drawNodes = (ctx) => {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        nodesRef.current.forEach((n) => {
            // Draw node circle
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.radius || 30, 0, 2 * Math.PI);
            ctx.fillStyle = n.color || "blue";
            ctx.fill();
            ctx.lineWidth = (n.radius || 30) * 0.02; // Border width scales with radius
            ctx.strokeStyle = "#222";
            ctx.stroke();
            // Draw wrapped label above node, each line stacked
            const labelFontSize = n.fontSize * 0.2;
            ctx.font = `${labelFontSize}px sans-serif`;
            ctx.fillStyle = "#000";
            const textOffset = 0;
            if (Array.isArray(n.label)) {
                const totalHeight = n.label.length * labelFontSize;
                n.label.forEach((line, i) => {
                    ctx.fillText(
                        line,
                        n.x,
                        n.y - textOffset - totalHeight / 2 + i * labelFontSize + labelFontSize / 2
                    );
                });
            } else {
                ctx.fillText(n.label, n.x, n.y - textOffset);
            }
        });
    };

    const redraw = useCallback(() => {
        if (!infiniteCanvas) return;
        const ctx = infiniteCanvas.getContext("2d");
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(-Infinity, -Infinity, Infinity, Infinity);
        ctx.restore();
        if (typeof drawUnderlay === "function") {
            drawUnderlay(ctx);
        }
        drawGrid(ctx);
        drawNodes(ctx);
    }, [infiniteCanvas, drawUnderlay]);

    // Export a bitmap of the area covering the nodes and grid contiguous to bounds
    const exportBitmap = useCallback(async ({
        scale = 5,
        padding = 100,
        bounds = { minX: -2000, maxX: 2000, minY: -2000, maxY: 2000 },
        gridStep = 50,
        snapToGrid = true,
        snapStrategy = 'expand'
    } = {}) => {
        const nodes = nodesRef.current || [];
        // Compute bounds from explicit override or nodes
        let minX, maxX, minY, maxY;
        if (bounds && typeof bounds.minX === 'number') {
            ({ minX, maxX, minY, maxY } = bounds);
        } else {
            minX = -500; maxX = 500; minY = -500; maxY = 500;
            if (nodes.length > 0) {
                minX = Math.min(...nodes.map(n => n.x - (n.radius || 30)));
                maxX = Math.max(...nodes.map(n => n.x + (n.radius || 30)));
                minY = Math.min(...nodes.map(n => n.y - (n.radius || 30)));
                maxY = Math.max(...nodes.map(n => n.y + (n.radius || 30)));
            }
            // Expand by padding
            minX -= padding; maxX += padding; minY -= padding; maxY += padding;
            // Snap bounds to grid if requested
            if (snapToGrid) {
                if (snapStrategy === 'expand') {
                    minX = Math.floor(minX / gridStep) * gridStep;
                    maxX = Math.ceil(maxX / gridStep) * gridStep;
                    minY = Math.floor(minY / gridStep) * gridStep;
                    maxY = Math.ceil(maxY / gridStep) * gridStep;
                } else {
                    // Keep size constant, shift to nearest grid
                    const width = maxX - minX;
                    const height = maxY - minY;
                    const cx = (minX + maxX) / 2;
                    const cy = (minY + maxY) / 2;
                    const snappedCx = Math.round(cx / gridStep) * gridStep;
                    const snappedCy = Math.round(cy / gridStep) * gridStep;
                    minX = snappedCx - width / 2;
                    maxX = snappedCx + width / 2;
                    minY = snappedCy - height / 2;
                    maxY = snappedCy + height / 2;
                }
            }
        }

        const worldWidth = maxX - minX;
        const worldHeight = maxY - minY;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(worldWidth * scale));
        canvas.height = Math.max(1, Math.floor(worldHeight * scale));
        const ctx = canvas.getContext('2d');
        // Improve crispness
        ctx.imageSmoothingEnabled = false;
        // Map world -> export canvas pixels
        ctx.setTransform(scale, 0, 0, scale, -minX * scale, -minY * scale);

        // Optional: white background
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        // Draw underlay (map) and grid within bounds
        if (typeof drawUnderlayVector === 'function') {
            // Prefer vector map for exports to keep it crisp
            drawUnderlayVector(ctx);
        } else if (typeof drawUnderlay === 'function') {
            drawUnderlay(ctx);
        }
        // Draw grid in export bounds
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1 / scale;
        for (let x = minX; x <= maxX; x += gridStep) {
            ctx.beginPath();
            ctx.moveTo(x, minY);
            ctx.lineTo(x, maxY);
            ctx.stroke();
        }
        for (let y = minY; y <= maxY; y += gridStep) {
            ctx.beginPath();
            ctx.moveTo(minX, y);
            ctx.lineTo(maxX, y);
            ctx.stroke();
        }

        // Draw nodes
        drawNodes(ctx);

        // Trigger download
        canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'map-export.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 'image/png');
    }, [drawUnderlay, drawUnderlayVector]);

    // Redraw whenever nodes or canvas change
    useEffect(() => {
        redraw();
    }, [infiniteCanvas, nodes, redraw]);

    // Event handling for dragging
    useEffect(() => {
        if (!infiniteCanvas) return;

        const onDown = (e) => {
            const pos = { x: e.offsetX, y: e.offsetY };
            const hit = nodesRef.current.find(
                (n) => Math.hypot(n.x - pos.x, n.y - pos.y) <= (n.radius || 30)
            );
            if (hit) {
                if (e.altKey) {
                    dragModeRef.current = 'move';
                    selectedRef.current = hit.id;
                    e.preventDefault();
                } else if (e.shiftKey) {
                    dragModeRef.current = 'scale';
                    selectedRef.current = hit.id;
                    dragStartRef.current = {
                        x: pos.x,
                        y: pos.y,
                        radius: hit.radius || 30,
                        center: { x: hit.x, y: hit.y }
                    };
                    e.preventDefault();
                } else {
                    dragModeRef.current = null;
                    selectedRef.current = null;
                }
            }
        };

        const onMove = (e) => {
            if (selectedRef.current == null || !dragModeRef.current) return;
            const pos = { x: e.offsetX, y: e.offsetY };
            pendingPosRef.current = pos;
            if (rafIdRef.current == null) {
                rafIdRef.current = requestAnimationFrame(() => {
                    const p = pendingPosRef.current;
                    rafIdRef.current = null;
                    if (!p || selectedRef.current == null || !dragModeRef.current) return;
                    if (dragModeRef.current === 'move') {
                        // avoid redundant state updates with same coords
                        const lp = lastAppliedRef.current;
                        if (!lp || lp.x !== p.x || lp.y !== p.y) {
                            setNodes((ns) =>
                                ns.map((n) =>
                                    n.id === selectedRef.current ? { ...n, x: p.x, y: p.y } : n
                                )
                            );
                            lastAppliedRef.current = { x: p.x, y: p.y };
                        }
                    } else if (dragModeRef.current === 'scale' && dragStartRef.current) {
                        const { center } = dragStartRef.current;
                        const newRadius = Math.max(10, Math.hypot(p.x - center.x, p.y - center.y));
                        if (!lastAppliedRef.current || lastAppliedRef.current.radius !== newRadius) {
                            setNodes((ns) =>
                                ns.map((n) =>
                                    n.id === selectedRef.current ? { ...n, radius: newRadius } : n
                                )
                            );
                            lastAppliedRef.current = { radius: newRadius };
                        }
                    }
                });
            }
        };

        const onUp = async () => {
            // Capture state, then immediately clear to stop dragging
            const selectedId = selectedRef.current;
            const mode = dragModeRef.current;
            selectedRef.current = null;
            dragModeRef.current = null;
            dragStartRef.current = null;
            lastAppliedRef.current = null;
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }

            // Save positions or radius back to original incomingNodes array
            let updated = false;
            if (selectedId != null) {
                const n = nodesRef.current.find(n => n.id === selectedId);
                if (n) {
                    const row = incomingNodes.find(r => r.id === n.id);
                    if (mode === 'move') {
                        if (row) {
                            row.Position = { x: n.x, y: n.y };
                        }
                        setRowData((prev) => prev.map(r => r.id === n.id ? { ...r, Position: { x: n.x, y: n.y } } : r));
                        updated = true;
                    } else if (mode === 'scale') {
                        if (row) {
                            row.MapRadius = n.radius;
                        }
                        setRowData((prev) => prev.map(r => r.id === n.id ? { ...r, MapRadius: n.radius } : r));
                        updated = true;
                    }
                }
            }
            if (updated) {
                // Persist changes to backend
                await handleWriteBack(
                    typeof rowData === 'function' ? rowData() : rowData
                );
            }
        };

        // Right-click handler for nodes
        const onContextMenu = (e) => {
            const pos = { x: e.offsetX, y: e.offsetY };
            const hit = [...nodesRef.current].reverse().find(
                (n) => Math.hypot(n.x - pos.x, n.y - pos.y) <= (n.radius || 30)
            );
            if (hit) {
                e.preventDefault();
                // Find parentId for the node (implement getParentId as needed)
                setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    cid: hit.id,
                    parentId: hit.parentId,
                });
            }
        };

        infiniteCanvas.addEventListener("mousedown", onDown);
        infiniteCanvas.addEventListener("mousemove", onMove);
        // Also listen on window so mouseup outside canvas ends dragging
        window.addEventListener("mouseup", onUp);
        infiniteCanvas.addEventListener("contextmenu", onContextMenu);

        return () => {
            infiniteCanvas.removeEventListener("mousedown", onDown);
            infiniteCanvas.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            infiniteCanvas.removeEventListener("contextmenu", onContextMenu);
        };
    }, [infiniteCanvas, incomingNodes, setRowData, dragModeRef, rowData]);


    const { handleSelect, handleRename, handleResetPositionScale, exportMenu } = useMenuHandlers({ rowData, setRowData });
    // Example menu options for demonstration
    const menuOptions = [
        {
            label: "Select Node",
            onClick: handleSelect
        },
        {
            label: "Rename Node",
            onClick: handleRename
        },
        {
            label: "ResetPositionScale",
            onClick: handleResetPositionScale
        },
        {
            label: "Export Menu",
            submenu: exportMenu
        }
    ];


    // Render ContextMenu in a portal to document.body
    const contextMenuElement = contextMenu
        ? createPortal(
            <ContextMenu
                contextMenu={contextMenu}
                setContextMenu={setContextMenu}
                menuOptions={menuOptions}
            />,
            typeof window !== "undefined" && window.document && window.document.body ? window.document.body : null
        )
        : null;

    return { nodes, setNodes, redraw, contextMenuElement, exportBitmap };
};

export default useNodes;

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppContext } from "../AppContext";

/**
 * Hook integrating nodes rendering and dragging with an InfiniteCanvas instance.
 * @param {InfiniteCanvas} infiniteCanvas - instance returned from `new InfiniteCanvas(canvas)`
 * @param {Array} incomingNodes - array of node objects with optional { id, label, x, y }
 * @param {string} selectedLayer - (optional) filter for top-level nodes by this layer/tag
 */
export const useNodes = (infiniteCanvas, incomingNodes = [], drawUnderlay, selectedLayerRef) => {
    const [nodes, setNodes] = useState([]);
    const selectedRef = useRef(null);
    const nodesRef = useRef(nodes);
    // Drag mode and drag start refs must be at the top level
    const dragModeRef = useRef(null); // 'move' or 'scale'
    const dragStartRef = useRef(null); // { x, y, radius }
    const { parentChildMap, rowData, setRowData } = useAppContext() || {};

    // Keep refs in sync
    useEffect(() => {
        nodesRef.current = nodes;
    }, [nodes]);

    // Initialize node Positions whenever incoming list changes
    const BASE_RADIUS = 40;
    const RADIUS_SCALE = 0.4;
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
        const FONT_SCALE = RADIUS_SCALE;
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
                    : parentRadius != null ? parentRadius * Math.pow(RADIUS_SCALE, level)
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
                const orbit = BASE_RADIUS * 3 * Math.pow(RADIUS_SCALE, level);
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
                level
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
                            { x: nodeX, y: nodeY, childCount: children.length },
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
            if (dragModeRef.current === 'move') {
                setNodes((ns) =>
                    ns.map((n) =>
                        n.id === selectedRef.current ? { ...n, x: pos.x, y: pos.y } : n
                    )
                );
            } else if (dragModeRef.current === 'scale' && dragStartRef.current) {
                // Calculate new radius based on distance from center
                const { center } = dragStartRef.current;
                const newRadius = Math.max(10, Math.hypot(pos.x - center.x, pos.y - center.y));
                setNodes((ns) =>
                    ns.map((n) =>
                        n.id === selectedRef.current ? { ...n, radius: newRadius } : n
                    )
                );
            }
        };

        const onUp = () => {
            // Save positions or radius back to original incomingNodes array
            if (selectedRef.current != null) {
                const n = nodesRef.current.find(n => n.id === selectedRef.current);
                if (n) {
                    const row = incomingNodes.find(r => r.id === n.id);
                    if (dragModeRef.current === 'move') {
                        if (row) {
                            row.Position = { x: n.x, y: n.y };
                        }
                        setRowData((prev) => prev.map(r => r.id === n.id ? { ...r, Position: { x: n.x, y: n.y } } : r));
                    } else if (dragModeRef.current === 'scale') {
                        if (row) {
                            row.MapRadius = n.radius;
                        }
                        setRowData((prev) => prev.map(r => r.id === n.id ? { ...r, MapRadius: n.radius } : r));
                    }
                }
            }
            selectedRef.current = null;
            dragModeRef.current = null;
            dragStartRef.current = null;
        };

        infiniteCanvas.addEventListener("mousedown", onDown);
        infiniteCanvas.addEventListener("mousemove", onMove);
        infiniteCanvas.addEventListener("mouseup", onUp);

        return () => {
            infiniteCanvas.removeEventListener("mousedown", onDown);
            infiniteCanvas.removeEventListener("mousemove", onMove);
            infiniteCanvas.removeEventListener("mouseup", onUp);
        };
    }, [infiniteCanvas, incomingNodes, setRowData]);

    return { nodes, setNodes, redraw };
};

export default useNodes;

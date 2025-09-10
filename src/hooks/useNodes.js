import { useCallback, useEffect, useRef, useState } from "react";
import { useAppContext } from "../AppContext";

/**
 * Hook integrating nodes rendering and dragging with an InfiniteCanvas instance.
 * @param {InfiniteCanvas} infiniteCanvas - instance returned from `new InfiniteCanvas(canvas)`
 * @param {Array} incomingNodes - array of node objects with optional { id, label, x, y }
 */
export const useNodes = (infiniteCanvas, incomingNodes = []) => {
    const [nodes, setNodes] = useState([]);
    const selectedRef = useRef(null);
    const nodesRef = useRef(nodes);
    const { parentChildMap } = useAppContext() || {};

    // Keep refs in sync
    useEffect(() => {
        nodesRef.current = nodes;
    }, [nodes]);

    // Initialize node positions whenever incoming list changes
    const BASE_RADIUS = 40;
    const RADIUS_SCALE = 0.4;
    const BASE_FONT_SIZE = 16;
    const LEVELS = 5; // Parent, Child, Grandchild, Great-Grandchild
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
        const addNode = (row, index, parentPos = null, level = 0) => {
            if (level > LEVELS) return; // Only render up to grandchildren

            // Color and size by level
            const getNodeColor = (level) => {
                if (level === 0) return "#3498db";      // Parent: blue
                if (level === 1) return "#e67e22";      // Child: orange
                if (level === 2) return "#27ae60";      // Grandchild: green
                return "#95a5a6";                       // Others: gray
            };

            const radius = BASE_RADIUS * Math.pow(RADIUS_SCALE, level);
            const fontSize = BASE_FONT_SIZE * Math.pow(FONT_SCALE, level);

            // For root nodes, use their own position or grid
            let nodeX = parentPos
                ? parentPos.x
                : row.x ?? row.position?.x ?? 100 + (index % 5) * 150;
            let nodeY = parentPos
                ? parentPos.y
                : row.y ?? row.position?.y ?? 100 + Math.floor(index / 5) * 100;

            // For children/grandchildren, arrange in a circle inside parent
            if (parentPos && parentPos.childCount > 1) {
                const orbit = Math.max(0, radius * 2, (BASE_RADIUS - radius - 4));
                const angle = (2 * Math.PI * index) / parentPos.childCount;
                nodeX = parentPos.x + Math.cos(angle) * orbit;
                nodeY = parentPos.y + Math.sin(angle) * orbit;
            }

            // Label logic: prefer label, then name/Name, then id, trimmed to 20 chars
            let label = row.label || row.name || row.Name || row.id || `Node ${index}`;
            if (typeof label === "string") label = label.slice(0, 40);

            positioned.push({
                id: row.id ?? index,
                label,
                x: nodeX,
                y: nodeY,
                color: getNodeColor(level),
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
                            level + 1
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
        // Find top-level nodes
        const topLevelNodes = incomingNodes.filter((row) => !childIds.has(row.id));
        const N = topLevelNodes.length;
        // Center and radius for the circle
        const centerX = 0;
        const centerY = 0;
        const circleRadius = 350;
        topLevelNodes.forEach((row, index) => {
            const angle = (2 * Math.PI * index) / N;
            const x = centerX + Math.cos(angle) * circleRadius;
            const y = centerY + Math.sin(angle) * circleRadius;
            addNode({ ...row, x, y }, index, null, 0);
        });

        setNodes(positioned);
    }, [incomingNodes, parentChildMap]);

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
            // Draw label above node in black, with smaller font and offset scaled by radius
            const labelFontSize = n.fontSize * 0.2;
            ctx.font = `${labelFontSize}px sans-serif`;
            ctx.fillStyle = "#000";
            const textOffset = (n.radius || 30) * 1.15; // Offset above node, scales with radius
            ctx.fillText(n.label, n.x, n.y - textOffset);
        });
    };

    const redraw = useCallback(() => {
        if (!infiniteCanvas) return;
        const ctx = infiniteCanvas.getContext("2d");
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(-Infinity, -Infinity, Infinity, Infinity);
        ctx.restore();
        drawGrid(ctx);
        drawNodes(ctx);
    }, [infiniteCanvas]);

    // Redraw whenever nodes or canvas change
    useEffect(() => {
        redraw();
    }, [infiniteCanvas, nodes, redraw]);

    // Event handling for dragging
    useEffect(() => {
        if (!infiniteCanvas) return;
        const canvas = infiniteCanvas.canvas;
        const ctx = infiniteCanvas.getContext("2d");

        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const inv = ctx.getTransform().invertSelf();
            const pt = new DOMPoint(x, y).matrixTransform(inv);
            return { x: pt.x, y: pt.y };
        };

        const onDown = (e) => {
            const pos = getPos(e);
            const hit = nodesRef.current.find(
                (n) => Math.hypot(n.x - pos.x, n.y - pos.y) <= (n.radius || 30)
            );
            if (hit) {
                selectedRef.current = hit.id;
            }
        };

        const onMove = (e) => {
            if (selectedRef.current == null) return;
            const pos = getPos(e);
            setNodes((ns) =>
                ns.map((n) =>
                    n.id === selectedRef.current ? { ...n, x: pos.x, y: pos.y } : n
                )
            );
        };

        const onUp = () => {
            selectedRef.current = null;
        };

        canvas.addEventListener("mousedown", onDown);
        canvas.addEventListener("mousemove", onMove);
        canvas.addEventListener("mouseup", onUp);

        return () => {
            canvas.removeEventListener("mousedown", onDown);
            canvas.removeEventListener("mousemove", onMove);
            canvas.removeEventListener("mouseup", onUp);
        };
    }, [infiniteCanvas]);

    return { nodes, setNodes, redraw };
};

export default useNodes;

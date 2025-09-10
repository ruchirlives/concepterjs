import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook integrating nodes rendering and dragging with an InfiniteCanvas instance.
 * @param {InfiniteCanvas} infiniteCanvas - instance returned from `new InfiniteCanvas(canvas)`
 * @param {Array} incomingNodes - array of node objects with optional { id, label, x, y }
 */
export const useNodes = (infiniteCanvas, incomingNodes = []) => {
    const [nodes, setNodes] = useState([]);
    const selectedRef = useRef(null);
    const nodesRef = useRef(nodes);

    // Keep refs in sync
    useEffect(() => {
        nodesRef.current = nodes;
    }, [nodes]);

    // Initialize node positions whenever incoming list changes
    useEffect(() => {
        if (!incomingNodes) return;
        const positioned = incomingNodes.map((n, idx) => {
            console.log('useNodes: node object', n);
            return {
                id: n.id ?? idx,
                label: n.label || n.Name || `Node ${idx}`,
                x: n.x ?? n.position?.x ?? 100 + idx * 80,
                y: n.y ?? n.position?.y ?? 100 + idx * 80,
            };
        });
        setNodes(positioned);
    }, [incomingNodes]);

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
        ctx.fillStyle = "blue";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.font = "16px sans-serif";
        nodesRef.current.forEach((n) => {
            ctx.beginPath();
            ctx.arc(n.x, n.y, 30, 0, 2 * Math.PI);
            ctx.fill();
            ctx.fillStyle = "white";
            ctx.fillText(n.label, n.x, n.y + 35);
            ctx.fillStyle = "blue"; // reset for next node
        });
    };

    const redraw = useCallback(() => {
        if (!infiniteCanvas) return;
        const ctx = infiniteCanvas.getContext("2d");
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
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
                (n) => Math.hypot(n.x - pos.x, n.y - pos.y) <= 30
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

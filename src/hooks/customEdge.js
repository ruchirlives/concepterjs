import React, { useState, useRef } from 'react';
import { getBezierPath, BaseEdge } from '@xyflow/react';
import { useFlowMenu } from '../components/FlowMenuContext';
import ReactDOM from 'react-dom';
import { useOnEdgeDoubleClick } from './flowEffects';

const Tooltip = ({ x, y, children }) =>
    ReactDOM.createPortal(
        <div
            style={{
                position: 'fixed',
                left: x,
                top: y + 8,
                background: '#111827',
                color: '#f9fafb',
                padding: '8px 10px',
                borderRadius: 6,
                fontSize: 12,
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                pointerEvents: 'none',
                whiteSpace: 'normal',
                zIndex: 9999,
                minWidth: 120,
                maxWidth: 240,
            }}
        >
            {children}
        </div>,
        document.body
    );

// simple hash → hue 0–359
const getHueFromString = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) % 360;
    }
    return hash;
};

const CustomEdge = ({
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition = 'right',
    targetPosition = 'left',
    style = {},
    markerEnd,
    data,
    setEdges, // <-- accept as prop
}) => {
    const { handleEdgeMenu } = useFlowMenu();
    const onEdgeDoubleClick = useOnEdgeDoubleClick(setEdges); // <-- use here

    // compute our stroke colour
    const hue = getHueFromString(source);
    const strokeColor = `hsl(${hue}, 70%, 50%)`;

    // For successor edges, add gaps at start and end
    let adjustedSourceX = sourceX;
    let adjustedSourceY = sourceY;
    let adjustedTargetX = targetX;
    let adjustedTargetY = targetY;

    if (data?.label === 'successor') {
        const sourceGapSize = 20; // pixels to gap from source end
        const targetGapSize = 20; // smaller gap at target end

        // Calculate direction vector
        const dx = targetX - sourceX;
        const dy = targetY - sourceY;
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length > (sourceGapSize + targetGapSize)) { // Only add gaps if edge is long enough
            // Normalize direction vector
            const unitX = dx / length;
            const unitY = dy / length;

            // Adjust start point (move away from source)
            adjustedSourceX = sourceX + unitX * sourceGapSize;
            adjustedSourceY = sourceY + unitY * sourceGapSize;

            // Adjust end point (move away from target) - smaller gap to minimize arrow shift
            adjustedTargetX = targetX - unitX * targetGapSize;
            adjustedTargetY = targetY - unitY * targetGapSize;
        }
    }

    // compute bezier path using adjusted positions
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX: adjustedSourceX,
        sourceY: adjustedSourceY,
        targetX: adjustedTargetX,
        targetY: adjustedTargetY,
        sourcePosition,
        targetPosition,
    });

    // hover and tooltip state for edge label
    const [hovered, setHovered] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const labelRef = useRef();
    const singleTapTimeout = useRef(null);

    const handleMouseEnter = () => {
        if (labelRef.current) {
            const rect = labelRef.current.getBoundingClientRect();
            setTooltipPos({ x: rect.left + rect.width / 2, y: rect.bottom });
        }
        setHovered(true);
    };
    const handleMouseLeave = () => setHovered(false);

    const handleLabelClick = (e) => {
        e.stopPropagation();
        // Always clear any previous timer
        if (singleTapTimeout.current) {
            clearTimeout(singleTapTimeout.current);
            singleTapTimeout.current = null;
        }
        // Set a new timer for single tap
        singleTapTimeout.current = setTimeout(() => {
            handleEdgeMenu(e, { id });
            singleTapTimeout.current = null;
        }, 250);
    };

    const handleLabelDoubleClick = (e) => {
        e.stopPropagation();
        if (singleTapTimeout.current) {
            clearTimeout(singleTapTimeout.current);
            singleTapTimeout.current = null;
        }
        if (typeof onEdgeDoubleClick === 'function') {
            // Pass the event and edge object (mimic ReactFlow's signature)
            onEdgeDoubleClick(e, { id, source, target, label: data?.fullLabel ?? data?.label });
        }
    };

    // merge with any incoming style and set stroke color
    const edgeStyle = { ...style, stroke: strokeColor };

    // Style priority: successor > influencers > dashed-group > default
    if (data?.label === 'successor') {
        edgeStyle.strokeWidth = 8;
        edgeStyle.strokeDasharray = undefined;
    } else {
        if (data?.isSourceGroup) {
            edgeStyle.strokeDasharray = '6 4';
        }
        if (data?.hasInfluencers) {
            edgeStyle.strokeWidth = 4;
        }
    }

    return (
        <>
            <BaseEdge id={id} path={edgePath} style={edgeStyle} markerEnd={markerEnd} />
            {Array.isArray(data?.influencers) && data.influencers.length > 0 && (() => {
                const influencers = data.influencers;
                const dotPositions = [];
                if (edgePath && edgePath.startsWith('M')) {
                    try {
                        const nums = edgePath
                            .replace(/[A-Za-z]/g, ' ')
                            .split(/[ ,]/)
                            .map(s => s.trim())
                            .filter(Boolean)
                            .map(parseFloat);
                        if (nums.length >= 8) {
                            const [x0, y0, x1, y1, x2, y2, x3, y3] = nums;
                            const cubicPoint = (t) => {
                                const mt = 1 - t;
                                const mt2 = mt * mt;
                                const t2 = t * t;
                                const a = mt2 * mt;
                                const b = 3 * mt2 * t;
                                const c = 3 * mt * t2;
                                const d = t * t2;
                                return { x: a * x0 + b * x1 + c * x2 + d * x3, y: a * y0 + b * y1 + c * y2 + d * y3 };
                            };
                            const n = influencers.length;
                            const startT = 0.2;
                            const endT = 0.8;
                            const step = n > 1 ? (endT - startT) / (n - 1) : 0;
                            for (let i = 0; i < n; i++) {
                                const t = n > 1 ? startT + i * step : 0.5;
                                const p = cubicPoint(t);
                                dotPositions.push({ ...p, idx: i });
                            }
                        }
                    } catch {}
                }
                const getInfluencerLabel = (inf) => {
                    if (inf == null) return '';
                    if (typeof inf === 'string') return inf;
                    if (typeof inf === 'number') return String(inf);
                    if (typeof inf === 'object') return inf.name;
                    return '';
                };
                return dotPositions.map((p) => (
                    <circle
                        key={`${id}-inf-${p.idx}`}
                        cx={p.x}
                        cy={p.y}
                        r={6}
                        fill="#111827"
                        stroke="#ffffff"
                        strokeWidth={2}
                        style={{ pointerEvents: 'auto' }}
                    >
                        <title>{getInfluencerLabel(influencers[p.idx])}</title>
                    </circle>
                ));
            })()}

            {data?.label &&
             data.label !== 'successor' &&
             data.label.trim().toLowerCase() !== 'none' && (
                <foreignObject
                    width={200}
                    height={75}
                    x={labelX - 60}
                    y={labelY - 20}
                    requiredExtensions="http://www.w3.org/1999/xhtml"
                >
                    <div
                        ref={labelRef}
                        xmlns="http://www.w3.org/1999/xhtml"
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        onClick={handleLabelClick}
                        onDoubleClick={handleLabelDoubleClick}
                        title={data?.description}
                        style={{
                            pointerEvents: 'auto',
                            background: 'transparent', // changed from '#f9fafb' to transparent
                            padding: '6px 10px',
                            fontSize: 15,
                            fontWeight: 200,
                            userSelect: 'none',
                            color: '#111827',
                            borderRadius: 6,
                            textAlign: 'center',
                            display: 'inline-block',
                            whiteSpace: 'normal',
                            boxShadow: hovered ? '0 2px 6px rgba(0,0,0,0.12)' : undefined,
                            transition: 'box-shadow 0.2s',
                            cursor: 'pointer',
                        }}
                    >
                        {data.label}
                    </div>
                </foreignObject>
            )}

            {hovered && data?.description && (
                <Tooltip x={tooltipPos.x} y={tooltipPos.y}>
                    {data.description}
                </Tooltip>
            )}
        </>
    );
};

export default CustomEdge;

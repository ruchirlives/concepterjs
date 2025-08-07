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

    if (data?.label === 'successor') {
        // thick solid style for successor relationships
        edgeStyle.strokeWidth = 8;
        // Remove strokeDasharray to make it solid
    }

    return (
        <>
            <BaseEdge id={id} path={edgePath} style={edgeStyle} markerEnd={markerEnd} />

            {data?.label && data.label !== 'successor' && (
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
                            background: '#f9fafb',
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

import React, { useState, useRef } from 'react';
import { getBezierPath, BaseEdge } from '@xyflow/react';
import ReactDOM from 'react-dom';

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
    source,            // the source node's ID
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition = 'right',
    targetPosition = 'left',
    style = {},
    markerEnd,
    data,
}) => {
    // compute our stroke colour
    const hue = getHueFromString(source);
    const strokeColor = `hsl(${hue}, 70%, 50%)`;

    // compute bezier path using default positions
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
    });

    // hover and tooltip state for edge label
    const [hovered, setHovered] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const labelRef = useRef();

    const handleMouseEnter = () => {
        if (labelRef.current) {
            const rect = labelRef.current.getBoundingClientRect();
            setTooltipPos({ x: rect.left + rect.width / 2, y: rect.bottom });
        }
        setHovered(true);
    };
    const handleMouseLeave = () => setHovered(false);

    // merge with any incoming style and set stroke color
    const edgeStyle = { ...style, stroke: strokeColor };
    if (data?.label === 'successor') {
        // thick dashed style for successor relationships
        edgeStyle.strokeWidth = 8;
        edgeStyle.strokeDasharray = '4 2';
    }

    return (
        <>
            <BaseEdge id={id} path={edgePath} style={edgeStyle} markerEnd={markerEnd} />

            {data?.label && (
                <foreignObject
                    width={200}
                    height={75}
                    x={labelX - 60}
                    y={labelY - 20}
                    requiredExtensions="http://www.w3.org/1999/xhtml"
                    style={{ pointerEvents: 'none' }}
                >
                    <div
                        ref={labelRef}
                        xmlns="http://www.w3.org/1999/xhtml"
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
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

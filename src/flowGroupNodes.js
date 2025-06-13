import React, { useState } from 'react'
import { Handle, useNodeId } from '@xyflow/react'

const shades = [
  'bg-blue-100',
  'bg-blue-200',
  'bg-blue-300',
  'bg-blue-400',
  'bg-blue-500',
];

function gradeShade(childCount) {
  // cap index so you don’t run off the end of your array
  const idx = Math.min(childCount, shades.length - 1);
  return shades[idx];
}

const GroupNode = ({ data }) => {
  const [hoveredHandle, setHoveredHandle] = useState(null)
  const [isHovered, setIsHovered] = useState(false)
  const nodeId = useNodeId()
  const { Name, Description, children = [] } = data

  // group-level handle IDs
  const groupInputId = `in-group-${nodeId}`
  const groupOutputId = `out-group-${nodeId}`

  // in GroupNode.js
  // give yourself a 15% padding at top & bottom:
  const inset = 15;
  const span = 100 - inset * 2;

  const filteredPositions = children.filter(child => child.tags?.includes('input') || child.tags?.includes('output'));

  // calculate the positions of child handles
  const childPositions = filteredPositions.map((child, idx) => ({
    top: inset + span * ((idx + 1) / (filteredPositions.length + 1)),
    id: child.id,
    label: child.name,
    tags: child.tags,
  }));

  const childInputHandles = childPositions.filter(({ tags }) => tags?.includes('input'));
  const childOutputHandles = childPositions.filter(({ tags }) => tags?.includes('output'));

  // console.log('childInputHandles', childInputHandles);
  // console.log('childOutputHandles', childOutputHandles);

  const bgClass = gradeShade(children.length);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false)
        setHoveredHandle(null)
      }}
      onDoubleClick={() => {
        if (!nodeId) return
        new BroadcastChannel('rowSelectChannel').postMessage({ nodeId })
      }}
      className={`relative group cursor-pointer rounded-2xl break-words max-w-xs text-white shadow-md ${bgClass} p-4`}
    >
      {/* group-level input handle (top left, orange) */}
      <Handle
        className="group-handle group-in opacity-0 transition-opacity group-hover:opacity-100"
        type="target"
        position="left"
        id={groupInputId}
        style={{ top: 0, left: 0, transform: 'translate(-50%, 50%)', backgroundColor: '#FF5722', cursor: 'pointer' }}
        onMouseEnter={() => setHoveredHandle(groupInputId)}
        onMouseLeave={() => setHoveredHandle(null)}
      />
      {hoveredHandle === groupInputId && (
        <div className="absolute text-xs bg-gray-800 text-white px-1 py-0.5 rounded pointer-events-none"
          style={{ top: 0, left: 0 }}>
          Group In
        </div>
      )}

      {/* group-level output handle (top right, green) */}
      <Handle
        className="group-handle group-out opacity-0 transition-opacity group-hover:opacity-100"
        type="source"
        position="right"
        id={groupOutputId}
        style={{ top: 0, right: 0, transform: 'translate(50%, 50%)', backgroundColor: '#3a9330', cursor: 'pointer' }}
        onMouseEnter={() => setHoveredHandle(groupOutputId)}
        onMouseLeave={() => setHoveredHandle(null)}
      />
      {hoveredHandle === groupOutputId && (
        <div className="absolute text-xs bg-gray-800 text-white px-1 py-0.5 rounded pointer-events-none"
          style={{ top: 0, right: 0 }}>
          Group Out
        </div>
      )}

      {/* child input handles (left side) */}
      {childInputHandles.map(({ top, id, label }) => (
        <React.Fragment key={`in-child-${id}-on-${nodeId}`}>
          <Handle
            className="group-handle group-in opacity-0 transition-opacity group-hover:opacity-100"
            type="target"
            position="left"
            id={`in-child-${id}-on-${nodeId}`}
            style={{ top: `${top}%`, cursor: 'pointer' }}
            onMouseEnter={() => setHoveredHandle(`in-child-${id}-on-${nodeId}`)}
            onMouseLeave={() => setHoveredHandle(null)}
          />
          {hoveredHandle === `in-child-${id}-on-${nodeId}` && (
            <div className="absolute text-xs bg-gray-800 text-white px-1 py-0.5 rounded pointer-events-none"
              style={{ top: `${top}%`, right: '100%', transform: 'translateY(-50%)', marginRight: '4px' }}>
              {label} (in)
            </div>
          )}
        </React.Fragment>
      ))}

      {/* child output handles (right side) */}
      {childOutputHandles.map(({ top, id, label }) => (
        <React.Fragment key={`out-child-${id}-on-${nodeId}`}>
          <Handle
            className="group-handle group-out opacity-0 transition-opacity group-hover:opacity-100"
            type="source"
            position="right"
            id={`out-child-${id}-on-${nodeId}`}
            style={{ top: `${top}%`, cursor: 'pointer' }}
            onMouseEnter={() => setHoveredHandle(`out-child-${id}-on-${nodeId}`)}
            onMouseLeave={() => setHoveredHandle(null)}
          />
          {hoveredHandle === `out-child-${id}-on-${nodeId}` && (
            <div className="absolute text-xs bg-gray-800 text-white px-1 py-0.5 rounded pointer-events-none"
              style={{ top: `${top}%`, left: '100%', transform: 'translateY(-50%)', marginLeft: '4px' }}>
              {label} (out)
            </div>
          )}
        </React.Fragment>
      ))}

      {/* main node label */}
      <div className="text-center font-medium">{Name}</div>

      {/* description tooltip on node hover */}
      {isHovered && Description && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 bg-black bg-opacity-75 text-white text-sm px-2 py-1 rounded whitespace-no-wrap pointer-events-none">
          {Description}
        </div>
      )}
    </div>
  )
}

export default GroupNode
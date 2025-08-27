import React, { useState } from 'react'
import { Handle, useNodeId } from '@xyflow/react'
import { GROUP_NODE_WIDTH } from './flowGenerateGraph'

const GroupNode = ({ data, selected }) => {
  const [hoveredHandle, setHoveredHandle] = useState(null)
  const [isHovered, setIsHovered] = useState(false)
  const nodeId = useNodeId()
  const { Name, Description, children = [] } = data

  const bgColor = selected ? 'bg-blue-200' : 'bg-blue-100'

  return (
    <div
      className="w-full h-full relative"
      style={{
        width: '100%',
        height: '100%',
        padding: 0,
        boxSizing: 'border-box',
        overflow: 'visible',
      }}
    >
      {/* Inner wrapper for rounded background and content */}
      <div
        className={`rounded-xl shadow-md ${bgColor} transition-all duration-150`}
        style={{
          width: 'calc(100% - 8px)',   // 4px margin on each side
          height: 'calc(100% - 8px)',  // 4px margin on each side
          margin: '4px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          padding: '18px 22px 14px 22px',
          boxSizing: 'border-box',
        }}
      >
        {/* Group label */}
        <div className="font-semibold text-base text-gray-800 mb-1 truncate">{Name}</div>
        {Description && isHovered && (
          <div className="absolute z-10 left-1/2 top-full mt-2 px-3 py-1 rounded bg-gray-900 text-white text-xs shadow"
            style={{ transform: 'translateX(-50%)' }}>
            {Description}
          </div>
        )}
        <div className="mt-auto text-xs text-gray-500">
          {children.length > 0 ? `${children.length} item${children.length > 1 ? 's' : ''}` : ''}
        </div>
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position="left"
        id={`in-group-${nodeId}`}
        style={{
          top: '50%',
          left: 0,
          transform: 'translate(-50%, -50%)',
          background: '#FF5722',
          border: 'none',
          width: 10,
          height: 10,
          opacity: 0.7,
          zIndex: 2,
        }}
        onMouseEnter={() => setHoveredHandle('in')}
        onMouseLeave={() => setHoveredHandle(null)}
      />
      <Handle
        type="source"
        position="right"
        id={`out-group-${nodeId}`}
        style={{
          top: '50%',
          right: 0,
          transform: 'translate(50%, -50%)',
          background: '#3a9330',
          border: 'none',
          width: 10,
          height: 10,
          opacity: 0.7,
          zIndex: 2,
        }}
        onMouseEnter={() => setHoveredHandle('out')}
        onMouseLeave={() => setHoveredHandle(null)}
      />
    </div>
  )
}

export default GroupNode
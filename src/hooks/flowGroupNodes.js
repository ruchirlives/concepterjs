import React from 'react';
import { Handle, NodeResizer, useNodeId } from '@xyflow/react';

/**
 * Simple visual representation of a group/subflow node.
 * - Shows a label and child count.
 * - Provides handles for incoming/outgoing edges.
 * - Includes a resizer so the subflow can be resized in the canvas.
 */
const GroupNode = ({ data, selected }) => {
  const nodeId = useNodeId();
  const { Name, children = [] } = data;

  const bgColor = selected ? 'bg-blue-200' : 'bg-blue-100';

  return (
    <div className="w-full h-full relative" style={{ margin: 0, padding: 0 }}>
      {/* Allows the group to be resized by the user */}
      {/* <NodeResizer
        color="#94a3b8"
        isVisible={selected}
        minWidth={200}
        minHeight={120}
      /> */}

      {/* Inner wrapper for rounded background and content */}
      <div
        className={`${bgColor} group-inner`}
        style={{
          width: '100%',
          height: '100%',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          boxSizing: 'border-box',
        }}
      >
        {/* Group label */}
        <div className="font-semibold text-base text-gray-800 truncate">{Name}</div>
        <div className="text-xs text-gray-500">
          {children.length > 0 ? `${children.length} item${children.length > 1 ? 's' : ''}` : ''}
        </div>
      </div>

      {/* Handles for connecting to other nodes */}
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
      />
    </div>
  );
};

export default GroupNode;

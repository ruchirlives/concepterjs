import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { loadNode } from '../api';

const GhostNode = ({ data }) => {
    // Double click handler
    const handleDoubleClick = async (e) => {
        console.log('Double clicked on GhostNode:', data);
        e.stopPropagation();
        if (data?.id) {
            try {
                const node = await loadNode(data.id);
                // You can handle the loaded node here, e.g., show a modal or update state
                console.log('Loaded node:', node);
            } catch (err) {
                console.error('Failed to load node:', err);
            }
        }
    };

    return (
        <div
            style={{
                padding: '8px 16px',
                background: 'none',
                border: 'none',
                borderRadius: 6,
                color: '#bbb',
                fontStyle: 'italic',
                pointerEvents: 'auto', // Allow pointer events for click
                minWidth: 80,
                textAlign: 'center',
                opacity: 0.7,
                cursor: 'pointer'
            }}
            onDoubleClick={handleDoubleClick}
            title={data?.label || 'Ghost Node'}
        >
            <Handle
                type="target"
                position={Position.Left}
                isConnectable={false}
                style={{ background: 'transparent', border: 'none' }}
            />
            {data.label || 'Ghost Node'}
        </div>
    );
};

export default GhostNode;
import React from 'react';
import { useNodeId, Handle } from '@xyflow/react';
import { useFlowMenu } from '../components/FlowMenuContext';

const FlowNode = ({ data, style, selected }) => {
  const nodeId = useNodeId();
  const { handleNodeMenu } = useFlowMenu();

  const handleDoubleClick = () => {
    console.log('Node id:', nodeId);
    const channel = new BroadcastChannel('rowSelectChannel');
    channel.postMessage({ nodeId });
    channel.close();
  };

  const handleClick = (event) => {
    console.log('Node clicked:', nodeId);
    // Check that ctrlKey is not pressed
    if (event.ctrlKey || event.shiftKey || event.altKey) {
      console.log("Ctrl key pressed, not highlighting node:", nodeId);
      return;
    }
    const channel = new BroadcastChannel('selectNodeChannel');
    channel.postMessage({ nodeId });
    channel.close();
  };

  const getBgColorClassShade = () => {
    // based on the number of parents, return a class for the background color
    const childCount = data.parents ? data.parents.length : 0;
    if (childCount === 0) return 'bg-gray-100';
    if (childCount <= 1) return 'bg-yellow-100';
    if (childCount <= 2) return 'bg-yellow-200';
    if (childCount <= 3) return 'bg-yellow-300';
    if (childCount <= 4) return 'bg-yellow-400';
    return 'bg-yellow-500';

  };

  // Get yellow shade based on normalized score value (0-1)
  const getScoreBasedYellowShade = (normalizedScore) => {
    if (normalizedScore >= 0.8) return 'bg-yellow-500';  // Highest scores - darkest yellow
    if (normalizedScore >= 0.6) return 'bg-yellow-400';  // High scores
    if (normalizedScore >= 0.4) return 'bg-yellow-300';  // Medium scores
    if (normalizedScore >= 0.2) return 'bg-yellow-200';  // Low scores
    return 'bg-yellow-100';                              // Very low scores - lightest yellow
  };

  // Background colour is purple if tagged input, beige if tagged output, and getbgcolorclassshade otherwise
  const getBgColorClass = () => {
    // If a score is available and normalization data exists, use yellow shading
    if (typeof data.score === 'number' && data.normalizedScore !== undefined) {
      return getScoreBasedYellowShade(data.normalizedScore);
    }
    
    // Fallback to highest scoring highlighting if available
    if (data.isHighestScoring) {
      return 'bg-yellow-500';
    }
    
    if (data.Tags && data.Tags.toLowerCase().includes('input')) {
      return 'bg-purple-200';
    } else if (data.Tags && data.Tags.toLowerCase().includes('output')) {
      return 'bg-green-200';
    } else {
      return getBgColorClassShade();
    }
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      onClick={handleClick}
      className={`relative cursor-pointer whitespace-normal break-words max-w-xs px-3 py-2 rounded-lg border 
        ${selected ? 'border-red-600 border-4' : 'border-gray-300'}
        ${data.highlighted ? 'bg-gray-400' : getBgColorClass()}`}
    >
      <Handle
        type="target"
        position="left"
        className="bg-gray-600 w-2.5 h-2.5"
      />

      <Handle
        type="source"
        position="right"
        className="bg-gray-600 w-2.5 h-2.5"
      />

      <button
        className="absolute top-0 right-0 text-xs bg-gray-200 rounded px-1"
        onClick={(e) => {
          e.stopPropagation();
          handleNodeMenu(e, { data: { id: data.id, selected: true } });
        }}
      >
        ⋮
      </button>

      <div>
        {data.Name}
        {/* Show score if available */}
        {data.score !== undefined && (
          <div className="text-xs text-gray-600 mt-1">
            Score: {data.score.toFixed(3)}
            {data.normalizedScore !== undefined && (
              <span className="ml-1 text-gray-500">({(data.normalizedScore * 100).toFixed(0)}%)</span>
            )}
          </div>
        )}
        {/* Show budget if available */}
        {data.Budget !== undefined && (
          <div className="text-xs text-blue-700 mt-1">
            Budget: {data.Budget}
            {data.Cost !== undefined && (
              <span className="ml-1 text-gray-500">(funds: {data.Cost})</span>
            )}
          </div>
        )}
      </div>

      {/* Description tooltip removed during drag for performance */}
    </div>
  );
};

export default React.memo(FlowNode);

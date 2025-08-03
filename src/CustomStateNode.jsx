import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useAppContext } from './AppContext';
import { applyDifferences, revertDifferences } from './api';
import toast from 'react-hot-toast';

export const CustomStateNode = ({ data }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const { diffDict, rowData } = useAppContext();

  const handleApplyDiff = async () => {
    try {
      if (!diffDict || Object.keys(diffDict).length === 0) {
        toast.error("No differences to apply");
        return;
      }

      const containerIds = rowData.map(c => c.id);
      const targetState = data.label; // The state of the node that was clicked
      await applyDifferences(containerIds, diffDict, targetState);
      toast.success(`Applied differences to ${data.label}`);
    } catch (error) {
      console.error('Failed to apply differences:', error);
      toast.error("Failed to apply differences");
    }
    setShowDropdown(false);
  };

  const handleRevertDiff = async () => {
    try {
      if (!diffDict || Object.keys(diffDict).length === 0) {
        toast.error("No differences to revert");
        return;
      }

      const containerIds = rowData.map(c => c.id);
      const targetState = data.label; // The state of the node that was clicked
      await revertDifferences(containerIds, diffDict, targetState);
      toast.success(`Reverted differences from ${data.label}`);
    } catch (error) {
      console.error('Failed to revert differences:', error);
      toast.error("Failed to revert differences");
    }
    setShowDropdown(false);
  };

  return (
    <div className="relative">
      <div
        className={`px-4 py-2 shadow-md rounded-md border-2 min-w-[120px] text-center ${
          data.isTarget
            ? 'bg-blue-100 border-blue-500 text-blue-900'
            : 'bg-white border-gray-300 text-gray-700'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="font-medium">{data.label}</span>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="ml-2 text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            ⋮
          </button>
        </div>
        
        {/* Dropdown Menu */}
        {showDropdown && (
          <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-[120px]">
            <button
              onClick={handleApplyDiff}
              className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 border-b border-gray-100"
            >
              Apply Diff
            </button>
            <button
              onClick={handleRevertDiff}
              className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              Revert Diff
            </button>
          </div>
        )}
      </div>

      {/* React Flow Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-16 !bg-teal-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-16 !bg-teal-500"
      />
      
      {/* Click outside to close dropdown */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
};

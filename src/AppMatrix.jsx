import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { getPosition, setPosition } from './api';

const AppMatrix = () => {
  const [rowData, setRowData] = useState([]);
  const [relationships, setRelationships] = useState({});
  const [loading, setLoading] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const inputRef = useRef(null);

  // Listen for row data updates from other components
  useEffect(() => {
    const channel = new BroadcastChannel('tagSelectChannel');
    channel.onmessage = (event) => {
      const { tagFilter } = event.data;
      console.log('Matrix received filtered data:', tagFilter);
      setRowData(tagFilter || []);
    };
    return () => channel.close();
  }, []);

  // Memoize the loadRelationships function
  const loadRelationships = useCallback(async () => {
    if (rowData.length === 0) return;
    
    setLoading(true);
    const newRelationships = {};
    
    for (let i = 0; i < rowData.length; i++) {
      for (let j = 0; j < rowData.length; j++) {
        if (i !== j) {
          const sourceId = rowData[i].id;
          const targetId = rowData[j].id;
          const key = `${sourceId}-${targetId}`;
          
          try {
            const relationship = await getPosition(sourceId, targetId);
            newRelationships[key] = relationship || '';
          } catch (error) {
            console.error(`Error loading relationship ${sourceId}-${targetId}:`, error);
            newRelationships[key] = '';
          }
        }
      }
    }
    
    setRelationships(newRelationships);
    setLoading(false);
  }, [rowData]);

  // Load existing relationships when rowData changes
  useEffect(() => {
    loadRelationships();
  }, [loadRelationships]);

  // Memoize event handlers
  const handleCellClick = useCallback((sourceId, targetId) => {
    if (sourceId === targetId) return;
    
    const key = `${sourceId}-${targetId}`;
    setEditingCell({ sourceId, targetId, key });
  }, []);

  const handleCellSubmit = useCallback(async (value) => {
    if (!editingCell) return;
    
    const { sourceId, targetId, key } = editingCell;
    
    try {
      await setPosition(sourceId, targetId, value);
      setRelationships(prev => ({
        ...prev,
        [key]: value
      }));
    } catch (error) {
      console.error('Error saving relationship:', error);
    }
    
    setEditingCell(null);
  }, [editingCell]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleCellSubmit(e.target.value);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  }, [handleCellSubmit]);

  const handleBlur = useCallback((e) => {
    handleCellSubmit(e.target.value);
  }, [handleCellSubmit]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Memoize the MatrixCell component to prevent unnecessary re-renders
  const MatrixCell = useMemo(() => {
    return React.memo(({ sourceId, targetId, isHeader = false, children }) => {
      const key = `${sourceId}-${targetId}`;
      const isEditing = editingCell?.key === key;
      const value = relationships[key] || '';
      const isDiagonal = sourceId === targetId;
      
      if (isHeader) {
        return (
          <th className="p-2 bg-gray-100 border border-gray-300 text-xs font-medium text-center min-w-[100px] max-w-[100px] truncate">
            {children}
          </th>
        );
      }

      if (isDiagonal) {
        return (
          <td className="p-2 bg-gray-200 border border-gray-300 text-center min-w-[100px] max-w-[100px]">
            —
          </td>
        );
      }

      return (
        <td 
          className="p-1 border border-gray-300 text-center min-w-[100px] max-w-[100px] cursor-pointer hover:bg-gray-50"
          onClick={() => handleCellClick(sourceId, targetId)}
        >
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              defaultValue={value}
              className="w-full px-1 py-0 text-xs border-0 outline-none bg-white"
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
            />
          ) : (
            <span className="text-xs block truncate" title={value}>
              {value || '—'}
            </span>
          )}
        </td>
      );
    });
  }, [editingCell, relationships, handleCellClick, handleKeyDown, handleBlur]);

  // Memoize the empty state component
  const EmptyState = useMemo(() => (
    <div className="bg-white rounded shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <span className="font-semibold">Relationship Matrix</span>
        <button
          className="text-lg font-bold"
          onClick={() => setCollapsed(c => !c)}
        >
          {collapsed ? "▼" : "▲"}
        </button>
      </div>
      {!collapsed && (
        <div className="text-gray-500 text-center py-8">
          No data available. Filter containers in the grid above to populate the matrix.
        </div>
      )}
    </div>
  ), [collapsed]);

  if (rowData.length === 0) {
    return EmptyState;
  }

  return (
    <div className="bg-white rounded shadow">
      {/* Header with collapse button */}
      <div className="flex justify-between items-center bg-white text-black px-4 py-2 cursor-pointer select-none">
        <span className="font-semibold">
          Relationship Matrix ({rowData.length} containers)
        </span>
        <button
          className="text-lg font-bold"
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? "Expand matrix" : "Collapse matrix"}
        >
          {collapsed ? "▼" : "▲"}
        </button>
      </div>

      {/* Matrix content */}
      <div
        className={`transition-all duration-300 overflow-hidden`}
        style={{ height: collapsed ? 0 : 400 }}
      >
        <div className="p-4 h-full overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-500">Loading relationships...</div>
            </div>
          ) : (
            <div className="overflow-auto border border-gray-300">
              <table className="border-collapse">
                <thead>
                  <tr>
                    <MatrixCell isHeader>
                      <div className="w-0 h-0 border-l-[50px] border-l-transparent border-b-[30px] border-b-gray-400 relative">
                        <span className="absolute -bottom-6 -left-12 text-xs">From</span>
                        <span className="absolute -bottom-2 left-2 text-xs">To</span>
                      </div>
                    </MatrixCell>
                    {rowData.map(container => (
                      <MatrixCell key={container.id} isHeader>
                        <div title={container.Name}>{container.Name}</div>
                        <div className="text-gray-500">({container.id})</div>
                      </MatrixCell>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowData.map(sourceContainer => (
                    <tr key={sourceContainer.id}>
                      <MatrixCell isHeader>
                        <div title={sourceContainer.Name}>{sourceContainer.Name}</div>
                        <div className="text-gray-500">({sourceContainer.id})</div>
                      </MatrixCell>
                      {rowData.map(targetContainer => (
                        <MatrixCell
                          key={`${sourceContainer.id}-${targetContainer.id}`}
                          sourceId={sourceContainer.id}
                          targetId={targetContainer.id}
                        />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {!loading && (
            <div className="mt-4 text-sm text-gray-600">
              <p>• Click on any cell to edit the relationship</p>
              <p>• Press Enter to save, Escape to cancel</p>
              <p>• Diagonal cells (same container) are disabled</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppMatrix;
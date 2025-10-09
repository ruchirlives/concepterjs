import React, { useState } from 'react';
import { useLayerDropdown } from '../hooks/useLayerDropdown';
import { useAppContext } from '../AppContext';

const LayerDropdown = ({ 
  className = '',
  buttonText = 'Layers',
  title = 'Filter layers',
  dropdownTitle = 'Hide Layers'
}) => {
  const { addLayer } = useAppContext();
  const {
    layerDropdownOpen,
    setLayerDropdownOpen,
    hiddenLayers,
    toggleLayerVisibility,
    showAllLayers,
    layerOptions,
    reorderLayers,
  } = useLayerDropdown();

  const [newLayer, setNewLayer] = useState("");
  const UNTAGGED_KEY = '__UNTAGGED__';

  const handleAdd = () => {
    const name = newLayer.trim();
    if (!name) return;
    addLayer(name);
    setNewLayer("");
  };

  const moveLayer = (layer, direction) => {
    const idx = layerOptions.indexOf(layer);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= layerOptions.length) return;
    const next = [...layerOptions];
    const [removed] = next.splice(idx, 1);
    next.splice(newIdx, 0, removed);
    reorderLayers(next);
  };

  return (
    <div className={`relative layer-dropdown ${className}`}>
      <button
        onClick={() => setLayerDropdownOpen(!layerDropdownOpen)}
        className={`px-3 py-1 text-xs rounded ${
          hiddenLayers.size > 0
            ? "bg-yellow-500 text-white hover:bg-orange-600"
            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
        }`}
        title={title}
      >
        {(() => { const hiddenReal = Array.from(hiddenLayers).filter(l => layerOptions.includes(l)).length; return (<>{buttonText} {layerOptions.length > 0 ? `(${layerOptions.length - hiddenReal}/${layerOptions.length})` : ''}</>); })()}
      </button>

      {layerDropdownOpen && (
        <div 
          className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-[9999] min-w-48"
          style={{ zIndex: 9999 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Add layer inline controls */}
          <div className="p-2 border-b border-gray-200 flex items-center gap-2">
            <input
              type="text"
              value={newLayer}
              onChange={(e) => setNewLayer(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              placeholder="New layer name"
              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
            />
            <button
              onClick={handleAdd}
              className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
              title="Add layer"
            >
              Add
            </button>
          </div>
          <div className="p-2 border-b border-gray-200 text-xs font-medium text-gray-600">
            {dropdownTitle}
          </div>
          <div className="max-h-60 overflow-y-auto">              {/* Special option: Untagged */}
              <div
                className="flex items-center justify-between gap-2 p-2 hover:bg-gray-50 text-sm relative"
                style={{ zIndex: 9999 }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <label className="flex items-center gap-2 cursor-pointer" onMouseDown={(e)=>e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={!hiddenLayers.has(UNTAGGED_KEY)}
                    onChange={() => toggleLayerVisibility(UNTAGGED_KEY)}
                    className="rounded border-gray-300"
                  />
                  <span className={hiddenLayers.has(UNTAGGED_KEY) ? 'line-through text-red-500' : 'text-gray-900'}>
                    Untagged
                  </span>
                </label>
              </div>
              {layerOptions.length === 0 ? (
                <div className="p-3 text-xs text-gray-500">No layers available</div>
              ) : (
              layerOptions.map((layer, i) => (
                <div
                  key={layer}
                  className="flex items-center justify-between gap-2 p-2 hover:bg-gray-50 text-sm relative"
                  style={{ zIndex: 9999 }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <label className="flex items-center gap-2 cursor-pointer" onMouseDown={(e)=>e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={!hiddenLayers.has(layer)}
                      onChange={() => toggleLayerVisibility(layer)}
                      className="rounded border-gray-300"
                    />
                    <span className={hiddenLayers.has(layer) ? 'line-through text-red-500' : 'text-gray-900'}>
                      {layer}
                    </span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      className="px-1 py-0.5 text-xs border rounded disabled:opacity-40"
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); moveLayer(layer, 'up'); }}
                      disabled={i === 0}
                      title="Move up"
                    >↑</button>
                    <button
                      className="px-1 py-0.5 text-xs border rounded disabled:opacity-40"
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); moveLayer(layer, 'down'); }}
                      disabled={i === layerOptions.length - 1}
                      title="Move down"
                    >↓</button>
                  </div>
                </div>
              ))
              )}
            </div>
          {layerOptions.length > 0 && hiddenLayers.size < layerOptions.length && (
            <div className="p-2 border-t border-gray-200">
              <button
                onMouseDown={(e) => {
                  e.stopPropagation();
                  // Hide all layers
                  layerOptions.forEach(layer => {
                    if (!hiddenLayers.has(layer)) toggleLayerVisibility(layer);
                  });
                }}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Hide All Layers
              </button>
            </div>
          )}
          {hiddenLayers.size > 0 && (
            <div className="p-2 border-t border-gray-200">
              <button
                onMouseDown={(e) => {
                  e.stopPropagation();
                  showAllLayers();
                }}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Show All Layers
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LayerDropdown;



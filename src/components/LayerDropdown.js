import React from 'react';
import { useLayerDropdown } from '../hooks/useLayerDropdown';

const LayerDropdown = ({ 
  className = '',
  buttonText = 'Layers',
  title = 'Filter layers',
  dropdownTitle = 'Hide Layers'
}) => {
  const {
    layerDropdownOpen,
    setLayerDropdownOpen,
    hiddenLayers,
    toggleLayerVisibility,
    showAllLayers,
    layerOptions,
  } = useLayerDropdown();

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
        {buttonText} {layerOptions.length > 0 && `(${layerOptions.length - hiddenLayers.size}/${layerOptions.length})`}
      </button>

      {layerDropdownOpen && (
        <div 
          className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-[9999] min-w-48"
          style={{ zIndex: 9999 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-2 border-b border-gray-200 text-xs font-medium text-gray-600">
            {dropdownTitle}
          </div>
          <div className="max-h-60 overflow-y-auto">
            {layerOptions.length === 0 ? (
              <div className="p-3 text-xs text-gray-500">No layers available</div>
            ) : (
              layerOptions.map((layer) => (
                <div
                  key={layer}
                  className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer text-sm relative"
                  style={{ zIndex: 9999 }}
                  onMouseDown={(e) => {
                    console.log('MouseDown fired for layer:', layer);
                    e.preventDefault();
                    e.stopPropagation();
                    toggleLayerVisibility(layer);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!hiddenLayers.has(layer)}
                    readOnly
                    className="rounded border-gray-300 pointer-events-none"
                  />
                  <span className={hiddenLayers.has(layer) ? 'line-through text-red-500' : 'text-gray-900'}>
                    {layer}
                  </span>
                </div>
              ))
            )}
          </div>
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
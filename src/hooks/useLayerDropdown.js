import { useCallback, useEffect } from 'react';
import { useAppContext } from '../AppContext';

export const useLayerDropdown = () => {
  const {
    layerDropdownOpen,
    setLayerDropdownOpen,
    hiddenLayers,
    setHiddenLayers,
    layerOptions,
    setLayerOptions
  } = useAppContext();

  // Toggle layer visibility
  const toggleLayerVisibility = useCallback((layer) => {
    // console.log('Toggling layer:', layer);
    setHiddenLayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(layer)) {
        newSet.delete(layer);
        console.log('Showing layer:', layer);
      } else {
        newSet.add(layer);
        console.log('Hiding layer:', layer);
      }
      // console.log('Hidden layers:', [...newSet]);
      return newSet;
    });
  }, [setHiddenLayers]);

  // Show all layers
  const showAllLayers = useCallback(() => {
    setHiddenLayers(new Set());
  }, [setHiddenLayers]);

  // Reorder layers by providing a new array order
  const reorderLayers = useCallback((newOrder) => {
    setLayerOptions(Array.isArray(newOrder) ? [...newOrder] : []);
  }, [setLayerOptions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (layerDropdownOpen && !event.target.closest('.layer-dropdown')) {
        setLayerDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [layerDropdownOpen, setLayerDropdownOpen]);

  return {
    layerDropdownOpen,
    setLayerDropdownOpen,
    hiddenLayers,
    setHiddenLayers,
    toggleLayerVisibility,
    showAllLayers,
    layerOptions,
    reorderLayers,
  };
};

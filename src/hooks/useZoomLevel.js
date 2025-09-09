import { useEffect, useState } from 'react';

// Hook to track the current zoom level of the viewport
export default function useZoomLevel(viewportRef) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateZoom = () => setZoom(viewport.scale.x);

    viewport.on('zoomed', updateZoom);
    updateZoom();

    return () => {
      viewport.off('zoomed', updateZoom);
    };
  }, [viewportRef]);

  return zoom;
}

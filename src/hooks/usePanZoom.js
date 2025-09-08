import { useEffect, useRef } from 'react';

export const usePanZoom = (app, container, dragStateRef) => {
  const panStateRef = useRef({
    isPanning: false,
    lastPosition: null
  });

  useEffect(() => {
    if (!app || !container) return;

    const canvas = app.view;

    const startPan = (event) => {
      if (dragStateRef.current.isDraggingNode) return;

      panStateRef.current.isPanning = true;
      panStateRef.current.lastPosition = { x: event.clientX, y: event.clientY };
      canvas.style.cursor = "grabbing";
    };

    const doPan = (event) => {
      const { isPanning, lastPosition } = panStateRef.current;
      if (!isPanning || !lastPosition || dragStateRef.current.isDraggingNode) return;

      const deltaX = event.clientX - lastPosition.x;
      const deltaY = event.clientY - lastPosition.y;

      container.x += deltaX;
      container.y += deltaY;

      panStateRef.current.lastPosition = { x: event.clientX, y: event.clientY };
    };

    const endPan = () => {
      if (panStateRef.current.isPanning) {
        panStateRef.current.isPanning = false;
        panStateRef.current.lastPosition = null;
        canvas.style.cursor = "grab";
      }
    };

    const doZoom = (event) => {
      event.preventDefault();

      const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const newScale = container.scale.x * scaleFactor;

      if (newScale < 0.1 || newScale > 5) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      const beforeScale = container.scale.x;
      container.scale.set(newScale);

      const afterScale = container.scale.x;
      const scaleChange = (afterScale - beforeScale) / beforeScale;

      container.x -= (mouseX - container.x) * scaleChange;
      container.y -= (mouseY - container.y) * scaleChange;

    //   console.log(`Zoom level: ${newScale.toFixed(2)}`);
    };

    canvas.style.cursor = "grab";
    canvas.addEventListener("mousedown", startPan);
    window.addEventListener("mousemove", doPan);
    window.addEventListener("mouseup", endPan);
    canvas.addEventListener("wheel", doZoom, { passive: false });

    return () => {
      canvas.removeEventListener("mousedown", startPan);
      window.removeEventListener("mousemove", doPan);
      window.removeEventListener("mouseup", endPan);
      canvas.removeEventListener("wheel", doZoom);
    };
  }, [app, container, dragStateRef]);
};
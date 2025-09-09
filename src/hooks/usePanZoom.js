import { useEffect } from 'react';

export const usePanZoom = (app, viewport, dragStateRef) => {
    useEffect(() => {
        if (!app || !viewport) return;

        // Add viewport to the stage if not already added
        if (!app.stage.children.includes(viewport)) {
            app.stage.addChild(viewport);
        }

        // Enable drag, pinch, and wheel zoom
        viewport
            .drag()
            .pinch()
            .wheel()
            .decelerate();

        // Optionally, you can disable drag when dragging a node
        const handleDragStart = () => {
            if (dragStateRef.current.isDraggingNode) {
                viewport.plugins.pause('drag');
            }
        };
        const handleDragEnd = () => {
            viewport.plugins.resume('drag');
        };

        window.addEventListener('pointerdown', handleDragStart);
        window.addEventListener('pointerup', handleDragEnd);

        return () => {
            window.removeEventListener('pointerdown', handleDragStart);
            window.removeEventListener('pointerup', handleDragEnd);
            if (app.stage.children.includes(viewport)) {
                app.stage.removeChild(viewport);
            }
        };
    }, [app, viewport, dragStateRef]);
};
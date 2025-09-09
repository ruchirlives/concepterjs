import { useEffect } from "react";

export const usePanZoom = (app, viewport, dragStateRef) => {
    useEffect(() => {
        if (!app || !viewport) return;

        viewport
            .drag()
            .pinch()
            .wheel({
                divWheel: app.view,
            })
            .decelerate();

        // Force wheel events inside the canvas to never bubble to page scroll
        const stopScroll = (e) => e.preventDefault();
        app.view.addEventListener("wheel", stopScroll, { passive: false });

        const handleDragStart = () => {
            if (dragStateRef.current.isDraggingNode) {
                viewport.plugins.pause("drag");
            }
        };
        const handleDragEnd = () => {
            viewport.plugins.resume("drag");
        };

        app.view.addEventListener("pointerdown", handleDragStart);
        app.view.addEventListener("pointerup", handleDragEnd);

        return () => {
            app.view.removeEventListener("wheel", stopScroll);
            app.view.removeEventListener("pointerdown", handleDragStart);
            app.view.removeEventListener("pointerup", handleDragEnd);
        };
    }, [app, viewport, dragStateRef]);
};

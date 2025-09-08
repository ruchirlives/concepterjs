import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';

export const usePixiApp = (canvasRef, hasData) => {
    const appRef = useRef();
    const containerRef = useRef();
    const isInitializedRef = useRef(false);

    useEffect(() => {
        if (!canvasRef.current || !hasData || isInitializedRef.current) return;

        console.log("Initializing PIXI Application");

        // Create PIXI app
        const app = new PIXI.Application({
            width: window.innerWidth,
            height: window.innerHeight,
            backgroundColor: 0xffffff,
        });

        canvasRef.current.appendChild(app.view);
        appRef.current = app;

        // Create main container for all nodes
        const nodesContainer = new PIXI.Container();
        app.stage.addChild(nodesContainer);
        containerRef.current = nodesContainer;

        isInitializedRef.current = true;
        console.log("PIXI app initialized");

        return () => {
            console.log("Cleaning up PIXI app");
            if (appRef.current && !appRef.current.destroyed) {
                appRef.current.destroy(true, true);
            }
            appRef.current = null;
            containerRef.current = null;
            isInitializedRef.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasData]);

    return {
        app: appRef.current,
        container: containerRef.current,
        isInitialized: isInitializedRef.current
    };
};
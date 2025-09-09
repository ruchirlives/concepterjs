import { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';

export const usePixiApp = (canvasRef, hasData) => {
    const appRef = useRef();
    useEffect(() => {
        if (!canvasRef.current || !hasData || appRef.current) return;

        const app = new PIXI.Application({
            width: window.innerWidth,
            height: window.innerHeight,
            backgroundColor: 0xffffff,
        });

        canvasRef.current.appendChild(app.view);
        appRef.current = app;

        return () => {
            if (appRef.current && !appRef.current.destroyed) {
                appRef.current.destroy(true, true);
            }
            appRef.current = null;
        };
    }, [canvasRef, hasData]);

    return { app: appRef.current };
};
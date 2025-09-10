// hooks/useBackdropMap.js
import { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath, geoCentroid } from "d3-geo";
import { feature } from "topojson-client";


/**
 * Loads a GeoJSON and returns a draw function that renders it
 * onto an InfiniteCanvas' 2D context.
 *
 * World coordinates: centered at (0,0) so it plays nicely with InfiniteCanvas.
 */
export function useBackdropMap(geojsonUrl) {
    const [data, setData] = useState(null);
    const projectionRef = useRef(null);
    const pathRef = useRef(null);
    const offscreenRef = useRef(null);

    useEffect(() => {
        async function load() {
            const res = await fetch(geojsonUrl);
            const topo = await res.json();
            // Convert the object you want (e.g. "lad") into GeoJSON
            const geo = feature(topo, topo.objects.lad);
            setData(geo);
        }
        if (geojsonUrl) load();
    }, [geojsonUrl]);

    // Build projection centered at 0,0 and scaled to a reasonable size.
    useEffect(() => {
        if (!data) return;

        // Step 1: start with a fitSize to get reasonable scale
        const projection = geoMercator().fitSize([1200, 1200], data);

        // Step 2: find the centroid of Scotland in projected coords
        const centroid = geoCentroid(data);   // [lon, lat] in degrees
        const projected = projection(centroid); // projected [x, y]

        // Step 3: shift so centroid → (0,0)
        const currentTranslate = projection.translate();
        projection.translate([
            currentTranslate[0] - projected[0],
            currentTranslate[1] - projected[1]
        ]);

        projectionRef.current = projection;
        pathRef.current = geoPath(projection);

        // --- Offscreen canvas caching ---
        const OFF_W = 2000, OFF_H = 2000;
        const offscreen = document.createElement("canvas");
        offscreen.width = OFF_W;
        offscreen.height = OFF_H;
        const offCtx = offscreen.getContext("2d");
        offCtx.save();
        // Center the map in the offscreen canvas
        offCtx.translate(OFF_W / 2, OFF_H / 2);
        offCtx.lineWidth = 1;
        offCtx.strokeStyle = "#6b7280";
        offCtx.fillStyle = "#e5e7eb";
        const path = geoPath(projection).context(offCtx);
        path(data);
        offCtx.fill();
        offCtx.stroke();
        offCtx.restore();
        offscreenRef.current = offscreen;
    }, [data]);


    const drawMap = useMemo(() => {
        return (ctx) => {
            if (offscreenRef.current) {
                // Blit cached map, centered at (0,0)
                ctx.save();
                ctx.drawImage(
                    offscreenRef.current,
                    -offscreenRef.current.width / 2,
                    -offscreenRef.current.height / 2
                );
                ctx.restore();
                return;
            }
            // Fallback: draw directly if cache not ready
            if (!data || !pathRef.current) return;
            ctx.save();
            ctx.lineWidth = 1;
            ctx.strokeStyle = "#6b7280";
            ctx.fillStyle = "#e5e7eb";
            const path = pathRef.current.context(ctx);
            path(data);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        };
    }, [data]);

    return { drawMap, isLoaded: !!data };
}

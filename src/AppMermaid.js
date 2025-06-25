import React, { useEffect, useState, useRef } from "react";
// import "./mermaidstyles.css";
import mermaid from "mermaid";

// Shared render function
const renderMermaidCode = async (code, container, id = "graphDiv") => {
    if (!container || !code) return;

    mermaid.initialize({
        startOnLoad: true,
        securityLevel: "loose",
        theme: "forest",
    });

    const { svg } = await mermaid.render(id, code);

    if (code.startsWith("gantt")) {
        console.log("Gantt diagram detected, enhancing SVG.");
        const svgEnhanced = enhanceSVG(svg);
        container.innerHTML = "";
        container.appendChild(svgEnhanced);
    } else {
        console.log("Regular diagram detected, enhancing SVG.");
        container.innerHTML = svg;
    }
};


const enhanceSVG = (svgString) => {
    // Convert the SVG string to a DOM document
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const svgElement = doc.documentElement;

    // Ensure the xlink namespace is declared on the root <svg> element
    if (!svgElement.hasAttribute("xmlns:xlink")) {
        svgElement.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    }

    // Find all rect elements and add a click event listener
    const rects = svgElement.querySelectorAll("rect");
    rects.forEach((rect) => {
        rect.addEventListener("click", () => {
            console.log("Rectangle clicked:", rect);
            // Send a message to the BroadcastChannel with the rectangle's ID
            const channelGrid = new BroadcastChannel("rowSelectChannel");
            channelGrid.postMessage({
                nodeId: rect.id,
            });
            const channelFlow = new BroadcastChannel("selectNodeChannel");
            channelFlow.postMessage({
                nodeId: rect.id,
            });
            // close the channel after sending the message
            channelGrid.close();
            channelFlow.close();
        });
        console.log("Rectangle:", rect);
    });

    // Return the live SVG element rather than a string
    return svgElement;
};

function AppMermaid() {
    const initialCode =
        `graph LR
    A-->B
    `;
    const [mermaidCode, setMermaidCode] = useState(initialCode);
    console.log("Initial mermaid code:", mermaidCode);
    const containerRef = useRef(null);

    // Define the global callback function
    useEffect(() => {
        window.callback = (x) => {
            console.log("Callback function called with:", x);
            // Send a message to the BroadcastChannel with the mermaid code
            const channel = new BroadcastChannel("rowSelectChannel");
            channel.postMessage({
                nodeId: x,
            });
            const channelFlow = new BroadcastChannel("selectNodeChannel");
            channelFlow.postMessage({
                nodeId: x,
            });

        };
    }, []);

    // Listen for updates via a BroadcastChannel and update mermaidCode state
    useEffect(() => {
        const channel = new BroadcastChannel("mermaidChannel");
        channel.onmessage = (event) => {
            console.log("Received message from channel:", event.data);
            // Define a theme configuration as a front-matter block
            setMermaidCode(event.data.mermaidCode);
        };
        return () => {
            channel.close();
        };
    }, []);

    // Render the mermaid diagram using Mermaid's API


    useEffect(() => {
        renderMermaidCode(initialCode, containerRef.current, "graphDivInit");
    }, [initialCode]);

    // useEffect(() => {
    //     renderMermaidCode(mermaidCode, containerRef.current);
    // }, [mermaidCode]);

    useEffect(() => {
        if (mermaidCode && !mermaidCode.includes("Container not found")) {
            renderMermaidCode(mermaidCode, containerRef.current);
        } else {
            console.warn("Invalid mermaid code received:", mermaidCode);
        }
    }, [mermaidCode]);

    return (
        <div className="App">
            {/* This container will receive the rendered SVG */}
            <div ref={containerRef} />
        </div>
    );
}

export default AppMermaid;
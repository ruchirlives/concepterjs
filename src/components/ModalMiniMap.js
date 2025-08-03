import React, { useState } from "react";

const MiniMap = ({ data, onAddRow, title }) => {
    const [position, setPosition] = useState({ x: 400, y: 10 }); // Initial position
    const [dragging, setDragging] = useState(false); // Track dragging state
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 }); // Initial touch/click position

    // Handle touch/mouse start
    const handleDragStart = (e) => {
        e.preventDefault();
        setDragging(true);

        const startX = e.touches ? e.touches[0].clientX : e.clientX;
        const startY = e.touches ? e.touches[0].clientY : e.clientY;

        setDragStart({ x: startX, y: startY });
    };

    // Handle touch/mouse move
    const handleDragMove = (e) => {
        if (!dragging) return;

        const currentX = e.touches ? e.touches[0].clientX : e.clientX;
        const currentY = e.touches ? e.touches[0].clientY : e.clientY;

        const deltaX = currentX - dragStart.x;
        const deltaY = currentY - dragStart.y;

        setPosition((prev) => ({
            x: prev.x + deltaX,
            y: prev.y + deltaY,
        }));

        setDragStart({ x: currentX, y: currentY });
    };

    // Handle touch/mouse end
    const handleDragEnd = () => {
        setDragging(false);
    };

    return (
        <div
            style={{
                position: "fixed",
                top: position.y,
                left: position.x,
                width: "150px",
                background: "white",
                fontSize: "7pt",
                border: "1px solid #ccc",
                borderRadius: "8px",
                boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
                padding: "10px",
                zIndex: 1000,
                touchAction: "none", // Disable default touch actions
            }}
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
        >
            <h3 style={{fontSize: "10pt"}}>{title}</h3>
            <ul style={{ listStyle: "none", padding: 0 }}>
                {data.map((child) => (
                    <li key={child.id} style={{ marginBottom: "5px" }}>
                        <button
                            style={{
                                width: "100%",
                                padding: "5px",
                                textAlign: "left",
                                border: "1px solid #ccc",
                                borderRadius: "4px",
                                background: "#007bff",
                                color: "white",
                                cursor: "pointer",
                            }}
                            onClick={() => onAddRow(child)}
                        >
                            {child.Name}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default MiniMap;

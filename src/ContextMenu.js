import React from "react";

const ContextMenu = React.forwardRef(({ menuItems, onMenuItemClick }, ref) => (
    <div
        ref={ref}
        className="context-menu"
        style={{
            display: "none",
            position: "absolute",
            zIndex: 1000,
            background: "white",
            border: "1px solid #ccc",
            borderRadius: "4px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
            padding: "8px 0",
            maxHeight: "300px",
            overflowY: "auto",
        }}
    >
        {menuItems.map(({ handler, label }) => (
            <div
                key={handler}
                className="context-menu__item"
                style={{
                    padding: "6px 12px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                }}
                onClick={() => onMenuItemClick(handler)}
                onMouseEnter={e => (e.currentTarget.style.background = "#f5f5f5")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
                {label}
            </div>
        ))}
    </div>
));

export default ContextMenu;

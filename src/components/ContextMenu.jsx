import React, { useState, useEffect } from "react";

const ContextMenu = React.forwardRef(({ menuItems, onMenuItemClick }, ref) => {
    const [stack, setStack] = useState([menuItems]);

    useEffect(() => {
        setStack([menuItems]);
    }, [menuItems]);

    const current = stack[stack.length - 1];

    // Group items for layout
    const groups = React.useMemo(() => {
        const order = [];
        const map = {};
        (current || []).forEach((item) => {
            const g = item.group || "Other";
            if (!map[g]) {
                map[g] = [];
                order.push(g);
            }
            map[g].push(item);
        });
        return order.map((name) => ({ name, items: map[name] }));
    }, [current]);

    const handleClick = (item) => {
        if (item.children) {
            setStack([...stack, item.children]);
        } else {
            onMenuItemClick(item.handler);
            // Do not reset stack here; let parent hide the menu if needed
        }
    };

    const goBack = () => setStack(stack.slice(0, -1));

    return (
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
                minWidth: "320px",
                maxWidth: "80vw",
                overflowX: "auto"
            }}
        >
            {stack.length > 1 && (
                <div
                    style={{
                        gridColumn: "1 / -1",
                        padding: "6px 12px",
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                    }}
                    onClick={goBack}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f5f5f5")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                    ◀ Back
                </div>
            )}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${Math.max(groups.length, 1)}, 1fr)`,
                    gap: "8px"
                }}
            >
                {groups.map((group) => (
                    <div key={group.name} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {group.name !== "Other" && (
                            <div style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#555",
                                padding: "4px 8px"
                            }}>{group.name}</div>
                        )}
                        <div style={{ display: "grid", gap: 2 }}>
                            {group.items.map((item) => (
                                <div
                                    key={item.handler}
                                    className="context-menu__item"
                                    style={{
                                        padding: "6px 12px",
                                        cursor: "pointer",
                                        whiteSpace: "nowrap",
                                        borderRadius: "2px"
                                    }}
                                    onClick={() => handleClick(item)}
                                    onMouseEnter={e => (e.currentTarget.style.background = "#f5f5f5")}
                                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                >
                                    {item.label}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});

export default ContextMenu;

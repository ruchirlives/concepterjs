import React, { useState, useContext, useEffect, useRef, useCallback } from "react";
import { EditorContext } from "@tiptap/react";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";

const AppTiptap = () => {
    const { editor } = useContext(EditorContext);
    const [collapsed, setCollapsed] = useState(true);

    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const tabPressCount = useRef(0);
    const containerRef = useRef(null);

    const fetchSuggestions = useCallback(async (prompt) => {
        if (!prompt.trim()) return;

        try {
            const res = await fetch("/api/autocomplete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt }),
            });

            if (!res.ok) throw new Error("Failed to fetch autocomplete");

            const data = await res.json();
            if (data.suggestions && data.suggestions.length > 0) {
                setSuggestions(data.suggestions);
                setShowSuggestions(true);
                setSelectedIndex(0);
            } else {
                setShowSuggestions(false);
            }
        } catch (err) {
            console.error("Autocomplete fetch error:", err);
            setShowSuggestions(false);
        }
    }, []);

    const applySuggestion = useCallback(
        (suggestion) => {
            if (!editor || !containerRef.current) return;

            const container = containerRef.current;
            const previousScrollTop = container.scrollTop;

            // Focus editor view directly (avoid wrapper focus)
            editor.view.focus();

            // Insert suggestion with slight delay to avoid scroll glitches
            setTimeout(() => {
                editor.commands.insertContent(suggestion + " ");
                // Restore scroll position to prevent jump
                container.scrollTop = previousScrollTop;
            }, 10);

            setShowSuggestions(false);
            tabPressCount.current = 0;
        },
        [editor]
    );

    const onKeyDown = useCallback(
        (e) => {
            if (!editor) return;

            if (!showSuggestions) {
                if (e.key === "Tab") {
                    e.preventDefault();
                    tabPressCount.current = 1;
                    const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, "\n", "\0");
                    fetchSuggestions(text);
                }
                return;
            }

            switch (e.key) {
                case "Tab":
                    e.preventDefault();
                    tabPressCount.current++;
                    if (tabPressCount.current === 2) {
                        applySuggestion(suggestions[selectedIndex]);
                    }
                    break;
                case "ArrowDown":
                    e.preventDefault();
                    setSelectedIndex((i) => (i + 1) % suggestions.length);
                    tabPressCount.current = 0;
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    setSelectedIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
                    tabPressCount.current = 0;
                    break;
                case "Escape":
                    e.preventDefault();
                    setShowSuggestions(false);
                    tabPressCount.current = 0;
                    break;
                default:
                    setShowSuggestions(false);
                    tabPressCount.current = 0;
                    break;
            }
        },
        [editor, showSuggestions, suggestions, selectedIndex, applySuggestion, fetchSuggestions]
    );

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest(".autocomplete-suggestions")) {
                setShowSuggestions(false);
                tabPressCount.current = 0;
            }
        };
        if (showSuggestions) {
            document.addEventListener("click", handleClickOutside);
        }
        return () => document.removeEventListener("click", handleClickOutside);
    }, [showSuggestions]);

    return (
        <div
            ref={containerRef}
            className="relative bg-white rounded shadow"
            onKeyDown={onKeyDown}
            style={{ outline: "none" }}
        >
            <div
                className="flex justify-between items-center cursor-pointer select-none px-4 py-2"
                onClick={() => setCollapsed(!collapsed)}
            >
                <span className="font-semibold text-lg">Editor</span>
                <button
                    aria-label={collapsed ? "Expand editor" : "Collapse editor"}
                    className="text-xl font-bold"
                >
                    {collapsed ? "▼" : "▲"}
                </button>
            </div>

            <div
                className="transition-all duration-300 overflow-auto"
                style={{ height: collapsed ? 0 : "400px" }}
            >
                {!collapsed && (
                    <div className="h-full overflow-y-auto">
                        <SimpleEditor />
                        {showSuggestions && (
                            <ul
                                className="autocomplete-suggestions"
                                style={{
                                    position: "absolute",
                                    bottom: "100%",
                                    left: 0,
                                    right: 0,
                                    backgroundColor: "white",
                                    border: "1px solid #ccc",
                                    maxHeight: 150,
                                    overflowY: "auto",
                                    zIndex: 1000,
                                    listStyle: "none",
                                    margin: 0,
                                    padding: 0,
                                }}
                            >
                                {suggestions.map((s, i) => (
                                    <li
                                        key={s}
                                        onClick={() => applySuggestion(s)}
                                        style={{
                                            padding: 8,
                                            backgroundColor: i === selectedIndex ? "#bde4ff" : "transparent",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {s}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AppTiptap;

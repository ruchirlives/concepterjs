import React, { useState, useEffect, useRef, useCallback } from "react";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";
import { fetchAutoComplete } from "api";

// Create a Tiptap extension for ghost text


const AppTiptap = () => {
    const [editor, setEditor] = useState(null);
    const [collapsed, setCollapsed] = useState(true);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [ghostSuggestion, setGhostSuggestion] = useState('');
    const tabPressCount = useRef(0);
    const containerRef = useRef(null);

    // Function to show ghost text
    const showGhostText = useCallback((suggestion) => {
        if (!editor) return;

        const { selection } = editor.state;
        const transaction = editor.state.tr.setMeta('ghostText', {
            suggestion,
            pos: selection.from
        });

        editor.view.dispatch(transaction);
        setGhostSuggestion(suggestion);
    }, [editor]);

    // Function to clear ghost text
    const clearGhostText = useCallback(() => {
        if (!editor) return;

        const transaction = editor.state.tr.setMeta('ghostText', { clear: true });
        editor.view.dispatch(transaction);
        setGhostSuggestion('');
    }, [editor]);

    // Function to accept ghost text
    const acceptGhostText = useCallback(() => {
        if (!editor || !ghostSuggestion) return;

        clearGhostText();
        editor.commands.insertContent(ghostSuggestion + " ");
        setGhostSuggestion('');
    }, [editor, ghostSuggestion, clearGhostText]);

    const fetchSuggestions = useCallback(async (prompt) => {
        if (!prompt.trim()) return;

        try {
            const data = await fetchAutoComplete(prompt);
            if (data.suggestions && data.suggestions.length > 0) {
                setSuggestions(data.suggestions);
                setShowSuggestions(true);
                setSelectedIndex(0);
                // Show ghost text for first suggestion
                showGhostText(data.suggestions[0]);
            } else {
                setShowSuggestions(false);
                clearGhostText();
            }
        } catch (err) {
            console.error("Autocomplete fetch error:", err);
            setShowSuggestions(false);
            clearGhostText();
        }
    }, [showGhostText, clearGhostText]);

    const applySuggestion = useCallback(
        (suggestion) => {
            if (!editor || !containerRef.current) return;

            const container = containerRef.current;
            const previousScrollTop = container.scrollTop;

            clearGhostText();
            editor.view.focus();

            setTimeout(() => {
                editor.commands.insertContent(suggestion + " ");
                container.scrollTop = previousScrollTop;
            }, 10);

            setShowSuggestions(false);
            setGhostSuggestion('');
            tabPressCount.current = 0;
        },
        [editor, clearGhostText]
    );

    const onKeyDown = useCallback(
        (e) => {
            if (!editor) return;

            if (e.key === "Tab") {
                e.preventDefault();
                e.stopPropagation();

                if (ghostSuggestion && !showSuggestions) {
                    // Accept ghost text with Tab
                    acceptGhostText();
                    return;
                }
            }

            if (!showSuggestions) {
                if (e.key === "Tab") {
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
                    setSelectedIndex((i) => {
                        const newIndex = (i + 1) % suggestions.length;
                        showGhostText(suggestions[newIndex]);
                        return newIndex;
                    });
                    tabPressCount.current = 0;
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    setSelectedIndex((i) => {
                        const newIndex = (i - 1 + suggestions.length) % suggestions.length;
                        showGhostText(suggestions[newIndex]);
                        return newIndex;
                    });
                    tabPressCount.current = 0;
                    break;
                case "Escape":
                    e.preventDefault();
                    setShowSuggestions(false);
                    clearGhostText();
                    tabPressCount.current = 0;
                    break;
                default:
                    setShowSuggestions(false);
                    clearGhostText();
                    tabPressCount.current = 0;
                    break;
            }
        },
        [editor, showSuggestions, suggestions, selectedIndex, applySuggestion, fetchSuggestions, ghostSuggestion, acceptGhostText, showGhostText, clearGhostText]
    );

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest(".autocomplete-suggestions")) {
                setShowSuggestions(false);
                clearGhostText();
                tabPressCount.current = 0;
            }
        };
        if (showSuggestions) {
            document.addEventListener("click", handleClickOutside);
        }
        return () => document.removeEventListener("click", handleClickOutside);
    }, [showSuggestions, clearGhostText]);

    return (
        <div
            ref={containerRef}
            className="relative bg-white rounded shadow w-full"
            onKeyDownCapture={onKeyDown}
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
                className="transition-all duration-300 overflow-auto w-full"
                style={{ height: collapsed ? 0 : "400px" }}
            >
                {!collapsed && (
                    <div className="h-full flex flex-col mx-auto px-4 py-2 max-w-7xl">
                        <SimpleEditor onEditorReady={setEditor} />
                        {showSuggestions && (
                            <ul
                                className="autocomplete-suggestions"
                                style={{
                                    position: "absolute",
                                    top: "100%",
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

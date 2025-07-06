import React, { useState, useRef, useCallback } from "react";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";
import { fetchAutoComplete } from "api";
import { useAppContext } from "AppContext";
import { useTiptapSync } from './hooks/useTiptapSync';

const AppTiptap = () => {
    const { tiptapContent, setTiptapContent } = useAppContext();
    const [editor, setEditor] = useState(null);
    const [collapsed, setCollapsed] = useState(true);
    const [ghostSuggestion, setGhostSuggestion] = useState('');
    const tabPressCount = useRef(0);
    const containerRef = useRef(null);

    // Handle all sync logic
    useTiptapSync(editor, tiptapContent, setTiptapContent);

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
                // Only show ghost text for the first suggestion
                showGhostText(data.suggestions[0]);
            } else {
                clearGhostText();
            }
        } catch (err) {
            console.error("Autocomplete fetch error:", err);
            clearGhostText();
        }
    }, [showGhostText, clearGhostText]);

    const onKeyDown = useCallback(
        (e) => {
            if (!editor) return;

            if (e.key === "Tab") {
                e.preventDefault();
                e.stopPropagation();

                if (ghostSuggestion) {
                    // Accept ghost text with Tab
                    acceptGhostText();
                    return;
                } else {
                    // Fetch new suggestions
                    tabPressCount.current = 1;
                    const { selection } = editor.state;
                    const cursorPos = selection.from;

                    // Get all text from start of document to cursor
                    const allTextToCursor = editor.state.doc.textBetween(0, cursorPos, "\n", "\0");

                    fetchSuggestions(allTextToCursor);
                }
            }

            // Clear ghost text on most other keys
            if (e.key !== "Tab" && e.key !== "Shift" && e.key !== "Control" && e.key !== "Alt" && e.key !== "Meta") {
                clearGhostText();
                tabPressCount.current = 0;
            }
        },
        [editor, ghostSuggestion, acceptGhostText, fetchSuggestions, clearGhostText]
    );

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
                    </div>
                )}
            </div>
        </div>
    );
};

export default AppTiptap;

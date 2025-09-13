import React, { useState, useRef, useCallback } from "react";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";
import { fetchAutoComplete } from "api";
import { useAppContext } from "AppContext";
import { useTiptapSync } from './hooks/useTiptapSync';
import toast from 'react-hot-toast';

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

    const handleExport = useCallback(() => {
        if (!editor) return;
        const html = editor.getHTML();
        const wrappedHtml = `<html>${html}</html>`;
        toast((t) => (
            <div className="max-w-[400px]">
                <div className="font-semibold mb-1">Copy HTML for Word</div>
                <div className="text-xs mb-2 overflow-y-auto max-h-40 whitespace-pre-wrap font-mono border p-1 bg-gray-50">
                    {wrappedHtml}
                </div>
                <button
                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
                    onClick={async () => {
                        try {
                            await navigator.clipboard.write([
                                new window.ClipboardItem({
                                    "text/html": new Blob([wrappedHtml], { type: "text/html" }),
                                    "text/plain": new Blob([wrappedHtml], { type: "text/plain" })
                                })
                            ]);
                            toast.success("Copied HTML to clipboard!");
                        } catch (err) {
                            toast.error("Clipboard copy failed");
                        }
                        toast.dismiss(t.id);
                    }}
                >
                    Copy to Clipboard
                </button>
            </div>
        ), { duration: 8000 });
    }, [editor]);

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

    // State for live HTML preview
    const [liveHtml, setLiveHtml] = useState("");

    // Insert a marker span at the current selection position in the HTML
    function getHtmlWithCursorMarker(editor) {
        if (!editor) return "";
        const { from } = editor.state.selection;
        // Get HTML up to cursor
        const doc = editor.state.doc;
        const html = editor.getHTML();
        // Use ProseMirror's posToDOM to find the DOM node and offset for the cursor
        // But since we only have HTML, we can use a workaround: insert a unique string at the cursor, then replace it with a span
        const marker = "__TTCURSOR__";
        // Insert marker at cursor position in the document
        let htmlWithMarker = "";
        try {
            // Get raw text up to cursor
            const textBefore = doc.textBetween(0, from, "\n", "\0");
            // Find the textBefore in the HTML and insert marker after it
            // This is not perfect for complex docs, but works for simple cases
            const idx = html.indexOf(textBefore);
            if (idx !== -1) {
                htmlWithMarker = html.slice(0, idx + textBefore.length) + marker + html.slice(idx + textBefore.length);
            } else {
                htmlWithMarker = html; // fallback
            }
        } catch {
            htmlWithMarker = html;
        }
        // Replace marker with span
        return htmlWithMarker.replace(marker, '<span id="tiptap-cursor-marker" style="display:inline-block;width:1.5ch;height:1.2em;background:#2563eb;border-radius:2px;vertical-align:middle;opacity:0.5;"></span>');
    }

    // Update liveHtml whenever editor content or selection changes
    React.useEffect(() => {
        if (!editor) return;
        const updateHtml = () => setLiveHtml(getHtmlWithCursorMarker(editor));
        updateHtml();
        editor.on('update', updateHtml);
        editor.on('selectionUpdate', updateHtml);
        return () => {
            editor.off('update', updateHtml);
            editor.off('selectionUpdate', updateHtml);
        };
    }, [editor]);

    return (
        <div
            ref={containerRef}
            className="relative bg-white rounded shadow w-full flex"
            onKeyDownCapture={onKeyDown}
            style={{ outline: "none" }}
        >
            {/* Main content area (left) */}
            <div className="flex-1 min-w-0">
                <div
                    className="flex justify-between items-center cursor-pointer select-none px-4 py-2"
                    onClick={() => setCollapsed(!collapsed)}
                >
                    <span className="font-semibold text-lg">Editor</span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleExport();
                            }}
                            className="px-2 py-1 border rounded"
                        >
                            Export Word
                        </button>
                        <button
                            aria-label={collapsed ? "Expand editor" : "Collapse editor"}
                            className="text-xl font-bold"
                        >
                            {collapsed ? "▼" : "▲"}
                        </button>
                    </div>
                </div>

                <div
                    className="transition-all duration-300 overflow-auto w-full"
                    style={{ height: collapsed ? 0 : "600px" }}
                >
                    {!collapsed && (
                        <div className="h-full flex flex-col mx-auto px-4 py-2 max-w-7xl">
                            <SimpleEditor onEditorReady={setEditor} />
                        </div>
                    )}
                </div>
            </div>

            {/* Right navigation/preview panel */}
            <div
                className="w-1/3 min-w-[280px] max-w-[420px] border-l bg-gray-50 p-4 overflow-auto"
                style={{ height: collapsed ? 0 : "600px", transition: 'height 0.3s' }}
                ref={el => {
                    // Scroll to marker after render
                    if (el && !collapsed) {
                        setTimeout(() => {
                            const marker = el.querySelector('#tiptap-cursor-marker');
                            if (marker) {
                                marker.scrollIntoView({ block: 'center', behavior: 'auto' });
                            }
                        }, 0);
                    }
                }}
            >
                {!collapsed && (
                    <>
                        <div className="font-semibold mb-2">Live Document Preview</div>
                        <div
                            className="prose prose-xs"
                            style={{ border: '1px solid #ccc', marginBottom: 12, padding: 8, minHeight: 120, fontSize: '0.75rem' }}
                            dangerouslySetInnerHTML={{ __html: liveHtml }}
                        />
                    </>
                )}
            </div>
        </div>
    );
};

export default AppTiptap;

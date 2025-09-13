import React, { useState, useRef, useCallback } from "react";
import { EditorState } from '@tiptap/pm/state';
import { DOMSerializer } from '@tiptap/pm/model';
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
    const previewRef = useRef(null);

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
    const [markerPos, setMarkerPos] = useState(null); // {top, left, height}

    // Insert a marker span at the current selection position in the HTML
    function getHtmlWithCursorMarker(editor) {
        if (!editor) return "";
        const { from } = editor.state.selection;

        // Create a temporary PM state cloned from the editor, insert a unique marker text,
        // serialize to HTML, then swap the marker text for a styled span.
        const MARKER = "[[[__TTCURSOR_MARK__]]]"; // unlikely to exist in content
        try {
            const tmpState = EditorState.create({ schema: editor.schema, doc: editor.state.doc });
            const tr = tmpState.tr.insertText(MARKER, from, from);
            const newDoc = tr.doc;

            const serializer = DOMSerializer.fromSchema(editor.schema);
            const fragment = serializer.serializeFragment(newDoc.content);
            const container = document.createElement('div');
            container.appendChild(fragment);
            const htmlWithMarker = container.innerHTML;

            // Insert a zero-impact anchor we will measure and then replace with an overlay
            return htmlWithMarker.replace(
                MARKER,
                '<span id="tiptap-cursor-anchor" style="display:inline;width:0;overflow:hidden;font-size:0;line-height:0;">\u200b</span>'
            );
        } catch (e) {
            // Fallback to plain HTML without marker if anything goes wrong
            return editor.getHTML();
        }
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

    // After liveHtml updates, place overlay marker and scroll only the preview container
    React.useEffect(() => {
        if (collapsed) return;
        const container = previewRef.current;
        if (!container) return;
        const anchor = container.querySelector('#tiptap-cursor-anchor');
        if (!anchor) {
            setMarkerPos(null);
            return;
        }

        const containerRect = container.getBoundingClientRect();
        const anchorRect = anchor.getBoundingClientRect();
        const top = (anchorRect.top - containerRect.top) + container.scrollTop;
        const left = (anchorRect.left - containerRect.left) + container.scrollLeft;
        const height = Math.max(16, anchorRect.height || parseFloat(getComputedStyle(container).fontSize));

        // Remove inline anchor to avoid any layout side-effects
        anchor.parentNode && anchor.parentNode.removeChild(anchor);

        setMarkerPos({ top, left, height });

        const targetScrollTop = top - (container.clientHeight / 2) + (height / 2);
        const maxScroll = container.scrollHeight - container.clientHeight;
        container.scrollTop = Math.max(0, Math.min(maxScroll, targetScrollTop));
    }, [liveHtml, collapsed]);

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
                className="w-1/3 min-w-[280px] max-w-[420px] border-l bg-gray-50 p-4 overflow-auto relative"
                style={{ height: collapsed ? 0 : "600px", transition: 'height 0.3s' }}
                ref={previewRef}
            >
                {!collapsed && (
                    <>
                        <div className="font-semibold mb-2">Live Document Preview</div>
                        <div
                            className="prose prose-xs"
                            style={{ border: '1px solid #ccc', marginBottom: 12, padding: 8, minHeight: 120, fontSize: '0.75rem' }}
                            dangerouslySetInnerHTML={{ __html: liveHtml }}
                        />
                        {markerPos && (
                            <div
                                aria-hidden
                                style={{
                                    position: 'absolute',
                                    left: Math.max(0, markerPos.left - 1),
                                    top: markerPos.top,
                                    width: 2,
                                    height: markerPos.height,
                                    background: '#2563eb',
                                    opacity: 0.6,
                                    borderRadius: 1,
                                    pointerEvents: 'none'
                                }}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default AppTiptap;

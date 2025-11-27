import React, { useState, useRef, useCallback, useEffect } from "react";
import { EditorState } from '@tiptap/pm/state';
import { DOMSerializer } from '@tiptap/pm/model';
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";
import { fetchAutoComplete, getNarratives, getPosition, setNarrative } from "api";
import { useAppContext } from "AppContext";
import { useTiptapContext } from "./TiptapContext";
import { useTiptapSync } from './hooks/useTiptapSync';
import toast from 'react-hot-toast';

const AppTiptap = () => {
    const { tiptapContent, setTiptapContent } = useTiptapContext();
    const [editor, setEditor] = useState(null);
    const [ghostSuggestion, setGhostSuggestion] = useState('');
    const tabPressCount = useRef(0);
    const containerRef = useRef(null);
    const previewRef = useRef(null);
    const PREVIEW_MARKER_TOP_OFFSET = -16; // fine-tune vertical alignment (px)
    const { rowData } = useAppContext();

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
        console.log("Exporting document content");
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
    const [narratives, setNarratives] = useState([]);
    const [narrativesLoading, setNarrativesLoading] = useState(false);
    const [narrativesError, setNarrativesError] = useState(null);

    // Load narratives from backend
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setNarrativesLoading(true);
            setNarrativesError(null);
            try {
                const data = await getNarratives();
                // console.log("Fetched narratives:", data);
                if (!cancelled) {
                    // Normalize to array
                    const arr = Array.isArray(data) ? data : (data?.narratives || []);
                    setNarratives(arr);
                }
            } catch (e) {
                if (!cancelled) setNarrativesError('Failed to load narratives');
            } finally {
                if (!cancelled) setNarrativesLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [rowData]);

    // Insert a marker span at the current selection position in the HTML
    function getHtmlWithCursorMarker(editor) {
        if (!editor) return "";
        const { from } = editor.state.selection;

        // Create a temporary PM state cloned from the editor, insert a unique marker text,
        // serialize to HTML, then swap the marker text for a styled span.
        const MARKER = "[[[__TTCURSOR_MARK__]]]"; // unlikely to exist in content
        try {
            const tmpState = EditorState.create({ schema: editor.schema, doc: editor.state.doc });

            // Collect anchor positions at start of each textblock for mapping clicks back to editor positions
            const posAnchors = [];
            editor.state.doc.descendants((node, pos) => {
                if (node.isTextblock) {
                    posAnchors.push(pos + 1);
                }
            });

            // Prepare inserts in descending order to avoid shifting
            const inserts = [
                { pos: from, token: MARKER, type: 'cursor' },
                ...posAnchors.map(p => ({ pos: p, token: `[[[__POS_${p}__]]]`, type: 'anchor' })),
            ].sort((a, b) => b.pos - a.pos);

            let tr = tmpState.tr;
            for (const ins of inserts) {
                tr = tr.insertText(ins.token, ins.pos, ins.pos);
            }
            const newDoc = tr.doc;

            const serializer = DOMSerializer.fromSchema(editor.schema);
            const fragment = serializer.serializeFragment(newDoc.content);
            const container = document.createElement('div');
            container.appendChild(fragment);
            const htmlWithMarker = container.innerHTML;

            // Replace cursor marker and position anchors with zero-impact spans
            let htmlOut = htmlWithMarker.replace(
                MARKER,
                '<span id="tiptap-cursor-anchor" style="display:inline;width:0;overflow:hidden;font-size:0;line-height:0;">\u200b</span>'
            );
            htmlOut = htmlOut.replace(/\[\[\[__POS_(\d+)__\]\]\]/g, (_m, p1) =>
                `<span class="tt-pos-anchor" data-pos="${p1}" style="display:inline;width:0;overflow:hidden;font-size:0;line-height:0;">\u200b</span>`
            );
            return htmlOut;
        } catch (e) {
            // Fallback to plain HTML without marker if anything goes wrong
            return editor.getHTML();
        }
    }

    // Update liveHtml whenever editor content or selection changes
    React.useEffect(() => {
        if (!editor) return;
        let frameId = null;
        const updateHtml = () => {
            if (frameId) cancelAnimationFrame(frameId);
            frameId = requestAnimationFrame(() => {
                setLiveHtml(getHtmlWithCursorMarker(editor));
                frameId = null;
            });
        };
        updateHtml();
        editor.on('update', updateHtml);
        editor.on('selectionUpdate', updateHtml);
        return () => {
            editor.off('update', updateHtml);
            editor.off('selectionUpdate', updateHtml);
            if (frameId) cancelAnimationFrame(frameId);
        };
    }, [editor]);

    // After liveHtml updates, place overlay marker and scroll only the preview container
    React.useEffect(() => {
        const container = previewRef.current;
        if (!container) return;
        const anchor = container.querySelector('#tiptap-cursor-anchor');
        if (!anchor) {
            setMarkerPos(null);
            return;
        }

        const containerRect = container.getBoundingClientRect();

        // Use a Range to get more accurate line box rect for zero-width anchors
        let rect;
        try {
            const range = document.createRange();
            range.selectNode(anchor);
            const rects = range.getClientRects();
            rect = rects && rects.length ? rects[0] : anchor.getBoundingClientRect();
        } catch {
            rect = anchor.getBoundingClientRect();
        }

        const top = (rect.top - containerRect.top) + container.scrollTop;
        const left = (rect.left - containerRect.left) + container.scrollLeft;

        // Derive a better line height from the anchor's parent
        const parent = anchor.parentElement || container;
        const cs = getComputedStyle(parent);
        let lineHeightPx = parseFloat(cs.lineHeight);
        if (!Number.isFinite(lineHeightPx)) {
            const fontSizePx = parseFloat(cs.fontSize) || 12;
            lineHeightPx = fontSizePx * 1.25;
        }
        const lineH = Math.max(10, lineHeightPx);
        const topAdjusted = top + ((rect.height || lineH) - lineH) / 2 + PREVIEW_MARKER_TOP_OFFSET;
        const height = lineH;

        // Remove inline anchor to avoid any layout side-effects
        anchor.parentNode && anchor.parentNode.removeChild(anchor);

        setMarkerPos({ top: topAdjusted, left, height });

        const targetScrollTop = top - (container.clientHeight / 2) + (height / 2);
        const maxScroll = container.scrollHeight - container.clientHeight;
        container.scrollTop = Math.max(0, Math.min(maxScroll, targetScrollTop));
    }, [liveHtml, PREVIEW_MARKER_TOP_OFFSET]);

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
                    </div>
                </div>

                <div
                    className="transition-all duration-300 overflow-auto w-full"
                    style={{ height: "auto" }}
                >
                    <div className="h-full flex flex-col mx-auto px-4 py-2 max-w-7xl">
                        <SimpleEditor onEditorReady={setEditor} />
                    </div>
                </div>
            </div>

            {/* Right navigation/preview panel */}
            <div
                className="w-1/3 min-w-[280px] max-w-[420px] border-l bg-gray-50 p-4 overflow-auto relative"
                style={{ height: "auto", transition: 'height 0.3s' }}
                ref={previewRef}
            >
                    <>
                        <div className="font-semibold mb-2">Live Document Preview</div>
                        <div
                            className="prose prose-xs"
                            style={{ border: '1px solid #ccc', marginBottom: 12, padding: 8, minHeight: 120, fontSize: '0.75rem' }}
                            onClick={(e) => {
                                if (!editor || !previewRef.current) return;
                                const container = previewRef.current;
                                const anchors = Array.from(container.querySelectorAll('.tt-pos-anchor'));
                                if (!anchors.length) return;

                                const clickX = e.clientX;
                                const clickY = e.clientY;
                                let best = null;
                                let bestDist = Infinity;
                                for (const el of anchors) {
                                    const r = el.getBoundingClientRect();
                                    const dx = (r.left + r.width / 2) - clickX;
                                    const dy = (r.top + r.height / 2) - clickY;
                                    const d2 = dx * dx + dy * dy;
                                    if (d2 < bestDist) {
                                        bestDist = d2;
                                        best = el;
                                    }
                                }
                                if (best) {
                                    const pos = parseInt(best.getAttribute('data-pos'), 10);
                                    if (Number.isFinite(pos)) {
                                        editor.chain().focus().setTextSelection(pos).run();
                                        editor.commands.scrollIntoView();
                                    }
                                }
                            }}
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

                        <div className="font-semibold mb-2">Narratives</div>
                        {narrativesLoading && (
                            <div className="text-sm text-gray-500">Loading narratives…</div>
                        )}
                        {narrativesError && (
                            <div className="text-sm text-red-600">{narrativesError}</div>
                        )}
                        {!narrativesLoading && !narrativesError && (
                            narratives.length > 0 ? (
                                narratives.map((n, idx) => (
                                    <div
                                        key={`${n.source_id}-${n.target_id}-${idx}`}
                                        className="text-xs p-2 bg-white border rounded shadow-sm"
                                        title={`${n.source_name || n.source_id} -> ${n.target_name || n.target_id}`}
                                    >
                                        <div className="font-medium truncate">
                                            {(n.source_name || n.source_id) + ' → ' + (n.target_name || n.target_id)}
                                        </div>
                                        {n.label ? (
                                            <div className="text-gray-700 break-words">{n.label}</div>
                                        ) : (
                                            <div className="text-gray-400 italic">No label</div>
                                        )}
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                className="px-2 py-1 border rounded text-[11px] hover:bg-gray-50"
                                                onClick={async () => {
                                                    // First check is user has saved the existing narrative in editor
                                                    const confirmSwitch = window.confirm('Have you saved the existing narrative?');
                                                    if (!confirmSwitch) return;
                                                    try {
                                                        const data = await getPosition(n.source_id, n.target_id);
                                                        const narrative = (data?.narrative ?? '');
                                                        if (!narrative) {
                                                            toast.error('No narrative found for this pair');
                                                            return;
                                                        }
                                                        setTiptapContent(narrative);
                                                        toast.success('Loaded narrative into editor');
                                                    } catch (err) {
                                                        console.error('Error loading narrative:', err);
                                                        toast.error('Error loading narrative');
                                                    }
                                                }}
                                            >
                                                Get
                                            </button>
                                            <button
                                                className="px-2 py-1 border rounded text-[11px] hover:bg-gray-50"
                                                onClick={async () => {
                                                    try {
                                                        const content = tiptapContent || '';
                                                        const res = await setNarrative(n.source_id, n.target_id, content);
                                                        if (res) {
                                                            toast.success('Narrative set from editor content');
                                                        } else {
                                                            toast.error('Failed to set narrative');
                                                        }
                                                    } catch (err) {
                                                        console.error('Error setting narrative:', err);
                                                        toast.error('Error setting narrative');
                                                    }
                                                }}
                                            >
                                                Set
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-sm text-gray-500">No narratives found.</div>
                            )
                        )}
                    </>
            </div>
        </div>
    );
};

export default AppTiptap;

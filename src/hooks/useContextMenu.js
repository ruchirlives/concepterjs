import React, { useRef, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { sendMermaidToChannel, sendGanttToChannel, handleWriteBack, requestRefreshChannel } from "hooks/effectsShared";
import { get_onenote } from "../api";
import { get_docx } from "../api";
import { removeChildren } from "../api";
import * as mammoth from "mammoth/mammoth.browser";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { useAppContext } from "../AppContext";


// Generic ContextMenu component
export function ContextMenu({ contextMenu, setContextMenu, menuOptions }) {
    const menuRef = useRef(null);
    const [openSubmenu, setOpenSubmenu] = useState(null);

    useEffect(() => {
        if (!contextMenu) return;
        const handleClick = (e) => {
            if (menuRef.current && menuRef.current.contains(e.target)) return;
            setContextMenu(null);
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [contextMenu, setContextMenu]);

    if (!contextMenu) return null;
    return (
        <div
            ref={menuRef}
            className="fixed z-50 bg-white border border-gray-300 rounded shadow"
            style={{
                top: contextMenu.y,
                left: contextMenu.x,
                maxHeight: openSubmenu ? undefined : "260px",
                overflowY: openSubmenu ? "visible" : "auto",
                minWidth: "180px",
            }}
            onContextMenu={e => e.preventDefault()}
        >
            {menuOptions.map(({ label, onClick, submenu }, i) =>
                submenu ? (
                    <div
                        key={label}
                        className="relative group"
                        onMouseEnter={() => setOpenSubmenu(label)}
                        onMouseLeave={() => setOpenSubmenu(null)}
                    >
                        <button
                            className="w-full px-3 py-1 text-left text-xs hover:bg-gray-100 flex justify-between items-center"
                            type="button"
                        >
                            {label}
                            <span className="ml-2">&#9654;</span>
                        </button>
                        {openSubmenu === label && (
                            <div
                                className="absolute left-full top-0 bg-white border border-gray-300 rounded shadow min-w-[160px] z-50"
                                style={{ minWidth: "160px", zIndex: 9999 }}
                            >
                                {submenu.map((sub, j) => (
                                    <button
                                        key={sub.label}
                                        className="block w-full px-3 py-1 text-left text-xs hover:bg-gray-100"
                                        onClick={async e => {
                                            e.stopPropagation();
                                            await sub.onClick(contextMenu);
                                            setContextMenu(null);
                                        }}
                                    >
                                        {sub.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <button
                        key={label}
                        className="block w-full px-3 py-1 text-left text-xs hover:bg-gray-100"
                        onClick={async e => {
                            e.stopPropagation();
                            if (onClick) {
                                await onClick(contextMenu);
                                setContextMenu(null);
                            }
                        }}
                    >
                        {label}
                    </button>
                )
            )}
        </div>
    );
}

// Menu handlers (all async, receive context)
export function useMenuHandlers({ rowData, setRowData, removeChildFromLayer, flipped, childrenMap }) {
    const { setTiptapContent } = useAppContext();
    // Rename
    const handleRename = async (context) => {
        const { cid } = context;
        const currname = rowData.find(item => item.id === cid)?.Name || "";
        const name = prompt("Enter new name:", currname);
        if (name) {
            const updatedRowData = rowData.map(row =>
                row.id === cid ? { ...row, Name: name } : row
            );
            setRowData(updatedRowData);
            handleWriteBack(updatedRowData);
            toast.success("Node(s) renamed successfully!");
            requestRefreshChannel();
        }
    };

    // Select
    const handleSelect = async (context) => {
        const { cid } = context;
        const channel = new BroadcastChannel('selectNodeChannel');
        channel.postMessage({ nodeId: cid });
        setTimeout(() => channel.close(), 10);
    };

    // Remove from both
    const handleRemove = async (context) => {
        const { sourceId, cid, layer } = context;
        if (!flipped) {
            await removeChildren(sourceId, [cid]);
        } else {
            await removeChildren(cid, [sourceId.toString()]);
        }
        await removeChildFromLayer(layer, cid);
        requestRefreshChannel();
    };

    // Remove from layer
    const handleRemoveLayer = async (context) => {
        const { cid, layer } = context;
        await removeChildFromLayer(layer, cid);
        requestRefreshChannel();
    };

    // Remove from source
    const handleRemoveSource = async (context) => {
        const { sourceId, cid } = context;
        if (!flipped) {
            await removeChildren(sourceId, [cid]);
        } else {
            await removeChildren(cid, [sourceId.toString()]);
        }
        requestRefreshChannel();
    };

    // Export Mermaid
    const handleExportMermaid = async (context) => {
        const { cid } = context;
        await sendMermaidToChannel(cid);
        toast.success("Exported to Mermaid!");
    };

    // Export Gantt
    const handleExportGantt = async (context) => {
        const { cid } = context;
        await sendGanttToChannel(cid);
        toast.success("Exported to Gantt!");
    };

    // Export Editor
    const handleExportEditor = async (context) => {
        const { cid } = context;
        try {
            const blobUrl = await get_docx(cid);
            const response = await fetch(blobUrl);
            const arrayBuffer = await response.arrayBuffer();
            URL.revokeObjectURL(blobUrl);

            const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
            const editor = new Editor({ extensions: [StarterKit], content: html });
            const json = editor.getJSON();
            editor.destroy();
            setTiptapContent(json);
            toast.success("Exported to Docx!");
        } catch (error) {
            console.error("Failed to load Docx", error);
            toast.error("Failed to export Docx.");
        }
    };

    // Export Docx
    const handleExportDocx = async (context) => {
        const { cid } = context;
        const blobUrl = await get_docx(cid);
        if (blobUrl) {
            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = "output.docx";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Exported to Docx!");
        } else {
            toast.error("Failed to export Docx.");
        }
    };

    // Export Onenote
    const handleExportOnenote = async (context) => {
        const { cid } = context;
        const htmlFragment = await get_onenote(cid);

        // CF_HTML header construction (strict, single header, correct offsets)
        function createCFHtml(htmlFragment) {
            // Wrap in html/body and fragment markers, no extra <body> tags
            const preHtml = '<html><body>';
            const postHtml = '</body></html>';
            const startFragment = '<!--StartFragment-->';
            const endFragment = '<!--EndFragment-->';
            const html = preHtml + startFragment + htmlFragment + endFragment + postHtml;

            // Header template (offsets as 0, will be replaced)
            const header =
                'Version:1.0\r\n' +
                'StartHTML:00000000\r\n' +
                'EndHTML:00000000\r\n' +
                'StartFragment:00000000\r\n' +
                'EndFragment:00000000\r\n';

            // Calculate offsets using UTF-8 byte length for CF_HTML spec
            function utf8ByteLen(str) {
                return new TextEncoder().encode(str).length;
            }
            const startHTML = utf8ByteLen(header);
            const endHTML = startHTML + utf8ByteLen(html);
            const startFragmentOffset = startHTML + utf8ByteLen(html.substring(0, html.indexOf(startFragment) + startFragment.length));
            const endFragmentOffset = startHTML + utf8ByteLen(html.substring(0, html.indexOf(endFragment)));

            // Fill in offsets (8 digits, zero-padded)
            const finalHeader =
                'Version:1.0\r\n' +
                `StartHTML:${String(startHTML).padStart(8, '0')}\r\n` +
                `EndHTML:${String(endHTML).padStart(8, '0')}\r\n` +
                `StartFragment:${String(startFragmentOffset).padStart(8, '0')}\r\n` +
                `EndFragment:${String(endFragmentOffset).padStart(8, '0')}\r\n`;

            const cfHtml = finalHeader + html;
            // Debug: log the generated CF_HTML string
            return cfHtml;
        }

        toast((t) => (
            <div className="max-w-[300px]">
                <div className="font-semibold mb-1">OneNote Export</div>
                <div className="text-xs mb-2 overflow-y-auto max-h-40 whitespace-pre-wrap font-mono">
                    {htmlFragment}
                </div>
                <button
                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
                    onClick={async () => {
                        try {
                            // Always rewrap as Version:1.0 CF_HTML for clipboard
                            const cfHtml = createCFHtml(htmlFragment);
                            await navigator.clipboard.write([
                                new window.ClipboardItem({
                                    'text/html': new Blob([cfHtml], { type: 'text/html' }),
                                    'text/plain': new Blob([htmlFragment], { type: 'text/plain' })
                                })
                            ]);
                            // Try to read back from clipboard (if supported)
                            if (navigator.clipboard.readText) {
                                const clipText = await navigator.clipboard.readText();
                                console.log('Clipboard text/plain after write:', clipText);
                            }
                            toast.success("Copied as CF_HTML!");
                        } catch (err) {
                            toast.error("Clipboard copy failed");
                        }
                        toast.dismiss(t.id);
                    }}
                >
                    Copy to Clipboard (CF_HTML)
                </button>
            {/* Manual copy fallback for debugging */}
            <textarea
                className="w-full text-xs font-mono mt-2 border border-gray-300 rounded"
                rows={4}
                value={createCFHtml(htmlFragment)}
                readOnly
                onFocus={e => e.target.select()}
                style={{ fontSize: '10px' }}
            />
            </div>
        ), { duration: 8000 });
    };

    const exportMenu = [
        { label: "Export to Mermaid", onClick: handleExportMermaid },
        { label: "Export to Gantt", onClick: handleExportGantt },
        { label: "Export to Docx", onClick: handleExportDocx },
        { label: "Export to Onenote", onClick: handleExportOnenote },
        { label: "Export to Editor", onClick: handleExportEditor },
    ];

    return {
        handleRename,
        handleSelect,
        handleRemove,
        handleRemoveLayer,
        handleRemoveSource,
        handleExportMermaid,
        handleExportGantt,
        handleExportDocx,
        handleExportOnenote,
        exportMenu,
    };
}
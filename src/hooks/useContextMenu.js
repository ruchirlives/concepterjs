import React from "react";
import toast from "react-hot-toast";
import { sendMermaidToChannel, sendGanttToChannel, handleWriteBack, requestRefreshChannel } from "hooks/effectsShared";
import { get_docx, setNarrative, setPosition, addChildren, removeChildren, getPosition } from "../api";
import { removeFromLayer } from "../AppLayers";

// Generic ContextMenu component
export function ContextMenu({ contextMenu, setContextMenu, menuOptions }) {
  if (!contextMenu) return null;
  return (
    <div
      className="fixed z-50 bg-white border border-gray-300 rounded shadow"
      style={{
        top: contextMenu.y,
        left: contextMenu.x,
        maxHeight: "260px",
        overflowY: "auto",
        minWidth: "180px",
      }}
      onContextMenu={e => e.preventDefault()}
    >
      {menuOptions.map(({ label, onClick }, i) => (
        <button
          key={label}
          className="block w-full px-3 py-1 text-left text-xs hover:bg-gray-100"
          onClick={async e => {
            e.stopPropagation();
            await onClick(contextMenu);
            setContextMenu(null);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// Menu handlers (all async, receive context)
export function useMenuHandlers({ rowData, setRowData, removeChildFromLayer, flipped, childrenMap }) {
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

  return {
    handleRename,
    handleSelect,
    handleRemove,
    handleRemoveLayer,
    handleRemoveSource,
    handleExportMermaid,
    handleExportGantt,
    handleExportDocx,
  };
}
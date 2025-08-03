import React from "react";
import { fetchChildren, fetchContainerById, getPosition } from "../api";
import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import htmlToDocx from "html-to-docx";

/**
 * Recursively build an HTML string of narratives following the container hierarchy.
 * @param {number|string} nodeId - Starting container ID
 * @param {Set<string>} visitedEdges - Track visited parent->child edges to avoid cycles
 * @param {number} depth - Current heading depth
 * @returns {string} HTML representing this node and its children
 */
async function buildHtmlFromNode(nodeId, visitedEdges = new Set(), depth = 0) {

  const container = await fetchContainerById(nodeId);
  const name = container?.Name || `Container ${nodeId}`;
  const headingLevel = Math.min(depth + 1, 6); // h1..h6
  let html = `<h${headingLevel}>${name}</h${headingLevel}>`;

  const children = await fetchChildren(nodeId);
  for (const child of children) {
    const edgeKey = `${nodeId}->${child.id}`;
    if (!visitedEdges.has(edgeKey)) {
      visitedEdges.add(edgeKey);
      const position = await getPosition(nodeId, child.id);
      const narrative = position?.narrative;
      if (narrative) {
        try {
          html += generateHTML(narrative, [StarterKit]);
        } catch (err) {
          console.error("Failed to generate HTML from narrative", err);
        }
      }
      html += await buildHtmlFromNode(child.id, visitedEdges, depth + 1);
    }
  }
  return html;
}

const DocxExporter = ({ rootId }) => {
  const handleExport = async () => {
    try {
      const html = await buildHtmlFromNode(rootId);
      const blob = await htmlToDocx(html);
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = 'output.docx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export DOCX', err);
    }
  };

  return (
    <button onClick={handleExport} className="px-2 py-1 border rounded">
      Export Word
    </button>
  );
};

export default DocxExporter;

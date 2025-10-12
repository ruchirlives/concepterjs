// Shared builders for visualization payloads

export function buildDonutTreePayload({
  id,
  expandTargetId,
  focusedNodeId,
  useLayers,
  reverseAncestry,
  expandDepth,
  nameById,
  childrenMap,
  rowData,
  hiddenLayers,
  availableLayerOptions,
  clickedSegmentId,
  relatedIds,
  ancestorIds,
  buildAncestryTree,
  prevDonutTree,
}) {
  const sanitizeTags = (tags) =>
    (tags || '').split(',').map(t => t.trim()).filter(Boolean);

  let donutTree = [];
  let layersWithItems = [];

  if (useLayers) {
    const visibleLayers = (availableLayerOptions || []).filter(layer => !hiddenLayers.has(layer));
    layersWithItems = visibleLayers
      .map(layer => {
        const items = (rowData || [])
          .filter(row => {
            const tags = sanitizeTags(row.Tags);
            if (tags.length === 0) return false;
            const inLayer = tags.includes(layer);
            const layerVisible = !hiddenLayers.has(layer);
            return inLayer && layerVisible;
          })
          .map(row => ({
            id: row.id?.toString(),
            name: row.Name || row.id?.toString(),
            layer,
            original: row,
            level: layer,
          }));
        return { layer, items };
      })
      .filter(entry => entry.items.length > 0);
  } else {
    // Keep root fixed as 'id'. Prefer merging into previous donutTree if available
    const rootNodeId = id;
    if (rootNodeId && nameById && childrenMap && typeof buildAncestryTree === 'function') {
      const prev = Array.isArray(prevDonutTree) ? prevDonutTree : null;
      if (prev && expandTargetId) {
        const clicked = prev.find(n => n.id?.toString() === expandTargetId?.toString());
        if (clicked) {
          const clickDepth = Number.isFinite(expandDepth) ? Math.max(1, expandDepth) : 1;
          const subTree = buildAncestryTree(expandTargetId, nameById, childrenMap, clickDepth, 0, reverseAncestry) || [];
          const adjusted = subTree
            .filter(n => Number.isFinite(n.level) && n.level > 0)
            .map(n => ({
              ...n,
              level: n.level + clicked.level,
              parentId: n.level === 1 ? clicked.id : n.parentId,
            }));
          const merged = [...prev, ...adjusted];
          const seen = new Set();
          const unique = [];
          for (let i = merged.length - 1; i >= 0; i--) {
            const m = merged[i];
            const key = `${m.id}-${m.level}`;
            if (!seen.has(key)) { seen.add(key); unique.unshift(m); }
          }
          donutTree = unique;
        } else {
          // fallback seed from root with a reasonable depth
          const seedDepth = Number.isFinite(expandDepth) ? Math.max(1, expandDepth) : 6;
          donutTree = reverseAncestry
            ? buildAncestryTree(rootNodeId, nameById, childrenMap, seedDepth, 0, true)
            : buildAncestryTree(rootNodeId, nameById, childrenMap, seedDepth);
        }
      } else {
        // No previous donut; seed from root
        const seedDepth = Number.isFinite(expandDepth) ? Math.max(1, expandDepth) : 6;
        donutTree = reverseAncestry
          ? buildAncestryTree(rootNodeId, nameById, childrenMap, seedDepth, 0, true)
          : buildAncestryTree(rootNodeId, nameById, childrenMap, seedDepth);
      }
    }
  }

  return {
    donutTree,
    layersWithItems,
    clickedSegmentId,
    relatedIds,
    ancestorIds,
    useLayers,
    reverseAncestry,
  };
}

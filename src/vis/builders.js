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
    // Keep root fixed as 'id'
    const rootNodeId = id;
    if (rootNodeId && nameById && childrenMap && typeof buildAncestryTree === 'function') {
      // Base tree from root with default depth
      const baseDepth = Number.isFinite(expandDepth) ? expandDepth : 6;
      const baseTree = reverseAncestry
        ? buildAncestryTree(rootNodeId, nameById, childrenMap, baseDepth, 0, true)
        : buildAncestryTree(rootNodeId, nameById, childrenMap, baseDepth);

      // Optional one-hop expansion under expandTargetId, preserving root context
      if (expandTargetId) {
        // Find clicked level within baseTree
        const clicked = baseTree.find(it => it.id?.toString() === expandTargetId?.toString());
        if (clicked) {
          const oneHop = buildAncestryTree(expandTargetId, nameById, childrenMap, 1, 0, reverseAncestry) || [];
          const adjusted = oneHop
            .filter(n => Number.isFinite(n.level) && n.level > 0)
            .map(n => ({
              ...n,
              level: n.level + clicked.level, // shift under clicked level
              parentId: n.level === 1 ? clicked.id : n.parentId,
            }));
          // Merge with de-dupe; prefer adjusted entries
          const merged = [...baseTree, ...adjusted];
          const seen = new Set();
          const unique = [];
          for (let i = merged.length - 1; i >= 0; i--) {
            const m = merged[i];
            const key = `${m.id}-${m.level}`;
            if (!seen.has(key)) { seen.add(key); unique.unshift(m); }
          }
          donutTree = unique;
        } else {
          donutTree = baseTree;
        }
      } else {
        donutTree = baseTree;
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

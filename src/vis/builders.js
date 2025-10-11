// Shared builders for visualization payloads

export function buildDonutTreePayload({
  id,
  focusedNodeId,
  useLayers,
  reverseAncestry,
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
    const rootNodeId = focusedNodeId || id;
    if (rootNodeId && nameById && childrenMap && typeof buildAncestryTree === 'function') {
      donutTree = reverseAncestry
        ? buildAncestryTree(rootNodeId, nameById, childrenMap, 6, 0, true)
        : buildAncestryTree(rootNodeId, nameById, childrenMap);
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


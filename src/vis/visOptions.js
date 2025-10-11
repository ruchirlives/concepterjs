// Centralized visualization configuration map
// Builds options using provided state, builders, and controllers

import { buildDonutTreePayload } from "./builders";

export function getVisOptions({
  state,
  builders,
  controllers,
}) {
  const {
    sankeyLinkColor = 'source-target',
    sankeyNodeAlign = 'sankeyLeft',
  } = state;

  const { buildNodesLinks } = builders;
  const { createDonut, createTree, createSankey } = controllers;
  const { createBundle } = controllers;

  const { buildAncestryTree } = builders;

  // Reusable helper: filter rows to visible layers and build nodes/links
  const buildLayerFilteredSankey = () => {
    const sanitizeTags = (tags) => (tags || '').split(',').map(t => t.trim()).filter(Boolean);
    const visibleLayers = (state.availableLayerOptions || []).filter(l => !state.hiddenLayers.has(l));

    const filteredRows = (state.rowData || []).filter(row => {
      const tags = sanitizeTags(row?.Tags);
      return tags.some(tag => visibleLayers.includes(tag));
    });

    return buildNodesLinks(filteredRows, state.relationships || {}, {
      idKey: 'id',
      nameKey: 'Name',
      parentKey: 'ParentId',
      relationshipDelimiter: '--',
      layerResolver: (row) => {
        const tags = sanitizeTags(row?.Tags);
        const layer = tags.find(tag => visibleLayers.includes(tag));
        return layer ? `L${layer}` : undefined;
      },
      includeOrphans: false,
    });
  };

  const buildDonutTreePayloadWrapper = () => buildDonutTreePayload({
    id: state.id,
    expandTargetId: state.expandTargetId,
    focusedNodeId: state.focusedNodeId,
    useLayers: state.useLayers,
    reverseAncestry: state.reverseAncestry,
    expandDepth: state.expandDepth,
    nameById: state.nameById,
    childrenMap: state.childrenMap,
    rowData: state.rowData,
    hiddenLayers: state.hiddenLayers,
    availableLayerOptions: state.availableLayerOptions,
    clickedSegmentId: state.clickedSegmentId,
    relatedIds: state.relatedIds,
    ancestorIds: state.ancestorIds,
    buildAncestryTree,
  });

  return {
    donut: {
      name: 'Ancestry Donut',
      controller: createDonut,
      buildData: () => buildDonutTreePayloadWrapper(),
      options: {},
    },
    tree: {
      name: 'Cluster Tree',
      controller: createTree,
      buildData: () => buildDonutTreePayloadWrapper(),
      options: {},
    },
    sankey: {
      name: 'Sankey',
      controller: createSankey,
      buildData: () => buildLayerFilteredSankey(),
      options: { linkColor: sankeyLinkColor, nodeAlign: sankeyNodeAlign },
    },
    bundle: {
      name: 'Bundle',
      controller: createBundle,
      buildData: () => {
        // Reuse donut/tree builder; if empty, fall back to simple hierarchy from filtered rows
        const payload = buildDonutTreePayloadWrapper();
        let flat = payload.donutTree || [];
        // Reconstruct hierarchy from flat items
        let hierarchy = null;
        if (flat.length) {
          const byKey = new Map();
          flat.forEach(n => {
            const key = `${n.id}-${n.level}`;
            byKey.set(key, { id: n.id, name: n.name || n.label, children: [] });
          });
          let rootKey = null; let minLevel = Infinity;
          flat.forEach(n => {
            const key = `${n.id}-${n.level}`;
            if (n.parentId != null && n.level > 0) {
              const pKey = `${n.parentId}-${n.level - 1}`;
              const p = byKey.get(pKey);
              if (p) p.children.push(byKey.get(key));
            }
            if (n.parentId == null || n.level < minLevel) { minLevel = n.level; rootKey = key; }
          });
          hierarchy = byKey.get(rootKey) || null;
        } else {
          // Fallback: build a flat hierarchy under a synthetic root from visible rows
          const sanitizeTags = (tags) => (tags || '').split(',').map(t => t.trim()).filter(Boolean);
          const visibleLayers = (state.availableLayerOptions || []).filter(l => !state.hiddenLayers.has(l));
          const filteredRows = (state.rowData || []).filter(row => {
            const tags = sanitizeTags(row?.Tags);
            return tags.some(tag => visibleLayers.includes(tag));
          });
          const children = filteredRows.map(r => ({ id: r.id?.toString(), name: r.Name || r.id?.toString() }));
          hierarchy = { id: 'root', name: 'root', children };
          flat = children.map((c, i) => ({ id: c.id, name: c.name, level: 1, parentId: 'root' }));
        }

        // Build cross-links from relationships where endpoints exist in flat list
        const idSet = new Set(flat.map(n => n.id?.toString()));
        const rels = state.relationships || {};
        const links = [];
        Object.entries(rels).forEach(([key, value]) => {
          if (!value) return;
          const parts = key.split('--');
          if (parts.length !== 2) return;
          const s = parts[0]?.toString();
          const t = parts[1]?.toString();
          if (idSet.has(s) && idSet.has(t)) links.push({ source: s, target: t });
        });

        return { hierarchy, links, parentCount: state.parentCountById || {} };
      },
      options: { k: 6 },
    },
  };
}

export default getVisOptions;


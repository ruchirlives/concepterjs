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

  const { buildAncestryTree } = builders;

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
      buildData: () => {
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
      },
      options: { linkColor: sankeyLinkColor, nodeAlign: sankeyNodeAlign },
    },
  };
}

export default getVisOptions;


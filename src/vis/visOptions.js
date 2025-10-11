// Centralized visualization configuration map
// Builds options using provided state, builders, and controllers

import { buildDonutTreePayload } from "./builders";

export function getVisOptions({
  state,
  builders,
  controllers,
}) {
  const {
    layersWithItems,
    rowData,
    relationships,
    sankeyLinkColor = 'source-target',
    sankeyNodeAlign = 'sankeyLeft',
  } = state;

  const { buildNodesLinks } = builders;
  const { createDonut, createTree, createSankey } = controllers;

  const { buildAncestryTree } = builders;

  const buildDonutTreePayloadWrapper = () => buildDonutTreePayload({
    id: state.id,
    focusedNodeId: state.focusedNodeId,
    useLayers: state.useLayers,
    reverseAncestry: state.reverseAncestry,
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
      buildData: () => buildNodesLinks(rowData || [], relationships || {}, {
        idKey: 'id',
        nameKey: 'Name',
        parentKey: 'ParentId',
        relationshipDelimiter: '--',
        layerResolver: (row) => {
          const layerEntry = (layersWithItems || []).find(l => (l.items || []).some(it => it?.original?.id?.toString() === row?.id?.toString()));
          return layerEntry ? `L${layerEntry.layer}` : undefined;
        },
        includeOrphans: true,
      }),
      options: { linkColor: sankeyLinkColor, nodeAlign: sankeyNodeAlign },
    },
  };
}

export default getVisOptions;


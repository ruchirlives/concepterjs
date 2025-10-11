// Centralized visualization configuration map
// Builds options using provided state, builders, and controllers

export function getVisOptions({
  state,
  builders,
  controllers,
}) {
  const {
    donutTree,
    layersWithItems,
    clickedSegmentId,
    relatedIds,
    ancestorIds,
    useLayers,
    reverseAncestry,
    rowData,
    relationships,
    sankeyLinkColor = 'source-target',
    sankeyNodeAlign = 'sankeyLeft',
  } = state;

  const { buildNodesLinks } = builders;
  const { createDonut, createTree, createSankey } = controllers;

  return {
    donut: {
      name: 'Ancestry Donut',
      controller: createDonut,
      buildData: () => ({
        donutTree,
        layersWithItems,
        clickedSegmentId,
        relatedIds,
        ancestorIds,
        useLayers,
        reverseAncestry,
      }),
      options: {},
    },
    tree: {
      name: 'Cluster Tree',
      controller: createTree,
      buildData: () => ({
        donutTree,
        layersWithItems,
        clickedSegmentId,
        relatedIds,
        ancestorIds,
        useLayers,
        reverseAncestry,
      }),
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


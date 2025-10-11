// Donut ancestry renderer extracted from AppD3Vis
import * as d3 from "d3";

export function renderDonutAncestry(opts) {
  const {
    svg,
    width,
    height,
    donutTree,
    handleSegmentClick,
    handleSegmentContextMenu,
    handleSegmentMouseDown,
    clickedSegmentId,
    stripCommonWords,
    relatedIds,
    ancestorIds,
  } = opts;

  const radius = Math.min(width, height) / 2 - 30;
  const g = svg
    .attr("viewBox", `${-width / 2} ${-height / 2} ${width} ${height}`)
    .append("g");

  if (!donutTree || donutTree.length === 0) return;

  const levels = {};
  donutTree.forEach((item) => {
    if (!levels[item.level]) levels[item.level] = [];
    levels[item.level].push(item);
  });

  function buildProperHierarchy() {
    if (donutTree.length === 0) return null;
    const itemsByKey = {};
    donutTree.forEach((item) => {
      const key = `${item.id}-${item.level}`;
      itemsByKey[key] = {
        id: item.id,
        name: item.label,
        level: item.level,
        parentId: item.parentId,
        parentLevel: item.level > 0 ? item.level - 1 : null,
        children: [],
      };
    });
    let minLevel = Infinity;
    let rootKey = null;
    donutTree.forEach((item) => {
      if (item.level < minLevel || item.parentId === null) {
        minLevel = item.level;
        rootKey = `${item.id}-${item.level}`;
      }
    });
    const rootItem = itemsByKey[rootKey];
    if (!rootItem) return null;
    donutTree.forEach((item) => {
      if (item.parentId !== null && item.level > 0) {
        const parentKey = `${item.parentId}-${item.level - 1}`;
        const childKey = `${item.id}-${item.level}`;
        if (itemsByKey[parentKey]) {
          itemsByKey[parentKey].children.push(itemsByKey[childKey]);
        }
      }
    });
    return rootItem;
  }

  const treeData = buildProperHierarchy();
  if (!treeData) return;

  const root = d3
    .hierarchy(treeData)
    .sum((d) => 1)
    .sort((a, b) => d3.ascending(a.data.name, b.data.name));

  d3.partition().size([2 * Math.PI, radius])(root);

  const arc = d3
    .arc()
    .startAngle((d) => d.x0)
    .endAngle((d) => d.x1)
    .innerRadius((d) => d.y0)
    .outerRadius((d) => d.y1);

  g
    .selectAll("path")
    .data(root.descendants())
    .join("path")
    .attr("fill", (d) => {
      const id = d.data.id?.toString?.() ?? d.data.id;
      if (!clickedSegmentId) return "#ddd";
      if (id === clickedSegmentId?.toString()) return "#ff4444";
      if (relatedIds.has(id)) return "#f59e0b00";
      if (ancestorIds.has(id)) return "#3b82f600";
      return "#9ca3af";
    })
    .attr("stroke", (d) => {
      const id = d.data.id?.toString?.() ?? d.data.id;
      if (!clickedSegmentId) return "#fff";
      if (id === clickedSegmentId?.toString()) return "#cc0000";
      if (relatedIds.has(id)) return "#f59e0b";
      if (ancestorIds.has(id)) return "#3b82f6";
      return "#fff";
    })
    .attr("stroke-width", (d) => {
      const id = d.data.id?.toString?.() ?? d.data.id;
      if (!clickedSegmentId) return 1;
      if (id === clickedSegmentId?.toString()) return 2;
      if (relatedIds.has(id)) return 2;
      if (ancestorIds.has(id)) return 2;
      return 1;
    })
    .attr("d", arc)
    .style("cursor", "pointer")
    .on("click", (event, d) => handleSegmentClick(event, d))
    .on("contextmenu", (event, d) => handleSegmentContextMenu(event, d))
    .on("mousedown", (event, d) => handleSegmentMouseDown(event, d));

  g
    .append("g")
    .attr("pointer-events", "none")
    .attr("text-anchor", "middle")
    .selectAll("text")
    .data(root.descendants())
    .join("text")
    .attr("transform", (d) => {
      const x = (d.x0 + d.x1) / 2;
      const y = (d.y0 + d.y1) / 2;
      return `rotate(${((x * 180) / Math.PI) - 90}) translate(${y},0) rotate(${x >= Math.PI ? 180 : 0})`;
    })
    .attr("dy", "0.35em")
    .style("font-size", "10px")
    .style("fill", "#374151")
    .text((d) => {
      const arcLength = Math.abs(d.x1 - d.x0);
      const r = (d.y0 + d.y1) / 2;
      const estMaxChars = Math.floor((arcLength * r) / (10 * 0.7));
      let name = stripCommonWords(d.data.name || "");
      if (arcLength < 0.35 || estMaxChars < 3) {
        return name.length >= 5 ? name.substring(0, 5) : name;
      }
      if (name.length > estMaxChars) name = name.substring(0, estMaxChars - 1) + "…";
      return name;
    });
}


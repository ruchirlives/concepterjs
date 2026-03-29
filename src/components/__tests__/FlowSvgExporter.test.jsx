import { serializeFlowSvg } from "../FlowSvgExporter";

describe("serializeFlowSvg", () => {
  const baseGrid = {
    rows: [],
    columns: [],
    bounds: { width: 0, height: 0 },
    cellOptions: {},
  };

  it("extends edge paths into the target node horizontally", () => {
    const svg = serializeFlowSvg({
      nodes: [
        {
          id: "source",
          position: { x: 0, y: 0 },
          data: { Name: "Source" },
        },
        {
          id: "target",
          position: { x: 200, y: 0 },
          data: { Name: "Target" },
        },
      ],
      edges: [
        {
          id: "edge",
          source: "source",
          target: "target",
        },
      ],
      grid: baseGrid,
      viewport: { x: 0, y: 0, zoom: 1 },
      includeRows: false,
      includeColumns: false,
    });

    const nodeRects = Array.from(
      svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*stroke="#1e293b"/g)
    );
    expect(nodeRects.length).toBeGreaterThanOrEqual(2);
    const targetRect = nodeRects[1];
    const targetX = parseFloat(targetRect[1]);
    const targetWidth = parseFloat(targetRect[3]);

    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const edgePath = doc.querySelector("path.flow-edge");
    expect(edgePath).not.toBeNull();
    const d = edgePath.getAttribute("d") || "";
    const coordinatePairs = Array.from(d.matchAll(/([\d.-]+)[,\s]+([\d.-]+)/g));
    expect(coordinatePairs.length).toBeGreaterThan(0);
    const [endX] = coordinatePairs.at(-1).slice(1).map(Number);

    expect(endX).toBeGreaterThan(targetX - 20);
    expect(endX).toBeLessThan(targetX + targetWidth);
  });

  it("extends edge paths into the target node vertically", () => {
    const svg = serializeFlowSvg({
      nodes: [
        {
          id: "source",
          position: { x: 0, y: 0 },
          data: { Name: "Source" },
        },
        {
          id: "target",
          position: { x: 0, y: 200 },
          data: { Name: "Target" },
        },
      ],
      edges: [
        {
          id: "edge",
          source: "source",
          target: "target",
        },
      ],
      grid: baseGrid,
      viewport: { x: 0, y: 0, zoom: 1 },
      includeRows: false,
      includeColumns: false,
    });

    const nodeRects = Array.from(
      svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*stroke="#1e293b"/g)
    );
    expect(nodeRects.length).toBeGreaterThanOrEqual(2);
    const targetRect = nodeRects[1];
    const targetY = parseFloat(targetRect[2]);
    const targetHeight = parseFloat(targetRect[4]);

    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const edgePath = doc.querySelector("path.flow-edge");
    expect(edgePath).not.toBeNull();
    const d = edgePath.getAttribute("d") || "";
    const coordinatePairs = Array.from(d.matchAll(/([\d.-]+)[,\s]+([\d.-]+)/g));
    expect(coordinatePairs.length).toBeGreaterThan(0);
    const [, endY] = coordinatePairs.at(-1).slice(1).map(Number);

    expect(endY).toBeGreaterThan(targetY - 20);
    expect(endY).toBeLessThan(targetY + targetHeight);
  });

  it("ignores adjusted cell dimensions when estimating grid bounds", () => {
    const svg = serializeFlowSvg({
      nodes: [],
      edges: [],
      grid: {
        rows: [],
        columns: [
          { label: "A", width: 100, left: 0 },
          { label: "B", width: 100, left: 100 },
        ],
        bounds: { width: 0, height: 200 },
        cellOptions: { width: 100, adjustedWidth: 600 },
      },
      viewport: { x: 0, y: 0, zoom: 1 },
    });

    const svgMatch = svg.match(/<svg[^>]+width="([\d.]+)"/);
    expect(svgMatch).not.toBeNull();
    const totalWidth = parseFloat(svgMatch[1]);
    expect(totalWidth).toBeCloseTo(264, 5);
  });

  it("includes edge labels from edge data payloads in the exported markup", () => {
    const svg = serializeFlowSvg({
      nodes: [
        {
          id: "node-a",
          position: { x: 0, y: 0 },
          data: { Name: "Node A" },
        },
        {
          id: "node-b",
          position: { x: 200, y: 0 },
          data: { Name: "Node B" },
        },
        {
          id: "node-c",
          position: { x: 0, y: 200 },
          data: { Name: "Node C" },
        },
      ],
      edges: [
        {
          id: "edge-1",
          source: "node-a",
          target: "node-b",
          data: { fullLabel: "Primary Data Label" },
        },
        {
          id: "edge-2",
          source: "node-b",
          target: "node-c",
          data: { label: "Fallback Data Label" },
        },
        {
          id: "edge-3",
          source: "node-c",
          target: "node-a",
          data: { position: { label: "Position Label" } },
        },
      ],
      grid: baseGrid,
      viewport: { x: 0, y: 0, zoom: 1 },
      includeRows: false,
      includeColumns: false,
    });

    expect(svg).toContain('<text class="flow-label-text" x="');
    expect(svg).toContain(">Primary Data Label<");
    expect(svg).toContain(">Fallback Data Label<");
    expect(svg).toContain(">Position Label<");
  });

  it("omits backward edges when filterEdgesByHandleX is enabled", () => {
    const svg = serializeFlowSvg({
      nodes: [
        {
          id: "node-a",
          position: { x: 200, y: 0 },
          data: { Name: "Node A" },
        },
        {
          id: "node-b",
          position: { x: 0, y: 0 },
          data: { Name: "Node B" },
        },
      ],
      edges: [
        {
          id: "edge-backward",
          source: "node-a",
          target: "node-b",
        },
      ],
      grid: baseGrid,
      viewport: { x: 0, y: 0, zoom: 1 },
      includeRows: false,
      includeColumns: false,
      filterEdgesByHandleX: true,
    });

    expect(svg).not.toContain('class="flow-edge"');
  });
});

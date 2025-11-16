import { serializeFlowAiSummary } from "../FlowAIExporter";

describe("serializeFlowAiSummary", () => {
  const baseGrid = {
    rows: [
      { id: "row-1", label: "Row Alpha", top: 0, bottom: 120, height: 120 },
    ],
    columns: [
      { id: "col-1", label: "Col One", left: 0, right: 200, width: 200 },
    ],
    lookup: {
      rowsByNodeId: {
        "node-1": { label: "Row Alpha" },
      },
      columnsByNodeId: {
        "node-1": { label: "Col One" },
      },
    },
    bounds: { width: 800, height: 600 },
    cellOptions: { width: 200, height: 120 },
  };

  it("summarizes rows, columns, nodes, and edges", () => {
    const summary = serializeFlowAiSummary({
      nodes: [
        {
          id: "node-1",
          position: { x: 50, y: 60 },
          data: { Name: "Node Alpha", Description: "Critical task" },
        },
        {
          id: "node-2",
          position: { x: 300, y: 60 },
          data: { Name: "Node Beta" },
        },
      ],
      edges: [
        {
          id: "edge-1",
          source: "node-1",
          target: "node-2",
          data: { label: "Depends on" },
        },
      ],
      grid: baseGrid,
      viewport: { x: 0, y: 0, zoom: 1 },
    });

    expect(summary).toContain("Rows (1 total)");
    expect(summary).toContain("Row Alpha");
    expect(summary).toContain("Columns (1 total)");
    expect(summary).toContain("Col One");
    expect(summary).toContain("Nodes (2 total)");
    expect(summary).toContain("Node Alpha");
    expect(summary).toContain("grid columns: Col One");
    expect(summary).toContain("Edges (1 total)");
    expect(summary).toContain("Node Alpha -> Node Beta");
    expect(summary).toContain("label: Depends on");
  });

  it("omits backward edges when filtering by handle direction", () => {
    const summary = serializeFlowAiSummary({
      nodes: [
        { id: "a", position: { x: 200, y: 0 }, data: { Name: "Forward" } },
        { id: "b", position: { x: 0, y: 0 }, data: { Name: "Backward" } },
      ],
      edges: [
        { id: "edge-back", source: "a", target: "b" },
        { id: "edge-forward", source: "b", target: "a" },
      ],
      grid: baseGrid,
      filterEdgesByHandleX: true,
    });

    expect(summary).toContain("Edges (1 total)");
    expect(summary).toContain("Backward -> Forward");
    expect(summary).not.toContain("Forward -> Backward");
  });
});

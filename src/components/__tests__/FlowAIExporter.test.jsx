import { serializeFlowAiSummary } from "../FlowAIExporter";

describe("serializeFlowAiSummary", () => {
  const baseGrid = {
    rows: [
      { id: "row-1", label: "Row Alpha", top: 0, bottom: 120, height: 120 },
    ],
    columns: [
      { id: "col-1", label: "Col One", left: 0, right: 200, width: 200 },
    ],
  };

  it("exports clean semantic graph data", () => {
    const summary = serializeFlowAiSummary({
      nodes: [
        {
          id: "node-1",
          position: { x: 50, y: 60 },
          data: {
            Name: "Node Alpha",
            gridAssignment: { rowId: "row-1", columnId: "col-1" },
            tags: ["Critical", "critical", "Priority"],
            children: [{ id: "child-1" }, { id: "child-1" }],
          },
        },
        {
          id: "node-2",
          position: { x: 300, y: 60 },
          data: {
            Name: "Node Beta",
            Tags: "Secondary, Beta",
          },
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
    });

    const parsed = JSON.parse(summary);

    expect(parsed.rows).toEqual([
      { id: "row-1", name: "Row Alpha" },
    ]);
    expect(parsed.columns).toEqual([
      { id: "col-1", name: "Col One" },
    ]);
    expect(parsed.nodes).toEqual([
      {
        id: "node-1",
        name: "Node Alpha",
        tags: ["critical", "priority"],
        row: "row-1",
        column: "col-1",
        children: ["child-1"],
      },
      {
        id: "node-2",
        name: "Node Beta",
        tags: ["secondary", "beta"],
        row: null,
        column: null,
        children: [],
      },
    ]);
    expect(parsed.edges).toEqual([
      { from: "node-1", to: "node-2", label: "Depends on" },
    ]);
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

    const parsed = JSON.parse(summary);

    expect(parsed.edges).toEqual([
      { from: "b", to: "a" },
    ]);
  });
});

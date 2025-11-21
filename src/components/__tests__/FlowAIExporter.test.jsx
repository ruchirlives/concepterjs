import { serializeFlowAiSummary } from "../FlowAIExporter";

describe("serializeFlowAiSummary", () => {
  const baseGrid = {
    rows: [
      { id: "row-0-row-alpha", label: "Row Alpha", top: 0, bottom: 120, height: 120 },
    ],
    columns: [
      { id: "column-1-col-one", label: "Col One", left: 0, right: 200, width: 200 },
    ],
  };

  it("exports clean semantic graph data", () => {
    const summary = serializeFlowAiSummary({
      nodes: [
        {
          id: "node-2",
          position: { x: 300, y: 60 },
          data: {
            Name: "* Node Beta",
            Tags: "Secondary, group, Beta",
          },
        },
        {
          id: "node-1",
          position: { x: 50, y: 60 },
          data: {
            Name: "Node Alpha",
            gridAssignment: {
              rowId: "row-0-row-alpha",
              columnId: "column-1-col-one",
            },
            tags: ["Critical", "critical", "Priority", "Group"],
            children: [{ id: "child-1" }, { id: "child-1" }],
          },
        },
        {
          id: "node-3",
          position: { x: 500, y: 60 },
          data: {
            Name: "Node Gamma",
            tags: ["Group"],
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
        {
          id: "edge-2",
          source: "node-3",
          target: "node-1",
          data: { label: "None" },
        },
      ],
      grid: baseGrid,
    });

    const parsed = JSON.parse(summary);

    expect(parsed.rows).toEqual([
      { id: "row-alpha", name: "Row Alpha" },
    ]);
    expect(parsed.columns).toEqual([
      { id: "col-one", name: "Col One" },
    ]);
    expect(parsed.nodes).toEqual([
      {
        id: "node-1",
        name: "Node Alpha",
        tags: ["critical", "priority"],
        row: "row-alpha",
        column: "col-one",
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
      {
        id: "node-3",
        name: "Node Gamma",
        row: null,
        column: null,
        children: [],
      },
    ]);
    expect(parsed.edges).toEqual([
      { from: "node-1", to: "node-2", label: "Depends on" },
      { from: "node-3", to: "node-1" },
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

  it("only exports selected nodes while pruning unselected children", () => {
    const summary = serializeFlowAiSummary({
      nodes: [
        { id: "row-0-row-alpha", data: { Name: "Row Alpha" } },
        {
          id: "node-1",
          selected: true,
          data: {
            Name: "Parent Node",
            children: ["node-2", "node-3"],
          },
        },
        { id: "node-2", data: { Name: "Hidden Child" } },
        { id: "node-3", selected: true, data: { Name: "Visible Child" } },
        { id: "column-0-col-one", data: { Name: "Column One" } },
      ],
      edges: [
        { id: "edge-1", source: "node-1", target: "node-2", data: { label: "Hidden" } },
        { id: "edge-2", source: "node-1", target: "node-3", data: { label: "Visible" } },
      ],
      grid: baseGrid,
    });

    const parsed = JSON.parse(summary);

    expect(parsed.nodes).toEqual([
      { id: "column-0-col-one", name: "Column One", children: [] },
      { id: "node-1", name: "Parent Node", children: ["node-3"], row: null, column: null },
      { id: "row-0-row-alpha", name: "Row Alpha", children: [] },
      { id: "node-3", name: "Visible Child", children: [], row: null, column: null },
    ]);

    expect(parsed.edges).toEqual([
      { from: "node-1", to: "node-3", label: "Visible" },
    ]);
  });
});

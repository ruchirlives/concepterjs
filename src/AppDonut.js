import React, { useMemo, useEffect, useState } from "react";
import { AgCharts } from "ag-charts-react";
import { useAppContext } from "./AppContext";
import { useMatrixLogic } from "./hooks/useMatrixLogic";


// Converts chartData to arrays for each donut ring
function getDonutSeriesData(chartData) {
  const rings = [];
  chartData.forEach(({ orgHierarchy, value }) => {
    orgHierarchy.forEach((name, i) => {
      if (!rings[i]) rings[i] = {};
      if (!rings[i][name]) {
        rings[i][name] = { value: 0 };
      }
      // Add value to every segment in the path, not just the leaf
      rings[i][name].value += value;
    });
  });
  // Convert objects to arrays with label keys
  return rings.map((ring, i) => {
    const key = ["outer", "middle", "inner", "level3", "level4", "level5"][i] || `level${i}`;
    return Object.entries(ring).map(([name, obj]) => ({
      [key]: name,
      value: obj.value,
    }));
  });
}

const AppDonut = ({ targetId }) => {
  const { rowData } = useAppContext();
  const { childrenMap, nameById } = useMatrixLogic();

  // Use state for id so it can be updated by BroadcastChannel
  const [id, setId] = useState(
    targetId || (rowData.length > 0 ? rowData[0].id.toString() : "")
  );

  // Subscribe to rowSelectChannel
  useEffect(() => {
    const channel = new BroadcastChannel("rowSelectChannel");
    const handler = (event) => {
      if (event?.data?.nodeId) {
        setId(event.data.nodeId.toString());
      }
    };
    channel.addEventListener("message", handler);
    return () => {
      channel.close();
    };
  }, []);

  // Convert your hierarchical data to AG Charts flat array format
  const chartData = useMemo(() => {
    if (!id) return [];

    // Helper to recursively build hierarchy paths
    const buildPaths = (currentId, path = []) => {
      const label = nameById?.[currentId] || currentId;
      const newPath = [...path, label];
      const parents = Object.entries(childrenMap)
        .filter(([pid, childList]) => childList.includes(currentId))
        .map(([pid]) => pid);

      if (parents.length === 0) {
        // Leaf node (top-most ancestor)
        return [{ orgHierarchy: newPath.reverse(), value: 1 }];
      }

      // For each parent, continue building the path
      return parents.flatMap((pid) => buildPaths(pid, newPath));
    };

    return buildPaths(id);
  }, [id, childrenMap, nameById]);

  // Convert chartData to series data for each donut ring
  const [outer = [], middle = [], inner = []] = getDonutSeriesData(chartData);

  // AG Charts Sunburst config
  const options = {
    title: {
      text: "Your Donut Chart",
    },
    series: [
      {
        data: outer,
        type: "donut",
        sectorLabelKey: "outer", // <-- use sectorLabelKey for segment labels
        angleKey: "value",
        radiusKey: "value",
        outerRadiusRatio: 0.8,
        innerRadiusRatio: 0.6,
        fillOpacity: 0.4,
      },
      {
        data: middle,
        type: "donut",
        sectorLabelKey: "middle",
        angleKey: "value",
        outerRadiusRatio: 0.6,
        innerRadiusRatio: 0.4,
        fillOpacity: 0.6,
      },
      {
        data: inner,
        type: "donut",
        sectorLabelKey: "inner",
        angleKey: "value",
        outerRadiusRatio: 0.4,
        innerRadiusRatio: 0,
      },
    ],
    legend: { enabled: false },
  };

  return (
    <div className="bg-white rounded shadow p-4" style={{ width: 500, height: 500 }}>
      <h2 className="font-semibold mb-2">Donut View</h2>
      <AgCharts options={options} />
    </div>
  );
};

export default AppDonut;

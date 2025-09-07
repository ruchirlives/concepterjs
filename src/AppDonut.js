import React, { useMemo, useEffect, useState } from "react";
import { AgCharts } from "ag-charts-react";
import { useAppContext } from "./AppContext";
import { useMatrixLogic } from "./hooks/useMatrixLogic";

// Converts chartData to arrays for each donut ring
function getDonutSeriesData(chartData) {
  const rings = [];
  
  // First pass: collect all unique names at each level to create dynamic keys
  const levelNames = [];
  chartData.forEach(({ orgHierarchy }) => {
    orgHierarchy.forEach((name, i) => {
      if (!levelNames[i]) levelNames[i] = new Set();
      levelNames[i].add(name);
    });
  });
  
  // Create dynamic ring keys based on the most common/first name at each level
  // or use generic names like "level0", "level1", etc.
  const ringKeys = levelNames.map((nameSet, i) => {
    // You can customize this logic:
    // Option 1: Use the first name at each level (good for consistent hierarchy)
    const firstName = Array.from(nameSet)[0];
    if (firstName && firstName.length > 20) {
      return `level${i}`; // Use generic name if the name is too long
    }
    return firstName ? firstName.toLowerCase().replace(/\s+/g, '') : `level${i}`;
    
    // Option 2: Just use generic level names
    // return `level${i}`;
  });
  
  // Second pass: build the rings data
  chartData.forEach(({ orgHierarchy, value }) => {
    orgHierarchy.forEach((name, i) => {
      if (!rings[i]) rings[i] = {};
      if (!rings[i][name]) {
        rings[i][name] = { value: 0 };
      }
      rings[i][name].value += value;
    });
  });
  
  return rings.map((ring, i) => {
    const key = ringKeys[i] || `level${i}`;
    return Object.entries(ring).map(([name, obj]) => ({
      [key]: name.length > 30 ? name.substring(0, 30) + "..." : name, // <-- Truncate long names
      value: obj.value,
    }));
  });
}

const AppDonut = ({ targetId }) => {
  const { rowData } = useAppContext();
  const { childrenMap, nameById } = useMatrixLogic();

  const [id, setId] = useState(
    targetId || (rowData.length > 0 ? rowData[0].id.toString() : "")
  );

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

  const chartData = useMemo(() => {
    if (!id) return [];

    const buildPaths = (currentId, path = []) => {
      const label = nameById?.[currentId] || currentId;
      const newPath = [...path, label];
      const parents = Object.entries(childrenMap)
        .filter(([pid, childList]) => childList.includes(currentId))
        .map(([pid]) => pid);

      if (parents.length === 0) {
        return [{ orgHierarchy: newPath.reverse(), value: 1 }];
      }

      return parents.flatMap((pid) => buildPaths(pid, newPath));
    };

    return buildPaths(id);
  }, [id, childrenMap, nameById]);

  // Convert chartData to series data for each donut ring
  const donutRings = useMemo(() => getDonutSeriesData(chartData), [chartData]);

  // Build series dynamically based on available rings
  const series = useMemo(() => {
    // Extract the dynamic ring keys from the data
    const ringKeys = donutRings.map((ringData, i) => {
      if (ringData.length > 0) {
        // Get the key from the first data item (excluding 'value')
        const keys = Object.keys(ringData[0]).filter(k => k !== 'value');
        return keys[0] || `level${i}`;
      }
      return `level${i}`;
    });
    
    return donutRings.map((ringData, i) => {
      if (ringData.length === 0) return null;
      
      const labelKey = ringKeys[i];
      const numRings = donutRings.filter(ring => ring.length > 0).length;
      
      // Calculate ring ratios dynamically based on number of rings
      const outerRatio = 1 - (i * 0.8 / numRings);
      const innerRatio = Math.max(0, outerRatio - (0.8 / numRings));
      
      const seriesConfig = {
        data: ringData,
        type: "donut",
        angleKey: "value",
        outerRadiusRatio: outerRatio,
        innerRadiusRatio: innerRatio,
        fillOpacity: 0.6 + (i * 0.1),
        // sectorLabelKey: labelKey,
        // sectorLabel: {
        //   color: "white",
        //   fontWeight: "bold",  
        //   fontSize: 10,
        //   rotation: "tangential", // or "tangential" for different curve behavior
        //   avoidCollisions: false,
        //   // You can also try:
        //   // rotation: "tangential", // Alternative curve style
        //   // offset: 10, // Push text toward outer edge of ring
        //   // textAlign: "center", // Center text within the segment
        // },
      };

      // Use callout for outer rings, curved sector labels for inner rings
      if (i === 0) {
        seriesConfig.calloutLabelKey = labelKey;
        seriesConfig.calloutLabel = { offset: 15, fontSize: 11 };
      } else {
        seriesConfig.sectorLabelKey = labelKey;
        seriesConfig.sectorLabel = {
          color: "white",
          fontWeight: "bold",
          fontSize: 10,
          rotation: "auto",
          avoidCollisions: false,
        };
      }

      return seriesConfig;
    }).filter(Boolean);
  }, [donutRings]);

  const options = {
    title: {
      text: "Hierarchy Donut Chart",
    },
    series,
    legend: { enabled: false },
    // Make the chart fill more of the container
    width: 700,
    height: 700,
  };

  return (
    <div className="bg-white rounded shadow p-4" style={{ width: 800, height: 800 }}> {/* Increased from 500x500 */}
      <h2 className="font-semibold mb-2">Donut View</h2>
      <AgCharts options={options} />
    </div>
  );
};

export default AppDonut;

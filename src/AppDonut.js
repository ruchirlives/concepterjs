import React, { useMemo, useEffect, useState } from "react";
import { AgCharts } from "ag-charts-react";
import { useAppContext } from "./AppContext";
import { useMatrixLogic } from "./hooks/useMatrixLogic";

// Helper function to find direct parent of a node
function findDirectParent(nodeId, childrenMap) {
  for (const [parentId, children] of Object.entries(childrenMap)) {
    if (children.includes(nodeId)) {
      return parentId;
    }
  }
  return null;
}

// Converts data to hierarchical donut ring structure with proper angular constraints
function getDonutSeriesData(startNodeId, childrenMap, nameById) {
  if (!startNodeId || !childrenMap || !nameById) return [];

  const rings = [];
  let currentLevelNodes = [{ nodeId: startNodeId, parentId: null, parentAngle: 0, parentArc: 360 }];
  const maxRings = 5;
  let ringIndex = 0;
  const processedNodes = new Set();

  while (currentLevelNodes.length > 0 && ringIndex < maxRings) {
    const newNodes = currentLevelNodes.filter(node => !processedNodes.has(node.nodeId));
    if (newNodes.length === 0) break;

    const ringData = [];

    // Group nodes by their parent to handle angular constraints
    const nodesByParent = new Map();
    newNodes.forEach(node => {
      const parentKey = node.parentId || 'root';
      if (!nodesByParent.has(parentKey)) {
        nodesByParent.set(parentKey, []);
      }
      nodesByParent.get(parentKey).push(node);
    });

    // Calculate angles for each parent group
    nodesByParent.forEach((siblings, parentKey) => {
      const parentArc = siblings[0].parentArc || 360;
      const parentAngle = siblings[0].parentAngle || 0;
      const arcPerSibling = parentArc / siblings.length;

      siblings.forEach((node, siblingIndex) => {
        const nodeName = nameById[node.nodeId] || node.nodeId;
        const startAngle = parentAngle + (siblingIndex * arcPerSibling);
        const endAngle = startAngle + arcPerSibling;

        ringData.push({
          nodeId: node.nodeId,
          name: nodeName,
          value: 1,
          parentId: node.parentId,
          startAngle: startAngle,
          endAngle: endAngle,
          arc: arcPerSibling
        });

        processedNodes.add(node.nodeId);
      });
    });

    rings.push(ringData);

    // Find parents for next ring level with their angular constraints
    const parentNodes = [];
    newNodes.forEach(node => {
      Object.entries(childrenMap).forEach(([parentId, children]) => {
        if (children.includes(node.nodeId) && !processedNodes.has(parentId)) {
          // Find the angular constraints for this parent
          const nodeData = ringData.find(r => r.nodeId === node.nodeId);
          parentNodes.push({
            nodeId: parentId,
            parentId: findDirectParent(parentId, childrenMap),
            parentAngle: nodeData ? nodeData.startAngle : 0,
            parentArc: nodeData ? nodeData.arc : 360
          });
        }
      });
    });

    // Remove duplicates while preserving angular info
    const uniqueParents = [];
    const seenParents = new Set();
    parentNodes.forEach(parent => {
      if (!seenParents.has(parent.nodeId)) {
        seenParents.add(parent.nodeId);
        uniqueParents.push(parent);
      }
    });

    currentLevelNodes = uniqueParents;
    ringIndex++;
  }

  // Convert to AG Charts format with proper angular data
  return rings.map((ringData, i) => {
    const key = `level${i}`;
    return ringData.map(({ name, value, startAngle, endAngle }) => ({
      [key]: name && name.length > 25 ? name.substring(0, 25) + "..." : name || "Unknown",
      value: value,
      startAngle: startAngle,
      endAngle: endAngle,
    }));
  });
}

const AppDonut = ({ targetId }) => {
  const { rowData } = useAppContext();
  const { childrenMap, nameById } = useMatrixLogic();

  const [id, setId] = useState(
    targetId || (rowData && rowData.length > 0 ? rowData[0].id.toString() : "")
  );

  useEffect(() => {
    const channel = new BroadcastChannel('selectNodeChannel');

    channel.onmessage = (event) => {
      console.log("AppDonut received:", event.data);
      const { nodeId } = event.data;
      if (nodeId) {
        setId(nodeId.toString());
      }
    };

    return () => channel.close();
  }, []);

  // Convert to series data for each donut ring
  const donutRings = useMemo(() => {
    console.log("Building donut rings for id:", id);
    if (!id || !childrenMap || !nameById) {
      console.log("Missing data:", { id, hasChildrenMap: !!childrenMap, hasNameById: !!nameById });
      return [];
    }
    try {
      return getDonutSeriesData(id, childrenMap, nameById);
    } catch (error) {
      console.error("Error building donut rings:", error);
      return [];
    }
  }, [id, childrenMap, nameById]);

  // Build series dynamically based on available rings
  const series = useMemo(() => {
    console.log("Donut rings:", donutRings.length, "rings");

    if (!donutRings || donutRings.length === 0) {
      return [];
    }

    return donutRings.map((ringData, i) => {
      if (!ringData || ringData.length === 0) return null;

      const labelKey = `level${i}`;
      const numRings = donutRings.filter(ring => ring && ring.length > 0).length;

      // Calculate ring ratios - center (i=0) is selected node, outer rings are parents
      const outerRatio = Math.min(1, 0.2 + ((i + 1) * 0.8 / numRings));
      const innerRatio = i === 0 ? 0 : Math.max(0, 0.2 + (i * 0.8 / numRings));

      const seriesConfig = {
        data: ringData,
        type: "donut",
        angleKey: "value",
        outerRadiusRatio: outerRatio,
        innerRadiusRatio: innerRatio,
        fillOpacity: Math.min(1, 0.6 + (i * 0.1)),
      };

      // Add angular constraints if available
      if (ringData[0] && ringData[0].startAngle !== undefined) {
        seriesConfig.startAngleKey = "startAngle";
        seriesConfig.endAngleKey = "endAngle";
      }

      // Use different label strategies based on ring
      if (i === 0) {
        // Center ring - use sector labels
        seriesConfig.sectorLabelKey = labelKey;
        seriesConfig.sectorLabel = {
          color: "white",
          fontWeight: "bold",
          fontSize: 12,
        };
      } else {
        // Outer rings - use callout labels
        seriesConfig.calloutLabelKey = labelKey;
        seriesConfig.calloutLabel = {
          offset: 10 + (i * 3),
          fontSize: Math.max(8, 9 + (i * 1)),
          avoidCollisions: true
        };
      }

      return seriesConfig;
    }).filter(Boolean);
  }, [donutRings]);

  const options = {
    title: {
      text: "Hierarchy Chart",
    },
    subtitle: {
      text: `Center: ${nameById?.[id] || id || "No selection"}`,
    },
    series,
    legend: { enabled: false },
    width: 700,
    height: 700,
  };

  if (!id) {
    return (
      <div className="bg-white rounded shadow p-4" style={{ width: 800, height: 800 }}>
        <h2 className="font-semibold mb-2">Donut View</h2>
        <p>No node selected</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded shadow p-4" style={{ width: 800, height: 800 }}>
      <h2 className="font-semibold mb-2">Donut View</h2>
      <AgCharts options={options} />
    </div>
  );
};

export default AppDonut;

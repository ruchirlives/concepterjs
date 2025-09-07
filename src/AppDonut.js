import React, { useMemo } from "react";
import { Sunburst } from "@ant-design/plots";
import { useAppContext } from "./AppContext";
import { useMatrixLogic } from "./hooks/useMatrixLogic";

const AppDonut = ({ targetId }) => {
  const { rowData } = useAppContext();
  const { childrenMap, nameById } = useMatrixLogic();

  const id = targetId || (rowData.length > 0 ? rowData[0].id.toString() : "");

  const data = useMemo(() => {
    if (!id) return { name: "", children: [] };

    const getParents = (childId) => {
      const parents = [];
      Object.entries(childrenMap).forEach(([pid, childList]) => {
        if (childList.includes(childId)) {
          parents.push(pid);
        }
      });
      return parents;
    };

    const parentIds = getParents(id);

    return {
      name: nameById?.[id] || id,
      children: parentIds.map((pid) => {
        const grandParents = getParents(pid);
        return {
          name: nameById?.[pid] || pid,
          children: grandParents.length
            ? grandParents.map((gid) => ({
                name: nameById?.[gid] || gid,
                value: 1,
              }))
            : [{ name: "", value: 1 }],
        };
      }),
    };
  }, [id, childrenMap, nameById]);

  const config = {
    data,
    innerRadius: 0.2,
    label: {
      content: "name",
      style: {
        fontSize: 10,
      },
    },
  };

  return (
    <div className="bg-white rounded shadow p-4">
      <h2 className="font-semibold mb-2">Donut View</h2>
      <Sunburst {...config} />
    </div>
  );
};

export default AppDonut;

import React, { useState } from "react";
import { WordCloud } from "@ant-design/plots";
import { useAppContext } from "./AppContext";
import { useMatrixLogic } from "./hooks/useMatrixLogic"; // <-- add this

function getWords(rowData, childrenMap) {
    return rowData
        .filter(row => row.Name)
        .map(row => ({
            text: row.Name,
            value: Array.isArray(childrenMap[row.id]) ? childrenMap[row.id].length : 0
        }));
}

const AppWordcloud = () => {
    const { rowData } = useAppContext();
    const { childrenMap } = useMatrixLogic(); // <-- get childrenMap from useMatrixLogic
    const [collapsed, setCollapsed] = useState(false);
    const [wordData, setWordData] = useState([]);

    const handleCalculate = () => {
        setWordData(getWords(rowData, childrenMap));
    };

    const config = {
        data: wordData,
        wordField: 'text',
        weightField: 'value',
        colorField: 'text',
        height: 300,
        layout: { spiral: 'rectangular' },
    };

    return (
        <div className="bg-white rounded shadow">
            <div onClick={() => setCollapsed(c => !c)} className="flex justify-between items-center bg-white text-black px-4 py-2 cursor-pointer select-none">
                <span className="font-semibold">Word Cloud</span>
                <button className="text-lg font-bold" aria-label={collapsed ? "Expand word cloud" : "Collapse word cloud"}>
                    {collapsed ? "▼" : "▲"}
                </button>
            </div>
            <div className={`transition-all duration-300 overflow-auto`} style={{ height: collapsed ? 0 : 350 }}>
                <div className="p-4" style={{ height: 300 }}>
                    {!collapsed && (
                        <>
                            <button
                                className="mb-2 px-3 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600"
                                onClick={handleCalculate}
                            >
                                Calculate
                            </button>
                            {<WordCloud {...config} />}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AppWordcloud;
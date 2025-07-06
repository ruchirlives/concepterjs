import React, { useState } from "react";
import { SimpleEditor } from "./@/components/tiptap-templates/simple/simple-editor";

const AppTiptap = () => {
    const [collapsed, setCollapsed] = useState(true);

    return (
            <div className="p-4 rounded shadow">
                <div
                    className="flex justify-between items-center cursor-pointer user-select-text px-4 py-2"
                    onClick={() => setCollapsed(!collapsed)}
                >
                    <span className="font-semibold text-lg select-text">Rich Text Editor</span>
                    <button
                        aria-label={collapsed ? "Expand editor" : "Collapse editor"}
                        className="text-xl font-bold select-text"
                    >
                        {collapsed ? "▼" : "▲"}
                    </button>
                </div>

                <div
                    className={`transition-all duration-300 overflow-hidden ${collapsed ? "" : "max-h-[800px] overflow-y-auto"
                        }`}
                >
                    {!collapsed && (
                        <div>
                            <SimpleEditor />
                        </div>
                    )}
                </div>


            </div>
    );
};

export default AppTiptap;

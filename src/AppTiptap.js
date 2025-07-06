import React, { useState } from "react";
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor'

const AppTiptap = () => {
    const [collapsed, setCollapsed] = useState(true);

    return (
        <div className="bg-white rounded shadow">
            <div
                className="flex justify-between items-center cursor-pointer select-none px-4 py-2"
                onClick={() => setCollapsed(!collapsed)}
            >
                <span className="font-semibold text-lg">Editor</span>
                <button
                    aria-label={collapsed ? "Expand editor" : "Collapse editor"}
                    className="text-xl font-bold"
                >
                    {collapsed ? "▼" : "▲"}
                </button>
            </div>

            <div
                className="transition-all duration-300 overflow-auto"
                style={{ height: collapsed ? 0 : '400px' }}
            >
                {!collapsed && (
                    <div className="h-full overflow-y-auto">
                        <SimpleEditor />
                    </div>
                )}
            </div>
        </div>
    );
};

export default AppTiptap;

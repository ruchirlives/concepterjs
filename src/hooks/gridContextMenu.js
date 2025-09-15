import React, { useRef, useState } from "react";
import { fetchParentContainers, addChildren, removeChildren, deleteContainers, mergeContainers, fetchContainerById, fetchChildren } from "../api";
import { writeBackUpdatedData } from "./effectsShared";
import { addTagToNodes, removeTagFromNodes } from "./gridEffects";
import { useMenuHandlers } from "./useContextMenu"
import { useAppContext } from "../AppContext";


// Helper to render a menu item
const MenuItem = ({ label, onClick, children, ...props }) => (
    <div onClick={onClick} style={{ padding: "8px", cursor: "pointer", position: "relative" }} {...props}>
        {label}
        {children}
    </div>
);

// Helper to render a submenu
const SubMenu = ({ label, show, setShow, options, onMenuItemClick, gridApiRef, setRowData, type }) => (
    <MenuItem
        label={label}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
    >
        {show && (
            <div style={{ position: "absolute", left: "100%", top: 0, backgroundColor: "#fff", border: "1px solid #ccc", zIndex: 1000 }}>
                {options.map((l) => (
                    <div key={l} style={{ padding: "4px 8px", cursor: "pointer" }} onClick={() => onMenuItemClick(type, gridApiRef, setRowData, null, l)}>
                        {l}
                    </div>
                ))}
            </div>
        )}
    </MenuItem>
);

const menuConfig = [
    { label: "View Details", action: "view" },
    { label: "Delay by Days", action: "delay by days" },
    { label: "Update Gantt", action: "update gantt" },
    { label: "Update Mermaid", action: "update mermaid" },
    { label: "Hide Unselected", action: "hide unselected" },
    { label: "Delete", action: "delete" },
    { label: "Parent Containers", action: "parents" },
    { label: "Add Children", action: "add children" },
    { label: "Create Children", action: "create children" },
    { label: "Remove Children", action: "remove children" },
    { label: "Select Children", action: "select children" },
    { label: "Add Tag", action: "add tag" },
    // Layer submenus handled separately
    { label: "Merge Selected", action: "merge selected" },
    { label: "Export to App", action: "export to app" },
];

const ContextMenu = React.forwardRef(({ onMenuItemClick, gridApiRef, setRowData, handleAddRow, activeLayers = [], layerOptions = [] }, ref) => {
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [showRemoveMenu, setShowRemoveMenu] = useState(false);

    return (
        <div
            ref={ref}
            style={{
                position: "absolute",
                display: "none",
                backgroundColor: "#ffffff",
                border: "1px solid #ccc",
                zIndex: 1000,
                boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
                padding: "8px",
            }}
        >
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                    gap: "4px",
                    alignItems: "stretch",
                }}
            >
                {menuConfig.map(({ label, action }) => (
                    <MenuItem
                        key={action}
                        label={label}
                        onClick={() => onMenuItemClick(action, gridApiRef, setRowData, handleAddRow)}
                    />
                ))}
                <SubMenu
                    label="Add to Layer"
                    show={showAddMenu}
                    setShow={setShowAddMenu}
                    options={layerOptions}
                    onMenuItemClick={onMenuItemClick}
                    gridApiRef={gridApiRef}
                    setRowData={setRowData}
                    type="add layer"
                />
                <SubMenu
                    label="Remove from Layer"
                    show={showRemoveMenu}
                    setShow={setShowRemoveMenu}
                    options={layerOptions}
                    onMenuItemClick={onMenuItemClick}
                    gridApiRef={gridApiRef}
                    setRowData={setRowData}
                    type="remove layer"
                />
            </div>
        </div>
    );
});

// Custom hook for managing context menu logic
export const useContextMenu = () => {
    const menuRef = useRef(null);
    const prevID = useRef(null);
    const { rowData, setRowData } = useAppContext();
    const {exportApp} = useMenuHandlers(rowData, setRowData);

    // Helper for getting selected nodes/ids
    const getSelection = (gridApi) => {
        const selectedNodes = gridApi.getSelectedNodes();
        const selectedIds = selectedNodes.map((node) => node.data.id);
        return { selectedNodes, selectedIds };
    };

    const handleContextMenu = (params) => {
        params.event.preventDefault();
        const rowId = params.node.data.id;
        const menu = menuRef.current;
        if (menu) {
            const x = params.event.clientX || (params.event.touches && params.event.touches[0].clientX);
            const y = params.event.clientY || (params.event.touches && params.event.touches[0].clientY);
            menu.style.left = `${x}px`;
            menu.style.top = `${y}px`;
            menu.style.display = "block";
            menu.dataset.rowId = rowId;
        }
    };

    // Action handlers
    const actionHandlers = {
        "export to app": ({ rowId }) => exportApp(rowId),
        "view": ({ rowId }) => alert(`View details for Row ID: ${rowId}`),
        "delete": async ({ gridApi, setRowData, selectedNodes, selectedIds }) => {
            if (window.confirm("Are you sure you want to delete these rows?")) {
                selectedNodes.forEach((node) => gridApi.applyTransaction({ remove: [node.data] }));
                setRowData((prevData) => prevData.filter((row) => !selectedIds.includes(row.id)));
                const response = await deleteContainers(selectedIds);
                if (!response) alert("Failed to delete rows.");
            }
        },
        "parents": async ({ rowId, gridApi }) => {
            try {
                const data = await fetchParentContainers(rowId);
                data.map((container) => container.id).forEach((parentId) => {
                    const parentNode = gridApi.getRowNode(parentId);
                    if (parentNode) parentNode.setSelected(true);
                });
            } catch {
                alert("Failed to fetch parent containers.");
            }
        },
        "add children": async ({ rowId, selectedIds }) => {
            const response = await addChildren(rowId, selectedIds);
            if (!response) alert("Failed to add children.");
        },
        "create children": async ({ rowId, handleAddRow }) => {
            const result = await handleAddRow();
            // Normalize result to array of created/selected rows
            let created = [];
            if (Array.isArray(result)) {
                created = result;
            } else if (result && (Array.isArray(result.loadedNodes) || Array.isArray(result.newRows))) {
                const a = Array.isArray(result.loadedNodes) ? result.loadedNodes : [];
                const b = Array.isArray(result.newRows) ? result.newRows : [];
                created = [...a, ...b];
            }
            if (!Array.isArray(created) || created.length === 0) return alert("No children created.");
            const newRowIds = created.map((row) => row.id);
            const response = await addChildren(rowId, newRowIds);
            if (!response) alert("Failed to create children.");
        },
        "remove children": async ({ rowId, selectedIds }) => {
            const response = await removeChildren(rowId, selectedIds);
            if (response) alert("Children removed successfully.");
            else alert("Failed to remove children.");
        },
        "hide unselected": ({ gridApi, setRowData, selectedIds }) => {
            gridApi.forEachNode((node) => {
                if (!selectedIds.includes(node.data.id)) {
                    setRowData((prevData) => prevData.filter((row) => row.id !== node.data.id));
                }
            });
        },
        "add tag": ({ gridApi, selectedNodes }) => {
            const tag = window.prompt("Enter a tag for the selected rows:");
            if (tag) addTagToNodes(selectedNodes, tag, gridApi);
        },
        "add layer": ({ gridApi, selectedNodes }, layer) => {
            if (layer) addTagToNodes(selectedNodes, layer, gridApi);
        },
        "remove layer": ({ gridApi, selectedNodes }, layer) => {
            if (layer) removeTagFromNodes(selectedNodes, layer, gridApi);
        },
        "merge selected": async ({ selectedIds, setRowData }) => {
            const response = await mergeContainers(selectedIds);
            if (response) {
                const mergedRowId = response.id;
                const mergedRowData = await fetchContainerById(mergedRowId);
                const mergedRow = mergedRowData[0];
                setRowData((prevData) => {
                    const updatedData = prevData.filter((row) => !selectedIds.includes(row.id));
                    return [...updatedData, mergedRow];
                });
            } else {
                alert("Failed to merge rows.");
            }
        },
        "select children": async ({ gridApi, selectedNodes }) => {
            for (const node of selectedNodes) {
                const children = await fetchChildren(node.data.id);
                children.forEach((childNode) => {
                    const childNodeInGrid = gridApi.getRowNode(childNode.id);
                    if (childNodeInGrid) childNodeInGrid.setSelected(true);
                });
            }
        },
        "delay by days": async ({ gridApi, selectedNodes, setRowData, prevID }) => {
            const delayDays = window.prompt("Enter the number of days to delay:");
            selectedNodes.forEach((node) => {
                node.data.StartDate = new Date(node.data.StartDate);
                node.data.StartDate.setDate(node.data.StartDate.getDate() + parseInt(delayDays));
                node.data.EndDate = new Date(node.data.EndDate);
                node.data.EndDate.setDate(node.data.EndDate.getDate() + parseInt(delayDays));
                gridApi.applyTransaction({ update: [node.data] });
            });
            await writeBackUpdatedData(gridApi, prevID);
        },
        "update gantt": async ({ gridApi, prevID }) => {
            await writeBackUpdatedData(gridApi, prevID, 'gantt');
        },
        "update mermaid": async ({ gridApi, prevID }) => {
            await writeBackUpdatedData(gridApi, prevID, 'mermaid');
        },
    };

    const onMenuItemClick = async (action, gridApiRef, setRowData, handleAddRow, layer) => {
        const menu = menuRef.current;
        const rowId = menu ? menu.dataset.rowId : null;
        const gridApi = gridApiRef.current;
        const { selectedNodes, selectedIds } = getSelection(gridApi);
        const ctx = { gridApi, setRowData, handleAddRow, rowId, selectedNodes, selectedIds, prevID };
        if (actionHandlers[action]) {
            await actionHandlers[action](ctx, layer);
        }
        // Hide menu after action
        if (menu) menu.style.display = "none";
    };

    const hideMenu = () => {
        const menu = menuRef.current;
        if (menu) menu.style.display = "none";
    };

    return { menuRef, handleContextMenu, onMenuItemClick, hideMenu };
};


export default ContextMenu;



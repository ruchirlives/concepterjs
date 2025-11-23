import React, { useMemo } from "react";
import { useNodeSearchAndSelect } from "../hooks/useNodeSearchAndSelect";

export default function NodeSearchBox({
    layerOptions = [],
    rowData = [],
    showTags = true,
    showSearchButton = true,
    selectedIds,
    setSelectedIds,
    searchTerm,
    setSearchTerm,
    selectedContentLayer = null,
    initialResults = [],
    renderExtraControls = null,
}) {
    const {
        searchResults,
        searchLoading,
        searchError,
        handleSearch,
        handleCheckboxChange,
        tagsSearchTerm,
        setTagsSearchTerm,
        otherTag,
        setOtherTag,
        selectedRows,
        rememberRows,
    } = useNodeSearchAndSelect(selectedIds,
        setSelectedIds, searchTerm, setSearchTerm);

    // For asterisk display
    const existingIds = new Set((rowData || []).map((row) => row.id));

    // Parse comma-separated tags from the input box
    const getAllTags = () => {
        let tags = tagsSearchTerm.filter((tag) => layerOptions.includes(tag));
        const otherTags = (otherTag || "")
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
        tags = Array.from(new Set([...tags, ...otherTags]));
        return tags;
    };

    const handleSearchWithTags = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        setTagsSearchTerm(getAllTags());
        handleSearch(e);
    };

    const handleTagToggle = (tag) => {
        setTagsSearchTerm((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
        );
    };

    const getRowId = (row, fallback) => row?.id ?? row?._id ?? row?.__searchId ?? fallback;

    // Select all visible search results
    const handleSelectAll = () => {
        const allIds = displayResults.map((row, idx) => getRowId(row, idx));
        setSelectedIds(allIds);
        rememberRows(displayResults.map((row, idx) => ({ id: getRowId(row, idx), row })));
    };

    // console.log("NodeSearchBox selectedIds:", selectedIds);
    // console.log("initialResults in NodeSearchBox:", initialResults);

    // Use initialResults if no search has been performed and searchTerm is empty
    const hasActiveFilters = tagsSearchTerm.length > 0 || (otherTag && otherTag.trim().length > 0);

    const displayResults = (
        searchTerm.trim() === "" &&
        initialResults.length > 0 &&
        !hasActiveFilters
    )
        ? initialResults
        : searchResults;

    const combinedResults = useMemo(() => {
        const merged = new Map();
        selectedRows.forEach((row, idx) => {
            const id = getRowId(row, idx);
            merged.set(String(id ?? idx), row);
        });
        displayResults.forEach((row, idx) => {
            const id = getRowId(row, idx);
            const key = String(id ?? idx);
            if (!merged.has(key)) {
                merged.set(key, row);
            }
        });
        return Array.from(merged.values());
    }, [selectedRows, displayResults]);

    return (
        <div
            className="text-gray-900"
            style={{ margin: "1rem 0", borderTop: "1px solid #eee", paddingTop: "1rem" }}
        >
            <label htmlFor="search-nodes"><b>Search Nodes</b></label>
            {showTags && (
                <div style={{ margin: "0.5rem 0" }}>
                    <b>Filter by tags:</b>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5em", marginTop: 4 }}>
                        {layerOptions.map((tag) => (
                            <label key={tag} style={{ marginRight: 8 }}>
                                <input
                                    type="checkbox"
                                    checked={tagsSearchTerm.includes(tag)}
                                    onChange={() => handleTagToggle(tag)}
                                />
                                <span style={{ marginLeft: 4 }}>{tag}</span>
                            </label>
                        ))}
                        {setOtherTag && (
                            <input
                                type="text"
                                value={otherTag}
                                onChange={(e) => setOtherTag(e.target.value)}
                                placeholder="Other tags (comma separated)..."
                                style={{
                                    marginLeft: 8,
                                    padding: "2px 6px",
                                    border: "1px solid #ccc",
                                    borderRadius: 4,
                                    minWidth: 120,
                                }}
                                onBlur={handleSearchWithTags}
                            />
                        )}
                    </div>
                </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                <input
                    id="search-nodes"
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Type to search nodes..."
                    style={{ flex: 1, padding: "6px", color: "#111827" }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            handleSearchWithTags(e);
                        }
                    }}
                    onBlur={handleSearchWithTags}
                    autoFocus
                />
                {showSearchButton && (
                    <button
                        type="button"
                        onClick={handleSearchWithTags}
                        disabled={searchLoading}
                        className="px-3 py-1 bg-gray-400 hover:bg-gray-500 text-white text-sm font-medium rounded"
                    >
                        {searchLoading ? "Searching..." : "Search"}
                    </button>
                )}
                <button
                    type="button"
                    onClick={handleSelectAll}
                    className="px-3 py-1 bg-gray-300 hover:bg-gray-400 text-gray-800 text-sm font-medium rounded"
                    style={{ marginLeft: 4 }}
                >
                    Select All
                </button>
                {renderExtraControls && (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        {typeof renderExtraControls === 'function'
                          ? renderExtraControls()
                          : renderExtraControls}
                    </div>
                )}
            </div>
            {searchError && (
                <div style={{ color: "red", marginTop: "0.5rem" }}>{searchError}</div>
            )}
            <div
                style={{
                    height: 350,
                    overflowY: "auto",
                    marginTop: 8,
                }}
            >
                <ul
                    className="space-y-1"
                    style={{
                        listStyle: "none",
                        padding: 0,
                        margin: 0,
                    }}
                >
                    {combinedResults.map((row, idx) => {
                        const id = getRowId(row, idx);
                        const isExisting = existingIds.has(id);
                        // Limit name and children string to 50 chars
                        const displayName = (row.Name || row.name || "(no name)");
                        const truncatedName = displayName;
                        let childrenStr = "";
                        if (row.children && row.children.length > 0) {
                            childrenStr = row.children
                                .map(
                                    (child) =>
                                        `${child.position?.Name || child.position?.name || ""} - ${child.Name || child.name || ""}`
                                )
                                .join(", ");
                            if (childrenStr.length > 50) {
                                childrenStr = childrenStr.slice(0, 50) + "...";
                            }
                        }
                        return (
                            <li
                                key={id}
                                className="p-2 bg-gray-50 hover:bg-gray-100 rounded cursor-pointer text-gray-900"
                                style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #eee" }}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedIds.map(String).includes(String(id))}
                                    onChange={() => handleCheckboxChange(id, row)}
                                    style={{ marginRight: 8 }}
                                />
                                <span style={{ fontWeight: 500 }}>
                                    {truncatedName}
                                    {isExisting && <span style={{ color: "#d00", marginLeft: 4 }}>*</span>}
                                </span>
                                {childrenStr && (
                                    <span style={{ color: "#374151", marginLeft: 12, fontSize: "0.95em" }}>
                                        {childrenStr}
                                    </span>
                                )}
                            </li>
                        );
                    })}
                    {displayResults.length === 0 &&
                        searchTerm &&
                        !searchLoading &&
                        !searchError && (
                            <li style={{ color: "#374151" }}>No results found.</li>
                        )}
                </ul>
            </div>
        </div>
    );
}

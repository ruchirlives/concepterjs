import React from "react";
import { useNodeSearchAndSelect } from "../hooks/useNodeSearchAndSelect";

export default function NodeSearchBox({
    layerOptions = [],
    rowData = [],
    showTags = true,
    showSearchButton = true,
    selectedIds,
    setSelectedIds,
    searchTerm,
    setSearchTerm
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
    } = useNodeSearchAndSelect(selectedIds,
        setSelectedIds);

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

    // Select all visible search results
    const handleSelectAll = () => {
        const allIds = searchResults.map((row, idx) => row.id || row._id || idx);
        setSelectedIds(allIds);
    };

    return (
        <div style={{ margin: "1rem 0", borderTop: "1px solid #eee", paddingTop: "1rem" }}>
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
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <input
                    id="search-nodes"
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Type to search nodes..."
                    style={{ flex: 1, padding: "6px" }}
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
                        disabled={searchLoading || !searchTerm}
                        className="px-3 py-1 bg-gray-400 hover:bg-gray-500 text-white text-sm font-medium rounded"
                    >
                        {searchLoading ? "Searching..." : "Search"}
                    </button>
                )}
                <button
                    type="button"
                    onClick={handleSelectAll}
                    className="px-3 py-1 bg-gray-300 hover:bg-gray-400 text-sm font-medium rounded"
                    style={{ marginLeft: 4 }}
                >
                    Select All
                </button>
            </div>
            {searchError && (
                <div style={{ color: "red", marginTop: "0.5rem" }}>{searchError}</div>
            )}
            <ul
                className="space-y-1"
                style={{
                    maxHeight: 350, // Increased from 150 to 350 for more vertical space
                    overflowY: "auto",
                    marginTop: 8,
                    listStyle: "none",
                    padding: 0,
                }}
            >
                {searchResults.map((row, idx) => {
                    const id = row.id || row._id || idx;
                    const isExisting = existingIds.has(id);
                    return (
                        <li
                            key={id}
                            className="p-2 bg-gray-50 hover:bg-gray-100 rounded cursor-pointer"
                            style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #eee" }}
                        >
                            <input
                                type="checkbox"
                                checked={selectedIds.includes(id)}
                                onChange={() => handleCheckboxChange(id)}
                                style={{ marginRight: 8 }}
                            />
                            <span style={{ fontWeight: 500 }}>
                                {row.Name || row.name || "(no name)"}
                                {isExisting && <span style={{ color: "#d00", marginLeft: 4 }}>*</span>}
                            </span>
                            {row.children && row.children.length > 0 && (
                                <span style={{ color: "#666", marginLeft: 12, fontSize: "0.95em" }}>
                                    {row.children
                                        .map(
                                            (child) =>
                                                `${child.position?.Name || child.position?.name || ""} - ${child.Name || child.name || ""}`
                                        )
                                        .join(", ")}
                                </span>
                            )}
                        </li>
                    );
                })}
                {searchResults.length === 0 &&
                    searchTerm &&
                    !searchLoading &&
                    !searchError && (
                        <li style={{ color: "#888" }}>No results found.</li>
                    )}
            </ul>
        </div>
    );
}
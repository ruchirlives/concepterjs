import { useEffect, useState } from "react";
import { searchNodes, loadNode } from "../api";

export function useNodeSearchAndSelect(selectedIds,
  setSelectedIds, searchTerm, setSearchTerm) {
  // const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [tagsSearchTerm, setTagsSearchTerm] = useState([]);
  const [otherTag, setOtherTag] = useState(""); // <-- Add this
  const [selectedRowsMap, setSelectedRowsMap] = useState(new Map());

  const handleSearch = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSearchLoading(true);
    setSearchError("");
    try {
      console.log("Searching nodes with term:", searchTerm, "and tags:", tagsSearchTerm);
      const results = await searchNodes(searchTerm, tagsSearchTerm);
      setSearchResults(results);
    } catch (err) {
      setSearchError("Error searching nodes.");
      setSearchResults([]);
    }
    setSearchLoading(false);
  };

  const ensureRowHasPersistedId = (row, id) => {
    if (!row) return row;
    if (row.id || row._id || row.__searchId) return row;
    return { ...row, __searchId: id };
  };

  const handleCheckboxChange = (id, row) => {
    const key = String(id);
    setSelectedIds((prev) => {
      const exists = prev.map(String).includes(key);
      setSelectedRowsMap((prevMap) => {
        const next = new Map(prevMap);
        if (exists) {
          next.delete(key);
        } else if (row) {
          const rowWithId = ensureRowHasPersistedId(row, id);
          next.set(key, rowWithId);
        }
        return next;
      });
      return exists ? prev.filter((sid) => String(sid) !== key) : [...prev, id];
    });
  };

  const rememberRows = (rows = []) => {
    setSelectedRowsMap((prevMap) => {
      const next = new Map(prevMap);
      rows.forEach(({ id, row }) => {
        if (row === undefined || row === null || id === undefined || id === null) return;
        const rowWithId = ensureRowHasPersistedId(row, id);
        next.set(String(id), rowWithId);
      });
      return next;
    });
  };

  useEffect(() => {
    setSelectedRowsMap((prevMap) => {
      const next = new Map();
      selectedIds.forEach((id) => {
        const key = String(id);
        if (prevMap.has(key)) {
          next.set(key, prevMap.get(key));
        }
      });
      return next;
    });
  }, [selectedIds]);

  const loadCheckedNodes = async () => {
    if (selectedIds.length === 0) return [];
    let loadedNodes = await Promise.all(
      selectedIds.map(async (id) => {
        try {
          return await loadNode(id);
        } catch (err) {
          console.error(`Failed to load node ${id}:`, err);
          return null;
        }
      })
    );
    return loadedNodes.filter(Boolean);
  };

  return {
    searchTerm,
    setSearchTerm,
    searchResults,
    setSearchResults,
    searchLoading,
    searchError,
    selectedIds,
    setSelectedIds,
    handleSearch,
    handleCheckboxChange,
    rememberRows,
    loadCheckedNodes,
    tagsSearchTerm,
    setTagsSearchTerm,
    otherTag,        // <-- Add this
    setOtherTag,     // <-- Add this
    selectedRows: Array.from(selectedRowsMap.values()),
  };
}

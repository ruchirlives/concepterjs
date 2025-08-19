import { useState } from "react";
import { searchNodes, loadNode } from "../api";

export function useNodeSearchAndSelect() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);

  const handleSearch = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSearchLoading(true);
    setSearchError("");
    try {
      const results = await searchNodes(searchTerm);
      setSearchResults(results);
    } catch (err) {
      setSearchError("Error searching nodes.");
      setSearchResults([]);
    }
    setSearchLoading(false);
  };

  const handleCheckboxChange = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

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
    loadCheckedNodes,
  };
}
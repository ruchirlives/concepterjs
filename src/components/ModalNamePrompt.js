import React, { useState } from "react";
import Modal from "react-modal";
import { searchNodes } from "../api";

Modal.setAppElement("#app");

let resolveNamePromise = null;

export function openNamePrompt() {
  return new Promise((resolve) => {
    resolveNamePromise = resolve;
    setModalVisible(true);
  });
}

let setModalVisible = () => { }; // Will be updated by the modal component

export default function NamePromptModal() {
  const [visible, setVisible] = useState(false);
  const [namesInput, setNamesInput] = useState("");
  const [splitByComma, setSplitByComma] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);

  setModalVisible = setVisible;

  const handleSubmit = (e) => {
    e.preventDefault();
    // Collect all checked ids from the results list
    const checkedIds = searchResults
      .map(result => result.id || result._id)
      .filter(id => selectedIds.includes(id));
    // Merge with any existing selectedIds (avoid duplicates)
    const allSelectedIds = Array.from(new Set([...selectedIds, ...checkedIds]));

    // If nothing entered in the main textbox and no checked items, do nothing
    if (!namesInput.trim() && allSelectedIds.length === 0) {
      // Optionally show a warning or just return
      return;
    }

    resolveNamePromise({
      namesInput: namesInput.trim(), // always a string
      splitByComma,
      selectedIds: allSelectedIds
    });
    setNamesInput("");
    setSplitByComma(false);
    setSearchTerm("");
    setSearchResults([]);
    setSelectedIds([]);
    setVisible(false);
  };

  const handleCancel = () => {
    resolveNamePromise(null);
    setNamesInput("");
    setSplitByComma(false);
    setSearchTerm("");
    setSearchResults([]);
    setSelectedIds([]);
    setVisible(false);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
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

  // Helper to get child summary string
  const getChildSummary = (children) => {
    if (!Array.isArray(children) || children.length === 0) return "";
    return children
      .map(
        (child) =>
          `${child.position?.Name || child.position?.name || ""} - ${child.Name || child.name || ""}`
      )
      .join(", ");
  };

  return (
    <Modal isOpen={visible} onRequestClose={handleCancel} contentLabel="Enter Container Names">
      <h2>Enter Container Names</h2>
      <p>Use one name per line</p>
      <form onSubmit={handleSubmit}>
        <textarea
          value={namesInput}
          onChange={(e) => setNamesInput(e.target.value)}
          placeholder="Container 1\nContainer 2\nContainer 3"
          rows={8}
          style={{ width: "100%", padding: "8px" }}
          autoFocus
        />
        <div style={{ margin: "0.5rem 0" }}>
          <label>
            <input
              type="checkbox"
              checked={splitByComma}
              onChange={(e) => setSplitByComma(e.target.checked)}
              style={{ marginRight: "0.5em" }}
            />
            Also split by commas
          </label>
        </div>
        <div style={{ margin: "1rem 0", borderTop: "1px solid #eee", paddingTop: "1rem" }}>
          <label htmlFor="search-nodes"><b>Search Nodes</b></label>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <input
              id="search-nodes"
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Type to search nodes..."
              style={{ flex: 1, padding: "6px" }}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  handleSearch(e);
                }
              }}
            />
            <button type="button" onClick={handleSearch} disabled={searchLoading || !searchTerm}>
              {searchLoading ? "Searching..." : "Search"}
            </button>
          </div>
          {searchError && <div style={{ color: "red", marginTop: "0.5rem" }}>{searchError}</div>}
          <ul style={{ margin: "0.5rem 0 0 0", padding: 0, maxHeight: 150, overflowY: "auto", listStyle: "none" }}>
            {searchResults.map((result, idx) => {
              const id = result.id || result._id || idx;
              const name = result.Name || result.name || "(no name)";
              const childSummary = getChildSummary(result.children);
              return (
                <li key={id} style={{ padding: "4px 0", borderBottom: "1px solid #eee", display: "flex", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(id)}
                    onChange={() => handleCheckboxChange(id)}
                    style={{ marginRight: 8 }}
                  />
                  <span style={{ fontWeight: 500 }}>{name}</span>
                  {childSummary && (
                    <span style={{ color: "#666", marginLeft: 12, fontSize: "0.95em" }}>
                      {childSummary}
                    </span>
                  )}
                </li>
              );
            })}
            {searchResults.length === 0 && searchTerm && !searchLoading && !searchError && (
              <li style={{ color: "#888" }}>No results found.</li>
            )}
          </ul>
        </div>
        <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button type="button" onClick={handleCancel}>Cancel</button>
          <button type="submit">Create</button>
        </div>
      </form>
    </Modal>
  );
}

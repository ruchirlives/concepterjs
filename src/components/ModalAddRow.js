import React, { useEffect } from "react";
import Modal from "react-modal";
import { useAppContext } from "../AppContext";
import { createContainer, writeBackData } from "../api";
import { useNodeSearchAndSelect } from "../hooks/useNodeSearchAndSelect";
import { requestRefreshChannel } from "hooks/effectsShared";

Modal.setAppElement("#app");

const ModalAddRow = ({ isOpen, onClose, onSelect }) => {
  const { setRowData, activeLayers, rowData } = useAppContext();

  // Use the shared hook for backend search and selection
  const {
    searchTerm,
    setSearchTerm,
    searchResults,
    searchLoading,
    searchError,
    selectedIds,
    setSelectedIds,
    handleSearch,
    handleCheckboxChange,
    loadCheckedNodes,
  } = useNodeSearchAndSelect();

  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setSelectedIds([]);
      // Optionally clear search results here if desired
    }
  }, [isOpen, setSearchTerm, setSelectedIds]);

  const handleAddNew = async () => {
    const name = searchTerm.trim();
    if (!name) return;
    const id = await createContainer();
    if (!id) return;
    const newRow = {
      id,
      Name: name,
      Description: name,
      Tags: activeLayers.join(", "),
      StartDate: new Date().toISOString().split("T")[0],
      EndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      TimeRequired: 1,
    };

    setRowData((prev) => {
      const updated = [...prev, newRow];
      writeBackData(updated);
      return updated;
    });

    await onSelect([newRow]);
    onClose();
  };

  const handleOk = async () => {
    // Load checked nodes from backend
    let loadedNodes = [];
    if (selectedIds.length > 0) {
      loadedNodes = await loadCheckedNodes();
    }
    console.log("Loaded nodes:", loadedNodes);
    requestRefreshChannel();
    await onSelect(loadedNodes);
    onClose();
  };

  // Create a Set of existing row IDs for fast lookup
  const existingIds = new Set((rowData || []).map((row) => row.id));

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Add Row"
      className="bg-white w-full max-w-md h-96 overflow-auto p-6 rounded-lg shadow-lg outline-none"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <div className="mb-4">
        <label htmlFor="search-nodes">
          <b>Search Nodes</b>
        </label>
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
                handleSearch(e);
              }
            }}
            onBlur={handleSearch}
            autoFocus
          />
          <button
            onClick={handleAddNew}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded"
          >
            Add New
          </button>
        </div>
        {searchError && (
          <div style={{ color: "red", marginTop: "0.5rem" }}>{searchError}</div>
        )}
        <ul
          className="space-y-1"
          style={{
            maxHeight: 150,
            overflowY: "auto",
            marginTop: 8,
          }}
        >
          {searchResults.map((row) => {
            const isExisting = existingIds.has(row.id);
            return (
              <li
                key={row.id}
                className="p-2 bg-gray-50 hover:bg-gray-100 rounded cursor-pointer"
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(row.id)}
                    onChange={() => handleCheckboxChange(row.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span>
                    {row.Name}
                    {isExisting && (
                      <span style={{ color: "#d00", marginLeft: 4 }}>*</span>
                    )}
                  </span>
                </label>
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
      <div className="mt-4 flex justify-end">
        <button
          onClick={handleOk}
          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded"
        >
          OK
        </button>
        <button
          onClick={onClose}
          className="ml-2 px-3 py-1 bg-gray-300 hover:bg-gray-400 text-sm font-medium rounded"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
};

export default ModalAddRow;

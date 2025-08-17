import React, { useEffect, useState } from "react";
import Modal from "react-modal";
import { useAppContext } from "../AppContext";
import { createContainer, writeBackData } from "../api";

Modal.setAppElement("#app");

const ModalAddRow = ({ isOpen, onClose, onSelect }) => {
  const { rowData, setRowData, activeLayers } = useAppContext();
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState([]);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setFiltered(rowData);
      setSelected([]);
      setQuery("");
    }
  }, [isOpen, rowData]);

  const handleSearch = () => {
    const q = query.toLowerCase();
    setFiltered(rowData.filter((r) => r.Name.toLowerCase().includes(q)));
  };

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelect = async (row) => {
    await onSelect([row]);
    onClose();
  };

  const handleAddNew = async () => {
    const name = query.trim();
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
    // setRowData((prev) => [...prev, newRow]);

    // Write back data
    setRowData((prev) => {
      const updated = [...prev, newRow];
      writeBackData(updated);
      return updated;
    });

    await onSelect([newRow]);
    onClose();
  };

  const handleOk = async () => {
    const rows = rowData.filter((r) => selected.includes(r.id));
    await onSelect(rows);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Add Row"
      className="bg-white w-full max-w-md h-96 overflow-auto p-6 rounded-lg shadow-lg outline-none"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search rows..."
          className="flex-1 px-2 py-1 border border-gray-300 rounded"
          autoFocus
        />
        <button
          onClick={handleSearch}
          className="px-3 py-1 bg-gray-300 hover:bg-gray-400 text-sm font-medium rounded"
        >
          Search
        </button>
        <button
          onClick={handleAddNew}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded"
        >
          Add New
        </button>
      </div>
      <ul className="space-y-1">
        {filtered.map((row) => (
          <li
            key={row.id}
            onDoubleClick={() => handleSelect(row)}
            className="p-2 bg-gray-50 hover:bg-gray-100 rounded cursor-pointer"
          >
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(row.id)}
                onChange={() => toggleSelect(row.id)}
                onClick={(e) => e.stopPropagation()}
              />
              <span>{row.Name}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end">
        <button
          onClick={handleOk}
          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded"
        >
          OK
        </button>
      </div>
    </Modal>
  );
};

export default ModalAddRow;

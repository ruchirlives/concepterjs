import React, { useEffect, useState } from "react";
import Modal from "react-modal";
import { useAppContext } from "../AppContext";
import { createContainer, writeBackData } from "../api";
import { useNodeSearchAndSelect } from "../hooks/useNodeSearchAndSelect";
import NodeSearchBox from "./NodeSearchBox";

Modal.setAppElement("#app");

const ModalAddRow = ({ isOpen, onClose, onSelect, initialSelectedIds = [], layer }) => {
  const { setRowData, rowData, layerOptions, selectedContentLayer, setSelectedContentLayer } = useAppContext();

  // Always start with no pre-selected items (unticked by default)
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [namesInput, setNamesInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    loadCheckedNodes,
  } = useNodeSearchAndSelect(selectedIds, setSelectedIds, searchTerm, setSearchTerm);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setSelectedIds([]); // Always unticked by default when modal opens
      setNamesInput("");
      // Set the content layer to the current layer when modal opens
      if (setSelectedContentLayer && layer) {
        setSelectedContentLayer(layer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, layer, rowData]);

  const appendSearchTermToNames = () => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;
    setNamesInput((prev) => (prev ? `${prev}\n${trimmed}` : trimmed));
  };

  const parseNamesInput = () => (
    namesInput
      .split('\n')
      .map(name => name.trim())
      .filter(Boolean)
  );

  const handleAddNew = async () => {
    if (isSubmitting) return;

    const entries = parseNamesInput();
    if (!entries.length) return;

    const tagsArr = selectedContentLayer ? [selectedContentLayer] : [];

    const newRows = [];
    for (const name of entries) {
      const id = await createContainer();
      if (!id) continue;
      newRows.push({
        id,
        Name: name,
        Description: name,
        Tags: tagsArr.join(", "),
        StartDate: new Date().toISOString().split("T")[0],
        EndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        TimeRequired: 1,
      });
    }

    if (!newRows.length && selectedIds.length === 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      let pendingRows = null;
      if (newRows.length) {
        setRowData((prev) => {
          pendingRows = [...prev, ...newRows];
          return pendingRows;
        });

        if (pendingRows) {
          await writeBackData(pendingRows);
        }
      }

      let loadedNodes = [];
      if (selectedIds.length > 0) {
        loadedNodes = await loadCheckedNodes();
      }

      await onSelect([...newRows, ...loadedNodes]);
      setNamesInput("");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOk = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      let loadedNodes = [];
      if (selectedIds.length > 0) {
        loadedNodes = await loadCheckedNodes();
      }
      await onSelect(loadedNodes);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const initialResults = rowData.filter(row =>
    (row.Tags || "")
      .split(",")
      .map(t => t.trim())
      .includes(layer)
  );



  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Add Row"
      className="bg-white text-gray-900 w-full max-w-2xl h-[40rem] overflow-auto p-6 rounded-lg shadow-lg outline-none" // Increased height to h-[40rem]
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <div className="mb-4">
        {isSubmitting ? (
          <div className="p-4 text-sm text-gray-600 border border-dashed border-gray-300 rounded">
            Saving new rows…
          </div>
        ) : (
          <NodeSearchBox
            layerOptions={layerOptions}
            rowData={rowData}
            showTags={true}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedContentLayer={layer || selectedContentLayer}
            initialResults={initialResults}
            renderExtraControls={() => (
              <button
                type="button"
                onClick={appendSearchTermToNames}
                className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded"
              >
                Add to list
              </button>
            )}
          />
        )}
        <textarea
          className="mt-3 w-full border border-gray-300 rounded p-2 text-sm"
          rows={6}
          value={namesInput}
          onChange={(e) => setNamesInput(e.target.value)}
          placeholder="One container name per line"
        />
        <button
          onClick={handleAddNew}
          className="mt-3 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded disabled:opacity-50"
          disabled={isSubmitting}
        >
          Add New
        </button>
        {isSubmitting && (
          <p className="text-xs text-gray-500 mt-2">Saving new rows…</p>
        )}
      </div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={handleOk}
          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded disabled:opacity-50"
          disabled={isSubmitting}
        >
          OK
        </button>
        <button
          onClick={onClose}
          className="ml-2 px-3 py-1 bg-gray-300 hover:bg-gray-400 text-gray-800 text-sm font-medium rounded disabled:opacity-50"
          disabled={isSubmitting}
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
};

export default ModalAddRow;

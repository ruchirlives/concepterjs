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


  const {
    loadCheckedNodes,
  } = useNodeSearchAndSelect(selectedIds, setSelectedIds, searchTerm, setSearchTerm);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setSelectedIds([]); // Always unticked by default when modal opens
      // Set the content layer to the current layer when modal opens
      if (setSelectedContentLayer && layer) {
        setSelectedContentLayer(layer);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, layer, rowData]);

  const handleAddNew = async () => {
    const name = searchTerm.trim();
    console.log("Adding new row with name:", name);
    if (!name) return;
    const id = await createContainer();
    if (!id) return;
    // Only add selectedContentLayer as tag (not all activeLayers)
    let tagsArr = [];
    if (selectedContentLayer) {
      tagsArr.push(selectedContentLayer);
    }
    const newRow = {
      id,
      Name: name,
      Description: name,
      Tags: tagsArr.join(", "),
      StartDate: new Date().toISOString().split("T")[0],
      EndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      TimeRequired: 1,
    };

    let pendingRows = null;
    setRowData((prev) => {
      pendingRows = [...prev, newRow];
      return pendingRows;
    });

    if (pendingRows) {
      await writeBackData(pendingRows);
    }

    await onSelect([newRow]);
    onClose();
  };

  const handleOk = async () => {
    let loadedNodes = [];
    if (selectedIds.length > 0) {
      loadedNodes = await loadCheckedNodes();
    }
    await onSelect(loadedNodes);
    onClose();
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
      className="bg-white text-gray-900 w-full max-w-md h-[40rem] overflow-auto p-6 rounded-lg shadow-lg outline-none" // Increased height to h-[40rem]
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <div className="mb-4">
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
        />
        <button
          onClick={handleAddNew}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded"
          style={{ marginTop: 8 }}
        >
          Add New
        </button>
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
          className="ml-2 px-3 py-1 bg-gray-300 hover:bg-gray-400 text-gray-800 text-sm font-medium rounded"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
};

export default ModalAddRow;

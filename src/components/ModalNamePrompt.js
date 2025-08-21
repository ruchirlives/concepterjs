import React, { useState } from "react";
import Modal from "react-modal";
import NodeSearchBox from "./NodeSearchBox";
import { useNodeSearchAndSelect } from "../hooks/useNodeSearchAndSelect";
import { useAppContext } from "../AppContext";

Modal.setAppElement("#app");

let resolveNamePromise = null;

export function openNamePrompt() {
  return new Promise((resolve) => {
    resolveNamePromise = resolve;
    setModalVisible(true);
  });
}

let setModalVisible = () => { };

export default function NamePromptModal() {
  const [visible, setVisible] = useState(false);
  const [namesInput, setNamesInput] = useState("");
  const [splitByComma, setSplitByComma] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const {
    loadCheckedNodes,
  } = useNodeSearchAndSelect(selectedIds, setSelectedIds, searchTerm, setSearchTerm);

  const { rowData, layerOptions } = useAppContext();

  setModalVisible = setVisible;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!namesInput.trim() && selectedIds.length === 0) {
      return;
    }
    let loadedNodes = [];
    if (selectedIds.length > 0) {
      loadedNodes = await loadCheckedNodes();
    }
    resolveNamePromise({
      namesInput: namesInput.trim(),
      splitByComma,
      selectedIds,
      loadedNodes
    });
    setNamesInput("");
    setSplitByComma(false);
    setSearchTerm("");
    setSelectedIds([]);
    setVisible(false);
  };

  const handleCancel = () => {
    resolveNamePromise(null);
    setNamesInput("");
    setSplitByComma(false);
    setSearchTerm("");
    setSelectedIds([]);
    setVisible(false);
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
        <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button type="button" onClick={handleCancel}>Cancel</button>
          <button type="submit">Create</button>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
          <NodeSearchBox
            layerOptions={layerOptions}
            rowData={rowData}
            showTags={true}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
          />
          <button
            type="button"
            style={{ height: 36, marginTop: 8 }}
            onClick={() => {
              if (searchTerm.trim()) {
                setNamesInput(
                  namesInput
                    ? namesInput.trimEnd() + "\n" + searchTerm.trim()
                    : searchTerm.trim()
                );
              }
            }}
          >
            Add New
          </button>
        </div>
      </form>
    </Modal>
  );
}

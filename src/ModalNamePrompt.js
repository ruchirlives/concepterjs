import React, { useState } from "react";
import Modal from "react-modal";

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

  setModalVisible = setVisible;

  const handleSubmit = (e) => {
    e.preventDefault();
    resolveNamePromise(namesInput || null);
    setNamesInput("");
    setVisible(false);
  };

  const handleCancel = () => {
    resolveNamePromise(null);
    setNamesInput("");
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
        <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button type="button" onClick={handleCancel}>Cancel</button>
          <button type="submit">Create</button>
        </div>
      </form>
    </Modal>
  );
}

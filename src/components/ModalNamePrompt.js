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
  const [splitByComma, setSplitByComma] = useState(false); // NEW

  setModalVisible = setVisible;

  const handleSubmit = (e) => {
    e.preventDefault();
    // Pass both the input and the toggle value
    resolveNamePromise({
      namesInput: namesInput || null,
      splitByComma
    });
    setNamesInput("");
    setSplitByComma(false);
    setVisible(false);
  };

  const handleCancel = () => {
    resolveNamePromise(null);
    setNamesInput("");
    setSplitByComma(false);
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
      </form>
    </Modal>
  );
}

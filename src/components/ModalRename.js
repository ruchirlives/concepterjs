import React, { useState, useEffect } from "react";
import Modal from "react-modal";

Modal.setAppElement("#app");

let resolveRenameModal = null;
let setRenameModalVisible = () => {};
let setRenameModalValue = () => {};
let setRenameModalDescription = () => {};

export function openRenameModal(defaultValue = "", defaultDescription = "") {
  return new Promise((resolve) => {
    resolveRenameModal = resolve;
    setRenameModalValue(defaultValue);
    setRenameModalDescription(defaultDescription);
    setRenameModalVisible(true);
  });
}

export default function RenameModal() {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    setRenameModalVisible = setVisible;
    setRenameModalValue = setValue;
    setRenameModalDescription = setDescription;
    return () => {
      setRenameModalVisible = () => {};
      setRenameModalValue = () => {};
      setRenameModalDescription = () => {};
    };
  }, []);

  const close = () => {
    setVisible(false);
    if (resolveRenameModal) {
      resolveRenameModal(null);
      resolveRenameModal = null;
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setVisible(false);
    if (resolveRenameModal) {
      resolveRenameModal({
        name: value.trim(),
        description: description.trim(),
      });
      resolveRenameModal = null;
    }
  };

  return (
    <Modal
      isOpen={visible}
      onRequestClose={close}
      contentLabel="Rename Nodes"
      className="rounded-lg bg-white shadow-lg p-6 mx-auto mt-16 outline-none"
      overlayClassName="fixed inset-0 bg-black/40 flex items-start justify-center z-50"
      style={{
        content: {
          maxWidth: "960px",
          width: "min(90vw, 960px)",
          maxHeight: "75vh",
          overflow: "auto",
        },
      }}
    >
      <h2 className="text-lg font-semibold mb-2">Rename Node(s)</h2>
      <p className="text-sm text-gray-600 mb-4">Edit the new name below.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <textarea
            rows={3}
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Rename
          </button>
        </div>
      </form>
    </Modal>
  );
}

import React, { useState, useEffect } from "react";
import Modal from "react-modal";
import { getloadContainers, loadContainers, importContainers, deleteProject } from "./api";
import { useAppContext } from "./AppContext";

Modal.setAppElement("#app");

const LoadModal = ({ isOpen, setIsOpen, setRowData, gridApiRef, setCurrentContainer, merge }) => {
    const [list, setList] = useState([]);

    const { setLastLoadedFile } = useAppContext();

    const closeModal = () => {
        setIsOpen(false);
        setList([]);
    };

    const openItem = async (item) => {
        setCurrentContainer(item);
        setIsOpen(false);

        if (merge) {
            await importContainers(item);
        } else {
            await loadContainers(item);
        }
        setLastLoadedFile(item);

        const channel = new BroadcastChannel('requestRefreshChannel');
        channel.postMessage({ type: "reload" });
        channel.close();
    };

    const handleDelete = async (item) => {
        const confirmed = window.confirm(`Are you sure you want to delete "${item}"?`);
        if (!confirmed) return;
        try {
            await deleteProject(item);
            const data = await getloadContainers();
            setList(data || []);
        } catch {
            alert("Failed to delete the container.");
        }
    };

    useEffect(() => {
        if (isOpen) {
            getloadContainers().then((data) => setList((data || []).reverse()));
        }
    }, [isOpen]);

    return (
        <Modal
            isOpen={isOpen}
            onRequestClose={closeModal}
            contentLabel="Load Containers"
            className="bg-white w-full max-w-lg h-96 overflow-auto p-6 rounded-lg shadow-lg outline-none"
            overlayClassName="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50"
        >
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Load Containers</h2>
            <ul className="space-y-2">
                {list.map((item) => (
                    <li
                        key={item}
                        className="flex items-center justify-between p-2 bg-gray-50 hover:bg-gray-100 rounded"
                    >
                        <span className="text-gray-700 truncate">{item}</span>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => openItem(item)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded"
                            >
                                Load
                            </button>
                            <button
                                onClick={() => handleDelete(item)}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded"
                            >
                                Delete
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
            <div className="mt-6 text-right">
                <button
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 text-sm font-medium rounded"
                >
                    Close
                </button>
            </div>
        </Modal>
    );
};

export default LoadModal;
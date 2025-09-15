import { createContainer, writeBackData } from "../api";
import { openNamePrompt } from "./ModalNamePrompt";
import { useAppContext } from "AppContext";
import { handleWriteBack } from "hooks/effectsShared";

export default function useCreateNewRow() {
    const { rowData, setRowData, selectedContentLayer } = useAppContext();

    return async () => {
        console.log("Creating new rows");

        const result = await openNamePrompt();
        if (result === null) return null;

        const { namesInput, splitByComma, loadedNodes = [] } = result;
        let names = [];
        if (splitByComma && namesInput) {
            names = namesInput
                .split(/\r?\n|,/)
                .map((name) => name.trim())
                .filter((name) => name.length > 0);
        } else if (namesInput) {
            names = namesInput
                .split(/\r?\n/)
                .map((name) => name.trim())
                .filter((name) => name.length > 0);
        }

        // Only return null if BOTH are empty
        if (names.length === 0 && loadedNodes.length === 0) {
            console.log("No valid entries or checked items.");
            return null;
        }

        // Deduplication: filter out names that already exist (case-insensitive)
        const existingNames = new Set(rowData.map(row => row.Name.toLowerCase()));
        const seen = new Set();
        const uniqueNames = names.filter(name => {
            const lower = name.toLowerCase();
            if (existingNames.has(lower) || seen.has(lower)) {
                return false;
            }
            seen.add(lower);
            return true;
        });

        if (uniqueNames.length === 0 && loadedNodes.length === 0) {
            console.log("All entries are duplicates and no checked items.");
            return null;
        }

        const newRows = [];
        for (const fullText of uniqueNames) {
            const id = await createContainer();

            newRows.push({
                id: id,
                Name: fullText,
                Description: fullText,
                Tags: selectedContentLayer ? selectedContentLayer : "", // Use context value
                StartDate: new Date().toISOString().split("T")[0],
                EndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split("T")[0],
                TimeRequired: 1,
            });

        }
        // No active group; skip auto-adding new rows to a group

        if (newRows.length > 0) {
            setRowData((prev) => {
                const updated = [...prev, ...newRows];
                writeBackData(updated);
                return updated;
            });
        }

        // Merge selectedContentLayer into loadedNodes' Tags, preserving previous tags and avoiding duplicates
        const updatedLoadedNodes = loadedNodes

        handleWriteBack(updatedLoadedNodes);
        console.log(updatedLoadedNodes);
        return {
            newRows,
            loadedNodes: updatedLoadedNodes
        };
    };
}

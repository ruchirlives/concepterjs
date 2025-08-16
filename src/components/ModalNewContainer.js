import { addChildren, createContainer, writeBackData } from "../api";
import { openNamePrompt } from "./ModalNamePrompt";
import { useAppContext } from "AppContext";

export default function useCreateNewRow() {
    const { rowData, setRowData, activeLayers, activeGroup } = useAppContext();

    return async () => {
        console.log("Creating new rows");

        const result = await openNamePrompt();
        if (result === null) return null;

        const { namesInput, splitByComma } = result;
        let names = [];
        if (splitByComma) {
            names = namesInput
                .split(/\r?\n|,/)
                .map((name) => name.trim())
                .filter((name) => name.length > 0);
        } else {
            names = namesInput
                .split(/\r?\n/)
                .map((name) => name.trim())
                .filter((name) => name.length > 0);
        }

        if (names.length === 0) {
            console.log("No valid entries.");
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

        if (uniqueNames.length === 0) {
            console.log("All entries are duplicates.");
            return null;
        }

        const newRows = [];
        for (const fullText of uniqueNames) {
            const id = await createContainer();

            newRows.push({
                id: id,
                Name: fullText,
                Description: fullText,
                Tags: activeLayers.join(', '),
                StartDate: new Date().toISOString().split("T")[0],
                EndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split("T")[0],
                TimeRequired: 1,
            });

        }
        if (activeGroup) {
            await addChildren(activeGroup, newRows.map((row) => row.id));
        }

        setRowData((prev) => {
            const updated = [...prev, ...newRows];
            writeBackData(updated);
            return updated;
        });

        return newRows;
    };
}

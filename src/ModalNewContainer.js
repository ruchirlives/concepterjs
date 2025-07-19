import { addChildren, createContainer, writeBackData } from "./api";
import { openNamePrompt } from "./ModalNamePrompt";

export function createNewRow(setRowData, activeGroup=null, activeLayers=[]) {
    return async () => {
        console.log("Creating new rows");

        const namesInput = await openNamePrompt();
        if (namesInput === null) {
            console.log("Operation cancelled by the user.");
            return null;
        }

        const names = namesInput
            .split("\n")
            .map((name) => name.trim())
            .filter((name) => name.length > 0);

        if (names.length === 0) {
            console.log("No valid entries.");
            return null;
        }


        const newRows = [];
        for (const fullText of names) {
            const id = await createContainer();

            newRows.push({
                id: id,
                Name: fullText,
                Description: fullText,                  // Full text
                Tags: activeLayers.join(', '),
                StartDate: new Date().toISOString().split("T")[0],
                EndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split("T")[0],
                Horizon: "short",
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

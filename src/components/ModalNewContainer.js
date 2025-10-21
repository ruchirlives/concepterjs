import { createContainer, addRelationship } from "../api";
import { openNamePrompt } from "./ModalNamePrompt";
import { useAppContext } from "AppContext";
import { handleWriteBack, requestRefreshChannel } from "hooks/effectsShared";
import { parseNames } from "utils/parseNames";

export default function useCreateNewRow() {
    const { rowData, selectedContentLayer } = useAppContext();

    return async () => {
        console.log("Creating new rows");

        const result = await openNamePrompt();
        if (result === null) return null;

        const { namesInput, splitByComma, loadedNodes = [] } = result;
        // Parse names with hierarchy disabled
        const { flat: names, groups } = parseNames(namesInput, { splitByComma, withHierarchy: true });

        console.log("Parsed names:", names, groups);

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
        // No active group; skip    auto-adding new rows to a group

        handleWriteBack(newRows);

        // Use groups to parent newly created rows if needed
        for (const group of groups) {
            console.log("Processing group:", group);
            // Find rows that belong to this group
            const groupRows = newRows.filter(row => group.children.includes(row.Name));
            if (groupRows.length === 0) continue;
            console.log(`Group "${group.parent}" has rows:`, groupRows);
            // use addRelationship API to link group.parent to each row in groupRows
            console.log(`Searching for parent row "${group.parent}" in newRows.`, newRows);
            const parentRow = newRows.find(row => row.Name === group.parent);
            if (!parentRow) {
                console.log(`Parent row "${group.parent}" not found among existing rows.`);
                continue;
            }
            for (const childRow of groupRows) {
                console.log(`Linking parent "${group.parent}" to child "${childRow.Name}"`);
                await addRelationship(parentRow.id, parentRow.id, childRow.id);
            }
        }


        // Merge selectedContentLayer into loadedNodes' Tags, preserving previous tags and avoiding duplicates
        const updatedLoadedNodes = loadedNodes

        handleWriteBack(updatedLoadedNodes);
        console.log(updatedLoadedNodes);

        // Notify listeners (Kanban, Grid, Flow) to refresh derived data
        requestRefreshChannel();
        return {
            newRows,
            loadedNodes: updatedLoadedNodes
        };
    };
}

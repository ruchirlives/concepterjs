import { createContainer, addChildren, searchNodes, loadNode } from "../api";
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

        // Check if a node matching this name already exists in mongodb NODES collection using searchNodes
        const existingNodes = await Promise.all(uniqueNames.map(name => {
            return searchNodes({ name });
        }));

        // Is there a lowercase match in existing nodes?
        const finalNames = uniqueNames.filter((name, index) => {
            const nodes = existingNodes[index];
            return !nodes.some(node => node.Name.toLowerCase() === name.toLowerCase());
        });

        // If there is, grab the first in finalNames and use its ID instead of creating a new one
        const existingIds = existingNodes.flat().map(node => node.id);
        const idMap = new Map();
        for (const [index, name] of finalNames.entries()) {
            idMap.set(name, existingIds[index]);
        }

        const newRows = [];
        for (const fullText of uniqueNames) {
            let id

            id = idMap.get(fullText)
            if (!id) {
                id = await createContainer();
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
            else {
                const existingNode = await loadNode(id);
                newRows.push(existingNode);
            }
        }
        // No active group; skip    auto-adding new rows to a group

        handleWriteBack(newRows);

        // Use groups to parent newly created rows if needed
        for (const group of groups) {
            // Find rows that belong to this group
            const groupRows = newRows.filter(row => group.children.includes(row.Name));
            if (groupRows.length === 0) continue;
            const parentRow = newRows.find(row => row.Name === group.parent);
            if (!parentRow) {
                console.log(`Parent row "${group.parent}" not found among existing rows.`);
                continue;
            }
            await addChildren(parentRow.id, groupRows.map(r => r.id));
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

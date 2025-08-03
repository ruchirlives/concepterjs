import { useState, useEffect, useCallback } from 'react';
import { listStates, compareStates } from '../api';
import { getLayoutedElements } from './flowLayouter';
import toast from 'react-hot-toast';

export const useStateComparison = (rowData, selectedTargetState, setDiffDict, collapsed) => {
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showDiffPopup, setShowDiffPopup] = useState(false);
    const [currentDiffResults, setCurrentDiffResults] = useState(null);
    const [selectedDiffs, setSelectedDiffs] = useState({});

    // Create edge click handler
    const createEdgeClickHandler = useCallback((diffResults, sourceState, targetState) => {
        return () => {
            setCurrentDiffResults({
                results: diffResults,
                sourceState,
                targetState
            });

            // Initialize all diffs as selected
            const initialSelected = {};
            Object.keys(diffResults).forEach((containerId) => {
                const containerDiffs = diffResults[containerId];
                Object.keys(containerDiffs).forEach((targetId) => {
                    const key = `${containerId}-${targetId}`;
                    initialSelected[key] = true;
                });
            });
            setSelectedDiffs(initialSelected);
            setShowDiffPopup(true);
        };
    }, []);

    // Handle checkbox toggle
    const toggleDiffSelection = useCallback((diffKey) => {
        setSelectedDiffs(prev => ({
            ...prev,
            [diffKey]: !prev[diffKey]
        }));
    }, []);

    // Handle copy selected diffs
    const copySelectedDiffs = useCallback(() => {
        if (!currentDiffResults) return;

        const { results, sourceState, targetState } = currentDiffResults;
        const filteredResults = {};

        // Filter results based on selected checkboxes
        Object.keys(results).forEach((containerId) => {
            const containerDiffs = results[containerId];
            const filteredContainerDiffs = {};

            Object.keys(containerDiffs).forEach((targetId) => {
                const key = `${containerId}-${targetId}`;
                if (selectedDiffs[key]) {
                    filteredContainerDiffs[targetId] = containerDiffs[targetId];
                }
            });

            if (Object.keys(filteredContainerDiffs).length > 0) {
                filteredResults[containerId] = filteredContainerDiffs;
            }
        });

        setDiffDict(filteredResults);
        console.log('Filtered diff results copied:', filteredResults);
        toast.success(`Copied selected diff results for ${sourceState} to ${targetState}`);
        setShowDiffPopup(false);
    }, [currentDiffResults, selectedDiffs, setDiffDict]);

    // Close popup
    const closeDiffPopup = useCallback(() => {
        setShowDiffPopup(false);
        setCurrentDiffResults(null);
        setSelectedDiffs({});
    }, []);

    // Build changes array from diff results - now returns counts object
    const buildChangesFromDiff = useCallback((diffResults, nameById) => {
        const changes = [];
        const counts = { added: 0, changed: 0, removed: 0 };

        Object.keys(diffResults).forEach((containerId) => {
            const containerDiffs = diffResults[containerId];
            const containerName = nameById[containerId] || containerId;

            Object.keys(containerDiffs).forEach((targetId) => {
                const diff = containerDiffs[targetId];
                const targetName = nameById[targetId] || targetId;

                if (diff.status === "added") {
                    changes.push(`${containerName} Added ${targetName}: ${diff.relationship}`);
                    counts.added++;
                } else if (diff.status === "changed") {
                    changes.push(`${containerName} Changed ${targetName}: ${diff.relationship}`);
                    counts.changed++;
                } else if (diff.status === "removed") {
                    changes.push(`${containerName} Removed ${targetName}: ${diff.relationship}`);
                    counts.removed++;
                }
            });
        });

        return { changes, counts };
    }, []);

    // Create edges for state comparison
    const createComparisonEdges = useCallback(async (states, selectedTargetState, nameById, containerIds) => {
        const initialEdges = [];

        for (const sourceState of states) {
            // Skip if comparing with itself
            if (sourceState === selectedTargetState) continue;

            try {
                // Compare sourceState with selectedTargetState
                const diffResults = await compareStates(sourceState, containerIds);
                const { changes, counts } = buildChangesFromDiff(diffResults, nameById);

                // Only create edge if there are changes
                if (changes.length > 0) {
                    const fullChangesText = changes.join("\n");
                    const totalChanges = counts.added + counts.changed + counts.removed;
                    
                    // Create a detailed label showing breakdown
                    const labelParts = [];
                    if (counts.added > 0) labelParts.push(`+${counts.added}`);
                    if (counts.changed > 0) labelParts.push(`~${counts.changed}`);
                    if (counts.removed > 0) labelParts.push(`-${counts.removed}`);
                    
                    const detailedLabel = labelParts.join(' ');
                    const handleEdgeClick = createEdgeClickHandler(diffResults, sourceState, selectedTargetState);

                    initialEdges.push({
                        id: `${sourceState}-${selectedTargetState}`,
                        source: sourceState,
                        target: selectedTargetState,
                        label: detailedLabel, // Pass detailed breakdown
                        type: "custom",
                        animated: false,
                        style: { stroke: "#1976d2", strokeWidth: 2 },
                        data: {
                            onClick: handleEdgeClick,
                            fullChanges: fullChangesText, // Store full text for tooltip
                            counts: counts, // Store counts for additional use
                            totalChanges: totalChanges
                        },
                    });
                }
            } catch (err) {
                console.error(`Error comparing ${sourceState} with ${selectedTargetState}:`, err);
            }
        }

        return initialEdges;
    }, [buildChangesFromDiff, createEdgeClickHandler]);

    // Main effect to load and process state data
    useEffect(() => {
        // Only load when not collapsed
        if (collapsed) return;

        const loadStateComparison = async () => {
            setLoading(true);

            try {
                const states = await listStates();

                // Create initial nodes with custom node type and target marking
                const initialNodes = states.map((state) => ({
                    id: state,
                    type: "custom",
                    data: {
                        label: state,
                        Name: state,
                        isTarget: state === selectedTargetState,
                    },
                    position: { x: 0, y: 0 }, // Will be overwritten by layouter
                }));

                // Create name lookup map
                const nameById = {};
                rowData.forEach((c) => {
                    nameById[c.id] = c.Name;
                });

                const containerIds = rowData.map((c) => c.id);

                // Create comparison edges
                const initialEdges = await createComparisonEdges(states, selectedTargetState, nameById, containerIds);

                // Apply layouter to organize the nodes and edges
                const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                    initialNodes,
                    initialEdges,
                    "TB", // Top to Bottom layout - target state will be at bottom
                    100, // Node separation
                    150 // Rank separation
                );

                setNodes(layoutedNodes);
                setEdges(layoutedEdges);
            } catch (err) {
                console.error("Failed to build state graph:", err);
            } finally {
                setLoading(false);
            }
        };

        loadStateComparison();
    }, [rowData, selectedTargetState, collapsed, createComparisonEdges]);

    return {
        nodes,
        edges,
        loading,
        setNodes,
        setEdges,
        // Popup state
        showDiffPopup,
        currentDiffResults,
        selectedDiffs,
        toggleDiffSelection,
        copySelectedDiffs,
        closeDiffPopup
    };
};
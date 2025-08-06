import { useState, useEffect, useCallback } from 'react';
import { listStates, compareStates } from '../api';
import { getLayoutedElements } from './flowLayouter';
import toast from 'react-hot-toast';
import { enrichDiffWithMetadata } from '../transitionMetadata';

export const useStateComparison = (rowData, selectedTargetState, setDiffDict, collapsed) => {
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showDiffPopup, setShowDiffPopup] = useState(false);
    const [currentDiffResults, setCurrentDiffResults] = useState(null);
    const [selectedDiffs, setSelectedDiffs] = useState({});

    // Create edge click handler
    const createEdgeClickHandler = useCallback((diffResults, sourceState, targetState) => {
        return async () => {
            const enriched = await enrichDiffWithMetadata(diffResults);
            setCurrentDiffResults({
                results: enriched,
                sourceState,
                targetState
            });

            // Initialize all diffs as selected
            const initialSelected = {};
            Object.keys(enriched).forEach((containerId) => {
                const containerDiffs = enriched[containerId];
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
    const buildChangesFromDiff = useCallback(async (diffResults, nameById) => {
        const changes = [];
        const counts = { added: 0, changed: 0, removed: 0 };
        const enrichedDiff = await enrichDiffWithMetadata(diffResults);

        Object.keys(enrichedDiff).forEach((containerId) => {
            const containerDiffs = enrichedDiff[containerId];
            const containerName = nameById[containerId] || containerId;

            Object.keys(containerDiffs).forEach((targetId) => {
                const diff = containerDiffs[targetId];
                const targetName = nameById[targetId] || targetId;

                if (diff.status === "added") {
                    changes.push(`${containerName} [added] ${targetName}: ${diff.relationship} (cost: ${diff.weight || ''} ${diff.qual_label || ''})`);
                    counts.added++;
                } else if (diff.status === "changed") {
                    changes.push(`${containerName} [changed] ${targetName}: ${diff.relationship} (cost: ${diff.weight || ''} ${diff.qual_label || ''})`);
                    counts.changed++;
                } else if (diff.status === "removed") {
                    changes.push(`${containerName} [removed] ${targetName}: ${diff.relationship} (cost: ${diff.weight || ''} ${diff.qual_label || ''})`);
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
                const { changes, counts } = await buildChangesFromDiff(diffResults, nameById);

                // Only create edge if there are changes
                if (changes.length > 0) {
                    const fullChangesText = changes.join("\n");
                    const totalChanges = counts.added + counts.changed + counts.removed;

                    // Create a detailed label showing breakdown
                    const labelParts = [];
                    if (counts.added > 0) labelParts.push(`+${counts.added}`);
                    if (counts.changed > 0) labelParts.push(`~${counts.changed}`);
                    if (counts.removed > 0) labelParts.push(`-${counts.removed}`);

                    // Add the weights and qual_labels
                    const enriched = await enrichDiffWithMetadata(diffResults);
                    let totalWeight = 0;
                    const qualLabels = new Set(); // Use Set to avoid duplicates

                    if (enriched) {
                        // Sum all weights and collect qual_labels from the enriched diff
                        Object.keys(enriched).forEach((containerId) => {
                            const containerDiffs = enriched[containerId];
                            Object.keys(containerDiffs).forEach((targetId) => {
                                const diff = containerDiffs[targetId];
                                const weight = parseFloat(diff.weight) || 0;
                                totalWeight += weight;
                                
                                // Collect non-null qual_labels
                                if (diff.qual_label && diff.qual_label.trim() !== '') {
                                    qualLabels.add(diff.qual_label);
                                }
                            });
                        });

                        console.log(`Total weight for ${sourceState} -> ${selectedTargetState}: ${totalWeight}`);
                    }

                    // Include weight and qual_labels in the label
                    let detailedLabel = labelParts.join(' ');
                    
                    if (totalWeight > 0) {
                        detailedLabel += ` (cost ${totalWeight})`;
                    }
                    
                    if (qualLabels.size > 0) {
                        detailedLabel += ` [${Array.from(qualLabels).join(', ')}]`;
                    }

                    const handleEdgeClick = createEdgeClickHandler(diffResults, sourceState, selectedTargetState);

                    initialEdges.push({
                        id: `${sourceState}-${selectedTargetState}`,
                        source: sourceState,
                        target: selectedTargetState,
                        label: detailedLabel,
                        type: "custom",
                        animated: false,
                        style: { stroke: "#1976d2", strokeWidth: 2 },
                        data: {
                            onClick: handleEdgeClick,
                            fullChanges: fullChangesText,
                            counts: counts,
                            totalChanges: totalChanges,
                            totalWeight: totalWeight // Store total weight for additional use
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

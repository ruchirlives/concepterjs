import { useState, useEffect, useCallback } from 'react';
import { listStates, compareStates } from '../api';
import { getLayoutedElements } from './flowLayouter';
import toast from 'react-hot-toast';
import { enrichDiffWithMetadata } from '../transitionMetadata';

export const useStateComparison = (rowData, selectedTargetState, setDiffDict, collapsed, flipDirection = false) => {
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

                let to_append = "";
                if (diff.relationship) {
                    to_append = ` [with] ${diff.relationship}`;
                }

                let to_append_cost = "";
                if (diff.weight || diff.qual_label) {
                    to_append_cost = "cost:";
                    if (diff.weight) {
                        to_append_cost += ` ${diff.weight}`;
                    }
                    if (diff.qual_label) {
                        to_append_cost += ` ${diff.qual_label}`;
                    }
                    to_append_cost = ` (${to_append_cost.trim()})`;
                }

                if (diff.status === "added") {
                    changes.push(`${containerName} [added] ${targetName}${to_append} ${to_append_cost}`.trim());
                    counts.added++;
                } else if (diff.status === "changed") {
                    changes.push(`${containerName} [changed] ${targetName}${to_append} ${to_append_cost}`.trim());
                    counts.changed++;
                } else if (diff.status === "removed") {
                    changes.push(`${containerName} [removed] ${targetName}${to_append} ${to_append_cost}`.trim());
                    counts.removed++;
                }
            });
        });

        return { changes, counts };
    }, []);

    // Create edges for state comparison
    const createComparisonEdges = useCallback(async (states, selectedTargetState, nameById, containerIds) => {
        const initialEdges = [];

        for (const state of states) {
            if (state === selectedTargetState) continue;

            let sourceState, targetState, diffResults;
            if (flipDirection) {
                // Selected is source, compare selected to each other state
                sourceState = selectedTargetState;
                targetState = state;
            } else {
                // Selected is target, compare each other state to selected
                sourceState = state;
                targetState = selectedTargetState;
            }

            // Use new compareStates signature
            diffResults = await compareStates(sourceState, targetState, containerIds);

            const { changes, counts } = await buildChangesFromDiff(diffResults, nameById);

            if (changes.length > 0) {
                const fullChangesText = changes.join("\n");
                const totalChanges = counts.added + counts.changed + counts.removed;

                // Build arrays for export
                const descriptions = [];
                const costs = [];
                const costNumbers = [];
                const qualLabels = [];
                changes.forEach(line => {
                    // Remove (cost ...) from end for description
                    const desc = line.replace(/\s*\(cost[^)]*\)\s*$/i, '').trim();
                    descriptions.push(desc);

                    // Extract cost value if present
                    const costMatch = line.match(/\(cost\s*([^)]+)\)/i);
                    if (costMatch && costMatch[1].trim()) {
                        costs.push(costMatch[1].trim());

                        // Try to extract the qualitative label (first non-number word)
                        const parts = costMatch[1].trim().split(/\s+/);
                        const numMatch = parts[0].match(/[\d.]+/);
                        costNumbers.push(numMatch ? numMatch[0] : "");

                        qualLabels.push(parts.length > 1 ? parts.slice(1).join(' ') : "");
                    } else {
                        costs.push("");
                        costNumbers.push("");
                        qualLabels.push("");
                    }
                });

                const labelParts = [];
                if (counts.added > 0) labelParts.push(`+${counts.added}`);
                if (counts.changed > 0) labelParts.push(`~${counts.changed}`);
                if (counts.removed > 0) labelParts.push(`-${counts.removed}`);

                const enriched = await enrichDiffWithMetadata(diffResults);
                let totalWeight = 0;
                const qualLabelsSet = new Set();

                if (enriched) {
                    Object.keys(enriched).forEach((containerId) => {
                        const containerDiffs = enriched[containerId];
                        Object.keys(containerDiffs).forEach((targetId) => {
                            const diff = containerDiffs[targetId];
                            const weight = parseFloat(diff.weight) || 0;
                            totalWeight += weight;
                            if (diff.qual_label && diff.qual_label.trim() !== '') {
                                qualLabelsSet.add(diff.qual_label);
                            }
                        });
                    });
                }

                let detailedLabel = labelParts.join(' ');
                if (totalWeight > 0) {
                    detailedLabel += ` (cost ${totalWeight})`;
                }
                if (qualLabelsSet.size > 0) {
                    detailedLabel += ` [${Array.from(qualLabelsSet).join(', ')}]`;
                }

                const handleEdgeClick = createEdgeClickHandler(diffResults, sourceState, targetState);

                initialEdges.push({
                    id: `${sourceState}-${targetState}`,
                    source: sourceState,
                    target: targetState,
                    label: detailedLabel,
                    type: "custom",
                    animated: false,
                    style: { stroke: "#1976d2", strokeWidth: 2 },
                    data: {
                        onClick: handleEdgeClick,
                        fullChanges: fullChangesText,
                        counts: counts,
                        totalChanges: totalChanges,
                        totalWeight: totalWeight,
                        changesArray: descriptions,
                        costsArray: costs,
                        costNumbers: costNumbers,
                        qual_label: qualLabels // <-- use qual_label as requested
                    },
                });
            }
        }

        return initialEdges;
    }, [buildChangesFromDiff, createEdgeClickHandler, flipDirection]);

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
                        isTarget: !flipDirection && state === selectedTargetState,
                        isSource: flipDirection && state === selectedTargetState,
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
    }, [rowData, selectedTargetState, collapsed, createComparisonEdges, flipDirection]);

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

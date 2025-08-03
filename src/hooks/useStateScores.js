import { useState, useCallback, useMemo } from 'react';
import { calculateStateScores } from '../api';
import { useAppContext } from '../AppContext';
import toast from 'react-hot-toast';

export const useStateScores = () => {
    const { comparatorState, rowData } = useAppContext();
    const [stateScores, setStateScores] = useState({});

    // Calculate nameById from rowData
    const nameById = useMemo(() => {
        const map = {};
        rowData.forEach((c) => {
            map[c.id] = c.Name;
        });
        return map;
    }, [rowData]);

    const handleCalculateStateScores = useCallback(async () => {
        if (!comparatorState) {
            toast.error('No comparator state selected');
            return;
        }

        try {
            const scores = await calculateStateScores(comparatorState);

            // Store the scores in state for highlighting
            setStateScores(scores);

            // Sort scores by value (highest first) and format for display
            const sortedScores = Object.entries(scores)
                .sort(([, a], [, b]) => b - a)
                .map(([containerId, score]) => {
                    const containerName = nameById[containerId] || containerId;
                    return `${containerName}: ${score.toFixed(3)}`;
                });

            toast(
                (t) => (
                    <div className="max-w-[400px]">
                        <div className="font-semibold mb-2">State Scores for {comparatorState}</div>
                        <div className="text-xs mb-3 overflow-y-auto max-h-60 whitespace-pre-line font-mono">
                            {sortedScores.length > 0 ? sortedScores.join('\n') : 'No scores calculated'}
                        </div>
                        <button
                            className="text-xs bg-blue-600 text-white px-2 py-1 rounded"
                            onClick={() => {
                                const scoreText = sortedScores.join('\n');
                                navigator.clipboard.writeText(scoreText);
                                toast.success('Copied to clipboard!');
                                toast.dismiss(t.id);
                            }}
                        >
                            Copy to Clipboard
                        </button>
                    </div>
                ),
                {
                    duration: 10000, // Show for 10 seconds
                }
            );
        } catch (error) {
            console.error('Failed to calculate state scores:', error);
            toast.error('Failed to calculate state scores');
        }
    }, [comparatorState, nameById]);

    const clearStateScores = useCallback(() => {
        setStateScores({});
        toast.success('State scores cleared');
    }, []);

    const getHighestScoringContainer = useCallback(() => {
        if (Object.keys(stateScores).length === 0) return null;

        const sortedScores = Object.entries(stateScores).sort(([, a], [, b]) => b - a);
        return sortedScores[0]?.[0]; // Return the container ID with highest score
    }, [stateScores]);

    return {
        stateScores,
        handleCalculateStateScores,
        getHighestScoringContainer,
        clearStateScores
    };
};
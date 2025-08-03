import React, { useMemo, useState, useEffect } from 'react';
import { updateMetadataFor } from '../transitionMetadata';

const DiffPopup = ({
    show,
    diffResults,
    selectedDiffs,
    onToggleDiff,
    onCopy,
    onClose,
    rowData
}) => {
    // Create name lookup map
    const nameById = useMemo(() => {
        const map = {};
        rowData.forEach((c) => {
            map[c.id] = c.Name;
        });
        return map;
    }, [rowData]);

    const { results = {}, sourceState, targetState } = diffResults || {};

    const [metadata, setMetadata] = useState({});

    useEffect(() => {
        if (!diffResults) return;
        const initial = {};
        Object.keys(results).forEach((cid) => {
            const cDiffs = results[cid];
            Object.keys(cDiffs).forEach((tid) => {
                const k = `${cid}-${tid}`;
                const d = cDiffs[tid];
                initial[k] = {
                    weight: d.weight || '',
                    qual_label: d.qual_label || '',
                    notes: d.notes || ''
                };
            });
        });
        setMetadata(initial);
    }, [diffResults, results]);

    if (!show || !diffResults) return null;

    const handleMetaChange = (entry, field, value) => {
        setMetadata(prev => {
            const updated = {
                ...prev,
                [entry.key]: { ...prev[entry.key], [field]: value }
            };
            updateMetadataFor(sourceState, targetState, entry.containerId, entry.targetId, updated[entry.key]);
            if (results[entry.containerId] && results[entry.containerId][entry.targetId]) {
                results[entry.containerId][entry.targetId][field] = value;
            }
            return updated;
        });
    };

    // Build list of diff entries for display
    const diffEntries = [];
    Object.keys(results).forEach((containerId) => {
        const containerDiffs = results[containerId];
        const containerName = nameById[containerId] || containerId;

        Object.keys(containerDiffs).forEach((targetId) => {
            const diff = containerDiffs[targetId];
            const targetName = nameById[targetId] || targetId;
            const key = `${containerId}-${targetId}`;

            let description = '';
            if (diff.status === "added") {
                description = `${containerName} Added ${targetName}: ${diff.relationship}`;
            } else if (diff.status === "changed") {
                description = `${containerName} Changed ${targetName}: ${diff.relationship}`;
            } else if (diff.status === "removed") {
                description = `${containerName} Removed ${targetName}: ${diff.relationship}`;
            }

            diffEntries.push({
                key,
                description,
                status: diff.status,
                containerName,
                targetName,
                relationship: diff.relationship,
                containerId,
                targetId
            });
        });
    });

    const selectedCount = Object.values(selectedDiffs).filter(Boolean).length;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full flex flex-col" style={{ maxHeight: 'calc(100vh - 96px)' }}>
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-200 flex-shrink-0">
                    <h3 className="text-lg font-semibold">
                        Select Differences: {sourceState} → {targetState}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                    >
                        ×
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-4 min-h-0">
                    {diffEntries.length === 0 ? (
                        <div className="text-gray-500 text-center py-8">
                            No differences found
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {diffEntries.map((entry) => (
                                <label
                                    key={entry.key}
                                    className="flex items-start space-x-3 p-3 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedDiffs[entry.key] || false}
                                        onChange={() => onToggleDiff(entry.key)}
                                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-900 break-words">
                                            {entry.description}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            Status: <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                                entry.status === 'added' ? 'bg-green-100 text-green-800' :
                                                entry.status === 'changed' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-red-100 text-red-800'
                                            }`}>
                                                {entry.status}
                                            </span>
                                        </div>
                                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                                            <input
                                                type="number"
                                                placeholder="Weight"
                                                value={metadata[entry.key]?.weight || ''}
                                                onChange={(e) => handleMetaChange(entry, 'weight', e.target.value)}
                                                className="border border-gray-300 rounded px-1 py-0.5"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Label"
                                                value={metadata[entry.key]?.qual_label || ''}
                                                onChange={(e) => handleMetaChange(entry, 'qual_label', e.target.value)}
                                                className="border border-gray-300 rounded px-1 py-0.5"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Notes"
                                                value={metadata[entry.key]?.notes || ''}
                                                onChange={(e) => handleMetaChange(entry, 'notes', e.target.value)}
                                                className="border border-gray-300 rounded px-1 py-0.5"
                                            />
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center p-4 border-t border-gray-200 flex-shrink-0">
                    <div className="text-sm text-gray-600">
                        {selectedCount} of {diffEntries.length} selected
                    </div>
                    <div className="space-x-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onCopy}
                            disabled={selectedCount === 0}
                            className={`px-4 py-2 text-sm rounded text-white ${
                                selectedCount === 0 
                                    ? 'bg-gray-300 cursor-not-allowed' 
                                    : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                        >
                            Copy Selected ({selectedCount})
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DiffPopup;
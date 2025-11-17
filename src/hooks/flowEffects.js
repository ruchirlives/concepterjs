import { useEffect, useCallback, useRef } from 'react';
import { useAppContext, rowInLayers } from '../AppContext';
import { applyEdgeChanges, } from '@xyflow/react';
import { setPosition, addChildren } from '../api';
import { requestRefreshChannel } from "./effectsShared";
import useCreateNewRow from '../components/ModalNewContainer';
import { generateNodesAndEdges } from './flowGenerateGraph';
import { handleEdgeConnection, handleEdgeRemoval } from './flowFunctions';


export const useOnConnectEnd = (params) => {
    const { setEdges, addEdge, setNodes, screenToFlowPosition, setLayoutPositions } = params;
    const newRowFunc = useCreateNewRow();

    const onConnectEnd = useCallback(
        (event, connectionState) => {

            const createNode = async (event) => {
                const { clientX, clientY } =
                    "changedTouches" in event ? event.changedTouches[0] : event;
                const basePosition = screenToFlowPosition({ x: clientX, y: clientY });

                const result = await newRowFunc();
                if (!result) {
                    console.log("Node creation cancelled or failed");
                    return null;
                }

                const { newRows = [], loadedNodes = [] } = result;

                let nodesToAdd = [];

                // 1. Add nodes from loadedNodes (checked search results)
                console.log("Loaded nodes:", loadedNodes);
                if (Array.isArray(loadedNodes) && loadedNodes.length > 0) {
                    nodesToAdd = nodesToAdd.concat(
                        loadedNodes.map((row, index) => ({
                            id: row.id,
                            position: {
                                x: basePosition.x,
                                y: basePosition.y + index * 80,
                            },
                            data: { Name: row.Name },
                            origin: [0.5, 0.0],
                        }))
                    );
                }

                // 2. Add nodes from textarea input (if any)
                if (Array.isArray(newRows) && newRows.length > 0) {
                    nodesToAdd = nodesToAdd.concat(
                        newRows.map((row, index) => ({
                            id: row.id,
                            position: {
                                x: basePosition.x,
                                y: basePosition.y + (nodesToAdd.length + index) * 80,
                            },
                            data: { Name: row.Name },
                            origin: [0.5, 0.0],
                        }))
                    );
                }

                if (nodesToAdd.length === 0) {
                    console.log("No nodes to add");
                    return null;
                }

                setNodes((nds) => nds.concat(nodesToAdd));
                return nodesToAdd;
            };


            const handleDrop = async () => {
                console.log("Handling drop to create new node(s)");

                const newNodes = await createNode(event); // returns array of nodes

                if (!Array.isArray(newNodes) || newNodes.length === 0) {
                    console.log("Node creation cancelled or failed");
                    return;
                }
                console.log("New rows created:", newNodes);

                const targetArray = newNodes.map(node => node.id);
                console.log("Target array:", targetArray);

                // Helper to get the underlying container id for any node (handles group clones)
                const getLogicalId = (n) => {
                    if (!n) return '';
                    if (n.data && n.data.id != null) return String(n.data.id);
                    const raw = String(n.id ?? '');
                    return raw.includes('__in__') ? raw.split('__in__')[0] : raw;
                };

                await Promise.all(newNodes.map(async (node) => {
                    // Check if fromNode has a handleId and determine connection direction
                    let connectionParams;
                    console.log("Creating connection parameters for node:", node.id, connectionState);

                    if (connectionState.fromHandle) {
                        // Check if it's an input or output handle
                        console.log("Reached valid handle:", connectionState.fromHandle);
                        const isInputHandle = connectionState.fromHandle.type === 'target';

                        if (isInputHandle) {
                            // Input handle: fromNode becomes target, new node becomes source
                            connectionParams = {
                                source: getLogicalId(node),
                                target: getLogicalId(connectionState.fromNode),
                            };

                        } else {
                            // Output handle: fromNode becomes source, new node becomes target
                            connectionParams = {
                                source: getLogicalId(connectionState.fromNode),
                                target: getLogicalId(node),
                            };

                        }
                    } else {
                        // No handle specified, error
                        console.error("No handle specified for connection, cannot create edge.");
                        return;

                    }
                    // Persist relationship immediately (ensure it works even if Grid isn't mounted)
                    try {
                        const p = String(connectionParams.source);
                        const c = String(connectionParams.target);
                        await addChildren(p, [c]);
                    } catch (e) {
                        console.warn('Failed to persist child link (connectEnd)', e);
                    }
                    handleEdgeConnection({ connectionParams, setEdges, addEdge });
                }));
                // Let other views recompute after batch
                requestRefreshChannel();

                // position the new nodes in the flow at the drop position
                const dropPosition = screenToFlowPosition({
                    x: event.clientX,
                    y: event.clientY,
                });
                setLayoutPositions((prevPositions) => ({
                    ...prevPositions,
                    ...newNodes.reduce((acc, node, index) => {
                        acc[node.id] = {
                            x: dropPosition.x,
                            y: dropPosition.y + index * 50, // increment y by 50 each time
                        };
                        return acc;
                    }, {}),
                }));



            };



            if (!connectionState.isValid) {
                console.log('Invalid connection, creating new node');
                handleDrop();
            }
        },
        // Notice we removed rowData from the dependency array.
        [setNodes, screenToFlowPosition, setEdges, addEdge, setLayoutPositions, newRowFunc]
    );

    return onConnectEnd;
};

function findDescendants(nodeId, edges, depth = 3) {
    const descendants = new Set();
    let current = [nodeId];

    for (let level = 0; level < depth; level++) {
        const next = [];
        for (const parentId of current) {
            edges.forEach(edge => {
                if (edge.source === parentId) {
                    const childId = edge.target;
                    if (!descendants.has(childId)) {
                        descendants.add(childId);
                        next.push(childId);
                    }
                }
            });
        }
        current = next;
    }

    return Array.from(descendants);
}

// effect to listen to selectNodeChannel event and select and scroll to the node in the flow
export const useSelectNode = (nodes, edges, setNodes, rowData, handleTransform, centerNode) => {

    const highlightNodes = useCallback((nodeId) => {

        const nodes = nodesDataRef.current;
        const edges = edgesRef.current; // ✅ Use latest edges

        const node = nodes.find(n => n.data.id === nodeId);
        if (!node) return;

        // if (!window.__FLOW_SUPPRESS_CENTERING__) {
        //     centerNode(node);
        // }

        const descendants = findDescendants(node.id, edges, 2);

        setNodes(nds =>
            nds.map(n => {
                if (n.id === node.id) {
                    n.data.highlighted = true;
                    return { ...n, selected: true, style: { ...n.style } };
                } else if (descendants.includes(n.id)) {
                    n.data.highlighted = true;
                    return {
                        ...n,
                    };
                } else {
                    n.data.highlighted = false;
                    return n;
                }
            })
        );
    }, [setNodes]);

    const rowDataRef = useRef(rowData);
    const nodesDataRef = useRef(nodes);
    const edgesRef = useRef(edges); // ✅ Track edges

    useEffect(() => { rowDataRef.current = rowData; }, [rowData]);
    useEffect(() => { nodesDataRef.current = nodes; }, [nodes]);
    useEffect(() => { edgesRef.current = edges; }, [edges]); // ✅ Keep edges updated

    useEffect(() => {
        const channel = new BroadcastChannel('selectNodeChannel');

        channel.onmessage = (event) => {
            const { nodeId } = event.data;
            highlightNodes(nodeId);

        };

        return () => channel.close();
    }, [highlightNodes]);

    return highlightNodes;

};


// onConnect
export const useOnConnect = (setEdges, addEdge, rowData) => {
    const onConnect = useCallback(async (connectionParams) => {
        console.log('Connection params:', connectionParams);
        handleEdgeConnection({ connectionParams, setEdges, addEdge });

        let sourceId = connectionParams.source;
        let targetId = connectionParams.target;

        // Check if we are using a special handle (e.g., in-child or out-child)
        const isOutChildHandle = connectionParams.sourceHandle && connectionParams.sourceHandle.startsWith('out-child-');
        const isInChildHandle = connectionParams.targetHandle && connectionParams.targetHandle.startsWith('in-child-');

        if (isOutChildHandle) {
            console.log('Sourcehandle:', connectionParams.sourceHandle);
            // Format: "out-child-<parentId>-on-<childId>"
            const [, after] = connectionParams.sourceHandle.split('out-child-');
            const parts = after.split('-on-');
            const parentId = parts[0];
            const childId = parts[1];
            // When connecting from a child representation inside a group,
            // the logical source should be the child itself, not the group/parent.
            sourceId = childId || parentId;
        }

        if (isInChildHandle) {
            // Format: "in-child-<childId>-on-<parentId>"
            const [, ids] = connectionParams.targetHandle.split('in-child-');
            const [childId] = ids.split('-on-');
            targetId = childId;
        }

        // Normalize ids: map clone ids like "<id>__in__<parent>" back to underlying container ids
        const normalizeId = (val) => {
            const s = String(val ?? '');
            return s.includes('__in__') ? s.split('__in__')[0] : s;
        };
        sourceId = normalizeId(sourceId);
        targetId = normalizeId(targetId);

        console.log('Source ID:', sourceId);
        console.log('Target ID:', targetId);

        // Debug names from source and target id
        // const sourceNode = rowData.find(row => row.id === sourceId);
        // const targetNode = rowData.find(row => row.id === targetId);

        // console.log('Source node:', sourceNode.Name);
        // console.log('Target node:', targetNode.Name);


        // Persist relationship immediately (ensure it works even if Grid isn't mounted)
        try {
            const p = String(sourceId);
            const c = String(targetId);
            await addChildren(p, [c]);
        } catch (e) {
            console.warn('Failed to persist child link (connect)', e);
        }
        // Notify other views to refresh derived data
        requestRefreshChannel();
    }, [setEdges, addEdge]);

    return onConnect;
};

export const useOnEdgeChange = (setEdges) => {
    const onEdgesChange = useCallback(
        (changes) => {
            // Update the edges state.
            setEdges((oldEdges) => {
                // For each removal change, find the corresponding edge in the old edges.
                changes.forEach((change) => {
                    if (change.type === 'remove') {
                        // change.id holds the id of the removed edge.
                        handleEdgeRemoval(oldEdges, change.id);
                    }
                });
                // Return the new edges array after applying all changes.
                return applyEdgeChanges(changes, oldEdges);
            });
        },
        [setEdges]
    );

    return onEdgesChange;
};

export const useOnEdgeDoubleClick = (setEdges) => {
    const { baseUrl } = useAppContext();
    const onEdgeDoubleClick = useCallback(
        (event, edge) => {
            console.log('Edge double-clicked:', edge);
            const sourceId = edge.source;
            const targetId = edge.target;
            // Open an input dialog to edit the edge label
            const currentLabel = edge.label ?? edge.data?.fullLabel ?? edge.data?.label ?? '';
            const newLabel = window.prompt('Enter new label:', currentLabel);
            if (newLabel !== null) {
                // Update the edge label in the state
                setEdges((eds) =>
                    eds.map((e) => {
                        if (e.id === edge.id) {
                            const fullLabel = newLabel;
                            const label = fullLabel.length > 20 ? fullLabel.substring(0, 20) + '...' : fullLabel;
                            return { ...e, data: { ...e.data, label, fullLabel } };
                        }
                        return e;
                    })
                );
                // Call your API to set the new position using the new label
                setPosition(sourceId, targetId, newLabel, baseUrl)
                    .then((response) => {
                        if (response) {
                            console.log("Position set successfully.");
                        } else {
                            alert("Failed to set position.");
                        }
                    })
                    .catch((error) => {
                        console.error("Error setting position:", error);
                        alert("Failed to set position.");
                    });
            }
        },
        [setEdges, baseUrl] // Add baseUrl to dependencies
    );

    return onEdgeDoubleClick;
}

// Effect to create edges between nodes
export const useCreateNodesAndEdges = (params) => {
    const {
        rowData,
        stateScores,
        getHighestScoringContainer,
        groupByLayers,
        showGhostConnections,
        showGroupNodes,
        selectedContentLayer,
        rowSelectedLayer,
        columnSelectedLayer,
        flowGridDimensions,
    } = params;
    const { activeLayers, setEdges, setNodes, parentChildMap, setParentChildMap, layerOptions, influencersMap, refreshInfluencers } = useAppContext();
    const rowDataRef = useRef(rowData);

    useEffect(() => {
        rowDataRef.current = rowData;
    }, [rowData]);

    useEffect(() => {
        if (!rowData || rowData.length === 0) {
            setNodes([]);
            setEdges([]);
            return;
        }

        // Early filter by content layer if provided (defensive; rowData may already be filtered upstream)
        const preFiltered = Array.isArray(rowData) && selectedContentLayer
            ? rowData.filter(container => {
                const tags = (container.Tags || '')
                    .split(',')
                    .map(t => t.trim());
                return tags.includes(selectedContentLayer);
            })
            : rowData;

        // Then apply activeLayers visibility filter
        const filtered = preFiltered.filter(r => rowInLayers(r, activeLayers));
        // Debounce graph regeneration to avoid thrashing on rapid changes
        const t = setTimeout(() => {
            (async () => {
                await generateNodesAndEdges({
                    ...params,
                    rowData: filtered,
                    stateScores,
                    getHighestScoringContainer,
                    parentChildMap,
                    setParentChildMap,
                    groupByLayers,
                    activeLayers,
                    layerOptions,
                    showGhostConnections,
                    showGroupNodes,
                    rowSelectedLayer,
                    columnSelectedLayer,
                    flowGridDimensions,
                    // influencers support
                    influencersMap,
                    refreshInfluencers,
                });
            })();
        }, 120);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        rowData,
        selectedContentLayer,
        activeLayers,
        stateScores,
        parentChildMap,
        setParentChildMap,
        groupByLayers,
        showGhostConnections,
        showGroupNodes,
        rowSelectedLayer,
        columnSelectedLayer,
        flowGridDimensions,
    ]);
};


export const useTagsChange = (rowData, setRowData, keepLayout) => {
    const { rowData: tagFilter, activeLayers } = useAppContext();
    const rowDataRef = useRef(rowData);

    // Keep ref updated
    useEffect(() => {
        rowDataRef.current = rowData;
    }, [rowData]);

    useEffect(() => {
        let filteredTagFilter = [];
        if (keepLayout) {
            filteredTagFilter = tagFilter.filter((row) =>
                rowDataRef.current.some((r) => r.id === row.id)
            );
        } else {
            filteredTagFilter = tagFilter;
            // console.log('Keeping all rows in tagFilter');
        }
        filteredTagFilter = filteredTagFilter.filter(r => rowInLayers(r, activeLayers));

        const currentRows = rowDataRef.current;
        const isSameLength = filteredTagFilter.length === currentRows.length;
        const isSameIds = isSameLength && filteredTagFilter.every((row, idx) => row.id === currentRows[idx].id);

        if (!isSameIds) {
            setRowData(filteredTagFilter);
        }
    }, [tagFilter, keepLayout, setRowData, activeLayers]);
};



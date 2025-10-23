import axios from "axios";
import { getApiUrl, getPasscode } from "./apiConfig";
import { requestRefreshChannel } from "hooks/effectsShared";

const apiClient = axios.create({
    baseURL: getApiUrl(), // Set the base URL for all requests
});

// Add request interceptor to include passcode in all requests
apiClient.interceptors.request.use((config) => {
    const passcode = getPasscode();
    if (passcode) {
        // Add passcode to headers
        config.headers['X-Passcode'] = passcode;

        // Alternatively, you could add it to the request body for POST requests:
        // if (config.method === 'post' && config.data) {
        //     config.data.passcode = passcode;
        // }
    }
    return config;
});

export default apiClient;

// Fetch single container by ID
export const fetchContainerById = async (id) => {
    try {
        const response = await apiClient.get(`${getApiUrl()}/get_container/${id}`);
        const containers = response.data.containers;
        // Return the first container object, or null if none
        return Array.isArray(containers) && containers.length > 0
            ? containers[0]
            : null;
    } catch (error) {
        console.error("Error fetching container by ID:", error);
        return null;
    }
}

// Fetch all containers
export const fetchContainers = async () => {
    try {
        const response = await apiClient.get(`${getApiUrl()}/get_containers`);
        let containers = response.data.containers;
        console.log("Fetched containers:", containers.length);

        // Duplicate check (warn)
        if (Array.isArray(containers)) {
            const idCounts = containers.reduce((acc, c) => {
                acc[c.id] = (acc[c.id] || 0) + 1;
                return acc;
            }, {});
            const dupes = Object.entries(idCounts).filter(([id, count]) => count > 1);
            if (dupes.length > 0) {
                console.warn("Duplicate container IDs found in fetchContainers:", dupes.map(([id, count]) => `${id} (x${count})`));
            }

            // Deduplicate by id
            const seen = new Set();
            containers = containers.filter(c => {
                if (seen.has(c.id)) return false;
                seen.add(c.id);
                return true;
            });
        }

        return containers;
    } catch (error) {
        console.error("Error fetching containers:", error);
    }
};

// Create a new container in backend
export const createContainer = async () => {
    try {
        const response = await apiClient.get(`${getApiUrl()}/create_container`);
        return response.data.id;
    } catch (error) {
        console.error("Error creating container:", error);
        return null;
    }
};


// Get Mermaid json
export const get_mermaid = async (rowId) => {
    try {
        const response = await apiClient.post(`${getApiUrl()}/get_mermaid`, {
            "container_id": rowId,
        });
        // api returns the mermaid as json with mermaid key
        return response.data.mermaid;
    } catch (error) {
        console.error("Error fetching Mermaid json:", error);
        return "";
    }
};

// Get Gantt
export const get_gantt = async (rowId) => {
    try {
        const response = await apiClient.post(`${getApiUrl()}/get_gantt`, {
            "container_id": rowId,
        });
        return response.data.mermaid;
    } catch (error) {
        console.error("Error fetching Gantt json:", error);
        return "";
    }
};

// request rename_container using just id
export const renameContainer = async (id) => {
    try {
        const response = await apiClient.get(`${getApiUrl()}/rename_container/${id}`);
        return response.data;
    } catch (error) {
        console.error("Error renaming container:", error);
        return null;
    }
};



// Get docx as a downloadable Blob URL
export const get_docx = async (rowId) => {
    try {
        const response = await apiClient.post(
            `${getApiUrl()}/get_docx`,
            { container_id: rowId },
            { responseType: "blob" }  // Configure to expect binary data
        );
        // Create a URL from the Blob data
        const blob = new Blob([response.data], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
        const url = window.URL.createObjectURL(blob);
        return url;
    } catch (error) {
        console.error("Error fetching docx:", error);
        return "";
    }
};

// Get OneNote content
export const get_onenote = async (rowId) => {
    try {
        const response = await apiClient.post(`${getApiUrl()}/get_onenote`, {
            "container_id": rowId,
        });
        return response.data.onenote;
    } catch (error) {
        console.error("Error fetching OneNote content:", error);
        return "";
    }
};

// Export containers to Tabletop Simulator (TTS)
// Body: { container_ids?: string[], save_path?: string }
// Response: { ok: boolean, exported?: number, path?: string, error?: string }
export const exportTTS = async ({ containerIds, savePath } = {}) => {
    try {
        const body = {};
        if (Array.isArray(containerIds)) body.container_ids = containerIds;
        if (typeof savePath === 'string' && savePath.length > 0) body.save_path = savePath;

        const response = await apiClient.post(`${getApiUrl()}/export_tts`, body);
        const data = response?.data || {};
        if (!response?.status || response.status >= 400 || data.ok === false) {
            throw new Error(data?.error || 'Export failed');
        }
        return data;
    } catch (error) {
        const message = error?.response?.data?.error || error?.message || 'Export failed';
        console.error('Error exporting to TTS:', error);
        return { ok: false, error: message };
    }
};

// Fetch parent containers
export const fetchParentContainers = async (rowId) => {
    try {
        const response = await apiClient.get(`${getApiUrl()}/get_parents/${rowId}`);
        return response.data.containers;
    } catch (error) {
        console.error("Error fetching parent containers:", error);
        return [];
    }
};

// Function to fetch children dynamically
export const fetchChildren = async (parentId) => {
    try {
        const response = await apiClient.get(`${getApiUrl()}/children/${parentId}`);
        console.log(`${getApiUrl()}/children/${parentId}`);
        // console.log(response.data.containers);
        return response.data.containers;
    }
    catch (error) {
        console.error("Error fetching children:", error);
        return [];
    }
};

// Function to submit an array of containerIDs to the API which will return an array of containerIDs with a subarray of children for each
export const manyChildren = async (containerIds) => {
    try {
        const response = await apiClient.post(`${getApiUrl()}/manyChildren`, {
            container_ids: containerIds,
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching children by IDs:", error);
        return null;
    }
};

export const suggestRelationship = async (sourceId, targetId) => {
    try {
        console.log(`Suggesting relationship from API: ${sourceId} -> ${targetId}`);
        const response = await apiClient.post(`${getApiUrl()}/suggest_relationship`, {
            source_id: sourceId,
            target_id: targetId,
        });
        // Debug the response
        console.log("API Response:", response.data);
        if (response.data) {
            const data = response.data; // Remove newlines
            console.log("Found relationship suggestion:", data);
            return data;
        } else {
            console.log("No relationship suggestion found, returning empty string");
            return "";
        }
    } catch (error) {
        if (error.response?.status === 500) {
            console.warn(`No relationship suggestion exists between ${sourceId} and ${targetId} (500 error expected)`);
        }
        console.error("Error suggesting relationship:", error);
        return ""; // Return empty string instead of "error"
    }
};

export const getPosition = async (sourceId, targetId) => {
    try {
        console.log(`Fetching position from API: ${sourceId} -> ${targetId}`);
        const response = await apiClient.get(`${getApiUrl()}/get_position/${sourceId}/${targetId}`);

        // Debug the response
        console.log("API Response:", response.data);

        if (response.data) {
            const data = response.data; // Remove newlines
            console.log("Found relationship data:", data);
            return data;
        } else {
            console.log("No relationship label found, returning empty string");
            return "";
        }
    } catch (error) {
        if (error.response?.status === 500) {
            console.warn(`No relationship label exists between ${sourceId} and ${targetId} (500 error expected)`);
        } else {
            console.error("Error fetching position:", error);
        }
        return ""; // Return empty string instead of "error"
    }
};

// Relationship APIs
export const getRelationships = async (sourceId) => {
    try {
        const response = await apiClient.get(`${getApiUrl()}/get_relationships/${sourceId}`);
        return response.data || [];
    } catch (error) {
        if (error.response?.status === 404) {
            console.warn(`Container ${sourceId} not found when fetching relationships`);
            return [];
        }
        console.error("Error fetching relationships:", error);
        return [];
    }
};

export const addRelationship = async (containerId, sourceId, targetId, position = {}) => {
    try {
        const response = await apiClient.post(`${getApiUrl()}/add_relationship`, {
            container_id: containerId,
            source_id: sourceId,
            target_id: targetId,
            position: position,
        });
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            console.warn("Container not found while adding relationship");
        }
        console.error("Error adding relationship:", error);
        return { error: true, message: error?.response?.data?.message || "Failed to add relationship" };
    }
};

export const removeRelationship = async (containerId, sourceId, targetId) => {
    try {
        const response = await apiClient.post(`${getApiUrl()}/remove_relationship`, {
            container_id: containerId,
            source_id: sourceId,
            target_id: targetId,
        });
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            console.warn("Container not found while removing relationship");
        }
        console.error("Error removing relationship:", error);
        return { error: true, message: error?.response?.data?.message || "Failed to remove relationship" };
    }
};

export const getInfluencers = async (pairsOrSourceId, maybeTargetId) => {
    // Supports:
    // - getInfluencers("A1", "B2")
    // - getInfluencers({ source_id: "A1", target_id: "B2" })
    // - getInfluencers({ pairs: [ { source_id: "A1", target_id: "B2" }, ["C3","D4"] ] })
    // - getInfluencers([ ["A1","B2"], ["C3","D4"] ])
    try {
        const makeKey = (s, t) => `${String(s)}::${String(t)}`;

        // Normalize inputs to an array of [source, target] string tuples
        const normalizePairs = (input) => {
            const out = [];
            if (Array.isArray(input)) {
                // Could be [[s,t], ...] or [objects]
                for (const item of input) {
                    if (Array.isArray(item) && item.length >= 2) {
                        const [s, t] = item;
                        if (s != null && t != null) out.push([String(s), String(t)]);
                    } else if (item && typeof item === 'object') {
                        const s = item.source_id ?? item.source;
                        const t = item.target_id ?? item.target;
                        if (s != null && t != null) out.push([String(s), String(t)]);
                    }
                }
            } else if (input && typeof input === 'object') {
                if (Array.isArray(input.pairs)) return normalizePairs(input.pairs);
                const s = input.source_id ?? input.source;
                const t = input.target_id ?? input.target;
                if (s != null && t != null) out.push([String(s), String(t)]);
            }
            return out;
        };

        let pairs = [];
        if (maybeTargetId !== undefined) {
            // Signature: (sourceId, targetId)
            if (pairsOrSourceId != null && maybeTargetId != null) {
                pairs = [[String(pairsOrSourceId), String(maybeTargetId)]];
            }
        } else {
            pairs = normalizePairs(pairsOrSourceId);
        }

        // De-duplicate pairs
        const seen = new Set();
        pairs = pairs.filter(([s, t]) => {
            const k = makeKey(s, t);
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });

        if (pairs.length === 0) {
            console.warn("getInfluencers: No valid pairs provided");
            return {}; // Mirror 400 behavior with an empty result for frontend safety
        }

        // Build request body; always use pairs array to keep it consistent
        const requestBody = { pairs };

        const response = await apiClient.post(`${getApiUrl()}/get_influencers`, requestBody);
        const data = response?.data || {};

        // console.log("getInfluencers response data:", data);

        // Ensure all requested keys are present even if backend omits empty arrays
        const result = { ...(typeof data === 'object' ? data : {}) };
        for (const [s, t] of pairs) {
            const k = makeKey(s, t);
            if (!Array.isArray(result[k])) result[k] = [];
        }
        return result;
    } catch (error) {
        const status = error?.response?.status;
        if (status === 400) {
            console.warn(error.response?.data?.message || "Invalid or missing pairs (400)");
            return {};
        }
        if (status === 500) {
            console.warn("Repository not configured server-side (500)");
            return {};
        }
        if (status === 501) {
            console.warn("Repository does not implement influencer lookup (501)");
            return {};
        }
        console.error("Error fetching influencers:", error);
        return {};
    }
};

// getNarratives
export const getNarratives = async () => {
    try {
        const response = await apiClient.get(`${getApiUrl()}/get_narratives`);
        return response.data || [];
    } catch (error) {
        console.error("Error fetching narratives:", error);
        return [];
    }
};

export const fetchAutoComplete = async (prompt) => {
    try {
        // console.log("Fetching autocomplete suggestions from API...");
        const response = await apiClient.post(`${getApiUrl()}/autocomplete`, {
            prompt: prompt,
        });
        // console.log("Autocomplete response:", response.data);
        return response.data || [];
    } catch (error) {
        console.error("Error fetching autocomplete suggestions:", error);
        return [];
    }
}

export const setPosition = async (sourceId, targetId, label) => {
    try {
        console.log("Setting positions in API...");
        const response = await apiClient.post(`${getApiUrl()}/set_position`, {
            source_id: sourceId,
            target_id: targetId,
            position: { "label": label },
        });
        return response.data;
    } catch (error) {
        console.error("Error setting positions:", error);
        console.log(sourceId, targetId, label);
        return null;
    }
};

export const setNarrative = async (sourceId, targetId, narrative) => {
    try {
        console.log("Setting narrative in API...");
        const response = await apiClient.post(`${getApiUrl()}/set_position`, {
            source_id: sourceId,
            target_id: targetId,
            position: { "narrative": narrative },
        });
        return response.data;
    } catch (error) {
        console.error("Error setting narrative:", error);
        return null;
    }
}

// convert_to_tag
export const convertToTag = async (containerIds) => {
    try {
        console.log("Converting containers to tags:", containerIds);
        const response = await apiClient.post(`${getApiUrl()}/convert_to_tag`, {
            "containerIds": containerIds,
        });
        return response.data;
    } catch (error) {
        console.error("Error converting containers to tags:", error);
        return null;
    }
};

// Function to add_children
export const addChildren = async (parentId, children) => {
    try {
        const response = await apiClient.post(`${getApiUrl()}/add_children`, {
            "parent_id": parentId,
            "children_ids": children,
        });
        return response.data;
    } catch (error) {
        console.error("Error adding children:", error);
        console.log("Parent ID:", parentId);
        console.log("Children IDs:", children);
        return null;
    }
};

export const add_similar = async (parentId, children) => {
    try {
        const response = await apiClient.post(`${getApiUrl()}/add_similar`, {
            "parent_id": parentId,
            "children_ids": children,
        });
        return response.data;
    } catch (error) {
        console.error("Error adding similar:", error);
        return null;
    }
}

export const api_build_chain_beam = async (start_id, end_id, visible_ids) => {
    const response = await apiClient.post(`${getApiUrl()}/build_chain_beam`, {
        "start_id": start_id,
        "end_id": end_id,
        "visible_ids": visible_ids,
        "max_jumps": 5,
        "beam_width": 3,
    });
    return response.data;

}

// Function to remove children
export const removeChildren = async (parentId, children) => {
    try {
        const response = await apiClient.post(`${getApiUrl()}/remove_children`, {
            "parent_id": parentId,
            "children_ids": children,
        });
        return response.data;
    } catch (error) {
        console.error("Error removing children:", error);
        return null;
    }
};

// Function to delete containers
export const deleteContainers = async (containerIds) => {
    try {
        console.log("Deleting containers:", containerIds);
        const response = await apiClient.post(`${getApiUrl()}/delete_containers`, {
            "containers": containerIds,

        });

        return response.data;
    } catch (error) {
        console.error("Error deleting containers:", error);
        return null;
    }
};

// remove_containers
export const removeContainers = async (containerIds) => {
    try {
        console.log("Removing containers:", containerIds);
        const response = await apiClient.post(`${getApiUrl()}/remove_containers`, {
            "containers": containerIds,
        });
        return response.data;
    } catch (error) {
        console.error("Error removing containers:", error);
        return null;
    }
};

export const embed_containers = async (containerIds) => {
    try {
        console.log("Embedding containers:", containerIds);
        const response = await apiClient.post(`${getApiUrl()}/embed_containers`, {
            "containers": containerIds,
        });
        return response.data;
    } catch (error) {
        console.error("Error embedding containers:", error);
        return null;
    }
}

export const exportSelectedContainers = async (containerIds) => {
    try {
        console.log("Exporting selected containers:", containerIds);
        const response = await apiClient.post(`${getApiUrl()}/export_selected`, {
            "containers": containerIds,
        });
        return response.data;
    } catch (error) {
        console.error("Error exporting selected containers:", error);
        return null;
    }
}

export const exportBranch = async (containerIds) => {
    try {
        console.log("Exporting branch for containers:", containerIds);
        const response = await apiClient.post(`${getApiUrl()}/export_branch`, {
            "containers": containerIds,
        });
        return response.data;
    } catch (error) {
        console.error("Error exporting branch:", error);
        return null;
    }
};

// Function to merge containers
export const mergeContainers = async (containerIds) => {
    try {
        console.log("Merging containers:", containerIds);
        const response = await apiClient.post(`${getApiUrl()}/merge_containers`, {
            "containers": containerIds,
        });
        return response.data;
    } catch (error) {
        console.error("Error merging containers:", error);
        return null;
    }
};

// Function to join containers
export const joinContainers = async (containerIds) => {
    try {
        console.log("Joining containers:", containerIds);
        const response = await apiClient.post(`${getApiUrl()}/join_containers`, {
            "containers": containerIds,
        });
        return response.data;
    } catch (error) {
        console.error("Error joining containers:", error);
        return null;
    }
};

// Write back updated data
export const writeBackData = async (data) => {
    console.log("Writing back data:");
    try {
        const response = await apiClient.post(`${getApiUrl()}/write_back_containers`, {
            containers: data,
        });
        return response.data;
    } catch (error) {
        console.error("Error writing back data:", error);
        return null;
    }
};

// Categorize containers
export const categorizeContainers = async (containerIds) => {
    try {
        console.log("Categorizing containers:", containerIds);
        const response = await apiClient.post(`${getApiUrl()}/categorize_containers`, {
            // API expects `container_ids` for categorization
            "container_ids": containerIds,
        });
        return response.data;
    } catch (error) {
        console.error("Error categorizing containers:", error);
        return null;
    }
};

// build_relationships
export const buildRelationshipsContainers = async (containerIds) => {
    try {
        console.log("Building relationships for containers:", containerIds);
        const response = await apiClient.post(`${getApiUrl()}/build_relationships`, {
            "containers": containerIds,
        });
        return response.data;
    } catch (error) {
        console.error("Error building relationships:", error);
        return null;
    }
};

// Get loadable containers
export const getloadContainers = async () => {
    try {
        console.log(`${getApiUrl()}/get_loadable_containers`);
        const response = await apiClient.get(`${getApiUrl()}/get_loadable_containers`);
        console.log(response);
        return response.data.containers;
    } catch (error) {
        console.error("Error loading containers directory:", error);
        return [];
    }
};

export const deleteProject = async (item) => {
    console.log("Deleting project:", item);
    try {
        await apiClient.post(`${getApiUrl()}/delete_project`, {
            project_name: item,
        });
        const newfetch = await apiClient.get(`${getApiUrl()}/get_loadable_containers`);
        return newfetch.data.containers;
    } catch (error) {
        console.error("Error deleting project:", error);
        return [];
    }
}

// Load containers by given item
export const loadContainers = async (item) => {
    console.log("Loading containers for item:", item);
    try {
        await apiClient.post(`${getApiUrl()}/load_containers`, {
            project_name: item,
        });
        const newfetch = await apiClient.get(`${getApiUrl()}/get_containers`);
        // handle state_variables
        const stateVariables = newfetch.data.state_variables || [];
        console.log("Loaded state variables:", stateVariables);
        // Handle state variables as needed

        return newfetch.data.containers;
    } catch (error) {
        console.error("Error loading containers:", error);
        return [];
    }
};

export const importContainers = async (item) => {
    console.log("Importing containers for item:", item);
    try {
        await apiClient.post(`${getApiUrl()}/import_containers`, {
            project_name: item,
        });
        const newfetch = await apiClient.get(`${getApiUrl()}/get_containers`);
        return newfetch.data.containers;
    } catch (error) {
        console.error("Error importing containers:", error);
        return [];
    }
}

export const requestRekey = async () => {
    try {
        const response = await apiClient.get(`${getApiUrl()}/request_rekey`);
        console.log("Request rekey response:", response);
        return response.data;
    } catch (error) {
        console.error("Error requesting rekey:", error);
        return null;
    }
};

// Request dedup
export const requestDedup = async () => {
    try {
        const response = await apiClient.get(`${getApiUrl()}/request_dedup`);
        console.log("Request dedup response:", response);
        return response.data;
    } catch (error) {
        console.error("Error requesting deduplication:", error);
        return null;
    }
};

// recopy_values GET project wide
export const recopyValues = async () => {
    try {
        const response = await apiClient.get(`${getApiUrl()}/recopy_values`);
        console.log("Recopy values response:", response);
        return response.data;
    } catch (error) {
        console.error("Error recopying values:", error);
        return null;
    }
};


// Save containers
export const saveContainers = async (name, state_variables) => {
    try {
        const response = await apiClient.post(`${getApiUrl()}/save_containers`, {
            project_name: name,
            state_variables: state_variables,
        });
        return response.data;
    } catch (error) {
        console.error("Error saving containers:", error);
        return null;
    }
};

export const saveTransitionMetadata = async (metadata) => {
    try {
        // Add debugging
        console.log("Saving transition metadata to API...", metadata);

        const response = await apiClient.post(`${getApiUrl()}/save_transition_metadata`, {
            metadata: metadata,
        }, {
            headers: {
                'Content-Type': 'application/json',
            }
        });

        console.log("Transition metadata saved successfully:", response.data);
        return response.data;
    } catch (e) {
        console.error('Failed to save transition metadata', e);
        console.error('Error details:', e.response?.data);
        console.error('Error status:', e.response?.status);
        console.error('Full error object:', e);
        throw e;
    }
};

export const loadTransitionMetadata = async () => {
    try {
        console.log("Loading transition metadata from API...");
        const response = await apiClient.get(`${getApiUrl()}/load_transition_metadata`, {
            headers: {
                'Content-Type': 'application/json',
            }
        });
        console.log("Transition metadata loaded successfully:", response.data);
        return response.data;
    } catch (e) {
        console.error('Failed to load transition metadata', e);
        console.error('Error details:', e.response?.data);
        console.error('Error status:', e.response?.status);
        return null;
    }
};


export const clearContainers = async () => {
    try {
        const response = await apiClient.get(`${getApiUrl()}/clear_containers`);
        return response.data;
    } catch (error) {
        console.error("Error clearing containers:", error);
        return null;
    }
};

// Add this to api.js
export const createContainersFromContent = async (prompt, content) => {
    try {
        console.log("Creating containers from content...");
        const response = await apiClient.post(`${getApiUrl()}/create_containers_from_content`, {
            prompt: prompt || undefined,
            content: content,
        });
        return response.data;
    } catch (error) {
        console.error("Error creating containers from content:", error);
        throw error; // Re-throw to let the modal handle the error display
    }
};

// Switch to a new state
export const switchState = async (newState) => {
    try {
        console.log("Switching to state:", newState);
        const response = await apiClient.post(
            `${getApiUrl()}/switch_state`,
            { state: newState }
        );
        // broadcast refresh request
        requestRefreshChannel();
        return response.data;
    } catch (error) {
        console.error("Error switching state:", error);
        throw error; // Re-throw to let the caller handle the error display
    }
};

// Remove a state by name
export const removeState = async (stateName) => {
    try {
        console.log("Removing state:", stateName);
        const response = await apiClient.post(
            `${getApiUrl()}/remove_state`,
            { state: stateName }
        );
        return response.data;
    } catch (error) {
        console.error("Error removing state:", error);
        throw error; // Re-throw to let the caller handle the error display
    }
};

// Clear all stored states
export const clearStates = async () => {
    try {
        console.log("Clearing all stored states");
        const response = await apiClient.get(`${getApiUrl()}/clear_states`);
        requestRefreshChannel();
        return response.data;
    } catch (error) {
        console.error("Error clearing states:", error);
        throw error; // Re-throw to let the caller handle the error display
    }
};

// List all stored states
export const listStates = async () => {
    try {
        console.log("Fetching list of states...");
        const response = await apiClient.get(`${getApiUrl()}/list_states`);
        return response.data.states || [];
    } catch (error) {
        console.error("Error listing states:", error);
        throw error; // Re-throw to let the caller handle the error display
    }
};

// Compare states for given containers (refactored to accept source and target)
export const compareStates = async (sourceState, targetState, containerIds) => {
    try {
        const response = await apiClient.post(`${getApiUrl()}/compare_states`, {
            sourceState,
            targetState,
            containerIds,
        });
        return response.data.differences_all || [];
    } catch (error) {
        console.error("Error comparing states:", error);
        throw error;
    }
};

// Apply differences to specified containers
export const applyDifferences = async (containerIds, differences, targetState) => {
    try {
        console.log("Applying differences:", { containerIds, differences, targetState });
        const response = await apiClient.post(`${getApiUrl()}/apply_differences`, {
            containerIds: containerIds,
            differences: differences,
            targetState: targetState,
        });
        return response.data;
    } catch (error) {
        console.error("Error applying differences:", error);
        throw error; // Re-throw to let the caller handle the error display
    }
};

// Revert differences from specified containers
export const revertDifferences = async (containerIds, differences, targetState) => {
    try {
        console.log("Reverting differences:", { containerIds, differences, targetState });
        const response = await apiClient.post(`${getApiUrl()}/revert_differences`, {
            containerIds: containerIds,
            differences: differences,
            targetState: targetState,
        });
        return response.data;
    } catch (error) {
        console.error("Error reverting differences:", error);
        throw error; // Re-throw to let the caller handle the error display
    }
};

// Calculate state scores for containers
export const calculateStateScores = async (baseState) => {
    try {
        console.log("Calculating state scores for base state:", baseState);
        const response = await apiClient.post(`${getApiUrl()}/calculate_state_scores`, {
            baseState: baseState,
        });
        return response.data.scores || {};
    } catch (error) {
        console.error("Error calculating state scores:", error);
        throw error; // Re-throw to let the caller handle the error display
    }
};

export const getContainerBudgetApi = async (containerIds) => {
    const response = await apiClient.post(`${getApiUrl()}/get_container_budget`, { container_ids: containerIds });
    return response.data.budgets;
};

export const convertToBudgetContainerApi = async (containerIds) => {
    const response = await apiClient.post(`${getApiUrl()}/convert_to_budget_container`, { container_ids: containerIds });
    return response.data;
};

export const addFinanceContainerApi = async (containerIds) => {
    const response = await apiClient.post(`${getApiUrl()}/add_finance_container`, { container_ids: containerIds });
    return response.data;
};

export async function joinSimilarContainers(containerIds) {
    const res = await apiClient.post(`${getApiUrl()}/join_similar`, { container_ids: containerIds });
    console.log("joinSimilarContainers response:", res);
    if (res.status !== 200) throw new Error("Failed to join similar containers");
    return res.data;
}

/**
 * Generate embeddings for relationship positions.
 * @param {string[]} containerIds
 * @returns {Promise<Object>} API response
 */
export const embedPositions = async (containerIds) => {
    try {
        const response = await apiClient.post(`${getApiUrl()}/embed_positions`, {
            container_ids: containerIds,
        });
        return response.data;
    } catch (error) {
        console.error("Error embedding positions:", error);
        return null;
    }
};

/**
 * Find similar positions based on embeddings.
 * @param {string} positionText
 * @returns {Promise<Object>} API response
 */
export const findSimilarPositions = async (positionText) => {
    try {
        const response = await apiClient.post(`${getApiUrl()}/find_similar_positions`, {
            position_text: positionText,
        });
        return response.data;
    } catch (error) {
        console.error("Error finding similar positions:", error);
        return null;
    }
};

/**
 * Inherit positions from child containers into a group container.
 * Backend: expects { container_id }
 * @param {string} containerId
 * @returns {Promise<Object|null>} API response with message
 */
export const inheritPositions = async (containerId) => {
    try {
        const response = await apiClient.post(`${getApiUrl()}/inherit_positions`, {
            container_id: containerId,
        });
        return response.data;
    } catch (error) {
        // Surface 4xx/5xx messages when available
        const msg = error?.response?.data?.message || "Error inheriting positions";
        console.error(msg, error);
        return { message: msg, error: true };
    }
};

/**
 * Fetch a single node by its ID from the backend.
 * @param {string} id - The node ID to load.
 * @returns {Promise<Object|null>} The node object, or null if not found.
 */
export const loadNode = async (id) => {
    try {
        const response = await apiClient.post(`${getApiUrl()}/load_node`, { id: id });
        const containers = response.data.containers;
        // Return the first container object, or null if none
        return Array.isArray(containers) && containers.length > 0
            ? containers[0]
            : null;
    } catch (error) {
        if (error.response?.status === 404) {
            console.warn(`Node with ID ${id} not found (404 error expected)`);
            return null; // Return null for 404 errors
        }
        console.error("Error loading node:", error);
        return null;
    }
};

/**
 * Search nodes by a search term.
 * @param {string} searchTerm - The term to search for.
 * @returns {Promise<Array>} Array of matching node results.
 */
export const searchNodes = async (searchTerm, tags) => {
    try {
        const response = await apiClient.post(`${getApiUrl()}/search_nodes`, {
            search_term: searchTerm,
            tags: tags
        });
        return response.data.results || [];
    } catch (error) {
        console.error("Error searching nodes:", error);
        return [];
    }
};

/**
 * Search for position.z using vector search.
 * @param {string} searchTerm - The search term for position.z.
 * @param {number} [top_n=10] - Number of top results to return.
 * @returns {Promise<Array>} Array of names matching the search.
 * 
 */
export const searchPositionZ = async (searchTerm, top_n = 5) => {
    try {
        const response = await apiClient.post(`${getApiUrl()}/search_position_z`, {
            searchTerm,
            top_n
        });
        return response.data.result || [];
    } catch (error) {
        console.error("Error searching position.z:", error);
        return [];
    }
};

// Save all nodes to the backend database
export const saveNodes = async (nodeIds) => {
    try {
        const response = await apiClient.post(`${getApiUrl()}/save_nodes`, {
            nodeIds: nodeIds,
        });
        return response.data; // { message: "Nodes saved successfully" }
    } catch (error) {
        console.error("Error saving nodes:", error);
        return null;
    }
};

import axios from "axios";
import { getApiUrl } from "./apiConfig";

const apiClient = axios.create({
    baseURL: getApiUrl(), // Set the base URL for all requests
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
        return response.data.containers;
    } catch (error) {
        console.error("Error fetching containers:", error);
        alert("Failed to fetch containers. Please check the console for details.");
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


export const getPosition = async (sourceId, targetId) => {
    try {
        console.log("Fetching positions from API...");
        const response = await apiClient.get(`${getApiUrl()}/get_positions/${sourceId}/${targetId}`);
        // strip the response to get the relationship string without the /newline characters
        const relationshipString = response.data.relationshipString;

        return relationshipString;
    } catch (error) {
        console.error("Error fetching positions:", error);
        return "error";
    }
};

export const setPosition = async (sourceId, targetId, relationshipString) => {
    try {
        console.log("Setting positions in API...");
        const response = await apiClient.post(`${getApiUrl()}/set_position`, {
            source_id: sourceId,
            target_id: targetId,
            relationship_string: relationshipString,
        });
        return response.data;
    } catch (error) {
        console.error("Error setting positions:", error);
        return null;
    }
}

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
            "containers": containerIds,
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

// Save containers
export const saveContainers = async (name) => {
    try {
        const response = await apiClient.post(`${getApiUrl()}/save_containers`, {
            project_name: name,
        });
        return response.data;
    } catch (error) {
        console.error("Error saving containers:", error);
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

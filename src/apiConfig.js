// apiConfig.js
import API_URLS from './globalconfig';
let apiUrl = API_URLS.cloudhost; // Holds the current API URL

export const getApiUrl = () => apiUrl; // Function to retrieve the current API URL

export const setApiUrl = (url) => {
    apiUrl = url; // Function to update the API URL
};

// apiConfig.js
let apiUrl = ""; // Holds the current API URL

export const getApiUrl = () => apiUrl; // Function to retrieve the current API URL

export const setApiUrl = (url) => {
    apiUrl = url; // Function to update the API URL
};

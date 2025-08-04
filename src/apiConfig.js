// apiConfig.js
import API_URLS from './hooks/globalconfig';

let apiUrl = API_URLS.cloudhost; // Holds the current API URL
let passcode = ''; // Holds the current passcode

export const getApiUrl = () => apiUrl; // Function to retrieve the current API URL

export const setApiUrl = (url) => {
    apiUrl = url; // Function to update the API URL
};

export const getPasscode = () => passcode; // Function to retrieve the current passcode

export const setPasscode = (code) => {
    passcode = code; // Function to update the passcode
};

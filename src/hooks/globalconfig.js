const DEFAULT_API_URLS = {};
let API_URLS = DEFAULT_API_URLS;

if (typeof process !== "undefined" && process.env?.REACT_APP_API_URLS) {
  try {
    const parsed = JSON.parse(process.env.REACT_APP_API_URLS);
    if (parsed && typeof parsed === "object") {
      API_URLS = parsed;
    } else {
      console.warn(
        "REACT_APP_API_URLS must serialize to a JSON object or array. Falling back to an empty object."
      );
    }
  } catch (error) {
    console.warn(
      "Failed to parse REACT_APP_API_URLS. Provide a valid JSON string with named endpoints.",
      error
    );
  }
}

export default API_URLS;

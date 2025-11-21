// Create a new file: CreateFromContentModal.jsx
import React, { useState } from "react";
import { createContainersFromContent, generateGraph } from "../api";

const CreateFromContentModal = ({ isOpen, setIsOpen, onCreateContainers }) => {
  const [prompt, setPrompt] = useState("");
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const [error, setError] = useState("");
  const [graphResult, setGraphResult] = useState(null);

  const resetState = () => {
    setPrompt("");
    setContent("");
    setError("");
    setGraphResult(null);
    setIsGraphLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!content.trim()) {
      setError("Content is required");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const data = await createContainersFromContent(
        prompt.trim() || undefined,
        content.trim()
      );

      // Success - notify parent and close modal
      onCreateContainers(data);
      handleClose();
      
    } catch (err) {
      // Handle both API errors and network errors
      const errorMessage = err.response?.data?.error || err.message || "Failed to create containers";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateGraph = async () => {
    if (!content.trim()) {
      setError("Content is required");
      return;
    }

    setIsGraphLoading(true);
    setError("");

    try {
      const data = await generateGraph(content.trim());
      setGraphResult(data);
    } catch (err) {
      const errorMessage =
        err.response?.data?.error || err.message || "Failed to generate graph";
      setError(errorMessage);
    } finally {
      setIsGraphLoading(false);
    }
  };

  const handleClose = () => {
    resetState();
    setIsOpen(false);
  };

  const isBusy = isLoading || isGraphLoading;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Create Containers from Content</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-2xl" disabled={isBusy}>
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Error Display */}
          {error && <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>}

          {/* Prompt Field */}
          <div className="mb-4">
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
              Prompt (Optional)
            </label>
            <input
              type="text"
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Extract project tasks and their relationships"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isBusy}
            />
            <p className="text-xs text-gray-500 mt-1">Optional prompt to guide how containers are created from your content</p>
          </div>

          {/* Content Field */}
          <div className="mb-6">
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
              Content <span className="text-red-500">*</span>
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your text content here. The AI will extract containers and relationships from this text..."
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
              disabled={isBusy}
              required
            />
            <p className="text-xs text-gray-500 mt-1">Raw text content to extract containers from (meeting notes, documents, etc.)</p>
          </div>

          {graphResult && (
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-800">Generated Graph Response</h3>
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:text-blue-800"
                  onClick={() => setGraphResult(null)}
                >
                  Clear
                </button>
              </div>
              <pre className="whitespace-pre-wrap text-xs text-gray-800">{JSON.stringify(graphResult, null, 2)}</pre>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleGenerateGraph}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              disabled={isBusy || !content.trim()}
            >
              {isGraphLoading && (
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              )}
              {isGraphLoading ? "Generating Graph..." : "Generate Graph"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
              disabled={isBusy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              disabled={isBusy || !content.trim()}
            >
              {isLoading && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              )}
              {isLoading ? "Creating..." : "Create Containers"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateFromContentModal;

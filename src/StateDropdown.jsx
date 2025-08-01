import React, { useState, useEffect } from "react";
import { listStates, switchState, removeState, clearStates } from "./api";
import toast from "react-hot-toast";

const StateDropdown = ({ 
  className = "",
  onStateChange = () => {},
  initialState = "base"
}) => {
  const [activeState, setActiveState] = useState(initialState);
  const [availableStates, setAvailableStates] = useState([]);
  const [stateInput, setStateInput] = useState("");
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false);

  // Load available states on component mount
  useEffect(() => {
    const loadStates = async () => {
      try {
        const states = await listStates();
        setAvailableStates(states);
      } catch (error) {
        console.error("Failed to load states:", error);
      }
    };
    loadStates();
  }, []);

  // Handle state switching
  const handleStateSwitch = async (stateName) => {
    if (!stateName.trim()) return;

    try {
      await switchState(stateName);
      setActiveState(stateName);
      setStateInput("");
      setStateDropdownOpen(false);

      // Refresh available states
      const states = await listStates();
      setAvailableStates(states);

      // Notify parent component of state change
      onStateChange(stateName);

      toast.success(`Switched to state: ${stateName}`);
    } catch (error) {
      console.error("Failed to switch state:", error);
      toast.error("Failed to switch state");
    }
  };

  // Handle state removal
  const handleRemoveState = async (stateName = activeState) => {
    if (stateName === "base") {
      toast.error("Cannot remove base state");
      return;
    }

    try {
      await removeState(stateName);

      // If we deleted the current active state, switch to base
      if (stateName === activeState) {
        setActiveState("base");
        onStateChange("base");
      }

      // Refresh available states
      const states = await listStates();
      setAvailableStates(states);

      toast.success(`Removed state: ${stateName}`);
    } catch (error) {
      console.error("Failed to remove state:", error);
      toast.error("Failed to remove state");
    }
  };

  // Handle clearing all states
  const handleClearStates = async () => {
    try {
      await clearStates();
      setActiveState("base");
      setAvailableStates([]);
      onStateChange("base");
      toast.success("Cleared all states");
    } catch (error) {
      console.error("Failed to clear states:", error);
      toast.error("Failed to clear states");
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (stateDropdownOpen && !event.target.closest('.state-dropdown')) {
        setStateDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [stateDropdownOpen]);

  return (
    <div className={`relative state-dropdown ${className}`}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setStateDropdownOpen(!stateDropdownOpen);
        }}
        className="px-3 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center gap-1"
        title="Manage states"
      >
        <span>State: {activeState}</span>
        <span className={`transform transition-transform ${stateDropdownOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {stateDropdownOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 min-w-64">
          <div className="p-2 border-b border-gray-200 text-xs font-medium text-gray-600">State Management</div>

          {/* State input/combobox */}
          <div className="p-2 border-b border-gray-200">
            <input
              type="text"
              value={stateInput}
              onChange={(e) => setStateInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleStateSwitch(stateInput);
                }
              }}
              placeholder="Type new state name or select existing..."
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStateSwitch(stateInput);
              }}
              disabled={!stateInput.trim()}
              className="w-full mt-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
            >
              Switch to State
            </button>
          </div>

          {/* Available states list */}
          <div className="max-h-40 overflow-y-auto">
            {availableStates.length === 0 ? (
              <div className="p-3 text-xs text-gray-500">No saved states</div>
            ) : (
              availableStates.map((state) => (
                <div key={state} className={`flex items-center justify-between hover:bg-gray-50 ${state === activeState ? "bg-blue-50" : ""}`}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStateSwitch(state);
                    }}
                    className={`flex-1 text-left p-2 text-sm ${state === activeState ? "text-blue-700 font-medium" : ""}`}
                  >
                    {state}
                  </button>
                  {state !== "base" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveState(state);
                      }}
                      className="px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded mr-2"
                      title={`Delete ${state}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))
            )}

          </div>

          {/* Action buttons */}
          <div className="p-2 border-t border-gray-200 flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClearStates();
              }}
              className="flex-1 px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Clear All
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StateDropdown;

import React, { useState, useEffect } from "react";
import { useAppContext } from "../AppContext";
import { listStates } from "../api";

const StateDropdown = ({ 
  className = "",
  onStateChange = () => {}
}) => {
  const {
    activeState,
    availableStates,
    setAvailableStates,
    handleStateSwitch,
    handleRemoveState,
    handleClearStates
  } = useAppContext();

  const [stateInput, setStateInput] = useState("");
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false);

  // Load available states on StateDropdown opening
  useEffect(() => {
    if (!stateDropdownOpen) return;
    // Fetch states only when dropdown is opened
    const loadStates = async () => {
      try {
        const states = await listStates();
        setAvailableStates(states);
      } catch (error) {
        console.error("Failed to load states:", error);
      }
    };
    loadStates();
  }, [setAvailableStates, stateDropdownOpen]);


  // Notify parent component when state changes
  useEffect(() => {
    onStateChange(activeState);
  }, [activeState, onStateChange]);

  // Handle local state switching with input clear
  const handleLocalStateSwitch = async (stateName) => {
    await handleStateSwitch(stateName);
    setStateInput("");
    setStateDropdownOpen(false);
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
                  handleLocalStateSwitch(stateInput);
                }
              }}
              placeholder="Type new state name or select existing..."
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleLocalStateSwitch(stateInput);
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
                      handleLocalStateSwitch(state);
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

// New ComparatorDropdown component - ADD THIS
export const ComparatorDropdown = ({ 
  className = "",
  onComparatorChange = () => {}
}) => {
  const {
    availableStates,
    setAvailableStates,
    comparatorState,
    setComparatorState
  } = useAppContext();

  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Load available states on dropdown opening
  useEffect(() => {
    if (!dropdownOpen) return;
    const loadStates = async () => {
      try {
        const states = await listStates();
        setAvailableStates(states);
      } catch (error) {
        console.error("Failed to load states:", error);
      }
    };
    loadStates();
  }, [setAvailableStates, dropdownOpen]);

  // Notify parent component when comparator changes
  useEffect(() => {
    onComparatorChange(comparatorState);
  }, [comparatorState, onComparatorChange]);

  // Handle comparator state change
  const handleComparatorSelect = (stateName) => {
    setComparatorState(stateName);
    setDropdownOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownOpen && !event.target.closest('.comparator-dropdown')) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  return (
    <div className={`relative comparator-dropdown ${className}`}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setDropdownOpen(!dropdownOpen);
        }}
        className="px-3 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center gap-1"
        title="Select comparator state"
      >
        <span>Comparator: {comparatorState || "Select..."}</span>
        <span className={`transform transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {dropdownOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 min-w-48">
          <div className="p-2 border-b border-gray-200 text-xs font-medium text-gray-600">Select Comparator State</div>

          {/* Available states list */}
          <div className="max-h-40 overflow-y-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleComparatorSelect("");
              }}
              className={`w-full text-left p-2 text-sm hover:bg-gray-50 ${!comparatorState ? "bg-blue-50 text-blue-700 font-medium" : ""}`}
            >
              None
            </button>
            {availableStates.length === 0 ? (
              <div className="p-3 text-xs text-gray-500">No saved states</div>
            ) : (
              availableStates.map((state) => (
                <div key={state} className={`flex items-center justify-between hover:bg-gray-50 ${state === comparatorState ? "bg-blue-50" : ""}`}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleComparatorSelect(state);
                    }}
                    className={`flex-1 text-left p-2 text-sm ${state === comparatorState ? "text-blue-700 font-medium" : ""}`}
                  >
                    {state}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StateDropdown;

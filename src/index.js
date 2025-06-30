import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import AppGrid from './AppGrid';
import AppFlow from './AppFlow';
import AppMermaid from './AppMermaid';
import AppMatrix from './AppMatrix';
import reportWebVitals from './reportWebVitals';

// Create a collapsible wrapper component for AppFlow
const CollapsibleAppFlow = ({ keepLayout, setKeepLayout }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-white rounded shadow">
      {/* Header with collapse button */}
      <div className="flex justify-between items-center bg-white text-black px-4 py-2 cursor-pointer select-none">
        <span className="font-semibold">Flow Diagram</span>
        <button 
          className="text-lg font-bold" 
          onClick={() => setCollapsed((c) => !c)} 
          aria-label={collapsed ? "Expand flow diagram" : "Collapse flow diagram"}
        >
          {collapsed ? "▼" : "▲"}
        </button>
      </div>

      {/* Flow content */}
      <div className={`transition-all duration-300 overflow-hidden`} style={{ height: collapsed ? 0 : 'auto' }}>
        <div className="p-4">
          <AppFlow
            keepLayout={keepLayout}
            setKeepLayout={setKeepLayout}
          />
        </div>
      </div>
    </div>
  );
};

const ButtonPanel = ({ onLoadContainers, keepLayout, setKeepLayout, server, setServer }) => {
  const [buttonsArray] = useState([
    { id: "writeBackButton", text: "Write Back Data" },
    { id: "loadDataButton", text: "Reload Data" },
    { id: "addRowButton", text: "Create Container" },
    { id: "loadContainersButton", text: "Load Containers" },
    { id: "saveContainersButton", text: "Save Containers" },
    { id: "importContainersButton", text: "Import Containers" },
    { id: "clearButton", text: "Clear" },
    { id: "refreshButton", text: "Refresh" },
    { id: "requestRekeyButton", text: "Request Rekey" },
  ]);

  return (
    <div className="flex items-center flex-wrap gap-2 p-4 fixed bottom-0 bg-white border-t w-full z-10">
      {buttonsArray.map((btn) => (
        <button
          key={btn.id}
          id={btn.id}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded"
          onClick={btn.onClick}
        >
          {btn.text}
        </button>
      ))}

      {/* Server Selector */}
      <select
        id="ServerSelector"
        className="border border-gray-300 text-sm px-2 py-1 rounded min-w-[150px]"
        value={server}
        onChange={(e) => setServer(e.target.value)}
      >
        <option value="0">Select Server</option>
        <option value="1">Server A</option>
        <option value="2">Server B</option>
      </select>

      {/* Keep Layout Toggle */}
      <label className="inline-flex items-center space-x-2 text-sm">
        <input
          type="checkbox"
          id="keepLayoutToggle"
          className="h-4 w-4 text-blue-600 border-gray-300 rounded"
          checked={keepLayout}
          onChange={(e) => setKeepLayout(e.target.checked)}
        />
        <span>Keep Layout</span>
      </label>
    </div>
  );
};

const App = () => {
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [keepLayout, setKeepLayout] = useState(false);
  const [server, setServer] = useState("0");

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Header */}
      <header className="px-6 pt-6 pb-4 bg-white border-b shadow-sm">
        <h1 className="text-3xl font-semibold text-gray-800">Concepter</h1>
      </header>

      {/* Main content wrapper */}
      <main className="flex-1 flex flex-col gap-4 px-6 py-4 overflow-y-auto">
        <section id="grid">
          <AppGrid isLoadModalOpen={isLoadModalOpen} setIsLoadModalOpen={setIsLoadModalOpen} />
        </section>

        <section id="matrix">
          <AppMatrix />
        </section>

        {/* Remove wrapper styling since AppFlow now handles its own container */}
        <section id="sub">
          <AppFlow
            keepLayout={keepLayout}
            setKeepLayout={setKeepLayout}
          />
        </section>

        <section id="mermaid" className="mb-28">
          <AppMermaid />
        </section>
      </main>

      {/* Floating panel */}
      <ButtonPanel
        keepLayout={keepLayout}
        setKeepLayout={setKeepLayout}
        server={server}
        setServer={setServer}
        onLoadContainers={() => setIsLoadModalOpen(true)}
      />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();

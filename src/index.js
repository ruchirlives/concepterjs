import React, { useState } from 'react';
import { AppProvider } from './AppContext';
import ReactDOM from 'react-dom/client';
import './index.css';
import AppGrid from './AppGrid';
import AppFlow from './AppFlow';
import AppMermaid from './AppMermaid';
import AppMatrix from './AppMatrix';
import AppKanban from './AppKanban';
import AppLayers from './AppLayers';
import AppState from './AppState';
import CreateFromContentModal from './components/CreateFromContentModal';
import reportWebVitals from './reportWebVitals';
import AppTiptap from './AppTiptap';
import { setPasscode } from './apiConfig';
import { recopyValues } from './api';

// Suppress ResizeObserver error that doesn't affect functionality
const suppressResizeObserverError = (e) => {
  if (
    e.message === 'ResizeObserver loop completed with undelivered notifications.' ||
    e.message === 'ResizeObserver loop limit exceeded' ||
    e.message.includes('ResizeObserver')
  ) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return true;
  }
  return false;
};

// Handle both error and unhandledrejection events
window.addEventListener('error', suppressResizeObserverError);
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && typeof e.reason === 'string' && e.reason.includes('ResizeObserver')) {
    e.preventDefault();
  }
});

// Suppress console errors for ResizeObserver
const originalError = console.error;
console.error = (...args) => {
  const message = args[0];
  if (
    typeof message === 'string' && 
    (message.includes('ResizeObserver') || 
     message.includes('loop completed with undelivered notifications'))
  ) {
    return;
  }
  originalError.apply(console, args);
};

// Memoize the components that don't depend on state
const MemoizedStaticContent = React.memo(() => (
  <>
    <section id="tiptap">
      <AppTiptap />
    </section>

    <section id="matrix">
      <AppMatrix />
    </section>

    <section id="kanban">
      <AppKanban />
    </section>

    <section id="states">
      <AppState />
    </section>

    <section id="mermaid" className="mb-28">
      <AppMermaid />
    </section>
  </>
));

const handleRecopyValues = async () => {
  try {
    const result = await recopyValues();
    if (result) {
      console.log('Recopy values response:', result);
      alert('Values recopied successfully');
    } else {
      alert('Failed to recopy values');
    }
  } catch (error) {
    console.error('Error calling recopy values:', error);
    alert('Error calling recopy values');
  }
};

const ButtonPanel = ({ onLoadContainers, onCreateFromContent, keepLayout, setKeepLayout, server, setServer }) => {
  const [buttonsArray] = useState([
    { id: "writeBackButton", text: "Write Back Data" },
    { id: "loadDataButton", text: "Reload Data" },
    { id: "addRowButton", text: "Create Container" },
    { id: "loadContainersButton", text: "Load Containers", onClick: onLoadContainers },
    { id: "saveContainersButton", text: "Save Containers" },
    { id: "importContainersButton", text: "Import Containers" },
    { id: "createFromContentButton", text: "Create from Content", onClick: onCreateFromContent },
    { id: "clearButton", text: "Clear" },
    { id: "refreshButton", text: "Refresh" },
    { id: "requestRekeyButton", text: "Request Rekey" },
    { id: "requestDedupButton", text: "Request Deduplication" },
    { id: "recopyValuesButton", text: "Recopy Values", onClick: handleRecopyValues },
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
  const [isCreateFromContentModalOpen, setIsCreateFromContentModalOpen] = useState(false);
  const [keepLayout, setKeepLayout] = useState(false);
  const [server, setServer] = useState("0");
  const [passcode, setLocalPasscode] = useState("");

  const handleCreateFromContent = (result) => {
    console.log('Containers created:', result);
    alert(`${result.message}\nCreated ${result.container_ids.length} containers`);

    const channel = new BroadcastChannel("containerUpdateChannel");
    channel.postMessage({ type: "CONTAINERS_CREATED", data: result });
    channel.close();
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 flex flex-col overflow-auto">
      {/* Header with Passcode */}
      <header className="px-6 pt-6 pb-4 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-gray-800">Concepter</h1>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">
              Passcode:
            </label>
            <input
              type="password"
              placeholder="Enter passcode"
              className="border border-gray-300 text-sm px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[150px]"
              value={passcode}
              onChange={(e) => {
                setLocalPasscode(e.target.value);
                setPasscode(e.target.value);
              }}
            />
          </div>
        </div>
      </header>

      {/* Main content wrapper */}
      <main className="flex-1 flex flex-col gap-4 px-6 py-4 overflow-auto">
        {/* Components that depend on state - keep separate */}
        <section id="grid">
          <AppGrid isLoadModalOpen={isLoadModalOpen} setIsLoadModalOpen={setIsLoadModalOpen} />
        </section>
        <section id="layers">
          <AppLayers />
        </section>
        <section id="sub">
          <AppFlow keepLayout={keepLayout} setKeepLayout={setKeepLayout} />
        </section>
        <MemoizedStaticContent />
      </main>

      {/* Floating panel */}
      <ButtonPanel
        keepLayout={keepLayout}
        setKeepLayout={setKeepLayout}
        server={server}
        setServer={setServer}
        onLoadContainers={() => setIsLoadModalOpen(true)}
        onCreateFromContent={() => setIsCreateFromContentModalOpen(true)}
      />

      {/* Modals */}
      <CreateFromContentModal
        isOpen={isCreateFromContentModalOpen}
        setIsOpen={setIsCreateFromContentModalOpen}
        onCreateContainers={handleCreateFromContent}
      />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);

reportWebVitals();

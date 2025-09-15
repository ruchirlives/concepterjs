# ConcepterJS

ConcepterJS is a React-based interactive project and container management system featuring rich graph visualization and flowcharting capabilities. It allows users to create, manage, and visualize hierarchical container data with contextual actions, Mermaid diagram export, Gantt charts, and DOCX export. It integrates seamlessly with a backend API for data storage, retrieval, and manipulation.

It is the front end for https://github.com/ruchirlives/concepter
---

## Features

* **Interactive Grid View**
  Editable AG Grid with filtering, sorting, drag-and-drop, and context menus for managing container data.

* **Graph Visualization with React Flow**
  Interactive flow diagrams visualizing containers as nodes and relationships as edges with dynamic node creation and editing.

* **Mermaid and Gantt Chart Export**
  Export container structures as Mermaid diagrams or Gantt charts with live rendering.

* **Hierarchical Container Management**
  Add, remove, and merge child containers dynamically through context menus and API integration.

* **Document Export**
  Export container data as DOCX files.

* **Real-time Inter-Component Communication**
  Uses Broadcast Channels for synchronization between components like node selection and filtering.

---

## Installation

### Prerequisites

* Node.js (version 16 or higher recommended)
* npm or yarn package manager
* Compatible backend API server

### Setup

```bash
git clone https://github.com/yourusername/concepterjs.git
cd concepterjs
npm install
npm start
```

### Configuration

* Set your backend API URL in `src/apiConfig.js` or through environment variables.

---

## Usage

* Use the **Grid View** to create, edit, and delete containers with details like ID, Name, Description, Tags, Dates.
* Right-click rows or nodes to access **Context Menus** with options for adding/removing children, merging, exporting diagrams, and more.
* Visualize container relationships using the **Flow Visualization** panel with drag-and-drop and edge editing.
* View live Mermaid diagrams in the **Mermaid Panel**.
* Control data loading, saving, import, and toggling options using the **Buttons Panel**.
* Use **Modals** to load or import saved container sets.

---

## Project Structure

* `AppGrid.js` — Data grid interface with AG Grid.
* `AppFlow.js` — Graph visualization and interaction using React Flow.
* `AppMermaid.js` — Mermaid diagram rendering component.
* `api.js` — Axios API client and endpoint functions.
* `effectsGrid.js` & `effectsReactFlow.js` — React hooks for event handling and side effects.
* `GridContextMenu.js` & `FlowContextMenu.js` — Context menus for grid and flow views.
* `LoadModal.js` — Modal component for loading and importing container sets.
* `columnDefs.js` — Definitions for AG Grid columns.
* `apiConfig.js` — Configuration for backend API URL.

---

## API Endpoints Utilized

* Fetch containers, parents, and children
* Add/remove children relationships
* Delete and merge containers
* Export diagrams and DOCX documents
* Save/load container sets
* Get and set edge positions
* Rekey requests

---

## Contributing

Contributions welcome! Please:

1. Fork the repo.
2. Create a feature branch: `git checkout -b feature/your-feature`.
3. Commit changes: `git commit -m "Add your feature"`.
4. Push branch: `git push origin feature/your-feature`.
5. Open a pull request.

---

## License

* Copyright (c) 2025 Ruchir Shah
* Licensed under the GNU GPLv3. See [LICENSE](./LICENSE) file for details.

---

## Contact

For questions or issues, please open an issue on GitHub or contact the maintainer.

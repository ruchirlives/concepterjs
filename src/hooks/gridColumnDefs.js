const columnDefs = [
    { field: "id", headerName: "ID", filter: "agTextColumnFilter", sortable: true, rowDrag: true, flex: 1 },
    { field: "Name", headerName: "Name", filter: "agTextColumnFilter", sortable: true, editable: true, flex: 3 },
    {
        field: "Tags",
        headerName: "Tags",
        filter: "agTextColumnFilter",
        sortable: true,
        editable: true,
        flex: 1,
    },
    {
        field: "Description",
        headerName: "Description",
        editable: true,
        filter: "agTextColumnFilter",
        flex: 3,
        cellStyle: {
            whiteSpace: "normal",
            lineHeight: "1.5",
            padding: "5px",
        },
    },
    { field: "StartDate", headerName: "Start Date", filter: "agTextColumnFilter", sortable: true, editable: true, flex: 1 },
    { field: "EndDate", headerName: "End Date", filter: "agTextColumnFilter", sortable: true, editable: true, flex: 1 },
    {
        field: "Horizon",
        headerName: "Horizon",
        filter: "agTextColumnFilter",
        sortable: true,
        editable: true,
        flex: 1,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["short", "medium", "long", "completed"] },
    },
    { field: "TimeRequired", headerName: "Time Required", cellDataType: "number", filter: "agNumberColumnFilter", sortable: true, editable: true, flex: 1 },
    // Impact and Effort
    { field: "Impact", headerName: "Impact", cellDataType: "number", filter: "agNumberColumnFilter", sortable: true, editable: true, flex: 1 },
    { field: "Effort", headerName: "Effort", cellDataType: "number", filter: "agNumberColumnFilter", sortable: true, editable: true, flex: 1 },
    // cost
    { field: "Cost", headerName: "Cost", cellDataType: "number", filter: "agNumberColumnFilter", sortable: true, editable: true, flex: 1 },
    // Budget
    { field: "Budget", headerName: "Budget", cellDataType: "number", filter: "agNumberColumnFilter", sortable: true, editable: true, flex: 1 },
];

export default columnDefs;

import { get_gantt, get_mermaid, writeBackData } from "./api";


export const handleWriteBack = async (rowData) => {
    try {
        const response = await writeBackData(rowData);
        if (response) {
            console.log("Data successfully written back to the server.");
        }
    } catch (error) {
        alert("Failed to write back data.");
    }
};

export function formatDateFields(data) {
    data.forEach((row) => {
        const startDate = new Date(row.StartDate);
        const endDate = new Date(row.EndDate);
        const namedDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const namedMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        row.StartDate = `${namedDays[startDate.getDay()]} ${startDate.getDate()} ${namedMonths[startDate.getMonth()]} ${startDate.getFullYear()}`;
        row.EndDate = `${namedDays[endDate.getDay()]} ${endDate.getDate()} ${namedMonths[endDate.getMonth()]} ${endDate.getFullYear()}`;
    });
}
export function sendMermaidCodeToChannel(response) {
    const channel = new BroadcastChannel('mermaidChannel');
    channel.postMessage({ mermaidCode: response });
    channel.close();
}
export async function sendGanttToChannel(id) {
    const response = await get_gantt(id);
    // Broadcast the mermaid code to the channel
    sendMermaidCodeToChannel(response);
    return response;
}

export async function sendMermaidToChannel(id) {
    const response = await get_mermaid(id);
    // Broadcast the mermaid code to the channel
    sendMermaidCodeToChannel(response);
    return response;
}

export async function writeBackUpdatedData(gridApi, prevID, type="mermaid") {
    let updatedRowData = [];
    gridApi.forEachNode(node => {
        updatedRowData.push(node.data);
    });

    // Write back the updated data to the server
    await handleWriteBack(updatedRowData);

    // Send mermaid code to the channel
    if (type === "mermaid") {
        await sendMermaidToChannel(prevID.current);
    } else if (type === "gantt") {
        // Send gantt code to the channel
        await sendGanttToChannel(prevID.current);
    }
}

export function requestReloadChannel() {
    const channel = new BroadcastChannel('requestReloadChannel');
    channel.postMessage({ reload: true });
    channel.close();
}
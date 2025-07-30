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
    const isoRegex = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
    data.forEach((row) => {
        const rawStart = row.StartDate;
        const rawEnd = row.EndDate;

        if (rawStart && isoRegex.test(rawStart)) {
            const [, year, month, day] = rawStart.match(isoRegex).map(Number);
            const date = new Date(year, month - 1, day);
            row.StartDate = date && !isNaN(date) ? date.toLocaleDateString() : '';
        } else if (rawStart) {
            console.warn('Invalid StartDate format:', rawStart);
            row.StartDate = '';
        }

        if (rawEnd && isoRegex.test(rawEnd)) {
            const [, year, month, day] = rawEnd.match(isoRegex).map(Number);
            const date = new Date(year, month - 1, day);
            row.EndDate = date && !isNaN(date) ? date.toLocaleDateString() : '';
        } else if (rawEnd) {
            console.warn('Invalid EndDate format:', rawEnd);
            row.EndDate = '';
        }
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

export function requestRefreshChannel() {
    const channel = new BroadcastChannel('requestRefreshChannel');
    channel.postMessage({ reload: true });
    channel.close();
}

const API_BASE_URL = 'http://localhost:5001/api';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SUBMISSION_DETECTED') {
        saveLeetCodeActivity(message.data);
    }
});

async function saveLeetCodeActivity(data) {
    try {
        const response = await fetch(`${API_BASE_URL}/leetcode`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Failed to save submission data');
        }

        // Notify popup if it's open
        chrome.runtime.sendMessage({
            type: 'SUBMISSION_SAVED',
            data: await response.json()
        });
    } catch (error) {
        console.error('Error saving submission:', error);
    }
}
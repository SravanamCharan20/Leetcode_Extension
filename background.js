const API_BASE_URL = 'http://localhost:5001/api';
let processingSubmission = false;
let lastSubmissionId = null;

// Handle extension installation/update
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed/updated');
    chrome.tabs.query({ url: 'https://leetcode.com/*' }, (tabs) => {
        tabs.forEach(tab => chrome.tabs.reload(tab.id));
    });
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SUBMISSION_SUCCESS' && !processingSubmission) {
        const submissionData = message.data;
        
        // Generate a unique ID for this submission
        const submissionId = `${submissionData.problemId}-${submissionData.timestamp}`;
        
        if (lastSubmissionId === submissionId || submissionData.timeSpent === 0) {
            console.log('Duplicate or invalid submission, skipping');
            sendResponse({ status: 'skipped' });
            return;
        }

        processingSubmission = true;
        lastSubmissionId = submissionId;

        // Send to database
        (async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/submissions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(submissionData)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                console.log('Successfully saved to database:', data);
                sendResponse({ status: 'success', data });
            } catch (error) {
                console.error('Error saving to database:', error);
                sendResponse({ status: 'error', error: error.message });
            } finally {
                setTimeout(() => {
                    processingSubmission = false;
                }, 5000);
            }
        })();

        // Return true to indicate we'll send the response asynchronously
        return true;
    }
});

// Handle service worker lifecycle
self.addEventListener('activate', event => {
    console.log('Service worker activated');
});

self.addEventListener('error', event => {
    console.error('Service worker error:', event.error);
});

// Handle unhandled promise rejections
self.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
});
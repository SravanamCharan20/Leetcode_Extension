console.log("LeetCode Tracker Loaded!");

let startTime = Date.now();
let problemTitle = '';
let problemUrl = '';
let visitStartTime = Date.now();

// Store visit time in chrome storage
function storeVisitTime(problemId) {
    chrome.storage.local.get(['problemVisits'], (result) => {
        const visits = result.problemVisits || {};
        if (!visits[problemId]) {
            visits[problemId] = [];
        }
        visits[problemId].push({
            startTime: visitStartTime,
            endTime: Date.now()
        });
        chrome.storage.local.set({ problemVisits: visits });
    });
}

// Get problem details when page loads
function getProblemDetails() {
    problemTitle = document.title.split(' - ')[0];
    problemUrl = window.location.href;
    const problemId = problemUrl.split('/problems/')[1].split('/')[0];
    
    // Reset visit start time
    visitStartTime = Date.now();
    
    // Check previous submissions
    chrome.storage.local.get(['submissions'], (result) => {
        const submissions = result.submissions || {};
        if (submissions[problemId]) {
            const lastSubmission = submissions[problemId][submissions[problemId].length - 1];
            showPreviousAttemptNotification(lastSubmission);
        }
    });

    return problemId;
}

function showPreviousAttemptNotification(lastSubmission) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f0f0f0;
        padding: 10px;
        border-radius: 5px;
        z-index: 1000;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;
    notification.innerHTML = `
        Previous attempt: ${formatTime(lastSubmission.timeSpent)}<br>
        Status: ${lastSubmission.submissionStatus}
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}

function formatTime(seconds) {
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} min ${remainingSeconds} sec`;
}

// Listen for submission events
function observeSubmissions() {
    const targetNode = document.body;
    const config = { childList: true, subtree: true };

    const callback = function(mutationsList, observer) {
        for(let mutation of mutationsList) {
            if(mutation.target.classList?.contains('success') || 
               mutation.target.classList?.contains('error')) {
                
                const timeSpent = Math.floor((Date.now() - startTime) / 1000);
                const submissionStatus = mutation.target.classList.contains('success') ? 'Accepted' : 'Failed';
                
                const languageSelector = document.querySelector('[data-cy="lang-select"]');
                const programmingLanguage = languageSelector ? languageSelector.textContent : 'Unknown';

                const problemId = problemUrl.split('/problems/')[1].split('/')[0];
                
                const submissionData = {
                    title: problemTitle,
                    url: problemUrl,
                    problemId: problemId,
                    submissionStatus: submissionStatus,
                    timeSpent: timeSpent,
                    programmingLanguage: programmingLanguage,
                    timestamp: new Date().toISOString()
                };

                // Store submission in chrome storage
                chrome.storage.local.get(['submissions'], (result) => {
                    const submissions = result.submissions || {};
                    if (!submissions[problemId]) {
                        submissions[problemId] = [];
                    }
                    submissions[problemId].push(submissionData);
                    chrome.storage.local.set({ submissions });
                });

                // Send data to background script
                chrome.runtime.sendMessage({
                    type: 'SUBMISSION_DETECTED',
                    data: submissionData
                });

                // Store visit time
                storeVisitTime(problemId);

                // Reset timer
                startTime = Date.now();
                visitStartTime = Date.now();
            }
        }
    };

    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config);
}

// Initialize
window.addEventListener('load', () => {
    const problemId = getProblemDetails();
    observeSubmissions();
});

// Track problem switches
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        // Store visit time for previous problem
        const oldProblemId = lastUrl.split('/problems/')[1]?.split('/')[0];
        if (oldProblemId) {
            storeVisitTime(oldProblemId);
        }

        lastUrl = url;
        startTime = Date.now();
        const newProblemId = getProblemDetails();
    }
}).observe(document, { subtree: true, childList: true });
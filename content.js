console.log("LeetCode Tracker Loaded!");
console.log('LeetCode Tracker: Content script loaded');

// Initialize storage
chrome.storage.local.get(null, (result) => {
    console.log('Storage initialized:', result);
});

// Global variables
let startTime = null;
let problemTitle = '';
let problemUrl = '';
let visitStartTime = Date.now();
let isProcessingSubmission = false;
let lastProblemId = null;
let lastSubmissionTimestamp = null;
const SUBMISSION_COOLDOWN = 10000; // 10 seconds cooldown between submissions

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
    const problemId = problemUrl.split('/problems/')[1]?.split('/')[0];
    
    if (problemId) {
        visitStartTime = Date.now();
        
        // Check previous submissions
        chrome.storage.local.get(['submissions'], (result) => {
            const submissions = result.submissions || {};
            if (submissions[problemId]) {
                const lastSubmission = submissions[problemId][submissions[problemId].length - 1];
                showPreviousAttemptNotification(lastSubmission);
            }
        });
    }
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
        Difficulty: ${lastSubmission.difficulty}
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

// Function to detect successful submissions
function observeSubmissions() {
    console.log('Starting submission observer...');
    
    const observer = new MutationObserver(debounce(async (mutations) => {
        if (isProcessingSubmission) return;

        // Check for success indicators in multiple ways
        const successIndicators = [
            // Main result container
            document.querySelector('div[data-e2e-locator="submission-result"]'),
            // Success icon or text
            document.querySelector('div[data-e2e-locator="submission-success"]'),
            // Alternative success message
            document.querySelector('div.text-success'),
            // Check for success text in any div
            ...Array.from(document.querySelectorAll('div')).filter(el => 
                el.textContent?.includes('Success') ||
                el.textContent?.includes('Accepted')
            )
        ];

        // Find the first valid success indicator
        const successElement = successIndicators.find(el => el !== null);
        
        if (!successElement || !startTime) return;

        const resultText = successElement.textContent || '';
        console.log('Detected submission result:', resultText);

        // Verify this is a real accepted submission
        if (!resultText.includes('Accepted') || resultText.includes('Last Accepted')) {
            return;
        }

        const currentTime = Date.now();
        if (lastSubmissionTimestamp && (currentTime - lastSubmissionTimestamp) < SUBMISSION_COOLDOWN) {
            console.log('Skipping recent submission');
            return;
        }

        isProcessingSubmission = true;
        lastSubmissionTimestamp = currentTime;
        console.log('Success! Processing submission...');

        // Wait for stats to be available
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Find runtime and memory information
        const allDivs = Array.from(document.querySelectorAll('div'));
        
        // Find runtime
        const runtimeDiv = allDivs.find(div => 
            div.textContent?.includes('Runtime') || 
            div.textContent?.includes('Time:')
        );
        const runtimeText = runtimeDiv?.textContent || 'N/A';

        // Find memory
        const memoryDiv = allDivs.find(div => 
            div.textContent?.includes('Memory')
        );
        const memoryText = memoryDiv?.textContent || 'N/A';

        // Extract numbers from runtime and memory text
        const runtime = runtimeText.match(/(\d+(\.\d+)?)\s*m?s/i)?.[0] || 'N/A';
        const memory = memoryText.match(/(\d+(\.\d+)?)\s*MB/i)?.[0] || 'N/A';

        console.log('Stats found:', { runtime, memory });

        const submissionData = collectSubmissionData(runtime, memory);
        if (submissionData) {
            console.log('Saving submission data:', submissionData);
            saveSubmission(submissionData);
        }

        // Reset after processing
        setTimeout(() => {
            isProcessingSubmission = false;
            initializeTimer(); // Reset timer for next attempt
        }, SUBMISSION_COOLDOWN);

    }, 500)); // Reduced debounce time for faster detection

    // Observe the entire document for changes
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true
    });

    // Also observe specific result containers
    const resultContainers = [
        document.querySelector('#result-state'),
        document.querySelector('.result-container'),
        document.querySelector('[role="alert"]')
    ].filter(el => el);

    resultContainers.forEach(container => {
        observer.observe(container, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true
        });
    });
}

// Debounce helper function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Update collectSubmissionData to be more robust
function collectSubmissionData(runtime = 'N/A', memory = 'N/A') {
    try {
        if (!startTime) {
            console.log('Timer not initialized');
            return null;
        }

        // Get problem details
        const titleElement = document.querySelector('[data-cy="question-title"]');
        const diffElement = document.querySelector('[diff]') || document.querySelector('.difficulty-label');
        const problemId = window.location.pathname.split('/problems/')[1]?.split('/')[0];

        const problemTitle = titleElement?.textContent?.trim() || document.title.split(' - ')[0];
        const difficulty = diffElement?.textContent?.trim() || 'Medium';
        const timeSpent = Math.floor((Date.now() - startTime) / 1000);

        console.log('Raw problem details:', {
            problemTitle,
            difficulty,
            problemId,
            timeSpent,
            runtime,
            memory
        });

        if (!problemTitle || !problemId || timeSpent === 0) {
            console.log('Invalid submission data');
            return null;
        }

        const submissionData = {
            title: problemTitle,
            difficulty: difficulty,
            problemId: problemId,
            timeSpent: timeSpent,
            runtime: runtime,
            memory: memory,
            timestamp: new Date().toISOString(),
            status: 'Accepted'
        };

        console.log('Prepared submission data:', submissionData);
        return submissionData;
    } catch (error) {
        console.error('Error collecting submission data:', error);
        return null;
    }
}

// Update saveSubmission to be more reliable
function saveSubmission(submissionData) {
    if (!submissionData || submissionData.timeSpent === 0) {
        console.log('Invalid submission data, skipping');
        return;
    }

    // Store in chrome storage
    chrome.storage.local.get(['submissions'], (result) => {
        try {
            const submissions = result.submissions || {};
            if (!submissions[submissionData.problemId]) {
                submissions[submissionData.problemId] = [];
            }
            submissions[submissionData.problemId].push(submissionData);
            chrome.storage.local.set({ submissions }, () => {
                console.log('Saved to chrome storage');
            });
        } catch (error) {
            console.error('Error saving to storage:', error);
        }
    });

    // Send to background script
    chrome.runtime.sendMessage({
        type: 'SUBMISSION_SUCCESS',
        data: submissionData
    }, response => {
        if (chrome.runtime.lastError) {
            console.error('Error sending to background:', chrome.runtime.lastError);
        } else {
            console.log('Sent to background script:', response);
        }
    });
}

// Initialize timer when loading a problem
function initializeTimer() {
    startTime = Date.now();
    console.log('Timer initialized at:', new Date(startTime).toISOString());
}

// Initialize tracking
function initializeTracker() {
    const problemId = window.location.pathname.split('/problems/')[1]?.split('/')[0];
    if (problemId && problemId !== lastProblemId) {
        lastProblemId = problemId;
        initializeTimer();
        observeSubmissions();
    }
}

// Start tracking
window.addEventListener('load', initializeTracker);

// Track problem switches
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        const oldProblemId = lastUrl.split('/problems/')[1]?.split('/')[0];
        if (oldProblemId) {
            storeVisitTime(oldProblemId);
        }
        lastUrl = url;
        initializeTracker();
    }
}).observe(document, { subtree: true, childList: true });

// Call initializeTimer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeTimer();
    console.log('Timer initialized on page load');
});
const API_BASE_URL = 'http://localhost:5001/api';

async function fetchSubmissions() {
    const statusFilter = document.getElementById('statusFilter').value;
    const languageFilter = document.getElementById('languageFilter').value;

    try {
        const queryParams = new URLSearchParams();
        if (statusFilter) queryParams.append('status', statusFilter);
        if (languageFilter) queryParams.append('language', languageFilter);

        const response = await fetch(`${API_BASE_URL}/leetcode?${queryParams}`);
        const data = await response.json();
        
        // Get local submissions data for comparison
        chrome.storage.local.get(['submissions'], (result) => {
            displaySubmissions(data, result.submissions || {});
        });
    } catch (error) {
        console.error('Error fetching submissions:', error);
    }
}

function displaySubmissions(submissions, localSubmissions) {
    const container = document.getElementById('submissions');
    container.innerHTML = '';

    submissions.forEach(sub => {
        const problemId = sub.url.split('/problems/')[1].split('/')[0];
        const previousSubmissions = localSubmissions[problemId] || [];
        const submissionHistory = previousSubmissions.sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp));
        
        const bestTime = Math.min(...submissionHistory.map(s => s.timeSpent));
        const averageTime = submissionHistory.reduce((acc, s) => acc + s.timeSpent, 0) / submissionHistory.length;

        const submissionDiv = document.createElement('div');
        submissionDiv.className = 'submission';
        submissionDiv.innerHTML = `
            <h3>${sub.title}</h3>
            <p>Status: <span class="${sub.submissionStatus ? sub.submissionStatus.toLowerCase() : 'unknown'}">
                ${sub.submissionStatus || 'Unknown'}</span></p>
            <p>Language: ${sub.programmingLanguage}</p>
            <p>Time Spent: ${formatTime(sub.timeSpent)}</p>
            <p>Best Time: ${formatTime(bestTime)}</p>
            <p>Average Time: ${formatTime(Math.round(averageTime))}</p>
            <p>Attempts: ${submissionHistory.length}</p>
            <p>Submitted: ${new Date(sub.timestamp).toLocaleString()}</p>
            <a href="${sub.url}" target="_blank">View Problem</a>
        `;
        container.appendChild(submissionDiv);
    });
}

function formatTime(seconds) {
    if (seconds < 60) return `${seconds} seconds`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} min ${remainingSeconds} sec`;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchSubmissions();
    
    // Add event listeners for filters
    document.getElementById('statusFilter').addEventListener('change', fetchSubmissions);
    document.getElementById('languageFilter').addEventListener('change', fetchSubmissions);
});

// Listen for new submissions
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SUBMISSION_SAVED') {
        fetchSubmissions();
    }
});
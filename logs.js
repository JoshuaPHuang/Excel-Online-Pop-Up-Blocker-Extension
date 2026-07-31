function renderLogs(logs) {
    const logOutput = document.getElementById('log-output');
    const logsArr = logs || [];
    // Newest first (storage keeps oldest→newest)
    logOutput.textContent = logsArr.length ? logsArr.slice().reverse().join("\n") : 'No logs currently in local storage.';
}

function loadLogs() {
    chrome.storage.local.get(["xlpbLogs"], function(result) {
        renderLogs(result.xlpbLogs);
    });
}

document.getElementById('clear-logs-button').addEventListener('click', function() {
    chrome.storage.local.set({ xlpbLogs: [] }, function() {
        renderLogs([]);
    });
});

loadLogs();

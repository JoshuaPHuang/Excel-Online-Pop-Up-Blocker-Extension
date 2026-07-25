chrome.storage.local.get(["xlpbLogs"], function(result) {
    const logOutput = document.getElementById('log-output');
    const logs = result.xlpbLogs || [];
    logOutput.textContent = logs.length ? logs.join("\n") : 'No logs available.';
});

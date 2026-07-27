// Create a queue class that you can queue.add(() => {...resolve();}) so that each task is resolved before starting the next in queue 
class PromiseQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
    }
    async add(task) {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.process();
        });
    }
    async process() {
        if (this.processing || this.queue.length === 0) {
            return;
        }
        this.processing = true;
        const { task, resolve, reject } = this.queue.shift();
        try {
            const result = await task();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.processing = false;
            this.process();
        }
    }
}


// Function to generate [mm/dd/YYYY HH:MM:SS] timestamp
function timestamp() {
    const now = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const month = pad(now.getMonth() + 1); // getMonth() zero-based
    const day = pad(now.getDate());
    const year = now.getFullYear();
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());
    return `[${month}/${day}/${year} ${hours}:${minutes}:${seconds}]`;
}


// Create a queue for notifications to make sure they are not sent too quickly
let notifQueue = new PromiseQueue();
const notifDelay = 1000; // 1 second

// Create a queue for log writes so concurrent frames do not overwrite each other in chrome.storage.local
let logsQueue = new PromiseQueue();
const MAX_LOG_LINES = 1000; // Keep only the newest 1000 log lines so storage writes stay fast

// Try to set default overall logs in chrome.storage.local if they do not exist yet
chrome.storage.local.get(["xlpbLogs"], function(result) {
    if (!result.xlpbLogs) {
        chrome.storage.local.set({ xlpbLogs: [] });
    }
});


// Listen for notification and log requests from content scripts
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.type === 'xlpbNotif') {
        notifQueue.add(() => new Promise((resolve) => {
            chrome.notifications.create(`notif_${Date.now()}`, { // Create and send the notification
                type: 'basic',
                iconUrl: 'custom_excel_suppressor.png',
                title: 'Excel Suppressor Notification',
                message: message.text
            });
            setTimeout(resolve, notifDelay); // Call resolve to finish this task after notifDelay is done
        }));
    } else if (message.type === 'xlpbLog') {
        const logStr = timestamp() + ' ' + message.subject + ': ' + message.info;
        logsQueue.add(() => new Promise((resolve) => {
            chrome.storage.local.get(["xlpbLogs"], (result) => {
                let logsArr = result.xlpbLogs || [];
                logsArr.push(logStr);
                if (logsArr.length > MAX_LOG_LINES) {
                    logsArr = logsArr.slice(-MAX_LOG_LINES); // Delete the oldest lines when over the soft cap
                }
                chrome.storage.local.set({ xlpbLogs: logsArr }, () => {
                    resolve(); // Finish up
                });
            });
        }));
    }
});


// Listen for the request to find all iframes with frame.url starting with "https://usc-excel.officeapps.live.com"
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "findIframes") {
        // Get all open tabs
        chrome.tabs.query({}, (tabs) => {
            let allFrames = [];
            let pendingPromises = tabs.map(tab => {
                return new Promise((resolve) => {
                    chrome.webNavigation.getAllFrames({ tabId: tab.id }, (frames) => {
                        if (chrome.runtime.lastError || !frames) {
                            return resolve([]);
                        }
                        // Filter iframes and add tab.id as frame.tabId to each frame
                        // console.log("Frames:");
                        // console.log(frames);
                        let officeIframes = frames
                        .filter(frame => frame.url.startsWith("https://usc-excel.officeapps.live.com"))
                        .map(frame => ({ ...frame, customTabId: tab.id })); // Add tabId to each frame
                        allFrames.push(...officeIframes);
                        resolve();
                    });
                });
            });
            Promise.all(pendingPromises).then(() => {
                sendResponse({ frames: allFrames });
            });
        });
        return true; // Holds open for asynchronous response
    }
});
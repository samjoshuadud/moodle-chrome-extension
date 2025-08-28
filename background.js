import { initDefaults, getSettings, mergeAssignments } from './storage.js';
import { syncAssignments, testConnection } from './todoist.js';

chrome.runtime.onInstalled.addListener(async () => {
  await initDefaults();
  const settings = await getSettings();
  chrome.alarms.create("scheduledScrape", { periodInMinutes: settings.scrapeIntervalMinutes });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "scheduledScrape") {
    await scrapeAndMaybeSync();
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "PROCESS_SCRAPED_DATA") {
    handleScrapedResults(msg.assignments)
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: String(e) }));
    return true; 
  }


  if (msg?.type === "SYNC_ONLY") {
    syncOnly()
      .then(result => sendResponse({ ok: true, result }))
      .catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
}

  if (msg?.type === "TEST_TODOIST_TOKEN") {
    testConnection(msg.token)
      .then(ok => sendResponse({ ok }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
});

/**
 * This function now ONLY saves the scraped data to storage. It does NOT sync.
 * This is called after the "Scrape" step.
 */
async function handleScrapedResults(assignments) {
  await mergeAssignments(assignments);
  console.log("Scraped data has been processed and saved.");
}

/**
 * It reads data from storage and syncs it with Todoist.
 * This is called only when you click the "Sync" button.
 */

async function syncOnly() {
  const { assignments = [] } = await chrome.storage.local.get("assignments");
  if (!assignments.length) {
    console.log("No assignments in storage to sync.");
    return;
  }
  
  const settings = await getSettings();
  if (settings?.TODOIST_TOKEN) {
    const result = await syncAssignments(assignments);
    await chrome.storage.local.set({
      lastSyncAt: Date.now(),
      lastSyncResult: result
    });
    console.log("Sync with Todoist completed.", result);

    // --- Send sync results to the content script for sidebar display ---
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: "SHOW_SYNC_RESULTS", result });
    }

    return result;
  } else {
    throw new Error("Todoist token not configured.");
  }
}

// Basic background orchestration and messaging
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
  // Handles the assignment data sent from the content script after a scrape
  if (msg?.type === "PROCESS_SCRAPED_DATA") {
    handleScrapedResults(msg.assignments)
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: String(e) }));
    return true; // Required for asynchronous response
  }

  // Handles the command to sync the stored data with Todoist
  if (msg?.type === "SYNC_ONLY") {
    syncOnly()
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: String(e) }));
    return true; // Required for asynchronous response
  }

  // Handles the settings page test for the API token
  if (msg?.type === "TEST_TODOIST_TOKEN") {
    testConnection(msg.token)
      .then(ok => sendResponse({ ok }))
      .catch(() => sendResponse({ ok: false }));
    return true; // Required for asynchronous response
  }
});




// NEW, CORRECTED FUNCTIONS

/**
 * This function now ONLY saves the scraped data to storage. It does NOT sync.
 * This is called after the "Scrape" step.
 */
async function handleScrapedResults(assignments) {
  await mergeAssignments(assignments);
  console.log("Scraped data has been processed and saved.");
}

/**
 * THIS IS THE MISSING FUNCTION.
 * It reads data from storage and syncs it with Todoist.
 * This is called only when you click the "Sync" button.
 */
// In background.js

async function syncOnly() {
  const { assignments = [] } = await chrome.storage.local.get("assignments");
  if (!assignments.length) {
    console.log("No assignments in storage to sync.");
    return; // Nothing to do
  }
  
  const settings = await getSettings();
  if (settings?.TODOIST_TOKEN) {
    const result = await syncAssignments(assignments);
    await chrome.storage.local.set({
      lastSyncAt: Date.now(),
      lastSyncResult: result
    });
    console.log("Sync with Todoist completed.");
  } else {
    // This will reject the promise and send the error back to content.js
    throw new Error("Todoist token not configured. Please set it in the extension options.");
  }
}

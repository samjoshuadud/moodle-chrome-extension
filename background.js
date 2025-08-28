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



async function scrapeAndMaybeSync({ skipScrape = false, skipSync = false } = {}) {
  let scraped = [];

  // Only scrape if not skipping
  if (!skipScrape) {
    let tabs = await chrome.tabs.query({ url: ["https://tbl.umak.edu.ph/*"] });
    if (!tabs.length) {
      const actives = await chrome.tabs.query({ active: true, currentWindow: true });
      if (actives && actives[0]) tabs = [actives[0]];
    }
    if (!tabs.length) return 0; // MODIFIED: Return 0 if no tab found

    const tabId = tabs[0].id;
    try {
      const msgRes = await chrome.tabs.sendMessage(tabId, { type: "SCRAPE_ASSIGNMENTS" });
      scraped = msgRes?.assignments || [];

      // Show results in sidebar
      await chrome.tabs.sendMessage(tabId, { 
        type: "SHOW_SIDEBAR_RESULTS", 
        assignments: scraped 
      });
    } catch (e) {
      console.error("Messaging to content script failed:", e);
      return 0; // MODIFIED: Return 0 on failure
    }
  }

  // Only sync if not skipping
  if (!skipSync) {
    const merged = await mergeAssignments(scraped);
    const settings = await getSettings();
    if (settings?.TODOIST_TOKEN) {
      const result = await syncAssignments(merged);
      await chrome.storage.local.set({
        lastSyncAt: Date.now(),
        lastSyncResult: result
      });
    }
  }

  // Always merge scraped assignments locally
  if (!skipScrape || skipSync) {
    await mergeAssignments(scraped);
  }
  
  // MODIFIED: Return the number of assignments found
  return scraped.length;
}

async function handleScrapedResults(assignments) {
  const merged = await mergeAssignments(assignments);

  const settings = await getSettings();
  if (settings?.TODOIST_TOKEN) {
    const result = await syncAssignments(merged);
    await chrome.storage.local.set({
      lastSyncAt: Date.now(),
      lastSyncResult: result
    });
  }
}

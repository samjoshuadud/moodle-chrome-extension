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
  if (msg?.type === "SCRAPE_ONLY") {
    scrapeAndMaybeSync({ skipSync: true })
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }

  if (msg?.type === "SYNC_ONLY") {
    scrapeAndMaybeSync({ skipScrape: true })
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }

  if (msg?.type === "SCRAPE_ASSIGNMENTS") {
    scrapeAndMaybeSync()
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }

  if (msg?.type === "SCRAPED_RESULTS") {
    handleScrapedResults(msg.assignments);
    sendResponse({ ok: true });
    return true;
  }

  if (msg?.type === "TEST_TODOIST_TOKEN") {
    testConnection(msg.token)
      .then(ok => sendResponse({ ok }))
      .catch(() => sendResponse({ ok: false }));
    return true;
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
    if (!tabs.length) return;

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
      return;
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

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
  if (msg?.type === "SCRAPE_AND_SYNC_NOW") {
    scrapeAndMaybeSync()
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === 'TEST_TODOIST_TOKEN') {
    testConnection(msg.token)
      .then(ok => sendResponse({ ok }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
});

async function scrapeAndMaybeSync() {
  let tabs = await chrome.tabs.query({ url: ["https://tbl.umak.edu.ph/*"] });
  if (!tabs.length) {
    const actives = await chrome.tabs.query({ active: true, currentWindow: true });
    if (actives && actives[0]) tabs = [actives[0]];
  }
  if (!tabs.length) return;

  const tabId = tabs[0].id;
  let scraped = [];
  try {
    const msgRes = await chrome.tabs.sendMessage(tabId, { type: "SCRAPE_ASSIGNMENTS" });
    scraped = msgRes?.assignments || [];
  } catch (e) {
    console.error("Messaging to content script failed:", e);
    return;
  }

  const merged = await mergeAssignments(scraped);

  const settings = await getSettings();
  if (settings?.TODOIST_TOKEN) {
    const result = await syncAssignments(merged);
    await chrome.storage.local.set({ lastSyncAt: Date.now(), lastSyncResult: result });
  }
}

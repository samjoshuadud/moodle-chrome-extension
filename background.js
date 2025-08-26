// Basic background orchestration and messaging
import { initDefaults, getSettings, mergeAssignments } from './storage.js';

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
    scrapeAndMaybeSync().then(() => sendResponse({ ok: true })).catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
});

async function scrapeAndMaybeSync() {
  const tabs = await chrome.tabs.query({ url: ["https://YOUR_MOODLE_DOMAIN/*"] });
  if (!tabs.length) return;

  const tabId = tabs[0].id;
  const result = await chrome.tabs.sendMessage(tabId, { type: "SCRAPE_ASSIGNMENTS" }).catch(() => ({ assignments: [] }));
  const scraped = result?.assignments || [];

  const merged = await mergeAssignments(scraped);

  const settings = await getSettings();
  if (settings?.TODOIST_TOKEN) {
    await chrome.storage.local.set({ lastSyncAt: Date.now() });
  }
}



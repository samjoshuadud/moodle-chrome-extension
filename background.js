// Basic background orchestration and messaging

const DEFAULT_SETTINGS = {
  TODOIST_TOKEN: "",
  projectName: "School Assignments",
  scrapeIntervalMinutes: 60
};

chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.local.get("settings");
  if (!settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  chrome.alarms.create("scheduledScrape", { periodInMinutes: DEFAULT_SETTINGS.scrapeIntervalMinutes });
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

  const { settings } = await chrome.storage.local.get("settings");
  if (settings?.TODOIST_TOKEN) {
    await chrome.storage.local.set({ lastSyncAt: Date.now() });
  }
}

async function mergeAssignments(newItems) {
  const { assignments = [] } = await chrome.storage.local.get("assignments");
  const byId = new Map((assignments || []).map(a => [a.task_id, a]));
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  for (const item of newItems) {
    if (!item?.task_id) continue;
    const existing = byId.get(item.task_id);
    if (existing) {
      byId.set(item.task_id, { ...existing, ...item, last_updated: now });
    } else {
      byId.set(item.task_id, { ...item, status: item.status || "Pending", last_updated: now });
    }
  }

  const merged = Array.from(byId.values());
  await chrome.storage.local.set({ assignments: merged, lastMergeAt: Date.now() });
  return merged;
}



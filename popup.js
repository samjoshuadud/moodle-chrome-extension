// popup.js
const statusEl = document.getElementById('status');
const metaEl = document.getElementById('meta');
const refreshBtn = document.getElementById('refreshBtn');
const tokenEl = document.getElementById('token');
const projectEl = document.getElementById('project');
const intervalEl = document.getElementById('interval');
const useExactDateEl = document.getElementById('useExactDate'); // Add this
const saveBtn = document.getElementById('saveBtn');
const testBtn = document.getElementById('testBtn');
function setStatus(s) { statusEl.textContent = s; }

function fmt(ts) { return ts ? new Date(ts).toLocaleString() : '—'; }

async function refreshMeta() {
  const { assignments = [] } = await chrome.storage.local.get('assignments');
  const { lastSyncAt, lastMergeAt, lastSyncResult } = await chrome.storage.local.get(['lastSyncAt', 'lastMergeAt', 'lastSyncResult']);
  const parts = [];
  parts.push(`Assignments: ${assignments.length}`);
  parts.push(`Merged: ${fmt(lastMergeAt)}`);
  parts.push(`Synced: ${fmt(lastSyncAt)}`);
  if (lastSyncResult) {
    const r = lastSyncResult;
    // Updated to handle new result format from todoist.js
    const addedCount = r.added ? r.added.length : 0;
    const updatedCount = r.updated ? r.updated.length : 0;
    parts.push(`(+${addedCount} / ~${updatedCount})`);
  }
  metaEl.textContent = parts.join(' | ');
}

// Refresh button
refreshBtn.addEventListener('click', refreshMeta);

// Load settings
async function loadSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  const s = settings || {};
  tokenEl.value = s.TODOIST_TOKEN || '';
  projectEl.value = s.projectName || 'School Assignments';
  intervalEl.value = s.scrapeIntervalMinutes || 60;
  useExactDateEl.checked = s.useExactDate || false; 
}
saveBtn.addEventListener('click', async () => {
  const settings = {
    TODOIST_TOKEN: tokenEl.value.trim(),
    projectName: projectEl.value.trim() || 'School Assignments',
    scrapeIntervalMinutes: Math.max(5, Math.min(1440, parseInt(intervalEl.value || '60', 10))),
    useExactDate: useExactDateEl.checked, // This line saves the checkbox state
  };

  await chrome.storage.local.set({ settings });
  setStatus('Settings saved');

  chrome.alarms.clear('scheduledScrape', () => {
    chrome.alarms.create('scheduledScrape', { periodInMinutes: settings.scrapeIntervalMinutes });
  });
});

testBtn.addEventListener('click', async () => {
  const token = tokenEl.value.trim();
  if (!token) { setStatus('Enter token first'); return; }
  setStatus('Testing...');
  const res = await chrome.runtime.sendMessage({ type: 'TEST_TODOIST_TOKEN', token }).catch(() => ({ ok: false }));
  setStatus(res?.ok ? 'Token OK' : 'Token failed');
});

const clearCacheBtn = document.getElementById('clearCacheBtn');

clearCacheBtn.addEventListener('click', async () => {
  await chrome.storage.local.remove([
    'assignments',
    'assignments_archive',
    'lastMergeAt',
    'lastSyncAt',
    'lastSyncResult'
  ]);

  try {
    const tabs = await chrome.tabs.query({ url: "*://tbl.umak.edu.ph/*" });
    if (tabs.length > 0) {
      await chrome.tabs.sendMessage(tabs[0].id, { type: 'RESET_STATE' });
    }
  } catch (e) {
    console.warn("Could not send reset message to Moodle page. It might not be open.", e);
  }
  
  setStatus('Cache and state cleared');
  await refreshMeta(); // Refresh the display to show empty values
});

loadSettings();
refreshMeta();

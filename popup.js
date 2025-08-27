
const statusEl = document.getElementById('status');
const metaEl = document.getElementById('meta');
const refreshBtn = document.getElementById('refreshBtn');
const tokenEl = document.getElementById('token');
const projectEl = document.getElementById('project');
const intervalEl = document.getElementById('interval');
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
    parts.push(`(+${r.new_created || 0} / ~${r.existing_updated || 0})`);
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
}

// Save settings
saveBtn.addEventListener('click', async () => {
  const settings = {
    TODOIST_TOKEN: tokenEl.value.trim(),
    projectName: projectEl.value.trim() || 'School Assignments',
    scrapeIntervalMinutes: Math.max(5, Math.min(1440, parseInt(intervalEl.value || '60', 10)))
  };
  await chrome.storage.local.set({ settings });
  setStatus('Settings saved');

  // Update alarm
  chrome.alarms.clear('scheduledScrape', () => {
    chrome.alarms.create('scheduledScrape', { periodInMinutes: settings.scrapeIntervalMinutes });
  });
});

// Test token
testBtn.addEventListener('click', async () => {
  const token = tokenEl.value.trim();
  if (!token) { setStatus('Enter token first'); return; }
  setStatus('Testing...');
  const res = await chrome.runtime.sendMessage({ type: 'TEST_TODOIST_TOKEN', token }).catch(() => ({ ok: false }));
  setStatus(res?.ok ? 'Token OK' : 'Token failed');
});

loadSettings();
refreshMeta();

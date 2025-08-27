const scrapeSyncBtn = document.getElementById('scrapeSyncBtn');

scrapeSyncBtn?.addEventListener('click', async () => {
  // Find the active tab (assume Moodle is open)
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs && tabs[0] && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'SHOW_SIDEBAR' });
    }
  });
});
const saveBtn = document.getElementById('saveBtn');
const testBtn = document.getElementById('testBtn');
const tokenEl = document.getElementById('token');
const projectEl = document.getElementById('project');
const intervalEl = document.getElementById('interval');
const statusEl = document.getElementById('status');

async function load() {
  const { settings } = await chrome.storage.local.get('settings');
  const s = settings || {};
  tokenEl.value = s.TODOIST_TOKEN || '';
  projectEl.value = s.projectName || 'School Assignments';
  intervalEl.value = s.scrapeIntervalMinutes || 60;
}

saveBtn.addEventListener('click', async () => {
  const settings = {
    TODOIST_TOKEN: tokenEl.value.trim(),
    projectName: projectEl.value.trim() || 'School Assignments',
    scrapeIntervalMinutes: Math.max(5, Math.min(1440, parseInt(intervalEl.value || '60', 10)))
  };
  await chrome.storage.local.set({ settings });
  statusEl.textContent = 'Saved';
  chrome.alarms.clear('scheduledScrape', () => {
    chrome.alarms.create('scheduledScrape', { periodInMinutes: settings.scrapeIntervalMinutes });
  });
});

testBtn.addEventListener('click', async () => {
  const token = (document.getElementById('token').value || '').trim();
  if (!token) { statusEl.textContent = 'Enter token first'; return; }
  statusEl.textContent = 'Testing...';
  const res = await chrome.runtime.sendMessage({ type: 'TEST_TODOIST_TOKEN', token }).catch(() => ({ ok: false }));
  statusEl.textContent = res?.ok ? 'Token OK' : 'Token failed';
});

load();



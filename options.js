const saveBtn = document.getElementById('saveBtn');
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

load();



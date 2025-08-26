import { testConnection, getProjectIdIfExists } from './todoist.js';
import { getSettings } from './storage.js';

const out = document.getElementById('out');
document.getElementById('testToken').addEventListener('click', async () => {
  log('\n== Test Token ==');
  const s = await getSettings();
  if (!s.TODOIST_TOKEN) return log('No token set in Options');
  const ok = await testConnection(s.TODOIST_TOKEN);
  log(`Token: ${ok ? 'OK' : 'FAILED'}`);
});

document.getElementById('testScrape').addEventListener('click', async () => {
  log('\n== Test Scraping ==');
  let tabs = await chrome.tabs.query({ url: ["https://tbl.umak.edu.ph/*"] });

  if (!tabs.length) {
    const actives = await chrome.tabs.query({ active: true, currentWindow: true });
    if (actives && actives[0]) tabs = [actives[0]];
  }

  if (!tabs.length) {
    return log('No matching or active tab found. Open a Moodle page and make it active.');
  }

  const tabId = tabs[0].id;

  try {
    // Directly send message to the content script
    const res = await chrome.tabs.sendMessage(tabId, { type: 'SCRAPE_ASSIGNMENTS' });

    const count = (res?.assignments || []).length;
    const count_completed = (res?.assignments || []).filter(a => a.status === 'Completed').length;
    log(`Scrape successful. Found ${count} assignments (${count_completed} completed).`);
    log(`Scraped assignments: ${count}`);

    if (count > 0) log(JSON.stringify(res.assignments, null, 2));
  } catch (e) {
    log(`Scrape failed: ${e}`);
  }
});


document.getElementById('testTodoist').addEventListener('click', async () => {
  log('\n== Test Todoist Integration ==');
  const s = await getSettings();
  if (!s.TODOIST_TOKEN) return log('No token set in Options');
  const pid = await getProjectIdIfExists(s.projectName || 'School Assignments', s.TODOIST_TOKEN);
  log(`Project exists: ${pid ? 'YES' : 'NO'}`);
  const { lastSyncResult } = await chrome.storage.local.get('lastSyncResult');
  if (lastSyncResult) log(`Last sync: ${JSON.stringify(lastSyncResult)}`); else log('No sync run yet. Use popup Scrape & Sync.');
});

function log(msg) {
  out.textContent += `${msg}\n`;
}



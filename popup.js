document.getElementById('scrapeSyncBtn').addEventListener('click', async () => {
  setStatus('Running scrape & sync...');
  const res = await chrome.runtime.sendMessage({ type: 'SCRAPE_AND_SYNC_NOW' }).catch(() => ({ ok: false }));
  setStatus(res?.ok ? 'Done' : 'Failed');
  await refreshMeta();
});

async function refreshMeta() {
  const { assignments = [] } = await chrome.storage.local.get('assignments');
  const { lastSyncAt, lastMergeAt } = await chrome.storage.local.get(['lastSyncAt', 'lastMergeAt']);
  const txt = `Assignments: ${assignments.length} | Merged: ${fmt(lastMergeAt)} | Synced: ${fmt(lastSyncAt)}`;
  document.getElementById('meta').textContent = txt;
}

function setStatus(s) {
  document.getElementById('status').textContent = s;
}

function fmt(ts) {
  return ts ? new Date(ts).toLocaleString() : '—';
}

refreshMeta();



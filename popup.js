document.getElementById('scrapeSyncBtn').addEventListener('click', async () => {
  setStatus('Running scrape & sync...');
  const res = await chrome.runtime.sendMessage({ type: 'SCRAPE_AND_SYNC_NOW' }).catch(() => ({ ok: false }));
  setStatus(res?.ok ? 'Done' : 'Failed');
  await refreshMeta();
});

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
  const txt = parts.join(' | ');
  document.getElementById('meta').textContent = txt;
}

function setStatus(s) {
  document.getElementById('status').textContent = s;
}

function fmt(ts) {
  return ts ? new Date(ts).toLocaleString() : '—';
}

refreshMeta();



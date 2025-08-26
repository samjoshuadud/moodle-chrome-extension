// Simple ring-buffer logger stored in chrome.storage.local

export async function log(level, message, extra) {
  try {
    const key = 'logs';
    const data = await chrome.storage.local.get(key);
    const logs = Array.isArray(data[key]) ? data[key] : [];
    logs.push({ ts: Date.now(), level, message: String(message), extra: sanitize(extra) });
    while (logs.length > 200) logs.shift();
    await chrome.storage.local.set({ [key]: logs });
  } catch (e) {
    // swallow
  }
}

function sanitize(v) {
  try { return v && JSON.parse(JSON.stringify(v)); } catch { return undefined; }
}



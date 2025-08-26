// Storage schema and helpers for assignments and archive

export const STORAGE_KEYS = {
  settings: 'settings',
  assignments: 'assignments',
  archive: 'assignments_archive',
  lastMergeAt: 'lastMergeAt',
  lastSyncAt: 'lastSyncAt'
};

export const DEFAULT_SETTINGS = {
  TODOIST_TOKEN: '',
  projectName: 'School Assignments',
  scrapeIntervalMinutes: 60
};

export const EMPTY_ARCHIVE = () => ({
  created_date: new Date().toISOString(),
  last_cleanup: null,
  total_archived: 0,
  assignments: []
});

export async function initDefaults() {
  const { settings } = await chrome.storage.local.get(STORAGE_KEYS.settings);
  if (!settings) {
    await chrome.storage.local.set({ [STORAGE_KEYS.settings]: DEFAULT_SETTINGS });
  }
  const curr = await chrome.storage.local.get([STORAGE_KEYS.assignments, STORAGE_KEYS.archive]);
  if (!curr[STORAGE_KEYS.assignments]) {
    await chrome.storage.local.set({ [STORAGE_KEYS.assignments]: [] });
  }
  if (!curr[STORAGE_KEYS.archive]) {
    await chrome.storage.local.set({ [STORAGE_KEYS.archive]: EMPTY_ARCHIVE() });
  }
}

export async function getSettings() {
  const { [STORAGE_KEYS.settings]: settings } = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return settings || DEFAULT_SETTINGS;
}

export async function setSettings(settings) {
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
}

export async function getAssignments() {
  const { [STORAGE_KEYS.assignments]: assignments } = await chrome.storage.local.get(STORAGE_KEYS.assignments);
  return assignments || [];
}

export async function setAssignments(assignments) {
  await chrome.storage.local.set({ [STORAGE_KEYS.assignments]: assignments });
}

export async function getArchive() {
  const { [STORAGE_KEYS.archive]: archive } = await chrome.storage.local.get(STORAGE_KEYS.archive);
  return archive || EMPTY_ARCHIVE();
}

export async function setArchive(archive) {
  await chrome.storage.local.set({ [STORAGE_KEYS.archive]: archive });
}

// Merge rules: keyed by task_id; update fields; set last_updated; default status
export async function mergeAssignments(newItems) {
  const assignments = await getAssignments();
  const byId = new Map(assignments.map(a => [a.task_id, a]));
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  for (const item of newItems || []) {
    if (!item || !item.task_id) continue;
    const existing = byId.get(item.task_id);
    if (existing) {
      byId.set(item.task_id, { ...existing, ...item, last_updated: now });
    } else {
      byId.set(item.task_id, {
        title: item.title || 'Unknown Assignment',
        raw_title: item.raw_title || item.title || '',
        course: item.course || '',
        course_code: item.course_code || '',
        due_date: item.due_date || '',
        status: item.status || 'Pending',
        task_id: item.task_id,
        activity_type: item.activity_type || 'Assignment',
        source: item.source || 'Moodle',
        last_updated: now
      });
    }
  }

  const merged = Array.from(byId.values());
  await setAssignments(merged);
  await chrome.storage.local.set({ [STORAGE_KEYS.lastMergeAt]: Date.now() });
  return merged;
}



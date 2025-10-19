// Storage schema and helpers for assignments and archive

export const STORAGE_KEYS = {
  settings: 'settings',
  assignments: 'assignments',
  archive: 'assignments_archive',
  lastMergeAt: 'lastMergeAt',
  lastSyncAt: 'lastSyncAt',
  syncedTasks: 'syncedTasks' // Track which tasks have been synced to Todoist
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

// Archive helpers mirroring Python logic
export async function archiveCompletedAssignments(daysAfter = 30) {
  const assignments = await getAssignments();
  const archive = await getArchive();
  const now = new Date();
  const cutoff = new Date(now.getTime() - daysAfter * 86400000);
  const active = [];
  const newlyArchived = [];

  for (const a of assignments) {
    if (a.status === 'Completed') {
      const last = a.last_updated || a.added_date || '';
      let lastDate = null;
      if (last) {
        // try ISO or '%Y-%m-%d %H:%M:%S'
        const t = last.includes('T') ? new Date(last) : new Date(last.replace(' ', 'T'));
        if (!isNaN(t.getTime())) lastDate = t;
      }
      if (lastDate && lastDate < cutoff) {
        archive.assignments.push({
          original_data: a,
          archived_date: now.toISOString(),
          archive_reason: `completed_${daysAfter}_days`,
          completion_date: last,
          title: a.title || 'Unknown',
          course_code: a.course_code || 'Unknown'
        });
        newlyArchived.push(a.title || 'Unknown');
        continue;
      }
    }
    active.push(a);
  }

  archive.total_archived = archive.assignments.length;
  archive.last_cleanup = now.toISOString();
  await setAssignments(active);
  await setArchive(archive);
  return {
    active_count: active.length,
    newly_archived_count: newlyArchived.length,
    newly_archived: newlyArchived,
    total_archived: archive.total_archived
  };
}

export async function restoreAssignmentFromArchive(title) {
  const assignments = await getAssignments();
  const archive = await getArchive();
  const remaining = [];
  let restored = null;
  for (const item of archive.assignments) {
    if (!restored && item.title === title) {
      restored = { ...item.original_data, status: 'Pending', last_updated: tsNow() };
    } else {
      remaining.push(item);
    }
  }
  if (restored) {
    assignments.push(restored);
    archive.assignments = remaining;
    archive.total_archived = remaining.length;
    await setAssignments(assignments);
    await setArchive(archive);
    return true;
  }
  return false;
}

export async function manualArchiveAssignment(title, reason = 'manual_request') {
  const assignments = await getAssignments();
  const archive = await getArchive();
  const remaining = [];
  let archived = null;
  for (const a of assignments) {
    if (!archived && a.title === title) archived = a; else remaining.push(a);
  }
  if (archived) {
    archive.assignments.push({
      original_data: archived,
      archived_date: new Date().toISOString(),
      archive_reason: reason,
      completion_date: archived.last_updated || '',
      title: archived.title || 'Unknown',
      course_code: archived.course_code || 'Unknown'
    });
    archive.total_archived = archive.assignments.length;
    await setAssignments(remaining);
    await setArchive(archive);
    return true;
  }
  return false;
}

export async function getArchiveStats() {
  const assignments = await getAssignments();
  const archive = await getArchive();
  const statusCounts = assignments.reduce((acc, a) => {
    const s = a.status || 'Unknown';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  const reasonCounts = archive.assignments.reduce((acc, it) => {
    const r = it.archive_reason || 'Unknown';
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});
  return {
    active_assignments: assignments.length,
    active_by_status: statusCounts,
    total_archived: archive.total_archived || 0,
    archived_by_reason: reasonCounts,
    last_cleanup: archive.last_cleanup || null
  };
}

function tsNow() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

// Track which tasks have been synced to Todoist
export async function getSyncedTasks() {
  const { [STORAGE_KEYS.syncedTasks]: syncedTasks } = await chrome.storage.local.get(STORAGE_KEYS.syncedTasks);
  return syncedTasks || {};
}

export async function markTaskAsSynced(taskId, todoistTaskId) {
  const syncedTasks = await getSyncedTasks();
  syncedTasks[taskId] = {
    todoistTaskId,
    syncedAt: Date.now(),
    lastSyncedAt: Date.now()
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.syncedTasks]: syncedTasks });
}

export async function isTaskSynced(taskId) {
  const syncedTasks = await getSyncedTasks();
  return !!syncedTasks[taskId];
}

export async function unmarkTaskAsSynced(taskId) {
  const syncedTasks = await getSyncedTasks();
  delete syncedTasks[taskId];
  await chrome.storage.local.set({ [STORAGE_KEYS.syncedTasks]: syncedTasks });
}


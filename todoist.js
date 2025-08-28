// --- Logging helper ---
function log(...args) {
  console.log('[Todoist]', ...args);
}

// Todoist REST v2 client and sync helpers

import { getSettings } from './storage.js';

const TODOIST_BASE = 'https://api.todoist.com/rest/v2';

function headers(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

export async function testConnection(token) {
  try {
    const res = await fetch(`${TODOIST_BASE}/projects`, { headers: headers(token) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getOrCreateProject(projectName, token) {
  const h = headers(token);
  const list = await fetch(`${TODOIST_BASE}/projects`, { headers: h });
  if (list.ok) {
    const projects = await list.json();
    const found = projects.find(p => p.name === projectName);
    if (found) return found.id;
  }
  const create = await fetch(`${TODOIST_BASE}/projects`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ name: projectName, color: 'blue' })
  });
  if (!create.ok) return null;
  const proj = await create.json();
  return proj.id;
}

// Get all tasks for a project (optionally include completed)
export async function getAllAssignmentsFromTodoist(projectName, token) {
  try {
    const projectId = await getProjectIdIfExists(projectName, token);
    if (!projectId) return [];
    const res = await fetch(`${TODOIST_BASE}/tasks?project_id=${encodeURIComponent(projectId)}`, { headers: headers(token) });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    log('Error fetching assignments from Todoist:', e);
    return [];
  }
}

// Get project stats (number of tasks, etc.)
export async function getProjectStats(projectName, token) {
  try {
    const projectId = await getProjectIdIfExists(projectName, token);
    if (!projectId) return { total: 0, completed: 0 };
    const res = await fetch(`${TODOIST_BASE}/tasks?project_id=${encodeURIComponent(projectId)}`, { headers: headers(token) });
    if (!res.ok) return { total: 0, completed: 0 };
    const tasks = await res.json();
    // Todoist REST API does not return completed tasks by default
    return { total: tasks.length, completed: 0 };
  } catch (e) {
    log('Error getting project stats:', e);
    return { total: 0, completed: 0 };
  }
}

// Update task completion status (close task)
export async function updateTaskStatus(taskId, completed, token) {
  try {
    if (completed) {
      // Close the task
      const res = await fetch(`${TODOIST_BASE}/tasks/${taskId}/close`, { method: 'POST', headers: headers(token) });
      return res.status === 204;
    } else {
      // Reopen the task
      const res = await fetch(`${TODOIST_BASE}/tasks/${taskId}/reopen`, { method: 'POST', headers: headers(token) });
      return res.status === 204;
    }
  } catch (e) {
    log('Error updating task status:', e);
    return false;
  }
}

// Delete a task by assignment (using task_id in description)
export async function deleteAssignmentTask(assignment, projectName, token) {
  try {
    const projectId = await getProjectIdIfExists(projectName, token);
    if (!projectId) return false;
    const tasks = await getAllAssignmentsFromTodoist(projectName, token);
    const taskId = (tasks.find(t => extractTaskIdFromDescription(t.description) === assignment.task_id) || {}).id;
    if (!taskId) return false;
    return await deleteTask(taskId, token);
  } catch (e) {
    log('Error deleting assignment task:', e);
    return false;
  }
}

// Sync completion status from Todoist back to local assignments
export async function syncStatusFromTodoist(localAssignments, projectName, token) {
  try {
    if (!Array.isArray(localAssignments)) return {};
    const tasks = await getAllAssignmentsFromTodoist(projectName, token);
    const statusMap = {};
    for (const a of localAssignments) {
      const tid = a.task_id;
      const t = tasks.find(t => extractTaskIdFromDescription(t.description) === tid);
      if (t) {
        // Todoist REST API does not return completed tasks by default
        statusMap[tid] = 'Pending';
      } else {
        // If not found, could be completed or deleted
        statusMap[tid] = 'Completed';
      }
    }
    return statusMap;
  } catch (e) {
    log('Error syncing status from Todoist:', e);
    return {};
  }
}

export async function getProjectIdIfExists(projectName, token) {
  const h = headers(token);
  const list = await fetch(`${TODOIST_BASE}/projects`, { headers: h });
  if (!list.ok) return null;
  const projects = await list.json();
  const found = projects.find(p => p.name === projectName);
  return found ? found.id : null;
}

export function calculateReminderDate(assignment) {
  const dueStr = assignment?.due_date || '';
  const openStr = assignment?.opening_date || '';
  if (!dueStr) return null;
  try {
    const due = new Date(`${dueStr}T00:00:00Z`);
    const today = new Date();
    today.setHours(0,0,0,0);

    let reference = due;
    let useOpening = false;
    if (openStr && openStr !== 'No opening date') {
      const opening = new Date(`${openStr}T00:00:00Z`);
      if (!isNaN(opening.getTime()) && opening > reference) {
        reference = opening;
        useOpening = true;
      }
    }

    const daysUntil = Math.ceil((reference - today) / 86400000);
    let before = 0;
    if (daysUntil <= 0) before = 0;
    else if (useOpening) {
      if (daysUntil <= 1) before = 0;
      else if (daysUntil <= 3) before = 1;
      else if (daysUntil <= 7) before = 2;
      else if (daysUntil <= 14) before = 3;
      else before = 7;
    } else {
      if (daysUntil <= 3) before = Math.max(1, daysUntil - 1);
      else if (daysUntil <= 7) before = 3;
      else if (daysUntil <= 14) before = 5;
      else if (daysUntil <= 30) before = 7;
      else before = 14;
    }

    const reminder = new Date(reference);
    reminder.setDate(reminder.getDate() - before);
    if (reminder < today) reminder.setTime(today.getTime());
    return reminder.toISOString().slice(0,10);
  } catch {
    return null;
  }
}

export function formatTaskContent(assignment) {
  const title = (assignment?.title || 'Unknown Assignment');
  const courseCode = (assignment?.course_code || '');
  const rawTitle = assignment?.raw_title || '';

  let activityMatch = '';
  let activityName = '';
  // Pattern 1: ACTIVITY # - NAME [#]
  const p1 = rawTitle.match(/ACTIVITY\s+(\d+)\s*-\s*([^[]+)/i);
  if (p1) {
    activityMatch = `Activity ${p1[1]}`;
    activityName = (p1[2] || '').trim();
  } else {
    const p2 = rawTitle.match(/ACTIVITY\s+(\d+)/i);
    if (p2) {
      activityMatch = `Activity ${p2[1]}`;
      const remaining = rawTitle.replace(/ACTIVITY\s+\d+\s*-?\s*/i, '');
      activityName = remaining.replace(/\[\d+\]/g, '').trim();
    }
  }
  if (!activityMatch) {
    const tp = title.match(/Activity\s+(\d+)\s*\(([^)]+)\)/i);
    if (tp) {
      activityMatch = `Activity ${tp[1]}`;
      activityName = (tp[2] || '').trim();
    }
  }

  let formatted;
  if (courseCode && activityMatch) {
    if (activityName) {
      activityName = activityName.replace(/\s*\[\d+\]/g, '').trim();
      formatted = `${courseCode} - ${activityMatch} (${activityName})`;
    } else {
      formatted = `${courseCode} - ${activityMatch}`;
    }
  } else if (courseCode) {
    formatted = `${courseCode} - ${title}`;
  } else {
    formatted = title;
  }
  return formatted;
}

// In todoist.js

export function formatTaskDescription(assignment) {
  const parts = [];
  const due = assignment?.due_date || '';

  // MODIFIED: We no longer convert the date, just display it as is.
  if (due && due !== 'No due date') {
    parts.push(`📅 Deadline: ${due}`);
  }
  
  const course = assignment?.course || '';
  if (course) parts.push(`📚 Course: ${String(course).replace(/\r?\n/g, ' ').trim()}`);
  const source = assignment?.source || '';
  if (source) parts.push(`📧 Source: ${source}`);
  const taskId = assignment?.task_id || '';
  if (taskId) parts.push(`🔗 Task ID: ${taskId}`);
  if (assignment?.course_code) parts.push(`📚 Course: ${assignment.course_code}`);
  if (assignment?.activity_type) parts.push(`🔧 Type: ${assignment.activity_type}`);
  return parts.join('\n');
}

async function getTasks(projectId, token) {
  const res = await fetch(`${TODOIST_BASE}/tasks?project_id=${encodeURIComponent(projectId)}`, { headers: headers(token) });
  if (!res.ok) return [];
  return res.json();
}

function extractTaskIdFromDescription(description) {
  if (!description) return null;
  const m = description.match(/🔗\s*Task ID:\s*(\w+)/i) || description.match(/task id:\s*(\w+)/i);
  return m ? m[1] : null;
}

export async function preventDuplicateSync(assignments, projectId, token) {
  const tasks = await getTasks(projectId, token);
  const existing = new Map();
  for (const t of tasks) {
    const tid = extractTaskIdFromDescription(t.description || '');
    if (tid) existing.set(tid, t.id);
  }
  const groups = { new: [], existing: [] };
  for (const a of assignments) {
    const tid = a.task_id || '';
    if (tid && existing.has(tid)) {
      groups.existing.push({ ...a, _todoist_task_id: existing.get(tid) });
    } else {
      groups.new.push(a);
    }
  }
  return groups;
}

export async function hasMeaningfulChanges(assignment, taskId, token) {
  const res = await fetch(`${TODOIST_BASE}/tasks/${taskId}`, { headers: headers(token) });
  if (!res.ok) return true;
  const task = await res.json();
  const localTitle = formatTaskContent(assignment).toLowerCase().trim();
  const todoistTitle = (task.content || '').toLowerCase().trim();
  if (localTitle !== todoistTitle) return true;

  const expectedReminderDate = calculateReminderDate(assignment) || assignment?.due_date;
  const currentDue = task?.due?.date || null;
  if (expectedReminderDate && expectedReminderDate !== currentDue) return true;
  return false;
}

export async function createTask(assignment, projectId, token) {
  const body = {
    content: formatTaskContent(assignment),
    description: formatTaskDescription(assignment),
    project_id: projectId,
    priority: 2
  };
  const due = assignment?.due_date;
  if (due) {
    const reminder = calculateReminderDate(assignment);
    body.due_date = reminder || due;
  }
  const res = await fetch(`${TODOIST_BASE}/tasks`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body)
  });
  return res.ok;
}

export async function updateTask(assignment, taskId, token) {
  const body = {
    content: formatTaskContent(assignment),
    description: formatTaskDescription(assignment),
    priority: 2
  };
  const due = assignment?.due_date;
  if (due) {
    const reminder = calculateReminderDate(assignment);
    body.due_date = reminder || due;
  }
  const res = await fetch(`${TODOIST_BASE}/tasks/${taskId}`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body)
  });
  return res.ok;
}

export async function deleteTask(taskId, token) {
  const res = await fetch(`${TODOIST_BASE}/tasks/${taskId}`, { method: 'DELETE', headers: headers(token) });
  return res.status === 204;
}

export async function syncAssignments(assignments) {
  const settings = await getSettings();
  const token = settings.TODOIST_TOKEN;
  if (!token) return { total_processed: 0, new_created: 0, existing_updated: 0 };

  const valid = (assignments || []).filter(a => a && a.title && a.status !== 'Completed');
  const projectId = await getOrCreateProject(settings.projectName || 'School Assignments', token);
  if (!projectId) return { total_processed: 0, new_created: 0, existing_updated: 0 };

  const groups = await preventDuplicateSync(valid, projectId, token);
  let created = 0, updated = 0;

  for (const a of groups.existing) {
    const taskId = a._todoist_task_id;
    const changes = await hasMeaningfulChanges(a, taskId, token);
    if (changes) {
      if (await updateTask(a, taskId, token)) updated++;
    }
  }
  for (const a of groups.new) {
    if (await createTask(a, projectId, token)) created++;
  }

  return { total_processed: created + updated, new_created: created, existing_updated: updated };
}



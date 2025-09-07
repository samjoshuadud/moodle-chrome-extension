function log(...args) {
  console.log('[Todoist]', ...args);
}

import { getSettings } from './storage.js';

const TODOIST_BASE = 'https://api.todoist.com/rest/v2';

function headers(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}
function parseDate(str) {
  if (!str || str === 'No due date' || str === 'No opening date') return null;
  
  // Handles formats like "Saturday, 30 August 2025, 11:59 PM"
  const complexMatch = str.match(/(\w+,\s+\d{1,2}\s+\w+\s+\d{4},\s+\d{1,2}:\d{2}\s+[AP]M)/i);
  if (complexMatch) {
      const d = new Date(complexMatch[1]);
      if (!isNaN(d.getTime())) return d;
  }
  
  // Handles formats like "30 August 2025"
  const simpleMatch = str.match(/(\d{1,2}\s+\w+\s+\d{4})/i);
   if (simpleMatch) {
      const d = new Date(simpleMatch[1]);
      if (!isNaN(d.getTime())) return d;
  }
  
  // Fallback for YYYY-MM-DD and other standard formats
  const d = new Date(str);
  if (isNaN(d.getTime())) return null;
  
  return d;
}

function formatDate(d) {
  if (!d || isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
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
      const res = await fetch(`${TODOIST_BASE}/tasks/${taskId}/close`, { method: 'POST', headers: headers(token) });
      return res.status === 204;
    } else {
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

/**
 * Calculate smart reminder date based on opening date (if available) or due date.
 * Returns a string in 'YYYY-MM-DD' format, or null if not possible.
 */
export function calculateReminderDate(assignment) {
  const dueDateStr = assignment?.due_date;
  const openingDateStr = assignment?.opening_date;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!dueDateStr || dueDateStr === 'No due date') {
    return null;
  }

  let referenceDate = parseDate(dueDateStr);
  let referenceType = "due date";

  if (openingDateStr && openingDateStr !== 'No opening date') {
    const openingDate = parseDate(openingDateStr);
    if (openingDate && (!referenceDate || openingDate > referenceDate)) {
      referenceDate = openingDate;
      referenceType = "opening date";
    }
  }

  if (!referenceDate) {
    return null;
  }

  const daysUntilReference = Math.floor((referenceDate - today) / (1000 * 60 * 60 * 24));

  let reminderDaysBefore = 0;
  if (daysUntilReference <= 0) {
    return formatDate(today);
  } else if (referenceType === "opening date") {
    if (daysUntilReference <= 1) reminderDaysBefore = 0;
    else if (daysUntilReference <= 3) reminderDaysBefore = 1;
    else if (daysUntilReference <= 7) reminderDaysBefore = 2;
    else if (daysUntilReference <= 14) reminderDaysBefore = 3;
    else reminderDaysBefore = 7;
  } else {
    if (daysUntilReference <= 3) reminderDaysBefore = Math.max(1, daysUntilReference - 1);
    else if (daysUntilReference <= 7) reminderDaysBefore = 3;
    else if (daysUntilReference <= 14) reminderDaysBefore = 5;
    else if (daysUntilReference <= 30) reminderDaysBefore = 7;
    else reminderDaysBefore = 14;
  }

  let reminderDate = new Date(referenceDate);
  reminderDate.setDate(reminderDate.getDate() - reminderDaysBefore);

  const realDueDate = parseDate(dueDateStr);

  if (realDueDate && realDueDate >= today && reminderDate < today) {
    reminderDate = new Date(today);
  }
  
  return formatDate(reminderDate);
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

export function formatTaskDescription(assignment) {
  const parts = [];
  const due = assignment?.due_date || '';

  if (due && due !== 'No due date') {
    parts.push(`📅 Deadline: ${due}`);
  }
  
  const url = assignment?.origin_url || '';
  if (url) {
    parts.push(`🔗 Link: ${url}`);
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
export async function createTask(assignment, projectId, token, settings) {
  const content = formatTaskContent(assignment);
  const description = formatTaskDescription(assignment);
  const courseCode = assignment?.course_code || "";

  const body = {
    content,
    description,
    project_id: projectId,
    priority: 2,
  };

  // FIX: Properly parse and format the date
  if (settings.useExactDate) {
    const moodleDate = parseDate(assignment.due_date);
    if (moodleDate) body.due_date = formatDate(moodleDate);
  } else {
    const smartDate = calculateReminderDate(assignment);
    if (smartDate) body.due_date = smartDate;
  }

  if (courseCode) {
    body.labels = [courseCode.toLowerCase()];
  }

  const response = await fetch(`${TODOIST_BASE}/tasks`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create task: ${response.status} - ${text}`);
  }

  return await response.json();
}

export async function updateTask(taskId, assignment, projectId, token, settings) {
  const content = formatTaskContent(assignment);
  const description = formatTaskDescription(assignment);
  const courseCode = assignment?.course_code || "";

  const body = {
    content,
    description,
    project_id: projectId,
    priority: 2,
  };

  // FIX: Properly parse and format the date
  if (settings.useExactDate) {
    const moodleDate = parseDate(assignment.due_date);
    body.due_string = moodleDate ? formatDate(moodleDate) : 'no date';
  } else {
    const smartDate = calculateReminderDate(assignment);
    if (smartDate) {
      body.due_date = smartDate;
    } else {
      body.due_string = 'no date';
    }
  }

  if (courseCode) {
    body.labels = [courseCode.toLowerCase()];
  }

  const response = await fetch(`${TODOIST_BASE}/tasks/${taskId}`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to update task: ${response.status} - ${text}`);
  }

  return await response.json();
}

export async function deleteTask(taskId, token) {
  const res = await fetch(`${TODOIST_BASE}/tasks/${taskId}`, { method: 'DELETE', headers: headers(token) });
  return res.status === 204;
}

export async function syncAssignments(assignments) {
  const settings = await getSettings(); // This now contains `useExactDate`
  const token = settings.TODOIST_TOKEN;
  if (!token) {
    return { added: [], updated: [], completed: [], skipped: [], errors: [{ title: 'Sync Error', reason: 'Todoist token not configured.' }] };
  }

  const valid = (assignments || []).filter(a => a && a.title);
  const projectId = await getOrCreateProject(settings.projectName || 'School Assignments', token);
  if (!projectId) {
    return { added: [], updated: [], completed: [], skipped: [], errors: [{ title: 'Sync Error', reason: `Project '${settings.projectName}' not found.` }] };
  }

  const groups = await preventDuplicateSync(valid, projectId, token);

  const results = { added: [], updated: [], completed: [], skipped: [], errors: [] };

  for (const a of groups.existing) {
    try {
      const taskId = a._todoist_task_id;

      if (a.status === "Completed") {
        const success = await updateTaskStatus(taskId, true, token);
        if (success) {
          results.completed.push(a.title);
        } else {
          results.errors.push({ title: a.title, reason: 'API completion failed.' });
        }
        continue;
      }

      const changes = await hasMeaningfulChanges(a, taskId, token);
      if (changes) {
        const success = await updateTask(taskId, a, projectId, token, settings); // Pass settings
        if (success) results.updated.push(a.title);
        else results.errors.push({ title: a.title, reason: 'API update failed.' });
      } else {
        results.skipped.push(a.title);
      }
    } catch (e) {
      results.errors.push({ title: a.title, reason: e.message });
    }
  }

  for (const a of groups.new) {
    try {
      if (a.status === "Completed") {
        results.skipped.push(a.title);
        continue; 
      }

      const task = await createTask(a, projectId, token, settings); // Pass settings
      if (task) results.added.push(a.title);
      else results.errors.push({ title: a.title, reason: 'API creation failed.' });
      
    } catch (e) {
      results.errors.push({ title: a.title, reason: e.message });
    }
  }

  return results;
}

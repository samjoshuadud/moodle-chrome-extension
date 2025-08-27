// Clear the sidebar content
function clearSidebar() {
  ensureSidebar();
  const content = document.getElementById('sidebar-content');
  content.innerHTML = '';
}

// Show detailed assignment debug info
function showAssignmentDebug(assignments, label = 'Assignments Debug') {
  ensureSidebar();
  const content = document.getElementById('sidebar-content');
  const div = document.createElement('div');
  div.innerHTML = `<b>${label} (${assignments.length}):</b><pre style="background:#f4f4f4;padding:6px 8px;max-height:200px;overflow:auto;font-size:12px;">${assignments.map(a => JSON.stringify(a, null, 2)).join('\n\n')}</pre>`;
  content.appendChild(div);
  content.scrollTop = content.scrollHeight;
}

// Show just the task IDs for quick duplicate checks
function showTaskIdList(assignments, label = 'Task IDs') {
  ensureSidebar();
  const content = document.getElementById('sidebar-content');
  const div = document.createElement('div');
  div.innerHTML = `<b>${label}:</b> <span style='font-size:12px;color:#555'>${assignments.map(a => a.task_id).join(', ')}</span>`;
  content.appendChild(div);
  content.scrollTop = content.scrollHeight;
}
// sidebar.js
// Injects a right sidebar for logs, scraped items, and sync results

const SIDEBAR_ID = 'moodle-todoist-sidebar';

function ensureSidebar() {
  if (document.getElementById(SIDEBAR_ID)) return;
  const sidebar = document.createElement('div');
  sidebar.id = SIDEBAR_ID;
  sidebar.style.position = 'fixed';
  sidebar.style.top = '0';
  sidebar.style.right = '0';
  sidebar.style.width = '380px';
  sidebar.style.height = '100vh';
  sidebar.style.background = '#f8f9fa';
  sidebar.style.borderLeft = '1px solid #ccc';
  sidebar.style.zIndex = '99999';
  sidebar.style.overflowY = 'auto';
  sidebar.style.boxShadow = '-2px 0 8px rgba(0,0,0,0.08)';
  sidebar.innerHTML = `
    <div style="padding:12px 16px; border-bottom:1px solid #ddd; background:#fff;">
      <b>Moodle Todoist Log</b>
      <button id="sidebar-close-btn" style="float:right;">✕</button>
    </div>
    <div id="sidebar-content" style="padding:12px; font-size:14px; line-height:1.5;"></div>
  `;
  document.body.appendChild(sidebar);
  document.getElementById('sidebar-close-btn').onclick = () => sidebar.remove();
}

function logToSidebar(msg, type = 'log') {
  ensureSidebar();
  const content = document.getElementById('sidebar-content');
  const div = document.createElement('div');
  div.style.marginBottom = '6px';
  if (type === 'error') div.style.color = '#b00';
  if (type === 'success') div.style.color = '#080';
  div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  content.appendChild(div);
  content.scrollTop = content.scrollHeight;
}

function showScrapedItems(items) {
  ensureSidebar();
  const content = document.getElementById('sidebar-content');
  const div = document.createElement('div');
  div.innerHTML = `<b>Scraped Items (${items.length}):</b><ul style="margin:4px 0 8px 16px;">${items.map(i => `<li>${i.title} <small style='color:#888'>(${i.due_date})</small></li>`).join('')}</ul>`;
  content.appendChild(div);
  content.scrollTop = content.scrollHeight;
}

function showSyncResults({added = [], updated = [], skipped = [], errors = []}) {
  ensureSidebar();
  const content = document.getElementById('sidebar-content');
  const div = document.createElement('div');
  div.innerHTML = `<b>Sync Results:</b><ul style="margin:4px 0 8px 16px;">
    <li style='color:#080'>Added: ${added.length}</li>
    <li style='color:#06c'>Updated: ${updated.length}</li>
    <li style='color:#888'>Skipped: ${skipped.length}</li>
    <li style='color:#b00'>Errors: ${errors.length}</li>
  </ul>`;
  content.appendChild(div);
  content.scrollTop = content.scrollHeight;
}

// Usage: functions are now global. Just call logToSidebar(), showScrapedItems(), showSyncResults(), etc. from content.js

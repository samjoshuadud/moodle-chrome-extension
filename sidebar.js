// === SIDEBAR FUNCTIONS ===
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
  sidebar.style.background = '#fff';
  sidebar.style.borderLeft = '1px solid #ddd';
  sidebar.style.zIndex = '2147483647'; // always on top
  sidebar.style.overflowY = 'auto';
  sidebar.style.boxShadow = '-2px 0 8px rgba(0,0,0,0.08)';
  sidebar.style.fontFamily = 'system-ui, sans-serif';

  sidebar.innerHTML = `
    <div style="padding:12px 16px; border-bottom:1px solid #ddd; background:#f9f9f9; display:flex; justify-content:space-between; align-items:center;">
      <b style="font-size:14px;">Moodle Todoist Log</b>
      <button id="sidebar-close-btn" style="border:none;background:none;font-size:16px;cursor:pointer;">✕</button>
    </div>
    <div id="sidebar-content" style="padding:12px; font-size:13px; line-height:1.4;"></div>
  `;
  document.body.appendChild(sidebar);

  document.getElementById('sidebar-close-btn').onclick = () => sidebar.remove();
}

function clearSidebar() {
  ensureSidebar();
  const content = document.getElementById('sidebar-content');
  if (content) content.innerHTML = '';
}

function logToSidebar(msg, type = 'log') {
  ensureSidebar();
  const content = document.getElementById('sidebar-content');
  const div = document.createElement('div');
  div.style.marginBottom = '6px';
  if (type === 'error') div.style.color = '#b00';
  if (type === 'success') div.style.color = '#080';
  if (type === 'info') div.style.color = '#06c';
  div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  content.appendChild(div);
  content.scrollTop = content.scrollHeight;
}

function showScrapedItems(items, newIds = []) {
  ensureSidebar();
  const content = document.getElementById('sidebar-content');
  
  const grouped = items.reduce((acc, item) => {
    const course = item.course || "Uncategorized";
    if (!acc[course]) acc[course] = [];
    acc[course].push(item);
    return acc;
  }, {});

  const div = document.createElement('div');
  div.innerHTML = `<b>Scraped Items (total: ${items.length}):</b>`;

  Object.entries(grouped).forEach(([course, assignments]) => {
    const section = document.createElement('div');
    section.style.margin = '8px 0';
    section.innerHTML = `
      <div style="font-weight:bold;margin-top:10px;color:#06c;">${course} (${assignments.length})</div>
      <ul style="margin:4px 0 8px 16px; padding:0;">
        ${assignments.map(i => `
          <li style="${newIds.includes(i.task_id) ? 'background: #fffae6; font-weight:bold;' : ''}">
            ${i.title} <small style="color:#888">(${i.due_date || 'no due'})</small>
          </li>
        `).join('')}
      </ul>
    `;
    div.appendChild(section);
  });

  content.appendChild(div);
  content.scrollTop = content.scrollHeight;
}


function showSyncResults({added = [], updated = [], skipped = [], errors = []}) {
  ensureSidebar();
  const content = document.getElementById('sidebar-content');
  const div = document.createElement('div');
  div.innerHTML = `
    <b>Sync Results:</b>
    <ul style="margin:4px 0 8px 16px;">
      <li style="color:#080">Added: ${added.length}</li>
      <li style="color:#06c">Updated: ${updated.length}</li>
      <li style="color:#888">Skipped: ${skipped.length}</li>
      <li style="color:#b00">Errors: ${errors.length}</li>
    </ul>`;
  content.appendChild(div);
  content.scrollTop = content.scrollHeight;
}

function showAssignmentDebug(assignments, label = 'Assignments Debug') {
  ensureSidebar();
  const content = document.getElementById('sidebar-content');
  const div = document.createElement('div');
  div.innerHTML = `
    <b>${label} (${assignments.length}):</b>
    <pre style="background:#f4f4f4;padding:6px 8px;max-height:200px;overflow:auto;font-size:12px;">
      ${assignments.map(a => JSON.stringify(a, null, 2)).join('\n\n')}
    </pre>`;
  content.appendChild(div);
  content.scrollTop = content.scrollHeight;
}

function showTaskIdList(assignments, label = 'Task IDs') {
  ensureSidebar();
  const content = document.getElementById('sidebar-content');
  const div = document.createElement('div');
  div.innerHTML = `<b>${label}:</b> <span style='font-size:12px;color:#555'>${assignments.map(a => a.task_id).join(', ')}</span>`;
  content.appendChild(div);
  content.scrollTop = content.scrollHeight;
}

// Expose globally so content.js can call them
window.ensureSidebar = ensureSidebar;
window.clearSidebar = clearSidebar;
window.logToSidebar = logToSidebar;
window.showScrapedItems = showScrapedItems;
window.showSyncResults = showSyncResults;
window.showAssignmentDebug = showAssignmentDebug;
window.showTaskIdList = showTaskIdList;

console.log("sidebar.js loaded");

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);

console.log("🎨 Enhanced sidebar.js loaded with modern UI");

// Auto-create sidebar for testing (remove in production)
// Remove auto-create for production. Add a loading indicator function.

function showSidebarLoading(msg = 'Loading...') {
  ensureSidebar();
  const content = document.getElementById('sidebar-content');
  if (!content) return;
  content.innerHTML = `<div style="padding:24px 0;text-align:center;color:#888;font-size:15px;">
    <span style="display:inline-block;width:24px;height:24px;border:3px solid #e0e0e0;border-top:3px solid #888;border-radius:50%;animation:spin 1s linear infinite;margin-bottom:8px;"></span><br>${msg}
  </div>`;
}

const loadingStyle = document.createElement('style');
loadingStyle.textContent = `@keyframes spin { 0% { transform: rotate(0deg);} 100% {transform: rotate(360deg);} }`;
document.head.appendChild(loadingStyle);


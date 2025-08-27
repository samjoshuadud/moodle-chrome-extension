// === ENHANCED SIDEBAR FUNCTIONS ===

const SIDEBAR_ID = 'moodle-todoist-sidebar';

function ensureSidebar() {
  console.log('[Sidebar] ensureSidebar called');
  try {
    if (document.getElementById(SIDEBAR_ID)) {
      console.log('[Sidebar] Already exists');
      return;
    }
    if (!document.body) {
      console.warn('[Sidebar] document.body not ready, retrying...');
      window.addEventListener('DOMContentLoaded', ensureSidebar, { once: true });
      return;
    }

    const sidebar = document.createElement('div');
    sidebar.id = SIDEBAR_ID;
    
    // Minimalist styling
    sidebar.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 340px;
      height: 100vh;
      background: #fff;
      border-left: 1px solid #e0e0e0;
      z-index: 999999;
      overflow: hidden;
      box-shadow: -4px 0 16px rgba(0,0,0,0.08);
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #222;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    sidebar.innerHTML = `
      <div class="sidebar-header" style="
        padding: 16px 20px;
        background: #fafbfc;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        align-items: center;
        justify-content: space-between;
      ">
        <div style="font-size: 16px; font-weight: 600; color: #222;">Moodle Sync</div>
        <button id="sidebar-close-btn" style="
          background: none;
          border: none;
          color: #888;
          width: 32px;
          height: 32px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 18px;
          transition: background 0.2s;
        " onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='none'">✕</button>
      </div>
      <div class="sidebar-content-wrapper" style="
        height: calc(100vh - 56px);
        overflow-y: auto;
        background: #fff;
        padding: 14px 16px;
      ">
        <div id="sidebar-content" style="
          font-size: 14px;
          line-height: 1.6;
          color: #222;
        "></div>
      </div>
      <style>
        #${SIDEBAR_ID}::-webkit-scrollbar {
          width: 8px;
        }
        #${SIDEBAR_ID}::-webkit-scrollbar-track {
          background: #f0f0f0;
          border-radius: 4px;
        }
        #${SIDEBAR_ID}::-webkit-scrollbar-thumb {
          background: #e0e0e0;
          border-radius: 4px;
        }
        #${SIDEBAR_ID}::-webkit-scrollbar-thumb:hover {
          background: #ccc;
        }
        .sidebar-content-wrapper::-webkit-scrollbar {
          width: 8px;
        }
        .sidebar-content-wrapper::-webkit-scrollbar-track {
          background: #fafbfc;
        }
        .sidebar-content-wrapper::-webkit-scrollbar-thumb {
          background: #e0e0e0;
          border-radius: 4px;
        }
      </style>
    `;

    document.body.appendChild(sidebar);
    
    // Enhanced close button functionality
    const closeBtn = document.getElementById('sidebar-close-btn');
    closeBtn.onclick = () => {
      sidebar.style.transform = 'translateX(100%)';
      setTimeout(() => sidebar.remove(), 300);
    };
    
    console.log('[Sidebar] Modern sidebar created');
  } catch (err) {
    console.error('[Sidebar] Failed to create sidebar:', err);
  }
}

function clearSidebar() {
  ensureSidebar();
  const content = document.getElementById('sidebar-content');
  if (content) {
    content.innerHTML = '';
    // Add a subtle animation
    content.style.opacity = '0.5';
    setTimeout(() => { content.style.opacity = '1'; }, 150);
  }
}

function logToSidebar(msg, type = 'log') {
  ensureSidebar();
  const content = document.getElementById('sidebar-content');
  if (!content) return;
  
  const div = document.createElement('div');
  const timestamp = new Date().toLocaleTimeString();
  
  // Minimalist styling based on message type
  let borderColor = '#e0e0e0', icon = '', textColor = '#222', bgColor = '#fff';
  switch (type) {
    case 'error':
      borderColor = '#e57373';
      icon = '❌';
      textColor = '#b71c1c';
      break;
    case 'success':
      borderColor = '#81c784';
      icon = '✅';
      textColor = '#256029';
      break;
    case 'warning':
      borderColor = '#ffd54f';
      icon = '⚠️';
      textColor = '#7f6000';
      break;
    case 'info':
      borderColor = '#64b5f6';
      icon = 'ℹ️';
      textColor = '#0d47a1';
      break;
    default:
      borderColor = '#e0e0e0';
      icon = '';
      textColor = '#222';
  }
  div.style.cssText = `
    margin-bottom: 10px;
    padding: 10px 14px;
    background: ${bgColor};
    border-radius: 8px;
    border-left: 3px solid ${borderColor};
    color: ${textColor};
    font-size: 13px;
    line-height: 1.5;
    animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  `;
  div.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 8px;">
      ${icon ? `<span style="font-size: 14px; margin-top: 1px;">${icon}</span>` : ''}
      <div style="flex: 1;">
        <div style="font-weight: 500; margin-bottom: 2px;">
          ${msg}
        </div>
        <div style="font-size: 11px; opacity: 0.6;">
          ${timestamp}
        </div>
      </div>
    </div>
  `;
  
  content.appendChild(div);
  content.scrollTop = content.scrollHeight;
  
  // Add subtle entrance animation
  div.style.transform = 'translateY(20px)';
  div.style.opacity = '0';
  setTimeout(() => {
    div.style.transform = 'translateY(0)';
    div.style.opacity = '1';
    div.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
  }, 10);
}

function showScrapedItems(items) {
  ensureSidebar();
  const content = document.getElementById('sidebar-content');
  if (!content) return;
  
  const div = document.createElement('div');
  div.style.cssText = `
    margin-bottom: 12px;
    padding: 12px;
    background: #f7f7f7;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
  `;
  
  const itemsHtml = items.map((item, index) => `
    <div style="
      display: flex;
      align-items: center;
      padding: 6px 0;
      border-bottom: 1px solid #eee;
    ">
      <div style="width: 22px; text-align: right; color: #888; font-size: 12px; margin-right: 10px;">${index + 1}</div>
      <div style="flex: 1;">
        <div style="font-weight: 500; color: #222; font-size: 13px;">${item.title}</div>
        <div style="color: #666; font-size: 11px;">Due: ${item.due_date}</div>
      </div>
    </div>
  `).join('');
  
  div.innerHTML = `
    <div style="font-size: 15px; font-weight: 600; margin-bottom: 8px; color: #222;">Scraped Items (${items.length})</div>
    <div>${itemsHtml}</div>
  `;
  
  content.appendChild(div);
  content.scrollTop = content.scrollHeight;
}

function showSyncResults({added = [], updated = [], skipped = [], errors = []}) {
  ensureSidebar();
  const content = document.getElementById('sidebar-content');
  if (!content) return;
  
  const div = document.createElement('div');
  div.style.cssText = `
    margin-bottom: 12px;
    padding: 12px;
    background: #f7f7f7;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
  `;
  
  div.innerHTML = `
    <div style="font-size: 15px; font-weight: 600; margin-bottom: 8px; color: #222;">Sync Results</div>
    <ul style="list-style:none; padding:0; margin:0;">
      <li style="margin-bottom:6px; color:#256029;">Added: <b>${added.length}</b></li>
      <li style="margin-bottom:6px; color:#0d47a1;">Updated: <b>${updated.length}</b></li>
      <li style="margin-bottom:6px; color:#7f6000;">Skipped: <b>${skipped.length}</b></li>
      <li style="margin-bottom:6px; color:#b71c1c;">Errors: <b>${errors.length}</b></li>
    </ul>
  `;
  
  content.appendChild(div);
  content.scrollTop = content.scrollHeight;
}

function showAssignmentDebug(assignments, label = 'Assignment Debug') {
  ensureSidebar();
  const content = document.getElementById('sidebar-content');
  if (!content) return;
  
  const div = document.createElement('div');
  div.style.cssText = `
    margin-bottom: 12px;
    padding: 12px;
    background: #f7f7f7;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
  `;
  
  div.innerHTML = `
    <div style="font-size: 15px; font-weight: 600; margin-bottom: 8px; color: #222;">${label} (${assignments.length})</div>
    <pre style="background: #f0f0f0; padding: 10px; border-radius: 6px; color: #333; font-size: 12px; max-height: 180px; overflow: auto; font-family: monospace; border: 1px solid #e0e0e0;">${assignments.map(a => JSON.stringify(a, null, 2)).join('\n\n')}</pre>
  `;
  
  content.appendChild(div);
  content.scrollTop = content.scrollHeight;
}

function showTaskIdList(assignments, label = 'Task IDs') {
  ensureSidebar();
  const content = document.getElementById('sidebar-content');
  if (!content) return;
  
  const div = document.createElement('div');
  div.style.cssText = `
    margin-bottom: 12px;
    padding: 12px;
    background: #f7f7f7;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
  `;
  
  const taskIds = assignments.map(a => a.task_id);
  const idsHtml = taskIds.map(id => `
    <span style="
      display: inline-block;
      background: #e3f2fd;
      color: #1565c0;
      padding: 3px 7px;
      border-radius: 5px;
      font-size: 11px;
      font-family: monospace;
      margin: 2px;
      font-weight: 500;
    ">${id}</span>
  `).join('');
  
  div.innerHTML = `
    <div style="font-size: 15px; font-weight: 600; margin-bottom: 8px; color: #222;">${label}</div>
    <div style="line-height: 1.8;">${idsHtml}</div>
  `;
  
  content.appendChild(div);
  content.scrollTop = content.scrollTop;
}

// Expose sidebar functions globally
window.ensureSidebar = ensureSidebar;
window.logToSidebar = logToSidebar;
window.showScrapedItems = showScrapedItems;
window.showSyncResults = showSyncResults;
window.clearSidebar = clearSidebar;
window.showAssignmentDebug = showAssignmentDebug;
window.showTaskIdList = showTaskIdList;

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


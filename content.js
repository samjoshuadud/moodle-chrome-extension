// Minimal Moodle DOM scraper placeholder

async function extractAssignmentsFromDom() {
  // Common Moodle structures: course view and activity list
  const candidates = new Set();
  qsa('.activity, li.activity, .activityinstance, .modtype_assign, .modtype_quiz').forEach(n => candidates.add(n));
  qsa('table.generaltable, .assign-table, .quizinfo').forEach(n => candidates.add(n));

  const items = [];
  candidates.forEach(node => {
    const title = (qs(node, '.instancename')?.textContent || qs(node, 'a')?.textContent || '').trim();
    const course = (qs(document, '#page-header h1')?.textContent || qs(document, '.page-header-headings h1')?.textContent || '').trim();
    const url = qs(node, 'a')?.href || location.href;
    const dueDate = parseDueDate(node);
    if (title) items.push(normalizeAssignment({ title, raw_title: title, course, url, due_date: dueDate }));
  });
  return items;
}

function parseDueDate(root) {
  // Look for typical labels: Due, Deadline, Closes, Due date
  const text = (root.textContent || '').replace(/\s+/g, ' ');
  const patterns = [
    /Due\s*:?[\s\-]*(\w+\s+\d{1,2},\s+\d{4})/i,
    /Due date\s*:?[\s\-]*(\w+\s+\d{1,2},\s+\d{4})/i,
    /Deadline\s*:?[\s\-]*(\w+\s+\d{1,2},\s+\d{4})/i,
    /Closes\s*:?[\s\-]*(\w+\s+\d{1,2},\s+\d{4})/i
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const d = new Date(m[1]);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0,10);
    }
  }
  // Fallback: ISO-like in DOM
  const timeEl = qs(root, 'time[datetime]');
  if (timeEl && timeEl.getAttribute('datetime')) {
    const d = new Date(timeEl.getAttribute('datetime'));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0,10);
  }
  return '';
}

function normalizeAssignment(a) {
  const course_code = extractCourseCode(a.course);
  const task_id = generateTaskId(a.title, course_code, a.url);
  return {
    title: a.title,
    raw_title: a.raw_title,
    course: a.course,
    course_code,
    due_date: a.due_date,
    status: "Pending",
    task_id,
    activity_type: "Assignment",
    source: "Moodle"
  };
}

function extractCourseCode(course) {
  const m = course && course.match(/[A-Z]{2,4}\s?-?\d{3,4}/);
  return m ? m[0].replace(/\s+/g, "") : "";
}

function generateTaskId(title, courseCode, url) {
  const data = `${title}::${courseCode}::${url}`;
  try {
    // Simple deterministic hash
    let h = 0;
    for (let i = 0; i < data.length; i++) h = (h * 31 + data.charCodeAt(i)) >>> 0;
    return `t${h}`;
  } catch {
    return btoa(unescape(encodeURIComponent(data))).slice(0,12);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "SCRAPE_ASSIGNMENTS") {
    extractAssignmentsFromDom().then(assignments => sendResponse({ assignments }));
    return true;
  }
});

function qs(root, sel) { return (root || document).querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }



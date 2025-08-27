// Functions like ensureSidebar, logToSidebar are now available globally.



// Functions like ensureSidebar, logToSidebar are now available globally.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'SHOW_SIDEBAR') {
    ensureSidebar();
    logToSidebar('Sidebar opened from options page', 'info');
    return;
  }
  if (msg?.type === 'SCRAPE_AND_SYNC') {
    ensureSidebar();
    if (typeof showSidebarLoading === 'function') {
      showSidebarLoading('Scraping assignments...');
    } else {
      clearSidebar();
      logToSidebar('Scraping assignments...', 'info');
    }
    let scrapePromise;
    if (location.pathname.includes("/my/courses.php")) {
      scrapePromise = scrapeAllCourses();
    } else {
      scrapePromise = Promise.resolve(extractAssignmentsFromDom());
    }
    scrapePromise.then(assignments => {
      clearSidebar();
      showScrapedItems(assignments);
      logToSidebar(`Scraped ${assignments.length} tasks.`, 'success');
      sendResponse({ assignments });
    });
    return true;
  }
});
console.log("✅ Moodle content script injected at", location.href);

// === NEW: fetch all courses and scrape ===
async function scrapeAllCourses() {
  const courseLinks = Array.from(
    document.querySelectorAll('a[href*="/course/view.php?id="]')
  ).map(a => a.href).filter((v, i, arr) => arr.indexOf(v) === i);

  const allAssignments = [];

  for (const link of courseLinks) {
    try {
      const html = await fetch(link, { credentials: "include" }).then(r => r.text());
      const dom = new DOMParser().parseFromString(html, "text/html");
      const assignments = await Promise.resolve(extractAssignmentsFromDom(dom));
      // No console.log, sidebar will show scraped items
      allAssignments.push(...assignments);
    } catch (e) {
      console.error("❌ Failed to fetch course", link, e);
    }
  }

  return allAssignments;
}

function detectActivityType(node, title) {
  const modtype = node.className.match(/modtype_([a-zA-Z]+)/)?.[1] || 'unknown';
  if (modtype === 'url') {
    // Smart detection for quiz/lesson links
    if (/quiz|exam|test|assignment|assessment|midterm|final|pre-test|post-test/i.test(title)) {
      return 'quiz_link';
    }
    // Optionally, detect lessons/resources
    return 'lesson_link';
  }
  return modtype;
}


// Adapted to accept DOM param (not just document)
function extractAssignmentsFromDom(rootDoc = document, includeLessons = false) {
  // Detect if we are on a course page
  const onCoursePage = !!qs(rootDoc, '.course-content') || !!qs(rootDoc, '#page-header h1');
  if (!onCoursePage) {
    showNavigateToCoursesModal();
    return []; // stop scraping
  }

  const candidates = new Set();

  // Assignment (skip completed)
  qsa(rootDoc, '.modtype_assign').forEach(n => {
    if (!n.classList.contains('submission_done')) candidates.add(n);
  });

  // Quiz / Exam (skip closed)
  qsa(rootDoc, '.modtype_quiz').forEach(n => {
    if (!n.classList.contains('quiz_closed')) candidates.add(n);
  });

  // Task-like URL modules
  qsa(rootDoc, '.modtype_url').forEach(node => {
    const title = (qs(node, '.instancename')?.textContent || qs(node, 'a')?.textContent || '').trim();
    if (/quiz|assignment/i.test(title)) {
      candidates.add(node);
    }
  });

  // Forums: add if they have a due date in DOM, or fetch and parse forum page for due date
  const forumPromises = [];
  qsa(rootDoc, '.modtype_forum').forEach(node => {
    let dueDate = parseDueDate(node);
    if (!dueDate) {
      // Try to find more flexible date formats in DOM text
      const text = (node.textContent || '').replace(/\s+/g, ' ');
      const extraPatterns = [
        /Due\s*:?[\s\-]*([A-Za-z]+,?\s+\d{1,2}\s+[A-Za-z]+\s+\d{4},?\s*\d{1,2}:\d{2}\s*[APMapm]{2})/i,
        /Due\s*:?[\s\-]*([A-Za-z]+,?\s+\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
        /Due\s*:?[\s\-]*([\d]{4}-[\d]{2}-[\d]{2})/i
      ];
      for (const re of extraPatterns) {
        const m = text.match(re);
        if (m) {
          dueDate = m[1];
          break;
        }
      }
    }
    if (dueDate) {
      candidates.add(node);
    } else {
      // Try to fetch forum page and parse for due date
      const url = qs(node, 'a')?.href;
      if (url) {
        forumPromises.push(
          fetch(url, { credentials: 'include' })
            .then(r => r.text())
            .then(html => {
              // Use more flexible patterns for forum page
              const patterns = [
                /Due\s*:?[\s\-]*([A-Za-z]+,?\s+\d{1,2}\s+[A-Za-z]+\s+\d{4},?\s*\d{1,2}:\d{2}\s*[APMapm]{2})/i,
                /Due\s*:?[\s\-]*([A-Za-z]+,?\s+\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
                /Due date\s*:?[\s\-]*([A-Za-z]+,?\s+\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
                /Deadline\s*:?[\s\-]*([A-Za-z]+,?\s+\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
                /Closes\s*:?[\s\-]*([A-Za-z]+,?\s+\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
                /Due\s*:?[\s\-]*([\d]{4}-[\d]{2}-[\d]{2})/i
              ];
              for (const re of patterns) {
                const m = html.match(re);
                if (m) return node;
              }
              // Try <time datetime="...">
              const timeMatch = html.match(/<time[^>]*datetime=["']([^"'>]+)["']/i);
              if (timeMatch) return node;
              return null;
            })
            .catch(() => null)
        );
      }
    }
  });

  // Wait for forum fetches to resolve before continuing
  let forumPromise = null;
  if (forumPromises.length) {
    forumPromise = Promise.all(forumPromises).then(results => {
      results.forEach(node => {
        if (node) candidates.add(node);
      });
    });
  }

  // Helper to process candidates after forum fetches
  function processCandidates() {
    const items = [];
    const seen = new Set();
    const promises = [];
    candidates.forEach(node => {
      const title = (qs(node, '.instancename')?.textContent || qs(node, 'a')?.textContent || '').trim();
      const course = (qs(rootDoc, '#page-header h1')?.textContent || qs(rootDoc, '.page-header-headings h1')?.textContent || '').trim();
      const url = qs(node, 'a')?.href || location.href;
      // Improved due date extraction: try multiple patterns, relative formats, and <time> elements
      let dueDate = parseDueDate(node);
      if (!dueDate) {
        const text = (node.textContent || '').replace(/\s+/g, ' ');
        // Absolute date patterns
        const extraPatterns = [
          /Due\s*:?:?\s*([A-Za-z]+,?\s+\d{1,2}\s+[A-Za-z]+\s+\d{4},?\s*\d{1,2}:\d{2}\s*[APMapm]{2})/i,
          /Due\s*:?:?\s*([A-Za-z]+,?\s+\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
          /Due\s*:?:?\s*([\d]{4}-[\d]{2}-[\d]{2})/i,
          /The due date is (?:on )?([A-Za-z]+,? [A-Za-z]+ \d{1,2}, \d{4},? \d{1,2}:\d{2} ?[APMapm]{2})/i,
          /The due date is (?:on )?([A-Za-z]+,? [A-Za-z]+ \d{1,2}, \d{4})/i
        ];
        for (const re of extraPatterns) {
          const m = text.match(re);
          if (m) {
            dueDate = m[1];
            break;
          }
        }
        // Relative weekday pattern: "The due date is on Monday at 6 PM"
        if (!dueDate) {
          const relMatch = text.match(/due date is on ([A-Za-z]+) at (\d{1,2}) ?([APMapm]{2})/i);
          if (relMatch) {
            const weekday = relMatch[1];
            let hour = parseInt(relMatch[2], 10);
            const ampm = relMatch[3];
            // Compute next occurrence of weekday from today
            const daysOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
            const today = new Date();
            let dayIdx = daysOfWeek.findIndex(d => d.toLowerCase() === weekday.toLowerCase());
            if (dayIdx >= 0) {
              let diff = (dayIdx - today.getDay() + 7) % 7;
              if (diff === 0) diff = 7; // always next week if today
              let due = new Date(today);
              due.setDate(today.getDate() + diff);
              if (/pm/i.test(ampm) && hour < 12) hour += 12;
              if (/am/i.test(ampm) && hour === 12) hour = 0;
              due.setHours(hour, 0, 0, 0);
              dueDate = due.toISOString().replace('T', ' ').slice(0, 16);
            }
          }
        }
        // Try <time datetime="...">
        const timeEl = qs(node, 'time[datetime]');
        if (timeEl && timeEl.getAttribute('datetime')) {
          const d = new Date(timeEl.getAttribute('datetime'));
          if (!isNaN(d.getTime())) dueDate = d.toISOString().slice(0, 10);
        }
      }
      dueDate = dueDate || "No due date";
      // Improved opening date extraction
      let opening_date = "No opening date";
      const openText = (node.textContent || '').replace(/\s+/g, ' ');
      const openPatterns = [
        /Open(?:ing)?\s*:?\s*([A-Za-z]+,?\s+\d{1,2}\s+[A-Za-z]+\s+\d{4},?\s*\d{1,2}:\d{2}\s*[APMapm]{2})/i,
        /Open(?:ing)?\s*:?\s*([A-Za-z]+,?\s+\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
        /Open(?:ing)?\s*:?\s*([\d]{4}-[\d]{2}-[\d]{2})/i
      ];
      for (const re of openPatterns) {
        const m = openText.match(re);
        if (m) {
          opening_date = m[1];
          break;
        }
      }
      const activity_type = detectActivityType(node, title);

      // Skip duplicates and lessons/resources unless included
      const key = `${title}::${url}`;
      if (!title || !dueDate || seen.has(key)) return;
      if (activity_type === 'lesson_link' && !includeLessons) return;
      seen.add(key);

      // Determine status using smart detection (support async)
      const status = getCompletionStatus(node, activity_type, url);
      const assignmentObj = {
        title,
        raw_title: title,
        course,
        url,
        due_date: dueDate,
        opening_date,
        activity_type,
        status,
        node // pass node for normalization if needed
      };
      if (status instanceof Promise) {
        promises.push(
          status.then(resolvedStatus =>
            normalizeAssignment({ ...assignmentObj, status: resolvedStatus })
          )
        );
      } else {
        items.push(normalizeAssignment(assignmentObj));
      }
    });
    if (promises.length) {
      return Promise.all(promises).then(resolved => items.concat(resolved));
    }
    return items;
  }

  if (forumPromise) {
    return forumPromise.then(processCandidates);
  }
  return processCandidates();
}

// Show a modal prompting user to go to courses page
function showNavigateToCoursesModal() {
  if (document.getElementById('courses-page-modal')) return; // prevent duplicate

  const modal = document.createElement('div');
  modal.id = 'courses-page-modal';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.backgroundColor = 'rgba(0,0,0,0.6)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '9999';

  modal.innerHTML = `
    <div style="background:#fff;padding:20px;border-radius:8px;max-width:400px;text-align:center;">
      <h2>Navigate to Courses Page</h2>
      <p>To fetch assignments, please navigate to your courses page first.</p>
      <button id="closeModalBtn" style="margin-top:10px;padding:5px 10px;">OK</button>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('closeModalBtn').addEventListener('click', () => {
    modal.remove();
  });
}


// Helper: smart status detection
function getCompletionStatus(node, activityType = '', url = '') {
  // Manual completion button
  const btn = node.querySelector('[data-action="toggle-manual-completion"]');
  if (btn) {
    const text = (btn.textContent || '').toLowerCase();
    const toggle = (btn.getAttribute('data-toggletype') || '').toLowerCase();
    const title = (btn.getAttribute('title') || '').toLowerCase();

    if (text.includes('mark as done') || toggle.includes('manual:mark') || title.includes('mark as done')) return 'Pending';
    if (text.includes('done') || toggle.includes('undo') || title.includes('marked as done') || title.includes('press to undo')) return 'Completed';
  }

  // Assignments can have submission page check in future (async)
  // Advanced: For assignments, fetch submission status if no manual button
  if (activityType === 'assign' && url && node.classList.contains('modtype_assign')) {
    // Return a Promise for async status detection
    return fetch(url, { credentials: 'include' })
      .then(r => r.text())
      .then(html => {
        // Parse returned HTML for status keywords
        const statusKeywords = [
          { re: /submitted|your submission/i, status: 'Submitted' },
          { re: /graded|grade/i, status: 'Graded' },
          { re: /draft/i, status: 'Draft' },
          { re: /not submitted|no submission/i, status: 'Pending' },
          { re: /feedback/i, status: 'Feedback' }
        ];
        for (const { re, status } of statusKeywords) {
          if (re.test(html)) return status;
        }
        return 'Pending';
      })
      .catch(() => 'Pending');
  }

  return 'Pending';
}




function parseDueDate(root) {
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
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  const timeEl = qs(root, 'time[datetime]');
  if (timeEl && timeEl.getAttribute('datetime')) {
    const d = new Date(timeEl.getAttribute('datetime'));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return '';
}

function normalizeAssignment(a) {
  const course_code = extractCourseCode(a.course);
  const task_id = generateTaskId(a.title, course_code, a.url);
  // Normalize title
  const title_normalized = (a.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
  // Improved opening date extraction: try multiple patterns and <time> elements
  let opening_date = "No opening date";
  if (a.node) {
    const openText = (a.node.textContent || '').replace(/\s+/g, ' ');
    const openPatterns = [
      /Open(?:ing)?\s*:?\s*([A-Za-z]+,?\s+\d{1,2}\s+[A-Za-z]+\s+\d{4},?\s*\d{1,2}:\d{2}\s*[APMapm]{2})/i,
      /Open(?:ing)?\s*:?\s*([A-Za-z]+,?\s+\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
      /Open(?:ing)?\s*:?\s*([\d]{4}-[\d]{2}-[\d]{2})/i,
      /Available from\s*:?\s*([A-Za-z]+,?\s+\d{1,2}\s+[A-Za-z]+\s+\d{4},?\s*\d{1,2}:\d{2}\s*[APMapm]{2})/i,
      /Available from\s*:?\s*([A-Za-z]+,?\s+\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
      /Available from\s*:?\s*([\d]{4}-[\d]{2}-[\d]{2})/i,
      /Opens\s*:?\s*([A-Za-z]+,?\s+\d{1,2}\s+[A-Za-z]+\s+\d{4},?\s*\d{1,2}:\d{2}\s*[APMapm]{2})/i,
      /Opens\s*:?\s*([A-Za-z]+,?\s+\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
      /Opens\s*:?\s*([\d]{4}-[\d]{2}-[\d]{2})/i
    ];
    for (const re of openPatterns) {
      const m = openText.match(re);
      if (m) {
        opening_date = m[1];
        break;
      }
    }
    // Try <time datetime="..."> for opening date
    const timeEl = a.node.querySelector('time[datetime]');
    if (timeEl && timeEl.getAttribute('datetime')) {
      const d = new Date(timeEl.getAttribute('datetime'));
      if (!isNaN(d.getTime())) opening_date = d.toISOString().slice(0, 10);
    }
  }
  // Added date: current date/time
  const added_date = new Date().toISOString().replace('T', ' ').slice(0, 19);
  // Origin URL
  const origin_url = a.url;
  // Last updated: current date/time
  const last_updated = new Date().toISOString().replace('T', ' ').slice(0, 19);
  return {
    title: a.title,
    title_normalized,
    raw_title: a.raw_title,
    due_date: a.due_date,
    opening_date,
    course: a.course,
    course_code,
    status: a.status,
    task_id,
    activity_type: a.activity_type,
    source: "scrape",
    origin_url,
    added_date,
    last_updated
  };
}

function extractCourseCode(course) {
  if (!course) return "";
  // Try: code in parentheses
  let m = course.match(/\(([A-Z]{2,10}\d{2,4})\)/);
  if (m) return m[1];
  // Try: code after colon
  m = course.match(/:\s*([A-Z]{2,10}\d{2,4})/);
  if (m) return m[1];
  // Try: code at start
  m = course.match(/^([A-Z]{2,10}\d{2,4})/);
  if (m) return m[1];
  // Try: code at end
  m = course.match(/([A-Z]{2,10}\d{2,4})$/);
  if (m) return m[1];
  // Try: original pattern
  m = course.match(/[A-Z]{2,4}\s?-?\d{3,4}/);
  if (m) return m[0].replace(/\s+/g, "");
  // Fallback: short version of course name (first word, up to 12 chars)
  return course.split(/\s|:/)[0].slice(0,12);
}

function generateTaskId(title, courseCode, url) {
  // Extract numeric id from URL (e.g., ...id=1234)
  const match = url.match(/id=(\d+)/);
  if (match) return match[1];
  // Fallback: use entire URL if no id found
  return url;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "SCRAPE_ASSIGNMENTS") {
    if (location.pathname.includes("/my/courses.php")) {
      scrapeAllCourses().then(assignments => {
        sendResponse({ assignments });
      });
      return true;
    } else {
      Promise.resolve(extractAssignmentsFromDom()).then(assignments => {
        sendResponse({ assignments });
      });
      return true;
    }
  }
  return false;
});

document.addEventListener('keydown', (e) => {
  // Ctrl+Shift+L to open sidebar and log a test message
  if (e.ctrlKey && e.shiftKey && e.key === 'L') {
    ensureSidebar();
    logToSidebar('Sidebar opened via Ctrl+Shift+L');
  }
});

function qs(root, sel) { return (root || document).querySelector(sel); }
function qsa(root, sel) { return Array.from((root || document).querySelectorAll(sel)); }


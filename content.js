chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "SCRAPE_ASSIGNMENTS") {

    // Run scraping logic
    setTimeout(async () => {
      try {
        const assignments = await extractAssignmentsFromDom(); 
        console.log("Scraped assignments:", assignments);

        if (window.clearSidebar) window.clearSidebar();
        if (window.showScrapedItems) window.showScrapedItems(assignments);

        sendResponse({ assignments });
      } catch (err) {
        console.error("Scraping failed:", err);
        if (window.logToSidebar) window.logToSidebar("Scraping failed: " + err.message, "error");
        sendResponse({ assignments: [], error: String(err) });
      }
    }, 200);

    return true; 
  }

  if (msg?.type === "SHOW_SIDEBAR_RESULTS") {
    if (window.clearSidebar) window.clearSidebar();
    if (window.showScrapedItems) {
      window.showScrapedItems(msg.assignments || [], msg.newIds || []);
    }
  }

  if (msg?.type === "SHOW_SYNC_RESULTS") {
    if (window.showSyncResults) window.showSyncResults(msg.result);
  }
});



console.log("✅ Moodle content script injected at", location.href);

function injectScrapeButton() {
  // Prevent injecting the button multiple times
  if (document.getElementById("moodle-scrape-btn")) return;

  const btn = document.createElement("button");
  btn.id = "moodle-scrape-btn";
  btn.textContent = "⟳ Scrape";

  
  btn.style.position = "fixed";
  btn.style.bottom = "20px";
  btn.style.zIndex = "2147483648";
  btn.style.background = "#06c";
  btn.style.color = "#fff";
  btn.style.border = "none";
  btn.style.padding = "10px 14px";
  btn.style.borderRadius = "50px";
  btn.style.fontSize = "14px";
  btn.style.cursor = "pointer";
  btn.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
  btn.style.transition = "background 0.2s, opacity 0.2s";
  btn.style.pointerEvents = 'auto';
  btn.style.opacity = '1';
  btn.onmouseenter = () => (btn.style.background = "#004a99");
  btn.onmouseleave = () => (btn.style.background = "#06c");

  window.scrapedState = false;

  function updateButtonPosition() {
    const sidebar = document.getElementById('moodle-todoist-sidebar');
    if (sidebar) {
      const sidebarWidth = sidebar.offsetWidth;
      btn.style.right = `${sidebarWidth + 20}px`;
    } else {
      btn.style.right = '20px';
    }
  }

  updateButtonPosition();
  const observer = new MutationObserver(updateButtonPosition);
  observer.observe(document.body, { childList: true, subtree: true });

  // Main Logic for Scraping and Syncing 
  async function doScrapeAndSync() {
    btn.disabled = true;
    btn.style.pointerEvents = 'none';
    btn.style.opacity = '0.6';

    try {
      if (!window.scrapedState) {
        // --- SCRAPE LOGIC ---
        btn.textContent = "⏳ Scraping...";
        if (window.logToSidebar) window.logToSidebar("🔍 Starting scrape...");

        const assignments = await scrapeAllCourses();
        if (window.logToSidebar) window.logToSidebar(`Scraped ${assignments.length} total items.`);

        if (window.clearSidebar) window.clearSidebar();
        if (window.showScrapedItems) window.showScrapedItems(assignments);

        if (assignments.length > 0) {
          // Updates the global window.scrapedState
          window.scrapedState = true;
          btn.textContent = "⟳ Sync";
          if (window.logToSidebar) window.logToSidebar("✅ Scrape completed. Ready to sync.");
        } else {
          // Updates the global window.scrapedState
          window.scrapedState = false;
          btn.textContent = "⟳ Scrape";
          if (window.logToSidebar) window.logToSidebar("✅ Scrape completed. No assignments found.");
        }

        chrome.runtime.sendMessage({ type: "PROCESS_SCRAPED_DATA", assignments });
        if (window.logToSidebar) window.logToSidebar("💾 Data sent to background for processing.");

      } else {
        // --- SYNC LOGIC ---
        btn.textContent = "⏳ Syncing...";
        if (window.logToSidebar) window.logToSidebar("🔄 Starting sync...");

        const syncRes = await chrome.runtime.sendMessage({ type: "SYNC_ONLY" });

        if (syncRes?.ok) {
          if (window.logToSidebar) window.logToSidebar("✅ Sync completed.");
          btn.textContent = "✅ Synced";
        } else {
          if (window.logToSidebar) window.logToSidebar("❌ Sync failed.", "error");
          btn.textContent = "❌ Failed";
        }

        setTimeout(() => {
          btn.textContent = "⟳ Sync";
        }, 2000);
      }
    } catch (err) {
      console.error("Operation failed:", err);
      if (window.logToSidebar) window.logToSidebar(`❌ Error: ${err.message}`, "error");
      btn.textContent = "❌ Failed";

      setTimeout(() => {
        // Resets the global window.scrapedState on error
        window.scrapedState = false;
        btn.textContent = "⟳ Scrape";
      }, 2000);
    } finally {
      btn.disabled = false;
      btn.style.pointerEvents = 'auto';
      btn.style.opacity = '1';
    }
  }

(async function autoScrapeAfterRedirect() {
  const autoScrape = sessionStorage.getItem('autoScrape');
  if (autoScrape === 'true' && window.location.href.includes('/my/courses.php')) {
    sessionStorage.removeItem('autoScrape');
    console.log("⚡ Auto-scraping after redirect...");
    if (window.logToSidebar) window.logToSidebar("⏳ Page loaded, waiting for course content...");
    
    try {
      // 1. WAIT for the main course container to exist on the page.
      //    Use the selector that works for tbl.
      await waitForElement('[data-region="card-deck"]');
      
      if (window.logToSidebar) window.logToSidebar("✅ Course content found, starting auto-scrape.");
      
      // 2. whem the content is loaded, run the scrape.
      await doScrapeAndSync();
      
    } catch (error) {
      console.error("Auto-scrape failed:", error);
      if (window.logToSidebar) window.logToSidebar(`❌ Auto-scrape failed: ${error.message}`, "error");
    }
  }
})();


  btn.onclick = async () => {
    const currentUrl = window.location.href;
    const coursesLink = document.querySelector('a[href="https://tbl.umak.edu.ph/my/courses.php"]');

    if (currentUrl.includes('/login/index.php')) {
      if (window.logToSidebar) window.logToSidebar("⚠ Please log in first.", "error");
      sessionStorage.removeItem('autoScrape');
      return;
    }

    // If NOT on the courses page...
    if (!currentUrl.includes('/my/courses.php')) {
      if (coursesLink) {
        if (window.logToSidebar) window.logToSidebar("🔗 Navigating to My Courses...");
        // 1. Set the flag to auto-scrape after the redirect.
        sessionStorage.setItem('autoScrape', 'true');
        // 2. Click the link to navigate.
        coursesLink.click();
        // 3. STOP here. Let the browser navigate and let the auto-scraper take over on the next page.
        return;
      } else {
        if (window.logToSidebar) window.logToSidebar("🔒 Not logged in", "error");
        sessionStorage.removeItem('autoScrape');
        return;
      }
    }

  // If we ARE on the courses page, run the main logic directly.
  await doScrapeAndSync();
};

  document.body.appendChild(btn);
}

injectScrapeButton();

// Re-inject after full page load 
document.addEventListener("readystatechange", () => {
  if (document.readyState === "complete") injectScrapeButton();
});


function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      const element = document.querySelector(selector);
      if (element) {
        clearInterval(interval);
        resolve(element);
      }
    }, 100); 

    setTimeout(() => {
      clearInterval(interval);
      reject(new Error(`Element with selector "${selector}" not found within ${timeout}ms.`));
    }, timeout);
  });
}


function renderGroupedAssignments(assignments) {
  const container = document.createElement("div");
  container.style.padding = "8px";

  const heading = document.createElement("h3");
  heading.textContent = `Scraped Items (total: ${assignments.length}):`;
  container.appendChild(heading);

  const list = document.createElement("ul");
  assignments.forEach(a => {
    const li = document.createElement("li");
    li.textContent = `${a.title} — due: ${a.dueDate || "no due date"}`;
    list.appendChild(li);
  });
  container.appendChild(list);

  sidebar.appendChild(container);
}


function isOnCoursePage() {
  // Check multiple indicators that we're on a course page
  const indicators = [
    '.course-content',           
    '#page-header h1',          
    '.page-header-headings h1', 
    '[data-region="blocks-column"]', 
    '.section.main',            
    '[role="main"] .course-content', 
    '.course-header',           
    '#region-main .course-content', 
    '.path-course-view',        
    '[data-course-id]'          
  ];
  
  // Also check URL patterns
  const urlIndicators = [
    /\/course\/view\.php\?id=\d+/,     
    /\/course\/index\.php/,
    /\/my\//                           
  ];
  
  // Check DOM selectors
  const hasCourseElements = indicators.some(selector => {
    try {
      return document.querySelector(selector) !== null;
    } catch (e) {
      return false;
    }
  });
  
  // Check URL patterns
  const hasValidUrl = urlIndicators.some(pattern => pattern.test(window.location.href));
  
  // Also check if we're on a Moodle page at all
  const isMoodlePage = window.location.href.includes('tbl.umak.edu.ph');
  
  console.log('Course page detection:', {
    hasCourseElements,
    hasValidUrl,
    isMoodlePage,
    currentUrl: window.location.href,
    foundElements: indicators.filter(sel => {
      try { return document.querySelector(sel); } catch { return false; }
    })
  });
  
  return hasCourseElements || (hasValidUrl && isMoodlePage);
}

function generateSimpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString();
}

async function performFullScrape() {
  const courseLinks = Array.from(
    document.querySelectorAll('a[href*="/course/view.php?id="]')
  ).map(a => a.href).filter((v, i, arr) => arr.indexOf(v) === i);

  const allAssignments = [];
  if (window.logToSidebar) window.logToSidebar(`Found ${courseLinks.length} course pages to scan...`);

  for (const link of courseLinks) {
    try {
      const html = await fetch(link, { credentials: "include" }).then(r => r.text());
      const dom = new DOMParser().parseFromString(html, "text/html");
      const assignments = await Promise.resolve(extractAssignmentsFromDom(dom));
      allAssignments.push(...assignments);
    } catch (e) {
      console.error("❌ Failed to fetch or parse course", link, e);
      if (window.logToSidebar) window.logToSidebar(`❌ Failed to scan course: ${link}`, "error");
    }
  }

  return allAssignments;
}

// fetch all courses and scrape 
async function scrapeAllCourses() {
  // 1. Find the main container for all the course listings on the page.
const contentArea = document.querySelector('[data-region="card-deck"]');
  // If we can't find that specific area, we can't cache reliably, so just do a full scrape.
  if (!contentArea) {
    console.warn("Main course container not found. Performing a full scrape without caching.");
    return performFullScrape();
  }

  // 2. Create a "fingerprint" of the current content.
  const currentHash = generateSimpleHash(contentArea.innerHTML);
  
  // 3. Check for a saved fingerprint and saved results from this session.
  const cachedHash = sessionStorage.getItem('moodleContentHash');
  const cachedAssignmentsJSON = sessionStorage.getItem('cachedAssignments');

  // 4. If the fingerprint matches and we have saved data, return it instantly.
  if (cachedHash === currentHash && cachedAssignmentsJSON) {
    console.log("✅ Content is unchanged. Returning cached results.");
    if (window.logToSidebar) window.logToSidebar("✅ Content unchanged, using cache for speed.");
    return JSON.parse(cachedAssignmentsJSON);
  }

  // 5. If anything has changed, perform a full, deep scrape.
  console.log("Content has changed. Performing a full scrape.");
  if (window.logToSidebar) window.logToSidebar("🔎 Content has changed, performing a deep scan...");

  const allAssignments = await performFullScrape();

  // 6. Update the cache with the new results and the new fingerprint.
  sessionStorage.setItem('moodleContentHash', currentHash);
  sessionStorage.setItem('cachedAssignments', JSON.stringify(allAssignments));
  console.log("Cache updated.");
  
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
  // Remove the course page detection from here since we check it beforehand
  
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
          /Due\s*:?:?\s*([A-Za-z]+,?\s+\d{1,2}\s+[A-ZaZ]+\s+\d{4},?\s*\d{1,2}:\d{2}\s*[APMapm]{2})/i,
          /Due\s*:?:?\s*([A-Za-z]+,?\s+\d{1,2}\s+[A-ZaZ]+\s+\d{4})/i,
          /Due\s*:?:?\s*([\d]{4}-[\d]{2}-[\d]{2})/i,
          /The due date is (?:on )?([A-Za-z]+,? [A-ZaZ]+ \d{1,2}, \d{4},? \d{1,2}:\d{2} ?[APMapm]{2})/i,
          /The due date is (?:on )?([A-Za-z]+,? [A-ZaZ]+ \d{1,2}, \d{4})/i
        ];
        for (const re of extraPatterns) {
          const m = text.match(re);
          if (m) {
            dueDate = m[1];
            break;
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

  // Wait for forum fetches to resolve before continuing
  let forumPromise = null;
  if (forumPromises.length) {
    forumPromise = Promise.all(forumPromises).then(results => {
      results.forEach(node => {
        if (node) candidates.add(node);
      });
    });
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


// smart status detection
function getCompletionStatus(node, activityType = '', url = '') {
  // Manual completion button logic (unchanged)
  const btn = node.querySelector('[data-action="toggle-manual-completion"]');
  if (btn) {
    const text = (btn.textContent || '').toLowerCase();
    const toggle = (btn.getAttribute('data-toggletype') || '').toLowerCase();
    const title = (btn.getAttribute('title') || '').toLowerCase();

    if (text.includes('mark as done') || toggle.includes('manual:mark') || title.includes('mark as done')) return 'Pending';
    if (text.includes('done') || toggle.includes('undo') || title.includes('marked as done') || title.includes('press to undo')) return 'Completed';
  }

  // If no manual button, check assignment/quiz page for submission status 
  if ((activityType === 'assign' || activityType === 'quiz') && url) {
    return fetch(url, { credentials: 'include' })
      .then(r => r.text())
      .then(html => {
        // Parse the HTML and look for the "Submission status" row
        const doc = new DOMParser().parseFromString(html, "text/html");
        const rows = doc.querySelectorAll('table.generaltable tr');
        for (const row of rows) {
          const th = row.querySelector('th');
          const td = row.querySelector('td');
          if (th && td && th.textContent.trim().toLowerCase() === 'submission status') {
            const statusText = td.textContent.trim().toLowerCase();
            if (statusText.includes('submitted for grading')) {
              return 'Completed';
            }
            // You can add more checks here for other "completed" statuses if needed
            return 'Pending';
          }
        }
        // Fallback: if "Submission status" row not found, use old keyword logic
        if (/submitted|done|completed/.test(html.toLowerCase())) {
          return 'Completed';
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
      /Open(?:ing)?\s*:?\s*([A-Za-z]+,?\s+\d{1,2}\s+[A-ZaZ]+\s+\d{4})/i,
      /Open(?:ing)?\s*:?\s*([\d]{4}-[\d]{2}-[\d]{2})/i,
      /Available from\s*:?\s*([A-Za-z]+,?\s+\d{1,2}\s+[A-Za-z]+\s+\d{4},?\s*\d{1,2}:\d{2}\s*[APMapm]{2})/i,
      /Available from\s*:?\s*([A-Za-z]+,?\s+\d{1,2}\s+[A-ZaZ]+\s+\d{4})/i,
      /Available from\s*:?\s*([\d]{4}-[\d]{2}-[\d]{2})/i,
      /Opens\s*:?\s*([A-Za-z]+,?\s+\d{1,2}\s+[A-Za-z]+\s+\d{4},?\s*\d{1,2}:\d{2}\s*[APMapm]{2})/i,
      /Opens\s*:?\s*([A-Za-z]+,?\s+\d{1,2}\s+[A-ZaZ]+\s+\d{4})/i,
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


document.addEventListener('keydown', (e) => {
  // Ctrl+Shift+L to open sidebar and log a test message
  if (e.ctrlKey && e.shiftKey && e.key === 'L') {
    ensureSidebar();
    logToSidebar('Sidebar opened via Ctrl+Shift+L');
  }
});

// Add this listener to the end of content.js

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'RESET_STATE') {
    console.log("Resetting content script state...");
    if (window.logToSidebar) window.logToSidebar("🔄 State and cache have been reset.");

    // 1. Clear the session cache used for fast re-scraping
    sessionStorage.removeItem('moodleContentHash');
    sessionStorage.removeItem('cachedAssignments');

    // 2. Find the scrape button and reset its text and state
    const btn = document.getElementById("moodle-scrape-btn");
    if (btn) {
      window.scrapedState = false;
      btn.textContent = "⟳ Scrape";
      console.log("UI button has been reset.");
    }
    
    sendResponse({ ok: true });
  }
});

function qs(root, sel) { return (root || document).querySelector(sel); }
function qsa(root, sel) { return Array.from((root || document).querySelectorAll(sel)); }


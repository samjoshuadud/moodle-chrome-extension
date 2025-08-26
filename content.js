// Minimal Moodle DOM scraper placeholder

async function extractAssignmentsFromDom() {
  const nodes = Array.from(document.querySelectorAll(".activity, .assignment"));
  const items = nodes.map(node => {
    const title = node.querySelector(".instancename, a")?.textContent?.trim() || "";
    const course = document.querySelector("#page-header h1, .page-header-headings h1")?.textContent?.trim() || "";
    const url = node.querySelector("a")?.href || location.href;

    // Try to locate due text
    const text = node.textContent || "";
    const dueMatch = text.match(/due\s*:?\s*([A-Za-z]{3,}\s+\d{1,2},\s+\d{4})/i);
    const dueDate = dueMatch ? new Date(dueMatch[1]).toISOString().slice(0,10) : "";

    return normalizeAssignment({ title, raw_title: title, course, url, due_date: dueDate });
  }).filter(Boolean);

  return items;
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



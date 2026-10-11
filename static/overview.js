// Sano AI Overview - live backend data, no mock numbers.
// APIs: GET /api/overview, GET /api/wellness?range=7d|30d
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const sidebar = $("#sidebar");
const backdrop = $("#sidebarBackdrop");
const toast = $("#toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

// Mobile sidebar
$("#openSidebar").addEventListener("click", () => {
  sidebar.classList.add("open");
  backdrop.classList.add("visible");
});
function closeSidebar() {
  sidebar.classList.remove("open");
  backdrop.classList.remove("visible");
}
$("#closeSidebar").addEventListener("click", closeSidebar);
backdrop.addEventListener("click", closeSidebar);
$$(".nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    if (window.innerWidth <= 720) closeSidebar();
  });
});

// Current date
$("#todayDate").textContent = new Date().toLocaleDateString("en-IN", {
  weekday: "short", day: "numeric", month: "short", year: "numeric",
});

// User name from login session
try {
  const u = JSON.parse(
    localStorage.getItem("sano_user") || sessionStorage.getItem("sano_user") || "null"
  );
  const nm = u?.name || localStorage.getItem("sano_user_name") || sessionStorage.getItem("sano_user_name");
  if (nm) $("#userName").textContent = String(nm).split(" ")[0];
} catch {}

// Profile menu
$("#profileButton").addEventListener("click", () => {
  $("#profileMenu").classList.toggle("hidden");
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".top-actions")) $("#profileMenu").classList.add("hidden");
});

// Notifications
$("#notificationsButton").addEventListener("click", () => {
  showToast("You're all caught up.");
});

// Search and navigation (backend routes, no .html files)
$("#globalSearch").addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const query = event.currentTarget.value.trim().toLowerCase();
  if (!query) return;
  if (query.includes("copilot") || query.includes("ask") || query.includes("question")) {
    window.location.href = "/copilot";
  } else if (query.includes("medication") || query.includes("medicine")) {
    window.location.href = "/";
  } else if (query.includes("record") || query.includes("report")) {
    window.location.href = "/records";
  } else if (query.includes("wellness") || query.includes("sleep") || query.includes("step")) {
    $(".wellness-panel").scrollIntoView({ behavior: "smooth" });
  } else {
    showToast("No matching section found.");
  }
});

// Summary cards (backend routes)
$$(".stat-card").forEach((card) => {
  card.addEventListener("click", () => {
    const target = card.dataset.target;
    if (target === "medications") window.location.href = "/";
    else if (target === "records") window.location.href = "/records";
    else if (target === "wellness") $(".wellness-panel").scrollIntoView({ behavior: "smooth" });
    else if (target === "appointments") window.location.href = "/";
    else showToast("Section coming soon.");
  });
});

// Live stats + insights from backend (no mock numbers)
async function loadOverview() {
  try {
    const r = await fetch("/api/overview");
    if (!r.ok) throw new Error("overview");
    const o = await r.json();
    $("#statRecords").textContent = o.total_records ?? "0";
    $("#statRecordsSub").textContent = `${o.total_records ?? 0} total`;
    $("#statMeds").textContent = o.active_meds_count ?? "0";
    $("#statMedsSub").textContent = `${o.active_meds_count ?? 0} active`;
    $("#statAppts").textContent = o.upcoming_count ?? "0";
    const ap = document.getElementById("statApptsSub");
    if (ap) ap.textContent = `${o.upcoming_count ?? 0} upcoming`;
    $("#statSleep").textContent = o.avg_sleep ? `${o.avg_sleep} hrs` : "–";
    const list = $("#insightList");
    if (Array.isArray(o.insights) && o.insights.length) {
      list.innerHTML = o.insights.slice(0, 3).map((i) =>
        `<div class="insight-item"><div class="insight-icon green-icon">✦</div>
         <div><h3>${String(i.title ?? "Insight")}</h3><p>${String(i.desc ?? "")}</p></div></div>`
      ).join("");
    } else {
      list.innerHTML = `<div class="insight-item"><div class="insight-icon green-icon">✦</div>
        <div><h3>No new insights yet</h3><p>Upload a record to generate highlights.</p></div></div>`;
    }
  } catch (e) {
    console.warn("overview API failed", e);
    for (const [id, v] of [["statRecords", "0"], ["statMeds", "0"], ["statAppts", "0"]]) {
      const el = document.getElementById(id);
      if (el && (el.textContent === "–" || el.textContent === "")) el.textContent = v;
    }
  }
}

// Live wellness chart from backend (no static chartData)
let currentMetric = "steps";
const keyMap = { steps: "steps", sleep: "sleep_hrs", heart: "heart_rate" };
const fmtMap = {
  steps: (v) => `${Number(v).toLocaleString("en-US")} steps`,
  sleep: (v) => `${Number(v).toFixed(1)} hours`,
  heart: (v) => `${v} bpm`,
};
const yMap = {
  steps: ["15K", "10K", "5K", "0"],
  sleep: ["12h", "8h", "4h", "0"],
  heart: ["120", "80", "40", "0"],
};
const labelMap = { steps: "Avg. Steps", sleep: "Avg. Sleep", heart: "Avg. Heart Rate" };

async function renderChart() {
  const range = $("#rangeSelect").value; // 7|14|30
  const q = range === "30" ? "30d" : "7d";
  let rows = [];
  try {
    const r = await fetch(`/api/wellness?range=${q}`);
    if (!r.ok) throw new Error("wellness");
    const w = await r.json();
    rows = w.series || [];
    const avgSteps = w.avg_steps, avgSleep = w.avg_sleep, avgWater = w.avg_water;
    $("#metricLabel").textContent = labelMap[currentMetric];
    if (currentMetric === "steps") $("#metricAverage").textContent = Number(avgSteps || 0).toLocaleString("en-US");
    if (currentMetric === "sleep") $("#metricAverage").textContent = avgSleep ? `${avgSleep} hrs` : "–";
    if (currentMetric === "heart") $("#metricAverage").textContent = w.avg_hr ? `${w.avg_hr} bpm` : "–";
    $("#miniSleep").textContent = avgSleep ? `${avgSleep} hrs` : "–";
    $("#miniWater").textContent = avgWater ? `${avgWater} L` : "–";
  } catch (e) {
    console.warn("wellness API failed", e);
  }
  const key = keyMap[currentMetric];
  const vals = rows.map((r) => Number(r[key] || 0));
  const labels = rows.map((r) => String(r.date || "").slice(5) || "–");
  while (vals.length < 7) { vals.unshift(0); labels.unshift("–"); }
  const view = vals.slice(-7), lab = labels.slice(-7);
  const max = Math.max(...view, 1);
  const peak = view.indexOf(Math.max(...view));
  $("#yLabels").innerHTML = yMap[currentMetric].map((l) => `<span>${l}</span>`).join("");
  $("#barChart").innerHTML = view.map((value, index) => {
    const height = Math.max(4, Math.min(100, (value / max) * 100));
    const selected = index === peak && value > 0 ? " selected" : "";
    const formatted = fmtMap[currentMetric](value);
    return `<div class="bar-column${selected}">
      <div class="bar" style="height:${height}%" data-value="${formatted}" title="${formatted}"></div>
      <span class="bar-label">${lab[index]}</span></div>`;
  }).join("");
}

// Chart tabs
$$(".chart-tab").forEach((button) => {
  button.addEventListener("click", () => {
    $$(".chart-tab").forEach((tab) => tab.classList.remove("active"));
    button.classList.add("active");
    currentMetric = button.dataset.metric;
    renderChart();
  });
});
$("#rangeSelect").addEventListener("change", renderChart);

// Checklist progress
const checklist = $$(".check-row input");
function updateProgress() {
  const completed = checklist.filter((input) => input.checked).length;
  $("#progressBar").style.width = `${(completed / checklist.length) * 100}%`;
  $("#progressCaption").textContent = `${completed} of ${checklist.length} completed`;
}
checklist.forEach((input) => input.addEventListener("change", updateProgress));
updateProgress();

loadOverview();
renderChart();

"use strict";

const $ = (selector) => document.querySelector(selector);

const state = {
  steps: 0,
  sleep: null,
  water: 0,
  active: 0,
  goals: {
    steps: 8000,
    sleep: 9,
    water: 2,
    active: 30
  },
  logs: [],
  weekly: {
    steps: [4200, 6100, 5300, 7400, 6800, 8100, 0],
    active: [15, 25, 20, 35, 30, 40, 0],
    water: [1.2, 1.5, 1.3, 1.8, 1.6, 2, 0]
  }
};

const todayKey = (() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
})();

const STORAGE_KEY = `sano_wellness_${todayKey}`;

function loadLocalData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved) return;

    ["steps", "water", "active"].forEach((key) => {
      if (Number.isFinite(saved[key]) && saved[key] >= 0) {
        state[key] = saved[key];
      }
    });

    if (Number.isFinite(saved.sleep) && saved.sleep >= 0) {
      state.sleep = saved.sleep;
    }

    if (Array.isArray(saved.logs)) state.logs = saved.logs;

    if (saved.goals) {
      ["steps", "sleep", "water", "active"].forEach((key) => {
        if (Number.isFinite(saved.goals[key]) && saved.goals[key] > 0) {
          state.goals[key] = saved.goals[key];
        }
      });
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveLocalData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Backend sync: seed today + weekly chart from GET /api/wellness (same-origin, Nimbus-ready).
// Static weekly above stays as offline fallback only.
async function loadBackendData() {
  try {
    const r = await fetch("/api/wellness?range=7d");
    if (!r.ok) return;
    const w = await r.json();
    const rows = w.series || [];
    if (!rows.length) return;
    const today = rows[rows.length - 1];
    // Only seed values the user hasn't already logged locally today.
    if (!state.steps && today.steps) state.steps = today.steps;
    if (state.sleep === null && today.sleep_hrs) state.sleep = today.sleep_hrs;
    if (!state.water && today.water_l) state.water = today.water_l;
    if (!state.active && today.steps) state.active = Math.round(today.steps / 250);
    const last7 = rows.slice(-7);
    if (last7.length) {
      state.weekly.steps = last7.map((x) => Number(x.steps || 0));
      state.weekly.water = last7.map((x) => Number(x.water_l || 0));
      state.weekly.active = last7.map((x) => Math.round(Number(x.steps || 0) / 250));
    }
  } catch {
    // Offline: keep static fallback + local data.
  }
}

// Persist steps/sleep/water entries to backend so dashboard + overview stay in sync.
function syncEntryToBackend(type, value) {
  const payload = { date: todayKey };
  if (type === "steps") payload.steps = Math.round(value);
  else if (type === "sleep") payload.sleep_hrs = value;
  else if (type === "water") payload.water_l = value;
  else return; // active minutes are derived locally
  fetch("/api/wellness", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

function showToast(message) {
  let toast = $("#toastMessage");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toastMessage";
    toast.setAttribute("role", "status");
    Object.assign(toast.style, {
      position: "fixed",
      right: "20px",
      bottom: "20px",
      zIndex: "100",
      padding: "14px 18px",
      borderRadius: "11px",
      background: "#08704b",
      color: "#fff",
      fontSize: "13px"
    });
    document.body.append(toast);
  }

  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, 2500);
}

function setProgress(selector, value, goal) {
  const percent = goal > 0 ? Math.min(100, value / goal * 100) : 0;
  $(selector).style.width = `${percent}%`;
  return percent;
}

function formatNumber(value) {
  return Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function renderDashboard() {
  $("#stepsValue").textContent = formatNumber(state.steps);
  $("#stepsGoalLabel").textContent = formatNumber(state.goals.steps);
  $("#sleepValue").textContent = state.sleep === null ? "—" : formatNumber(state.sleep);
  $("#waterValue").textContent = formatNumber(state.water);
  $("#waterGoalLabel").textContent = `${formatNumber(state.goals.water)} L`;
  $("#activeValue").textContent = formatNumber(state.active);

  const stepsPercent = setProgress("#stepsProgress", state.steps, state.goals.steps);
  const sleepPercent = setProgress("#sleepProgress", state.sleep || 0, state.goals.sleep);
  const waterPercent = setProgress("#waterProgress", state.water, state.goals.water);
  const activePercent = setProgress("#activeProgress", state.active, state.goals.active);

  $("#stepsProgressText").textContent = `${Math.round(stepsPercent)}% of daily goal`;
  $("#sleepProgressText").textContent = state.sleep === null
    ? "No personal entry yet"
    : `${Math.round(sleepPercent)}% of sleep goal`;
  $("#waterProgressText").textContent = `${Math.round(waterPercent)}% of personal goal`;
  $("#activeProgressText").textContent = `${Math.round(activePercent)}% of daily goal`;

  $("#goalStepsText").textContent = `${formatNumber(state.steps)} / ${formatNumber(state.goals.steps)} steps`;
  $("#goalSleepText").textContent = state.sleep === null
    ? "Not logged"
    : `${formatNumber(state.sleep)} / ${formatNumber(state.goals.sleep)} hrs`;
  $("#goalWaterText").textContent = `${formatNumber(state.water)} / ${formatNumber(state.goals.water)} L`;
  $("#goalActiveText").textContent = `${formatNumber(state.active)} / ${formatNumber(state.goals.active)} min`;

  setProgress("#goalStepsBar", state.steps, state.goals.steps);
  setProgress("#goalSleepBar", state.sleep || 0, state.goals.sleep);
  setProgress("#goalWaterBar", state.water, state.goals.water);
  setProgress("#goalActiveBar", state.active, state.goals.active);

  const complete = [
    state.steps >= state.goals.steps,
    state.sleep !== null && state.sleep >= state.goals.sleep,
    state.water >= state.goals.water,
    state.active >= state.goals.active
  ].filter(Boolean).length;

  $("#goalsComplete").textContent = `${complete}/4`;
  renderActivityLog();
  renderChart();
}

function getTypeInfo(type) {
  return {
    steps: { label: "Steps", unit: "steps", icon: "⌁", className: "" },
    sleep: { label: "Sleep", unit: "hrs", icon: "☾", className: "sleep" },
    water: { label: "Water intake", unit: "L", icon: "♧", className: "water" },
    active: { label: "Active time", unit: "min", icon: "◷", className: "active" }
  }[type];
}

function renderActivityLog() {
  const container = $("#activityLog");
  container.replaceChildren();

  const logs = [...state.logs].reverse();
  $("#logEmpty").hidden = logs.length > 0;

  logs.forEach((log) => {
    const info = getTypeInfo(log.type);
    if (!info) return;

    const item = document.createElement("div");
    item.className = "log-item";

    const icon = document.createElement("div");
    icon.className = `log-icon ${info.className}`;
    icon.textContent = info.icon;

    const copy = document.createElement("div");
    copy.className = "log-copy";

    const title = document.createElement("strong");
    title.textContent = log.note || info.label;

    const subtitle = document.createElement("small");
    subtitle.textContent = `${info.label} · ${new Date(log.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    })}`;

    copy.append(title, subtitle);

    const amount = document.createElement("span");
    amount.className = "log-amount";
    amount.textContent = `${formatNumber(log.value)} ${info.unit}`;

    const remove = document.createElement("button");
    remove.className = "delete-entry";
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove ${info.label} entry`);
    remove.addEventListener("click", () => {
      const index = state.logs.findIndex((entry) => entry.id === log.id);
      if (index < 0) return;

      const removed = state.logs[index];
      if (removed.type === "sleep") {
        state.sleep = null;
      } else {
        state[removed.type] = Math.max(0, state[removed.type] - removed.value);
      }

      state.logs.splice(index, 1);
      saveLocalData();
      renderDashboard();
      showToast("Entry removed.");
    });

    item.append(icon, copy, amount, remove);
    container.append(item);
  });
}

function renderChart() {
  const metric = $("#chartMetric").value;
  const values = state.weekly[metric];
  const chart = $("#activityChart");
  chart.replaceChildren();

  const max = Math.max(...values, 1);
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  $("#chartLegendLabel").textContent = {
    steps: "Daily steps",
    active: "Active minutes",
    water: "Water intake (L)"
  }[metric];

  values.forEach((value, index) => {
    const column = document.createElement("div");
    column.className = `chart-column ${index === 6 ? "today" : ""}`;

    const number = document.createElement("span");
    number.className = "chart-value";
    number.textContent = metric === "water" ? `${value}L` : formatNumber(value);

    const bar = document.createElement("div");
    bar.className = "chart-bar";
    bar.style.height = `${Math.max(2, value / max * 100)}%`;
    bar.title = `${labels[index]}: ${value}`;

    column.append(number, bar);
    chart.append(column);
  });
}

function openModal(modal) {
  $("#overlay").hidden = false;
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeModal() {
  $("#entryModal").hidden = true;
  $("#goalsModal").hidden = true;
  $("#overlay").hidden = true;
  document.body.classList.remove("modal-open");
}

function showFormError(selector, message) {
  const box = $(selector);
  box.textContent = message;
  box.hidden = false;
}

function updateEntryForm(type) {
  const options = {
    steps: ["Log steps", "Steps today", 100000, 1],
    sleep: ["Log sleep", "Hours slept", 16, 0.5],
    water: ["Log water", "Water intake (litres)", 10, 0.25],
    active: ["Log activity", "Active minutes", 600, 1]
  };

  const [title, label, max, step] = options[type] || options.steps;

  $("#entryTitle").textContent = title;
  $("#entryValueLabel").textContent = label;
  $("#entryValue").max = max;
  $("#entryValue").step = step;
  $("#entryValue").value = "";
  $("#entryNote").value = "";
  $("#entryMessage").hidden = true;
  $("#entryType").value = type;

  openModal($("#entryModal"));
  $("#entryValue").focus();
}

document.querySelectorAll("[data-open]").forEach((button) => {
  button.addEventListener("click", () => updateEntryForm(button.dataset.open));
});

$("#addActivityButton").addEventListener("click", () => updateEntryForm("active"));

$("#entryType").addEventListener("change", () => {
  updateEntryForm($("#entryType").value);
});

$("#entryForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const type = $("#entryType").value;
  const value = Number($("#entryValue").value);
  const note = $("#entryNote").value.trim();

  if (!Number.isFinite(value) || value < 0 || value > Number($("#entryValue").max)) {
    showFormError("#entryMessage", "Enter a valid value within the allowed range.");
    return;
  }

  if (type === "sleep") {
    state.sleep = value;
  } else {
    state[type] = Math.round((state[type] + value) * 100) / 100;
  }

  state.logs.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    value,
    note,
    createdAt: new Date().toISOString()
  });

  saveLocalData();
  syncEntryToBackend(type, value);
  renderDashboard();
  closeModal();
  showToast("Entry saved.");
});

$("#chartMetric").addEventListener("change", renderChart);

$("#editGoalsButton").addEventListener("click", () => {
  $("#goalStepsInput").value = state.goals.steps;
  $("#goalSleepInput").value = state.goals.sleep;
  $("#goalWaterInput").value = state.goals.water;
  $("#goalActiveInput").value = state.goals.active;
  $("#goalsMessage").hidden = true;
  openModal($("#goalsModal"));
});

$("#goalsForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const goals = {
    steps: Number($("#goalStepsInput").value),
    sleep: Number($("#goalSleepInput").value),
    water: Number($("#goalWaterInput").value),
    active: Number($("#goalActiveInput").value)
  };

  if (
    goals.steps < 100 || goals.steps > 100000 ||
    goals.sleep < 4 || goals.sleep > 16 ||
    goals.water < 0.25 || goals.water > 10 ||
    goals.active < 5 || goals.active > 600
  ) {
    showFormError("#goalsMessage", "Please check the goal values.");
    return;
  }

  state.goals = goals;
  saveLocalData();
  renderDashboard();
  closeModal();
  showToast("Goals updated.");
});

$("#closeEntry").addEventListener("click", closeModal);
$("#cancelEntry").addEventListener("click", closeModal);
$("#closeGoals").addEventListener("click", closeModal);
$("#cancelGoals").addEventListener("click", closeModal);
$("#overlay").addEventListener("click", closeModal);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal();
    $("#profileMenu").hidden = true;
    $("#sidebar").classList.remove("open");
  }
});

$("#menuButton").addEventListener("click", () => {
  $("#sidebar").classList.toggle("open");
});

$("#profileButton").addEventListener("click", () => {
  $("#profileMenu").hidden = !$("#profileMenu").hidden;
});

// Logout (exists in HTML, previously unwired): clear session -> login page.
document.getElementById("logoutButton").addEventListener("click", () => {
  localStorage.removeItem("sano_token");
  sessionStorage.removeItem("sano_token");
  localStorage.removeItem("sano_user");
  sessionStorage.removeItem("sano_user");
  window.location.assign("/login");
});

$("#globalSearch").addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;

  const query = event.currentTarget.value.toLowerCase();
  const type = ["steps", "sleep", "water", "activity", "active"]
    .find((word) => query.includes(word));

  if (type) {
    updateEntryForm(type === "activity" ? "active" : type);
  }
});

async function initializePage() {
  const now = new Date();

  $("#todayDate").textContent = now.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  // Prefer logged-in session; fall back to defaults.
  let sessionUser = null;
  try {
    sessionUser = JSON.parse(
      localStorage.getItem("sano_user") || sessionStorage.getItem("sano_user") || "null"
    );
  } catch {}
  if (sessionUser?.name) {
    $("#profileName").textContent = sessionUser.name;
    const em = document.getElementById("profileEmail");
    if (em) em.textContent = sessionUser.email || "";
    $("#profileButton").textContent = sessionUser.name[0].toUpperCase();
  } else {
    $("#profileName").textContent = "My Wellness";
    $("#profileButton").textContent = "W";
  }

  loadLocalData();
  renderDashboard();
  await loadBackendData();
  renderDashboard();
}

initializePage();

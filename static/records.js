"use strict";

// Same-origin so Nimbus single-deploy works (backend serves frontend + API).
const API_BASE_URL = "";

const $ = (selector) => document.querySelector(selector);

let records = [];
let selectedCategory = "All Records";
let isLoading = false;

// Backend uses type codes; UI uses display categories.
const TYPE_TO_CAT = {
  lab_report: "Lab Reports",
  prescription: "Prescriptions",
  imaging: "Imaging",
  doctor_notes: "Doctor Notes",
  other: "Other",
};
const CAT_TO_TYPE = {
  "Lab Reports": "lab_report",
  "Prescriptions": "prescription",
  "Imaging": "imaging",
  "Doctor Notes": "doctor_notes",
  "Other": "other",
};
function toUI(r) {
  return { ...r, category: TYPE_TO_CAT[r.type] || r.category || "Other" };
}

// Offline fallback only (used when API unreachable, not as default).
const demoRecords = [
  { id: "demo-1", title: "Complete Blood Count (CBC)", category: "Lab Reports", date: "2025-05-12", status: "Normal" },
  { id: "demo-2", title: "Lipid Profile", category: "Lab Reports", date: "2025-04-28", status: "Needs Attention" },
  { id: "demo-3", title: "Chest X-Ray", category: "Imaging", date: "2025-04-15", status: "Normal" },
  { id: "demo-4", title: "Prescription - Blood Pressure", category: "Prescriptions", date: "2025-04-10", status: "Active" },
  { id: "demo-5", title: "Vitamin D Test", category: "Lab Reports", date: "2025-03-05", status: "Low" },
  { id: "demo-6", title: "Doctor Consultation Notes", category: "Doctor Notes", date: "2025-02-20", status: "Normal" },
];

function getToken() {
  return localStorage.getItem("sano_token") ||
    sessionStorage.getItem("sano_token");
}

function showError(message) {
  $("#loadingState").hidden = true;
  $("#errorState").hidden = false;
  $("#errorMessage").textContent = message;
}

async function apiRequest(path, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    throw new Error("Session expired or token is invalid.");
  }

  if (!response.ok) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "The server could not complete your request."
    );
  }

  return data;
}

function formatDate(value) {
  if (!value) return "Date not provided";

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (match) {
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    ).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("en-IN");
}

function getIcon(category) {
  const value = String(category || "").toLowerCase();

  if (value.includes("lab")) {
    return { icon: "♧", className: "green" };
  }

  if (value.includes("prescription")) {
    return { icon: "✚", className: "prescription" };
  }

  if (value.includes("imaging")) {
    return { icon: "▧", className: "imaging" };
  }

  if (value.includes("doctor") || value.includes("note")) {
    return { icon: "▤", className: "notes" };
  }

  return { icon: "▧", className: "other" };
}

function getStatusClass(status) {
  const value = String(status || "").toLowerCase();

  if (value === "normal") return "normal";
  if (value === "active") return "active";
  if (value === "low") return "low";

  return "attention";
}

function renderStats() {
  $("#totalRecords").textContent = records.length;

  $("#labCount").textContent = records.filter(
    (r) => r.category === "Lab Reports"
  ).length;

  $("#prescriptionCount").textContent = records.filter(
    (r) => r.category === "Prescriptions"
  ).length;

  $("#attentionCount").textContent = records.filter(
    (r) => ["Needs Attention", "Low"].includes(r.status)
  ).length;
}

function getFilteredRecords() {
  const query = $("#recordSearch").value.trim().toLowerCase();
  const status = $("#statusFilter").value;

  let result = records.filter((record) => {
    const categoryMatch = selectedCategory === "All Records" ||
      String(record.category).toLowerCase() ===
      selectedCategory.toLowerCase();

    const queryMatch = !query ||
      `${record.title} ${record.category} ${record.status}`
        .toLowerCase()
        .includes(query);

    const statusMatch = status === "all" ||
      String(record.status).toLowerCase() === status.toLowerCase();

    return categoryMatch && queryMatch && statusMatch;
  });

  if ($("#sortOrder").value === "latest") {
    result.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  } else if ($("#sortOrder").value === "oldest") {
    result.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  } else {
    result.sort((a, b) => a.title.localeCompare(b.title));
  }

  return result;
}

function openDetails(record) {
  $("#detailTitle").textContent = record.title;
  $("#detailSubtitle").textContent =
    `${record.category} · ${formatDate(record.date)}`;

  const content = $("#detailContent");
  content.replaceChildren();

  [
    ["Record title", record.title],
    ["Category", record.category],
    ["Date", formatDate(record.date)],
    ["Status", record.status]
  ].forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "detail-item";

    const name = document.createElement("span");
    name.textContent = label;

    const text = document.createElement("strong");
    text.textContent = value || "Not available";

    item.append(name, text);
    content.append(item);
  });

  $("#recordModal").hidden = true;
  $("#detailModal").hidden = false;
  $("#overlay").hidden = false;
  document.body.classList.add("modal-open");
}

function renderRecords() {
  const container = $("#recordsContainer");
  const filtered = getFilteredRecords();

  container.replaceChildren();

  filtered.forEach((record) => {
    const row = document.createElement("article");
    row.className = "record-row";

    const info = document.createElement("div");
    info.className = "record-info";

    const iconData = getIcon(record.category);

    const icon = document.createElement("div");
    icon.className = `record-icon ${iconData.className}`;
    icon.textContent = iconData.icon;

    const text = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = record.title;

    const subtitle = document.createElement("p");
    subtitle.textContent =
      `${record.category.replace(" Reports", " Report")} · ${formatDate(record.date)}`;

    text.append(title, subtitle);
    info.append(icon, text);

    const badge = document.createElement("span");
    badge.className = `status ${getStatusClass(record.status)}`;
    badge.textContent = record.status;

    const view = document.createElement("button");
    view.className = "row-action";
    view.type = "button";
    view.textContent = "View";
    view.addEventListener("click", () => openDetails(record));

    row.append(info, badge, view);
    container.append(row);
  });

  $("#emptyState").hidden = filtered.length > 0;
  $("#recordsContainer").hidden = filtered.length === 0;
  $("#resultsSummary").textContent =
    `${filtered.length} record${filtered.length === 1 ? "" : "s"} found`;
  $("#footerCount").textContent =
    `${filtered.length} record${filtered.length === 1 ? "" : "s"}`;

  renderStats();
}

async function loadRecords() {
  if (isLoading) return;
  isLoading = true;

  $("#loadingState").hidden = false;
  $("#errorState").hidden = true;

  try {
    // Live API first (backend is open, no token required).
    const data = await apiRequest("/api/records");
    if (!Array.isArray(data)) {
      throw new Error("Unexpected response from the records API.");
    }
    records = data.map(toUI);
    $("#loadingState").hidden = true;
    $("#errorState").hidden = true;
    renderRecords();
  } catch (error) {
    console.error("Records loading error:", error);
    // Offline fallback: sample records so UI stays usable.
    if (!records.length) records = demoRecords.map((record) => ({ ...record }));
    $("#loadingState").hidden = true;
    if (records.length) {
      $("#errorState").hidden = true;
      renderRecords();
    } else {
      showError(error.message);
    }
  } finally {
    isLoading = false;
  }
}

function showModal() {
  $("#recordForm").reset();
  $("#recordDate").value = new Date().toLocaleDateString("en-CA");
  $("#formMessage").hidden = true;
  $("#detailModal").hidden = true;
  $("#recordModal").hidden = false;
  $("#overlay").hidden = false;
  document.body.classList.add("modal-open");
  $("#recordTitle").focus();
}

function closeModal() {
  $("#recordModal").hidden = true;
  $("#detailModal").hidden = true;
  $("#overlay").hidden = true;
  document.body.classList.remove("modal-open");
}

function showFormMessage(message, success = false) {
  const element = $("#formMessage");
  element.textContent = message;
  element.hidden = false;
  element.style.background = success ? "#eaf8ef" : "#fff1ef";
  element.style.color = success ? "#126b43" : "#a52f2a";
}

async function saveRecord(event) {
  event.preventDefault();

  const payload = {
    title: $("#recordTitle").value.trim(),
    type: CAT_TO_TYPE[$("#recordCategory").value] || "other",
    date: $("#recordDate").value,
    status: $("#recordStatus").value
  };

  if (!payload.title || !payload.date) {
    showFormMessage("Please complete all required fields.");
    return;
  }

  if (payload.date > new Date().toLocaleDateString("en-CA")) {
    showFormMessage("Record date cannot be in the future.");
    return;
  }

  const button = $("#saveRecordButton");
  button.disabled = true;
  button.textContent = "Saving...";

  try {
    const file = document.getElementById("recordFile")?.files?.[0];
    let saved;
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      if (!up.ok) throw new Error("File upload failed.");
      saved = await up.json();
    } else {
      saved = await apiRequest("/api/records", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    records.push(toUI(saved));

    selectedCategory = "All Records";
    document.querySelectorAll(".filter-tab").forEach((tab) => {
      tab.classList.toggle(
        "active",
        tab.dataset.category === selectedCategory
      );
    });

    $("#recordSearch").value = "";
    $("#globalSearch").value = "";
    $("#statusFilter").value = "all";

    closeModal();
    renderRecords();
  } catch (error) {
    showFormMessage(error.message || "Could not save this record.");
  } finally {
    button.disabled = false;
    button.textContent = "Save Record";
  }
}

$("#filterTabs").addEventListener("click", (event) => {
  const tab = event.target.closest("[data-category]");
  if (!tab) return;

  selectedCategory = tab.dataset.category;

  document.querySelectorAll(".filter-tab").forEach((button) => {
    button.classList.toggle("active", button === tab);
  });

  renderRecords();
});

$("#recordSearch").addEventListener("input", renderRecords);
$("#statusFilter").addEventListener("change", renderRecords);
$("#sortOrder").addEventListener("change", renderRecords);

$("#globalSearch").addEventListener("input", () => {
  $("#recordSearch").value = $("#globalSearch").value;
  renderRecords();
});

$("#uploadButton").addEventListener("click", showModal);
$("#emptyAddButton").addEventListener("click", showModal);
$("#closeModal").addEventListener("click", closeModal);
$("#cancelModal").addEventListener("click", closeModal);
$("#closeDetail").addEventListener("click", closeModal);
$("#doneDetail").addEventListener("click", closeModal);
$("#overlay").addEventListener("click", closeModal);
$("#recordForm").addEventListener("submit", saveRecord);
$("#refreshButton").addEventListener("click", loadRecords);
$("#retryButton").addEventListener("click", loadRecords);

$("#menuButton").addEventListener("click", () => {
  document.querySelector(".sidebar").classList.toggle("open");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal();
});

loadRecords();

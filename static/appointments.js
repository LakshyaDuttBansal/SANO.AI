"use strict";

const STORAGE_KEY = "sano_appointments_v1";

const appointmentList = document.getElementById("appointmentList");
const emptyState = document.getElementById("emptyState");
const modal = document.getElementById("appointmentModal");
const form = document.getElementById("appointmentForm");
const formError = document.getElementById("formError");
const toast = document.getElementById("toast");

let appointments = loadAppointments();
let toastTimer;

// Backend sync (same-origin): page source of truth stays local for speed,
// but seeds/merges with GET /api/appointments and mirrors writes best-effort.
function toLocal(row) {
    return {
        id: row.id,
        doctor: row.doctor || row.title || "",
        specialty: row.specialty || "",
        type: row.appt_type || "In-person",
        date: row.date || "",
        time: row.time || "00:00",
        location: row.location || "",
        notes: row.notes || "",
        status: row.status || "upcoming",
        createdAt: new Date().toISOString(),
        _remote: true,
    };
}
function toAPI(entry) {
    return {
        title: entry.doctor, doctor: entry.doctor, specialty: entry.specialty,
        appt_type: entry.type, date: entry.date, time: entry.time,
        location: entry.location, notes: entry.notes, status: entry.status,
    };
}
async function syncFromBackend() {
    try {
        const r = await fetch("/api/appointments");
        if (!r.ok) return;
        const rows = await r.json();
        if (!Array.isArray(rows)) return;
        const byId = new Map(appointments.map((a) => [a.id, a]));
        for (const row of rows) {
            const local = byId.get(row.id);
            if (local) {
                // Backend status wins so complete/cancel from another device sticks.
                local.status = row.status || local.status;
            } else {
                byId.set(row.id, toLocal(row));
            }
        }
        appointments = [...byId.values()];
        saveAppointments();
        renderAppointments();
    } catch {
        // Offline: keep local data.
    }
}
function postBackend(entry) {
    fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toAPI(entry)),
    }).then(async (r) => {
        if (!r.ok) return;
        const saved = await r.json().catch(() => ({}));
        if (saved && saved.id && saved.id !== entry.id) {
            const i = appointments.findIndex((a) => a.id === entry.id);
            if (i >= 0) {
                appointments[i].id = saved.id;
                saveAppointments();
                renderAppointments();
            }
        }
    }).catch(() => {});
}
function putBackend(id, status) {
    fetch(`/api/appointments/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
    }).catch(() => {});
}
function deleteBackend(id) {
    fetch(`/api/appointments/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
}

function loadAppointments() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return [];

        const parsed = JSON.parse(saved);

        if (!Array.isArray(parsed)) return [];

        return parsed.filter(item =>
            item &&
            typeof item.id === "string" &&
            typeof item.doctor === "string" &&
            typeof item.date === "string" &&
            typeof item.time === "string" &&
            typeof item.status === "string"
        );
    } catch (error) {
        console.error("Could not load appointments:", error);
        return [];
    }
}

function saveAppointments() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments));
        return true;
    } catch (error) {
        console.error("Could not save appointments:", error);
        showToast("Unable to save. Check your browser storage.");
        return false;
    }
}

function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }

    return Date.now().toString(36) +
        Math.random().toString(36).slice(2);
}

function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getAppointmentDateTime(appointment) {
    const [year, month, day] = appointment.date.split("-").map(Number);
    const [hours, minutes] = appointment.time.split(":").map(Number);

    return new Date(year, month - 1, day, hours, minutes);
}

function getStatus(appointment) {
    if (appointment.status === "cancelled") return "cancelled";
    if (appointment.status === "completed") return "completed";

    return getAppointmentDateTime(appointment) < new Date()
        ? "completed"
        : "upcoming";
}

function formatDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);

    return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function formatTime(timeString) {
    const [hours, minutes] = timeString.split(":").map(Number);

    return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });
}

function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function showToast(message) {
    clearTimeout(toastTimer);

    toast.textContent = message;
    toast.classList.add("show");

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2800);
}

function renderStats() {
    document.getElementById("totalCount").textContent =
        appointments.length;

    document.getElementById("upcomingCount").textContent =
        appointments.filter(item => getStatus(item) === "upcoming").length;

    document.getElementById("completedCount").textContent =
        appointments.filter(item => getStatus(item) === "completed").length;
}

function renderAppointments() {
    const search = document.getElementById("searchInput")
        .value.trim().toLowerCase();

    const statusFilter = document.getElementById("statusFilter").value;
    const sortFilter = document.getElementById("sortFilter").value;

    const filtered = appointments
        .filter(item => {
            const status = getStatus(item);

            const matchesStatus =
                statusFilter === "all" || status === statusFilter;

            const searchableText = [
                item.doctor,
                item.specialty,
                item.location,
                item.type,
                item.notes
            ].join(" ").toLowerCase();

            return matchesStatus && searchableText.includes(search);
        })
        .sort((a, b) => {
            const difference =
                getAppointmentDateTime(a) - getAppointmentDateTime(b);

            return sortFilter === "latest" ? -difference : difference;
        });

    appointmentList.innerHTML = filtered.map(item => {
        const status = getStatus(item);
        const date = getAppointmentDateTime(item);
        const month = date.toLocaleDateString("en-IN", {
            month: "short"
        });
        const day = String(date.getDate());

        const canCancel = status === "upcoming";
        const canComplete = status === "upcoming";

        return `
            <article class="appointment-card">
                <div class="date-tile">
                    <span class="month">${escapeHTML(month)}</span>
                    <span class="day">${escapeHTML(day)}</span>
                </div>

                <div class="appointment-details">
                    <h3>${escapeHTML(item.doctor)}</h3>
                    <div class="doctor-specialty">
                        ${escapeHTML(item.specialty)}
                    </div>

                    <div class="appointment-meta">
                        <span>◷ ${escapeHTML(formatTime(item.time))}</span>
                        <span>▦ ${escapeHTML(formatDate(item.date))}</span>
                        <span>⌖ ${escapeHTML(item.location || item.type)}</span>
                    </div>

                    ${item.location ? `
                        <div class="appointment-meta" style="margin-top:8px">
                            <span>${escapeHTML(item.type)}</span>
                        </div>
                    ` : ""}

                    ${item.notes ? `
                        <div class="appointment-notes">
                            <strong>Notes:</strong> ${escapeHTML(item.notes)}
                        </div>
                    ` : ""}
                </div>

                <div class="appointment-actions">
                    <span class="status-badge ${status}">
                        ${status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>

                    <div class="action-row">
                        ${canComplete ? `
                            <button class="small-action"
                                data-action="complete"
                                data-id="${escapeHTML(item.id)}">
                                Mark done
                            </button>
                        ` : ""}

                        ${canCancel ? `
                            <button class="small-action danger"
                                data-action="cancel"
                                data-id="${escapeHTML(item.id)}">
                                Cancel
                            </button>
                        ` : ""}

                        ${status === "cancelled" ? `
                            <button class="small-action"
                                data-action="delete"
                                data-id="${escapeHTML(item.id)}">
                                Remove
                            </button>
                        ` : ""}
                    </div>
                </div>
            </article>
        `;
    }).join("");

    emptyState.hidden = filtered.length !== 0;
    appointmentList.hidden = filtered.length === 0;

    renderStats();
}

function openModal() {
    form.reset();
    formError.textContent = "";

    document.getElementById("appointmentDate").min =
        getLocalDateString();

    modal.hidden = false;
    document.body.style.overflow = "hidden";

    document.getElementById("doctorName").focus();
}

function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
    formError.textContent = "";
}

document.getElementById("openModalButton")
    .addEventListener("click", openModal);

document.getElementById("emptyBookButton")
    .addEventListener("click", openModal);

document.getElementById("closeModalButton")
    .addEventListener("click", closeModal);

document.getElementById("cancelModalButton")
    .addEventListener("click", closeModal);

modal.addEventListener("click", event => {
    if (event.target === modal) closeModal();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.hidden) {
        closeModal();
    }
});

form.addEventListener("submit", event => {
    event.preventDefault();
    formError.textContent = "";

    const doctor = document.getElementById("doctorName").value.trim();
    const specialty = document.getElementById("specialty").value;
    const type = document.getElementById("appointmentType").value;
    const date = document.getElementById("appointmentDate").value;
    const time = document.getElementById("appointmentTime").value;
    const location = document.getElementById("location").value.trim();
    const notes = document.getElementById("appointmentNotes").value.trim();

    if (!doctor || !specialty || !date || !time) {
        formError.textContent = "Please fill in all required fields.";
        return;
    }

    if (date < getLocalDateString()) {
        formError.textContent = "Please select today or a future date.";
        return;
    }

    const appointmentDate = getAppointmentDateTime({ date, time });

    if (appointmentDate < new Date()) {
        formError.textContent = "Please select a future time.";
        return;
    }

    const appointment = {
        id: makeId(),
        doctor,
        specialty,
        type,
        date,
        time,
        location,
        notes,
        status: "upcoming",
        createdAt: new Date().toISOString()
    };

    appointments.push(appointment);

    if (!saveAppointments()) {
        appointments.pop();
        return;
    }

    postBackend(appointment);
    closeModal();
    renderAppointments();
    showToast("Appointment saved successfully!");
});

appointmentList.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const { action, id } = button.dataset;
    const index = appointments.findIndex(item => item.id === id);

    if (index === -1) return;

    const appointment = appointments[index];
    const currentStatus = getStatus(appointment);

    if (action === "cancel") {
        if (currentStatus !== "upcoming") return;

        const confirmed = window.confirm(
            `Cancel your appointment with ${appointment.doctor}?`
        );

        if (!confirmed) return;

        const previousStatus = appointment.status;
        appointment.status = "cancelled";

        if (!saveAppointments()) {
            appointment.status = previousStatus;
            return;
        }

        putBackend(id, "cancelled");
        renderAppointments();
        showToast("Appointment cancelled.");
    }

    if (action === "complete") {
        if (currentStatus !== "upcoming") return;

        const previousStatus = appointment.status;
        appointment.status = "completed";

        if (!saveAppointments()) {
            appointment.status = previousStatus;
            return;
        }

        putBackend(id, "completed");
        renderAppointments();
        showToast("Appointment marked as completed.");
    }

    if (action === "delete") {
        if (currentStatus !== "cancelled") return;

        const confirmed = window.confirm(
            "Remove this cancelled appointment from your list?"
        );

        if (!confirmed) return;

        const removed = appointments.splice(index, 1)[0];

        if (!saveAppointments()) {
            appointments.splice(index, 0, removed);
            return;
        }

        deleteBackend(id);
        renderAppointments();
        showToast("Cancelled appointment removed.");
    }
});

document.getElementById("searchInput")
    .addEventListener("input", renderAppointments);

document.getElementById("statusFilter")
    .addEventListener("change", renderAppointments);

document.getElementById("sortFilter")
    .addEventListener("change", renderAppointments);

document.getElementById("clearSearchButton")
    .addEventListener("click", () => {
        document.getElementById("searchInput").value = "";
        document.getElementById("statusFilter").value = "all";
        document.getElementById("sortFilter").value = "soonest";

        renderAppointments();
    });

document.getElementById("menuButton")
    .addEventListener("click", () => {
        document.getElementById("sidebar").classList.toggle("open");
    });

document.getElementById("profileButton")
    .addEventListener("click", () => {
        document.getElementById("profileMenu").classList.toggle("show");
    });

document.addEventListener("click", event => {
    const sidebar = document.getElementById("sidebar");
    const menuButton = document.getElementById("menuButton");
    const profileMenu = document.getElementById("profileMenu");
    const profileButton = document.getElementById("profileButton");

    if (!sidebar.contains(event.target) &&
        !menuButton.contains(event.target)) {
        sidebar.classList.remove("open");
    }

    if (!profileMenu.contains(event.target) &&
        !profileButton.contains(event.target)) {
        profileMenu.classList.remove("show");
    }
});

renderAppointments();
syncFromBackend();

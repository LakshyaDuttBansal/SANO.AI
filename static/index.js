const modal = document.getElementById("medicationModal");
const form = document.getElementById("medicationForm");

const currentSection = document.getElementById("currentSection");
const pastSection = document.getElementById("pastSection");
const remindersSection = document.getElementById("remindersSection");
const adherenceSection = document.getElementById("adherenceSection");

const currentCount = document.getElementById("currentCount");
const pastCount = document.getElementById("pastCount");

// Open and close the modal
document.getElementById("openModal").addEventListener("click", () => {
    modal.classList.remove("hidden");
});

document.getElementById("closeModal").addEventListener("click", closeModal);

function closeModal() {
    modal.classList.add("hidden");
}

modal.addEventListener("click", (event) => {
    if (event.target === modal) {
        closeModal();
    }
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
});

// Tab navigation
const tabs = document.querySelectorAll(".tab");

tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        tabs.forEach((item) => item.classList.remove("active"));
        tab.classList.add("active");

        const selectedTab = tab.dataset.tab;

        currentSection.classList.toggle("hidden", selectedTab !== "current");
        pastSection.classList.toggle("hidden", selectedTab !== "past");
        remindersSection.classList.toggle("hidden", selectedTab !== "reminders");

        adherenceSection.classList.toggle(
            "hidden",
            selectedTab !== "current"
        );
    });
});

function formatTime(t) {
    const [hours, minutes] = String(t).split(":").map(Number);
    if (Number.isNaN(hours)) return String(t);
    return `${hours % 12 || 12}:${String(minutes || 0).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}

function buildCard({ name, dose, time, id }) {
    const article = document.createElement("article");
    article.className = "medication";
    if (id) article.dataset.id = id;

    const icon = document.createElement("div");
    icon.className = "pill-icon";
    icon.textContent = "💊";

    const info = document.createElement("div");
    info.className = "med-info";

    const heading = document.createElement("h3");
    heading.textContent = name;

    const description = document.createElement("p");
    description.textContent = dose;

    info.append(heading, description);

    const times = document.createElement("div");
    times.className = "times";

    const timeBadge = document.createElement("span");
    timeBadge.className = "time";
    timeBadge.textContent = "◷ " + time;

    times.appendChild(timeBadge);

    const deleteButton = document.createElement("button");
    deleteButton.className = "menu-btn delete-btn";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", "Delete medication");
    if (id) deleteButton.dataset.id = id;

    article.append(icon, info, times, deleteButton);
    return article;
}

// Initial load from backend so placeholders resolve (page ships with loading state, no mocks)
async function loadMeds() {
    try {
        const [cur, past] = await Promise.all([
            fetch("/api/medications?status=current").then((r) => r.json()),
            fetch("/api/medications?status=past").then((r) => r.json()),
        ]);
        if (Array.isArray(cur)) {
            currentSection.innerHTML = "";
            cur.forEach((m) => currentSection.appendChild(buildCard({
                name: `${m.name || ""} ${m.dose || ""}`.trim(),
                dose: m.schedule || m.dose || "",
                time: (m.schedule || "").split(",")[0].trim() || "daily",
                id: m.id,
            })));
        }
        if (Array.isArray(past)) {
            pastSection.innerHTML = "";
            past.forEach((m) => pastSection.appendChild(buildCard({
                name: `${m.name || ""} ${m.dose || ""}`.trim(),
                dose: m.schedule || m.dose || "",
                time: (m.schedule || "").split(",")[0].trim() || "daily",
                id: m.id,
            })));
        }
        updateCount();
    } catch (e) {
        console.warn("Backend unreachable, keeping page content", e);
    }
}

// Add medication (your flow + backend persist)
form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("medName").value.trim();
    const dose = document.getElementById("medDose").value.trim();
    const time = document.getElementById("medTime").value;

    if (!name || !dose || !time) {
        alert("Please fill in all fields.");
        return;
    }

    const formattedTime = formatTime(time);
    const article = buildCard({ name, dose, time: formattedTime });
    currentSection.appendChild(article);

    updateCount();
    form.reset();
    closeModal();

    // Return to Current tab
    tabs[0].click();

    // Persist to backend (page stays demo-fast even if API fails)
    try {
        const r = await fetch("/api/medications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, dose, schedule: formattedTime, status: "current" }),
        });
        const saved = await r.json().catch(() => ({}));
        if (saved && saved.id) {
            article.dataset.id = saved.id;
            const btn = article.querySelector(".delete-btn");
            if (btn) btn.dataset.id = saved.id;
        }
    } catch (e) {
        console.warn("POST /api/medications failed", e);
    }
});

// Delete medication using event delegation (current + past, backend-synced)
for (const sec of [currentSection, pastSection]) {
    sec.addEventListener("click", async (event) => {
        const button = event.target.closest(".delete-btn");
        if (!button) return;
        const medication = button.closest(".medication");
        if (!medication) return;
        if (!confirm("Remove this medication?")) return;
        const id = button.dataset.id || medication.dataset.id;
        medication.remove();
        updateCount();
        if (id) {
            try {
                await fetch(`/api/medications/${encodeURIComponent(id)}`, { method: "DELETE" });
            } catch (e) {
                console.warn("DELETE failed", e);
            }
        }
    });
}

// Update medication counts (current + past)
function updateCount() {
    currentCount.textContent = currentSection.querySelectorAll(".medication").length;
    if (pastCount) pastCount.textContent = pastSection.querySelectorAll(".medication").length;
}

// Adherence: backend first, zeros if unreachable (no mock numbers)
document.getElementById("period").addEventListener("change", updateAdherence);

async function updateAdherence() {
    const period = Number(document.getElementById("period").value);
    try {
        const r = await fetch(`/api/adherence?period=${period}`);
        if (!r.ok) throw new Error("adherence");
        const a = await r.json();
        paintAdherence(a.taken, a.missed, a.percent);
        return;
    } catch (e) {
        console.warn("adherence API failed", e);
    }
    paintAdherence(0, period, 0);
}

function paintAdherence(taken, missed, percentage) {
    document.getElementById("percentage").textContent = percentage + "%";
    document.getElementById("takenLabel").textContent = `Taken (${taken} days)`;
    document.getElementById("missedLabel").textContent = `Missed (${missed} days)`;
    document.getElementById("progressCircle").style.background =
        `conic-gradient(#07975c 0% ${percentage}%, #f27c6e ${percentage}% 100%)`;
}

loadMeds();
updateAdherence();

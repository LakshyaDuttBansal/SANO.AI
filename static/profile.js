// Sano AI Profile - session banner + backend-persisted details + live measurements.
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
}
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}
function sessionUser() {
  try {
    return JSON.parse(localStorage.getItem("sano_user") || sessionStorage.getItem("sano_user") || "null");
  } catch { return null; }
}
function initials(name) {
  return (name || "?").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

async function loadProfile() {
  const u = sessionUser();
  const name = u?.name || localStorage.getItem("sano_user_name") || "";
  const email = u?.email || "";
  document.getElementById("displayName").textContent = name || "Your Profile";
  document.getElementById("displayEmail").textContent = email;
  document.getElementById("avatarPreview").textContent = initials(name);
  document.getElementById("fullName").value = name;
  document.getElementById("email").value = email;
  if (!email) return;
  try {
    const r = await fetch(`/api/profile?email=${encodeURIComponent(email)}`);
    if (!r.ok) return;
    const p = await r.json();
    for (const [id, key] of [["phone", "phone"], ["gender", "gender"], ["dob", "dob"],
                             ["bloodGroup", "blood_group"], ["address", "address"]]) {
      if (p[key]) document.getElementById(id).value = p[key];
    }
  } catch (e) { console.warn("profile load failed", e); }
}

async function loadMeasurements() {
  try {
    const r = await fetch("/api/wellness?range=7d");
    if (!r.ok) return;
    const w = await r.json();
    const rows = w.series || [];
    const last = rows[rows.length - 1] || {};
    // Height/weight are logged via wellness page goals? show latest water/steps-based note.
    document.getElementById("profileHeight").textContent = "–";
    document.getElementById("profileWeight").textContent =
      last.water_l ? `${last.water_l} L logged` : "–";
    document.getElementById("profileBMI").textContent =
      last.sleep_hrs ? `${last.sleep_hrs} hrs sleep` : "–";
  } catch (e) { console.warn("measurements failed", e); }
}

function loadPreferences() {
  try {
    const p = JSON.parse(localStorage.getItem("sano_prefs") || "{}");
    for (const id of ["emailNotifications", "healthReminders", "weeklySummary"]) {
      if (typeof p[id] === "boolean") document.getElementById(id).checked = p[id];
    }
    if (p.language) document.getElementById("language").value = p.language;
  } catch {}
}
function savePreferences() {
  localStorage.setItem("sano_prefs", JSON.stringify({
    emailNotifications: document.getElementById("emailNotifications").checked,
    healthReminders: document.getElementById("healthReminders").checked,
    weeklySummary: document.getElementById("weeklySummary").checked,
    language: document.getElementById("language").value,
  }));
}
for (const id of ["emailNotifications", "healthReminders", "weeklySummary", "language"]) {
  document.getElementById(id).addEventListener("change", () => {
    savePreferences();
    toast("Preferences saved.");
  });
}

document.getElementById("profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const body = {
    email,
    name: document.getElementById("fullName").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    gender: document.getElementById("gender").value,
    dob: document.getElementById("dob").value,
    blood_group: document.getElementById("bloodGroup").value,
    address: document.getElementById("address").value.trim(),
  };
  if (!body.name || !email) {
    toast("Name and email are required.");
    return;
  }
  try {
    const r = await fetch("/api/profile", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error("Save failed");
    document.getElementById("displayName").textContent = body.name;
    document.getElementById("avatarPreview").textContent = initials(body.name);
    // Keep session name in sync for other pages
    for (const store of [localStorage, sessionStorage]) {
      try {
        const u = JSON.parse(store.getItem("sano_user") || "null");
        if (u) {
          u.name = body.name;
          store.setItem("sano_user", JSON.stringify(u));
          store.setItem("sano_user_name", body.name);
        }
      } catch {}
    }
    toast("Profile saved.");
  } catch (err) {
    toast("Could not save profile.");
  }
});

document.getElementById("profileForm").addEventListener("reset", () => {
  // Reload saved values after the native reset clears the form.
  setTimeout(async () => {
    await loadProfile();
    toast("Form reset to saved values.");
  }, 0);
});

document.getElementById("themeToggle").addEventListener("click", () => {
  const dark = document.body.classList.toggle("dark");
  try { localStorage.setItem("sano_theme", dark ? "dark" : "light"); } catch {}
  document.getElementById("themeToggle").textContent = dark ? "☀" : "☾";
});
try {
  if (localStorage.getItem("sano_theme") === "dark") {
    document.body.classList.add("dark");
    document.getElementById("themeToggle").textContent = "☀";
  }
} catch {}

document.getElementById("logoutButton").addEventListener("click", () => {
  for (const store of [localStorage, sessionStorage]) {
    store.removeItem("sano_token");
    store.removeItem("sano_user");
    store.removeItem("sano_user_id");
    store.removeItem("sano_user_name");
  }
  window.location.assign("/login");
});

loadProfile();
loadMeasurements();
loadPreferences();

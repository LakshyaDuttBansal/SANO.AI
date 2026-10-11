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
    cachedProfile = { ...p };
    for (const [id, key] of [["phone", "phone"], ["gender", "gender"], ["dob", "dob"],
                             ["bloodGroup", "blood_group"], ["address", "address"]]) {
      if (p[key]) document.getElementById(id).value = p[key];
    }
  } catch (e) { console.warn("profile load failed", e); }
}

let cachedProfile = {};

function bmi(hCm, wKg) {
  if (!hCm || !wKg || hCm <= 0 || wKg <= 0) return null;
  return wKg / ((hCm / 100) ** 2);
}

function paintMeasurements(hCm, wKg) {
  document.getElementById("profileHeight").textContent = hCm ? `${hCm} cm` : "–";
  document.getElementById("profileWeight").textContent = wKg ? `${wKg} kg` : "–";
  const b = bmi(hCm, wKg);
  document.getElementById("profileBMI").textContent = b === null ? "–" : b.toFixed(1);
}

async function loadMeasurements() {
  // Body measurements persist on the profile, same as personal details.
  const email = document.getElementById("email").value.trim().toLowerCase();
  if (!email) return;
  try {
    const r = await fetch(`/api/profile?email=${encodeURIComponent(email)}`);
    if (!r.ok) return;
    const p = await r.json();
    cachedProfile = { ...cachedProfile, ...p };
    if (p.height_cm) document.getElementById("heightInput").value = p.height_cm;
    if (p.weight_kg) document.getElementById("weightInput").value = p.weight_kg;
    paintMeasurements(p.height_cm, p.weight_kg);
  } catch (e) { console.warn("measurements failed", e); }
}

document.getElementById("measurementsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const h = parseFloat(document.getElementById("heightInput").value);
  const w = parseFloat(document.getElementById("weightInput").value);
  if ((document.getElementById("heightInput").value && !(h > 0 && h <= 300)) ||
      (document.getElementById("weightInput").value && !(w > 0 && w <= 500))) {
    toast("Enter a valid height (1-300 cm) and weight (1-500 kg).");
    return;
  }
  const body = {
    email: document.getElementById("email").value.trim(),
    name: document.getElementById("fullName").value.trim() || cachedProfile.name || "",
    phone: cachedProfile.phone || "", gender: cachedProfile.gender || "",
    dob: cachedProfile.dob || "", blood_group: cachedProfile.blood_group || "",
    address: cachedProfile.address || "",
    height_cm: document.getElementById("heightInput").value ? h : null,
    weight_kg: document.getElementById("weightInput").value ? w : null,
  };
  if (!body.name) {
    toast("Save your name in Personal Information first.");
    return;
  }
  try {
    const r = await fetch("/api/profile", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error("Save failed");
    cachedProfile = { ...cachedProfile, height_cm: body.height_cm, weight_kg: body.weight_kg };
    paintMeasurements(body.height_cm, body.weight_kg);
    toast("Measurements saved to your profile.");
  } catch (err) {
    toast("Could not save measurements.");
  }
});

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

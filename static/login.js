"use strict";

// Same-origin by default so Nimbus single-deploy works.
// If the page was opened directly (file://) or from another dev server,
// fall back to a local backend instead of failing with "Authentication failed".
function resolveApiBase() {
  if (window.location.protocol === "file:") return "http://127.0.0.1:8000";
  return "";
}
const API_BASE_URL = resolveApiBase();

async function postAuth(endpoint, payload) {
  const doFetch = (base) => fetch(`${base}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const FALLBACK = "http://127.0.0.1:8000";
  try {
    const first = await doFetch(API_BASE_URL);
    // Same-origin answered but has no API (Live Server replies 405 to POST,
    // static hosts reply 404): retry the local backend once instead of failing.
    if (!first.ok && [404, 405, 501].includes(first.status) && API_BASE_URL !== FALLBACK) {
      return await doFetch(FALLBACK);
    }
    return first;
  } catch (err) {
    // Same-origin unreachable (e.g. file opened directly): retry local backend once.
    if (API_BASE_URL !== FALLBACK) {
      return await doFetch(FALLBACK);
    }
    throw err;
  }
}

const authForm = document.getElementById("authForm");
const loginTab = document.getElementById("loginTab");
const signupTab = document.getElementById("signupTab");
const switchModeButton = document.getElementById("switchMode");
const formTitle = document.getElementById("formTitle");
const formSubtitle = document.getElementById("formSubtitle");
const nameField = document.getElementById("nameField");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const passwordHint = document.getElementById("passwordHint");
const loginOptions = document.getElementById("loginOptions");
const rememberCheckbox = document.getElementById("remember");
const submitButton = document.getElementById("submitButton");
const submitText = document.getElementById("submitText");
const togglePasswordButton = document.getElementById("togglePassword");
const messageBox = document.getElementById("message");
const forgotPasswordButton = document.getElementById("forgotPassword");

let currentMode = "login";

function showMessage(text, type = "error") {
  messageBox.textContent = text;
  messageBox.className = `message ${type}`;
  messageBox.hidden = false;
}

function clearMessage() {
  messageBox.textContent = "";
  messageBox.hidden = true;
  messageBox.className = "message";
}

function setMode(mode) {
  currentMode = mode;
  const isSignup = mode === "signup";

  clearMessage();

  formTitle.textContent = isSignup ? "Create your account" : "Welcome back";
  formSubtitle.textContent = isSignup
    ? "Join Sano AI and organize your health journey."
    : "Sign in to your account to continue.";

  submitText.textContent = isSignup ? "Create Account" : "Sign In";

  loginTab.classList.toggle("active", !isSignup);
  signupTab.classList.toggle("active", isSignup);

  loginTab.setAttribute("aria-selected", String(!isSignup));
  signupTab.setAttribute("aria-selected", String(isSignup));

  nameField.hidden = !isSignup;
  nameInput.required = isSignup;

  loginOptions.hidden = isSignup;
  passwordHint.hidden = !isSignup;

  passwordInput.autocomplete = isSignup
    ? "new-password"
    : "current-password";

  const switchPrompt = document.getElementById("switchPrompt");
  if (switchPrompt) {
    switchPrompt.firstChild.textContent = isSignup
      ? "Already have an account? "
      : "New to Sano AI? ";
    switchModeButton.textContent = isSignup ? "Sign in" : "Create account";
  }

  togglePasswordButton.textContent = "Show";
  togglePasswordButton.setAttribute("aria-label", "Show password");
  passwordInput.type = "password";
}

loginTab.addEventListener("click", () => setMode("login"));
signupTab.addEventListener("click", () => setMode("signup"));

switchModeButton.addEventListener("click", () => {
  setMode(currentMode === "login" ? "signup" : "login");
});

togglePasswordButton.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";

  passwordInput.type = isPassword ? "text" : "password";
  togglePasswordButton.textContent = isPassword ? "Hide" : "Show";
  togglePasswordButton.setAttribute(
    "aria-label",
    isPassword ? "Hide password" : "Show password"
  );
});

forgotPasswordButton.addEventListener("click", () => {
  showMessage(
    "Password reset is not configured yet. Please contact your project administrator.",
    "error"
  );
});

function getApiError(data, fallback) {
  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (Array.isArray(data?.detail)) {
    return data.detail
      .map((item) => item.msg || "Invalid input")
      .join(". ");
  }

  return fallback;
}

function saveSession(data) {
  // Remove any old session before saving the new one.
  localStorage.removeItem("sano_token");
  sessionStorage.removeItem("sano_token");

  const storage = rememberCheckbox.checked
    ? localStorage
    : sessionStorage;

  // Backend returns both legacy {token,user} and new {access_token,user_id,name} shapes.
  const token = data.access_token || data.token;
  const uid = data.user_id || (data.user && data.user.id);
  const uname = data.name || (data.user && data.user.name);
  const email = data.email || (data.user && data.user.email) || "";

  storage.setItem("sano_token", token);
  storage.setItem("sano_user_id", uid);
  storage.setItem("sano_user_name", uname);
  // overview.js reads sano_user JSON, so keep it in the same storage.
  storage.setItem("sano_user", JSON.stringify({id: uid, name: uname, email}));

  // Also keep the token available under the conventional key.
  // Use sano_token when making authenticated API requests.
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (!email || !password) {
    showMessage("Please enter your email and password.");
    return;
  }

  if (currentMode === "signup") {
    const name = nameInput.value.trim();

    if (!name) {
      showMessage("Please enter your full name.");
      nameInput.focus();
      return;
    }

    if (password.length < 8) {
      showMessage("Please use a password with at least 8 characters.");
      passwordInput.focus();
      return;
    }
  }

  const endpoint = currentMode === "signup"
    ? "/api/auth/signup"
    : "/api/auth/login";

  const payload = currentMode === "signup"
    ? { name: nameInput.value.trim(), email, password }
    : { email, password };

  submitButton.disabled = true;
  submitText.textContent = currentMode === "signup"
    ? "Creating account..."
    : "Signing in...";

  try {
    const response = await postAuth(endpoint, payload);

    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      // Non-JSON reply (e.g. proxy/404 page): surface the HTTP status instead
      // of a generic "Authentication failed" message.
      throw new Error(`Server returned HTTP ${response.status}. Open this page via the backend (http://127.0.0.1:8000/login), not as a file.`);
    }

    if (!response.ok) {
      throw new Error(
        getApiError(data, "Authentication failed. Please try again.")
      );
    }

    const token = data.access_token || data.token;
    const uid = data.user_id || (data.user && data.user.id);
    if (!token || !uid) {
      throw new Error("The server returned an incomplete login response.");
    }

    saveSession(data);

    showMessage(
      currentMode === "signup"
        ? "Account created successfully! Opening your dashboard..."
        : "Login successful! Opening your dashboard...",
      "success"
    );

    // Single-deploy: dashboard is served at /overview (medications home at /).
    window.location.assign("/overview");

  } catch (error) {
    console.error("Sano AI authentication error:", error);

    if (error instanceof TypeError) {
      showMessage(
        "Cannot connect to the backend. Start it with: uvicorn main:app --host 0.0.0.0 --port 8000, then open http://127.0.0.1:8000/login"
      );
    } else {
      showMessage(error.message || "Something went wrong. Please try again.");
    }
  } finally {
    submitButton.disabled = false;
    submitText.textContent = currentMode === "signup"
      ? "Create Account"
      : "Sign In";
  }
});

// Default to the login view.
setMode("login");

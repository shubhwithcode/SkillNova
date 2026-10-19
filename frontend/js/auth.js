// ====================================================================
// SkillNova - auth.js
// Login and Register pages - now call the REAL backend API
// (/api/auth/*). Passwords are verified server-side against bcrypt
// hashes in MySQL; the session lives in an httpOnly cookie.
// sessionStorage only keeps the display name for instant greetings.
// ====================================================================

// ----------------------------
// Toast helper
// ----------------------------
function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(function () {
        toast.classList.remove("show");
    }, 3500);
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Small fetch wrapper: POST JSON, return parsed JSON, throw on error.
async function postJson(url, body) {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || "Request failed. Please try again.");
    }
    return data;
}

function openStudentDashboard(name) {
    sessionStorage.setItem("skillnovaUserName", name);
    window.location.href = "dashboard.html";
}

// ----------------------------
// Show / hide password buttons
// ----------------------------
function setupShowPassword(buttonId, inputId) {
    const button = document.getElementById(buttonId);
    const input = document.getElementById(inputId);
    if (!button || !input) return;

    button.addEventListener("click", function () {
        if (input.type === "password") {
            input.type = "text";
            button.textContent = "Hide";
        } else {
            input.type = "password";
            button.textContent = "Show";
        }
    });
}

setupShowPassword("showPassword", "password");
setupShowPassword("showRegisterPassword", "registerPassword");

// ----------------------------
// Login form
// ----------------------------
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        if (email === "" || password === "") {
            showToast("Please fill all fields.");
            return;
        }
        if (!isValidEmail(email)) {
            showToast("Please enter a valid email address.");
            return;
        }

        const submitButton = loginForm.querySelector("button[type=submit]");
        submitButton.disabled = true;
        try {
            const data = await postJson("/api/auth/login", { email, password });
            openStudentDashboard(data.user.fullName);
        } catch (error) {
            showToast(error.message);
        } finally {
            submitButton.disabled = false;
        }
    });
}

// ----------------------------
// Register form
// ----------------------------
const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const name = document.getElementById("registerName").value.trim();
        const email = document.getElementById("registerEmail").value.trim();
        const password = document.getElementById("registerPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (name === "" || email === "" || password === "" || confirmPassword === "") {
            showToast("Please fill all fields.");
            return;
        }
        if (!isValidEmail(email)) {
            showToast("Please enter a valid email address.");
            return;
        }
        if (password.length < 8) {
            showToast("Password must be at least 8 characters.");
            return;
        }
        if (password !== confirmPassword) {
            showToast("Passwords do not match.");
            return;
        }

        const submitButton = registerForm.querySelector("button[type=submit]");
        submitButton.disabled = true;
        try {
            const data = await postJson("/api/auth/register", {
                fullName: name,
                email,
                password,
            });
            openStudentDashboard(data.user.fullName);
        } catch (error) {
            showToast(error.message);
        } finally {
            submitButton.disabled = false;
        }
    });
}

// ----------------------------
// Buttons that are not implemented yet
// ----------------------------
const googleLogin = document.getElementById("googleLogin");
if (googleLogin) {
    googleLogin.addEventListener("click", function () {
        showToast("Google login is planned for a later phase.");
    });
}

const forgotPassword = document.getElementById("forgotPassword");
if (forgotPassword) {
    forgotPassword.addEventListener("click", function (event) {
        event.preventDefault();
        showToast("Password reset is planned for a later phase.");
    });
}


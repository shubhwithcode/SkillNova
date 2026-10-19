// ====================================================================
// SkillNova - page-shell.js
// Shared behavior for all logged-in pages: session check + logout +
// small fetch helpers used by every module script.
// ====================================================================

// Quick client-side guard (server still protects every API).
if (!sessionStorage.getItem("skillnovaUserName")) {
    window.location.replace("login.html");
}

const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST" });
        } catch (error) {
            // Even if the request fails, clear the local state.
        }
        sessionStorage.removeItem("skillnovaUserName");
        window.location.href = "login.html";
    });
}

// ---- Shared helpers (window.snApi) ----
window.snApi = {
    // GET that redirects to login on 401 and throws readable errors.
    async get(url) {
        const response = await fetch(url);
        if (response.status === 401) {
            sessionStorage.removeItem("skillnovaUserName");
            window.location.replace("login.html");
            throw new Error("Not logged in.");
        }
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || "Request failed.");
        }
        return data;
    },

    async send(url, method, body) {
        const response = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (response.status === 401) {
            sessionStorage.removeItem("skillnovaUserName");
            window.location.replace("login.html");
            throw new Error("Not logged in.");
        }
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || "Request failed.");
        }
        return data;
    },
};


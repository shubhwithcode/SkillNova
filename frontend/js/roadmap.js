// ====================================================================
// SkillNova - roadmap.js
// My Roadmap page: load the saved roadmap, generate a new one, and
// mark tasks complete. Uses window.snApi from page-shell.js.
// ====================================================================

const els = {
    status: document.getElementById("pageStatus"),
    error: document.getElementById("pageError"),
    errorText: document.getElementById("pageErrorText"),
    retry: document.getElementById("retryButton"),
    empty: document.getElementById("emptyState"),
    roleSelect: document.getElementById("roleSelect"),
    generateForm: document.getElementById("generateForm"),
    generateButton: document.getElementById("generateButton"),
    view: document.getElementById("roadmapView"),
    role: document.getElementById("roadmapRole"),
    title: document.getElementById("roadmapTitle"),
    source: document.getElementById("roadmapSource"),
    bar: document.getElementById("roadmapProgressBar"),
    percent: document.getElementById("roadmapProgressText"),
    counts: document.getElementById("roadmapCounts"),
    taskList: document.getElementById("taskList"),
    regenerate: document.getElementById("regenerateButton"),
};

function setVisible(element, visible) {
    if (element) element.hidden = !visible;
}

function showError(message) {
    els.errorText.textContent = message;
    setVisible(els.error, true);
}

// ---- Load job roles into the dropdown ----
async function loadRoles() {
    const data = await window.snApi.get("/api/profile/options");
    els.roleSelect.innerHTML = '<option value="">— Choose a role —</option>';
    data.jobRoles.forEach((role) => {
        const option = document.createElement("option");
        option.value = role.id;
        option.textContent = role.name;
        els.roleSelect.append(option);
    });
}

// ---- Render the roadmap ----
function renderRoadmap(roadmap) {
    els.role.textContent = roadmap.role_name.toUpperCase();
    els.title.textContent = roadmap.title;

    els.source.innerHTML = "";
    const badge = document.createElement("span");
    badge.className = roadmap.source === "ai" ? "badge-ai" : "badge-fallback";
    badge.textContent = roadmap.source === "ai" ? "AI generated" : "Built-in plan (fallback)";
    els.source.append(badge);

    els.bar.style.width = roadmap.progress.percent + "%";
    els.percent.textContent = roadmap.progress.percent + "%";
    els.counts.textContent =
        `${roadmap.progress.completed} of ${roadmap.progress.total} tasks completed · ` +
        `${roadmap.progress.total - roadmap.progress.completed} pending`;

    els.taskList.innerHTML = "";
    const firstPending = roadmap.tasks.find((t) => t.status === "pending");

    roadmap.tasks.forEach((task) => {
        const item = document.createElement("li");
        item.className = "task-item";
        item.id = "task-" + task.id;
        if (task.status === "completed") item.classList.add("is-done");
        if (firstPending && task.id === firstPending.id) item.classList.add("is-current");

        const day = document.createElement("span");
        day.className = "task-day";
        day.textContent = "Day " + task.day_number;

        const body = document.createElement("div");
        body.className = "task-body";

        const heading = document.createElement("h3");
        heading.textContent = task.title;

        const description = document.createElement("p");
        description.textContent = task.description || "";

        const meta = document.createElement("div");
        meta.className = "task-meta";
        meta.textContent = `◷ ~${task.estimated_minutes} min`;

        body.append(heading, description, meta);

        if (Array.isArray(task.resources) && task.resources.length) {
            const resources = document.createElement("div");
            resources.className = "task-resources";
            task.resources.forEach((r) => {
                const link = document.createElement("a");
                link.href = r.url;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.textContent = "↗ " + r.label;
                resources.append(link);
            });
            body.append(resources);
        }

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "task-toggle" + (task.status === "completed" ? " is-done" : "");
        toggle.textContent = task.status === "completed" ? "✓ Completed" : "Mark complete";
        toggle.addEventListener("click", () => toggleTask(task, toggle));

        item.append(day, body, toggle);
        els.taskList.append(item);
    });

    // Deep link from the dashboard: roadmap.html#task-123
    if (window.location.hash.startsWith("#task-")) {
        const target = document.querySelector(window.location.hash);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
}

// ---- Toggle one task ----
async function toggleTask(task, button) {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    button.disabled = true;
    try {
        await window.snApi.send("/api/roadmap/tasks/" + task.id, "PUT", { status: newStatus });
        await loadRoadmap(); // re-render with fresh progress numbers
    } catch (error) {
        alert(error.message);
        button.disabled = false;
    }
}

// ---- Load the saved roadmap ----
async function loadRoadmap() {
    setVisible(els.status, true);
    setVisible(els.error, false);
    setVisible(els.empty, false);
    setVisible(els.view, false);

    try {
        const data = await window.snApi.get("/api/roadmap");
        if (!data.roadmap) {
            await loadRoles();
            setVisible(els.empty, true);
        } else {
            renderRoadmap(data.roadmap);
            setVisible(els.view, true);
        }
    } catch (error) {
        showError(error.message);
    } finally {
        setVisible(els.status, false);
    }
}

// ---- Generate ----
els.generateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const jobRoleId = Number(els.roleSelect.value);
    if (!jobRoleId) {
        alert("Please choose a job role first.");
        return;
    }
    els.generateButton.disabled = true;
    els.generateButton.textContent = "Generating… (this can take ~20s with AI)";
    try {
        await window.snApi.send("/api/roadmap/generate", "POST", { jobRoleId });
        await loadRoadmap();
    } catch (error) {
        showError(error.message);
    } finally {
        els.generateButton.disabled = false;
        els.generateButton.textContent = "Generate my roadmap →";
    }
});

// ---- Regenerate (archives the old roadmap after confirmation) ----
els.regenerate.addEventListener("click", async () => {
    const sure = confirm(
        "This archives your current roadmap and lets you generate a new one. Continue?"
    );
    if (!sure) return;
    setVisible(els.view, false);
    await loadRoles();
    setVisible(els.empty, true);
});

els.retry.addEventListener("click", loadRoadmap);

loadRoadmap();


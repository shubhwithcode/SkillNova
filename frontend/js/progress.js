// ====================================================================
// SkillNova - progress.js
// My Progress page: renders roadmap %, completed/pending tasks, skill
// bars, resume + interview history and the activity feed - all from
// GET /api/progress (the student's real saved records).
// ====================================================================

const pg = {
    status: document.getElementById("pgStatus"),
    error: document.getElementById("pgError"),
    errorText: document.getElementById("pgErrorText"),
    retry: document.getElementById("pgRetry"),
    view: document.getElementById("pgView"),
};

const ACTIVITY_ICONS = {
    task_completed: "✓",
    resume_analyzed: "▤",
    interview_completed: "◉",
    roadmap_generated: "⌖",
    profile_updated: "○",
    login: "↗",
};

function toggleEmpty(emptyId, hasData) {
    const element = document.getElementById(emptyId);
    if (element) element.hidden = hasData;
}

function renderProgress(data) {
    // --- Roadmap ---
    const block = document.getElementById("pgRoadmapBlock");
    toggleEmpty("pgRoadmapEmpty", Boolean(data.roadmap));
    block.hidden = !data.roadmap;
    if (data.roadmap) {
        document.getElementById("pgRoadmapTitle").textContent = data.roadmap.title;
        document.getElementById("pgRoadmapBar").style.width = data.roadmap.percent + "%";
        document.getElementById("pgRoadmapPercent").textContent = data.roadmap.percent + "%";
        document.getElementById("pgRoadmapCounts").textContent =
            `${data.roadmap.completed} of ${data.roadmap.total} tasks completed`;
    }

    // --- Completed tasks ---
    const tasksList = document.getElementById("pgTasksList");
    tasksList.innerHTML = "";
    toggleEmpty("pgTasksEmpty", data.completedTasks.length > 0);
    data.completedTasks.forEach((task) => {
        const li = document.createElement("li");
        const when = task.completed_at
            ? ` (${new Date(task.completed_at).toLocaleDateString()})`
            : "";
        li.textContent = `Day ${task.day_number}: ${task.title}${when}`;
        tasksList.append(li);
    });

    // --- Pending concepts ---
    const pendingList = document.getElementById("pgPendingList");
    pendingList.innerHTML = "";
    toggleEmpty("pgPendingEmpty", data.pendingTasks.length > 0);
    data.pendingTasks.forEach((task) => {
        const li = document.createElement("li");
        li.textContent = `Day ${task.day_number}: ${task.title}`;
        pendingList.append(li);
    });

    // --- Skill bars (same style as the dashboard) ---
    const skillList = document.getElementById("pgSkillList");
    skillList.innerHTML = "";
    toggleEmpty("pgSkillsEmpty", data.skills.length > 0);
    data.skills.forEach((skill) => {
        const row = document.createElement("div");
        row.className = "skill-row";
        const label = document.createElement("div");
        label.className = "skill-label";
        const name = document.createElement("span");
        name.textContent = skill.name;
        const value = document.createElement("strong");
        value.textContent = skill.proficiency + "%";
        label.append(name, value);
        const track = document.createElement("div");
        track.className = "skill-track";
        const bar = document.createElement("span");
        bar.style.width = skill.proficiency + "%";
        track.append(bar);
        row.append(label, track);
        skillList.append(row);
    });

    // --- Resume history ---
    const resumeBody = document.getElementById("pgResumeBody");
    resumeBody.innerHTML = "";
    toggleEmpty("pgResumeEmpty", data.resumeHistory.length > 0);
    document.getElementById("pgResumeTable").hidden = data.resumeHistory.length === 0;
    data.resumeHistory.forEach((row) => {
        const tr = document.createElement("tr");
        [new Date(row.created_at).toLocaleDateString(), row.original_name, row.score + "/100"]
            .forEach((text) => {
                const td = document.createElement("td");
                td.textContent = text;
                tr.append(td);
            });
        resumeBody.append(tr);
    });

    // --- Interview history ---
    const ivBody = document.getElementById("pgIvBody");
    ivBody.innerHTML = "";
    const completedIvs = data.interviewHistory.filter((a) => a.status === "completed");
    toggleEmpty("pgIvEmpty", completedIvs.length > 0);
    document.getElementById("pgIvTable").hidden = completedIvs.length === 0;
    completedIvs.forEach((row) => {
        const tr = document.createElement("tr");
        [
            new Date(row.started_at).toLocaleDateString(),
            row.category === "hr" ? "HR" : "Technical",
            row.difficulty,
            (row.total_score ?? "—") + "/100",
        ].forEach((text) => {
            const td = document.createElement("td");
            td.textContent = text;
            tr.append(td);
        });
        ivBody.append(tr);
    });

    // --- Activity feed ---
    const feed = document.getElementById("pgActivityList");
    feed.innerHTML = "";
    toggleEmpty("pgActivityEmpty", data.activities.length > 0);
    data.activities.forEach((activity) => {
        const li = document.createElement("li");
        const icon = document.createElement("span");
        icon.className = "act-icon";
        icon.textContent = ACTIVITY_ICONS[activity.activity_type] || "•";
        const body = document.createElement("span");
        const text = document.createElement("span");
        text.textContent = activity.detail || activity.activity_type;
        const time = document.createElement("time");
        time.textContent = new Date(activity.created_at).toLocaleString();
        body.append(text, time);
        li.append(icon, body);
        feed.append(li);
    });
}

async function loadProgress() {
    pg.status.hidden = false;
    pg.error.hidden = true;
    pg.view.hidden = true;
    try {
        const data = await window.snApi.get("/api/progress");
        renderProgress(data);
        pg.view.hidden = false;
    } catch (error) {
        pg.errorText.textContent = error.message;
        pg.error.hidden = false;
    } finally {
        pg.status.hidden = true;
    }
}

pg.retry.addEventListener("click", loadProgress);
loadProgress();

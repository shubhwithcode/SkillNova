// ====================================================================
// SkillNova - dashboard.js
// Loads the student dashboard from the backend API and renders it.
//
// Data flow:
//   GET /api/dashboard  ->  render all sections
//
// The API currently returns clearly-labelled SAMPLE data
// (response.source === "sample") until MySQL is connected. The
// rendering code below does not care where the data comes from, so
// nothing here changes when the real database arrives.
// ====================================================================

// ----------------------------
// 1. Auth guard + greeting
// ----------------------------

const studentName = sessionStorage.getItem("skillnovaUserName");

if (!studentName) {
    window.location.replace("login.html");
} else {
    document.querySelectorAll("[data-user-name]").forEach((element) => {
        element.textContent = studentName;
    });
}

const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST" });
        } catch (error) {
            // Clear local state even if the request fails.
        }
        sessionStorage.removeItem("skillnovaUserName");
        window.location.href = "login.html";
    });
}

// ----------------------------
// 2. Tiny DOM helpers
// ----------------------------

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function setWidth(id, percent) {
    const element = document.getElementById(id);
    if (element) {
        const safe = Math.max(0, Math.min(100, Number(percent) || 0));
        element.style.width = safe + "%";
    }
}

function show(id, visible) {
    const element = document.getElementById(id);
    if (element) {
        element.hidden = !visible;
    }
}

// ----------------------------
// 3. Render functions (one per dashboard section)
// ----------------------------

function renderWelcome(data) {
    // Prefer the real name from the database when available.
    if (data.student && data.student.name) {
        sessionStorage.setItem("skillnovaUserName", data.student.name);
        document.querySelectorAll("[data-user-name]").forEach((element) => {
            element.textContent = data.student.name;
        });
    }
    setText("factTargetRole", data.student.targetRole);
    setText("factStreak", data.streak.currentDays + " days");
    setText("factReadiness", data.readiness.score + "%");
}

function renderLearningCard(data) {
    const lesson = data.todayLesson;

    // Empty state: no roadmap yet (or all tasks finished).
    if (!lesson) {
        setText("dayCount", "NO ACTIVE PLAN");
        setText("lessonTopic", "No roadmap task yet");
        setText(
            "lessonDescription",
            "Generate your personalized roadmap to see today's learning task here."
        );
        setText("lessonMinutes", "—");
        setText("lessonCount", "0");
        const link = document.getElementById("continueLearningLink");
        if (link) {
            link.href = "roadmap.html";
            link.textContent = "Create my roadmap →";
        }
        return;
    }

    setText("dayCount", `DAY ${lesson.day} OF ${lesson.totalDays}`);
    setText("lessonTopic", lesson.topic);
    setText("lessonDescription", lesson.description);
    setText("lessonMinutes", lesson.estimatedMinutes);
    setText("lessonCount", lesson.lessonCount);

    // Continue Learning opens the exact task on the roadmap page.
    const link = document.getElementById("continueLearningLink");
    if (link && lesson.taskId) {
        link.href = "roadmap.html#task-" + lesson.taskId;
    }

    // Decorative label, e.g. "REACT / 01 / 03"
    const artLabel = document.getElementById("artLabel");
    if (artLabel) {
        const firstWord = lesson.topic.split(" ")[0].toUpperCase();
        const dayText = String(lesson.day).padStart(2, "0");
        const totalText = String(lesson.totalDays).padStart(2, "0");
        artLabel.innerHTML = "";
        artLabel.append(firstWord);
        artLabel.append(document.createElement("br"));
        const strong = document.createElement("strong");
        strong.textContent = `${dayText} / ${totalText}`;
        artLabel.append(strong);
    }
}

function renderWeeklyCard(data) {
    const streak = data.streak;
    const percent = Math.round(
        (streak.daysDoneThisWeek / streak.weeklyGoalDays) * 100
    );

    setText(
        "weeklyChange",
        streak.weeklyChangePercent === null || streak.weeklyChangePercent === undefined
            ? `${streak.daysDoneThisWeek}/${streak.weeklyGoalDays} days`
            : "+" + streak.weeklyChangePercent + "%"
    );
    setText(
        "weeklyMessage",
        data.todayLesson
            ? `Keep your streak alive with today's ${data.todayLesson.estimatedMinutes}-minute lesson.`
            : "Generate a roadmap to start building your weekly streak."
    );
    setWidth("weeklyProgressBar", percent);
    setText(
        "weeklyGoal",
        `${streak.daysDoneThisWeek} of ${streak.weeklyGoalDays} days`
    );
}

function renderMetrics(data) {
    // Job readiness
    setText("readinessValue", data.readiness.score);
    setText(
        "readinessTrend",
        data.readiness.trendPercent === null || data.readiness.trendPercent === undefined
            ? ""
            : "↗ " + data.readiness.trendPercent + "%"
    );
    setWidth("readinessBar", data.readiness.score);
    setText("ctaReadiness", data.readiness.score);

    // Tasks completed on the roadmap
    const summary = data.skillsSummary;
    const skillPercent = summary.total > 0
        ? Math.round((summary.completed / summary.total) * 100)
        : 0;
    setText("skillsCompleted", summary.completed);
    setText("skillsTotal", summary.total);
    setWidth("skillsBar", skillPercent);
    setText(
        "skillsLeftNote",
        summary.total > 0
            ? `${summary.total - summary.completed} tasks left on your path`
            : "Generate a roadmap to start tracking tasks"
    );

    // Streak
    setText("streakValue", data.streak.currentDays);
    setText("bestStreakNote", `Your best streak is ${data.streak.bestDays} days`);

    // Pending concepts = number of identified skill gaps
    setText("pendingConcepts", data.skillGaps.length);
}

function renderSkills(data) {
    const list = document.getElementById("skillList");
    if (!list) {
        return;
    }

    list.innerHTML = "";

    if (!data.skills || data.skills.length === 0) {
        show("skillsEmpty", true);
        return;
    }

    show("skillsEmpty", false);

    data.skills.forEach((skill) => {
        const row = document.createElement("div");
        row.className = "skill-row";

        const label = document.createElement("div");
        label.className = "skill-label";

        const name = document.createElement("span");
        name.textContent = skill.name;

        const value = document.createElement("strong");
        value.textContent = skill.level + "%";

        label.append(name, value);

        const track = document.createElement("div");
        track.className = "skill-track";

        const bar = document.createElement("span");
        bar.style.width = skill.level + "%";
        track.append(bar);

        row.append(label, track);
        list.append(row);
    });
}

function renderSkillGaps(data) {
    const list = document.getElementById("gapList");
    if (!list) {
        return;
    }

    list.innerHTML = "";

    if (!data.skillGaps || data.skillGaps.length === 0) {
        show("gapsEmpty", true);
        return;
    }

    show("gapsEmpty", false);

    data.skillGaps.forEach((gap) => {
        const item = document.createElement("li");

        const name = document.createElement("span");
        name.textContent = gap.name;

        const badge = document.createElement("span");
        badge.className = "gap-priority " + gap.priority;
        badge.textContent = gap.label;

        item.append(name, badge);
        list.append(item);
    });
}

function renderPracticeCards(data) {
    // null score => clear empty state ("--" with explanatory status).
    setText("resumeScore", data.resume.score === null ? "--" : data.resume.score);
    setText("resumeStatus", data.resume.status);
    setText("interviewScore", data.interview.score === null ? "--" : data.interview.score);
    setText("interviewStatus", data.interview.status);
    setText("recommendationText", "\u201C" + data.recommendation + "\u201D");
}

// ----------------------------
// 4. Load from the API
// ----------------------------

async function loadDashboard() {
    show("dashboardLoading", true);
    show("dashboardError", false);
    show("sampleNotice", false);
    show("dashboardContent", false);

    try {
        const response = await fetch("/api/dashboard");

        // Session expired or missing -> go to login instead of an error.
        if (response.status === 401) {
            sessionStorage.removeItem("skillnovaUserName");
            window.location.replace("login.html");
            return;
        }

        if (!response.ok) {
            throw new Error("API responded with status " + response.status);
        }

        const data = await response.json();

        renderWelcome(data);
        renderLearningCard(data);
        renderWeeklyCard(data);
        renderMetrics(data);
        renderSkills(data);
        renderSkillGaps(data);
        renderPracticeCards(data);

        // Tell the student when they are looking at sample data.
        show("sampleNotice", data.source === "sample");
        show("dashboardContent", true);
    } catch (error) {
        console.error("Dashboard load failed:", error);
        show("dashboardError", true);
    } finally {
        show("dashboardLoading", false);
    }
}

const retryButton = document.getElementById("retryButton");

if (retryButton) {
    retryButton.addEventListener("click", loadDashboard);
}

loadDashboard();

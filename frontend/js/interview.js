// ====================================================================
// SkillNova - interview.js
// Mock Interview page: start an attempt, answer one question at a
// time, show per-answer feedback, then the final summary + history.
// ====================================================================

const iv = {
    setupPanel: document.getElementById("setupPanel"),
    setupForm: document.getElementById("setupForm"),
    setupError: document.getElementById("setupError"),
    role: document.getElementById("ivRole"),
    category: document.getElementById("ivCategory"),
    difficulty: document.getElementById("ivDifficulty"),
    startButton: document.getElementById("startButton"),

    panel: document.getElementById("interviewPanel"),
    counter: document.getElementById("questionCounter"),
    questionText: document.getElementById("questionText"),
    answerForm: document.getElementById("answerForm"),
    answerInput: document.getElementById("answerInput"),
    submitButton: document.getElementById("submitAnswerButton"),
    answerStatus: document.getElementById("answerStatus"),
    answerError: document.getElementById("answerError"),

    feedbackBlock: document.getElementById("feedbackBlock"),
    answerScore: document.getElementById("answerScore"),
    answerSource: document.getElementById("answerSource"),
    answerFeedback: document.getElementById("answerFeedback"),
    answerSuggestions: document.getElementById("answerSuggestions"),
    modelAnswer: document.getElementById("modelAnswer"),
    nextButton: document.getElementById("nextButton"),

    summaryPanel: document.getElementById("summaryPanel"),
    finalScore: document.getElementById("finalScore"),
    finalSummary: document.getElementById("finalSummary"),
    newInterviewButton: document.getElementById("newInterviewButton"),

    historyEmpty: document.getElementById("ivHistoryEmpty"),
    historyTable: document.getElementById("ivHistoryTable"),
    historyBody: document.getElementById("ivHistoryBody"),
    attemptDetail: document.getElementById("attemptDetail"),
};

// Interview state
let attemptId = null;
let questions = [];
let currentIndex = 0;

// ---- Load roles ----
async function loadIvRoles() {
    try {
        const data = await window.snApi.get("/api/profile/options");
        iv.role.innerHTML = '<option value="">— Choose a role —</option>';
        data.jobRoles.forEach((role) => {
            const option = document.createElement("option");
            option.value = role.id;
            option.textContent = role.name;
            iv.role.append(option);
        });
    } catch (error) {
        iv.setupError.textContent = error.message;
        iv.setupError.hidden = false;
    }
}

// ---- Start interview ----
iv.setupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    iv.setupError.hidden = true;

    const jobRoleId = Number(iv.role.value) || null;
    const category = iv.category.value;
    if (category === "technical" && !jobRoleId) {
        iv.setupError.textContent = "Please choose a job role for a technical interview.";
        iv.setupError.hidden = false;
        return;
    }

    iv.startButton.disabled = true;
    try {
        const data = await window.snApi.send("/api/interview/start", "POST", {
            jobRoleId,
            category,
            difficulty: iv.difficulty.value,
        });
        attemptId = data.attemptId;
        questions = data.questions;
        currentIndex = 0;

        iv.setupPanel.hidden = true;
        iv.summaryPanel.hidden = true;
        iv.panel.hidden = false;
        showQuestion();
    } catch (error) {
        iv.setupError.textContent = error.message;
        iv.setupError.hidden = false;
    } finally {
        iv.startButton.disabled = false;
    }
});

function showQuestion() {
    const question = questions[currentIndex];
    iv.counter.textContent = `QUESTION ${currentIndex + 1} OF ${questions.length}`;
    iv.questionText.textContent = question.question;
    iv.answerInput.value = "";
    iv.answerForm.hidden = false;
    iv.feedbackBlock.hidden = true;
    iv.answerError.hidden = true;
    iv.answerInput.focus();
}

// ---- Submit an answer ----
iv.answerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    iv.answerError.hidden = true;

    const answerText = iv.answerInput.value.trim();
    if (!answerText) {
        iv.answerError.textContent = "Please write an answer before submitting.";
        iv.answerError.hidden = false;
        return;
    }

    iv.submitButton.disabled = true;
    iv.answerStatus.hidden = false;
    try {
        const data = await window.snApi.send("/api/interview/answer", "POST", {
            attemptId,
            questionId: questions[currentIndex].id,
            answerText,
        });

        iv.answerScore.textContent = data.score;
        iv.answerSource.innerHTML = "";
        const badge = document.createElement("span");
        badge.className = data.source === "ai" ? "badge-ai" : "badge-fallback";
        badge.textContent = data.source === "ai" ? "AI feedback" : "Rule-based (fallback)";
        iv.answerSource.append(badge);

        iv.answerFeedback.textContent = data.feedback;
        iv.answerSuggestions.innerHTML = "";
        (data.suggestions || []).forEach((tip) => {
            const li = document.createElement("li");
            li.textContent = tip;
            iv.answerSuggestions.append(li);
        });
        iv.modelAnswer.textContent = data.modelAnswer || "";

        iv.answerForm.hidden = true;
        iv.feedbackBlock.hidden = false;
        iv.nextButton.textContent =
            currentIndex + 1 < questions.length ? "Next question →" : "Finish interview →";
    } catch (error) {
        iv.answerError.textContent = error.message;
        iv.answerError.hidden = false;
    } finally {
        iv.submitButton.disabled = false;
        iv.answerStatus.hidden = true;
    }
});

// ---- Next / finish ----
iv.nextButton.addEventListener("click", async () => {
    if (currentIndex + 1 < questions.length) {
        currentIndex += 1;
        showQuestion();
        return;
    }
    // Finish the attempt.
    iv.nextButton.disabled = true;
    try {
        const data = await window.snApi.send("/api/interview/finish", "POST", { attemptId });
        iv.panel.hidden = true;
        iv.finalScore.textContent = data.totalScore;
        iv.finalSummary.textContent = data.summary;
        iv.summaryPanel.hidden = false;
        await loadIvHistory();
    } catch (error) {
        alert(error.message);
    } finally {
        iv.nextButton.disabled = false;
    }
});

iv.newInterviewButton.addEventListener("click", () => {
    iv.summaryPanel.hidden = true;
    iv.setupPanel.hidden = false;
});

// ---- History ----
async function loadIvHistory() {
    try {
        const data = await window.snApi.get("/api/interview/history");
        const rows = (data.attempts || []).filter((a) => a.status === "completed");
        iv.historyEmpty.hidden = rows.length > 0;
        iv.historyTable.hidden = rows.length === 0;
        iv.historyBody.innerHTML = "";
        rows.forEach((row) => {
            const tr = document.createElement("tr");
            tr.style.cursor = "pointer";
            tr.title = "Click to review this interview";

            const date = document.createElement("td");
            date.textContent = new Date(row.started_at).toLocaleDateString();
            const type = document.createElement("td");
            type.textContent = row.category === "hr" ? "HR" : "Technical";
            const level = document.createElement("td");
            level.textContent = row.difficulty;
            const score = document.createElement("td");
            score.textContent = (row.total_score ?? "—") + "/100";

            tr.append(date, type, level, score);
            tr.addEventListener("click", () => showAttemptDetail(row.id));
            iv.historyBody.append(tr);
        });
    } catch (error) {
        console.error("Interview history failed:", error.message);
    }
}

// ---- Review one past attempt ----
async function showAttemptDetail(id) {
    try {
        const data = await window.snApi.get("/api/interview/history/" + id);
        iv.attemptDetail.innerHTML = "";

        const heading = document.createElement("h3");
        heading.style.cssText = "font-size:13px; margin:0;";
        heading.textContent =
            `Review: ${data.attempt.category === "hr" ? "HR" : "Technical"} · ` +
            `${data.attempt.difficulty} · ${data.attempt.total_score ?? "—"}/100`;
        iv.attemptDetail.append(heading);

        data.answers.forEach((answer, index) => {
            const block = document.createElement("div");
            block.className = "qa-feedback";

            const q = document.createElement("h4");
            q.textContent = `Q${index + 1}: ${answer.question}`;
            const yourAnswer = document.createElement("p");
            yourAnswer.textContent = "Your answer: " + answer.answer_text;
            const fb = document.createElement("p");
            fb.textContent = `Score ${answer.score}/100 — ${answer.feedback}`;

            block.append(q, yourAnswer, fb);
            iv.attemptDetail.append(block);
        });
        iv.attemptDetail.hidden = false;
    } catch (error) {
        alert(error.message);
    }
}

loadIvRoles();
loadIvHistory();


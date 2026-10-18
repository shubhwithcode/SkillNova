// ====================================================================
// SkillNova - resume.js
// Resume Analyzer page: upload a PDF (multipart), show the analysis
// and keep the history list fresh. Uses window.snApi from page-shell.
// ====================================================================

const resumeEls = {
    form: document.getElementById("uploadForm"),
    roleSelect: document.getElementById("roleSelect"),
    dropzone: document.getElementById("dropzone"),
    fileInput: document.getElementById("resumeFile"),
    fileName: document.getElementById("fileName"),
    analyzeButton: document.getElementById("analyzeButton"),
    status: document.getElementById("analyzeStatus"),
    error: document.getElementById("analyzeError"),
    resultPanel: document.getElementById("resultPanel"),
    resultScore: document.getElementById("resultScore"),
    resultBar: document.getElementById("resultBar"),
    resultSource: document.getElementById("resultSource"),
    strengths: document.getElementById("strengthsList"),
    weaknesses: document.getElementById("weaknessesList"),
    missing: document.getElementById("missingList"),
    suggestions: document.getElementById("suggestionsList"),
    aiBlock: document.getElementById("aiFeedbackBlock"),
    aiText: document.getElementById("aiFeedbackText"),
    historyEmpty: document.getElementById("historyEmpty"),
    historyTable: document.getElementById("historyTable"),
    historyBody: document.getElementById("historyBody"),
};

function fillList(listElement, items, emptyText) {
    listElement.innerHTML = "";
    if (!items || items.length === 0) {
        const li = document.createElement("li");
        li.textContent = emptyText;
        listElement.append(li);
        return;
    }
    items.forEach((text) => {
        const li = document.createElement("li");
        li.textContent = text;
        listElement.append(li);
    });
}

// ---- File selection UX ----
resumeEls.fileInput.addEventListener("change", () => {
    const file = resumeEls.fileInput.files[0];
    resumeEls.fileName.textContent = file ? `Selected: ${file.name}` : "";
});
["dragover", "dragleave", "drop"].forEach((type) => {
    resumeEls.dropzone.addEventListener(type, (event) => {
        event.preventDefault();
        resumeEls.dropzone.classList.toggle("is-drag", type === "dragover");
        if (type === "drop" && event.dataTransfer.files.length) {
            resumeEls.fileInput.files = event.dataTransfer.files;
            resumeEls.fileInput.dispatchEvent(new Event("change"));
        }
    });
});

// ---- Load job roles ----
async function loadResumeRoles() {
    try {
        const data = await window.snApi.get("/api/profile/options");
        data.jobRoles.forEach((role) => {
            const option = document.createElement("option");
            option.value = role.id;
            option.textContent = role.name;
            resumeEls.roleSelect.append(option);
        });
    } catch (error) {
        console.error("Could not load roles:", error.message);
    }
}

// ---- Render one analysis ----
function renderAnalysis(a) {
    resumeEls.resultScore.textContent = a.score;
    resumeEls.resultBar.style.width = a.score + "%";

    resumeEls.resultSource.innerHTML = "";
    const badge = document.createElement("span");
    badge.className = a.source === "ai" ? "badge-ai" : "badge-fallback";
    badge.textContent = a.source === "ai" ? "AI feedback" : "Rule-based (fallback)";
    resumeEls.resultSource.append(badge);

    fillList(resumeEls.strengths, a.strengths, "No clear strengths detected yet.");
    fillList(resumeEls.weaknesses, a.weaknesses, "No major weaknesses detected - nice!");
    fillList(resumeEls.missing, a.missingSkills, "No missing role skills detected.");
    fillList(resumeEls.suggestions, a.suggestions, "No suggestions - great work!");

    if (a.aiFeedback) {
        resumeEls.aiText.textContent = a.aiFeedback;
        resumeEls.aiBlock.hidden = false;
    } else {
        resumeEls.aiBlock.hidden = true;
    }
    resumeEls.resultPanel.hidden = false;
    resumeEls.resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---- History ----
async function loadResumeHistory() {
    try {
        const data = await window.snApi.get("/api/resume/history");
        const rows = data.analyses || [];
        resumeEls.historyEmpty.hidden = rows.length > 0;
        resumeEls.historyTable.hidden = rows.length === 0;
        resumeEls.historyBody.innerHTML = "";
        rows.forEach((row) => {
            const tr = document.createElement("tr");
            tr.style.cursor = "pointer";
            tr.title = "Click to view this report";

            const date = document.createElement("td");
            date.textContent = new Date(row.created_at).toLocaleDateString();
            const file = document.createElement("td");
            file.textContent = row.original_name;
            const score = document.createElement("td");
            score.textContent = row.score + "/100";

            tr.append(date, file, score);
            tr.addEventListener("click", async () => {
                try {
                    const detail = await window.snApi.get("/api/resume/history/" + row.id);
                    renderAnalysis(detail.analysis);
                } catch (error) {
                    alert(error.message);
                }
            });
            resumeEls.historyBody.append(tr);
        });
    } catch (error) {
        console.error("History load failed:", error.message);
    }
}

// ---- Upload & analyze ----
resumeEls.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    resumeEls.error.hidden = true;

    const file = resumeEls.fileInput.files[0];
    if (!file) {
        resumeEls.error.textContent = "Please choose a PDF resume first.";
        resumeEls.error.hidden = false;
        return;
    }
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
        resumeEls.error.textContent = "Only PDF files are supported.";
        resumeEls.error.hidden = false;
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        resumeEls.error.textContent = "File is too large (max 5 MB).";
        resumeEls.error.hidden = false;
        return;
    }

    const formData = new FormData();
    formData.append("resume", file);
    if (resumeEls.roleSelect.value) {
        formData.append("jobRoleId", resumeEls.roleSelect.value);
    }

    resumeEls.analyzeButton.disabled = true;
    resumeEls.status.hidden = false;
    resumeEls.resultPanel.hidden = true;
    try {
        const response = await fetch("/api/resume/analyze", { method: "POST", body: formData });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
            window.location.replace("login.html");
            return;
        }
        if (!response.ok) {
            throw new Error(data.error || "Analysis failed. Please try again.");
        }
        renderAnalysis(data);
        await loadResumeHistory();
    } catch (error) {
        resumeEls.error.textContent = error.message;
        resumeEls.error.hidden = false;
    } finally {
        resumeEls.analyzeButton.disabled = false;
        resumeEls.status.hidden = true;
    }
});

loadResumeRoles();
loadResumeHistory();


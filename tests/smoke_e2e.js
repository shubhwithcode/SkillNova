// ====================================================================
// SkillNova - tests/smoke_e2e.js
// End-to-end smoke test of the full student journey against a RUNNING
// server (npm start first). Uses real HTTP + the session cookie.
//
//   node tests/smoke_e2e.js
//
// Steps: register -> profile -> skills -> roadmap -> complete task ->
// resume upload -> interview -> progress -> dashboard -> security check.
// Exits with code 1 on the first failure.
// ====================================================================

const fs = require("fs");
const path = require("path");

const BASE = "http://localhost:3000";
let cookie = ""; // session cookie for student A
let passed = 0;

function check(name, condition, detail) {
    if (!condition) {
        console.error(`FAIL  ${name}${detail ? " - " + detail : ""}`);
        process.exit(1);
    }
    passed += 1;
    console.log(`ok ${String(passed).padStart(2)} - ${name}`);
}

function saveCookie(response) {
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
}

async function api(method, url, body, useCookie = cookie) {
    const headers = {};
    if (useCookie) headers.Cookie = useCookie;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(BASE + url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    saveCookie(response);
    return { status: response.status, data: await response.json().catch(() => ({})) };
}

async function main() {
    const stamp = Date.now();
    const email = `richa.e2e.${stamp}@test.com`;

    // 1. Register (also logs in)
    let r = await api("POST", "/api/auth/register", {
        fullName: "Richa Upadhyay",
        email,
        password: "testpass123",
    });
    check("register returns 201 + user", r.status === 201 && r.data.user.id > 0, JSON.stringify(r.data));

    // 2. Duplicate email is rejected
    r = await api("POST", "/api/auth/register", {
        fullName: "Clone", email, password: "testpass123",
    }, ""); // no cookie - fresh visitor
    check("duplicate email rejected (409)", r.status === 409);

    // 3. Session works
    r = await api("GET", "/api/auth/me");
    check("GET /auth/me sees the session", r.status === 200 && r.data.user.fullName === "Richa Upadhyay");

    // 4. Save profile (target role: Full Stack Developer = 1)
    r = await api("PUT", "/api/profile", {
        fullName: "Richa Upadhyay", college: "TIMSCDR, Mumbai", degree: "MCA",
        graduationYear: 2027, targetRoleId: 1,
        softSkills: "Communication, teamwork",
        certifications: "freeCodeCamp Responsive Web Design",
    });
    check("profile saved", r.status === 200, JSON.stringify(r.data));

    // 5. Save skills (strong HTML/CSS, weak Node.js)
    r = await api("PUT", "/api/profile/skills", {
        skills: [
            { skillId: 1, proficiency: 90 }, { skillId: 2, proficiency: 85 },
            { skillId: 3, proficiency: 70 }, { skillId: 7, proficiency: 40 },
            { skillId: 11, proficiency: 55 },
        ],
    });
    check("skills saved", r.status === 200);

    r = await api("GET", "/api/profile");
    check("profile loads with 5 skills + role name",
        r.data.skills.length === 5 && r.data.profile.target_role_name === "Full Stack Developer");

    // 6. Generate roadmap (AI or labelled fallback)
    r = await api("POST", "/api/roadmap/generate", { jobRoleId: 1 });
    check("roadmap generated (source=" + r.data.source + ")",
        r.status === 201 && ["ai", "fallback"].includes(r.data.source));

    r = await api("GET", "/api/roadmap");
    const roadmap = r.data.roadmap;
    check("roadmap has 14 tasks + progress 0%",
        roadmap && roadmap.tasks.length === 14 && roadmap.progress.percent === 0);

    // 7. Complete the first task
    r = await api("PUT", "/api/roadmap/tasks/" + roadmap.tasks[0].id, { status: "completed" });
    check("task marked complete", r.status === 200);

    r = await api("GET", "/api/roadmap");
    check("progress updated to 7% (1/14)", r.data.roadmap.progress.percent === 7);

    await part2(stamp, email, roadmap);
}

async function part2(stamp, email, roadmap) {
    // 8. Resume upload (multipart with the generated sample PDF)
    const pdfPath = path.join(__dirname, "fixtures", "sample_resume.pdf");
    const form = new FormData();
    form.append("resume", new Blob([fs.readFileSync(pdfPath)], { type: "application/pdf" }), "sample_resume.pdf");
    form.append("jobRoleId", "1");
    const uploadResponse = await fetch(BASE + "/api/resume/analyze", {
        method: "POST", headers: { Cookie: cookie }, body: form,
    });
    const uploadData = await uploadResponse.json();
    check("resume analyzed (score=" + uploadData.score + ", source=" + uploadData.source + ")",
        uploadResponse.status === 201 && uploadData.score > 0 && uploadData.score <= 100,
        JSON.stringify(uploadData));

    let r = await api("GET", "/api/resume/history");
    check("resume history has 1 entry", r.data.analyses.length === 1);

    // 9. Invalid upload is rejected honestly
    const badForm = new FormData();
    badForm.append("resume", new Blob([fs.readFileSync(path.join(__dirname, "fixtures", "fake.pdf"))], { type: "application/pdf" }), "fake.pdf");
    const badResponse = await fetch(BASE + "/api/resume/analyze", {
        method: "POST", headers: { Cookie: cookie }, body: badForm,
    });
    check("corrupt PDF rejected (422)", badResponse.status === 422);

    // 10. Mock interview: start -> answer all -> finish
    r = await api("POST", "/api/interview/start", {
        jobRoleId: 1, category: "technical", difficulty: "beginner",
    });
    const attemptId = r.data.attemptId;
    const questions = r.data.questions;
    check("interview started with questions", r.status === 201 && questions.length > 0);

    // Empty answer must be rejected
    r = await api("POST", "/api/interview/answer", {
        attemptId, questionId: questions[0].id, answerText: "   ",
    });
    check("empty answer rejected (400)", r.status === 400);

    for (const question of questions) {
        r = await api("POST", "/api/interview/answer", {
            attemptId,
            questionId: question.id,
            answerText:
                "An API is an interface that lets a client send a request to a server " +
                "and get a JSON response. For example, a browser calls GET /users and " +
                "the server returns data. HTML gives structure, CSS styling and " +
                "JavaScript behaviour in the browser.",
        });
        check(`answer evaluated (score=${r.data.score}, source=${r.data.source})`,
            r.status === 201 && r.data.score >= 0 && r.data.score <= 100);
    }

    r = await api("POST", "/api/interview/finish", { attemptId });
    check("interview finished (total=" + r.data.totalScore + ")",
        r.status === 200 && r.data.totalScore >= 0);

    // 11. Progress page data
    r = await api("GET", "/api/progress");
    check("progress shows roadmap + histories + activity",
        r.data.roadmap.completed === 1 &&
        r.data.resumeHistory.length === 1 &&
        r.data.interviewHistory.length === 1 &&
        r.data.activities.length >= 4);

    // 12. Dashboard uses real data
    r = await api("GET", "/api/dashboard");
    check("dashboard source=database, readiness>0, streak>=1",
        r.data.source === "database" && r.data.readiness.score > 0 &&
        r.data.streak.currentDays >= 1 && r.data.resume.score !== null,
        JSON.stringify({ source: r.data.source, readiness: r.data.readiness, streak: r.data.streak }));

    // 13. SECURITY: student B cannot see student A's records
    const cookieA = cookie;
    cookie = "";
    r = await api("POST", "/api/auth/register", {
        fullName: "Intruder", email: `intruder.${stamp}@test.com`, password: "testpass123",
    });
    check("student B registered", r.status === 201);

    r = await api("GET", "/api/roadmap");
    check("student B sees NO roadmap (isolation)", r.data.roadmap === null);
    r = await api("GET", "/api/resume/history");
    check("student B sees NO resume history", r.data.analyses.length === 0);
    r = await api("PUT", "/api/roadmap/tasks/" + roadmap.tasks[1].id, { status: "completed" });
    check("student B cannot modify A's task (404)", r.status === 404);

    // 14. Logout invalidates the session
    cookie = cookieA;
    r = await api("POST", "/api/auth/logout");
    check("logout ok", r.status === 200);
    r = await api("GET", "/api/profile");
    check("after logout, profile requires login (401)", r.status === 401);

    // 15. Login again - records persist
    r = await api("POST", "/api/auth/login", { email, password: "testpass123" });
    check("re-login works", r.status === 200);
    r = await api("GET", "/api/roadmap");
    check("roadmap restored after re-login (1 task done)",
        r.data.roadmap.progress.completed === 1);

    console.log(`\nALL ${passed} E2E CHECKS PASSED`);
}

main().catch((error) => {
    console.error("E2E run failed:", error.message);
    process.exit(1);
});

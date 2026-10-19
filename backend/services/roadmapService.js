// ====================================================================
// SkillNova - services/roadmapService.js
// Builds a personalized day-by-day roadmap.
//
// 1. generateWithAi()  - asks Gemini for a JSON roadmap based on the
//    student's target role + current skill levels.
// 2. generateFallback() - rule-based plan built from the job_role_skills
//    table: skills the student is weakest in (vs importance) come first.
//    The result is honestly labelled source:"fallback".
// ====================================================================

const { isAiConfigured, callGemini, extractJson } = require("./aiService");

const DAYS = 14;

// ---- AI generation ----
async function generateWithAi(roleName, studentSkills, gapSkills) {
    const skillText = studentSkills.length
        ? studentSkills.map((s) => `${s.name}: ${s.proficiency}/100`).join(", ")
        : "No skills assessed yet";
    const gapText = gapSkills.map((g) => g.name).join(", ") || "unknown";

    const prompt = `You are a placement-preparation mentor for an Indian MCA student.
Create a personalized ${DAYS}-day learning roadmap for the target role "${roleName}".
Student's current skills (0-100): ${skillText}.
Most important skill gaps to fix: ${gapText}.
Prioritize weak but important skills first. Keep each day practical (60-120 minutes).
Reply with ONLY valid JSON, no markdown, exactly this shape:
{"title":"...","days":[{"day":1,"title":"...","description":"2-3 sentence practical task","estimatedMinutes":90,"resources":[{"label":"...","url":"https://..."}]}]}
Rules: exactly ${DAYS} entries in "days", 1-2 real free resources per day
(MDN, freeCodeCamp, W3Schools, official docs, YouTube), valid URLs.`;

    const text = await callGemini(prompt);
    const parsed = extractJson(text);

    if (!parsed || !Array.isArray(parsed.days) || parsed.days.length === 0) {
        throw new Error("AI returned an invalid roadmap format.");
    }

    return {
        source: "ai",
        title: String(parsed.title || `${roleName} roadmap`).slice(0, 150),
        days: parsed.days.slice(0, DAYS).map((d, i) => ({
            day: i + 1,
            title: String(d.title || `Day ${i + 1}`).slice(0, 200),
            description: String(d.description || "").slice(0, 2000),
            estimatedMinutes: Math.min(240, Math.max(15, Number(d.estimatedMinutes) || 60)),
            resources: (Array.isArray(d.resources) ? d.resources : [])
                .slice(0, 3)
                .filter((r) => r && r.url && /^https:\/\//.test(String(r.url)))
                .map((r) => ({
                    label: String(r.label || "Resource").slice(0, 120),
                    url: String(r.url).slice(0, 300),
                })),
        })),
    };
}

// ---- Rule-based fallback ----
// gapSkills: [{ name, importance, proficiency }] sorted by priority.
function generateFallback(roleName, gapSkills) {
    const topGaps = gapSkills.slice(0, 7);
    const names = topGaps.length
        ? topGaps.map((g) => g.name)
        : ["Core fundamentals", "Practice projects"];

    const days = [];
    for (let day = 1; day <= DAYS; day++) {
        // Rotate through gap skills: learn (odd pass) then practice (even pass).
        const skill = names[(day - 1) % names.length];
        const isPractice = Math.floor((day - 1) / names.length) % 2 === 1;
        days.push({
            day,
            title: isPractice ? `Practice: ${skill}` : `Learn: ${skill}`,
            description: isPractice
                ? `Apply ${skill} in a small hands-on exercise or mini project. ` +
                  `Write code yourself, break it, and fix it - active practice beats re-reading notes.`
                : `Study the fundamentals of ${skill} needed for a ${roleName} role. ` +
                  `Take short notes and finish with one small exercise to check your understanding.`,
            estimatedMinutes: 90,
            resources: [
                {
                    label: `freeCodeCamp: search "${skill}"`,
                    url: "https://www.freecodecamp.org/news/search/?query=" + encodeURIComponent(skill),
                },
                {
                    label: `MDN: search "${skill}"`,
                    url: "https://developer.mozilla.org/en-US/search?q=" + encodeURIComponent(skill),
                },
            ],
        });
    }

    return {
        source: "fallback",
        title: `${roleName} - ${DAYS}-day starter roadmap`,
        days,
    };
}

async function generateRoadmap(roleName, studentSkills, gapSkills) {
    if (isAiConfigured()) {
        try {
            return await generateWithAi(roleName, studentSkills, gapSkills);
        } catch (error) {
            console.error("[AI] Roadmap generation failed, using fallback:", error.message);
        }
    }
    return generateFallback(roleName, gapSkills);
}

module.exports = { generateRoadmap, generateFallback, DAYS };

// ====================================================================
// SkillNova - services/resumeService.js
//
// 1. extractPdf(filePath)
//    Runs "python python_service/extract_resume.py <file>" as a child
//    process and parses the single JSON line it prints. This is the
//    documented Node <-> Python interface.
//
// 2. scoreResume(extracted, roleSkills)
//    DOCUMENTED SCORING METHOD (out of 100). The score is indicative -
//    it does NOT guarantee ATS compatibility or placement:
//      - Sections present (education/skills/projects/experience/
//        achievements/certifications): 5 points each ..... max 30
//      - Contact email found ............................. 10
//      - Portfolio/profile link (GitHub/LinkedIn/site) .... 10
//      - Role skills found in resume text: proportional ... max 30
//      - Measurable achievements (numbers/percent) ........ 10
//      - Reasonable length (300+ words) ................... 10
//
// 3. buildAiFeedback(...) - optional Gemini feedback text.
// ====================================================================

const path = require("path");
const { execFile } = require("child_process");
const { isAiConfigured, callGemini } = require("./aiService");

const SCRIPT = path.join(__dirname, "..", "..", "python_service", "extract_resume.py");
const PYTHON = process.env.PYTHON_COMMAND || "python";

function extractPdf(filePath) {
    return new Promise((resolve, reject) => {
        execFile(
            PYTHON,
            [SCRIPT, filePath],
            { timeout: 60000, maxBuffer: 10 * 1024 * 1024, windowsHide: true },
            (error, stdout) => {
                if (error && !stdout) {
                    return reject(new Error("Python extraction failed: " + error.message));
                }
                try {
                    resolve(JSON.parse(stdout.trim()));
                } catch {
                    reject(new Error("Python returned invalid JSON."));
                }
            }
        );
    });
}

// roleSkills: [{ name, importance }] for the chosen target role.
function scoreResume(extracted, roleSkills) {
    const text = (extracted.text || "").toLowerCase();
    const words = text.split(/\s+/).filter(Boolean).length;
    const breakdown = {};
    const strengths = [];
    const weaknesses = [];
    const suggestions = [];

    // 1. Sections (max 30)
    const wantedSections = ["education", "skills", "projects", "experience", "achievements", "certifications"];
    const found = wantedSections.filter((s) => extracted.sections.includes(s));
    breakdown.sections = found.length * 5;
    found.forEach((s) => strengths.push(`Has a clear ${s} section.`));
    wantedSections
        .filter((s) => !found.includes(s))
        .forEach((s) => {
            weaknesses.push(`No ${s} section detected.`);
            suggestions.push(`Add a dedicated "${s}" section with a clear heading.`);
        });

    // 2. Contact email (10)
    breakdown.contact = extracted.emails.length > 0 ? 10 : 0;
    if (breakdown.contact) {
        strengths.push("Contact email is present.");
    } else {
        weaknesses.push("No contact email found.");
        suggestions.push("Add your email address near the top of the resume.");
    }

    // 3. Portfolio / profile links (10)
    const hasLink = extracted.links.length > 0;
    breakdown.links = hasLink ? 10 : 0;
    if (hasLink) {
        strengths.push("Includes portfolio/profile links (e.g. GitHub or LinkedIn).");
    } else {
        weaknesses.push("No GitHub/LinkedIn/portfolio link found.");
        suggestions.push("Add a GitHub and LinkedIn link so recruiters can see your work.");
    }

    // 4. Role skill match (max 30, proportional)
    const matched = [];
    const missing = [];
    for (const skill of roleSkills) {
        if (text.includes(skill.name.toLowerCase())) {
            matched.push(skill.name);
        } else {
            missing.push(skill.name);
        }
    }
    breakdown.skillMatch = roleSkills.length
        ? Math.round((matched.length / roleSkills.length) * 30)
        : 15; // neutral half-credit when no role selected
    if (matched.length) {
        strengths.push(`Mentions ${matched.length} skills relevant to the target role: ${matched.slice(0, 6).join(", ")}.`);
    }
    if (missing.length) {
        suggestions.push(`Add (and learn) missing role skills: ${missing.slice(0, 6).join(", ")}.`);
    }

    // 5. Measurable achievements (10)
    const hasNumbers = /\b\d+\s*(%|percent|\+|users|projects|students|members|marks|cgpa|gpa)\b/i.test(extracted.text || "");
    breakdown.achievements = hasNumbers ? 10 : 0;
    if (hasNumbers) {
        strengths.push("Uses measurable numbers to describe achievements.");
    } else {
        weaknesses.push("Project/achievement descriptions have no measurable numbers.");
        suggestions.push('Quantify results, e.g. "improved page load time by 40%".');
    }

    // 6. Length (10)
    breakdown.length = words >= 300 ? 10 : words >= 150 ? 5 : 0;
    if (words < 300) {
        weaknesses.push(`Resume text is short (~${words} words).`);
        suggestions.push("Expand project descriptions: what you built, the tech used, and the result.");
    }

    const score = Math.min(
        100,
        breakdown.sections + breakdown.contact + breakdown.links +
        breakdown.skillMatch + breakdown.achievements + breakdown.length
    );

    return { score, breakdown, strengths, weaknesses, suggestions, missingSkills: missing };
}

async function buildAiFeedback(roleName, extracted, analysis) {
    if (!isAiConfigured()) {
        return null;
    }
    try {
        const prompt = `You are a friendly placement mentor. A student targeting the role "${roleName}" ` +
            `got a resume score of ${analysis.score}/100.\n` +
            `Detected weaknesses: ${analysis.weaknesses.join("; ") || "none"}.\n` +
            `Missing role skills: ${analysis.missingSkills.join(", ") || "none"}.\n` +
            `Resume text (truncated):\n${(extracted.text || "").slice(0, 4000)}\n\n` +
            `Write 4-6 short, specific, encouraging bullet points on how to improve this resume ` +
            `for the "${roleName}" role. Plain text bullets starting with "- ", no markdown headings.`;
        return await callGemini(prompt);
    } catch (error) {
        console.error("[AI] Resume feedback failed, using rule-based only:", error.message);
        return null;
    }
}

module.exports = { extractPdf, scoreResume, buildAiFeedback };

// ====================================================================
// SkillNova - resumeController.js
// Upload -> Python extraction -> documented scoring -> optional AI
// feedback -> saved to MySQL. All reads filter by the session user id,
// so nobody can open another student's analysis.
// ====================================================================

const fs = require("fs");
const { pool } = require("../config/database");
const { extractPdf, scoreResume, buildAiFeedback } = require("../services/resumeService");

// ---- POST /api/resume/analyze ----
async function analyzeResume(req, res) {
    const file = req.file;
    try {
        if (!file) {
            return res.status(400).json({ error: "Please choose a PDF resume to upload." });
        }

        // Which role to compare against: request body, else saved profile.
        let jobRoleId = Number(req.body.jobRoleId) || null;
        if (!jobRoleId) {
            const [profile] = await pool.execute(
                "SELECT target_role_id FROM student_profiles WHERE user_id = ?",
                [req.session.userId]
            );
            jobRoleId = profile[0]?.target_role_id || null;
        }

        let roleName = "a software role";
        let roleSkills = [];
        if (jobRoleId) {
            const [roleRows] = await pool.execute(
                "SELECT name FROM job_roles WHERE id = ?", [jobRoleId]
            );
            if (roleRows.length === 0) {
                jobRoleId = null;
            } else {
                roleName = roleRows[0].name;
                const [skillRows] = await pool.execute(
                    `SELECT s.name, jrs.importance
                     FROM job_role_skills jrs JOIN skills s ON s.id = jrs.skill_id
                     WHERE jrs.job_role_id = ?`,
                    [jobRoleId]
                );
                roleSkills = skillRows;
            }
        }

        // ---- Python extraction (documented subprocess interface) ----
        const extracted = await extractPdf(file.path);
        if (!extracted.ok) {
            // Honest failure: delete the upload, do NOT pretend we analyzed it.
            fs.unlink(file.path, () => {});
            return res.status(422).json({ error: extracted.error });
        }

        // ---- Documented scoring ----
        const analysis = scoreResume(extracted, roleSkills);

        // ---- Optional AI feedback (null if not configured/unavailable) ----
        const aiFeedback = await buildAiFeedback(roleName, extracted, analysis);
        const source = aiFeedback ? "ai" : "fallback";

        // ---- Save to MySQL ----
        const [resumeRow] = await pool.execute(
            `INSERT INTO resumes (user_id, original_name, stored_name, size_bytes)
             VALUES (?, ?, ?, ?)`,
            [req.session.userId, file.originalname.slice(0, 255), file.filename, file.size]
        );
        const [analysisRow] = await pool.execute(
            `INSERT INTO resume_analyses
               (resume_id, user_id, job_role_id, score, score_breakdown,
                strengths, weaknesses, missing_skills, suggestions, ai_feedback, source)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [resumeRow.insertId, req.session.userId, jobRoleId, analysis.score,
             JSON.stringify(analysis.breakdown), JSON.stringify(analysis.strengths),
             JSON.stringify(analysis.weaknesses), JSON.stringify(analysis.missingSkills),
             JSON.stringify(analysis.suggestions), aiFeedback, source]
        );

        await pool.execute(
            "INSERT INTO activity_log (user_id, activity_type, detail) VALUES (?, 'resume_analyzed', ?)",
            [req.session.userId, `Resume analyzed - score ${analysis.score}/100`]
        );

        res.status(201).json({
            analysisId: analysisRow.insertId,
            score: analysis.score,
            breakdown: analysis.breakdown,
            strengths: analysis.strengths,
            weaknesses: analysis.weaknesses,
            missingSkills: analysis.missingSkills,
            suggestions: analysis.suggestions,
            aiFeedback,
            source,
            roleName,
            note: "This score is an indicative assessment and does not guarantee ATS compatibility or placement.",
        });
    } catch (error) {
        console.error("Resume analyze error:", error);
        if (file) fs.unlink(file.path, () => {});
        res.status(500).json({ error: "Resume analysis failed. Please try again." });
    }
}

// ---- GET /api/resume/history ----
async function getHistory(req, res) {
    try {
        const [rows] = await pool.execute(
            `SELECT ra.id, ra.score, ra.source, ra.created_at,
                    r.original_name, jr.name AS role_name
             FROM resume_analyses ra
             JOIN resumes r ON r.id = ra.resume_id
             LEFT JOIN job_roles jr ON jr.id = ra.job_role_id
             WHERE ra.user_id = ?
             ORDER BY ra.created_at DESC
             LIMIT 20`,
            [req.session.userId]
        );
        res.json({ analyses: rows });
    } catch (error) {
        console.error("Resume history error:", error);
        res.status(500).json({ error: "Could not load your resume history." });
    }
}

// ---- GET /api/resume/history/:id ----
async function getAnalysis(req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id < 1) {
            return res.status(400).json({ error: "Invalid analysis id." });
        }
        // user_id filter = privacy: only MY analysis can be returned.
        const [rows] = await pool.execute(
            `SELECT ra.*, r.original_name, jr.name AS role_name
             FROM resume_analyses ra
             JOIN resumes r ON r.id = ra.resume_id
             LEFT JOIN job_roles jr ON jr.id = ra.job_role_id
             WHERE ra.id = ? AND ra.user_id = ?`,
            [id, req.session.userId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: "Analysis not found." });
        }
        const row = rows[0];
        res.json({
            analysis: {
                id: row.id,
                score: row.score,
                source: row.source,
                createdAt: row.created_at,
                originalName: row.original_name,
                roleName: row.role_name,
                breakdown: row.score_breakdown ? JSON.parse(row.score_breakdown) : {},
                strengths: row.strengths ? JSON.parse(row.strengths) : [],
                weaknesses: row.weaknesses ? JSON.parse(row.weaknesses) : [],
                missingSkills: row.missing_skills ? JSON.parse(row.missing_skills) : [],
                suggestions: row.suggestions ? JSON.parse(row.suggestions) : [],
                aiFeedback: row.ai_feedback,
            },
        });
    } catch (error) {
        console.error("Get analysis error:", error);
        res.status(500).json({ error: "Could not load the analysis." });
    }
}

module.exports = { analyzeResume, getHistory, getAnalysis };

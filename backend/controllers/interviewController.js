// ====================================================================
// SkillNova - interviewController.js
// Text-based mock interview using the seeded question bank.
// Final attempt score = average of the per-answer scores (documented,
// not random). Every query filters by the session user id.
// ====================================================================

const { pool } = require("../config/database");
const { evaluateAnswer } = require("../services/interviewService");

const CATEGORIES = ["technical", "hr"];
const DIFFICULTIES = ["beginner", "intermediate", "advanced"];
const QUESTIONS_PER_INTERVIEW = 3;

// ---- POST /api/interview/start ----
async function startInterview(req, res) {
    try {
        const userId = req.session.userId;
        const jobRoleId = Number(req.body.jobRoleId) || null;
        const category = String(req.body.category || "");
        const difficulty = String(req.body.difficulty || "");

        if (!CATEGORIES.includes(category)) {
            return res.status(400).json({ error: "Choose Technical or HR." });
        }
        if (!DIFFICULTIES.includes(difficulty)) {
            return res.status(400).json({ error: "Choose a difficulty level." });
        }
        if (category === "technical" && !jobRoleId) {
            return res.status(400).json({ error: "Choose a job role for a technical interview." });
        }

        // HR questions are shared (job_role_id NULL); technical are per-role.
        let questions;
        if (category === "hr") {
            [questions] = await pool.execute(
                `SELECT id, question FROM interview_questions
                 WHERE category = 'hr' AND difficulty = ?
                 ORDER BY RAND() LIMIT ${QUESTIONS_PER_INTERVIEW}`,
                [difficulty]
            );
        } else {
            [questions] = await pool.execute(
                `SELECT id, question FROM interview_questions
                 WHERE category = 'technical' AND difficulty = ? AND job_role_id = ?
                 ORDER BY RAND() LIMIT ${QUESTIONS_PER_INTERVIEW}`,
                [difficulty, jobRoleId]
            );
        }

        if (questions.length === 0) {
            return res.status(404).json({
                error: "No questions available for this combination yet. Try another difficulty.",
            });
        }

        const [attempt] = await pool.execute(
            `INSERT INTO interview_attempts (user_id, job_role_id, category, difficulty)
             VALUES (?, ?, ?, ?)`,
            [userId, jobRoleId, category, difficulty]
        );

        res.status(201).json({
            attemptId: attempt.insertId,
            questions, // [{id, question}] - key_points stay server-side
        });
    } catch (error) {
        console.error("Start interview error:", error);
        res.status(500).json({ error: "Could not start the interview." });
    }
}

// ---- POST /api/interview/answer ----
async function submitAnswer(req, res) {
    try {
        const userId = req.session.userId;
        const attemptId = Number(req.body.attemptId);
        const questionId = Number(req.body.questionId);
        const answerText = String(req.body.answerText || "").trim();

        if (!Number.isInteger(attemptId) || !Number.isInteger(questionId)) {
            return res.status(400).json({ error: "Invalid attempt or question id." });
        }
        if (!answerText) {
            return res.status(400).json({ error: "Please write an answer before submitting." });
        }
        if (answerText.length > 5000) {
            return res.status(400).json({ error: "Answer is too long (max 5000 characters)." });
        }

        // Ownership check: the attempt must be mine and still open.
        const [attempts] = await pool.execute(
            `SELECT id FROM interview_attempts
             WHERE id = ? AND user_id = ? AND status = 'in_progress'`,
            [attemptId, userId]
        );
        if (attempts.length === 0) {
            return res.status(404).json({ error: "Interview attempt not found or already finished." });
        }

        const [questions] = await pool.execute(
            "SELECT id, question, key_points FROM interview_questions WHERE id = ?",
            [questionId]
        );
        if (questions.length === 0) {
            return res.status(404).json({ error: "Question not found." });
        }
        const question = questions[0];
        const keyPoints = question.key_points ? JSON.parse(question.key_points) : [];

        // Evaluate (AI when configured, else documented rule-based fallback).
        const result = await evaluateAnswer(question.question, keyPoints, answerText);

        await pool.execute(
            `INSERT INTO interview_answers
               (attempt_id, question_id, answer_text, score, feedback,
                suggestions, model_answer, source)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [attemptId, questionId, answerText, result.score, result.feedback,
             JSON.stringify(result.suggestions), result.modelAnswer, result.source]
        );

        res.status(201).json({
            score: result.score,
            feedback: result.feedback,
            suggestions: result.suggestions,
            modelAnswer: result.modelAnswer,
            source: result.source,
        });
    } catch (error) {
        console.error("Submit answer error:", error);
        res.status(500).json({ error: "Could not evaluate your answer." });
    }
}

// ---- POST /api/interview/finish ----
async function finishInterview(req, res) {
    try {
        const userId = req.session.userId;
        const attemptId = Number(req.body.attemptId);

        const [answers] = await pool.execute(
            `SELECT ia.score FROM interview_answers ia
             JOIN interview_attempts att ON att.id = ia.attempt_id
             WHERE ia.attempt_id = ? AND att.user_id = ?`,
            [attemptId, userId]
        );
        if (answers.length === 0) {
            return res.status(400).json({ error: "Answer at least one question first." });
        }

        // Documented: final score = average of per-answer scores.
        const total = Math.round(
            answers.reduce((sum, a) => sum + (a.score || 0), 0) / answers.length
        );
        const summary =
            total >= 75 ? "Strong performance - keep polishing your examples."
            : total >= 50 ? "Decent attempt - review the suggested concepts and retry."
            : "Needs practice - study the model answers and try again soon.";

        const [result] = await pool.execute(
            `UPDATE interview_attempts
             SET status = 'completed', total_score = ?, summary = ?, finished_at = NOW()
             WHERE id = ? AND user_id = ? AND status = 'in_progress'`,
            [total, summary, attemptId, userId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Attempt not found or already finished." });
        }

        await pool.execute(
            "INSERT INTO activity_log (user_id, activity_type, detail) VALUES (?, 'interview_completed', ?)",
            [userId, `Mock interview completed - score ${total}/100`]
        );

        res.json({ totalScore: total, summary, answered: answers.length });
    } catch (error) {
        console.error("Finish interview error:", error);
        res.status(500).json({ error: "Could not finish the interview." });
    }
}

// ---- GET /api/interview/history ----
async function getHistory(req, res) {
    try {
        const [rows] = await pool.execute(
            `SELECT att.id, att.category, att.difficulty, att.status,
                    att.total_score, att.summary, att.started_at, att.finished_at,
                    jr.name AS role_name
             FROM interview_attempts att
             LEFT JOIN job_roles jr ON jr.id = att.job_role_id
             WHERE att.user_id = ?
             ORDER BY att.started_at DESC
             LIMIT 20`,
            [req.session.userId]
        );
        res.json({ attempts: rows });
    } catch (error) {
        console.error("Interview history error:", error);
        res.status(500).json({ error: "Could not load your interview history." });
    }
}

// ---- GET /api/interview/history/:id ----
async function getAttempt(req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id < 1) {
            return res.status(400).json({ error: "Invalid attempt id." });
        }
        const [attempts] = await pool.execute(
            `SELECT att.id, att.category, att.difficulty, att.status,
                    att.total_score, att.summary, att.started_at, att.finished_at,
                    jr.name AS role_name
             FROM interview_attempts att
             LEFT JOIN job_roles jr ON jr.id = att.job_role_id
             WHERE att.id = ? AND att.user_id = ?`,
            [id, req.session.userId]
        );
        if (attempts.length === 0) {
            return res.status(404).json({ error: "Attempt not found." });
        }

        const [answers] = await pool.execute(
            `SELECT ia.answer_text, ia.score, ia.feedback, ia.suggestions,
                    ia.model_answer, ia.source, iq.question
             FROM interview_answers ia
             JOIN interview_questions iq ON iq.id = ia.question_id
             WHERE ia.attempt_id = ?
             ORDER BY ia.id`,
            [id]
        );

        res.json({
            attempt: attempts[0],
            answers: answers.map((a) => ({
                ...a,
                suggestions: a.suggestions ? JSON.parse(a.suggestions) : [],
            })),
        });
    } catch (error) {
        console.error("Get attempt error:", error);
        res.status(500).json({ error: "Could not load the attempt." });
    }
}

module.exports = {
    startInterview,
    submitAnswer,
    finishInterview,
    getHistory,
    getAttempt,
};

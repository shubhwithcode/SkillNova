// ====================================================================
// SkillNova - roadmapController.js
// Generates, stores and updates the student's learning roadmap.
// Skill gaps = skills required for the target role (job_role_skills)
// where the student's proficiency is below 60, ordered by
// (importance DESC, proficiency ASC) -> most critical gap first.
// ====================================================================

const { pool } = require("../config/database");
const { generateRoadmap } = require("../services/roadmapService");

// Shared helper: the student's gap list for a role.
async function getGapSkills(userId, roleId) {
    const [rows] = await pool.execute(
        `SELECT s.id, s.name, jrs.importance,
                COALESCE(ss.proficiency, 0) AS proficiency
         FROM job_role_skills jrs
         JOIN skills s ON s.id = jrs.skill_id
         LEFT JOIN student_skills ss
                ON ss.skill_id = jrs.skill_id AND ss.user_id = ?
         WHERE jrs.job_role_id = ?
           AND COALESCE(ss.proficiency, 0) < 60
         ORDER BY jrs.importance DESC, proficiency ASC`,
        [userId, roleId]
    );
    return rows;
}

// ---- GET /api/roadmap ----
async function getRoadmap(req, res) {
    try {
        const userId = req.session.userId;

        const [roadmaps] = await pool.execute(
            `SELECT rm.id, rm.title, rm.source, rm.duration_days, rm.created_at,
                    jr.name AS role_name
             FROM roadmaps rm
             JOIN job_roles jr ON jr.id = rm.job_role_id
             WHERE rm.user_id = ? AND rm.status = 'active'
             ORDER BY rm.created_at DESC
             LIMIT 1`,
            [userId]
        );

        if (roadmaps.length === 0) {
            return res.json({ roadmap: null });
        }

        const roadmap = roadmaps[0];
        const [tasks] = await pool.execute(
            `SELECT id, day_number, title, description, resources,
                    estimated_minutes, status, completed_at
             FROM roadmap_tasks
             WHERE roadmap_id = ?
             ORDER BY day_number`,
            [roadmap.id]
        );

        const completed = tasks.filter((t) => t.status === "completed").length;
        res.json({
            roadmap: {
                ...roadmap,
                tasks: tasks.map((t) => ({
                    ...t,
                    resources: t.resources ? JSON.parse(t.resources) : [],
                })),
                progress: {
                    completed,
                    total: tasks.length,
                    percent: tasks.length
                        ? Math.round((completed / tasks.length) * 100)
                        : 0,
                },
            },
        });
    } catch (error) {
        console.error("Get roadmap error:", error);
        res.status(500).json({ error: "Could not load your roadmap." });
    }
}

// ---- POST /api/roadmap/generate   { jobRoleId } ----
async function generate(req, res) {
    try {
        const userId = req.session.userId;
        const jobRoleId = Number(req.body.jobRoleId);

        if (!Number.isInteger(jobRoleId) || jobRoleId < 1) {
            return res.status(400).json({ error: "Please choose a job role first." });
        }

        const [roleRows] = await pool.execute(
            "SELECT id, name FROM job_roles WHERE id = ?",
            [jobRoleId]
        );
        if (roleRows.length === 0) {
            return res.status(400).json({ error: "Unknown job role." });
        }
        const role = roleRows[0];

        const [studentSkills] = await pool.execute(
            `SELECT s.name, ss.proficiency
             FROM student_skills ss JOIN skills s ON s.id = ss.skill_id
             WHERE ss.user_id = ?`,
            [userId]
        );
        const gapSkills = await getGapSkills(userId, jobRoleId);

        // Build the plan (AI if configured, otherwise labelled fallback).
        const plan = await generateRoadmap(role.name, studentSkills, gapSkills);

        // Archive any previous roadmap, then save the new one.
        await pool.execute(
            "UPDATE roadmaps SET status = 'archived' WHERE user_id = ? AND status = 'active'",
            [userId]
        );
        const [result] = await pool.execute(
            `INSERT INTO roadmaps (user_id, job_role_id, title, source, duration_days)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, jobRoleId, plan.title, plan.source, plan.days.length]
        );
        const roadmapId = result.insertId;

        for (const day of plan.days) {
            await pool.execute(
                `INSERT INTO roadmap_tasks
                   (roadmap_id, day_number, title, description, resources, estimated_minutes)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [roadmapId, day.day, day.title, day.description,
                 JSON.stringify(day.resources), day.estimatedMinutes]
            );
        }

        // Keep the profile's target role in sync with the roadmap.
        await pool.execute(
            `INSERT INTO student_profiles (user_id, target_role_id) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE target_role_id = VALUES(target_role_id)`,
            [userId, jobRoleId]
        );
        await pool.execute(
            "INSERT INTO activity_log (user_id, activity_type, detail) VALUES (?, 'roadmap_generated', ?)",
            [userId, `Generated roadmap: ${plan.title}`.slice(0, 255)]
        );

        res.status(201).json({
            message:
                plan.source === "ai"
                    ? "AI roadmap generated."
                    : "Roadmap generated using the built-in plan (AI not configured/unavailable).",
            source: plan.source,
            roadmapId,
        });
    } catch (error) {
        console.error("Generate roadmap error:", error);
        res.status(500).json({ error: "Could not generate your roadmap." });
    }
}

// ---- PUT /api/roadmap/tasks/:taskId   { status: "completed"|"pending" } ----
async function updateTask(req, res) {
    try {
        const userId = req.session.userId;
        const taskId = Number(req.params.taskId);
        const status = req.body.status === "completed" ? "completed" : "pending";

        if (!Number.isInteger(taskId) || taskId < 1) {
            return res.status(400).json({ error: "Invalid task id." });
        }

        // Ownership check: the task must belong to one of MY roadmaps.
        const [result] = await pool.execute(
            `UPDATE roadmap_tasks rt
             JOIN roadmaps rm ON rm.id = rt.roadmap_id
             SET rt.status = ?, rt.completed_at = ${status === "completed" ? "NOW()" : "NULL"}
             WHERE rt.id = ? AND rm.user_id = ?`,
            [status, taskId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Task not found." });
        }

        if (status === "completed") {
            await pool.execute(
                "INSERT INTO activity_log (user_id, activity_type, detail) VALUES (?, 'task_completed', ?)",
                [userId, `Completed roadmap task #${taskId}`]
            );
        }

        res.json({ message: "Task updated." });
    } catch (error) {
        console.error("Update task error:", error);
        res.status(500).json({ error: "Could not update the task." });
    }
}

module.exports = { getRoadmap, generate, updateTask, getGapSkills };

// ====================================================================
// SkillNova - progressController.js
// "My Progress" page data: everything comes from the logged-in
// student's saved records - nothing is fabricated.
// ====================================================================

const { pool } = require("../config/database");

async function getProgress(req, res) {
    try {
        const userId = req.session.userId;

        // Roadmap completion
        const [roadmapRows] = await pool.execute(
            `SELECT rm.id, rm.title,
                    COUNT(rt.id) AS total,
                    SUM(rt.status = 'completed') AS completed
             FROM roadmaps rm
             LEFT JOIN roadmap_tasks rt ON rt.roadmap_id = rm.id
             WHERE rm.user_id = ? AND rm.status = 'active'
             GROUP BY rm.id, rm.title
             ORDER BY rm.created_at DESC LIMIT 1`,
            [userId]
        );
        const roadmap = roadmapRows[0]
            ? {
                  title: roadmapRows[0].title,
                  completed: Number(roadmapRows[0].completed) || 0,
                  total: Number(roadmapRows[0].total) || 0,
                  percent: roadmapRows[0].total
                      ? Math.round((Number(roadmapRows[0].completed) / Number(roadmapRows[0].total)) * 100)
                      : 0,
              }
            : null;

        // Completed tasks (recent)
        const [completedTasks] = await pool.execute(
            `SELECT rt.title, rt.day_number, rt.completed_at
             FROM roadmap_tasks rt
             JOIN roadmaps rm ON rm.id = rt.roadmap_id
             WHERE rm.user_id = ? AND rt.status = 'completed'
             ORDER BY rt.completed_at DESC LIMIT 10`,
            [userId]
        );

        // Skills
        const [skills] = await pool.execute(
            `SELECT s.name, ss.proficiency FROM student_skills ss
             JOIN skills s ON s.id = ss.skill_id
             WHERE ss.user_id = ? ORDER BY ss.proficiency DESC`,
            [userId]
        );

        // Resume history
        const [resumeHistory] = await pool.execute(
            `SELECT ra.id, ra.score, ra.source, ra.created_at, r.original_name
             FROM resume_analyses ra JOIN resumes r ON r.id = ra.resume_id
             WHERE ra.user_id = ? ORDER BY ra.created_at DESC LIMIT 10`,
            [userId]
        );

        // Interview history
        const [interviewHistory] = await pool.execute(
            `SELECT att.id, att.category, att.difficulty, att.status,
                    att.total_score, att.started_at, jr.name AS role_name
             FROM interview_attempts att
             LEFT JOIN job_roles jr ON jr.id = att.job_role_id
             WHERE att.user_id = ? ORDER BY att.started_at DESC LIMIT 10`,
            [userId]
        );

        // Recent activity
        const [activities] = await pool.execute(
            `SELECT activity_type, detail, created_at
             FROM activity_log WHERE user_id = ?
             ORDER BY created_at DESC LIMIT 15`,
            [userId]
        );

        // Pending concepts = pending roadmap task titles (next 5)
        const [pendingTasks] = await pool.execute(
            `SELECT rt.title, rt.day_number
             FROM roadmap_tasks rt JOIN roadmaps rm ON rm.id = rt.roadmap_id
             WHERE rm.user_id = ? AND rm.status = 'active' AND rt.status = 'pending'
             ORDER BY rt.day_number LIMIT 5`,
            [userId]
        );

        res.json({
            roadmap,
            completedTasks,
            skills,
            resumeHistory,
            interviewHistory,
            activities,
            pendingTasks,
        });
    } catch (error) {
        console.error("Progress error:", error);
        res.status(500).json({ error: "Could not load your progress." });
    }
}

module.exports = { getProgress };

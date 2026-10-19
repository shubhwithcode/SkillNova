// ====================================================================
// SkillNova - dashboardController.js
// Builds the dashboard from the logged-in student's REAL MySQL records.
//
// READINESS SCORE (documented, in services/metricsService.js):
//   readiness = round(0.4*avgSkillLevel + 0.3*resumeScore + 0.3*interviewScore)
// STREAK: consecutive days with activity in activity_log.
// Skill gaps: role skills where proficiency < 60 (importance DESC).
//
// If MySQL is NOT configured yet, the API returns the old clearly-
// labelled sample payload (source:"sample") so the page still demos.
// Real mode responses are labelled source:"database".
// ====================================================================

const { pool, isDbConfigured } = require("../config/database");
const {
    calculateReadiness,
    calculateStreak,
    calculateBestStreak,
} = require("../services/metricsService");

const WEEKLY_GOAL_DAYS = 5;

// ---- GET /api/dashboard ----
async function getDashboard(req, res) {
    // Demo mode: database not configured -> honest sample payload.
    if (!isDbConfigured()) {
        return res.json(buildSamplePayload());
    }
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: "Please log in first." });
    }

    try {
        const userId = req.session.userId;

        // --- profile + target role ---
        const [profileRows] = await pool.execute(
            `SELECT u.full_name, p.target_role_id, jr.name AS target_role_name
             FROM users u
             LEFT JOIN student_profiles p ON p.user_id = u.id
             LEFT JOIN job_roles jr ON jr.id = p.target_role_id
             WHERE u.id = ?`,
            [userId]
        );
        if (profileRows.length === 0) {
            return res.status(404).json({ error: "User not found." });
        }
        const profile = profileRows[0];

        // --- skills ---
        const [skills] = await pool.execute(
            `SELECT s.name, ss.proficiency AS level
             FROM student_skills ss JOIN skills s ON s.id = ss.skill_id
             WHERE ss.user_id = ? ORDER BY ss.proficiency DESC`,
            [userId]
        );
        const avgSkill = skills.length
            ? skills.reduce((sum, s) => sum + s.level, 0) / skills.length
            : 0;

        // --- skill gaps for the target role ---
        let skillGaps = [];
        if (profile.target_role_id) {
            const [gaps] = await pool.execute(
                `SELECT s.name, jrs.importance, COALESCE(ss.proficiency,0) AS proficiency
                 FROM job_role_skills jrs
                 JOIN skills s ON s.id = jrs.skill_id
                 LEFT JOIN student_skills ss
                        ON ss.skill_id = jrs.skill_id AND ss.user_id = ?
                 WHERE jrs.job_role_id = ? AND COALESCE(ss.proficiency,0) < 60
                 ORDER BY jrs.importance DESC, proficiency ASC
                 LIMIT 6`,
                [userId, profile.target_role_id]
            );
            skillGaps = gaps.map((g) => ({
                name: g.name,
                priority: g.importance >= 5 ? "high" : g.importance >= 3 ? "medium" : "low",
                label: g.importance >= 5 ? "High priority" : g.importance >= 3 ? "In progress" : "Coming up",
            }));
        }

        // --- latest resume + interview scores ---
        const [resumeRows] = await pool.execute(
            `SELECT score FROM resume_analyses
             WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
            [userId]
        );
        const [interviewRows] = await pool.execute(
            `SELECT total_score FROM interview_attempts
             WHERE user_id = ? AND status = 'completed'
             ORDER BY finished_at DESC LIMIT 1`,
            [userId]
        );
        const resumeScore = resumeRows[0]?.score ?? null;
        const interviewScore = interviewRows[0]?.total_score ?? null;

        // --- roadmap / today's lesson ---
        const [roadmapRows] = await pool.execute(
            `SELECT id, duration_days FROM roadmaps
             WHERE user_id = ? AND status = 'active'
             ORDER BY created_at DESC LIMIT 1`,
            [userId]
        );
        let todayLesson = null;
        let tasksCompleted = 0;
        let tasksTotal = 0;
        if (roadmapRows.length > 0) {
            const roadmapId = roadmapRows[0].id;
            const [tasks] = await pool.execute(
                `SELECT id, day_number, title, description, estimated_minutes, status
                 FROM roadmap_tasks WHERE roadmap_id = ? ORDER BY day_number`,
                [roadmapId]
            );
            tasksTotal = tasks.length;
            tasksCompleted = tasks.filter((t) => t.status === "completed").length;
            const next = tasks.find((t) => t.status === "pending");
            if (next) {
                todayLesson = {
                    taskId: next.id,
                    topic: next.title,
                    description: (next.description || "").slice(0, 220),
                    day: next.day_number,
                    totalDays: tasksTotal,
                    estimatedMinutes: next.estimated_minutes,
                    lessonCount: 1,
                };
            }
        }

        // --- streak from activity_log (real, not invented) ---
        const [activityRows] = await pool.execute(
            `SELECT DISTINCT DATE_FORMAT(created_at, '%Y-%m-%d') AS day
             FROM activity_log WHERE user_id = ?`,
            [userId]
        );
        const activityDates = activityRows.map((r) => r.day);
        const today = new Date().toISOString().slice(0, 10);
        const currentStreak = calculateStreak(activityDates, today);
        const bestStreak = calculateBestStreak(activityDates);

        // Days active this ISO week (Mon-Sun)
        const [weekRows] = await pool.execute(
            `SELECT COUNT(DISTINCT DATE(created_at)) AS days
             FROM activity_log
             WHERE user_id = ? AND YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1)`,
            [userId]
        );
        const daysDoneThisWeek = weekRows[0]?.days || 0;

        const readiness = calculateReadiness(avgSkill, resumeScore ?? 0, interviewScore ?? 0);

        res.json(buildRealPayload({
            profile, skills, skillGaps, resumeScore, interviewScore,
            todayLesson, tasksCompleted, tasksTotal,
            currentStreak, bestStreak, daysDoneThisWeek, readiness,
        }));
    } catch (error) {
        console.error("Dashboard error:", error);
        res.status(500).json({ error: "Could not load dashboard data. Please try again." });
    }
}

// ---- helpers ----

function buildRealPayload(d) {
    const gapNames = d.skillGaps.slice(0, 2).map((g) => g.name);
    const recommendation = gapNames.length
        ? `Focus on ${gapNames.join(" and ")} this week.`
        : d.tasksTotal > 0
            ? "Keep completing your roadmap tasks - consistency wins."
            : "Set your target role and generate a roadmap to get personalized recommendations.";

    return {
        source: "database",
        student: {
            name: d.profile.full_name,
            targetRole: d.profile.target_role_name || "Not set yet",
        },
        readiness: {
            score: d.readiness,
            trendPercent: null,
            formula: "0.4 * averageSkillLevel + 0.3 * resumeScore + 0.3 * interviewScore",
        },
        todayLesson: d.todayLesson, // null => frontend shows empty state
        streak: {
            currentDays: d.currentStreak,
            bestDays: d.bestStreak,
            weeklyGoalDays: WEEKLY_GOAL_DAYS,
            daysDoneThisWeek: Math.min(d.daysDoneThisWeek, WEEKLY_GOAL_DAYS),
            weeklyChangePercent: null,
        },
        skillsSummary: { completed: d.tasksCompleted, total: d.tasksTotal },
        skills: d.skills,
        skillGaps: d.skillGaps,
        resume: {
            score: d.resumeScore,
            status: d.resumeScore === null ? "Not analyzed yet"
                : d.resumeScore >= 75 ? "Looking good" : "Needs work",
        },
        interview: {
            score: d.interviewScore,
            status: d.interviewScore === null ? "No interviews yet"
                : d.interviewScore >= 75 ? "Strong" : "Keep practicing",
        },
        recommendation,
    };
}

// Old clearly-labelled sample payload - ONLY used when the database is
// not configured, so the design can still be demonstrated honestly.
function buildSamplePayload() {
    const skills = [
        { name: "HTML / CSS", level: 90 }, { name: "JavaScript", level: 75 },
        { name: "React", level: 45 }, { name: "Node.js", level: 30 },
        { name: "SQL", level: 60 },
    ];
    const resumeScore = 82;
    const interviewScore = 76;
    const avg = skills.reduce((s, x) => s + x.level, 0) / skills.length;
    return {
        source: "sample",
        student: { name: null, targetRole: "Full Stack Developer" },
        readiness: {
            score: calculateReadiness(avg, resumeScore, interviewScore),
            trendPercent: 8,
            formula: "0.4 * averageSkillLevel + 0.3 * resumeScore + 0.3 * interviewScore",
        },
        todayLesson: {
            topic: "React Components",
            description: "Learn component structure, props and state. Build reusable pieces for your next project.",
            day: 3, totalDays: 30, estimatedMinutes: 25, lessonCount: 3,
        },
        streak: { currentDays: 12, bestDays: 16, weeklyGoalDays: 5, daysDoneThisWeek: 3, weeklyChangePercent: 8 },
        skillsSummary: { completed: 12, total: 18 },
        skills,
        skillGaps: [
            { name: "React Hooks", priority: "high", label: "High priority" },
            { name: "REST APIs", priority: "high", label: "High priority" },
            { name: "SQL Joins", priority: "medium", label: "In progress" },
            { name: "Authentication", priority: "medium", label: "Up next" },
        ],
        resume: { score: resumeScore, status: "Looking good" },
        interview: { score: interviewScore, status: "+6 this month" },
        recommendation: "Focus on REST APIs and Node.js this week.",
    };
}

module.exports = { getDashboard };

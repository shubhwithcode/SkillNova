// ====================================================================
// SkillNova - profileController.js
// Every query filters by req.session.userId, so a student can only
// ever read or change their OWN profile. The role column can never be
// changed through this API (no admin escalation).
// ====================================================================

const { pool } = require("../config/database");

// ---- GET /api/profile ----
async function getProfile(req, res) {
    try {
        const userId = req.session.userId;

        const [rows] = await pool.execute(
            `SELECT u.full_name, u.email, u.created_at,
                    p.college, p.degree, p.graduation_year,
                    p.target_role_id, r.name AS target_role_name,
                    p.soft_skills, p.certifications
             FROM users u
             LEFT JOIN student_profiles p ON p.user_id = u.id
             LEFT JOIN job_roles r ON r.id = p.target_role_id
             WHERE u.id = ?`,
            [userId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: "Profile not found." });
        }

        const [skills] = await pool.execute(
            `SELECT s.id, s.name, s.category, ss.proficiency
             FROM student_skills ss
             JOIN skills s ON s.id = ss.skill_id
             WHERE ss.user_id = ?
             ORDER BY ss.proficiency DESC`,
            [userId]
        );

        res.json({ profile: rows[0], skills });
    } catch (error) {
        console.error("Get profile error:", error);
        res.status(500).json({ error: "Could not load your profile." });
    }
}

// ---- PUT /api/profile ----
async function updateProfile(req, res) {
    try {
        const userId = req.session.userId;
        const fullName = String(req.body.fullName || "").trim();
        const college = String(req.body.college || "").trim().slice(0, 150);
        const degree = String(req.body.degree || "").trim().slice(0, 100);
        const softSkills = String(req.body.softSkills || "").trim().slice(0, 1000);
        const certifications = String(req.body.certifications || "").trim().slice(0, 2000);

        let graduationYear = Number(req.body.graduationYear) || null;
        if (graduationYear && (graduationYear < 2000 || graduationYear > 2040)) {
            return res.status(400).json({ error: "Graduation year must be between 2000 and 2040." });
        }

        let targetRoleId = Number(req.body.targetRoleId) || null;
        if (targetRoleId) {
            const [roleRows] = await pool.execute(
                "SELECT id FROM job_roles WHERE id = ?",
                [targetRoleId]
            );
            if (roleRows.length === 0) {
                return res.status(400).json({ error: "Unknown job role selected." });
            }
        }

        if (!fullName || fullName.length < 2 || fullName.length > 100) {
            return res.status(400).json({ error: "Please enter your full name (2-100 characters)." });
        }

        await pool.execute(
            "UPDATE users SET full_name = ? WHERE id = ?",
            [fullName, userId]
        );
        await pool.execute(
            `INSERT INTO student_profiles
               (user_id, college, degree, graduation_year, target_role_id, soft_skills, certifications)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               college = VALUES(college), degree = VALUES(degree),
               graduation_year = VALUES(graduation_year),
               target_role_id = VALUES(target_role_id),
               soft_skills = VALUES(soft_skills),
               certifications = VALUES(certifications)`,
            [userId, college || null, degree || null, graduationYear,
             targetRoleId, softSkills || null, certifications || null]
        );

        req.session.fullName = fullName;

        await pool.execute(
            "INSERT INTO activity_log (user_id, activity_type, detail) VALUES (?, 'profile_updated', 'Profile updated')",
            [userId]
        );

        res.json({ message: "Profile saved." });
    } catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({ error: "Could not save your profile." });
    }
}

// ---- PUT /api/profile/skills ----
// Body: { skills: [{ skillId, proficiency }, ...] }
async function updateSkills(req, res) {
    try {
        const userId = req.session.userId;
        const skills = Array.isArray(req.body.skills) ? req.body.skills : null;
        if (!skills) {
            return res.status(400).json({ error: "skills must be an array." });
        }
        if (skills.length > 50) {
            return res.status(400).json({ error: "Too many skills (max 50)." });
        }

        for (const item of skills) {
            const skillId = Number(item.skillId);
            const proficiency = Number(item.proficiency);
            if (!Number.isInteger(skillId) || skillId < 1 ||
                !Number.isInteger(proficiency) || proficiency < 0 || proficiency > 100) {
                return res.status(400).json({
                    error: "Each skill needs a valid skillId and proficiency (0-100).",
                });
            }
        }

        // Replace the full list: simple and predictable for the student.
        await pool.execute("DELETE FROM student_skills WHERE user_id = ?", [userId]);
        for (const item of skills) {
            await pool.execute(
                `INSERT INTO student_skills (user_id, skill_id, proficiency)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE proficiency = VALUES(proficiency)`,
                [userId, Number(item.skillId), Number(item.proficiency)]
            );
        }

        res.json({ message: "Skills saved." });
    } catch (error) {
        console.error("Update skills error:", error);
        res.status(500).json({ error: "Could not save your skills." });
    }
}

// ---- GET /api/profile/options ----
async function getOptions(req, res) {
    try {
        const [jobRoles] = await pool.execute(
            "SELECT id, name, description FROM job_roles ORDER BY name"
        );
        const [skills] = await pool.execute(
            "SELECT id, name, category FROM skills ORDER BY category, name"
        );
        res.json({ jobRoles, skills });
    } catch (error) {
        console.error("Options error:", error);
        res.status(500).json({ error: "Could not load options." });
    }
}

module.exports = { getProfile, updateProfile, updateSkills, getOptions };

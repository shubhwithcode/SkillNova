// ====================================================================
// SkillNova - authController.js
// Real authentication with MySQL + bcrypt password hashing +
// express-session cookies.
//
// Security notes (for the demo/viva):
// - Passwords are NEVER stored in plain text: bcrypt.hash() with 10
//   salt rounds produces a one-way hash.
// - All SQL uses parameterized queries (? placeholders) -> no SQL
//   injection.
// - The session cookie is httpOnly, so browser JavaScript cannot
//   steal it.
// ====================================================================

const bcrypt = require("bcryptjs");
const { pool } = require("../config/database");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---- POST /api/auth/register ----
async function register(req, res) {
    try {
        const fullName = String(req.body.fullName || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

        // Server-side validation (never trust only the browser).
        if (!fullName || fullName.length < 2 || fullName.length > 100) {
            return res.status(400).json({ error: "Please enter your full name (2-100 characters)." });
        }
        if (!EMAIL_REGEX.test(email) || email.length > 190) {
            return res.status(400).json({ error: "Please enter a valid email address." });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: "Password must be at least 8 characters." });
        }

        // Duplicate email prevention.
        const [existing] = await pool.execute(
            "SELECT id FROM users WHERE email = ?",
            [email]
        );
        if (existing.length > 0) {
            return res.status(409).json({ error: "An account with this email already exists. Please log in." });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const [result] = await pool.execute(
            "INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)",
            [fullName, email, passwordHash]
        );
        const userId = result.insertId;

        // Create an empty profile row so later profile updates are simple.
        await pool.execute(
            "INSERT INTO student_profiles (user_id) VALUES (?)",
            [userId]
        );

        // Log the student in immediately (regenerate = session fixation safety).
        req.session.regenerate((err) => {
            if (err) {
                console.error("Session error:", err);
                return res.status(500).json({ error: "Could not start your session. Please log in." });
            }
            req.session.userId = userId;
            req.session.fullName = fullName;
            res.status(201).json({ user: { id: userId, fullName, email } });
        });
    } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({ error: "Registration failed. Please try again." });
    }
}

// ---- POST /api/auth/login ----
async function login(req, res) {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

        if (!EMAIL_REGEX.test(email) || !password) {
            return res.status(400).json({ error: "Please enter a valid email and password." });
        }

        const [rows] = await pool.execute(
            "SELECT id, full_name, email, password_hash FROM users WHERE email = ?",
            [email]
        );

        // Same message for wrong email and wrong password - do not reveal
        // which one failed (prevents account enumeration).
        if (rows.length === 0) {
            return res.status(401).json({ error: "Incorrect email or password." });
        }

        const user = rows[0];
        const passwordOk = await bcrypt.compare(password, user.password_hash);
        if (!passwordOk) {
            return res.status(401).json({ error: "Incorrect email or password." });
        }

        req.session.regenerate(async (err) => {
            if (err) {
                console.error("Session error:", err);
                return res.status(500).json({ error: "Could not start your session. Please try again." });
            }
            req.session.userId = user.id;
            req.session.fullName = user.full_name;

            // Record the login for the activity history / streak.
            try {
                await pool.execute(
                    "INSERT INTO activity_log (user_id, activity_type, detail) VALUES (?, 'login', 'Logged in')",
                    [user.id]
                );
            } catch (logErr) {
                console.error("Activity log error:", logErr.message);
            }

            res.json({ user: { id: user.id, fullName: user.full_name, email: user.email } });
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Login failed. Please try again." });
    }
}

// ---- POST /api/auth/logout ----
function logout(req, res) {
    req.session.destroy((err) => {
        if (err) {
            console.error("Logout error:", err);
            return res.status(500).json({ error: "Logout failed." });
        }
        res.clearCookie("skillnova.sid");
        res.json({ message: "Logged out." });
    });
}

// ---- GET /api/auth/me ----
function me(req, res) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: "Not logged in." });
    }
    res.json({
        user: { id: req.session.userId, fullName: req.session.fullName },
    });
}

module.exports = { register, login, logout, me };

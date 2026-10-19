// ====================================================================
// SkillNova - authRoutes.js
//   POST /api/auth/register  { fullName, email, password }
//   POST /api/auth/login     { email, password }
//   POST /api/auth/logout
//   GET  /api/auth/me        -> current session user
// ====================================================================

const express = require("express");
const { isDbConfigured } = require("../config/database");
const {
    register,
    login,
    logout,
    me,
} = require("../controllers/authController");

const router = express.Router();

// Give a clear message instead of a vague 500 when MySQL is not set up.
function requireDb(req, res, next) {
    if (!isDbConfigured()) {
        return res.status(503).json({
            error:
                "Database is not configured yet. Set DB_PASSWORD in .env and run " +
                "database/schema.sql + seed.sql (see README).",
        });
    }
    next();
}

router.post("/register", requireDb, register);
router.post("/login", requireDb, login);
router.post("/logout", logout);
router.get("/me", me);

module.exports = router;

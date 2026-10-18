// ====================================================================
// SkillNova - middleware/requireAuth.js
// Protects private API routes. A route that uses this middleware can
// trust that req.session.userId is the logged-in student's id, so all
// SQL queries filter by it and no student can read another student's
// records.
// ====================================================================

const { isDbConfigured } = require("../config/database");

function requireAuth(req, res, next) {
    if (!isDbConfigured()) {
        return res.status(503).json({
            error:
                "Database is not configured. Set DB_PASSWORD in .env and run " +
                "database/schema.sql + seed.sql (see README).",
        });
    }
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: "Please log in first." });
    }
    next();
}

module.exports = requireAuth;

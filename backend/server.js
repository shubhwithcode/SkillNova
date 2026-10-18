// ====================================================================
// SkillNova - server.js
// Express server: serves the frontend AND all /api routes.
//
//   /api/auth       register / login / logout / me   (MySQL + bcrypt)
//   /api/profile    student profile + skills
//   /api/roadmap    AI/fallback roadmap + task progress
//   /api/resume     PDF upload -> Python extraction -> scoring
//   /api/interview  mock interview questions + feedback
//   /api/progress   My Progress page data
//   /api/dashboard  readiness dashboard (real data from MySQL)
// ====================================================================

require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");

const { testConnection, isDbConfigured } = require("./config/database");

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON request bodies.
app.use(express.json({ limit: "1mb" }));

// ---- Sessions (cookie-based auth) ----
// httpOnly: browser JS cannot read the cookie (XSS protection).
// sameSite "lax": the cookie is not sent on cross-site POSTs (CSRF protection).
app.use(
    session({
        name: "skillnova.sid",
        secret: process.env.SESSION_SECRET || "dev-only-secret-change-me",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: false, // set true when serving over HTTPS
            maxAge: 1000 * 60 * 60 * 8, // 8 hours
        },
    })
);

// Serve every file inside the frontend folder as a static asset.
// (backend/uploads is OUTSIDE this folder, so resumes are never public.)
const frontendDir = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendDir));

// ---- API routes ----
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/profile", require("./routes/profileRoutes"));
app.use("/api/roadmap", require("./routes/roadmapRoutes"));
app.use("/api/resume", require("./routes/resumeRoutes"));
app.use("/api/interview", require("./routes/interviewRoutes"));
app.use("/api/progress", require("./routes/progressRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));

// Simple health check so we can verify the server is running.
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        service: "SkillNova backend",
        database: isDbConfigured() ? "configured" : "not configured",
        time: new Date().toISOString(),
    });
});

// JSON 404 for unknown API paths, friendly page for everything else.
app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({ error: "API endpoint not found." });
    }
    res.status(404).send(
        '<h1>404 - Page not found</h1><p><a href="/index.html">Back to SkillNova home</a></p>'
    );
});

// Central error handler (e.g. bad JSON bodies) -> consistent JSON.
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err.message);
    res.status(err.status || 500).json({ error: "Something went wrong on the server." });
});

app.listen(PORT, async () => {
    console.log(`SkillNova server running at http://localhost:${PORT}`);
    await testConnection();
});


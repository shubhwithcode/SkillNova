// ====================================================================
// SkillNova - resumeRoutes.js   (all require login)
//   POST /api/resume/analyze       (multipart: resume=PDF, jobRoleId)
//   GET  /api/resume/history       -> my previous analyses
//   GET  /api/resume/history/:id   -> one full analysis (mine only)
//
// Upload safety:
// - multer stores the file with a RANDOM name under backend/uploads/
//   (outside the public frontend folder, never served statically).
// - only .pdf mimetype/extension accepted, max 5 MB.
// - the file is read by Python as data; it is never executed.
// ====================================================================

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const requireAuth = require("../middleware/requireAuth");
const { analyzeResume, getHistory, getAnalysis } = require("../controllers/resumeController");

const uploadDir = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) =>
        cb(null, crypto.randomBytes(16).toString("hex") + ".pdf"),
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        const isPdf =
            file.mimetype === "application/pdf" &&
            path.extname(file.originalname).toLowerCase() === ".pdf";
        cb(isPdf ? null : new Error("Only PDF files are allowed."), isPdf);
    },
});

const router = express.Router();
router.use(requireAuth);

router.post("/analyze", (req, res) => {
    upload.single("resume")(req, res, (err) => {
        if (err) {
            const message =
                err.code === "LIMIT_FILE_SIZE"
                    ? "File is too large (max 5 MB)."
                    : err.message || "Upload failed.";
            return res.status(400).json({ error: message });
        }
        analyzeResume(req, res);
    });
});

router.get("/history", getHistory);
router.get("/history/:id", getAnalysis);

module.exports = router;

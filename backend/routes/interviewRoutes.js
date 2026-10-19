// ====================================================================
// SkillNova - interviewRoutes.js   (all require login)
//   POST /api/interview/start          { jobRoleId, category, difficulty }
//   POST /api/interview/answer         { attemptId, questionId, answerText }
//   POST /api/interview/finish         { attemptId }
//   GET  /api/interview/history        -> my past attempts
//   GET  /api/interview/history/:id    -> one attempt with answers (mine only)
// ====================================================================

const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const {
    startInterview,
    submitAnswer,
    finishInterview,
    getHistory,
    getAttempt,
} = require("../controllers/interviewController");

const router = express.Router();

router.use(requireAuth);
router.post("/start", startInterview);
router.post("/answer", submitAnswer);
router.post("/finish", finishInterview);
router.get("/history", getHistory);
router.get("/history/:id", getAttempt);

module.exports = router;

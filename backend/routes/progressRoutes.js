// ====================================================================
// SkillNova - progressRoutes.js   (requires login)
//   GET /api/progress  -> roadmap %, skills, resume + interview
//                         history, recent activity, pending concepts
// ====================================================================

const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const { getProgress } = require("../controllers/progressController");

const router = express.Router();

router.use(requireAuth);
router.get("/", getProgress);

module.exports = router;

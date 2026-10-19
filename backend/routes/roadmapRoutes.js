// ====================================================================
// SkillNova - roadmapRoutes.js   (all require login)
//   GET  /api/roadmap                    -> active roadmap + tasks
//   POST /api/roadmap/generate           -> create roadmap (AI or fallback)
//   PUT  /api/roadmap/tasks/:taskId      -> mark task complete / pending
// ====================================================================

const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const {
    getRoadmap,
    generate,
    updateTask,
} = require("../controllers/roadmapController");

const router = express.Router();

router.use(requireAuth);
router.get("/", getRoadmap);
router.post("/generate", generate);
router.put("/tasks/:taskId", updateTask);

module.exports = router;

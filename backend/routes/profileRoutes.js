// ====================================================================
// SkillNova - profileRoutes.js   (all require login)
//   GET /api/profile            -> full profile + skills
//   PUT /api/profile            -> update profile fields
//   PUT /api/profile/skills     -> replace the student's skill list
//   GET /api/profile/options    -> job roles + skills (for dropdowns)
// ====================================================================

const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const {
    getProfile,
    updateProfile,
    updateSkills,
    getOptions,
} = require("../controllers/profileController");

const router = express.Router();

router.use(requireAuth);
router.get("/", getProfile);
router.put("/", updateProfile);
router.put("/skills", updateSkills);
router.get("/options", getOptions);

module.exports = router;

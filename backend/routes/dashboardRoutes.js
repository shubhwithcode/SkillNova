// ====================================================================
// SkillNova - dashboardRoutes.js
// Routes for the student dashboard.
//   GET /api/dashboard  ->  dashboard data (sample until MySQL phase)
// ====================================================================

const express = require("express");
const { getDashboard } = require("../controllers/dashboardController");

const router = express.Router();

router.get("/", getDashboard);

module.exports = router;

// ====================================================================
// SkillNova - tests/metrics.test.js
// Unit tests for the documented dashboard calculations.
// Run with:  node --test tests/
// ====================================================================

const { test } = require("node:test");
const assert = require("node:assert");

const {
    calculateReadiness,
    calculateStreak,
    calculateBestStreak,
} = require("../backend/services/metricsService");

// ---- Readiness: 0.4*skills + 0.3*resume + 0.3*interview ----

test("readiness combines the three inputs with documented weights", () => {
    // 0.4*50 + 0.3*80 + 0.3*70 = 20 + 24 + 21 = 65
    assert.strictEqual(calculateReadiness(50, 80, 70), 65);
});

test("readiness is 0 for a brand new student", () => {
    assert.strictEqual(calculateReadiness(0, 0, 0), 0);
});

test("readiness treats missing values (NaN/undefined) as 0", () => {
    assert.strictEqual(calculateReadiness(NaN, undefined, 90), 27);
});

test("readiness clamps inputs above 100", () => {
    assert.strictEqual(calculateReadiness(200, 100, 100), 100);
});

// ---- Streak: consecutive active days ending today or yesterday ----

test("streak counts consecutive days ending today", () => {
    const dates = ["2026-10-16", "2026-10-17", "2026-10-18"];
    assert.strictEqual(calculateStreak(dates, "2026-10-18"), 3);
});

test("streak still counts when today has no activity yet", () => {
    const dates = ["2026-10-16", "2026-10-17"];
    assert.strictEqual(calculateStreak(dates, "2026-10-18"), 2);
});

test("streak is 0 after a 2-day gap", () => {
    const dates = ["2026-10-14", "2026-10-15"];
    assert.strictEqual(calculateStreak(dates, "2026-10-18"), 0);
});

test("streak ignores a gap in older history", () => {
    const dates = ["2026-10-10", "2026-10-17", "2026-10-18"];
    assert.strictEqual(calculateStreak(dates, "2026-10-18"), 2);
});

test("best streak finds the longest run anywhere", () => {
    const dates = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-10", "2026-10-11"];
    assert.strictEqual(calculateBestStreak(dates), 3);
});

test("best streak of empty history is 0", () => {
    assert.strictEqual(calculateBestStreak([]), 0);
});

// ====================================================================
// SkillNova - services/metricsService.js
// Pure, testable calculation helpers used by the dashboard.
//
// READINESS SCORE - documented calculation (same formula the original
// dashboard documented, now fed with REAL data):
//   readiness = round( 0.4 * averageSkillLevel
//                    + 0.3 * latestResumeScore
//                    + 0.3 * latestInterviewScore )
// Missing parts count as 0, so a new student honestly starts low and
// the score grows as they add skills / analyze a resume / interview.
//
// STREAK - calculated from activity_log dates (NOT invented):
//   current streak = number of consecutive calendar days, ending today
//   or yesterday, that have at least one logged activity.
// ====================================================================

function calculateReadiness(averageSkillLevel, resumeScore, interviewScore) {
    const safe = (n) => (Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0);
    return Math.round(
        0.4 * safe(averageSkillLevel) + 0.3 * safe(resumeScore) + 0.3 * safe(interviewScore)
    );
}

// activityDates: array of "YYYY-MM-DD" strings (unique, any order).
// today: "YYYY-MM-DD" (parameter makes this testable).
function calculateStreak(activityDates, today) {
    const dates = new Set(activityDates);
    const start = new Date(today + "T00:00:00Z");

    // A streak may end today OR yesterday (today's work not done yet).
    let cursor = new Date(start);
    if (!dates.has(isoDate(cursor))) {
        cursor.setUTCDate(cursor.getUTCDate() - 1);
        if (!dates.has(isoDate(cursor))) {
            return 0;
        }
    }

    let streak = 0;
    while (dates.has(isoDate(cursor))) {
        streak += 1;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return streak;
}

// Longest run of consecutive days anywhere in the history.
function calculateBestStreak(activityDates) {
    const sorted = [...new Set(activityDates)].sort();
    let best = 0;
    let run = 0;
    let prev = null;
    for (const day of sorted) {
        if (prev && nextDay(prev) === day) {
            run += 1;
        } else {
            run = 1;
        }
        best = Math.max(best, run);
        prev = day;
    }
    return best;
}

function isoDate(date) {
    return date.toISOString().slice(0, 10);
}

function nextDay(dayString) {
    const d = new Date(dayString + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return isoDate(d);
}

module.exports = { calculateReadiness, calculateStreak, calculateBestStreak };

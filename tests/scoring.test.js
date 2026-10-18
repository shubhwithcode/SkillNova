// ====================================================================
// SkillNova - tests/scoring.test.js
// Unit tests for the documented resume scoring and the rule-based
// interview answer fallback.  Run with:  node --test tests/
// ====================================================================

const { test } = require("node:test");
const assert = require("node:assert");

const { scoreResume } = require("../backend/services/resumeService");
const { evaluateFallback } = require("../backend/services/interviewService");

// ---- Resume scoring ----

function makeExtracted(overrides = {}) {
    return {
        ok: true,
        text: "word ".repeat(350),
        pages: 1,
        emails: [],
        links: [],
        sections: [],
        ...overrides,
    };
}

test("strong resume scores high", () => {
    const extracted = makeExtracted({
        text:
            "Education Skills Projects Experience Achievements Certifications " +
            "Built an app with JavaScript and Node.js, improved speed by 40% " +
            "for 200 users. " + "filler ".repeat(320),
        emails: ["student@example.com"],
        links: ["github.com/student"],
        sections: ["education", "skills", "projects", "experience", "achievements", "certifications"],
    });
    const roleSkills = [{ name: "JavaScript" }, { name: "Node.js" }];
    const result = scoreResume(extracted, roleSkills);

    // sections 30 + contact 10 + links 10 + skillMatch 30 + achievements 10 + length 10 = 100
    assert.strictEqual(result.score, 100);
    assert.strictEqual(result.missingSkills.length, 0);
});

test("empty-ish resume scores low and lists weaknesses", () => {
    const extracted = makeExtracted({ text: "short text only", sections: [] });
    const result = scoreResume(extracted, [{ name: "React" }]);

    assert.ok(result.score <= 20, `expected <=20, got ${result.score}`);
    assert.ok(result.weaknesses.length >= 4);
    assert.deepStrictEqual(result.missingSkills, ["React"]);
});

test("skill match is proportional", () => {
    const extracted = makeExtracted({ text: "I know JavaScript well. " + "x ".repeat(300) });
    const roleSkills = [{ name: "JavaScript" }, { name: "React" }, { name: "SQL" }];
    const result = scoreResume(extracted, roleSkills);
    // 1 of 3 matched -> round(1/3 * 30) = 10
    assert.strictEqual(result.breakdown.skillMatch, 10);
});

// ---- Interview fallback evaluation ----

test("fallback rewards key concepts and detail", () => {
    const answer =
        "A REST API uses HTTP methods like GET and POST to expose endpoints. " +
        "Each endpoint returns status codes and JSON. For example, GET /users " +
        "returns a list while POST /users creates one. This keeps the client " +
        "and server loosely coupled and easy to test with many words here to " +
        "make the answer long enough for a complete explanation of the topic.";
    const result = evaluateFallback(
        "Explain REST APIs",
        ["GET", "POST", "endpoints", "status codes"],
        answer
    );
    assert.ok(result.score >= 80, `expected >=80, got ${result.score}`);
    assert.strictEqual(result.source, "fallback");
});

test("fallback gives a low score for a one-liner", () => {
    const result = evaluateFallback("Explain REST APIs", ["GET", "POST"], "I do not know");
    assert.ok(result.score <= 35, `expected <=35, got ${result.score}`);
    assert.ok(result.suggestions.length > 0);
});

test("fallback never exceeds 100", () => {
    const answer = ("GET POST endpoints status codes. ").repeat(20);
    const result = evaluateFallback("q", ["GET", "POST", "endpoints", "status codes"], answer);
    assert.ok(result.score <= 100);
});

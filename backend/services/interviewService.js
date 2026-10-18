// ====================================================================
// SkillNova - services/interviewService.js
// Evaluates one interview answer.
//
// AI path: Gemini returns JSON {score, feedback, suggestions, modelAnswer}.
// Fallback path (DOCUMENTED rule-based evaluation, out of 100):
//   - Length / completeness:     up to 40 points
//       <20 words: 10, <50: 25, >=50: 40
//   - Key concept coverage:      up to 50 points
//       (matched key_points / total key_points) * 50
//   - Structure bonus:           10 points if the answer has 2+
//       sentences (shows explanation, not just a phrase)
// The fallback is labelled source:"fallback" so it is never presented
// as real AI output.
// ====================================================================

const { isAiConfigured, callGemini, extractJson } = require("./aiService");

function evaluateFallback(question, keyPoints, answerText) {
    const words = answerText.trim().split(/\s+/).filter(Boolean);
    const lower = answerText.toLowerCase();

    // 1. Completeness by length
    let lengthScore;
    if (words.length < 20) lengthScore = 10;
    else if (words.length < 50) lengthScore = 25;
    else lengthScore = 40;

    // 2. Key concept coverage
    const points = Array.isArray(keyPoints) ? keyPoints : [];
    const matched = points.filter((p) => lower.includes(String(p).toLowerCase()));
    const conceptScore = points.length
        ? Math.round((matched.length / points.length) * 50)
        : 25; // neutral half-credit when no key points defined

    // 3. Structure bonus
    const sentences = answerText.split(/[.!?]+/).filter((s) => s.trim().length > 3);
    const structureScore = sentences.length >= 2 ? 10 : 0;

    const score = Math.min(100, lengthScore + conceptScore + structureScore);

    const missing = points.filter((p) => !matched.includes(p));
    const feedbackParts = [];
    if (words.length < 20) {
        feedbackParts.push("Your answer is very short - explain your thinking in more detail.");
    } else {
        feedbackParts.push("Good level of detail in your answer.");
    }
    if (matched.length) {
        feedbackParts.push(`You covered important concepts: ${matched.join(", ")}.`);
    }
    if (missing.length) {
        feedbackParts.push(`Concepts you did not mention: ${missing.join(", ")}.`);
    }

    const suggestions = [];
    if (missing.length) suggestions.push(`Revise and mention: ${missing.slice(0, 4).join(", ")}.`);
    if (sentences.length < 2) suggestions.push("Structure your answer: definition first, then an example.");
    suggestions.push("End with a short real example from your projects when possible.");

    return {
        source: "fallback",
        score,
        feedback: feedbackParts.join(" "),
        suggestions,
        modelAnswer:
            "A strong answer usually has 3 parts: (1) a one-line definition, " +
            "(2) an explanation covering: " + (points.join(", ") || "the core concepts") +
            ", and (3) a short practical example from your own work.",
    };
}

async function evaluateWithAi(question, keyPoints, answerText) {
    const prompt = `You are a strict but encouraging interview coach for an Indian MCA student.
Interview question: "${question}"
Expected key concepts: ${JSON.stringify(keyPoints || [])}
Student's answer: """${answerText.slice(0, 3000)}"""

Evaluate relevance, completeness, clarity and key-concept coverage.
Reply with ONLY valid JSON, no markdown:
{"score": <integer 0-100>, "feedback": "<2-4 sentences>", "suggestions": ["<tip1>","<tip2>","<tip3>"], "modelAnswer": "<short example answer structure, 3-5 sentences>"}`;

    const text = await callGemini(prompt);
    const parsed = extractJson(text);
    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score))));
    if (!Number.isFinite(score)) {
        throw new Error("AI returned an invalid score.");
    }
    return {
        source: "ai",
        score,
        feedback: String(parsed.feedback || "").slice(0, 2000),
        suggestions: (Array.isArray(parsed.suggestions) ? parsed.suggestions : [])
            .slice(0, 5).map((s) => String(s).slice(0, 300)),
        modelAnswer: String(parsed.modelAnswer || "").slice(0, 2000),
    };
}

async function evaluateAnswer(question, keyPoints, answerText) {
    if (isAiConfigured()) {
        try {
            return await evaluateWithAi(question, keyPoints, answerText);
        } catch (error) {
            console.error("[AI] Answer evaluation failed, using fallback:", error.message);
        }
    }
    return evaluateFallback(question, keyPoints, answerText);
}

module.exports = { evaluateAnswer, evaluateFallback };

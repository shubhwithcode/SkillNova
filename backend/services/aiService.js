// ====================================================================
// SkillNova - services/aiService.js
// Single place that talks to the Google Gemini API.
//
// How it works:
// - callGemini(prompt) POSTs the prompt to the Gemini REST endpoint
//   using the key from .env (GEMINI_API_KEY). The key NEVER reaches
//   the browser - only this server file uses it.
// - isAiConfigured() is false while .env still has the placeholder,
//   so callers can switch to their rule-based fallback and label the
//   result source:"fallback" honestly.
// - extractJson() helps parse model output that may be wrapped in
//   ```json ... ``` fences.
// ====================================================================

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const PLACEHOLDER_KEY = "your_gemini_api_key_here";

function isAiConfigured() {
    const key = process.env.GEMINI_API_KEY;
    return Boolean(key) && key !== PLACEHOLDER_KEY;
}

async function callGemini(prompt) {
    if (!isAiConfigured()) {
        throw new Error("Gemini API key is not configured.");
    }

    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent` +
        `?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;

    // Node 22 has global fetch - no extra library needed.
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
        }),
        signal: AbortSignal.timeout(45000),
    });

    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Gemini API error ${response.status}: ${body.slice(0, 300)}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
        throw new Error("Gemini returned an empty response.");
    }
    return text;
}

// Models often wrap JSON in markdown fences; strip them before parsing.
function extractJson(text) {
    let cleaned = text.trim();
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
        cleaned = fenceMatch[1].trim();
    }
    const start = cleaned.indexOf("{");
    const startArr = cleaned.indexOf("[");
    if (startArr !== -1 && (start === -1 || startArr < start)) {
        cleaned = cleaned.slice(startArr, cleaned.lastIndexOf("]") + 1);
    } else if (start !== -1) {
        cleaned = cleaned.slice(start, cleaned.lastIndexOf("}") + 1);
    }
    return JSON.parse(cleaned);
}

module.exports = { isAiConfigured, callGemini, extractJson };

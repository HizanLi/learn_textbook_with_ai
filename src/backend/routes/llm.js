    const express = require("express");

    const router = express.Router();

    const DEFAULT_MODELS = {
    openai: "gpt-4o",
    deepseek: "deepseek-chat",
    google: "gemini-3-flash-preview",
    };

    const SUPPORTED_PROVIDERS = ["openai", "deepseek", "google"];

    function getProviderConfig(provider) {
    const keyMap = {
        openai: process.env.OPENAI_API_KEY,
        deepseek: process.env.DEEPSEEK_API_KEY,
        google: process.env.GEMINI_API_KEY,
    };

    const apiKey = keyMap[provider];
    if (!apiKey) {
        return {
        ok: false,
        error: `Missing API key for provider: ${provider}`,
        errorType: "missing_api_key",
        };
    }

    return { ok: true, apiKey };
    }

    async function callOpenAI({ apiKey, model, prompt, systemPrompt, temperature, maxTokens, forceJson = false }) {
    const messages = [];
    if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(forceJson ? { response_format: { type: "json_object" } } : {}),
        }),
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.error?.message || "OpenAI request failed");
    }

    return {
        text: data?.choices?.[0]?.message?.content || "",
        usage: data?.usage || null,
        raw: data,
    };
    }

    async function callDeepSeek({ apiKey, model, prompt, systemPrompt, temperature, maxTokens, forceJson = false }) {
    const messages = [];
    if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(forceJson ? { response_format: { type: "json_object" } } : {}),
        }),
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.error?.message || "DeepSeek request failed");
    }

    return {
        text: data?.choices?.[0]?.message?.content || "",
        usage: data?.usage || null,
        raw: data,
    };
    }

    async function callGemini({ apiKey, model, prompt, systemPrompt, temperature, maxTokens, forceJson = false }) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const parts = [];
    if (systemPrompt) {
        parts.push({ text: `System: ${systemPrompt}` });
    }
    parts.push({ text: prompt });

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        },
        body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
            ...(forceJson ? { responseMimeType: "application/json" } : {}),
        },
        }),
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.error?.message || "Gemini request failed");
    }

    const text =
        data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("\n") || "";

    return {
        text,
        usage: data?.usageMetadata || null,
        raw: data,
    };
    }

    function normalizePoints(points) {
    if (Array.isArray(points)) {
        return points.map((p) => String(p).trim()).filter(Boolean);
    }
    if (typeof points === "string" && points.trim()) {
        return [points.trim()];
    }
    return [];
    }

    function extractJsonFromText(text) {
        if (typeof text !== "string") return null;

        const trimmed = text.trim();
        if (!trimmed) return null;

        // Try direct parse first
        try {
            return JSON.parse(trimmed);
        } catch (_) {
            // ignore
        }

        // Try fenced code block parse
        const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (fencedMatch?.[1]) {
            try {
                return JSON.parse(fencedMatch[1]);
            } catch (_) {
                // ignore
            }
        }

        // Try extracting first JSON object region
        const start = trimmed.indexOf("{");
        const end = trimmed.lastIndexOf("}");
        if (start !== -1 && end !== -1 && end > start) {
            const candidate = trimmed.slice(start, end + 1);
            try {
                return JSON.parse(candidate);
            } catch (_) {
                return null;
            }
        }

        return null;
    }

    function tryHeuristicJsonRepair(text) {
        if (typeof text !== "string") return null;

        let candidate = text.trim();
        if (!candidate) return null;

        // Strip markdown code fences if present
        candidate = candidate.replace(/```json\s*/gi, "").replace(/```/g, "").trim();

        // Keep only outermost JSON object region when possible
        const start = candidate.indexOf("{");
        const end = candidate.lastIndexOf("}");
        if (start !== -1 && end !== -1 && end > start) {
            candidate = candidate.slice(start, end + 1);
        }

        // Remove trailing commas before closing braces/brackets
        candidate = candidate.replace(/,\s*([}\]])/g, "$1");

        try {
            return JSON.parse(candidate);
        } catch (_) {
            return null;
        }
    }

    function buildDetailedExplanationPrompt({
    chapterTitle,
    sectionTitle,
    topicType,
    points,
    content,
    language = "en-US",
    }) {
    const topicLabel = topicType || "core knowledge points";
    const categoryFocusInstructions = {
        core_concepts: "Explain only the main ideas and definitions in the selected points. Do not focus on examples, mistakes, or broad chapter summaries unless they directly clarify a selected concept.",
        fundamental_rules: "Explain only the rules, principles, procedures, and how to apply them. Do not restate general concepts unless they are needed to understand a selected rule.",
        common_pitfalls: "Explain only the mistakes, misunderstandings, risks, and how to avoid or correct them. Do not give a general lesson summary.",
        examples: "Explain only the selected examples. Break down what each example demonstrates and how it connects to the source text. Do not turn the answer into a general concept summary.",
    };
    const categoryFocus = categoryFocusInstructions[topicType] || "Explain only the selected category and selected key points. Do not summarize the whole section.";
    const pointsText = points.length
        ? points.map((p, i) => `${i + 1}. ${p}`).join("\n")
        : "(No selected key points were provided for this category.)";

    const contentText =
        typeof content === "string" && content.trim()
        ? content.trim()
        : "(No textbook content provided.)";

        const prompt = ` 
            You are an expert tutor designing educational materials for beginners.

            ### SELECTED LEARNING TARGET
            Selected category: ${topicLabel}
            Category-specific instruction: ${categoryFocus}

            Selected key points:
            ${pointsText}

            Your task is to generate a structured, easy-to-understand explanation for the SELECTED category and SELECTED key points only. The selected key points are the primary target. The textbook content is only supporting evidence.

            ### CONSTRAINTS & RULES:
            1. Strict Markdown: Your entire response MUST be formatted in valid Markdown. You must use the exact heading levels (###) provided below. Use bullet points (-), bolding (**text**), and blockquotes (>) to make the text highly scannable.
            2. Anti-Hallucination: Do NOT invent facts, dates, theories, or concepts outside of the provided <textbook_content>. Base your response entirely on the source material.
            3. Fallback Behavior: If the source material is too sparse to fulfill a specific section (e.g., no clear pitfalls or examples), output exactly: "> *The source material does not provide enough information for this section.*" Do not guess.
            4. Audience: Use simple, jargon-free language suitable for an absolute beginner. Keep sentences concise.
            5. Language: The entire output MUST be written in ${language}.
            6. Selection Focus: Focus ONLY on <selected_category> and <selected_key_points>. Do NOT summarize the whole section. Use <textbook_content> only as supporting evidence for the selected points.
            7. Distinct Output: Different selected categories must produce meaningfully different explanations. If the selected category is "examples", explain the examples. If it is "common_pitfalls", explain mistakes and corrections. If it is "fundamental_rules", explain rules and how to apply them. If it is "core_concepts", explain the main ideas.
            8. Point Coverage: Address every item in <selected_key_points>. If a point is unsupported by <textbook_content>, explicitly say the source material is insufficient for that point.
            9. Relevance Check: Every paragraph or bullet must clearly relate to one selected key point. Delete any sentence that would still make sense if the user had selected a different category.
            10. Empty Selection: If <selected_key_points> says no selected key points were provided, ask the user to choose a populated category instead of generating a generic explanation.

            ### REQUIRED OUTPUT STRUCTURE:
            You must use the exact Markdown headers below. Do not add extra sections.

            ### Concept Explanation
            [Explain the selected key points under the selected category only. Explicitly mention which selected point each explanation belongs to.]

            ### Why It Matters
            [Explain why these selected points matter, as supported by the text.]

            ### Common Pitfalls
            - [Identify misunderstanding or risk related to the selected points only.]
            - [If not enough source support exists, use the fallback sentence.]

            ### Example
            > [Provide one or twosmall example that illustrates the selected points. Prefer examples from the source text; if none exists, make a minimal hypothetical that does not add new factual claims.]

            ### Study Suggestions
            - [**Actionable step:** Study tip 1 for mastering the selected points.]
            - [**Actionable step:** Study tip 2 for checking understanding of the selected points.]

            ---
            ### INPUT DATA:
            <metadata>
            Chapter: ${chapterTitle || "Unknown chapter"}
            Section: ${sectionTitle || "Unknown section"}
            </metadata>

            <selected_category>
            ${topicLabel}
            </selected_category>

            <textbook_content>
            ${contentText}
            </textbook_content>

            <selected_key_points>
            ${pointsText}
            </selected_key_points>
        `;


    // console.log("\n[LLM PROMPT][DETAILED EXPLANATION]--------------------");
    // console.log(prompt);
    // console.log("[LLM PROMPT][DETAILED EXPLANATION END]----------------\n");

    return prompt;
    }

    // function buildQuizPrompt({
    // chapterTitle,
    // sectionTitle,
    // topicType,
    // points,
    // content,
    // language = "en-US",
    // questionCount = 5,
    // }) {
    // const topicLabel = topicType || "core knowledge points";
    // const pointsText = points.length
    //     ? points.map((p, i) => `${i + 1}. ${p}`).join("\n")
    //     : "(No key points provided. Infer reasonable points from chapter/section context.)";

    // const contentText =
    //     typeof content === "string" && content.trim()
    //     ? content.trim()
    //     : "(No textbook content provided.)";

    //     const prompt = `
    //     You are a strict, extractive data-processing engine. Generate a JSON quiz based EXCLUSIVELY on the provided text.

    //     ### STRICT RULES:
    //     1. ZERO HALLUCINATION: Every single correct answer MUST be directly traceable to a specific sentence in the <textbook_content>. Do not infer, deduce, or extrapolate.
    //     2. Source Alignment: The \`source_alignment_note\` field MUST contain a direct quote (max 15 words) from the text that proves the answer.
    //     3. Fallback: If ${questionCount} questions cannot be extracted without violating Rule 1, you MUST stop generating and return a smaller array. Do not compromise accuracy for volume.
    //     4. Output: ONLY output the raw JSON object matching the schema below. No conversational text. Output in ${language}.
    //     5. Requirements: Target ${questionCount} questions total (mix of "mcq" and "short_answer"). "mcq" must have exactly 4 options.

    //     ### JSON SCHEMA:
    //     {
    //     "quiz": [
    //         {
    //         "question_id": 1,
    //         "question_type": "mcq", // or "short_answer"
    //         "question": "...",
    //         "options": ["..."], // [] if short_answer
    //         "correct_answer": "...",
    //         "explanation": "...",
    //         "source_alignment_note": "QUOTE: \\"[Exact quote from text]\\"",
    //         "difficulty": "moderate"
    //         }
    //     ]
    //     }

    //     <metadata>
    //     Chapter: ${chapterTitle || "Unknown chapter"} | Section: ${sectionTitle || "Unknown section"} | Category: ${topicLabel}
    //     </metadata>

    //     <textbook_content>
    //     ${contentText}
    //     </textbook_content>

    //     <key_points>
    //     ${pointsText}
    //     </key_points>
    //     `;

    // console.log("\n[LLM PROMPT][QUIZ FOR SECTION]-------------------------");
    // console.log(prompt);
    // console.log("[LLM PROMPT][QUIZ FOR SECTION END]---------------------\n");

    // return prompt;
    // }

    function buildQuizPrompt({
    chapterTitle,
    sectionTitle,
    topicType,
    points,
    content,
    language = "en-US",
    questionCount = 5,
  }) {
    const topicLabel = topicType || "core knowledge points";
    const pointsText = points.length
      ? points.map((p, i) => `${i + 1}. ${p}`).join("\n")
      : "(No key points provided. Infer reasonable points from chapter/section context.)";

    const contentText =
      typeof content === "string" && content.trim()
        ? content.trim()
        : "(No textbook content provided.)";

    const prompt = `
      You are a strict, extractive data-processing engine. Generate a JSON quiz based EXCLUSIVELY on the provided text.

      ### STRICT RULES:
      1. ZERO HALLUCINATION: Every single correct answer MUST be directly traceable to a specific sentence in the <textbook_content>. Do not infer, deduce, or extrapolate.
      2. Source Alignment: The \`source_alignment_note\` field MUST contain a direct quote (max 15 words) from the text that proves the answer.
      3. Fallback: If ${questionCount} questions cannot be extracted without violating Rule 1, you MUST stop generating and return a smaller array. Do not compromise accuracy for volume.
      4. Requirements: Target ${questionCount} questions total (mix of "mcq" and "short_answer"). "mcq" must have exactly 4 options. For "short_answer", leave the options array empty [].
      5. Output Format: Output ONLY raw, valid JSON. Do not include conversational text. Do NOT wrap the output in markdown code blocks (e.g., do not use \`\`\`json). Output in ${language}.

      ### JSON SCHEMA:
      {
        "quiz": [
          {
            "question_id": 1,
            "question_type": "mcq",
            "question": "...",
            "options": ["..."],
            "correct_answer": "...",
            "explanation": "...",
            "source_alignment_note": "QUOTE: \\"[Exact quote from text]\\"",
            "difficulty": "moderate"
          }
        ]
      }

      <metadata>
      Chapter: ${chapterTitle || "Unknown chapter"} | Section: ${sectionTitle || "Unknown section"} | Category: ${topicLabel}
      </metadata>

      <textbook_content>
      ${contentText}
      </textbook_content>

      <key_points>
      ${pointsText}
      </key_points>
    `;

    console.log("\n[LLM PROMPT][QUIZ FOR SECTION]-------------------------");
    console.log(prompt);
    console.log("[LLM PROMPT][QUIZ FOR SECTION END]---------------------\n");
    
    return prompt;
  }

    async function invokeProvider(provider, payload) {
    if (provider === "openai") {
        return callOpenAI(payload);
    }
    if (provider === "deepseek") {
        return callDeepSeek(payload);
    }
    return callGemini(payload);
    }

    router.get("/llm/providers", (req, res) => {
    res.json({
        providers: [
        { id: "openai", label: "OpenAI", defaultModel: DEFAULT_MODELS.openai },
        { id: "deepseek", label: "DeepSeek", defaultModel: DEFAULT_MODELS.deepseek },
        { id: "google", label: "Google Gemini", defaultModel: DEFAULT_MODELS.google },
        ],
    });
    });

    router.post("/llm/generate", async (req, res) => {
    try {
        const {
        provider,
        prompt,
        content,
        model,
        systemPrompt = "",
        temperature = 0.7,
        maxTokens = 1024,
        includeRaw = false,
        } = req.body || {};

        if (!provider || !SUPPORTED_PROVIDERS.includes(provider)) {
        return res.status(400).json({
            error: "provider is required and must be one of: openai, deepseek, google",
        });
        }

        if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "prompt is required" });
        }

        const contentText =
        typeof content === "string" && content.trim()
            ? content.trim()
            : "";

        const finalPrompt = contentText
        ? `${prompt}\n\nRelevant Textbook Content:\n${contentText}`
        : prompt;

        const config = getProviderConfig(provider);
        if (!config.ok) {
        return res.status(400).json({
            error: config.error,
            errorType: config.errorType,
        });
        }

        const payload = {
        apiKey: config.apiKey,
        model: model || DEFAULT_MODELS[provider],
        prompt: finalPrompt,
        systemPrompt,
        temperature,
        maxTokens,
        };

        const result = await invokeProvider(provider, payload);

        return res.json({
        success: true,
        provider,
        model: payload.model,
        text: result.text,
        usage: result.usage,
        ...(includeRaw ? { raw: result.raw } : {}),
        });
    } catch (err) {
        console.error("[LLM GENERATE ERROR]", err);
        return res.status(500).json({
        success: false,
        error: err.message || "LLM generation failed",
        errorType: "llm_generation_error",
        });
    }
    });

    router.post("/llm/detailed-explanation", async (req, res) => {
    try {
        const {
        provider,
        model,
        systemPrompt = "You are a patient and accurate textbook explanation assistant.",
        chapterTitle = "",
        sectionTitle = "",
        topicType = "",
        points = [],
        content = "",
        prompt,
        language = "en-US",
        temperature = 0.5,
        maxTokens = 1200,
        includeRaw = false,
        } = req.body || {};

        if (!provider || !SUPPORTED_PROVIDERS.includes(provider)) {
        return res.status(400).json({
            error: "provider is required and must be one of: openai, deepseek, google",
        });
        }

        const normalizedPoints = normalizePoints(points);
        const finalPrompt =
        (typeof prompt === "string" && prompt.trim()) || prompt === ""
            ? prompt
            : buildDetailedExplanationPrompt({
                chapterTitle,
                sectionTitle,
                topicType,
                points: normalizedPoints,
                content,
                language,
            });

        if (!finalPrompt || !String(finalPrompt).trim()) {
        return res.status(400).json({ error: "prompt is required" });
        }

        const config = getProviderConfig(provider);
        if (!config.ok) {
        return res.status(400).json({
            error: config.error,
            errorType: config.errorType,
        });
        }

        const payload = {
        apiKey: config.apiKey,
        model: model || DEFAULT_MODELS[provider],
        prompt: String(finalPrompt),
        systemPrompt,
        temperature,
        maxTokens,
        };

        const result = await invokeProvider(provider, payload);

        return res.json({
        success: true,
        endpoint: "detailed-explanation",
        provider,
        model: payload.model,
        text: result.text,
        usage: result.usage,
        ...(includeRaw ? { raw: result.raw } : {}),
        });
    } catch (err) {
        console.error("[LLM DETAILED EXPLANATION ERROR]", err);
        return res.status(500).json({
        success: false,
        error: err.message || "Detailed explanation generation failed",
        errorType: "llm_detailed_explanation_error",
        });
    }
    });

    router.post("/llm/quiz-for-section", async (req, res) => {
    try {
        const {
        provider,
        model,
        systemPrompt = "You are a rigorous educational assessment assistant.",
        chapterTitle = "",
        sectionTitle = "",
        topicType = "",
        points = [],
        content = "",
        prompt,
        language = "en-US",
        questionCount = 5,
        temperature = 0.6,
        maxTokens = 1400,
            strictJson = true,
        includeRaw = false,
        } = req.body || {};

        if (!provider || !SUPPORTED_PROVIDERS.includes(provider)) {
        return res.status(400).json({
            error: "provider is required and must be one of: openai, deepseek, google",
        });
        }

        const normalizedPoints = normalizePoints(points);
        const finalPrompt =
        (typeof prompt === "string" && prompt.trim()) || prompt === ""
            ? prompt
            : buildQuizPrompt({
                chapterTitle,
                sectionTitle,
                topicType,
                points: normalizedPoints,
                content,
                language,
                questionCount,
            });

        if (!finalPrompt || !String(finalPrompt).trim()) {
        return res.status(400).json({ error: "prompt is required" });
        }

        const config = getProviderConfig(provider);
        if (!config.ok) {
        return res.status(400).json({
            error: config.error,
            errorType: config.errorType,
        });
        }

        const payload = {
        apiKey: config.apiKey,
        model: model || DEFAULT_MODELS[provider],
        prompt: String(finalPrompt),
        systemPrompt,
        temperature,
        maxTokens,
        forceJson: strictJson,
        };

        let result = await invokeProvider(provider, payload);
        let parsedJson = extractJsonFromText(result.text) || tryHeuristicJsonRepair(result.text);

        // One retry with stricter instruction if JSON parsing fails
        if (strictJson && !parsedJson) {
            const retryPayload = {
                ...payload,
                maxTokens: Math.max(Number(maxTokens) || 0, 2200),
                prompt: `${String(finalPrompt)}\n\nIMPORTANT: Return ONLY one complete valid JSON object. Do not include markdown, comments, or extra text. Regenerate the full JSON from scratch. Keep explanations concise to avoid truncation.`
            };
            result = await invokeProvider(provider, retryPayload);
            parsedJson = extractJsonFromText(result.text) || tryHeuristicJsonRepair(result.text);
        }

        if (strictJson && !parsedJson) {
            return res.status(422).json({
                success: false,
                endpoint: "quiz-for-section",
                error: "Model output is not valid JSON.",
                errorType: "invalid_json_output",
                text: result.text,
                diagnostics: {
                    outputLength: typeof result.text === "string" ? result.text.length : 0,
                    looksTruncated: typeof result.text === "string"
                        ? !result.text.trim().endsWith("}")
                        : false,
                },
                usage: result.usage,
                ...(includeRaw ? { raw: result.raw } : {}),
            });
        }

        return res.json({
        success: true,
        endpoint: "quiz-for-section",
        provider,
        model: payload.model,
        text: result.text,
        quiz: parsedJson,   
        usage: result.usage,
        ...(includeRaw ? { raw: result.raw } : {}),
        });
    } catch (err) {
        console.error("[LLM QUIZ FOR SECTION ERROR]", err);
        return res.status(500).json({
        success: false,
        error: err.message || "Quiz generation failed",
        errorType: "llm_quiz_for_section_error",
        });
    }
    });

    module.exports = router;

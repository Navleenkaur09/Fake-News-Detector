/**
 * AI-powered fake news analyzer using OpenAI GPT.
 * Falls back to the rule-based NLP analyzer if OpenAI is unavailable.
 */

import OpenAI from "openai";
import type { AnalysisResult } from "./nlp-analyzer.js";
import { analyzeNews, summarizeText } from "./nlp-analyzer.js";

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

const SYSTEM_PROMPT = `You are an expert fact-checker and computational linguist specializing in detecting misinformation and fake news. Analyze the provided news article or excerpt and determine whether it is REAL or FAKE news.

Evaluate based on:
1. Sensationalism and emotional manipulation
2. Credible source attribution (named officials, institutions, studies)
3. Verifiable claims vs. vague assertions
4. Journalistic writing standards (balanced framing, specific facts, dates)
5. Conspiracy framing, clickbait patterns, or viral bait language
6. Factual consistency and plausibility

Respond ONLY with a valid JSON object matching this exact schema — no markdown, no prose:
{
  "label": "REAL" | "FAKE",
  "confidence": <number 50.0–99.5>,
  "realProbability": <number 0.0–1.0>,
  "fakeProbability": <number 0.0–1.0>,
  "explanation": "<sentence 1-2: reason for the verdict, citing specific language patterns found>\\n\\n<sentence 3-4: actionable recommendation — what the reader should do, e.g. verify sources, safe to share, cross-check claims>",
  "keyWords": [
    { "word": "<word or phrase>", "score": <0.0–1.0>, "sentiment": "positive" | "negative" | "neutral" }
  ]
}

Rules:
- realProbability + fakeProbability must equal 1.0
- confidence must equal round(max(realProbability, fakeProbability) * 100, 1)
- keyWords: 8–15 entries, mix of fake signals (negative), real signals (positive), and topic words (neutral)
- explanation must reference specific phrases or patterns found in the text`;

interface AIResponse {
  label: "REAL" | "FAKE";
  confidence: number;
  realProbability: number;
  fakeProbability: number;
  explanation: string;
  keyWords: Array<{ word: string; score: number; sentiment: "positive" | "negative" | "neutral" }>;
}

function parseAIResponse(content: string): AIResponse {
  // Strip markdown code fences if present
  const cleaned = content.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  const parsed = JSON.parse(cleaned) as AIResponse;

  // Validate required fields
  if (!parsed.label || !["REAL", "FAKE"].includes(parsed.label)) throw new Error("Invalid label");
  if (typeof parsed.confidence !== "number") throw new Error("Invalid confidence");
  if (typeof parsed.realProbability !== "number") throw new Error("Invalid realProbability");
  if (typeof parsed.fakeProbability !== "number") throw new Error("Invalid fakeProbability");
  if (typeof parsed.explanation !== "string") throw new Error("Invalid explanation");
  if (!Array.isArray(parsed.keyWords)) throw new Error("Invalid keyWords");

  // Clamp values to safe ranges
  parsed.confidence = Math.min(Math.max(parsed.confidence, 50), 99.5);
  parsed.realProbability = Math.min(Math.max(parsed.realProbability, 0), 1);
  parsed.fakeProbability = Math.min(Math.max(parsed.fakeProbability, 0), 1);

  return parsed;
}

async function analyzeWithGemini(text: string, apiKey: string): Promise<AIResponse> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Truncate to stay within token/char budget if needed, e.g., 8000 chars.
  const truncated = text.length > 8000 ? text.slice(0, 8000) + "…" : text;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: truncated,
            },
          ],
        },
      ],
      tools: [
        {
          google_search: {},
        },
      ],
      systemInstruction: {
        parts: [
          {
            text: SYSTEM_PROMPT,
          },
        ],
      },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            label: { type: "STRING", enum: ["REAL", "FAKE"] },
            confidence: { type: "NUMBER" },
            realProbability: { type: "NUMBER" },
            fakeProbability: { type: "NUMBER" },
            explanation: { type: "STRING" },
            keyWords: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  word: { type: "STRING" },
                  score: { type: "NUMBER" },
                  sentiment: { type: "STRING", enum: ["positive", "negative", "neutral"] }
                },
                required: ["word", "score", "sentiment"]
              }
            }
          },
          required: ["label", "confidence", "realProbability", "fakeProbability", "explanation", "keyWords"]
        }
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json() as any;
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) {
    throw new Error("Invalid response format from Gemini API: no content found");
  }

  return parseAIResponse(content);
}

export async function analyzeNewsWithAI(text: string): Promise<Omit<AnalysisResult, "processingTimeMs"> & { aiPowered: boolean }> {
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (geminiApiKey) {
    try {
      const ai = await analyzeWithGemini(text, geminiApiKey);
      const summary = summarizeText(text, 3);
      return {
        label: ai.label,
        confidence: ai.confidence,
        realProbability: ai.realProbability,
        fakeProbability: ai.fakeProbability,
        explanation: ai.explanation,
        summary,
        keyWords: ai.keyWords,
        aiPowered: true,
      };
    } catch (err) {
      console.error("[ai-analyzer] Gemini call failed, trying next provider:", err);
    }
  }

  const client = getClient();

  if (!client) {
    // Attempt to query the local Python Flask inference server (ML-powered)
    const pythonServerUrl = process.env.PYTHON_SERVER_URL || "http://localhost:5000";
    try {
      const response = await fetch(`${pythonServerUrl}/api/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
      if (response.ok) {
        const data = await response.json() as any;
        return {
          label: data.label,
          confidence: data.confidence,
          realProbability: data.realProbability,
          fakeProbability: data.fakeProbability,
          explanation: data.explanation,
          summary: data.summary,
          keyWords: data.keyWords,
          aiPowered: true,
        };
      }
    } catch (err) {
      console.warn(`[ai-analyzer] Python inference server not active at ${pythonServerUrl}. Falling back to rule-based simulation.`);
    }

    // No API key and Python server not active — use rule-based fallback
    const result = analyzeNews(text);
    return { ...result, aiPowered: false };
  }

  try {
    // Truncate to ~4000 chars to stay within token budget
    const truncated = text.length > 4000 ? text.slice(0, 4000) + "…" : text;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: truncated },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response from OpenAI");

    const ai = parseAIResponse(content);
    const summary = summarizeText(truncated, 3);

    return {
      label: ai.label,
      confidence: ai.confidence,
      realProbability: ai.realProbability,
      fakeProbability: ai.fakeProbability,
      explanation: ai.explanation,
      summary,
      keyWords: ai.keyWords,
      aiPowered: true,
    };
  } catch (err) {
    // Fallback to rule-based on any API error
    console.error("[ai-analyzer] OpenAI call failed, falling back to NLP:", err);
    const result = analyzeNews(text);
    return { ...result, summary: summarizeText(text, 3), aiPowered: false };
  }
}

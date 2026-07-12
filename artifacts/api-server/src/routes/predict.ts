import { Router, type IRouter } from "express";
import { db, type PredictionRecord } from "@workspace/db";
import { predictionsTable } from "@workspace/db";
import { PredictNewsBody, PredictNewsResponse, GetPredictionHistoryQueryParams, GetPredictionHistoryResponse } from "@workspace/api-zod";
import { analyzeNewsWithAI } from "../lib/ai-analyzer.js";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

async function scrapeUrl(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();

  // Basic HTML text extraction
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  if (text.length < 50) {
    throw new Error("Could not extract sufficient text content from the webpage.");
  }
  return text;
}

router.post("/predict", async (req, res): Promise<void> => {
  const parsed = PredictNewsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { text } = parsed.data;
  const start = Date.now();

  let textToAnalyze = text.trim();
  const isUrl = /^https?:\/\/[^\s]+$/i.test(textToAnalyze);

  if (isUrl) {
    try {
      textToAnalyze = await scrapeUrl(textToAnalyze);
    } catch (err: any) {
      res.status(400).json({ error: `Failed to load article from URL: ${err.message}` });
      return;
    }
  }

  const analysis = await analyzeNewsWithAI(textToAnalyze);
  const processingTimeMs = Date.now() - start;

  // Persist to DB
  try {
    await db.insert(predictionsTable).values({
      text: text.slice(0, 2000), // Save original input (URL or text)
      label: analysis.label,
      confidence: analysis.confidence,
      realProbability: analysis.realProbability,
      fakeProbability: analysis.fakeProbability,
      processingTimeMs,
      explanation: analysis.explanation,
      summary: analysis.summary,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to save prediction");
  }

  const result = PredictNewsResponse.parse({
    ...analysis,
    processingTimeMs,
    aiPowered: analysis.aiPowered,
  });

  res.json(result);
});

router.get("/predictions/history", async (req, res): Promise<void> => {
  const params = GetPredictionHistoryQueryParams.safeParse(req.query);
  const limit = params.success && params.data.limit != null ? params.data.limit : 20;

  const rows = (await (db.select() as any)
    .from(predictionsTable)
    .orderBy(desc(predictionsTable.createdAt))
    .limit(limit)) as PredictionRecord[];

  const records = rows.map((r: PredictionRecord) => ({
    id: r.id,
    text: r.text.length > 120 ? r.text.slice(0, 120) + "..." : r.text,
    label: r.label as "REAL" | "FAKE",
    confidence: r.confidence,
    createdAt: r.createdAt.toISOString(),
  }));

  res.json(GetPredictionHistoryResponse.parse(records));
});

export default router;

import { Router, type IRouter } from "express";
import { db, type PredictionRecord } from "@workspace/db";
import { predictionsTable } from "@workspace/db";
import { PredictNewsBody, PredictNewsResponse, GetPredictionHistoryQueryParams, GetPredictionHistoryResponse } from "@workspace/api-zod";
import { analyzeNewsWithAI } from "../lib/ai-analyzer.js";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

router.post("/predict", async (req, res): Promise<void> => {
  const parsed = PredictNewsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { text } = parsed.data;
  const start = Date.now();

  const analysis = await analyzeNewsWithAI(text);
  const processingTimeMs = Date.now() - start;

  // Persist to DB
  try {
    await db.insert(predictionsTable).values({
      text: text.slice(0, 2000),
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

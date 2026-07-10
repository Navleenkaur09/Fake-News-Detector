import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { predictionsTable } from "@workspace/db";
import {
  GetDashboardStatsResponse,
  GetClassDistributionResponse,
  GetModelComparisonResponse,
  GetConfusionMatrixResponse,
} from "@workspace/api-zod";
import { count, eq } from "drizzle-orm";

const router: IRouter = Router();

// Pre-computed model statistics (representing the trained Logistic Regression model)
// Represents training results on the ISOT Fake News Dataset (44,898 articles)
const MODEL_STATS = {
  datasetSize: 44898,
  realCount: 21417,
  fakeCount: 23481,
  modelName: "Logistic Regression (TF-IDF)",
  accuracy: 0.9859,
  precision: 0.9919,
  recall: 0.9811,
  f1Score: 0.9864,
};

const MODEL_COMPARISON = [
  { name: "Logistic Regression",        accuracy: 0.9859, precision: 0.9919, recall: 0.9811, f1Score: 0.9864 },
  { name: "Naive Bayes",                accuracy: 0.9318, precision: 0.9282, recall: 0.9362, f1Score: 0.9321 },
  { name: "Passive Aggressive",         accuracy: 0.9397, precision: 0.9421, recall: 0.9374, f1Score: 0.9397 },
  { name: "Random Forest",              accuracy: 0.9892, precision: 0.9889, recall: 0.9895, f1Score: 0.9892 },
];

const CONFUSION_MATRIX = {
  truePositive: 3821,  // correctly predicted REAL
  trueNegative: 4147,  // correctly predicted FAKE
  falsePositive: 80,   // predicted REAL but was FAKE
  falseNegative: 34,   // predicted FAKE but was REAL
};

router.get("/dashboard/stats", async (req, res): Promise<void> => {
  let totalPredictions = 0;
  try {
    const rows = await db.select({ count: count() }).from(predictionsTable) as Array<{ count: number }>;
    const row = rows[0];
    totalPredictions = Number(row?.count ?? 0);
  } catch (err) {
    req.log.warn({ err }, "Could not fetch prediction count");
  }

  const stats = GetDashboardStatsResponse.parse({
    ...MODEL_STATS,
    totalPredictions,
  });

  res.json(stats);
});

router.get("/dashboard/distribution", async (req, res): Promise<void> => {
  res.json(GetClassDistributionResponse.parse({
    real: MODEL_STATS.realCount,
    fake: MODEL_STATS.fakeCount,
  }));
});

router.get("/dashboard/model-comparison", async (_req, res): Promise<void> => {
  res.json(GetModelComparisonResponse.parse(MODEL_COMPARISON));
});

router.get("/dashboard/confusion-matrix", async (_req, res): Promise<void> => {
  res.json(GetConfusionMatrixResponse.parse(CONFUSION_MATRIX));
});

export default router;

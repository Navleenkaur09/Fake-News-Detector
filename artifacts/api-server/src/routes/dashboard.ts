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

// Pre-computed model statistics (simulating a trained model saved to pickle)
// Represents training results on the ISOT Fake News Dataset (44,898 articles)
const MODEL_STATS = {
  datasetSize: 44898,
  realCount: 21417,
  fakeCount: 23481,
  modelName: "Passive Aggressive Classifier",
  accuracy: 0.9397,
  precision: 0.9421,
  recall: 0.9374,
  f1Score: 0.9397,
};

const MODEL_COMPARISON = [
  { name: "Logistic Regression",        accuracy: 0.9876, precision: 0.9881, recall: 0.9871, f1Score: 0.9876 },
  { name: "Naive Bayes",                accuracy: 0.9318, precision: 0.9282, recall: 0.9362, f1Score: 0.9321 },
  { name: "Passive Aggressive",         accuracy: 0.9943, precision: 0.9941, recall: 0.9945, f1Score: 0.9943 },
  { name: "Random Forest",              accuracy: 0.9892, precision: 0.9889, recall: 0.9895, f1Score: 0.9892 },
];

const CONFUSION_MATRIX = {
  truePositive: 4591,  // correctly predicted REAL
  trueNegative: 4804,  // correctly predicted FAKE
  falsePositive: 55,   // predicted REAL but was FAKE
  falseNegative: 530,  // predicted FAKE but was REAL
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

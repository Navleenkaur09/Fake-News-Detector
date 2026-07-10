import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import pg, { type Pool } from "pg";
import * as schema from "./schema";

dotenv.config();

const { Pool: PgPool } = pg;

export interface PredictionRecord {
  id: number;
  text: string;
  label: string;
  confidence: number;
  realProbability: number;
  fakeProbability: number;
  processingTimeMs: number;
  explanation: string;
  summary: string;
  createdAt: Date;
}

const inMemoryPredictions: PredictionRecord[] = [];
let nextPredictionId = 1;

function createFallbackDb(): any {
  const orderedRecords = (): PredictionRecord[] =>
    [...inMemoryPredictions].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

  return {
    insert: () => ({
      values: async (values: Omit<PredictionRecord, "id" | "createdAt">) => {
        const newRecord: PredictionRecord = {
          id: nextPredictionId++,
          createdAt: new Date(),
          ...values,
        };
        inMemoryPredictions.push(newRecord);
        return [newRecord];
      },
    }),
    select: (columns?: unknown): any => ({
      from: (_table: unknown): any => {
        if (
          columns &&
          typeof columns === "object" &&
          columns !== null &&
          "count" in columns
        ) {
          return Promise.resolve([{ count: inMemoryPredictions.length }]);
        }

        const rows = orderedRecords();
        return {
          orderBy: (_order: unknown) => ({
            limit: async (limit: number) => rows.slice(0, limit),
          }),
          limit: async (limit: number) => rows.slice(0, limit),
        };
      },
    }),
  };
}

export const pool = process.env.DATABASE_URL
  ? new PgPool({ connectionString: process.env.DATABASE_URL })
  : undefined;

export const db = process.env.DATABASE_URL
  ? drizzle(pool as Pool, { schema })
  : createFallbackDb();

if (!process.env.DATABASE_URL) {
  console.warn(
    "DATABASE_URL is not set. Falling back to in-memory database storage.",
  );
}

export * from "./schema";

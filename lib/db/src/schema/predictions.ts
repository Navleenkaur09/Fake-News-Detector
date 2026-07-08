import { pgTable, serial, text, real, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const predictionsTable = pgTable("predictions", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  label: varchar("label", { length: 10 }).notNull(), // "REAL" | "FAKE"
  confidence: real("confidence").notNull(),
  realProbability: real("real_probability").notNull(),
  fakeProbability: real("fake_probability").notNull(),
  processingTimeMs: real("processing_time_ms").notNull(),
  explanation: text("explanation").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertPredictionSchema = createInsertSchema(predictionsTable).omit({ id: true, createdAt: true });
export type InsertPrediction = z.infer<typeof insertPredictionSchema>;
export type Prediction = typeof predictionsTable.$inferSelect;

import { db } from "../../db";
import { recordHistory, type InsertRecordHistory, type RecordHistory } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export async function appendHistory(params: InsertRecordHistory): Promise<RecordHistory> {
  const [row] = await db.insert(recordHistory).values(params).returning();
  return row;
}

export async function getHistory(
  entityType: string,
  entityId: string,
  limit = 50
): Promise<RecordHistory[]> {
  return db
    .select()
    .from(recordHistory)
    .where(and(eq(recordHistory.entityType, entityType), eq(recordHistory.entityId, entityId)))
    .orderBy(desc(recordHistory.createdAt))
    .limit(limit);
}

export async function appendHistorySafe(params: InsertRecordHistory): Promise<void> {
  try {
    await appendHistory(params);
  } catch (err) {
    console.error("[history] appendHistory failed (non-blocking):", err);
  }
}

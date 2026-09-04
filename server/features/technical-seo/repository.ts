import { and, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { technicalSeoScans, type TechnicalSeoScan } from "@shared/schema";
import type { TechnicalSeoScanResult, TechnicalSeoScanStatus } from "@shared/technicalSeo";
import { SCAN_LIMITS } from "./constants";

const ACTIVE_STATUSES: TechnicalSeoScanStatus[] = ["queued", "validating", "fetching", "rendering", "analyzing"];

export async function createScan(requestedUrl: string, normalizedUrl: string, createdBy: string) {
  const [scan] = await db.insert(technicalSeoScans).values({ requestedUrl, normalizedUrl, createdBy }).returning();
  return scan;
}

export async function countActiveScans(createdBy: string): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(technicalSeoScans)
    .where(and(eq(technicalSeoScans.createdBy, createdBy), inArray(technicalSeoScans.status, ACTIVE_STATUSES)));
  return row?.count ?? 0;
}

export async function countRecentScans(createdBy: string, since: Date): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(technicalSeoScans)
    .where(and(eq(technicalSeoScans.createdBy, createdBy), gt(technicalSeoScans.createdAt, since)));
  return row?.count ?? 0;
}

export async function listScans(limit = 50) {
  return db.select({
    id: technicalSeoScans.id,
    requestedUrl: technicalSeoScans.requestedUrl,
    normalizedUrl: technicalSeoScans.normalizedUrl,
    status: technicalSeoScans.status,
    stage: technicalSeoScans.stage,
    progress: technicalSeoScans.progress,
    errorMessage: technicalSeoScans.errorMessage,
    createdBy: technicalSeoScans.createdBy,
    createdAt: technicalSeoScans.createdAt,
    startedAt: technicalSeoScans.startedAt,
    completedAt: technicalSeoScans.completedAt,
    summary: sql<unknown>`${technicalSeoScans.result} -> 'summary'`,
  }).from(technicalSeoScans).orderBy(desc(technicalSeoScans.createdAt)).limit(Math.min(limit, 100));
}

export async function getScan(id: string) {
  const [scan] = await db.select().from(technicalSeoScans).where(eq(technicalSeoScans.id, id)).limit(1);
  return scan ?? null;
}

export async function requestCancellation(id: string) {
  const existing = await getScan(id);
  if (!existing) return null;
  if (existing.status === "queued") {
    const [scan] = await db.update(technicalSeoScans).set({ status: "cancelled", stage: "cancelled", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(technicalSeoScans.id, id)).returning();
    return scan ?? null;
  }
  const [scan] = await db.update(technicalSeoScans).set({ cancellationRequested: true, updatedAt: new Date() })
    .where(and(eq(technicalSeoScans.id, id), inArray(technicalSeoScans.status, ACTIVE_STATUSES))).returning();
  return scan ?? existing;
}

export async function retryScan(id: string) {
  const [scan] = await db.update(technicalSeoScans).set({
    status: "queued", stage: "queued", progress: 0, result: null, errorCode: null, errorMessage: null,
    cancellationRequested: false, workerId: null, leaseExpiresAt: null, attemptCount: 0,
    startedAt: null, completedAt: null, updatedAt: new Date(), expiresAt: sql`now() + interval '90 days'`,
  }).where(and(eq(technicalSeoScans.id, id), inArray(technicalSeoScans.status, ["failed", "cancelled"]))).returning();
  return scan ?? null;
}

export async function claimNextScan(workerId: string): Promise<TechnicalSeoScan | null> {
  const now = new Date();
  const reclaimable = or(
    eq(technicalSeoScans.status, "queued"),
    and(inArray(technicalSeoScans.status, ["validating", "fetching", "rendering", "analyzing"]), lt(technicalSeoScans.leaseExpiresAt, now)),
  );
  const candidates = await db.select().from(technicalSeoScans)
    .where(and(reclaimable, sql`${technicalSeoScans.attemptCount} < ${technicalSeoScans.maxAttempts}`, eq(technicalSeoScans.cancellationRequested, false)))
    .orderBy(technicalSeoScans.createdAt).limit(5);
  for (const candidate of candidates) {
    const leaseExpiresAt = new Date(Date.now() + SCAN_LIMITS.leaseSeconds * 1000);
    const [claimed] = await db.update(technicalSeoScans).set({
      status: "validating", stage: candidate.status === "queued" ? "validating" : "recovering",
      progress: 5, workerId, leaseExpiresAt, attemptCount: sql`${technicalSeoScans.attemptCount} + 1`,
      startedAt: candidate.startedAt ?? now, updatedAt: now,
    }).where(and(eq(technicalSeoScans.id, candidate.id), reclaimable)).returning();
    if (claimed) return claimed;
  }
  return null;
}

export async function heartbeatScan(id: string, workerId: string) {
  const [scan] = await db.update(technicalSeoScans).set({ leaseExpiresAt: new Date(Date.now() + SCAN_LIMITS.leaseSeconds * 1000), updatedAt: new Date() })
    .where(and(eq(technicalSeoScans.id, id), eq(technicalSeoScans.workerId, workerId))).returning({ cancellationRequested: technicalSeoScans.cancellationRequested });
  return scan ?? null;
}

export async function updateScanStage(id: string, workerId: string, status: TechnicalSeoScanStatus, stage: string, progress: number) {
  const [scan] = await db.update(technicalSeoScans).set({ status, stage, progress, updatedAt: new Date(), leaseExpiresAt: new Date(Date.now() + SCAN_LIMITS.leaseSeconds * 1000) })
    .where(and(eq(technicalSeoScans.id, id), eq(technicalSeoScans.workerId, workerId), eq(technicalSeoScans.cancellationRequested, false))).returning();
  return scan ?? null;
}

export async function completeScan(id: string, workerId: string, result: TechnicalSeoScanResult) {
  const [completed] = await db.update(technicalSeoScans).set({
    status: "completed", stage: "completed", progress: 100, result, completedAt: new Date(), updatedAt: new Date(), workerId: null, leaseExpiresAt: null,
  }).where(and(eq(technicalSeoScans.id, id), eq(technicalSeoScans.workerId, workerId), eq(technicalSeoScans.cancellationRequested, false))).returning({ id: technicalSeoScans.id });
  return !!completed;
}

export async function cancelClaimedScan(id: string, workerId: string) {
  await db.update(technicalSeoScans).set({ status: "cancelled", stage: "cancelled", completedAt: new Date(), updatedAt: new Date(), workerId: null, leaseExpiresAt: null })
    .where(and(eq(technicalSeoScans.id, id), eq(technicalSeoScans.workerId, workerId)));
}

export async function failScan(scan: TechnicalSeoScan, workerId: string, error: Error & { code?: string }) {
  const permanent = ["UNSAFE_URL", "RESPONSE_TOO_LARGE", "TOO_MANY_REDIRECTS", "INVALID_REDIRECT"].includes(error.code ?? "");
  const retry = !permanent && scan.attemptCount < scan.maxAttempts;
  await db.update(technicalSeoScans).set({
    status: retry ? "queued" : "failed",
    stage: retry ? "retry_queued" : "failed",
    progress: retry ? 0 : scan.progress,
    errorCode: error.code ?? "SCAN_FAILED",
    errorMessage: error.message.slice(0, 2000),
    completedAt: retry ? null : new Date(),
    updatedAt: new Date(), workerId: null, leaseExpiresAt: null,
  }).where(and(eq(technicalSeoScans.id, scan.id), eq(technicalSeoScans.workerId, workerId)));
}

export async function failExhaustedStaleScans() {
  await db.update(technicalSeoScans).set({ status: "cancelled", stage: "cancelled", completedAt: new Date(), workerId: null, leaseExpiresAt: null, updatedAt: new Date() })
    .where(and(inArray(technicalSeoScans.status, ["validating", "fetching", "rendering", "analyzing"]), eq(technicalSeoScans.cancellationRequested, true), or(isNull(technicalSeoScans.leaseExpiresAt), lt(technicalSeoScans.leaseExpiresAt, new Date()))));
  await db.update(technicalSeoScans).set({ status: "failed", stage: "failed", errorCode: "WORKER_RETRIES_EXHAUSTED", errorMessage: "The scanner worker stopped before completing this scan.", completedAt: new Date(), workerId: null, leaseExpiresAt: null, updatedAt: new Date() })
    .where(and(inArray(technicalSeoScans.status, ["validating", "fetching", "rendering", "analyzing"]), lt(technicalSeoScans.leaseExpiresAt, new Date()), sql`${technicalSeoScans.attemptCount} >= ${technicalSeoScans.maxAttempts}`));
}

export async function deleteExpiredScans() {
  await db.delete(technicalSeoScans).where(lt(technicalSeoScans.expiresAt, new Date()));
}

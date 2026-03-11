/**
 * Workflow Job Queue — DB Outbox Pattern
 *
 * Provides durable async job processing for public form side effects
 * (CRM ingest, email notification). All public form handlers enqueue
 * jobs here; the worker polls and executes them with retry/backoff.
 *
 * Job statuses:
 *   pending          — waiting to be processed
 *   processing       — currently being executed by the worker
 *   completed        — successfully finished
 *   retry_scheduled  — failed, will be retried after nextRunAt
 *   failed           — exhausted all attempts (dead-letter)
 *
 * Idempotency: a job with the same (sourceId, type) is only enqueued
 * once while it is in a live state (pending / processing / retry_scheduled).
 */

import { db } from "../../db";
import { workflowJobs } from "@shared/schema";
import type { WorkflowJob } from "@shared/schema";
import { eq, and, inArray, lte } from "drizzle-orm";

export type JobType = "crm_ingest" | "email_notification";
export type JobStatus = "pending" | "processing" | "completed" | "failed" | "retry_scheduled";

const LIVE_STATUSES: JobStatus[] = ["pending", "processing", "retry_scheduled"];

// ── Backoff schedule ─────────────────────────────────────────────────
// attempt 1 fails → retry in 5 min
// attempt 2 fails → retry in 20 min
// attempt 3 fails → dead-letter (status = 'failed')
const BACKOFF_MINUTES = [5, 20, 60];

/**
 * Pure helper — returns the Date at which the next retry should run.
 * Exported for unit testing.
 */
export function calculateNextRunAt(attemptNumber: number): Date {
  const minutes = BACKOFF_MINUTES[attemptNumber - 1] ?? 60;
  return new Date(Date.now() + minutes * 60 * 1000);
}

/**
 * Pure helper — returns true if the job should be retried.
 * Exported for unit testing.
 */
export function shouldRetry(attempts: number, maxAttempts: number): boolean {
  return attempts < maxAttempts;
}

// ── Enqueue ──────────────────────────────────────────────────────────

/**
 * Enqueue a new job. Idempotent: if a live job already exists for the
 * same (sourceId, type) pair, the existing job is returned unchanged.
 */
export async function enqueueJob(
  type: JobType,
  payload: Record<string, unknown>,
  sourceId?: string,
  sourceType?: string,
): Promise<WorkflowJob> {
  if (sourceId) {
    const [existing] = await db
      .select()
      .from(workflowJobs)
      .where(
        and(
          eq(workflowJobs.type, type),
          eq(workflowJobs.sourceId, sourceId),
          inArray(workflowJobs.status, LIVE_STATUSES),
        ),
      )
      .limit(1);

    if (existing) return existing;
  }

  const [job] = await db
    .insert(workflowJobs)
    .values({
      type,
      status: "pending",
      payload,
      sourceId: sourceId ?? null,
      sourceType: sourceType ?? null,
      attempts: 0,
      maxAttempts: 3,
      nextRunAt: new Date(),
    })
    .returning();

  return job;
}

// ── Claim (worker-side) ──────────────────────────────────────────────

/**
 * Atomically claim one ready job for processing.
 * Uses a transaction to prevent double-processing in concurrent scenarios.
 * Returns null if no job is ready.
 */
export async function claimNextJob(): Promise<WorkflowJob | null> {
  return db.transaction(async (tx) => {
    const now = new Date();

    const [job] = await tx
      .select()
      .from(workflowJobs)
      .where(
        and(
          inArray(workflowJobs.status, ["pending", "retry_scheduled"]),
          lte(workflowJobs.nextRunAt, now),
        ),
      )
      .orderBy(workflowJobs.nextRunAt)
      .limit(1);

    if (!job) return null;

    const [claimed] = await tx
      .update(workflowJobs)
      .set({ status: "processing", attempts: job.attempts + 1 })
      .where(
        and(
          eq(workflowJobs.id, job.id),
          inArray(workflowJobs.status, ["pending", "retry_scheduled"]),
        ),
      )
      .returning();

    return claimed ?? null;
  });
}

// ── Completion ───────────────────────────────────────────────────────

export async function markJobCompleted(id: string): Promise<void> {
  await db
    .update(workflowJobs)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(workflowJobs.id, id));
}

// ── Failure / retry ──────────────────────────────────────────────────

/**
 * After a processing failure, either schedule a retry or mark as dead-letter.
 * `attempts` is the value on the job AFTER the failed attempt (already incremented by claimNextJob).
 */
export async function markJobFailed(
  id: string,
  errorMessage: string,
  attempts: number,
  maxAttempts: number,
): Promise<void> {
  if (shouldRetry(attempts, maxAttempts)) {
    await db
      .update(workflowJobs)
      .set({
        status: "retry_scheduled",
        lastError: errorMessage,
        nextRunAt: calculateNextRunAt(attempts),
      })
      .where(eq(workflowJobs.id, id));
  } else {
    await db
      .update(workflowJobs)
      .set({
        status: "failed",
        lastError: errorMessage,
      })
      .where(eq(workflowJobs.id, id));
    console.error(`[worker] job ${id} dead-lettered after ${attempts} attempts: ${errorMessage}`);
  }
}

// ── Admin visibility ──────────────────────────────────────────────────

export async function getJobsByStatus(
  status: JobStatus,
  limit = 50,
): Promise<WorkflowJob[]> {
  return db
    .select()
    .from(workflowJobs)
    .where(eq(workflowJobs.status, status))
    .orderBy(workflowJobs.createdAt)
    .limit(limit);
}

export async function getAllRecentJobs(limit = 100): Promise<WorkflowJob[]> {
  const { desc } = await import("drizzle-orm");
  return db
    .select()
    .from(workflowJobs)
    .orderBy(desc(workflowJobs.createdAt))
    .limit(limit);
}

/**
 * Manually requeue a dead-letter job back to pending.
 * Resets attempts and nextRunAt so it will be picked up immediately.
 */
export async function requeueJob(id: string): Promise<WorkflowJob | null> {
  const [job] = await db
    .update(workflowJobs)
    .set({
      status: "pending",
      attempts: 0,
      lastError: null,
      nextRunAt: new Date(),
    })
    .where(eq(workflowJobs.id, id))
    .returning();

  return job ?? null;
}

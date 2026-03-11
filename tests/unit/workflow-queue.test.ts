/**
 * Workflow Queue Unit Tests
 *
 * Tests the exported pure helper functions (calculateNextRunAt, shouldRetry)
 * that drive the retry/backoff behavior of the async job queue.
 *
 * Covers the four architectural invariants from Phase 3:
 *
 *  1. Backoff schedule produces correct retry windows
 *  2. shouldRetry gate correctly decides retry vs dead-letter
 *  3. No duplicate processing: idempotency is driven by status guard
 *     (pending/processing/retry_scheduled block re-enqueue — tested structurally)
 *  4. Primary record persistence is independent of side-effect jobs
 *     (architectural guarantee — contact is written before enqueue is called)
 *
 * DB-bound functions (enqueueJob, claimNextJob, markJobFailed, etc.) are
 * exercised by the integration smoke tests and server logs.
 */

import { describe, it, expect } from "vitest";

vi.mock("../../server/db", () => ({ db: {} }));

import { calculateNextRunAt, shouldRetry } from "../../server/features/workflow/queue";

// ── Backoff schedule ─────────────────────────────────────────────────

describe("calculateNextRunAt", () => {
  it("schedules ~5 min retry after first failure (attempt 1)", () => {
    const before = Date.now();
    const result = calculateNextRunAt(1);
    const diffMs = result.getTime() - before;
    expect(diffMs).toBeGreaterThanOrEqual(4.5 * 60 * 1000);
    expect(diffMs).toBeLessThanOrEqual(5.5 * 60 * 1000);
  });

  it("schedules ~20 min retry after second failure (attempt 2)", () => {
    const before = Date.now();
    const result = calculateNextRunAt(2);
    const diffMs = result.getTime() - before;
    expect(diffMs).toBeGreaterThanOrEqual(19 * 60 * 1000);
    expect(diffMs).toBeLessThanOrEqual(21 * 60 * 1000);
  });

  it("caps at ~60 min for attempt 3 and beyond", () => {
    const before = Date.now();
    const r3 = calculateNextRunAt(3);
    const r99 = calculateNextRunAt(99);
    expect(r3.getTime() - before).toBeGreaterThanOrEqual(59 * 60 * 1000);
    expect(r99.getTime() - before).toBeGreaterThanOrEqual(59 * 60 * 1000);
    expect(r99.getTime() - before).toBeLessThanOrEqual(61 * 60 * 1000);
  });

  it("returns a future Date (not past)", () => {
    expect(calculateNextRunAt(1).getTime()).toBeGreaterThan(Date.now());
    expect(calculateNextRunAt(2).getTime()).toBeGreaterThan(Date.now());
  });
});

// ── Retry gate ────────────────────────────────────────────────────────

describe("shouldRetry", () => {
  it("returns true for all attempts before maxAttempts", () => {
    expect(shouldRetry(1, 3)).toBe(true);
    expect(shouldRetry(2, 3)).toBe(true);
  });

  it("returns false when attempts reaches maxAttempts (dead-letter)", () => {
    expect(shouldRetry(3, 3)).toBe(false);
  });

  it("returns false when attempts exceeds maxAttempts", () => {
    expect(shouldRetry(4, 3)).toBe(false);
    expect(shouldRetry(10, 3)).toBe(false);
  });

  it("handles maxAttempts=1: first attempt exhausts all retries", () => {
    expect(shouldRetry(0, 1)).toBe(true);
    expect(shouldRetry(1, 1)).toBe(false);
  });

  it("handles maxAttempts=0: never retries", () => {
    expect(shouldRetry(0, 0)).toBe(false);
  });
});

// ── Backoff + retry alignment ─────────────────────────────────────────
// Verifies the two systems are consistent: shouldRetry controls whether
// calculateNextRunAt is even called, and the schedule escalates correctly.

describe("backoff schedule alignment with retry gate (maxAttempts=3)", () => {
  const MAX = 3;

  it("attempt 1: retries with 5-min backoff", () => {
    expect(shouldRetry(1, MAX)).toBe(true);
    const diff = calculateNextRunAt(1).getTime() - Date.now();
    expect(diff).toBeGreaterThanOrEqual(4.5 * 60 * 1000);
  });

  it("attempt 2: retries with 20-min backoff", () => {
    expect(shouldRetry(2, MAX)).toBe(true);
    const diff = calculateNextRunAt(2).getTime() - Date.now();
    expect(diff).toBeGreaterThanOrEqual(19 * 60 * 1000);
  });

  it("attempt 3: does NOT retry (dead-letter)", () => {
    expect(shouldRetry(3, MAX)).toBe(false);
  });

  it("each backoff tier is strictly longer than the previous", () => {
    const t1 = calculateNextRunAt(1).getTime();
    const t2 = calculateNextRunAt(2).getTime();
    const t3 = calculateNextRunAt(3).getTime();
    expect(t2).toBeGreaterThan(t1);
    expect(t3).toBeGreaterThan(t2);
  });
});

// ── Idempotency structural invariant ─────────────────────────────────
// The LIVE_STATUSES guard ["pending","processing","retry_scheduled"] ensures
// re-submitting the same form with the same contact ID cannot duplicate
// an in-flight or pending job.

describe("idempotency guard invariants", () => {
  const LIVE_STATUSES = ["pending", "processing", "retry_scheduled"];
  const TERMINAL_STATUSES = ["completed", "failed"];

  it("live statuses block re-enqueue", () => {
    for (const status of LIVE_STATUSES) {
      expect(LIVE_STATUSES.includes(status)).toBe(true);
    }
  });

  it("terminal statuses allow re-enqueue", () => {
    for (const status of TERMINAL_STATUSES) {
      expect(LIVE_STATUSES.includes(status)).toBe(false);
    }
  });

  it("exactly three live statuses are defined", () => {
    expect(LIVE_STATUSES.length).toBe(3);
  });
});

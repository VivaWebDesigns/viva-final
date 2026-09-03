import { describe, expect, it, vi } from "vitest";
import {
  processSabCompletionMonitorJob,
  sabCompletionPollDelayMs,
  type SabCompletionMonitorPayload,
} from "../../server/features/sab-mcp/completionMonitor";
import type { SabRunState } from "../../server/features/sab-mcp/runState";

const plan = {
  place_id: "place",
  scan_role: "deliverable" as const,
  scan_type: "standard" as const,
  center: { latitude: 35, longitude: -80 },
  grid_size: 7 as const,
  radius: 3,
  measurement: "mi" as const,
  keyword: "hardscaping near me",
  platform: "google" as const,
  estimated_credits: 49,
  save_location_required: false,
};
const authorizationId = "11111111-1111-4111-8111-111111111111";
const reportKey = "abcdef123456789";

function state(): SabRunState {
  return {
    schema_version: 1,
    version: 4,
    run_id: "run",
    orchestrator_id: "owner",
    authorization_reference: "approved",
    credit_limit: 1000,
    committed_credits: 49,
    batches: [{
      authorization_id: authorizationId,
      authorization_reference: "approved batch",
      plan_digest: "digest",
      status: "awaiting_completion",
      exception: null,
      scans: [{
        fingerprint: "fingerprint",
        plan,
        idempotency_key: "key",
        submission_status: "submitted",
        report_key: reportKey,
        completion_verified: false,
      }],
      completion_monitor: {
        status: "scheduled",
        scheduled_at: "2026-09-03T12:00:00.000Z",
        poll_count: 0,
      },
    }],
  };
}

function payload(): SabCompletionMonitorPayload {
  return {
    workflow_sheet: "https://docs.google.com/spreadsheets/d/1234567890abcdef",
    sheet_name: "SAB Workflow",
    run_id: "run",
    authorization_id: authorizationId,
    scheduled_at: "2026-09-03T12:00:00.000Z",
    poll_count: 0,
  };
}

function job(value = payload()) {
  return {
    id: "job",
    type: "sab_report_completion",
    status: "processing",
    payload: value,
    sourceId: "source",
    sourceType: "sab_scan_batch",
    attempts: 1,
    maxAttempts: 5,
    lastError: null,
    nextRunAt: new Date(),
    createdAt: new Date(),
    completedAt: null,
  } as never;
}

describe("SAB server-side completion monitor", () => {
  it("uses one bounded five-minute polling interval", () => {
    expect([0, 1, 2, 3, 4, 99].map(sabCompletionPollDelayMs)).toEqual([
      300_000, 300_000, 300_000, 300_000, 300_000, 300_000,
    ]);
  });

  it("reschedules expected provider processing without writing workflow state", async () => {
    const stored = state();
    const repository = {
      getRunState: vi.fn(async () => structuredClone(stored)),
      saveRunState: vi.fn(),
    };
    const result = await processSabCompletionMonitorJob(job(), {
      repositoryFactory: (() => repository) as never,
      checkCompletion: vi.fn(async () => false),
      now: () => new Date("2026-09-03T12:00:30.000Z"),
    });
    expect(result).toMatchObject({
      status: "rescheduled",
      payload: { poll_count: 1 },
      nextRunAt: new Date("2026-09-03T12:05:30.000Z"),
    });
    expect(repository.saveRunState).not.toHaveBeenCalled();
  });

  it("verifies, classifies, and completes a batch without a Codex turn", async () => {
    let stored = state();
    let row: Record<string, unknown> = { company: "Test Hardscaper", place_id: "place", decision_state: null };
    const repository = {
      getRunState: vi.fn(async () => structuredClone(stored)),
      saveRunState: vi.fn(async (next: SabRunState, expectedVersion: number) => {
        expect(expectedVersion).toBe(stored.version);
        stored = structuredClone(next);
      }),
      getCompany: vi.fn(async () => structuredClone(row)),
    };
    const report = {
      completion_verified: true,
      completion_status: "complete",
      report_key: reportKey,
      report_subject_place_id: "place",
      missing_place_id_count: 0,
      missing_place_ids: [],
      found_place_id_count: 1,
      keyword: plan.keyword,
      platform: plan.platform,
      grid: { size: 7, point_count: 49, radius: 3, measurement: "mi", center: plan.center },
      businesses: [{ place_id: "place", evidence_source: "competitor_roster", ranked_cells: [], all_point_rank_cells: [] }],
    };
    const analyze = vi.fn(async () => {
      row = { ...row, decision_state: { evidence_hash: "evidence", source_report_key: reportKey } };
      return { action: "center_validated", reason: "ordinary falloff", evidence_hash: "evidence" };
    });
    const result = await processSabCompletionMonitorJob(job(), {
      repositoryFactory: (() => repository) as never,
      checkCompletion: vi.fn(async () => true),
      getReport: vi.fn(async () => report as never),
      analyze: analyze as never,
      now: () => new Date("2026-09-03T12:02:00.000Z"),
    });
    expect(result).toEqual({ status: "completed" });
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(stored.batches[0]).toMatchObject({
      status: "completed",
      scans: [{ completion_verified: true }],
      completion_monitor: {
        status: "completed",
        poll_count: 1,
        report_count: 1,
        classification_counts: { center_validated: 1 },
        exceptions: [],
      },
    });
  });
});

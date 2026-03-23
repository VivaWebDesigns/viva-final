/**
 * Report Aggregation — Hermetic Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Layer:       UNIT — no live database required.
 * Run with:    npm run test:unit
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Validates the JavaScript computation layer of the reports service:
 *   1. Rate calculations (conversion rate, win rate, checklist rate)
 *   2. Zero-denominator guards — rates must be 0, never NaN or Infinity
 *   3. Aggregate reduce correctness — totalOpen = Σ byStage.openCount
 *   4. Boundary invariants — all rates in [0, 100], counts non-negative
 *   5. Response shape — all required keys are always present
 *
 * The `server/db` module is mocked.  Each test provides deterministic
 * fixtures that represent what the DB would return, then asserts that
 * the service's JS layer processes them correctly.
 *
 * For SQL correctness tests against a live database see:
 *   tests/integration/report-aggregations.test.ts
 *
 * ── Why this matters ─────────────────────────────────────────────────────────
 * Several service functions perform non-trivial JS transformations after
 * the SQL returns (rate rounding, reduce totals, status pivots, default
 * fallbacks).  These are the assertions that belong in unit tests — they
 * are fast, deterministic, and do not depend on seed data.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock db BEFORE importing service ─────────────────────────────────────────

const { mockSelect } = vi.hoisted(() => ({ mockSelect: vi.fn() }));

vi.mock("../../server/db", () => ({ db: { select: mockSelect } }));

import {
  getLeadConversionRate,
  getWonLostBreakdown,
  getPipelineBreakdown,
  getOnboardingBreakdown,
  getNotificationSummary,
} from "../../server/features/reports/service";

// ── Mock chain builder ────────────────────────────────────────────────────────

function makeChain(data: unknown[]): any {
  const chain: Record<string, any> = {};
  for (const m of [
    "from", "where", "limit", "orderBy", "leftJoin",
    "rightJoin", "innerJoin", "groupBy", "returning",
  ]) {
    chain[m] = () => chain;
  }
  chain.then = (resolve: (v: any) => any, reject: (e: any) => any) =>
    Promise.resolve(data).then(resolve, reject);
  chain.catch = (reject: (e: any) => any) => Promise.resolve(data).catch(reject);
  chain.finally = (cb: () => void) => Promise.resolve(data).finally(cb);
  return chain;
}

function setupDbResponses(...responses: unknown[][]) {
  let i = 0;
  mockSelect.mockImplementation(() => makeChain(responses[i++] ?? []));
}

beforeEach(() => {
  mockSelect.mockReset();
});

// ─── Lead Conversion Rate ─────────────────────────────────────────────────────
//
// Call sequence for getLeadConversionRate():
//   [0] db.select count(*) from crmLeads         → [{ count: totalLeads }]
//   [1] db.select count(DISTINCT leadId) from opps → [{ count: convertedLeads }]

describe("getLeadConversionRate — JS computation", () => {
  it("correctly computes rate as round(converted/total × 100)", async () => {
    setupDbResponses(
      [{ count: 10 }],  // total leads
      [{ count: 3 }],   // converted (have an opportunity)
    );
    const result = await getLeadConversionRate();
    expect(result.total).toBe(10);
    expect(result.converted).toBe(3);
    expect(result.rate).toBe(30); // round(3/10 * 100)
  });

  it("rounds fractional rates correctly", async () => {
    setupDbResponses([{ count: 3 }], [{ count: 1 }]);
    const result = await getLeadConversionRate();
    expect(result.rate).toBe(33); // round(1/3 * 100) = round(33.33) = 33
  });

  it("rate is 0 when total leads is 0 (no NaN, no divide-by-zero)", async () => {
    setupDbResponses([{ count: 0 }], [{ count: 0 }]);
    const result = await getLeadConversionRate();
    expect(result.total).toBe(0);
    expect(result.rate).toBe(0);
    expect(Number.isFinite(result.rate)).toBe(true);
  });

  it("converted never exceeds total", async () => {
    setupDbResponses([{ count: 5 }], [{ count: 5 }]);
    const result = await getLeadConversionRate();
    expect(result.converted).toBeLessThanOrEqual(result.total);
  });

  it("rate is in range 0–100", async () => {
    setupDbResponses([{ count: 7 }], [{ count: 7 }]);
    const result = await getLeadConversionRate();
    expect(result.rate).toBeGreaterThanOrEqual(0);
    expect(result.rate).toBeLessThanOrEqual(100);
  });
});

// ─── Won/Lost Breakdown ───────────────────────────────────────────────────────
//
// Call sequence for getWonLostBreakdown():
//   [0] db.select status,count,totalValue from opps GROUP BY status
//       → [{ status: "won", count: X, totalValue: Y }, { status: "lost", ... }]

describe("getWonLostBreakdown — JS computation", () => {
  it("correctly computes winRate as round(won/(won+lost) × 100)", async () => {
    setupDbResponses([
      { status: "won", count: 3, totalValue: 9000 },
      { status: "lost", count: 1, totalValue: 3000 },
    ]);
    const result = await getWonLostBreakdown();
    expect(result.won.count).toBe(3);
    expect(result.lost.count).toBe(1);
    expect(result.winRate).toBe(75); // round(3/4 * 100)
  });

  it("winRate is 0 when no closed outcomes (no NaN, no divide-by-zero)", async () => {
    setupDbResponses([]);
    const result = await getWonLostBreakdown();
    expect(result.won.count).toBe(0);
    expect(result.lost.count).toBe(0);
    expect(result.winRate).toBe(0);
    expect(Number.isFinite(result.winRate)).toBe(true);
  });

  it("winRate is 100 when all opportunities are won", async () => {
    setupDbResponses([{ status: "won", count: 5, totalValue: 50000 }]);
    const result = await getWonLostBreakdown();
    expect(result.winRate).toBe(100);
    expect(result.lost.count).toBe(0);
  });

  it("winRate is 0 when all opportunities are lost", async () => {
    setupDbResponses([{ status: "lost", count: 4, totalValue: 0 }]);
    const result = await getWonLostBreakdown();
    expect(result.winRate).toBe(0);
    expect(result.won.count).toBe(0);
  });

  it("winRate is always in range 0–100", async () => {
    setupDbResponses([
      { status: "won", count: 7, totalValue: 70000 },
      { status: "lost", count: 3, totalValue: 10000 },
    ]);
    const result = await getWonLostBreakdown();
    expect(result.winRate).toBeGreaterThanOrEqual(0);
    expect(result.winRate).toBeLessThanOrEqual(100);
  });

  it("returns the required shape even with empty DB result", async () => {
    setupDbResponses([]);
    const result = await getWonLostBreakdown();
    expect(result).toHaveProperty("won");
    expect(result).toHaveProperty("lost");
    expect(result).toHaveProperty("winRate");
    expect(result.won).toHaveProperty("count");
    expect(result.won).toHaveProperty("value");
    expect(result.lost).toHaveProperty("count");
    expect(result.lost).toHaveProperty("value");
  });
});

// ─── Pipeline Breakdown ───────────────────────────────────────────────────────
//
// Call sequence for getPipelineBreakdown():
//   [0] LEFT JOIN query returning per-stage aggregated rows

describe("getPipelineBreakdown — JS reduce", () => {
  const stageRows = [
    { stageId: "s1", stageName: "Discovery", stageSlug: "discovery", color: "#blue",
      totalCount: 5, openCount: 3, totalValue: 15000, openValue: 9000 },
    { stageId: "s2", stageName: "Proposal", stageSlug: "proposal", color: "#green",
      totalCount: 2, openCount: 2, totalValue: 8000, openValue: 8000 },
    { stageId: "s3", stageName: "Won", stageSlug: "won", color: "#teal",
      totalCount: 4, openCount: 0, totalValue: 20000, openValue: 0 },
  ];

  it("totalOpen equals sum of byStage openCounts", async () => {
    setupDbResponses(stageRows);
    const result = await getPipelineBreakdown();
    const expected = stageRows.reduce((s, r) => s + r.openCount, 0);
    expect(result.totalOpen).toBe(expected);
    expect(result.totalOpen).toBe(5);
  });

  it("totalValue equals sum of byStage totalValues", async () => {
    setupDbResponses(stageRows);
    const result = await getPipelineBreakdown();
    const expected = stageRows.reduce((s, r) => s + r.totalValue, 0);
    expect(result.totalValue).toBeCloseTo(expected, 2);
    expect(result.totalValue).toBeCloseTo(43000, 2);
  });

  it("openCount never exceeds totalCount per stage", async () => {
    setupDbResponses(stageRows);
    const result = await getPipelineBreakdown();
    for (const stage of result.byStage) {
      expect(stage.openCount).toBeLessThanOrEqual(stage.totalCount);
    }
  });

  it("openValue never exceeds totalValue per stage", async () => {
    setupDbResponses(stageRows);
    const result = await getPipelineBreakdown();
    for (const stage of result.byStage) {
      expect(stage.openValue).toBeLessThanOrEqual(stage.totalValue + 0.001);
    }
  });

  it("all counts are non-negative", async () => {
    setupDbResponses(stageRows);
    const result = await getPipelineBreakdown();
    expect(result.totalOpen).toBeGreaterThanOrEqual(0);
    expect(result.totalValue).toBeGreaterThanOrEqual(0);
    for (const stage of result.byStage) {
      expect(stage.totalCount).toBeGreaterThanOrEqual(0);
      expect(stage.openCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns the required shape", async () => {
    setupDbResponses(stageRows);
    const result = await getPipelineBreakdown();
    expect(result).toHaveProperty("byStage");
    expect(result).toHaveProperty("totalOpen");
    expect(result).toHaveProperty("totalValue");
    expect(Array.isArray(result.byStage)).toBe(true);
  });

  it("byStage entries have all required fields", async () => {
    setupDbResponses(stageRows);
    const result = await getPipelineBreakdown();
    for (const stage of result.byStage) {
      expect(stage).toHaveProperty("stageId");
      expect(stage).toHaveProperty("stageName");
      expect(stage).toHaveProperty("stageSlug");
      expect(stage).toHaveProperty("color");
      expect(stage).toHaveProperty("totalCount");
      expect(stage).toHaveProperty("openCount");
      expect(stage).toHaveProperty("totalValue");
      expect(stage).toHaveProperty("openValue");
    }
  });

  it("totalOpen is 0 when no stages are returned", async () => {
    setupDbResponses([]);
    const result = await getPipelineBreakdown();
    expect(result.totalOpen).toBe(0);
    expect(result.totalValue).toBe(0);
    expect(result.byStage).toHaveLength(0);
  });
});

// ─── Onboarding Breakdown ─────────────────────────────────────────────────────
//
// Call sequence for getOnboardingBreakdown():
//   [0] Conditional-aggregation query → single agg row (all counts)
//   [1] Checklist query               → { total, completed }

describe("getOnboardingBreakdown — JS computation", () => {
  it("total equals sum of byStatus values", async () => {
    setupDbResponses(
      [{ total: 6, pending: 2, in_progress: 3, completed: 1, on_hold: 0, overdue: 1, avgCompletionDays: 14 }],
      [{ total: 10, completed: 7 }],
    );
    const result = await getOnboardingBreakdown();
    const summed =
      result.byStatus.pending + result.byStatus.in_progress +
      result.byStatus.completed + result.byStatus.on_hold;
    expect(result.total).toBe(summed);
    expect(result.total).toBe(6);
  });

  it("checklist rate is round(completed/total × 100)", async () => {
    setupDbResponses(
      [{ total: 4, pending: 4, in_progress: 0, completed: 0, on_hold: 0, overdue: 0, avgCompletionDays: 0 }],
      [{ total: 10, completed: 7 }],
    );
    const result = await getOnboardingBreakdown();
    expect(result.checklist.rate).toBe(70);
  });

  it("checklist rate is 0 when total checklist items is 0 (no NaN)", async () => {
    setupDbResponses(
      [{ total: 0, pending: 0, in_progress: 0, completed: 0, on_hold: 0, overdue: 0, avgCompletionDays: 0 }],
      [{ total: 0, completed: 0 }],
    );
    const result = await getOnboardingBreakdown();
    expect(result.checklist.rate).toBe(0);
    expect(Number.isFinite(result.checklist.rate)).toBe(true);
  });

  it("checklist rate is in range 0–100", async () => {
    setupDbResponses(
      [{ total: 2, pending: 1, in_progress: 1, completed: 0, on_hold: 0, overdue: 0, avgCompletionDays: 0 }],
      [{ total: 8, completed: 5 }],
    );
    const result = await getOnboardingBreakdown();
    expect(result.checklist.rate).toBeGreaterThanOrEqual(0);
    expect(result.checklist.rate).toBeLessThanOrEqual(100);
  });

  it("overdue does not exceed total", async () => {
    setupDbResponses(
      [{ total: 5, pending: 3, in_progress: 2, completed: 0, on_hold: 0, overdue: 2, avgCompletionDays: 0 }],
      [{ total: 6, completed: 1 }],
    );
    const result = await getOnboardingBreakdown();
    expect(result.overdue).toBeLessThanOrEqual(result.total);
  });

  it("overdue is non-negative", async () => {
    setupDbResponses(
      [{ total: 3, pending: 3, in_progress: 0, completed: 0, on_hold: 0, overdue: 0, avgCompletionDays: 0 }],
      [{ total: 3, completed: 0 }],
    );
    const result = await getOnboardingBreakdown();
    expect(result.overdue).toBeGreaterThanOrEqual(0);
  });

  it("avgCompletionDays is non-negative", async () => {
    setupDbResponses(
      [{ total: 1, pending: 0, in_progress: 0, completed: 1, on_hold: 0, overdue: 0, avgCompletionDays: 21 }],
      [{ total: 4, completed: 4 }],
    );
    const result = await getOnboardingBreakdown();
    expect(result.avgCompletionDays).toBeGreaterThanOrEqual(0);
  });

  it("falls back to zero agg row when DB returns empty", async () => {
    setupDbResponses([], [{ total: 0, completed: 0 }]);
    const result = await getOnboardingBreakdown();
    expect(result.total).toBe(0);
    expect(result.byStatus.pending).toBe(0);
    expect(result.checklist.rate).toBe(0);
  });

  it("returns the required shape", async () => {
    setupDbResponses(
      [{ total: 0, pending: 0, in_progress: 0, completed: 0, on_hold: 0, overdue: 0, avgCompletionDays: 0 }],
      [{ total: 0, completed: 0 }],
    );
    const result = await getOnboardingBreakdown();
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("byStatus");
    expect(result).toHaveProperty("overdue");
    expect(result).toHaveProperty("avgCompletionDays");
    expect(result).toHaveProperty("checklist");
    expect(result.byStatus).toHaveProperty("pending");
    expect(result.byStatus).toHaveProperty("in_progress");
    expect(result.byStatus).toHaveProperty("completed");
    expect(result.byStatus).toHaveProperty("on_hold");
    expect(result.checklist).toHaveProperty("total");
    expect(result.checklist).toHaveProperty("completed");
    expect(result.checklist).toHaveProperty("rate");
  });
});

// ─── Notification Summary ─────────────────────────────────────────────────────
//
// Call sequence for getNotificationSummary():
//   [0] byType GROUP BY query → array of { type, count, unread }
//   [1] totals query          → [{ total, unread }]

describe("getNotificationSummary — shape and boundary", () => {
  it("unread never exceeds total", async () => {
    setupDbResponses(
      [
        { type: "mention", count: 5, unread: 3 },
        { type: "task", count: 8, unread: 2 },
      ],
      [{ total: 13, unread: 5 }],
    );
    const result = await getNotificationSummary();
    expect(result.unread).toBeLessThanOrEqual(result.total);
  });

  it("returns the required shape", async () => {
    setupDbResponses([], [{ total: 0, unread: 0 }]);
    const result = await getNotificationSummary();
    expect(result).toHaveProperty("byType");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("unread");
    expect(Array.isArray(result.byType)).toBe(true);
  });

  it("total defaults to 0 when totals row is absent", async () => {
    setupDbResponses([], []);
    const result = await getNotificationSummary();
    expect(result.total).toBe(0);
    expect(result.unread).toBe(0);
  });
});

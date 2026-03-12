/**
 * Report Aggregation Regression Tests
 *
 * These tests validate:
 * 1. Response shape: all required fields are present
 * 2. Internal math consistency: totals match sum of sub-totals
 * 3. Boundary invariants: rates are 0–100, counts are non-negative
 *
 * Tests run against the live (seeded) dev database so they catch real
 * SQL query correctness, not just JS logic.
 */

import { describe, it, expect } from "vitest";
import {
  getPipelineBreakdown,
  getOnboardingBreakdown,
  getLeadConversionRate,
  getWonLostBreakdown,
  getLeadsBySource,
  getLeadsByStatus,
  getNotificationSummary,
  getOverview,
} from "../../server/features/reports/service";

// ─── Pipeline Breakdown ──────────────────────────────────────────────────────

describe("getPipelineBreakdown", () => {
  it("returns the required shape", async () => {
    const result = await getPipelineBreakdown();
    expect(result).toHaveProperty("byStage");
    expect(result).toHaveProperty("totalOpen");
    expect(result).toHaveProperty("totalValue");
    expect(Array.isArray(result.byStage)).toBe(true);
  });

  it("byStage entries have all required fields", async () => {
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

  it("totalOpen equals sum of byStage openCounts", async () => {
    const result = await getPipelineBreakdown();
    const summedOpen = result.byStage.reduce((s, r) => s + r.openCount, 0);
    expect(result.totalOpen).toBe(summedOpen);
  });

  it("totalValue equals sum of byStage totalValues", async () => {
    const result = await getPipelineBreakdown();
    const summedValue = result.byStage.reduce((s, r) => s + r.totalValue, 0);
    expect(result.totalValue).toBeCloseTo(summedValue, 2);
  });

  it("openCount never exceeds totalCount per stage", async () => {
    const result = await getPipelineBreakdown();
    for (const stage of result.byStage) {
      expect(stage.openCount).toBeLessThanOrEqual(stage.totalCount);
    }
  });

  it("openValue never exceeds totalValue per stage", async () => {
    const result = await getPipelineBreakdown();
    for (const stage of result.byStage) {
      expect(stage.openValue).toBeLessThanOrEqual(stage.totalValue + 0.001);
    }
  });

  it("all counts are non-negative", async () => {
    const result = await getPipelineBreakdown();
    expect(result.totalOpen).toBeGreaterThanOrEqual(0);
    expect(result.totalValue).toBeGreaterThanOrEqual(0);
    for (const stage of result.byStage) {
      expect(stage.totalCount).toBeGreaterThanOrEqual(0);
      expect(stage.openCount).toBeGreaterThanOrEqual(0);
      expect(stage.totalValue).toBeGreaterThanOrEqual(0);
      expect(stage.openValue).toBeGreaterThanOrEqual(0);
    }
  });

  it("accepts a date range filter without error", async () => {
    const from = new Date();
    from.setFullYear(from.getFullYear() - 1);
    const result = await getPipelineBreakdown({ from });
    expect(result).toHaveProperty("byStage");
    expect(result).toHaveProperty("totalOpen");
    expect(result).toHaveProperty("totalValue");
  });

  it("date-filtered totalOpen still equals sum of byStage openCounts", async () => {
    const from = new Date();
    from.setFullYear(from.getFullYear() - 1);
    const result = await getPipelineBreakdown({ from });
    const summedOpen = result.byStage.reduce((s, r) => s + r.openCount, 0);
    expect(result.totalOpen).toBe(summedOpen);
  });
});

// ─── Onboarding Breakdown ────────────────────────────────────────────────────

describe("getOnboardingBreakdown", () => {
  it("returns the required shape", async () => {
    const result = await getOnboardingBreakdown();
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("byStatus");
    expect(result).toHaveProperty("overdue");
    expect(result).toHaveProperty("avgCompletionDays");
    expect(result).toHaveProperty("checklist");
  });

  it("byStatus has all four status keys", async () => {
    const result = await getOnboardingBreakdown();
    expect(result.byStatus).toHaveProperty("pending");
    expect(result.byStatus).toHaveProperty("in_progress");
    expect(result.byStatus).toHaveProperty("completed");
    expect(result.byStatus).toHaveProperty("on_hold");
  });

  it("checklist has total, completed, and rate", async () => {
    const result = await getOnboardingBreakdown();
    expect(result.checklist).toHaveProperty("total");
    expect(result.checklist).toHaveProperty("completed");
    expect(result.checklist).toHaveProperty("rate");
  });

  it("total equals sum of byStatus values", async () => {
    const result = await getOnboardingBreakdown();
    const summedStatuses =
      result.byStatus.pending +
      result.byStatus.in_progress +
      result.byStatus.completed +
      result.byStatus.on_hold;
    expect(result.total).toBe(summedStatuses);
  });

  it("overdue does not exceed total", async () => {
    const result = await getOnboardingBreakdown();
    expect(result.overdue).toBeLessThanOrEqual(result.total);
  });

  it("overdue is non-negative", async () => {
    const result = await getOnboardingBreakdown();
    expect(result.overdue).toBeGreaterThanOrEqual(0);
  });

  it("avgCompletionDays is non-negative integer", async () => {
    const result = await getOnboardingBreakdown();
    expect(result.avgCompletionDays).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(result.avgCompletionDays)).toBe(true);
  });

  it("checklist rate is in range 0–100", async () => {
    const result = await getOnboardingBreakdown();
    expect(result.checklist.rate).toBeGreaterThanOrEqual(0);
    expect(result.checklist.rate).toBeLessThanOrEqual(100);
  });

  it("checklist completed never exceeds total", async () => {
    const result = await getOnboardingBreakdown();
    expect(result.checklist.completed).toBeLessThanOrEqual(result.checklist.total);
  });

  it("accepts a date range filter without error", async () => {
    const from = new Date();
    from.setFullYear(from.getFullYear() - 1);
    const result = await getOnboardingBreakdown({ from });
    expect(result).toHaveProperty("total");
    const summed =
      result.byStatus.pending +
      result.byStatus.in_progress +
      result.byStatus.completed +
      result.byStatus.on_hold;
    expect(result.total).toBe(summed);
  });
});

// ─── Lead Conversion Rate ────────────────────────────────────────────────────

describe("getLeadConversionRate", () => {
  it("returns total, converted, and rate", async () => {
    const result = await getLeadConversionRate();
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("converted");
    expect(result).toHaveProperty("rate");
  });

  it("rate is 0 when total is 0", async () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 100);
    const result = await getLeadConversionRate({ from: future });
    expect(result.total).toBe(0);
    expect(result.rate).toBe(0);
  });

  it("rate is in range 0–100", async () => {
    const result = await getLeadConversionRate();
    expect(result.rate).toBeGreaterThanOrEqual(0);
    expect(result.rate).toBeLessThanOrEqual(100);
  });

  it("converted never exceeds total", async () => {
    const result = await getLeadConversionRate();
    expect(result.converted).toBeLessThanOrEqual(result.total);
  });
});

// ─── Won/Lost Breakdown ──────────────────────────────────────────────────────

describe("getWonLostBreakdown", () => {
  it("returns won, lost, and winRate", async () => {
    const result = await getWonLostBreakdown();
    expect(result).toHaveProperty("won");
    expect(result).toHaveProperty("lost");
    expect(result).toHaveProperty("winRate");
    expect(result.won).toHaveProperty("count");
    expect(result.won).toHaveProperty("value");
    expect(result.lost).toHaveProperty("count");
    expect(result.lost).toHaveProperty("value");
  });

  it("winRate is in range 0–100", async () => {
    const result = await getWonLostBreakdown();
    expect(result.winRate).toBeGreaterThanOrEqual(0);
    expect(result.winRate).toBeLessThanOrEqual(100);
  });

  it("winRate is 0 when no closed outcomes", async () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 100);
    const result = await getWonLostBreakdown({ from: future });
    expect(result.winRate).toBe(0);
    expect(result.won.count).toBe(0);
    expect(result.lost.count).toBe(0);
  });
});

// ─── Leads By Source ─────────────────────────────────────────────────────────

describe("getLeadsBySource", () => {
  it("returns an array of source rows", async () => {
    const result = await getLeadsBySource();
    expect(Array.isArray(result)).toBe(true);
  });

  it("each row has source, count, and totalValue", async () => {
    const result = await getLeadsBySource();
    for (const row of result) {
      expect(row).toHaveProperty("source");
      expect(row).toHaveProperty("count");
      expect(row).toHaveProperty("totalValue");
    }
  });

  it("all counts are positive integers", async () => {
    const result = await getLeadsBySource();
    for (const row of result) {
      expect(row.count).toBeGreaterThan(0);
      expect(Number.isInteger(row.count)).toBe(true);
    }
  });
});

// ─── Notification Summary ────────────────────────────────────────────────────

describe("getNotificationSummary", () => {
  it("returns byType, total, and unread", async () => {
    const result = await getNotificationSummary();
    expect(result).toHaveProperty("byType");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("unread");
    expect(Array.isArray(result.byType)).toBe(true);
  });

  it("unread never exceeds total", async () => {
    const result = await getNotificationSummary();
    expect(result.unread).toBeLessThanOrEqual(result.total);
  });
});

// ─── Overview consistency check ──────────────────────────────────────────────

describe("getOverview", () => {
  it("returns all section keys", async () => {
    const result = await getOverview();
    expect(result).toHaveProperty("leadsBySource");
    expect(result).toHaveProperty("leadsByStatus");
    expect(result).toHaveProperty("conversion");
    expect(result).toHaveProperty("pipeline");
    expect(result).toHaveProperty("wonLost");
    expect(result).toHaveProperty("onboarding");
    expect(result).toHaveProperty("notifications");
    expect(result).toHaveProperty("overdueLeads");
  });

  it("pipeline totalOpen in overview equals sum of byStage openCounts", async () => {
    const result = await getOverview();
    const summedOpen = result.pipeline.byStage.reduce((s: number, r: any) => s + r.openCount, 0);
    expect(result.pipeline.totalOpen).toBe(summedOpen);
  });

  it("onboarding total in overview equals sum of byStatus values", async () => {
    const result = await getOverview();
    const summed =
      result.onboarding.byStatus.pending +
      result.onboarding.byStatus.in_progress +
      result.onboarding.byStatus.completed +
      result.onboarding.byStatus.on_hold;
    expect(result.onboarding.total).toBe(summed);
  });
});

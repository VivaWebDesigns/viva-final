import { describe, expect, it, vi } from "vitest";

vi.mock("../../server/db", () => ({ db: { transaction: vi.fn() } }));

import { planEmailFirstAction } from "../../server/features/tasks/backfill";
import type { ReportOutreachState } from "../../server/features/crm/reportOutreach";

function state(overrides: Partial<ReportOutreachState> = {}): ReportOutreachState {
  return {
    reportEmailCount: 0,
    lastReportEmailedAt: null,
    reportOutreachDisposition: null,
    reportViewCount: 0,
    reportCtaClickCount: 0,
    reportLastEngagedAt: null,
    reportNextTaskDueAt: null,
    reportOutreachSegment: "not_started",
    reportNeedsAttention: false,
    ...overrides,
  };
}

describe("email-first outreach reconciliation plan", () => {
  it("converts untouched New Lead call tasks into the initial report email task", () => {
    expect(planEmailFirstAction(state())).toEqual({ kind: "convert_initial" });
  });

  it("schedules email two seven business days after the first send", () => {
    const action = planEmailFirstAction(state({
      reportEmailCount: 1,
      lastReportEmailedAt: new Date("2026-08-28T20:15:00Z"),
      reportOutreachDisposition: "active",
    }));
    expect(action).toMatchObject({
      kind: "move_and_schedule",
      taskType: "report_email_followup",
      dueDate: new Date("2026-09-08T00:00:00Z"),
    });
  });

  it("schedules a final review five business days after two sends", () => {
    const action = planEmailFirstAction(state({
      reportEmailCount: 2,
      lastReportEmailedAt: new Date("2026-08-28T20:15:00Z"),
      reportOutreachDisposition: "active",
    }));
    expect(action).toMatchObject({
      kind: "move_and_schedule",
      taskType: "report_email_review",
      dueDate: new Date("2026-09-04T00:00:00Z"),
    });
  });

  it("prioritizes an immediate personal touch for an engaged historical lead", () => {
    const action = planEmailFirstAction(state({
      reportEmailCount: 3,
      lastReportEmailedAt: new Date("2026-08-28T20:15:00Z"),
      reportOutreachDisposition: "active",
      reportViewCount: 3,
    }), new Date("2026-08-31T15:00:00Z"));
    expect(action).toMatchObject({
      kind: "move_and_schedule",
      taskType: "report_personal_followup",
      dueDate: new Date("2026-08-31T00:00:00Z"),
    });
  });

  it.each(["replied", "opted_out", "bounced", "not_interested", "no_response"])(
    "leaves %s outreach untouched",
    (disposition) => {
      expect(planEmailFirstAction(state({
        reportEmailCount: 1,
        reportOutreachDisposition: disposition,
      }))).toEqual({ kind: "skip" });
    },
  );
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { classifyReportOutreach, reportBusinessDate, reportSendBlockedReason, isReportOutreachTask } from "@shared/reportOutreach";

const mockDb = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("../../server/db", () => ({ db: mockDb }));
import { recordReportEmailSent, completeReportOutreachTask, ensureReportEmailedStage, getReportOutreachStates } from "../../server/features/crm/reportOutreach";
import type { FollowupTask } from "@shared/schema";

function database(rows: unknown[][]) {
  const writes: { table: string; operation: string; values: any }[] = [];
  const chain = (result: unknown[]) => {
    const q: any = { then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject) };
    for (const name of ["from", "where", "for", "limit", "returning", "groupBy", "orderBy"]) q[name] = () => q;
    return q;
  };
  const tx = {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(() => {
      if (!rows.length) throw new Error("Unexpected select");
      return chain(rows.shift()!);
    }),
    insert: (table: any) => ({ values: (values: any) => {
      writes.push({ table: getTableName(table), operation: "insert", values });
      return chain([{ id: "created-id", ...values }]);
    } }),
    update: (table: any) => ({ set: (values: any) => {
      writes.push({ table: getTableName(table), operation: "update", values });
      return chain([{ id: "task-1", ...values }]);
    } }),
  };
  mockDb.transaction.mockImplementation(async fn => fn(tx));
  return { tx, writes };
}

const delivery = { id: "delivery-1", leadId: "lead-1", sentAt: null, outreachProcessedAt: null };
const lead = { id: "lead-1", title: "Acme", reportEmailCount: 0, reportOutreachDisposition: null, companyId: "company-1", assignedTo: "rep-1" };
const stages = [{ id: "new", slug: "new-lead", sortOrder: 0 }, { id: "emailed", slug: "report-emailed", sortOrder: 1 },
  { id: "contacted", slug: "contacted", name: "Contacted", sortOrder: 2 },
  { id: "demo", slug: "demo-scheduled", name: "Demo Scheduled" }, { id: "lost", slug: "closed-lost", name: "Closed Lost" }];
const opp = { id: "opp-1", stageId: "new", status: "open", assignedTo: "rep-1" };
const task = { id: "task-1", leadId: "lead-1", opportunityId: "opp-1", taskType: "report_email_review", completed: false } as FollowupTask;
const history = (count = 1, disposition = "active", lastSentAt = "2020-01-01") => [
  [{ leadId: "lead-1", count, lastSentAt }],
  [{ leadId: "lead-1", metadata: { reportOutreachDisposition: disposition } }],
];
beforeEach(() => vi.clearAllMocks());

describe("report outreach dates and safeguards", () => {
  it("calculates business-day deadlines, skipping weekends", () => {
    expect(reportBusinessDate(new Date("2026-08-28T15:00:00Z"), 3).toISOString()).toBe("2026-09-02T00:00:00.000Z");
  });
  it("uses the Eastern business date, including across DST", () => {
    expect(reportBusinessDate(new Date("2026-03-07T02:00:00Z"), 3).toISOString()).toBe("2026-03-11T00:00:00.000Z");
    expect(reportBusinessDate(new Date("2026-08-31T02:00:00Z"), 0).toISOString()).toBe("2026-08-30T00:00:00.000Z");
  });
  it("allows only two sends and stops for every terminal disposition", () => {
    expect(reportSendBlockedReason(0, null)).toBeNull();
    expect(reportSendBlockedReason(1, "active")).toBeNull();
    expect(reportSendBlockedReason(2, "active")).toContain("Both");
    for (const state of ["replied", "opted_out", "bounced", "not_interested", "no_response"]) {
      expect(reportSendBlockedReason(1, state)).toContain("stopped");
    }
    expect(isReportOutreachTask("call")).toBe(false);
    expect(isReportOutreachTask("report_email_followup")).toBe(true);
    expect(isReportOutreachTask("report_personal_followup")).toBe(true);
  });
  const summary = (overrides: Record<string, unknown> = {}) => ({
    reportEmailCount: 1, lastReportEmailedAt: "2026-08-20T12:00:00Z", reportOutreachDisposition: "active",
    reportViewCount: 0, reportCtaClickCount: 0, reportLastEngagedAt: null, reportNextTaskDueAt: "2026-09-01T00:00:00Z",
    ...overrides,
  });
  it("prioritizes real report engagement over ordinary send count", () => {
    expect(classifyReportOutreach(summary({ reportViewCount: 1 }), new Date("2026-08-25")))
      .toEqual({ segment: "engaged", needsAttention: true });
    expect(classifyReportOutreach(summary({ reportCtaClickCount: 1 }), new Date("2026-08-25")))
      .toEqual({ segment: "engaged", needsAttention: true });
  });
  it("marks an overdue second email as needing attention", () => {
    expect(classifyReportOutreach(summary(), new Date("2026-09-01T12:00:00Z")))
      .toEqual({ segment: "send_email_two", needsAttention: true });
    expect(classifyReportOutreach(summary(), new Date("2026-08-31T12:00:00Z")))
      .toEqual({ segment: "send_email_two", needsAttention: false });
  });
  it("separates the final waiting window from no engagement", () => {
    expect(classifyReportOutreach(summary({ reportEmailCount: 2, reportNextTaskDueAt: "2026-09-05" }), new Date("2026-09-01")))
      .toEqual({ segment: "awaiting_response", needsAttention: false });
    expect(classifyReportOutreach(summary({ reportEmailCount: 2, reportNextTaskDueAt: "2026-09-01" }), new Date("2026-09-01T12:00:00Z")))
      .toEqual({ segment: "no_engagement", needsAttention: false });
  });
  it("keeps responded and stopped outreach out of attention queues", () => {
    expect(classifyReportOutreach(summary({ reportOutreachDisposition: "replied", reportViewCount: 2 })).segment).toBe("responded");
    expect(classifyReportOutreach(summary({ reportOutreachDisposition: "opted_out", reportViewCount: 2 })).segment).toBe("stopped");
    expect(classifyReportOutreach(summary({ reportOutreachDisposition: "no_response" })).segment).toBe("no_engagement");
  });
});

describe("successful report delivery workflow", () => {
  it("moves New Lead to Report Emailed and schedules email two", async () => {
    const { writes } = database([[delivery], [lead], [delivery], [], ...history(), [opp], stages, [stages[1]], [{ id: "old", title: "Contact lead" }, { id: "custom", title: "Custom work" }]]);
    await recordReportEmailSent(delivery.id, new Date("2026-08-31T15:00:00Z"));
    expect(writes.find(w => w.table === "crm_lead_notes")?.values.metadata).toMatchObject({ event: "report_email_counted", reportOutreachDisposition: "active" });
    expect(writes.find(w => w.table === "pipeline_opportunities")?.values.stageId).toBe("emailed");
    expect(writes.filter(w => w.table === "followup_tasks" && w.operation === "update")).toHaveLength(1);
    expect(writes.find(w => w.table === "followup_tasks" && w.operation === "insert")?.values).toMatchObject({
      taskType: "report_email_followup", dueDate: new Date("2026-09-09T00:00:00Z"), assignedTo: "rep-1",
    });
  });
  it("keeps the stage after email two and schedules the five-business-day review", async () => {
    const { writes } = database([[delivery], [lead], [delivery], [], ...history(2), [{ ...opp, stageId: "emailed" }], stages, [stages[1]], []]);
    await recordReportEmailSent(delivery.id, new Date("2026-09-03T15:00:00Z"));
    expect(writes.filter(w => w.table === "pipeline_opportunities")).toHaveLength(0);
    expect(writes.find(w => w.table === "followup_tasks" && w.operation === "insert")?.values).toMatchObject({
      taskType: "report_email_review", dueDate: new Date("2026-09-10T00:00:00Z"),
    });
  });
  it("does not count a retried accepted delivery twice", async () => {
    const { writes } = database([[delivery], [lead], [delivery], [{ id: "processed-note" }]]);
    await recordReportEmailSent(delivery.id);
    expect(writes).toEqual([]);
  });
  it("does not regress advanced deals or create outreach tasks for them", async () => {
    const { writes } = database([[delivery], [lead], [delivery], [], ...history(), [{ ...opp, stageId: "demo" }], stages]);
    await recordReportEmailSent(delivery.id);
    expect(writes.some(w => ["pipeline_opportunities", "followup_tasks"].includes(w.table))).toBe(false);
  });
  it("does not restart outreach when an opt-out arrives during sending", async () => {
    const { writes } = database([[delivery], [lead], [delivery], [], ...history(1, "opted_out")]);
    await recordReportEmailSent(delivery.id);
    expect(writes.find(w => w.table === "crm_lead_notes")?.values.metadata.reportOutreachDisposition).toBe("opted_out");
    expect(writes.some(w => w.table === "followup_tasks")).toBe(false);
  });
  it("creates the pipeline opportunity if the lead did not have one", async () => {
    const { writes } = database([[delivery], [lead], [delivery], [], ...history(), [], stages, [stages[1]], []]);
    await recordReportEmailSent(delivery.id);
    expect(writes.find(w => w.table === "pipeline_opportunities")?.values).toMatchObject({ leadId: "lead-1", stageId: "emailed" });
  });
});

describe("outreach outcomes", () => {
  it("rejects premature no-response without changing anything", async () => {
    const { writes } = database([[lead], [task], ...history(2, "active", new Date().toISOString())]);
    await expect(completeReportOutreachTask(task, { outcome: "No response" }, "rep-1")).rejects.toThrow("five business days");
    expect(writes).toEqual([]);
  });
  it("pauses unanswered outreach without treating it as Closed Lost", async () => {
    const { writes } = database([[lead], [task], ...history(2)]);
    await completeReportOutreachTask(task, { outcome: "No response" }, "rep-1");
    expect(writes.find(w => w.table === "crm_lead_notes")?.values.metadata.reportOutreachDisposition).toBe("no_response");
    expect(writes.some(w => w.table === "pipeline_opportunities")).toBe(false);
  });
  it.each(["Interested", "Uncertain"])("moves a %s reply to Contacted and creates a demo follow-up", async outcome => {
    const { writes } = database([[lead], [task], ...history(), [{ ...opp, stageId: "emailed" }], stages]);
    await completeReportOutreachTask(task, { outcome }, "rep-1");
    expect(writes.find(w => w.table === "pipeline_opportunities")?.values.stageId).toBe("contacted");
    expect(writes.find(w => w.table === "followup_tasks" && w.operation === "insert")?.values.title).toBe("Schedule demo");
  });
  it("allows direct demo booking", async () => {
    const { writes } = database([[lead], [task], ...history(), [{ ...opp, stageId: "emailed" }], stages]);
    await completeReportOutreachTask(task, { outcome: "Appointment set", demoDate: "2026-09-10" }, "rep-1");
    expect(writes.find(w => w.table === "pipeline_opportunities")?.values.stageId).toBe("demo");
    expect(writes.find(w => w.table === "followup_tasks" && w.operation === "insert")?.values.taskType).toBe("demo_outcome");
  });
  it.each(["Opted out", "Email bounced"])("stops for %s without a follow-up", async outcome => {
    const { writes } = database([[lead], [task], ...history()]);
    await completeReportOutreachTask(task, { outcome }, "rep-1");
    expect(writes.some(w => w.table === "followup_tasks" && w.operation === "insert")).toBe(false);
  });
  it("keeps stage creation idempotent", async () => {
    const { tx, writes } = database([[stages[1]]]);
    await ensureReportEmailedStage(tx as any);
    expect(writes).toEqual([]);
  });
  it("inserts the new stage immediately before Contacted", async () => {
    const { tx, writes } = database([[], [{ id: "contacted", slug: "contacted", sortOrder: 1 }]]);
    await ensureReportEmailedStage(tx as any);
    expect(writes.find(w => w.table === "pipeline_stages" && w.operation === "insert")?.values)
      .toMatchObject({ name: "Report Emailed", slug: "report-emailed", sortOrder: 1 });
    expect(writes.filter(w => w.table === "pipeline_stages" && w.operation === "update")).toHaveLength(1);
  });
  it("can record a late reply after No Response", async () => {
    const { writes } = database([[lead], [{ ...task, completed: true }], ...history(2, "no_response"), [{ ...opp, stageId: "emailed" }], stages]);
    await completeReportOutreachTask(task, { outcome: "Interested" }, "rep-1");
    expect(writes.find(w => w.table === "pipeline_opportunities")?.values.stageId).toBe("contacted");
  });
  it("uses Closed Lost only for an explicit Not interested outcome", async () => {
    const { writes } = database([[lead], [task], ...history(), [{ ...opp, stageId: "emailed" }], stages]);
    await completeReportOutreachTask(task, { outcome: "Not interested" }, "rep-1");
    expect(writes.find(w => w.table === "pipeline_opportunities")?.values).toMatchObject({ stageId: "lost", status: "lost" });
    expect(writes.some(w => w.table === "followup_tasks" && w.operation === "insert")).toBe(false);
  });
  it("derives historical send counts and keeps the latest recorded disposition", async () => {
    const { tx } = database([[{ leadId: "lead-1", count: 2, lastSentAt: "2026-08-31" }], [
      { leadId: "lead-1", metadata: { reportOutreachDisposition: "no_response" } },
      { leadId: "lead-1", metadata: { reportOutreachDisposition: "active" } },
    ]]);
    const result = await getReportOutreachStates(["lead-1", "unsent"], tx as any);
    expect(result.get("lead-1")).toMatchObject({ reportEmailCount: 2, reportOutreachDisposition: "no_response" });
    expect(result.get("unsent")?.reportEmailCount).toBe(0);
  });
});

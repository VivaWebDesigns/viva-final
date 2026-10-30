import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import http from "node:http";
import { CALL_PIPELINE_STAGES } from "@shared/callPipeline";

const {
  mockGetSession, mockGetTaskById, mockCompleteTask, mockCreateTask, mockGetActiveTaskForContext,
  mockMoveOpportunity, mockSyncOpenTaskOwnership, mockBulkAssignOpportunities, mockDbInsert, db, dbState,
} = vi.hoisted(() => {
  const dbState = { stageSlug: "new-lead", unansweredCallStreak: 0 };
  const tables: Record<string, unknown> = {};
  const rowsFor = (table: unknown) => {
    if (table === tables.pipelineOpportunities) return [{ id: "opp-1", stageId: `stage-${dbState.stageSlug}`, leadId: "lead-1" }];
    if (table === tables.user) return [{ id: "admin-1" }];
    if (table === tables.crmLeads) return [{
      title: "Test Landscaping", assignedTo: "richard", companyId: "co-1",
      unansweredCallStreak: dbState.unansweredCallStreak, recycleCount: 0, hungUpCount: 0,
    }];
    return [];
  };
  // A chainable stand-in for drizzle: every builder call returns the chain, and awaiting it yields rows for the table.
  const chain = (rows: () => unknown[]) => {
    let table: unknown;
    const c: Record<string, unknown> = {};
    for (const m of ["from", "where", "limit", "orderBy", "set", "values", "returning", "leftJoin", "innerJoin"]) {
      c[m] = (arg: unknown) => { if (m === "from") table = arg; return c; };
    }
    c.then = (resolve: (v: unknown) => unknown) => resolve(table ? rowsFor(table) : rows());
    return c;
  };
  const mockDbInsert = vi.fn(() => chain(() => []));
  return {
    mockGetSession: vi.fn(),
    mockGetTaskById: vi.fn(),
    mockCompleteTask: vi.fn(),
    mockCreateTask: vi.fn(),
    mockGetActiveTaskForContext: vi.fn(),
    mockMoveOpportunity: vi.fn(),
    mockSyncOpenTaskOwnership: vi.fn(),
    mockBulkAssignOpportunities: vi.fn(),
    mockDbInsert,
    dbState,
    db: {
      tables,
      select: vi.fn(() => chain(() => [])),
      update: vi.fn(() => chain(() => [])),
      insert: mockDbInsert,
      delete: vi.fn(() => chain(() => [])),
    },
  };
});

vi.mock("../../server/features/auth/auth", () => ({ auth: { api: { getSession: mockGetSession } } }));
vi.mock("better-auth/node", () => ({ fromNodeHeaders: (h: unknown) => h }));
vi.mock("../../server/features/tasks/storage", () => ({
  getTaskById: mockGetTaskById,
  completeTask: mockCompleteTask,
  createTask: mockCreateTask,
  getActiveTaskForContext: mockGetActiveTaskForContext,
  syncOpenTaskOwnershipForLeadIds: mockSyncOpenTaskOwnership,
}));
vi.mock("../../server/features/crm/storage", () => ({ addLeadNote: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../server/features/pipeline/storage", () => ({
  addActivity: vi.fn().mockResolvedValue(undefined),
  bulkAssignOpportunitiesByLeadIds: mockBulkAssignOpportunities,
  getStages: vi.fn(async () => CALL_PIPELINE_STAGES.map((s) => ({ ...s, id: `stage-${s.slug}` }))),
  moveOpportunity: mockMoveOpportunity,
}));
vi.mock("../../server/features/audit/service", () => ({ logAudit: vi.fn() }));
vi.mock("../../server/db", () => ({ db }));

import { crmLeads, pipelineOpportunities, user } from "@shared/schema";
import taskRoutes from "../../server/features/tasks/routes";

Object.assign(db.tables, { crmLeads, pipelineOpportunities, user });

const CALL_TASK = {
  id: "task-1", title: "Call lead", taskType: "call", completed: false, assignedTo: "richard",
  leadId: "lead-1", opportunityId: "opp-1", contactId: null, companyId: "co-1",
};
const APPOINTMENT = { demoDate: "2026-11-03", demoTime: "14:00", demoTimezone: "America/New_York" };
const CALL_BACK = { callBackDate: "2026-11-02", callBackTime: "10:30", callBackTimezone: "America/New_York" };
const TEXTED = { completionNote: "Texted the scan." };

function completeCall(body: Record<string, unknown>): Promise<{ status: number; body: { message?: string } }> {
  const app = express();
  app.use(express.json());
  app.use("/tasks", taskRoutes);
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      const payload = JSON.stringify(body);
      const req = http.request({
        hostname: "127.0.0.1", port, path: "/tasks/task-1/complete", method: "PUT",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
      }, (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => {
          server.close();
          resolve({ status: res.statusCode ?? 0, body: data ? JSON.parse(data) : {} });
        });
      });
      req.on("error", reject);
      req.end(payload);
    });
  });
}

const createdTasks = () => mockCreateTask.mock.calls.map(([task]) => task);

describe("Appointment Setter call outcomes (as Richard)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbState.stageSlug = "new-lead";
    dbState.unansweredCallStreak = 0;
    mockGetSession.mockResolvedValue({ session: {}, user: { id: "richard", role: "sales_rep", name: "Richard", email: "richard@test.com" } });
    mockGetTaskById.mockResolvedValue(CALL_TASK);
    mockCompleteTask.mockImplementation(async (_id: string, extras: object) => ({ ...CALL_TASK, ...extras, completed: true }));
    mockCreateTask.mockImplementation(async (task: object) => ({ id: "task-new", ...task }));
    mockGetActiveTaskForContext.mockResolvedValue(null);
    mockMoveOpportunity.mockResolvedValue(undefined);
    mockSyncOpenTaskOwnership.mockResolvedValue(0);
    mockBulkAssignOpportunities.mockResolvedValue(undefined);
  });

  // The 9 click paths in the call dialog; the SMS step only adds the "Texted the scan." note.
  const paths = [
    { path: "No answer → Left voicemail",             body: { outcome: "Left voicemail" },                   stage: "attempted",      next: "Call lead" },
    { path: "No answer → No voicemail",               body: { outcome: "No answer" },                        stage: "attempted",      next: "Call lead" },
    { path: "Answered → Interested",                  body: { outcome: "Appointment set", ...APPOINTMENT },  stage: "demo-scheduled", next: "Discovery call" },
    { path: "Answered → Call back",                   body: { outcome: "Call back", ...CALL_BACK },          stage: "contacted",      next: "Call back" },
    { path: "Answered → Not interested",              body: { outcome: "Not interested" },                   stage: "closed-lost",    next: null },
    { path: "Answered → Sent SMS → Interested",       body: { outcome: "Appointment set", ...APPOINTMENT, ...TEXTED }, stage: "demo-scheduled", next: "Discovery call" },
    { path: "Answered → Sent SMS → Call back",        body: { outcome: "Call back", ...CALL_BACK, ...TEXTED },         stage: "contacted",      next: "Call back" },
    { path: "Answered → Sent SMS → Not interested",   body: { outcome: "Not interested", ...TEXTED },                  stage: "closed-lost",    next: null },
    { path: "Wrong number",                           body: { outcome: "Wrong number" },                     stage: "closed-lost",    next: null },
  ];

  it.each(paths)("$path moves the lead to $stage", async ({ body, stage, next }) => {
    const res = await completeCall(body);

    expect(res.status).toBe(200);
    expect(mockMoveOpportunity).toHaveBeenCalledWith("opp-1", `stage-${stage}`, "richard");
    expect(createdTasks().map((t) => t.title)).toEqual(next ? [next] : []);
    if ("completionNote" in body) {
      expect(mockCompleteTask).toHaveBeenCalledWith("task-1", expect.objectContaining({ completionNote: "Texted the scan." }));
    }
  });

  it("schedules the next call for Richard tomorrow after no answer", async () => {
    await completeCall({ outcome: "No answer" });
    const [task] = createdTasks();
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    expect(task).toMatchObject({ taskType: "call", assignedTo: "richard" });
    expect(task.dueDate.toISOString().slice(0, 10)).toBe(tomorrow.toISOString().slice(0, 10));
  });

  it("gives the discovery call to the admin at the booked date and time", async () => {
    await completeCall({ outcome: "Appointment set", ...APPOINTMENT });
    expect(createdTasks()[0]).toMatchObject({
      taskType: "demo_outcome", assignedTo: "admin-1", followUpTime: "14:00", dueDate: new Date("2026-11-03T00:00:00Z"),
    });
  });

  it("keeps the call-back with Richard at the date and time he picked", async () => {
    await completeCall({ outcome: "Call back", ...CALL_BACK });
    expect(createdTasks()[0]).toMatchObject({
      taskType: "call", assignedTo: "richard", followUpTime: "10:30", dueDate: new Date("2026-11-02T00:00:00Z"),
    });
  });

  it("moves a lead with a missed call-back from Contacted back to Attempted", async () => {
    dbState.stageSlug = "contacted";
    mockGetTaskById.mockResolvedValue({ ...CALL_TASK, title: "Call back" });
    await completeCall({ outcome: "No answer" });
    expect(mockMoveOpportunity).toHaveBeenCalledWith("opp-1", "stage-attempted", "richard");
  });

  it("unassigns the lead after the third unanswered call in a row", async () => {
    dbState.stageSlug = "attempted";
    dbState.unansweredCallStreak = 2;
    await completeCall({ outcome: "Left voicemail" });
    expect(mockSyncOpenTaskOwnership).toHaveBeenCalledWith(["lead-1"], null);
    expect(createdTasks()[0]).toMatchObject({ title: "Call lead", assignedTo: null });
  });

  it("does not move a lead that is already in the target stage", async () => {
    dbState.stageSlug = "attempted";
    await completeCall({ outcome: "No answer" });
    expect(mockMoveOpportunity).not.toHaveBeenCalled();
  });

  it("requires a date and time for an appointment or a call-back", async () => {
    expect((await completeCall({ outcome: "Appointment set" })).status).toBe(400);
    expect((await completeCall({ outcome: "Call back" })).status).toBe(400);
    expect((await completeCall({})).status).toBe(400);
    expect(mockCompleteTask).not.toHaveBeenCalled();
    expect(mockMoveOpportunity).not.toHaveBeenCalled();
  });

  it("locks Richard out once the lead is past Call Scheduled", async () => {
    dbState.stageSlug = "demo-scheduled";
    const res = await completeCall({ outcome: "Not interested" });
    expect(res.status).toBe(403);
    expect(mockCompleteTask).not.toHaveBeenCalled();
    expect(mockMoveOpportunity).not.toHaveBeenCalled();
  });
});

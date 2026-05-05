import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import http from "node:http";

const {
  mockGetSession,
  mockGetTasksDueToday,
  mockGetOverdueTasks,
  mockGetUpcomingTasks,
  mockGetCompletedTaskHistory,
  mockGetTasksForOpportunity,
  mockGetTasksForLead,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockGetTasksDueToday: vi.fn(),
  mockGetOverdueTasks: vi.fn(),
  mockGetUpcomingTasks: vi.fn(),
  mockGetCompletedTaskHistory: vi.fn(),
  mockGetTasksForOpportunity: vi.fn(),
  mockGetTasksForLead: vi.fn(),
}));

vi.mock("../../server/features/auth/auth", () => ({
  auth: { api: { getSession: mockGetSession } },
}));

vi.mock("better-auth/node", () => ({
  fromNodeHeaders: (h: unknown) => h,
}));

vi.mock("../../server/features/tasks/storage", () => ({
  getTasksDueToday: mockGetTasksDueToday,
  getOverdueTasks: mockGetOverdueTasks,
  getUpcomingTasks: mockGetUpcomingTasks,
  getCompletedTaskHistory: mockGetCompletedTaskHistory,
  getTasksForOpportunity: mockGetTasksForOpportunity,
  getTasksForLead: mockGetTasksForLead,
  getActiveTaskForContext: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  completeTask: vi.fn(),
  deleteTask: vi.fn(),
}));

vi.mock("../../server/features/crm/storage", () => ({
  addLeadNote: vi.fn(),
}));

vi.mock("../../server/features/pipeline/storage", () => ({
  addActivity: vi.fn(),
  getStages: vi.fn(),
  moveOpportunity: vi.fn(),
}));

vi.mock("../../server/features/audit/service", () => ({
  logAudit: vi.fn(),
}));

vi.mock("../../server/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import taskRoutes from "../../server/features/tasks/routes";

function makeSession(role: string, id = "user-1") {
  return { session: {}, user: { id, role, name: "Test User", email: "test@viva.com" } };
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/tasks", taskRoutes);
  return app;
}

function request(
  app: express.Express,
  method: "GET",
  path: string,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      const req = http.request({ hostname: "127.0.0.1", port, path, method }, (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end", () => {
          server.close();
          try { resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode ?? 0, body: data }); }
        });
      });
      req.on("error", reject);
      req.end();
    });
  });
}

describe("task route owner scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTasksDueToday.mockResolvedValue([]);
    mockGetOverdueTasks.mockResolvedValue([]);
    mockGetUpcomingTasks.mockResolvedValue([]);
    mockGetCompletedTaskHistory.mockResolvedValue([]);
    mockGetTasksForOpportunity.mockResolvedValue([]);
    mockGetTasksForLead.mockResolvedValue([]);
  });

  it("scopes open task buckets to the current sales rep", async () => {
    mockGetSession.mockResolvedValue(makeSession("sales_rep", "rep-1"));
    const res = await request(buildApp(), "GET", "/tasks/due-today");

    expect(res.status).toBe(200);
    expect(mockGetTasksDueToday).toHaveBeenCalledWith("rep-1");
    expect(mockGetOverdueTasks).toHaveBeenCalledWith("rep-1");
    expect(mockGetUpcomingTasks).toHaveBeenCalledWith("rep-1");
  });

  it("leaves admin task buckets unscoped", async () => {
    mockGetSession.mockResolvedValue(makeSession("admin", "admin-1"));
    const res = await request(buildApp(), "GET", "/tasks/due-today");

    expect(res.status).toBe(200);
    expect(mockGetTasksDueToday).toHaveBeenCalledWith(undefined);
    expect(mockGetOverdueTasks).toHaveBeenCalledWith(undefined);
    expect(mockGetUpcomingTasks).toHaveBeenCalledWith(undefined);
  });

  it("scopes completed task history to the current sales rep", async () => {
    mockGetSession.mockResolvedValue(makeSession("sales_rep", "rep-1"));
    const res = await request(buildApp(), "GET", "/tasks/completed-history?limit=25");

    expect(res.status).toBe(200);
    expect(mockGetCompletedTaskHistory).toHaveBeenCalledWith(25, "rep-1");
  });

  it("scopes lead and opportunity task lists to the current sales rep", async () => {
    mockGetSession.mockResolvedValue(makeSession("sales_rep", "rep-1"));

    const oppRes = await request(buildApp(), "GET", "/tasks/for-opportunity/opp-1");
    const leadRes = await request(buildApp(), "GET", "/tasks/for-lead/lead-1");

    expect(oppRes.status).toBe(200);
    expect(leadRes.status).toBe(200);
    expect(mockGetTasksForOpportunity).toHaveBeenCalledWith("opp-1", "rep-1");
    expect(mockGetTasksForLead).toHaveBeenCalledWith("lead-1", "rep-1");
  });
});

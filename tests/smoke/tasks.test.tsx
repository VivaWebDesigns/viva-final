import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { screen }                                        from "@testing-library/react";
import { http, HttpResponse }                            from "msw";
import { renderWithProviders }                           from "../helpers/renderWithProviders";
import { server }                                       from "../helpers/server";

vi.mock("@features/auth/authClient", () => ({
  useSession: () => ({
    data: { user: { id: "u1", email: "admin@test.com", name: "Admin", role: "admin" }, session: {} },
    isPending: false,
    error: null,
  }),
  signIn:  vi.fn(),
  signOut: vi.fn(),
}));

import TasksDueTodayPage from "@features/tasks/TasksDueTodayPage";

describe("TasksDueTodayPage smoke", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  afterAll(()  => server.close());

  it("renders without crashing", async () => {
    renderWithProviders(<TasksDueTodayPage />, { route: "/admin/tasks" });
    expect(document.body).not.toBeEmptyDOMElement();
  });

  it("renders the tasks page heading", async () => {
    renderWithProviders(<TasksDueTodayPage />, { route: "/admin/tasks" });
    expect(await screen.findByTestId("page-tasks-due-today")).toBeInTheDocument();
  });

  it("renders the tasks title element", async () => {
    renderWithProviders(<TasksDueTodayPage />, { route: "/admin/tasks" });
    expect(await screen.findByTestId("text-tasks-title")).toBeInTheDocument();
  });

  it("shows the linked lead trade and city", async () => {
    server.use(
      http.get("/api/tasks/due-today", () => HttpResponse.json({
        dueToday: [{
          id: "task-1",
          title: "Contact lead",
          notes: null,
          dueDate: "2026-07-30T12:00:00.000Z",
          followUpTime: null,
          followUpTimezone: null,
          completed: false,
          completedAt: null,
          completionNote: null,
          outcome: null,
          taskType: "follow_up",
          assignedTo: null,
          opportunityId: "opp-1",
          leadId: "lead-1",
          contactId: null,
          companyId: "company-1",
          createdBy: null,
          createdAt: "2026-07-30T12:00:00.000Z",
          contact: null,
          company: { name: "Happi Plumbing Corp", industry: "plumbing", city: "Monroe" },
          lead: { trade: "plumbing", city: "Monroe", recycleCount: 0, hungUpCount: 0 },
          automationMeta: null,
          opportunityStageSlug: "new-lead",
        }],
        overdue: [],
        upcoming: [],
      })),
    );

    renderWithProviders(<TasksDueTodayPage />, { route: "/admin/tasks" });

    expect(await screen.findByTestId("text-lead-trade-task-1")).toHaveTextContent("Plumbing");
    expect(screen.getByTestId("text-lead-city-task-1")).toHaveTextContent("Monroe");
  });
});

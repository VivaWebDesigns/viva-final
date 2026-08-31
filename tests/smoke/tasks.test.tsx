import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { fireEvent, screen, waitFor }                    from "@testing-library/react";
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
          lead: {
            trade: "plumbing",
            city: "Monroe",
            recycleCount: 0,
            hungUpCount: 0,
            tags: [{ id: "tag-sab", name: "SAB", slug: "sab", color: "#7C3AED" }],
            salesPriority: {
              priority: 2,
              reason: "Strong need with moderate business activity.",
            },
          },
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
    expect(screen.getByTestId("badge-task-tag-task-1-sab")).toHaveTextContent("SAB");
    expect(screen.getByTestId("badge-sales-priority-task-task-1")).toHaveTextContent("2");
  });

  it("filters task date groups by report outreach and lead tags", async () => {
    let requestedOutreach: string | null = null;
    let requestedTags: string[] = [];
    server.use(
      http.get("/api/crm/tags", () => HttpResponse.json([
        { id: "tag-email", name: "Email Ready", slug: "email-ready", color: "#16A34A" },
      ])),
      http.get("/api/tasks/due-today", ({ request }) => {
        const params = new URL(request.url).searchParams;
        requestedOutreach = params.get("reportOutreach");
        requestedTags = params.getAll("tagIds");
        return HttpResponse.json({ dueToday: [], overdue: [], upcoming: [] });
      }),
      http.get("/api/tasks/completed-history", () => HttpResponse.json([])),
    );
    renderWithProviders(<TasksDueTodayPage />, { route: "/admin/tasks" });

    fireEvent.keyDown(await screen.findByTestId("tasks-report-outreach-filter"), { key: " " });
    fireEvent.click(await screen.findByRole("option", { name: "1 of 2 sent" }));
    await waitFor(() => expect(requestedOutreach).toBe("one_sent"));

    fireEvent.pointerDown(screen.getByTestId("tasks-tag-filter"), { button: 0 });
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Email Ready" }));
    await waitFor(() => expect(requestedTags).toEqual(["tag-email"]));
  });
});

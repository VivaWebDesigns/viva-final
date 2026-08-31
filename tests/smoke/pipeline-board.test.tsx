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

import PipelineBoardPage from "@features/pipeline/PipelineBoardPage";

describe("PipelineBoardPage smoke", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  afterAll(()  => server.close());

  it("renders without crashing", async () => {
    renderWithProviders(<PipelineBoardPage />, { route: "/admin/pipeline" });
    expect(document.body).not.toBeEmptyDOMElement();
  });

  it("shows lead classification tags on opportunity cards", async () => {
    server.use(
      http.get("/api/pipeline/opportunities/board", () => HttpResponse.json({
        stages: [{
          id: "stage-1",
          name: "New Lead",
          slug: "new-lead",
          color: "#3B82F6",
          sortOrder: 0,
          isDefault: true,
          isClosed: false,
        }],
        board: {
          "stage-1": {
            stage: { id: "stage-1", name: "New Lead", slug: "new-lead", color: "#3B82F6" },
            opportunities: [{
              id: "opp-1",
              title: "Happi Plumbing Corp",
              leadId: "lead-1",
              companyId: "company-1",
              contactId: null,
              stageId: "stage-1",
              status: "open",
              value: null,
              assignedTo: null,
              createdAt: "2026-07-30T12:00:00.000Z",
            }],
          },
        },
        contactMap: {},
        companyMap: {
          "company-1": { id: "company-1", name: "Happi Plumbing Corp", city: "Monroe", industry: "plumbing" },
        },
        leadRecycleMap: {
          "lead-1": {
            id: "lead-1",
            recycleCount: 0,
            hungUpCount: 0,
            tags: [{ id: "tag-sab", name: "SAB", slug: "sab", color: "#7C3AED" }],
            salesPriority: {
              priority: 3,
              reason: "No website and active paid-lead usage.",
            },
            outreach: {
              reportEmailCount: 2,
              reportViewCount: 1,
              reportCtaClickCount: 0,
              reportOutreachSegment: "engaged",
              reportNeedsAttention: true,
            },
          },
        },
      })),
    );

    renderWithProviders(<PipelineBoardPage />, { route: "/admin/pipeline" });

    expect(await screen.findByTestId("badge-pipeline-tag-opp-1-sab")).toHaveTextContent("SAB");
    expect(screen.getByTestId("badge-sales-priority-opportunity-opp-1")).toHaveTextContent("3");
    expect(screen.getByTestId("badge-report-outreach-opportunity-opp-1-count")).toHaveTextContent("2 of 2 sent");
    expect(screen.getByTestId("badge-report-outreach-opportunity-opp-1")).toHaveTextContent("Viewed report — personal touch");
  });

  it("filters the board by report outreach and all selected lead tags", async () => {
    let requestedOutreach: string | null = null;
    let requestedTags: string[] = [];
    server.use(
      http.get("/api/crm/tags", () => HttpResponse.json([
        { id: "tag-sab", name: "SAB", slug: "sab", color: "#7C3AED" },
      ])),
      http.get("/api/pipeline/opportunities/board", ({ request }) => {
        const params = new URL(request.url).searchParams;
        requestedOutreach = params.get("reportOutreach");
        requestedTags = params.getAll("tagIds");
        return HttpResponse.json({ stages: [], board: {}, contactMap: {}, companyMap: {}, leadRecycleMap: {} });
      }),
    );
    renderWithProviders(<PipelineBoardPage />, { route: "/admin/pipeline" });

    fireEvent.keyDown(await screen.findByTestId("pipeline-board-report-outreach-filter"), { key: " " });
    fireEvent.click(await screen.findByRole("option", { name: "Needs attention" }));
    await waitFor(() => expect(requestedOutreach).toBe("needs_attention"));

    fireEvent.pointerDown(screen.getByTestId("pipeline-board-tag-filter"), { button: 0 });
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "SAB" }));
    await waitFor(() => expect(requestedTags).toEqual(["tag-sab"]));
  });
});

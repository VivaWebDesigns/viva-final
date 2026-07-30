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
          },
        },
      })),
    );

    renderWithProviders(<PipelineBoardPage />, { route: "/admin/pipeline" });

    expect(await screen.findByTestId("badge-pipeline-tag-opp-1-sab")).toHaveTextContent("SAB");
  });
});

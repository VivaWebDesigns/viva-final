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

import LeadListPage from "@features/crm/LeadListPage";

describe("CRM LeadListPage smoke", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  afterAll(()  => server.close());

  it("renders without crashing", async () => {
    renderWithProviders(<LeadListPage />, { route: "/admin/crm/leads" });
    expect(document.body).not.toBeEmptyDOMElement();
  });

  it("renders a search input", async () => {
    renderWithProviders(<LeadListPage />, { route: "/admin/crm/leads" });
    expect(await screen.findByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it("shows trade and city with company fallbacks", async () => {
    server.use(
      http.get("/api/crm/leads/assignable-users", () => HttpResponse.json([])),
      http.get("/api/crm/leads", () => HttpResponse.json({
        leads: [{
          id: "lead-1",
          title: "Happi Plumbing Corp",
          companyId: "company-1",
          contactId: null,
          statusId: null,
          value: null,
          source: "manual",
          fromWebsiteForm: false,
          assignedTo: null,
          trade: null,
          city: null,
          recycleCount: 0,
          hungUpCount: 0,
          createdAt: "2026-07-30T12:00:00.000Z",
          company: {
            id: "company-1",
            name: "Happi Plumbing Corp",
            industry: "plumbing",
            city: "Monroe",
          },
          contact: null,
          status: null,
          lastUnassignedFromUser: null,
        }],
        total: 1,
        page: 1,
        pageSize: 20,
      })),
    );

    renderWithProviders(<LeadListPage />, { route: "/admin/crm/leads" });

    expect(await screen.findByTestId("text-lead-trade-lead-1")).toHaveTextContent("Plumbing");
    expect(screen.getByTestId("text-lead-city-lead-1")).toHaveTextContent("Monroe");
  });
});

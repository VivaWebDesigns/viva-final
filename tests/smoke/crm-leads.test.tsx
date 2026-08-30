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
    let requestedTagIds: string[] = [];
    let requestedLimit: string | null = null;
    server.use(
      http.get("/api/crm/leads/assignable-users", () => HttpResponse.json([])),
      http.get("/api/crm/tags", () => HttpResponse.json([
        { id: "tag-sab", name: "SAB", slug: "sab", color: "#7C3AED" },
        { id: "tag-email", name: "Email Ready", slug: "email-ready", color: "#16A34A" },
      ])),
      http.get("/api/crm/leads", ({ request }) => {
        const searchParams = new URL(request.url).searchParams;
        requestedTagIds = searchParams.getAll("tagIds");
        requestedLimit = searchParams.get("limit");
        return HttpResponse.json({
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
            tags: [{ id: "tag-sab", name: "SAB", slug: "sab", color: "#7C3AED" }],
            lastUnassignedFromUser: null,
            salesPriority: {
              priority: 3,
              reason: "No website and active paid-lead usage.",
            },
          }],
          total: 1,
          page: 1,
          pageSize: 100,
        });
      }),
    );

    renderWithProviders(<LeadListPage />, { route: "/admin/crm/leads" });

    expect(await screen.findByTestId("text-lead-trade-lead-1")).toHaveTextContent("Plumbing");
    expect(screen.getByTestId("text-lead-city-lead-1")).toHaveTextContent("Monroe");
    expect(screen.getByTestId("badge-lead-tag-lead-1-sab")).toHaveTextContent("SAB");
    expect(screen.getByTestId("badge-sales-priority-lead-lead-1")).toHaveTextContent("3");
    expect(screen.getByTestId("badge-sales-priority-lead-lead-1")).toHaveAttribute(
      "title",
      expect.stringContaining("No website and active paid-lead usage."),
    );
    expect(screen.getByTestId("select-tag-filter")).toBeInTheDocument();
    expect(requestedLimit).toBe("100");

    fireEvent.pointerDown(screen.getByTestId("select-tag-filter"), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "SAB" }));
    await waitFor(() => expect(requestedTagIds).toEqual(["tag-sab"]));
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Email Ready" }));
    await waitFor(() => expect(requestedTagIds).toEqual(["tag-email", "tag-sab"]));
    expect(screen.getByRole("menuitemcheckbox", { name: "SAB" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemcheckbox", { name: "Email Ready" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("select-tag-filter")).toHaveTextContent("SAB + Email Ready");
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "SAB" }));
    await waitFor(() => expect(requestedTagIds).toEqual(["tag-email"]));
    fireEvent.click(screen.getByRole("menuitem", { name: "Clear tag filters" }));
    await waitFor(() => expect(requestedTagIds).toEqual([]));
    expect(screen.getByTestId("select-tag-filter")).toHaveTextContent("All tags");
  });
});

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { screen }                                        from "@testing-library/react";
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
});

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

import ClientsPage from "@features/clients/ClientsPage";

describe("ClientsPage smoke", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  afterAll(()  => server.close());

  it("renders without crashing", async () => {
    renderWithProviders(<ClientsPage />, { route: "/admin/clients" });
    expect(document.body).not.toBeEmptyDOMElement();
  });

  it("renders a search input", async () => {
    renderWithProviders(<ClientsPage />, { route: "/admin/clients" });
    expect(await screen.findByPlaceholderText(/search/i)).toBeInTheDocument();
  });
});

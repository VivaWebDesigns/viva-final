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

import DashboardPage from "@features/admin/pages/DashboardPage";

describe("DashboardPage smoke", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  afterAll(()  => server.close());

  it("renders without crashing", async () => {
    renderWithProviders(<DashboardPage />, { route: "/admin" });
    expect(document.body).not.toBeEmptyDOMElement();
  });

  it("shows a heading", async () => {
    renderWithProviders(<DashboardPage />, { route: "/admin" });
    const headings = await screen.findAllByRole("heading");
    expect(headings.length).toBeGreaterThan(0);
  });
});

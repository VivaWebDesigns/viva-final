import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { screen }                                        from "@testing-library/react";
import { renderWithProviders }                           from "../helpers/renderWithProviders";
import { server }                                       from "../helpers/server";

// ── Auth mock ─────────────────────────────────────────────────────────────────
vi.mock("@features/auth/authClient", () => ({
  useSession: () => ({ data: null, isPending: false, error: null }),
  signIn:     vi.fn(),
  signOut:    vi.fn(),
}));

import LoginPage from "@features/auth/LoginPage";

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("LoginPage smoke", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  afterAll(()  => server.close());

  it("renders the email and password inputs", async () => {
    renderWithProviders(<LoginPage />, { route: "/login" });
    expect(await screen.findByTestId("input-email")).toBeInTheDocument();
    expect(await screen.findByTestId("input-password")).toBeInTheDocument();
  });

  it("renders the submit button", async () => {
    renderWithProviders(<LoginPage />, { route: "/login" });
    expect(await screen.findByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });
});

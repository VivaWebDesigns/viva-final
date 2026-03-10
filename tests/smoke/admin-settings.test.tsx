import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { screen }                                        from "@testing-library/react";
import { renderWithProviders }                           from "../helpers/renderWithProviders";
import { server }                                       from "../helpers/server";
import type { Role }                                    from "@shared/schema";

// ── Hoisted mock so role can change per-test ───────────────────────────────────
const mockUseSession = vi.hoisted(() => vi.fn());

vi.mock("@features/auth/authClient", () => ({
  useSession: mockUseSession,
  signIn:     vi.fn(),
  signOut:    vi.fn(),
}));

import AdminSettingsPage from "@features/admin/pages/AdminSettingsPage";
import ProtectedRoute    from "@features/auth/ProtectedRoute";

function renderAsRole(role: Role) {
  mockUseSession.mockReturnValue({
    data: { user: { id: "u1", email: "admin@test.com", name: "Tester", role }, session: {} },
    isPending: false,
    error: null,
  });
  return renderWithProviders(
    <ProtectedRoute roles={["admin"]}>
      <AdminSettingsPage />
    </ProtectedRoute>,
    { route: "/admin/settings" },
  );
}

describe("AdminSettingsPage role-gating smoke", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  afterAll(()  => server.close());

  it("renders the settings page for admin role", async () => {
    renderAsRole("admin");
    expect(document.body).not.toBeEmptyDOMElement();
    // Should NOT show the access-denied message
    expect(screen.queryByText(/access denied/i)).not.toBeInTheDocument();
  });

  it("shows Access Denied for sales_rep role", () => {
    renderAsRole("sales_rep");
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
  });

  it("shows Access Denied for developer role", () => {
    renderAsRole("developer");
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
  });
});

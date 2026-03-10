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

// AdminDemoBuilder reads language context — provide a lightweight stub
vi.mock("@/contexts/PreviewLangContext", () => ({
  usePreviewLang:     () => ({ lang: "en", setLang: vi.fn() }),
  PreviewLangProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import AdminDemoBuilder from "@/pages/AdminDemoBuilder";

describe("AdminDemoBuilder smoke", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  afterAll(()  => server.close());

  it("renders without crashing", async () => {
    renderWithProviders(<AdminDemoBuilder />, { route: "/admin/demo-builder" });
    expect(document.body).not.toBeEmptyDOMElement();
  });

  it("shows the Business Name input", async () => {
    renderWithProviders(<AdminDemoBuilder />, { route: "/admin/demo-builder" });
    expect(await screen.findByLabelText(/business name/i)).toBeInTheDocument();
  });
});

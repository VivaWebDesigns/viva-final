import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { screen }                                                 from "@testing-library/react";
import { http, HttpResponse }                                     from "msw";
import { renderWithProviders }                                    from "../helpers/renderWithProviders";
import { server }                                                 from "../helpers/server";

vi.mock("@features/auth/authClient", () => ({
  useSession: () => ({
    data: { user: { id: "u1", email: "admin@test.com", name: "Admin", role: "admin" }, session: {} },
    isPending: false,
    error: null,
  }),
  signIn:  vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("socket.io-client", () => ({
  io: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  }),
}));

import AdminLayout from "@/layouts/AdminLayout";

describe("AdminLayout smoke", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  afterEach(() => server.resetHandlers());
  afterAll(()  => server.close());

  it("shows a Team Chat unread badge in the sidebar", async () => {
    server.use(
      http.get("/api/chat/unread-count", () => HttpResponse.json({ count: 7 })),
    );

    renderWithProviders(
      <AdminLayout>
        <div>Dashboard</div>
      </AdminLayout>,
      { route: "/admin" },
    );

    const badge = await screen.findByTestId("badge-chat-unread-count");
    expect(badge).toHaveTextContent("7");
    expect(screen.getByTestId("nav-chat")).toContainElement(badge);
  });
});

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

import TasksDueTodayPage from "@features/tasks/TasksDueTodayPage";

describe("TasksDueTodayPage smoke", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  afterAll(()  => server.close());

  it("renders without crashing", async () => {
    renderWithProviders(<TasksDueTodayPage />, { route: "/admin/tasks" });
    expect(document.body).not.toBeEmptyDOMElement();
  });

  it("renders the tasks page heading", async () => {
    renderWithProviders(<TasksDueTodayPage />, { route: "/admin/tasks" });
    expect(await screen.findByTestId("page-tasks-due-today")).toBeInTheDocument();
  });

  it("renders the tasks title element", async () => {
    renderWithProviders(<TasksDueTodayPage />, { route: "/admin/tasks" });
    expect(await screen.findByTestId("text-tasks-title")).toBeInTheDocument();
  });
});

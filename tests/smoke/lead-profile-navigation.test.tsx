import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "../helpers/renderWithProviders";
import { server } from "../helpers/server";

vi.mock("@features/profiles/ProfileShell", () => ({
  default: () => <div>Lead profile</div>,
}));

import LeadProfilePage from "@features/profiles/LeadProfilePage";

describe("LeadProfilePage navigation", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  afterAll(() => server.close());

  it("navigates to the previous and next leads", async () => {
    server.use(
      http.get("/api/crm/leads/:id/navigation", ({ params }) => {
        if (params.id === "lead-2") {
          return HttpResponse.json({
            previous: { id: "lead-1", title: "Newer lead" },
            next: { id: "lead-3", title: "Older lead" },
          });
        }
        return HttpResponse.json({ previous: null, next: null });
      }),
    );

    renderWithProviders(<LeadProfilePage id="lead-2" />, { route: "/admin/crm/leads/lead-2" });

    const previousButton = await screen.findByTestId("button-previous-lead");
    await waitFor(() => expect(previousButton).toHaveAttribute("title", "Newer lead"));
    expect(screen.getByTestId("button-next-lead")).toHaveAttribute("title", "Older lead");

    fireEvent.click(screen.getByTestId("button-next-lead"));
    expect(window.location.pathname).toBe("/admin/crm/leads/lead-3");

    fireEvent.click(previousButton);
    expect(window.location.pathname).toBe("/admin/crm/leads/lead-1");
  });

  it("disables navigation at the ends of the lead list", async () => {
    server.use(
      http.get("/api/crm/leads/:id/navigation", () =>
        HttpResponse.json({ previous: null, next: null }),
      ),
    );

    renderWithProviders(<LeadProfilePage id="lead-1" />, { route: "/admin/crm/leads/lead-1" });

    expect(await screen.findByTestId("button-previous-lead")).toBeDisabled();
    expect(screen.getByTestId("button-next-lead")).toBeDisabled();
  });
});

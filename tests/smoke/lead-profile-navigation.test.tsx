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
    let requestedSource: string | null = null;
    let requestedPage: string | null = null;
    server.use(
      http.get("/api/crm/leads/:id/navigation", ({ params, request }) => {
        const searchParams = new URL(request.url).searchParams;
        requestedSource = searchParams.get("source");
        requestedPage = searchParams.get("page");
        if (params.id === "lead-2") {
          return HttpResponse.json({
            previous: { id: "lead-1", title: "Newer lead" },
            next: { id: "lead-3", title: "Older lead" },
          });
        }
        return HttpResponse.json({ previous: null, next: null });
      }),
    );

    renderWithProviders(<LeadProfilePage id="lead-2" />, {
      route: "/admin/crm/leads/lead-2?source=local_falcon&page=2",
    });

    const previousButton = await screen.findByTestId("button-previous-lead");
    await waitFor(() => expect(previousButton).toHaveAttribute("title", "Newer lead"));
    expect(requestedSource).toBe("local_falcon");
    expect(requestedPage).toBe("2");
    expect(screen.getByTestId("button-next-lead")).toHaveAttribute("title", "Older lead");

    fireEvent.click(screen.getByTestId("button-next-lead"));
    expect(window.location.pathname).toBe("/admin/crm/leads/lead-3");
    expect(window.location.search).toBe("?source=local_falcon&page=2");

    fireEvent.click(previousButton);
    expect(window.location.pathname).toBe("/admin/crm/leads/lead-1");
    expect(window.location.search).toBe("?source=local_falcon&page=2");

    fireEvent.click(screen.getByTestId("button-back-to-leads"));
    expect(window.location.pathname).toBe("/admin/crm");
    expect(window.location.search).toBe("?source=local_falcon&page=2");
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

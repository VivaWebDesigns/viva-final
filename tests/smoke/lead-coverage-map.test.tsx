import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "../helpers/renderWithProviders";
import { server } from "../helpers/server";
import LeadCoverageMapPage from "@features/marketplace/LeadCoverageMapPage";

const charlotteMarket = {
  id: "nc-charlotte",
  name: "Charlotte",
  state: "NC",
  radiusMiles: 35,
  pin: { x: 37, y: 58 },
  includedCities: ["Charlotte", "Matthews"],
  totalLeads: 1,
  dateRange: { from: "2026-08-01T12:00:00.000Z", to: "2026-08-01T12:00:00.000Z" },
  coverage: {
    covered: 1,
    total: 10,
    percent: 10,
    missingTrades: [{ value: "roofing", label: "Roofing" }],
  },
  reps: [{ userId: "user-1", name: "Matt", count: 1 }],
  trades: [{ value: "painting", label: "Painting", count: 1 }],
  capturedCities: [{ city: "Matthews", state: "NC", count: 1 }],
  recentLeads: [{
    id: "lead-1",
    title: "Queen City Painting",
    contactName: "Jamie Painter",
    businessName: "Queen City Painting LLC",
    city: "Matthews",
    state: "NC",
    trade: "Painting",
    tradeLabel: "Painting",
    createdAt: "2026-08-01T12:00:00.000Z",
    assignedToName: "Matt",
    statusName: "Qualified",
    statusSlug: "qualified",
    statusColor: "#0D9488",
    statusIsClosed: false,
  }],
};

function summary(scope: "active" | "all") {
  return {
    scope,
    range: { from: null, to: null, days: null },
    targetState: "NC",
    targetTrades: [{ value: "painting", label: "Painting" }],
    totals: {
      totalLeads: 1,
      targetMarkets: 1,
      marketsWithCoverage: 1,
      completeMarkets: 0,
      outsideTargetLeads: 0,
      averageCoveragePercent: 10,
    },
    markets: [charlotteMarket],
    outsideTargetMarkets: { ...charlotteMarket, id: "outside-target-markets", totalLeads: 0, recentLeads: [] },
  };
}

describe("LeadCoverageMapPage smoke", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  afterAll(() => server.close());

  it("defaults to active CRM leads and can include all leads", async () => {
    const requestedScopes: Array<string | null> = [];
    const requestedRanges: Array<string | null> = [];

    server.use(
      http.get("/api/marketplace/lead-coverage/summary", ({ request }) => {
        const params = new URL(request.url).searchParams;
        const scope = params.get("scope");
        requestedScopes.push(scope);
        requestedRanges.push(params.get("range"));
        return HttpResponse.json(summary(scope === "all" ? "all" : "active"));
      }),
    );

    renderWithProviders(<LeadCoverageMapPage />, { route: "/admin/lead-coverage" });

    expect(await screen.findByText("Queen City Painting LLC")).toBeInTheDocument();
    expect(requestedScopes[0]).toBe("active");
    expect(requestedRanges[0]).toBe("all");
    expect(screen.getByRole("link", { name: "Queen City Painting LLC" })).toHaveAttribute(
      "href",
      "/admin/crm/leads/lead-1",
    );

    fireEvent.click(screen.getByTestId("button-lead-coverage-scope-all"));
    await waitFor(() => expect(requestedScopes).toContain("all"));
  });
});

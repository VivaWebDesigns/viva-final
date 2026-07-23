import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../helpers/renderWithProviders";

vi.mock("@features/auth/authClient", () => ({
  useSession: () => ({
    data: {
      user: { id: "u1", email: "admin@test.com", name: "Admin", role: "admin" },
      session: {},
    },
    isPending: false,
    error: null,
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

import LocalVisibilityReportPage from "@features/local-visibility-report/LocalVisibilityReportPage";

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("Local Visibility CRM prospect loader", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the same centered crop approved in the import preview", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/local-visibility/prospects") {
        return jsonResponse([{
          leadId: "lead-1",
          businessName: "Boda Plumbing, Inc.",
          city: "Monroe",
          state: "NC",
          keyword: "plumber near me",
          scanDate: "2026-07-14",
        }]);
      }
      if (url === "/api/local-visibility/prospects/lead-1") {
        return jsonResponse({
          leadId: "lead-1",
          reportUrl: "https://localrankingtracker.com/scan-report/example/public/",
          mapPresentation: {
            mapZoom: 160,
            mapPosition: { x: 0, y: 0 },
          },
          data: {
            businessName: "Boda Plumbing, Inc.",
            address: "1909 Tower Industrial Dr, Monroe, NC 28110",
            rating: "5.0",
            reviewCount: "60",
            searchPhrase: "plumber near me",
            market: "Monroe, NC",
            averagePosition: "4.45",
            gridSize: "7x7",
            radius: "2.5",
            heatmapImageUrl: "https://example.test/boda-map.png",
          },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();
    renderWithProviders(<LocalVisibilityReportPage />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/local-visibility/prospects",
      { credentials: "include" },
    ));
    await user.click(screen.getByTestId("select-local-visibility-prospect"));
    const prospectLabels = await screen.findAllByText("Boda Plumbing, Inc. · Monroe, NC");
    await user.click(prospectLabels.at(-1)!);

    await waitFor(() => expect(screen.getByLabelText("Business name")).toHaveValue("Boda Plumbing, Inc."));
    expect(screen.getByTestId("input-map-zoom")).toHaveValue("160");
    expect(screen.getByAltText("Uploaded Local Falcon ranking heatmap")).toHaveStyle({
      transform: "translate(0px, 0px) scale(1.6)",
    });
  });
});

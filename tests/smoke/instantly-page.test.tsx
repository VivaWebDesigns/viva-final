import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "../helpers/renderWithProviders";
import { server } from "../helpers/server";
import InstantlyPage from "@features/admin/pages/InstantlyPage";

const CAMPAIGN = "e2179cc5-b0e7-4ffb-a4db-3db47f89d5d8";

describe("InstantlyPage", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  afterAll(() => server.close());

  it("sends only the chosen number of leads to the pasted campaign", async () => {
    let pushed: unknown = null;
    server.use(
      http.get("/api/instantly/status", () => HttpResponse.json({
        apiKeySet: true, defaultCampaignId: null, webhookUrl: "https://vivawebdesigns.com/api/instantly/webhook",
        webhookSecretSet: true, imageDomainSet: true, counts: { ready: 284 }, imageSyncPending: 0, problems: [], campaigns: [],
      })),
      http.get("/api/instantly/enrollment/preview", () => HttpResponse.json({ eligibleCount: 284, excludedCounts: {} })),
      http.post("/api/instantly/enrollment/push", async ({ request }) => {
        pushed = await request.json();
        return HttpResponse.json({ enrolled: 15, skipped: [], retired: [] });
      }),
    );
    renderWithProviders(<InstantlyPage />, { route: "/admin/tools/instantly" });
    const sendButton = await screen.findByTestId("button-instantly-push");
    expect(sendButton).toBeDisabled();

    fireEvent.change(screen.getByTestId("input-instantly-batch-size"), { target: { value: "15" } });
    fireEvent.change(screen.getByTestId("input-instantly-campaign"), {
      target: { value: `https://app.instantly.ai/app/campaign/${CAMPAIGN}/editor` },
    });
    await waitFor(() => expect(sendButton).toHaveTextContent("Send 15 leads to Instantly"));
    fireEvent.click(sendButton);
    fireEvent.click(await screen.findByRole("button", { name: "Send to Instantly" }));
    await waitFor(() => expect(pushed).toEqual({ limit: 15, campaign: CAMPAIGN }));
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../server/db", () => ({ db: {} }));
import { addLeadsToCampaign, registerWebhook } from "../../server/features/instantly/client";
import { instantlyCustomVariables } from "../../server/features/instantly/enrollment";
import { instantlyEventKey, isValidInstantlyWebhookSecret } from "../../server/features/instantly/webhook";

describe("Instantly webhook guards", () => {
  it("accepts only the exact shared secret", () => {
    expect(isValidInstantlyWebhookSecret("s3cret", "s3cret")).toBe(true);
    expect(isValidInstantlyWebhookSecret("s3cre", "s3cret")).toBe(false);
    expect(isValidInstantlyWebhookSecret(undefined, "s3cret")).toBe(false);
    expect(isValidInstantlyWebhookSecret("s3cret", null)).toBe(false);
  });

  it("gives a redelivered event the same key", () => {
    const sent = { event_type: "email_sent", email_id: "e1", lead_email: "a@b.com" };
    expect(instantlyEventKey(sent)).toBe("email_sent:e1");
    expect(instantlyEventKey({ ...sent, event_type: "reply_received" })).toBe("reply_received:e1");
    const unsubscribed = { event_type: "lead_unsubscribed", lead_email: "a@b.com", timestamp: "2026-10-06T12:00:00Z" };
    expect(instantlyEventKey(unsubscribed)).toBe(instantlyEventKey({ ...unsubscribed }));
  });
});

describe("Instantly API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("adds leads to the configured campaign with the template's merge fields", async () => {
    vi.stubEnv("INSTANTLY_API_KEY", "key");
    vi.stubEnv("INSTANTLY_CAMPAIGN_ID", "camp-1");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ created_leads: [{ id: "il-1", index: 0, email: "a@b.com" }] })));
    vi.stubGlobal("fetch", fetchMock);
    const variables = instantlyCustomVariables({ leadId: "lead-1", searchPhrase: "plumber near me", imageUrl: "https://img.vivascans.com/scans/r/x.png" });
    const { result } = await addLeadsToCampaign([{ email: "a@b.com", company_name: "Acme", custom_variables: variables }]);

    const [url, request] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.instantly.ai/api/v2/leads/add");
    expect((request.headers as Record<string, string>).Authorization).toBe("Bearer key");
    expect(JSON.parse(String(request.body))).toEqual({
      campaign_id: "camp-1",
      skip_if_in_workspace: true,
      leads: [{
        email: "a@b.com",
        company_name: "Acme",
        custom_variables: { searchPhrase: "plumber near me", reportImageUrl: "https://img.vivascans.com/scans/r/x.png", crmLeadId: "lead-1" },
      }],
    });
    expect(result.created_leads?.[0].id).toBe("il-1");
  });

  it("registers the webhook with the secret header for the campaign", async () => {
    vi.stubEnv("INSTANTLY_API_KEY", "key");
    vi.stubEnv("INSTANTLY_CAMPAIGN_ID", "camp-1");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "wh-1" })));
    vi.stubGlobal("fetch", fetchMock);
    await registerWebhook("https://vivawebdesigns.com/api/instantly/webhook", "s3cret");
    const [, request] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toMatchObject({
      target_hook_url: "https://vivawebdesigns.com/api/instantly/webhook",
      campaign: "camp-1",
      event_type: "all_events",
      headers: { "x-viva-webhook-secret": "s3cret" },
    });
  });

  it("refuses to call Instantly without a key and campaign", async () => {
    vi.stubEnv("INSTANTLY_API_KEY", "");
    await expect(addLeadsToCampaign([])).rejects.toThrow("INSTANTLY_API_KEY");
  });
});

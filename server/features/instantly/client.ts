const INSTANTLY_BASE = "https://api.instantly.ai/api/v2";
const INSTANTLY_TIMEOUT_MS = 30_000;

export interface InstantlyConfig {
  apiKey: string | null;
  campaignId: string | null;
  webhookSecret: string | null;
}

export function instantlyConfig(): InstantlyConfig {
  return {
    apiKey: process.env.INSTANTLY_API_KEY?.trim() || null,
    campaignId: process.env.INSTANTLY_CAMPAIGN_ID?.trim() || null,
    webhookSecret: process.env.INSTANTLY_WEBHOOK_SECRET?.trim() || null,
  };
}

function requireConfig() {
  const config = instantlyConfig();
  if (!config.apiKey || !config.campaignId) {
    throw Object.assign(new Error("Instantly is not configured. INSTANTLY_API_KEY and INSTANTLY_CAMPAIGN_ID are required."), { statusCode: 503 });
  }
  return { apiKey: config.apiKey, campaignId: config.campaignId };
}

async function instantlyRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { apiKey } = requireConfig();
  const response = await fetch(`${INSTANTLY_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(INSTANTLY_TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok) {
    let message = text.slice(0, 300);
    try { message = JSON.parse(text).message ?? message; } catch { /* keep raw text */ }
    throw Object.assign(new Error(`Instantly ${method} ${path} failed (${response.status}): ${message}`), { statusCode: 502 });
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export interface InstantlyLeadInput {
  email: string;
  company_name: string;
  custom_variables: Record<string, string>;
}

export interface InstantlyBulkAddResult {
  leads_uploaded?: number;
  duplicated_leads?: number;
  skipped_count?: number;
  invalid_email_count?: number;
  created_leads?: Array<{ id: string; index: number; email: string | null }>;
}

/** Adds up to 1,000 leads to the configured campaign; leads already in the workspace are skipped. */
export async function addLeadsToCampaign(leads: InstantlyLeadInput[]) {
  const { campaignId } = requireConfig();
  const result = await instantlyRequest<InstantlyBulkAddResult>("POST", "/leads/add", {
    campaign_id: campaignId,
    skip_if_in_workspace: true,
    leads,
  });
  return { campaignId, result };
}

/** Instantly's PATCH merge semantics are undocumented, so callers always send every custom variable. */
export function updateLeadVariables(instantlyLeadId: string, customVariables: Record<string, string>) {
  return instantlyRequest("PATCH", `/leads/${encodeURIComponent(instantlyLeadId)}`, { custom_variables: customVariables });
}

/** Removing the lead is the documented way to guarantee no further sequence emails. */
export function removeLead(instantlyLeadId: string) {
  return instantlyRequest("DELETE", `/leads/${encodeURIComponent(instantlyLeadId)}`);
}

export function registerWebhook(targetUrl: string, secret: string) {
  const { campaignId } = requireConfig();
  return instantlyRequest<{ id: string }>("POST", "/webhooks", {
    target_hook_url: targetUrl,
    campaign: campaignId,
    name: "Viva CRM",
    event_type: "all_events",
    headers: { "x-viva-webhook-secret": secret },
  });
}

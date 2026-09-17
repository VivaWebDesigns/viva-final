export type DataRow = Record<string, unknown>;
export type BacklinkRequest = { section: string; endpoint: string; body: DataRow; rows: number };
export type BacklinkSection = {
  status: "complete" | "provider_error" | "unknown";
  endpoint: string;
  task_id: string | null;
  cost_usd: number | null;
  status_code: number | null;
  result: DataRow | null;
  error?: string;
};
const record = (value: unknown): value is DataRow => !!value && typeof value === "object" && !Array.isArray(value);
export const finite = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
export const rows = (value: unknown): DataRow[] => Array.isArray(value) ? value.filter(record) : [];

export function dataForSeoBacklinksConfigured() {
  return !!process.env.DATAFORSEO_API_LOGIN?.trim() && !!process.env.DATAFORSEO_API_PASSWORD?.trim();
}

export async function fetchBacklinkSection(request: BacklinkRequest, options: {
  login?: string; password?: string; fetchImpl?: typeof fetch;
} = {}): Promise<BacklinkSection> {
  const base: BacklinkSection = { endpoint: request.endpoint, status: "unknown", task_id: null, cost_usd: null, status_code: null, result: null };
  const login = options.login ?? process.env.DATAFORSEO_API_LOGIN;
  const password = options.password ?? process.env.DATAFORSEO_API_PASSWORD;
  if (!login || !password) return { ...base, status: "provider_error", cost_usd: 0, error: "DataForSEO credentials are not configured; no request submitted." };
  try {
    // Fixed provider host: supplied domains are data, never fetch destinations.
    const response = await (options.fetchImpl ?? fetch)(`https://api.dataforseo.com/v3/backlinks/${request.endpoint}/live`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(25000),
      headers: { Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify([request.body]),
    });
    if (!response.ok) return { ...base, error: `Provider HTTP ${response.status}; submission/charge may be unknown. Not automatically retried.` };
    const payload: unknown = await response.json();
    if (!record(payload)) return { ...base, error: "Invalid provider response. Not automatically retried." };
    const task = rows(payload.tasks)[0];
    const receipt = { ...base, task_id: typeof task?.id === "string" ? task.id : null,
      cost_usd: finite(payload.cost) ?? finite(task?.cost), status_code: finite(task?.status_code) ?? finite(payload.status_code) };
    if (payload.status_code !== 20000 || task?.status_code !== 20000) {
      // Do not echo untrusted provider messages: they can include request details.
      return { ...receipt, status: task ? "provider_error" : "unknown", error: `Provider status ${receipt.status_code ?? "missing"}; data unavailable.` };
    }
    const result = rows(task.result)[0];
    if (!result) return { ...receipt, error: "Provider returned no result; not a measured zero." };
    if (request.body.target && result.target !== request.body.target) return { ...receipt, status: "provider_error", error: "Provider target did not match the requested domain." };
    if (record(request.body.targets) && (!record(result.targets) ||
        Object.keys(request.body.targets).length !== Object.keys(result.targets).length ||
        Object.entries(request.body.targets).some(([key, target]) => (result.targets as DataRow)[key] !== target))) {
      return { ...receipt, status: "provider_error", error: "Provider comparison targets did not match the requested competitors." };
    }
    const required = request.endpoint === "summary" ? ["backlinks", "referring_domains"] : ["items_count"];
    if (required.some(key => finite(result[key]) === null) ||
        (request.endpoint !== "summary" && result.items_count !== rows(result.items).length)) {
      return { ...receipt, status: "provider_error", error: "Provider result is missing required metrics or rows; not a measured zero." };
    }
    // Pagination tokens are not needed for these deliberately bounded snapshots.
    const { search_after_token: _token, ...safeResult } = result;
    return { ...receipt, status: "complete", result: safeResult };
  } catch {
    return { ...base, error: "Provider request timed out or could not be decoded; charge is unknown. Not automatically retried." };
  }
}

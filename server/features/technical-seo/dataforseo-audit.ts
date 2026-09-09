import type { TechnicalSeoAuditContext, TechnicalSeoLocalResult } from "@shared/technicalSeo";

const API = "https://api.dataforseo.com/v3";
function empty(status: "not_assessed" | "provider_error", reason: string): TechnicalSeoLocalResult { return { status, reason, organicRank: null, mapRank: null, competitors: [], receipt: { provider: "DataForSEO", paidRequests: 0, keywords: [] } }; }
function auth() { return `Basic ${Buffer.from(`${process.env.DATAFORSEO_API_LOGIN}:${process.env.DATAFORSEO_API_PASSWORD}`).toString("base64")}`; }
async function post(path: string, task: Record<string, unknown>, signal?: AbortSignal) {
  const response = await fetch(`${API}${path}`, { method: "POST", headers: { authorization: auth(), "content-type": "application/json" }, body: JSON.stringify([task]), signal });
  if (!response.ok) throw new Error(`Local search provider returned HTTP ${response.status}`);
  const payload: any = await response.json();
  const apiError = payload?.tasks?.[0]?.status_code !== 20000 ? payload?.tasks?.[0]?.status_message : null;
  if (apiError) throw new Error(`Local search provider: ${apiError}`);
  return payload?.tasks?.[0]?.result?.[0];
}
function domain(value: string | null | undefined) { try { return new URL(value ?? "").hostname.replace(/^www\./, ""); } catch { return null; } }

export async function runLocalSearchAudit(siteUrl: string, context: TechnicalSeoAuditContext, signal?: AbortSignal): Promise<TechnicalSeoLocalResult> {
  if (!process.env.DATAFORSEO_API_LOGIN || !process.env.DATAFORSEO_API_PASSWORD) return empty("not_assessed", "Local search credentials are not configured on the scanner worker.");
  if (!context.businessName || !context.trade || !context.city || !context.state) return empty("not_assessed", "Business name, trade, city, and state are required for local search checks.");
  const locationName = `${context.city},${context.state},United States`;
  const query = `${context.trade} ${context.city} ${context.state}`;
  const targetDomain = domain(siteUrl);
  try {
    const [business, organic, maps] = await Promise.all([
      post("/business_data/google/my_business_info/live", { keyword: context.businessName, location_name: locationName, language_code: "en" }, signal),
      post("/serp/google/organic/live/advanced", { keyword: query, location_name: locationName, language_code: "en", device: "mobile", depth: 10 }, signal),
      post("/serp/google/maps/live/advanced", { keyword: query, location_name: locationName, language_code: "en", device: "mobile", depth: 10, search_places: false }, signal),
    ]);
    const businessItem = business?.items?.[0] ?? business;
    const organicItems = (organic?.items ?? []).filter((item: any) => item.type === "organic");
    const mapItems = (maps?.items ?? maps?.results ?? []).filter((item: any) => item.type === "maps_search" || item.type === "map" || item.title);
    const matchesDomain = (item: any) => [item.domain, domain(item.url), domain(item.website)].filter(Boolean).includes(targetDomain);
    const nameMatch = (item: any) => String(item.title ?? item.name ?? "").toLowerCase().includes(context.businessName.toLowerCase());
    const organicRank = organicItems.find((item: any) => matchesDomain(item))?.rank_group ?? null;
    const mapRank = mapItems.find((item: any) => matchesDomain(item) || nameMatch(item))?.rank_group ?? null;
    const competitors = [
      ...organicItems.filter((item: any) => !matchesDomain(item)).slice(0, 3).map((item: any) => ({ name: item.title ?? item.domain ?? "Competitor", domain: item.domain ?? domain(item.url), rank: item.rank_group ?? item.rank_absolute ?? 0, source: "organic" as const })),
      ...mapItems.filter((item: any) => !(matchesDomain(item) || nameMatch(item))).slice(0, 3).map((item: any) => ({ name: item.title ?? item.name ?? "Competitor", domain: domain(item.website ?? item.url), rank: item.rank_group ?? item.rank_absolute ?? 0, source: "maps" as const, rating: item.rating?.value ?? item.rating ?? null, reviewCount: item.rating?.votes_count ?? item.reviews_count ?? null })),
    ];
    return {
      status: "measured", query,
      profile: businessItem ? { title: businessItem.title ?? null, address: businessItem.address ?? null, phone: businessItem.phone ?? null, website: businessItem.url ?? businessItem.website ?? null, category: businessItem.category ?? null, additionalCategories: businessItem.additional_categories ?? [], rating: businessItem.rating?.value ?? businessItem.rating ?? null, reviewCount: businessItem.rating?.votes_count ?? businessItem.reviews_count ?? null, claimed: businessItem.is_claimed ?? businessItem.claimed ?? null, services: (businessItem.services ?? []).map((value: any) => typeof value === "string" ? value : value.title).filter(Boolean), hoursPresent: businessItem.work_hours ? true : null } : undefined,
      organicRank, mapRank, competitors, receipt: { provider: "DataForSEO", paidRequests: 3, keywords: [context.businessName, query] },
    };
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    const result = empty("provider_error", error instanceof Error ? error.message : "Local search request failed");
    result.receipt = { provider: "DataForSEO", paidRequests: 3, keywords: [context.businessName, query] };
    return result;
  }
}

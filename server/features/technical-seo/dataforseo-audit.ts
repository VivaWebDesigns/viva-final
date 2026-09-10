import type { TechnicalSeoAuditContext, TechnicalSeoLocalResult } from "@shared/technicalSeo";

const API = "https://api.dataforseo.com/v3";
const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};
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

function isGoogleBusinessHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "maps.app.goo.gl" || host === "goo.gl" || host === "g.page" || host === "share.google" || host === "google.com" || host.endsWith(".google.com");
}

export function extractGoogleBusinessIdentifier(value: string): string | null {
  try {
    const url = new URL(value);
    if (!isGoogleBusinessHost(url.hostname)) return null;
    for (const key of ["cid", "ludocid"]) {
      const candidate = url.searchParams.get(key)?.trim();
      if (candidate && /^\d+$/.test(candidate)) return `cid:${candidate}`;
    }
    for (const key of ["place_id", "query_place_id"]) {
      const candidate = url.searchParams.get(key)?.trim();
      if (candidate && /^[A-Za-z0-9_-]+$/.test(candidate)) return `place_id:${candidate}`;
    }
    const decoded = decodeURIComponent(url.href);
    const placeId = decoded.match(/(?:place_id:|!1s)(ChI[A-Za-z0-9_-]+)/i)?.[1];
    if (placeId) return `place_id:${placeId}`;
    const hexCid = decoded.match(/0x[0-9a-f]+:0x([0-9a-f]+)/i)?.[1];
    if (hexCid) return `cid:${BigInt(`0x${hexCid}`).toString(10)}`;
    return null;
  } catch {
    return null;
  }
}

async function googleBusinessLookup(context: TechnicalSeoAuditContext, signal?: AbortSignal) {
  const suppliedUrl = context.googleBusinessUrl?.trim();
  if (!suppliedUrl) return { keyword: context.businessName, method: "name_location" as const };
  try {
    let current = new URL(suppliedUrl);
    if (!isGoogleBusinessHost(current.hostname)) return { keyword: context.businessName, method: "name_location" as const };
    for (let redirect = 0; redirect < 5; redirect += 1) {
      const identifier = extractGoogleBusinessIdentifier(current.toString());
      if (identifier) return { keyword: identifier, method: "google_business_url" as const };
      if (!["maps.app.goo.gl", "goo.gl", "g.page", "share.google"].includes(current.hostname.toLowerCase())) break;
      const response = await fetch(current, { method: "HEAD", redirect: "manual", signal });
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => undefined);
      if (!location) break;
      current = new URL(location, current);
      if (!isGoogleBusinessHost(current.hostname)) break;
    }
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
  }
  return { keyword: context.businessName, method: "name_location" as const };
}

export async function runLocalSearchAudit(siteUrl: string, context: TechnicalSeoAuditContext, signal?: AbortSignal): Promise<TechnicalSeoLocalResult> {
  if (!process.env.DATAFORSEO_API_LOGIN || !process.env.DATAFORSEO_API_PASSWORD) return empty("not_assessed", "Local search credentials are not configured on the scanner worker.");
  if (!context.businessName || !context.trade || !context.city || !context.state) return empty("not_assessed", "Business name, trade, city, and state are required for local search checks.");
  const stateName = US_STATES[context.state.trim().toUpperCase()] ?? context.state.trim();
  const locationName = `${context.city},${stateName},United States`;
  const query = `${context.trade} ${context.city} ${context.state}`;
  const targetDomain = domain(siteUrl);
  try {
    const suppliedLookup = await googleBusinessLookup(context, signal);
    const organicResult = await Promise.allSettled([
      post("/serp/google/organic/live/advanced", { keyword: query, location_name: locationName, language_code: "en", device: "mobile", depth: 10 }, signal),
    ]).then(([result]) => result);
    if (signal?.aborted) throw signal.reason;
    const organic = organicResult.status === "fulfilled" ? organicResult.value : null;
    const allOrganicItems = organic?.items ?? [];
    const normalizedBusinessName = context.businessName.trim().toLowerCase();
    const localPackCandidate = allOrganicItems.find((item: any) => item.type === "local_pack" && (
      [item.domain, domain(item.url), domain(item.website)].filter(Boolean).includes(targetDomain)
      || String(item.title ?? item.name ?? "").trim().toLowerCase() === normalizedBusinessName
    ));
    const lookup = suppliedLookup.method === "name_location" && localPackCandidate?.cid
      ? { keyword: `cid:${localPackCandidate.cid}`, method: "search_result_identity" as const }
      : suppliedLookup;
    const [businessResult, mapsResult] = await Promise.allSettled([
      post("/business_data/google/my_business_info/live", { keyword: lookup.keyword, location_name: locationName, language_code: "en" }, signal),
      post("/serp/google/maps/live/advanced", { keyword: query, location_name: locationName, language_code: "en", device: "mobile", depth: 10, search_places: false }, signal),
    ]);
    if (signal?.aborted) throw signal.reason;
    const business = businessResult.status === "fulfilled" ? businessResult.value : null;
    const maps = mapsResult.status === "fulfilled" ? mapsResult.value : null;
    const businessItem = business?.items?.[0] ?? business ?? localPackCandidate;
    const organicItems = allOrganicItems.filter((item: any) => item.type === "organic");
    const mapItems = (maps?.items ?? maps?.results ?? []).filter((item: any) => item.type === "maps_search" || item.type === "map" || item.title);
    const matchesDomain = (item: any) => [item.domain, domain(item.url), domain(item.website)].filter(Boolean).includes(targetDomain);
    const nameMatch = (item: any) => String(item.title ?? item.name ?? "").toLowerCase().includes(context.businessName.toLowerCase());
    const organicRank = organicItems.find((item: any) => matchesDomain(item))?.rank_group ?? null;
    const mapRank = mapItems.find((item: any) => matchesDomain(item) || nameMatch(item))?.rank_group ?? null;
    const competitors = [
      ...organicItems.filter((item: any) => !matchesDomain(item)).slice(0, 3).map((item: any) => ({ name: item.title ?? item.domain ?? "Competitor", domain: item.domain ?? domain(item.url), rank: item.rank_group ?? item.rank_absolute ?? 0, source: "organic" as const })),
      ...mapItems.filter((item: any) => !(matchesDomain(item) || nameMatch(item))).slice(0, 3).map((item: any) => ({ name: item.title ?? item.name ?? "Competitor", domain: domain(item.website ?? item.url), rank: item.rank_group ?? item.rank_absolute ?? 0, source: "maps" as const, rating: item.rating?.value ?? item.rating ?? null, reviewCount: item.rating?.votes_count ?? item.reviews_count ?? null })),
    ];
    const failureMessage = (result: PromiseSettledResult<unknown>) => result.status === "rejected" ? (result.reason instanceof Error ? result.reason.message : "Provider request failed") : null;
    const profileReason = businessResult.status === "rejected" && !localPackCandidate ? failureMessage(businessResult) : null;
    const rankingReasons = [failureMessage(organicResult), failureMessage(mapsResult)].filter(Boolean);
    const profileStatus = businessResult.status === "fulfilled" || localPackCandidate ? "measured" as const : "provider_error" as const;
    const rankingsStatus = organicResult.status === "fulfilled" && mapsResult.status === "fulfilled" ? "measured" as const : "provider_error" as const;
    return {
      status: profileStatus === "measured" || rankingsStatus === "measured" ? "measured" : "provider_error",
      reason: [...(profileReason ? [`Business Profile: ${profileReason}`] : []), ...rankingReasons.map((reason) => `Rankings: ${reason}`)].join(" ") || undefined,
      profileStatus, profileReason: profileReason ?? undefined, profileMatchMethod: lookup.method,
      rankingsStatus, rankingsReason: rankingReasons.join(" ") || undefined, query,
      profile: businessItem ? { title: businessItem.title ?? null, address: businessItem.address ?? null, phone: businessItem.phone ?? null, website: businessItem.url ?? businessItem.website ?? null, category: businessItem.category ?? null, additionalCategories: businessItem.additional_categories ?? [], rating: businessItem.rating?.value ?? businessItem.rating ?? null, reviewCount: businessItem.rating?.votes_count ?? businessItem.reviews_count ?? null, claimed: businessItem.is_claimed ?? businessItem.claimed ?? null, services: (businessItem.services ?? []).map((value: any) => typeof value === "string" ? value : value.title).filter(Boolean), hoursPresent: businessItem.work_hours ? true : null } : undefined,
      organicRank, mapRank, competitors, receipt: { provider: "DataForSEO", paidRequests: 3, keywords: [lookup.keyword, query] },
    };
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    const result = empty("provider_error", error instanceof Error ? error.message : "Local search request failed");
    result.receipt = { provider: "DataForSEO", paidRequests: 3, keywords: [context.businessName, query] };
    return result;
  }
}

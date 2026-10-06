const API = "https://api.dataforseo.com/v3/keywords_data/google_ads";
const TIMEOUT_MS = 120_000;
// Google Ads limits: 1,000 keywords per search-volume task and 20 seeds per keyword-ideas task.
const VOLUME_BATCH = 1000;
const IDEAS_SEED_BATCH = 20;

export interface KeywordMetrics {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: string | null;
  competitionIndex: number | null;
  lowTopOfPageBid: number | null;
  highTopOfPageBid: number | null;
}

interface GoogleAdsKeywordRow {
  keyword: string;
  search_volume: number | null;
  cpc: number | null;
  competition: string | null;
  competition_index: number | null;
  low_top_of_page_bid: number | null;
  high_top_of_page_bid: number | null;
}

export class KeywordDataError extends Error {}

function authHeader() {
  const login = process.env.DATAFORSEO_API_LOGIN?.trim();
  const password = process.env.DATAFORSEO_API_PASSWORD?.trim();
  if (!login || !password) throw new KeywordDataError("DATAFORSEO_API_LOGIN and DATAFORSEO_API_PASSWORD are not configured.");
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

async function postTask(endpoint: string, task: Record<string, unknown>) {
  const response = await fetch(`${API}/${endpoint}/live`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify([task]),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new KeywordDataError(`DataForSEO returned HTTP ${response.status}.`);
  const body = await response.json() as { status_message?: string; tasks?: Array<{ status_code: number; status_message: string; cost?: number; result?: GoogleAdsKeywordRow[] | null }> };
  const result = body.tasks?.[0];
  if (!result || result.status_code !== 20000) throw new KeywordDataError(`DataForSEO: ${result?.status_message ?? body.status_message ?? "unknown error"}`);
  return { rows: result.result ?? [], cost: result.cost ?? 0 };
}

function toMetrics(row: GoogleAdsKeywordRow): KeywordMetrics {
  return {
    keyword: row.keyword,
    searchVolume: row.search_volume ?? null,
    cpc: row.cpc ?? null,
    competition: row.competition ?? null,
    competitionIndex: row.competition_index ?? null,
    lowTopOfPageBid: row.low_top_of_page_bid ?? null,
    highTopOfPageBid: row.high_top_of_page_bid ?? null,
  };
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

/** Keyword Planner "Get search volume" for an exact list of keywords. */
export async function fetchSearchVolume(keywords: string[], locationName: string) {
  let cost = 0;
  const metrics: KeywordMetrics[] = [];
  for (const batch of chunk(keywords, VOLUME_BATCH)) {
    const result = await postTask("search_volume", { keywords: batch, location_name: locationName, language_code: "en" });
    cost += result.cost;
    metrics.push(...result.rows.map(toMetrics));
  }
  return { metrics, cost };
}

/** Keyword Planner "Discover new keywords" from seed terms. */
export async function fetchKeywordIdeas(seeds: string[], locationName: string) {
  let cost = 0;
  const metrics: KeywordMetrics[] = [];
  for (const batch of chunk(seeds, IDEAS_SEED_BATCH)) {
    const result = await postTask("keywords_for_keywords", { keywords: batch, location_name: locationName, language_code: "en", sort_by: "search_volume" });
    cost += result.cost;
    metrics.push(...result.rows.map(toMetrics));
  }
  return { metrics, cost };
}

export type SearchAreaType = "City" | "County" | "DMA Region" | "State";
export interface SearchArea {
  name: string;
  type: SearchAreaType;
}

const AREA_TYPES = new Set<string>(["City", "County", "DMA Region", "State"]);
const LOCATIONS_TTL_MS = 24 * 60 * 60 * 1000;
let locationsCache: { loadedAt: number; areas: Promise<SearchArea[]> } | null = null;

/** US places Google Ads can target, from DataForSEO's free locations list, cached for a day. */
export function searchAreas(): Promise<SearchArea[]> {
  if (locationsCache && Date.now() - locationsCache.loadedAt < LOCATIONS_TTL_MS) return locationsCache.areas;
  const areas = (async () => {
    const response = await fetch("https://api.dataforseo.com/v3/keywords_data/google_ads/locations/us", {
      headers: { Authorization: authHeader() },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new KeywordDataError(`DataForSEO returned HTTP ${response.status}.`);
    const body = await response.json() as { tasks?: Array<{ status_code: number; status_message: string; result?: Array<{ location_name: string; location_type: string }> }> };
    const task = body.tasks?.[0];
    if (!task || task.status_code !== 20000) throw new KeywordDataError(`DataForSEO: ${task?.status_message ?? "could not load locations"}`);
    return (task.result ?? [])
      .filter(row => AREA_TYPES.has(row.location_type))
      .map(row => ({ name: row.location_name, type: row.location_type as SearchAreaType }));
  })();
  locationsCache = { loadedAt: Date.now(), areas };
  areas.catch(() => { locationsCache = null; });
  return areas;
}

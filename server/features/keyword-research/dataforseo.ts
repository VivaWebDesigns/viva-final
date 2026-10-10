const API = "https://api.dataforseo.com/v3/keywords_data/google_ads";
const LABS_API = "https://api.dataforseo.com/v3/dataforseo_labs/google";
const TIMEOUT_MS = 120_000;
// Google Ads limits: 1,000 keywords per search-volume task and 20 seeds per keyword-ideas task.
const VOLUME_BATCH = 1000;
const IDEAS_SEED_BATCH = 20;
// DataForSEO Labs takes up to 1,000 keywords per difficulty or search intent task.
const DIFFICULTY_BATCH = 1000;

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

async function postTask<Row = GoogleAdsKeywordRow>(endpoint: string, task: Record<string, unknown>, base = API) {
  const response = await fetch(`${base}/${endpoint}/live`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify([task]),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new KeywordDataError(`DataForSEO returned HTTP ${response.status}.`);
  const body = await response.json() as { status_message?: string; tasks?: Array<{ status_code: number; status_message: string; cost?: number; result?: Row[] | null }> };
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

/**
 * DataForSEO's 0–100 organic ranking difficulty, scored from the backlinks of the US top 10.
 * Keywords it has no score for are missing from the map.
 */
export async function fetchKeywordDifficulty(keywords: string[]) {
  let cost = 0;
  const difficulty = new Map<string, number>();
  for (const batch of chunk(keywords, DIFFICULTY_BATCH)) {
    const result = await postTask<{ items?: Array<{ keyword: string; keyword_difficulty: number | null }> | null }>(
      "bulk_keyword_difficulty", { keywords: batch, location_code: 2840, language_code: "en" }, LABS_API,
    );
    cost += result.cost;
    const rows = result.rows[0]?.items ?? [];
    for (const row of rows) if (row.keyword_difficulty != null) difficulty.set(row.keyword, row.keyword_difficulty);
  }
  return { difficulty, cost };
}

export type SearchIntentLabel = "informational" | "navigational" | "commercial" | "transactional";

/** Google's main search intent for each keyword, from DataForSEO Labs. Keywords without a label are missing from the map. */
export async function fetchSearchIntent(keywords: string[]) {
  let cost = 0;
  const intent = new Map<string, SearchIntentLabel>();
  for (const batch of chunk(keywords, DIFFICULTY_BATCH)) {
    const result = await postTask<{ items?: Array<{ keyword: string; keyword_intent?: { label: SearchIntentLabel } | null }> | null }>(
      "search_intent", { keywords: batch, language_code: "en" }, LABS_API,
    );
    cost += result.cost;
    for (const row of result.rows[0]?.items ?? []) if (row.keyword_intent?.label) intent.set(row.keyword, row.keyword_intent.label);
  }
  return { intent, cost };
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

const API = "https://api.dataforseo.com/v3/keywords_data/google_ads";
const LABS_API = "https://api.dataforseo.com/v3/dataforseo_labs/google";
const SERP_API = "https://api.dataforseo.com/v3/serp/google/organic";
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
  monthly_searches?: Array<{ year: number; month: number; search_volume: number | null }> | null;
}

export class KeywordDataError extends Error {}

function authHeader() {
  const login = process.env.DATAFORSEO_API_LOGIN?.trim();
  const password = process.env.DATAFORSEO_API_PASSWORD?.trim();
  if (!login || !password) throw new KeywordDataError("DATAFORSEO_API_LOGIN and DATAFORSEO_API_PASSWORD are not configured.");
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

async function postTask<Row = GoogleAdsKeywordRow>(endpoint: string, task: Record<string, unknown>, base = API) {
  return postLive<Row>(`${base}/${endpoint}/live`, task);
}

async function postLive<Row>(url: string, task: Record<string, unknown>) {
  const response = await fetch(url, {
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

export interface MonthlySearches {
  year: number;
  month: number;
  volume: number;
}

/** Monthly searches for the last 2 years, so this year can be compared with the same months last year. */
export async function fetchSearchHistory(keywords: string[], locationName: string) {
  let cost = 0;
  const history = new Map<string, MonthlySearches[]>();
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCMonth(start.getUTCMonth() - 24);
  for (const batch of chunk(keywords, VOLUME_BATCH)) {
    const result = await postTask("search_volume", { keywords: batch, location_name: locationName, language_code: "en", date_from: start.toISOString().slice(0, 10) });
    cost += result.cost;
    for (const row of result.rows) {
      const months = (row.monthly_searches ?? []).filter(month => month.search_volume != null)
        .map(month => ({ year: month.year, month: month.month, volume: month.search_volume! }));
      if (months.length) history.set(row.keyword, months);
    }
  }
  return { history, cost };
}

export interface RankedKeyword {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  position: number;
  url: string;
}

type RankedItem = {
  keyword_data: { keyword: string; keyword_info?: { search_volume?: number | null; cpc?: number | null } | null };
  ranked_serp_element: { serp_item: { rank_group: number; url?: string | null } };
};

/**
 * Everything a domain ranks for in the US top 30. Two pulls: by volume, and pages other than the blog by CPC,
 * because sorting by volume alone buries the low-volume, high-CPC money keywords.
 */
export async function fetchRankedKeywords(domain: string) {
  const base = { target: domain, location_code: 2840, language_code: "en", limit: 700 };
  const top30 = ["ranked_serp_element.serp_item.rank_group", "<=", 30];
  const [byVolume, byCpc] = await Promise.all([
    postTask<{ items?: RankedItem[] | null }>("ranked_keywords", { ...base, filters: top30, order_by: ["keyword_data.keyword_info.search_volume,desc"] }, LABS_API),
    postTask<{ items?: RankedItem[] | null }>("ranked_keywords", {
      ...base, limit: 300,
      filters: [top30, "and", ["ranked_serp_element.serp_item.relative_url", "not_like", "%/blog/%"]],
      order_by: ["keyword_data.keyword_info.cpc,desc"],
    }, LABS_API),
  ]);
  const rows = new Map<string, RankedKeyword>();
  for (const item of [...(byVolume.rows[0]?.items ?? []), ...(byCpc.rows[0]?.items ?? [])]) {
    const keyword = item.keyword_data.keyword;
    const position = item.ranked_serp_element.serp_item.rank_group;
    if (rows.has(keyword) && rows.get(keyword)!.position <= position) continue;
    rows.set(keyword, {
      keyword,
      searchVolume: item.keyword_data.keyword_info?.search_volume ?? null,
      cpc: item.keyword_data.keyword_info?.cpc ?? null,
      position,
      url: item.ranked_serp_element.serp_item.url ?? "",
    });
  }
  return { rows: [...rows.values()], cost: byVolume.cost + byCpc.cost };
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

export interface SerpResult {
  keyword: string;
  locationName: string;
  organic: Array<{ position: number; domain: string; title: string | null }>;
  localPack: Array<{ title: string; domain: string | null; rating: number | null; reviews: number | null }>;
}

interface SerpItem {
  type: string;
  rank_group: number;
  domain?: string | null;
  title?: string | null;
  rating?: { value?: number | null; votes_count?: number | null } | null;
}

function bareDomain(domain: string) {
  return domain.toLowerCase().replace(/^www\./, "");
}

/** Google's first two pages for a keyword as seen from one place: organic results and the map pack. */
export async function fetchSerp(keyword: string, locationName: string) {
  const result = await postLive<{ items?: SerpItem[] | null }>(`${SERP_API}/live/advanced`, { keyword, location_name: locationName, language_code: "en", depth: 20 });
  const items = result.rows[0]?.items ?? [];
  const serp: SerpResult = {
    keyword,
    locationName,
    organic: items.filter(item => item.type === "organic" && item.domain)
      .map(item => ({ position: item.rank_group, domain: bareDomain(item.domain!), title: item.title ?? null })),
    localPack: items.filter(item => item.type === "local_pack" && item.title)
      .map(item => ({ title: item.title!, domain: item.domain ? bareDomain(item.domain) : null, rating: item.rating?.value ?? null, reviews: item.rating?.votes_count ?? null })),
  };
  return { serp, cost: result.cost };
}

/** Domains that win a set of keywords across the US, from DataForSEO Labs. */
export async function fetchSerpCompetitors(keywords: string[]) {
  const result = await postTask<{ items?: Array<{ domain: string; keywords_count?: number | null }> | null }>(
    "serp_competitors", { keywords: keywords.slice(0, 200), location_code: 2840, language_code: "en", limit: 40, item_types: ["organic"] }, LABS_API,
  );
  return {
    domains: (result.rows[0]?.items ?? []).map(item => ({ domain: bareDomain(item.domain), keywords: item.keywords_count ?? 0 })),
    cost: result.cost,
  };
}

export interface DomainStrength {
  organicKeywords: number;
  top10Keywords: number;
  trafficValue: number;
}

/** A domain's US organic footprint: keywords ranked, top-10 keywords and estimated monthly traffic value. */
export async function fetchDomainStrength(domain: string) {
  const result = await postTask<{ items?: Array<{ metrics?: { organic?: Record<string, number | undefined> } }> | null }>(
    "domain_rank_overview", { target: domain, location_code: 2840, language_code: "en" }, LABS_API,
  );
  const organic = result.rows[0]?.items?.[0]?.metrics?.organic ?? {};
  const top10 = (organic.pos_1 ?? 0) + (organic.pos_2_3 ?? 0) + (organic.pos_4_10 ?? 0);
  const strength: DomainStrength = { organicKeywords: organic.count ?? 0, top10Keywords: top10, trafficValue: Math.round(organic.estimated_paid_traffic_cost ?? 0) };
  return { strength, cost: result.cost };
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

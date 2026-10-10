import type { CompetitorProfile } from "@shared/keywordResearch";
import type { MonthlySearches, RankedKeyword } from "./dataforseo";
import { cleanKeyword } from "./keywords";
import { headTerm } from "./quality";

const STATES: Array<[string, string]> = [
  ["al", "alabama"], ["ak", "alaska"], ["az", "arizona"], ["ar", "arkansas"], ["ca", "california"], ["co", "colorado"],
  ["ct", "connecticut"], ["de", "delaware"], ["dc", "district of columbia"], ["fl", "florida"], ["ga", "georgia"], ["hi", "hawaii"],
  ["id", "idaho"], ["il", "illinois"], ["in", "indiana"], ["ia", "iowa"], ["ks", "kansas"], ["ky", "kentucky"], ["la", "louisiana"],
  ["me", "maine"], ["md", "maryland"], ["ma", "massachusetts"], ["mi", "michigan"], ["mn", "minnesota"], ["ms", "mississippi"],
  ["mo", "missouri"], ["mt", "montana"], ["ne", "nebraska"], ["nv", "nevada"], ["nh", "new hampshire"], ["nj", "new jersey"],
  ["nm", "new mexico"], ["ny", "new york"], ["nc", "north carolina"], ["nd", "north dakota"], ["oh", "ohio"], ["ok", "oklahoma"],
  ["or", "oregon"], ["pa", "pennsylvania"], ["ri", "rhode island"], ["sc", "south carolina"], ["sd", "south dakota"],
  ["tn", "tennessee"], ["tx", "texas"], ["ut", "utah"], ["vt", "vermont"], ["va", "virginia"], ["wa", "washington"],
  ["wv", "west virginia"], ["wi", "wisconsin"], ["wy", "wyoming"],
];
const BLOG_PATH = /\/(blog|blogs|news|articles?|learn|resources|guides?|educational-blog|question|topics)\//i;

const WORD_CODES = new Set(["in", "me", "or", "ok", "hi", "oh", "la", "pa", "ma", "co", "de", "id", "al"]);

// One-word town names that are also everyday words or trade brands. Without a state after them they stay words.
const WORD_TOWNS = new Set([
  "between", "wall", "home", "price", "best", "interior", "wood", "door", "window", "screen", "energy", "star", "union", "liberty",
  "commerce", "industry", "garden", "park", "lake", "river", "spring", "springs", "valley", "hill", "hills", "beach", "bay", "harbor",
  "mountain", "ridge", "grove", "forest", "falls", "city", "center", "village", "heights", "plains", "rock", "stone", "brick", "metal",
  "steel", "cedar", "pine", "oak", "maple", "elm", "rose", "golden", "silver", "diamond", "crystal", "pearl", "marble", "granite",
  "clay", "sand", "salt", "iron", "copper", "gold", "central", "north", "south", "east", "west", "mission", "paradise", "canyon",
  "prairie", "meadow", "orchard", "shower", "kitchen", "floor", "roof", "fence", "deck", "patio", "pool", "solar", "electric", "power",
  "water", "heat", "comfort", "quality", "premier", "modern", "classic", "royal", "national", "general", "universal", "enterprise",
  "progress", "hope", "grace", "ideal", "normal", "plain", "custom", "clear", "frost", "snow", "rain", "storm", "sunshine", "commercial",
  "pella", "andersen", "marvin", "milgard", "kohler", "carrier", "lennox", "trane", "rheem", "york", "ruud", "goodman", "american",
  "standard", "bryant", "amana", "moen", "delta", "jeld", "simonton", "harvey", "provia",
]);

export interface PlaceIndex {
  places: Set<string>;
  stateNames: Set<string>;
  codes: Set<string>;
  /** The client's own cities: always stripped, with or without a state after them. */
  ownPlaces: Set<string>;
  protectedWords: Set<string>;
}

/**
 * The place names to strip from keywords: Google's US city names, every state, and the client's own cities.
 * Words from the client's services and trade are protected, so a town called "Glass" never eats a keyword.
 */
export function placeIndex(cityLocationNames: string[], protectedPhrases: string[], ownCities: string[] = []): PlaceIndex {
  const protectedWords = new Set(protectedPhrases.flatMap(phrase => cleanKeyword(phrase).split(" ")).filter(Boolean));
  const places = new Set<string>();
  for (const name of cityLocationNames) {
    const city = cleanKeyword(name.split(",")[0] ?? "");
    if (city && !city.split(" ").every(word => protectedWords.has(word))) places.add(city);
  }
  const stateNames = new Set(STATES.map(([, state]) => state));
  return {
    places, stateNames, codes: new Set(STATES.map(([code]) => code)),
    ownPlaces: new Set(ownCities.map(cleanKeyword).filter(Boolean)), protectedWords,
  };
}

function slugWords(url: string) {
  try {
    return ` ${decodeURIComponent(new URL(url).pathname).toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  } catch {
    return " ";
  }
}

/**
 * "window repair rockville md" → "window repair". Thousands of US towns share a name with an everyday word or
 * brand (Home PA, Pella IA, Price UT), so a town name is only stripped with evidence: a state right after it, a
 * ranking page about that place (Argo's /illinois/window-repair-chicago/), ending the keyword after "in" or "near",
 * or being one of the client's own cities.
 * Full state names are stripped anywhere. `hadPlace` marks keywords a competitor wins with city pages.
 */
export function localize(keyword: string, index: PlaceIndex, rankingUrl = ""): { head: string; hadPlace: boolean } {
  const words = headTerm(keyword).split(" ").filter(Boolean);
  // Blog slugs name topics, not places ("mold-between-window-panes").
  const slug = BLOG_PATH.test(rankingUrl) ? " " : slugWords(rankingUrl);
  const kept: string[] = [];
  let hadPlace = false;
  let position = 0;
  const stateAt = (at: number) => {
    for (let size = 3; size >= 1; size -= 1) {
      const phrase = words.slice(at, at + size).join(" ");
      if (words.length >= at + size && index.stateNames.has(phrase)) return size;
    }
    const code = words[at] ?? "";
    // "in", "me", "or" are words first: as a state they only end a keyword ("window repair evansville in").
    return index.codes.has(code) && (!WORD_CODES.has(code) || at === words.length - 1) ? 1 : 0;
  };
  while (position < words.length) {
    let span = 0;
    for (let size = Math.min(3, words.length - position); size >= 1 && !span; size -= 1) {
      const phrase = words.slice(position, position + size);
      if (phrase.some(word => index.protectedWords.has(word))) continue;
      const name = phrase.join(" ");
      if (!index.places.has(name) && !index.ownPlaces.has(name)) continue;
      const stateAfter = stateAt(position + size);
      const plainName = size > 1 || !WORD_TOWNS.has(name);
      const pageAboutPlace = slug.includes(` ${name} `) && plainName;
      // "glass companies in raleigh": a town ending the keyword after "in" or "near".
      const endsAfterIn = plainName && position + size === words.length && ["in", "near"].includes(words[position - 1] ?? "");
      if (index.ownPlaces.has(name) || stateAfter || pageAboutPlace || endsAfterIn) span = size + stateAfter;
    }
    if (!span) {
      for (let size = 3; size >= 1 && !span; size -= 1) {
        if (index.stateNames.has(words.slice(position, position + size).join(" "))) span = size;
      }
    }
    if (span) {
      hadPlace = true;
      position += span;
      continue;
    }
    kept.push(words[position]);
    position += 1;
  }
  // "glass companies in" → "glass companies".
  while (kept.length && ["in", "near", "of", "around"].includes(kept[kept.length - 1])) kept.pop();
  return { head: kept.join(" "), hadPlace };
}

/**
 * Change in searches over the most recent 12 months that have the same month a year earlier, so seasons cancel
 * out. Null when there is too little history or too few searches for a change to mean anything.
 */
export function yearOverYear(months: MonthlySearches[]) {
  const byMonth = new Map(months.map(month => [month.year * 12 + month.month, month.volume]));
  const pairs = [...byMonth.keys()].sort((a, b) => b - a)
    .filter(key => byMonth.has(key - 12)).slice(0, 12)
    .map(key => [byMonth.get(key)!, byMonth.get(key - 12)!] as const);
  if (pairs.length < 6) return null;
  const recent = pairs.reduce((sum, [now]) => sum + now, 0);
  const before = pairs.reduce((sum, [, then]) => sum + then, 0);
  if (before / pairs.length < 20) return null;
  return Math.round((recent / before - 1) * 100) / 100;
}

export const RISING_TREND = 0.25;

/** How much a competitor ranks for, how many pages earn it, and how much of its search value sits on the blog. */
export function competitorProfile(domain: string, rows: RankedKeyword[]): CompetitorProfile {
  const value = (row: RankedKeyword) => (row.searchVolume ?? 0) * (row.cpc ?? 0);
  const total = rows.reduce((sum, row) => sum + value(row), 0);
  const blog = rows.filter(row => BLOG_PATH.test(row.url)).reduce((sum, row) => sum + value(row), 0);
  const folders = new Map<string, number>();
  for (const row of rows) {
    let folder = "/";
    try {
      const first = new URL(row.url).pathname.split("/").filter(Boolean)[0];
      if (first) folder = `/${first}`;
    } catch {
      // A row without a URL counts toward the homepage.
    }
    folders.set(folder, (folders.get(folder) ?? 0) + 1);
  }
  return {
    domain,
    keywords: rows.length,
    top10Keywords: rows.filter(row => row.position <= 10).length,
    pages: new Set(rows.map(row => row.url)).size,
    blogValueShare: total ? Math.round((blog / total) * 100) / 100 : 0,
    topFolders: [...folders].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([folder, keywords]) => ({ folder, keywords })),
  };
}

export interface CompetitorSearch {
  head: string;
  competitors: Array<{ domain: string; position: number }>;
  /** US searches and CPC of the competitor's best-volume phrasing, before localizing. */
  nationalVolume: number;
  cpc: number | null;
  /** True when the competitor wins it with a city-named phrase ("window repair rockville"). */
  hadPlace: boolean;
}

/** Every localized search the picked competitors rank for, with each competitor's best position for it. */
export function competitorSearches(ranked: Map<string, RankedKeyword[]>, index: PlaceIndex) {
  const searches = new Map<string, CompetitorSearch>();
  for (const [domain, rows] of ranked) {
    for (const row of rows) {
      const { head, hadPlace } = localize(row.keyword, index, row.url);
      if (head.split(" ").length < 1 || !head) continue;
      const search = searches.get(head) ?? { head, competitors: [], nationalVolume: 0, cpc: null, hadPlace: false };
      const existing = search.competitors.find(entry => entry.domain === domain);
      if (!existing) search.competitors.push({ domain, position: row.position });
      else existing.position = Math.min(existing.position, row.position);
      if ((row.searchVolume ?? 0) > search.nationalVolume) {
        search.nationalVolume = row.searchVolume ?? 0;
        search.cpc = row.cpc;
      }
      search.hadPlace ||= hadPlace;
      searches.set(head, search);
    }
  }
  for (const search of searches.values()) search.competitors.sort((a, b) => a.position - b.position);
  return searches;
}

import type { KeywordResearchKeyword, KeywordResearchSummary } from "@shared/keywordResearch";
import type { KeywordMetrics } from "./dataforseo";

const STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

// Searches from job seekers, DIYers and shoppers, which a service business site should not target.
const JUNK_PATTERN = /\b(jobs?|salary|salaries|careers?|hiring|apprentice(ship)?s?|schools?|courses?|classes|training|certifications?|licen[cs]e|licensing|union|diy|how to|youtube|reddit|home depot|lowes|lowe's|amazon|walmart|wholesale|supply store|tools?|parts store|meaning|definition|games?|lyrics)\b/;

// Words that describe how someone searches rather than what they need.
const NOISE_WORDS = new Set([
  "near", "me", "my", "in", "the", "a", "an", "for", "of", "to", "and", "or", "best", "top", "cheap", "affordable",
  "local", "company", "companies", "service", "services", "cost", "costs", "price", "prices", "pricing", "area",
]);

export function stateName(state: string) {
  const trimmed = state.trim();
  return STATES[trimmed.toUpperCase()] ?? trimmed;
}

/** DataForSEO location name, e.g. "Tampa,Florida,United States". */
export function locationNameFor(city: string, state: string) {
  return `${city.trim()},${stateName(state)},United States`;
}

/** Google Ads rejects most punctuation in keywords. */
export function cleanKeyword(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9' -]/g, " ").replace(/\s+/g, " ").trim();
}

function stem(word: string) {
  const singular = word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
  return singular.length > 5 ? singular.slice(0, 5) : singular;
}

function stems(text: string, extraNoise: Set<string> = new Set()) {
  return cleanKeyword(text).split(" ").filter(word => word && !NOISE_WORDS.has(word) && !extraNoise.has(word)).map(stem);
}

/** The exact phrases checked for every service: plain, with the city, and "near me". */
export function serviceVariants(service: string, city: string) {
  const name = cleanKeyword(service);
  const cityName = cleanKeyword(city);
  return [name, `${name} ${cityName}`, `${name} near me`];
}

export function serviceDemand(service: string, city: string, volumes: Map<string, KeywordMetrics>) {
  const found = serviceVariants(service, city).map(keyword => volumes.get(keyword)?.searchVolume).filter((volume): volume is number => volume != null);
  return found.length ? found.reduce((sum, volume) => sum + volume, 0) : null;
}

interface ServiceMatcher {
  name: string;
  stems: string[];
}

/**
 * Puts each keyword under the most specific selected service whose words it contains.
 * Keywords that only partly match stay as unsorted for review; unrelated or junk keywords are dropped.
 */
export function buildKeywordList(
  rows: KeywordMetrics[],
  input: { services: string[]; trade: string; city: string; state: string },
): { keywords: KeywordResearchKeyword[]; summary: KeywordResearchSummary } {
  const placeWords = new Set([...cleanKeyword(input.city).split(" "), ...cleanKeyword(stateName(input.state)).split(" "), cleanKeyword(input.state)]);
  const matchers: ServiceMatcher[] = input.services
    .map(name => ({ name, stems: [...new Set(stems(name, placeWords))] }))
    .filter(matcher => matcher.stems.length > 0);
  const tradeStems = new Set(stems(input.trade, placeWords));

  const merged = new Map<string, KeywordMetrics>();
  for (const row of rows) {
    const keyword = cleanKeyword(row.keyword);
    const existing = merged.get(keyword);
    // Prefer the row that carries a volume; exact-list rows come first in `rows`.
    if (!existing || (existing.searchVolume == null && row.searchVolume != null)) merged.set(keyword, { ...row, keyword });
  }

  const summary: KeywordResearchSummary = { ideasReturned: merged.size, keptKeywords: 0, droppedAsJunk: 0, droppedNoVolume: 0 };
  const keywords: KeywordResearchKeyword[] = [];
  for (const row of merged.values()) {
    if (!row.searchVolume) {
      summary.droppedNoVolume += 1;
      continue;
    }
    if (JUNK_PATTERN.test(row.keyword)) {
      summary.droppedAsJunk += 1;
      continue;
    }
    const keywordStems = new Set(stems(row.keyword));
    let best: ServiceMatcher | null = null;
    let bestOverlap = 0;
    for (const matcher of matchers) {
      const overlap = matcher.stems.filter(value => keywordStems.has(value)).length;
      if (overlap === matcher.stems.length && (!best || matcher.stems.length > best.stems.length)) best = matcher;
      bestOverlap = Math.max(bestOverlap, overlap);
    }
    const mentionsTrade = [...tradeStems].some(value => keywordStems.has(value));
    if (!best && !mentionsTrade && bestOverlap < 2) {
      summary.droppedAsJunk += 1;
      continue;
    }
    keywords.push({ ...row, service: best?.name ?? null });
  }

  keywords.sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0) || a.keyword.localeCompare(b.keyword));
  summary.keptKeywords = keywords.length;
  return { keywords, summary };
}

const AREA_ORDER: Record<string, number> = { "DMA Region": 0, County: 1, City: 2, State: 3 };

/** Search-area matches for the picker: names starting with the query first, metro areas and counties before cities. */
export function matchSearchAreas<T extends { name: string; type: string }>(areas: T[], query: string, limit = 20) {
  // Commas are ignored so "union county nc" and "union county, north carolina" both match.
  const flatten = (value: string) => value.toLowerCase().replace(/[,\s]+/g, " ").trim();
  const needle = flatten(query);
  if (needle.length < 2) return [];
  return areas
    .filter(area => flatten(area.name).includes(needle))
    .sort((a, b) => Number(!flatten(a.name).startsWith(needle)) - Number(!flatten(b.name).startsWith(needle))
      || (AREA_ORDER[a.type] ?? 9) - (AREA_ORDER[b.type] ?? 9)
      || a.name.length - b.name.length)
    .slice(0, limit);
}

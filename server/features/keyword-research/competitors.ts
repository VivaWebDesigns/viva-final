import {
  keywordDemand, keywordScore,
  type CompetitorSite, type CompetitorSiteLabel, type KeywordResearchKeyword, type MapPackBusiness, type RelevanceCheck,
} from "@shared/keywordResearch";
import type { DomainStrength, SerpResult } from "./dataforseo";

/** Large metros in different regions, searched to find contractors who win in many markets. */
export const NATIONAL_METROS = [
  "Dallas,Texas,United States", "Atlanta,Georgia,United States", "Phoenix,Arizona,United States", "Columbus,Ohio,United States",
];

/** Every confirmed service gets this many local searches; then the highest-value keywords fill the extra slots. */
export const LOCAL_PER_SERVICE = 1;
export const LOCAL_EXTRA = 10;
export const CONTENT_KEYWORD_COUNT = 15;
// Candidates per service sent to the relevance check, so a rejected keyword still leaves one to search.
const CANDIDATES_PER_SERVICE = 4;
const SHOWN = 5;
const PICKS_PER_SCOPE = 2;
const LOCAL_CANDIDATES = 15;
// Manufacturers and retailers crowd the national results and are only weeded out by labelling, so more slots are needed.
const NATIONAL_CANDIDATES = 15;
const CONTENT_CANDIDATES = 10;
const MAP_PACK_CANDIDATES = 10;

// Directories, lead sellers, platforms and publishers: never a competitor, never labelled (saves a Claude read).
const NOT_COMPETITORS = [
  "yelp.", "angi.com", "angieslist", "homeadvisor", "bbb.org", "thumbtack", "houzz", "porch.com", "homeguide", "networx", "modernize",
  "fixr.com", "bestprosintown", "expertise.com", "chamberofcommerce", "manta.com", "yellowpages", "mapquest", "nextdoor", "buildzoom",
  "thebluebook", "birdeye", "checkatrade", "care.com", "homedepot", "lowes.com", "amazon.", "walmart", "reddit.", "quora.", "youtube.",
  "facebook.", "instagram.", "pinterest.", "tiktok.", "linkedin.", "wikipedia.", "forbes.", "bobvila", "thisoldhouse", "thespruce",
  "google.", "apple.com", "indeed.", "glassdoor.", "ziprecruiter",
];

export function isNotCompetitor(domain: string) {
  return NOT_COMPETITORS.some(fragment => domain.includes(fragment));
}

function byScore(a: KeywordResearchKeyword, b: KeywordResearchKeyword) {
  return (keywordScore(b) ?? -1) - (keywordScore(a) ?? -1) || (keywordDemand(b) ?? 0) - (keywordDemand(a) ?? 0);
}

const isMoney = (row: KeywordResearchKeyword) => row.pageType === "service" || row.pageType === "city";
const isPlain = (row: KeywordResearchKeyword) => row.pageType === "service" && row.intent === "service";
const isContent = (row: KeywordResearchKeyword) => row.pageType === "blog" || row.pageType === "cost";

/** The keywords worth checking for relevance before discovery: the best few of each kind for every service, plus the overall best. */
export function discoveryCandidates(keywords: KeywordResearchKeyword[], services: string[]) {
  const ranked = [...keywords].sort(byScore);
  const picked = new Set<string>();
  for (const service of services) {
    const own = ranked.filter(row => row.service === service);
    for (const row of [...own.filter(isMoney).slice(0, CANDIDATES_PER_SERVICE), ...own.filter(isPlain).slice(0, CANDIDATES_PER_SERVICE), ...own.filter(isContent).slice(0, 2)]) picked.add(row.keyword);
  }
  for (const row of ranked.filter(isMoney).slice(0, LOCAL_EXTRA * 2)) picked.add(row.keyword);
  for (const row of ranked.filter(isContent).slice(0, CONTENT_KEYWORD_COUNT)) picked.add(row.keyword);
  return [...picked];
}

/**
 * The searches discovery runs, only from keywords Claude judged to be the client's work ("yes"), each tied to the
 * service it judged. Local: the best money keyword of every service, then the highest-value ones. National: the best
 * plain keyword of every service. Content: the best blog or cost keyword of every service, then the highest-value.
 */
export function discoveryKeywords(keywords: KeywordResearchKeyword[], services: string[], relevance: Map<string, RelevanceCheck>) {
  const ranked = [...keywords].sort(byScore);
  const serviceOf = new Map<string, string>();
  const ok = (row: KeywordResearchKeyword) => {
    const check = relevance.get(row.keyword);
    if (check?.verdict !== "yes" || !check.service) return false;
    serviceOf.set(row.keyword, check.service);
    return true;
  };
  const accepted = ranked.filter(ok);
  const bestOf = (service: string, kind: (row: KeywordResearchKeyword) => boolean, count: number) =>
    accepted.filter(row => serviceOf.get(row.keyword) === service && kind(row)).slice(0, count).map(row => row.keyword);
  const local = new Set(services.flatMap(service => bestOf(service, isMoney, LOCAL_PER_SERVICE)));
  for (const row of accepted.filter(isMoney).slice(0, LOCAL_EXTRA * 2)) {
    if (local.size >= services.length * LOCAL_PER_SERVICE + LOCAL_EXTRA) break;
    local.add(row.keyword);
  }
  const content = new Set(services.flatMap(service => bestOf(service, isContent, 1)));
  for (const row of accepted.filter(isContent)) {
    if (content.size >= CONTENT_KEYWORD_COUNT) break;
    content.add(row.keyword);
  }
  return {
    local: [...local],
    national: [...new Set(services.flatMap(service => bestOf(service, isPlain, 1)))],
    content: [...content],
    serviceOf,
  };
}

/** Weights that give every service the same pull: each keyword's score as a share of its service's best. */
export function serviceWeights(keywords: KeywordResearchKeyword[], serviceOf: Map<string, string>) {
  const best = new Map<string, number>();
  for (const row of keywords) {
    const service = serviceOf.get(row.keyword);
    if (service) best.set(service, Math.max(best.get(service) ?? 0, keywordScore(row) ?? 0));
  }
  return new Map(keywords.filter(row => serviceOf.has(row.keyword)).map(row => {
    const top = best.get(serviceOf.get(row.keyword)!) ?? 0;
    // Unknown value counts like the service's best: a niche service without CPC data still pulls its weight.
    return [row.keyword, top > 0 && keywordScore(row) != null ? (keywordScore(row)! / top) * 1000 : 1000] as const;
  }));
}

export interface LocalStanding {
  /** Client services this site ranks for in the local searches. */
  services: Set<string>;
  points: number;
  appearances: number;
  bestPosition: number;
  titles: string[];
}

/**
 * Points per local search: 21 minus the position (page 1–2), weighted by the keyword's share of the top score, so
 * ranking for a $40K/mo keyword counts more than for a $500/mo one. A floor keeps zero-CPC keywords in play.
 */
export function scoreLocal(serps: SerpResult[], scores: Map<string, number>, clientDomain: string | null, serviceOf: Map<string, string> = new Map()) {
  const top = Math.max(1, ...scores.values());
  const standings = new Map<string, LocalStanding>();
  let clientAppearances = 0;
  for (const serp of serps) {
    const weight = 0.1 + (scores.get(serp.keyword) ?? 0) / top;
    const best = new Map<string, { position: number; title: string | null }>();
    for (const row of serp.organic) {
      if (row.position > 20 || best.has(row.domain)) continue;
      best.set(row.domain, row);
    }
    for (const [domain, row] of best) {
      if (clientDomain && domain === clientDomain) {
        if (row.position <= 10) clientAppearances += 1;
        continue;
      }
      if (isNotCompetitor(domain)) continue;
      const standing = standings.get(domain) ?? { services: new Set<string>(), points: 0, appearances: 0, bestPosition: row.position, titles: [] };
      const service = serviceOf.get(serp.keyword);
      if (service && row.position <= 10) standing.services.add(service);
      standing.points += (21 - row.position) * weight;
      standing.appearances += 1;
      standing.bestPosition = Math.min(standing.bestPosition, row.position);
      if (row.title && standing.titles.length < 3) standing.titles.push(row.title);
      standings.set(domain, standing);
    }
  }
  return { standings, clientAppearances };
}

/** Businesses in the map pack across the local searches, most often shown first. */
export function mapPackLeaders(serps: SerpResult[], clientDomain: string | null): MapPackBusiness[] {
  const leaders = new Map<string, MapPackBusiness>();
  for (const serp of serps) {
    for (const business of serp.localPack) {
      if (clientDomain && business.domain === clientDomain) continue;
      const entry = leaders.get(business.title) ?? { title: business.title, domain: business.domain, appearances: 0, rating: null, reviews: null };
      entry.appearances += 1;
      entry.rating = business.rating ?? entry.rating;
      entry.reviews = Math.max(entry.reviews ?? 0, business.reviews ?? 0) || entry.reviews;
      leaders.set(business.title, entry);
    }
  }
  return [...leaders.values()].sort((a, b) => b.appearances - a.appearances || (b.reviews ?? 0) - (a.reviews ?? 0));
}

export const MAP_PACK_SHOWN = SHOWN;

export interface NationalStanding {
  services: Set<string>;
  metros: Set<string>;
  /** 21 minus the position, summed over the metro searches: how strongly the site wins outside the market. */
  points: number;
  contentKeywords: number;
  titles: string[];
}

/** Which metros each domain ranks on page 1 or 2 in, plus how many content keywords it wins nationally. */
export function scoreNational(serps: SerpResult[], content: Array<{ domain: string; keywords: number }>, clientDomain: string | null, serviceOf: Map<string, string> = new Map()) {
  const standings = new Map<string, NationalStanding>();
  const entry = (domain: string) => {
    const existing = standings.get(domain) ?? { services: new Set<string>(), metros: new Set<string>(), points: 0, contentKeywords: 0, titles: [] };
    standings.set(domain, existing);
    return existing;
  };
  for (const serp of serps) {
    const seen = new Set<string>();
    for (const row of serp.organic) {
      if (row.position > 20 || seen.has(row.domain) || row.domain === clientDomain || isNotCompetitor(row.domain)) continue;
      seen.add(row.domain);
      const standing = entry(row.domain);
      standing.metros.add(serp.locationName);
      standing.points += 21 - row.position;
      const service = serviceOf.get(serp.keyword);
      if (service && row.position <= 10) standing.services.add(service);
      if (row.title && standing.titles.length < 3) standing.titles.push(row.title);
    }
  }
  for (const row of content) {
    if (row.domain === clientDomain || isNotCompetitor(row.domain)) continue;
    entry(row.domain).contentKeywords += row.keywords;
  }
  return standings;
}

/** The domains worth labelling and measuring: the local leaders, every map pack business's site and the national leaders. */
export function candidateDomains(local: Map<string, LocalStanding>, national: Map<string, NationalStanding>, mapPack: MapPackBusiness[]) {
  const localTop = [...local].sort((a, b) => b[1].points - a[1].points).slice(0, LOCAL_CANDIDATES).map(([domain]) => domain);
  const metroTop = [...national].filter(([, row]) => row.points).sort((a, b) => b[1].points - a[1].points).slice(0, NATIONAL_CANDIDATES).map(([domain]) => domain);
  const contentTop = [...national].filter(([, row]) => row.contentKeywords).sort((a, b) => b[1].contentKeywords - a[1].contentKeywords).slice(0, CONTENT_CANDIDATES).map(([domain]) => domain);
  const packSites = mapPack.slice(0, MAP_PACK_CANDIDATES).map(business => business.domain).filter((domain): domain is string => !!domain && !isNotCompetitor(domain));
  return [...new Set([...localTop, ...packSites, ...metroTop, ...contentTop])];
}

const COMPETES: CompetitorSiteLabel[] = ["contractor", "franchise"];

/**
 * Picks in ranked order, except that after the first, a site ranking for a service no pick covers yet is taken
 * before one that only repeats covered services, so the window leaders do not crowd out the commercial door leader.
 */
export function spreadPicks(ranked: CompetitorSite[], alreadyCovered: string[]) {
  const covered = new Set(alreadyCovered);
  const picks: CompetitorSite[] = [];
  while (picks.length < PICKS_PER_SCOPE) {
    const remaining = ranked.filter(site => !picks.includes(site));
    if (!remaining.length) break;
    const next = (picks.length ? remaining.find(site => (site.services ?? []).some(service => !covered.has(service))) : undefined) ?? remaining[0];
    picks.push(next);
    for (const service of next.services ?? []) covered.add(service);
  }
  return picks;
}

/**
 * Builds the lists and the automatic picks. Local: contractors and franchises by local points. National: by organic
 * traffic value, independents first, because a franchise's strength is its brand domain. Picks are the top 2
 * independent contractors locally and the top 2 by traffic value elsewhere.
 */
export function assembleScan(input: {
  candidates: string[];
  local: Map<string, LocalStanding>;
  national: Map<string, NationalStanding>;
  labels: Map<string, { label: CompetitorSiteLabel; reason: string }>;
  strength: Map<string, DomainStrength>;
}) {
  const sites: CompetitorSite[] = input.candidates.map(domain => {
    const local = input.local.get(domain);
    const strength = input.strength.get(domain);
    const label = input.labels.get(domain);
    return {
      domain,
      label: label?.label ?? null,
      labelReason: label?.reason ?? null,
      localPoints: Math.round(local?.points ?? 0),
      localAppearances: local?.appearances ?? 0,
      bestPosition: local?.bestPosition ?? null,
      metros: input.national.get(domain)?.metros.size ?? 0,
      contentKeywords: input.national.get(domain)?.contentKeywords ?? 0,
      services: [...new Set([...(local?.services ?? []), ...(input.national.get(domain)?.services ?? [])])].sort(),
      organicKeywords: strength?.organicKeywords ?? null,
      top10Keywords: strength?.top10Keywords ?? null,
      trafficValue: strength?.trafficValue ?? null,
    };
  });
  const competing = sites.filter(site => site.label && COMPETES.includes(site.label));
  const local = competing.filter(site => site.localAppearances > 0).sort((a, b) => b.localPoints - a.localPoints);
  const national = [...competing].sort((a, b) =>
    Number(a.label === "franchise") - Number(b.label === "franchise") || (b.trafficValue ?? -1) - (a.trafficValue ?? -1));
  const localPicks = spreadPicks(local.filter(site => site.label === "contractor"), []);
  const nationalPicks = spreadPicks(
    national.filter(site => site.label === "contractor" && site.trafficValue != null && !localPicks.some(pick => pick.domain === site.domain)),
    localPicks.flatMap(site => site.services ?? []),
  );
  return {
    local: local.slice(0, SHOWN),
    national: national.slice(0, SHOWN),
    excluded: sites.filter(site => site.label && !COMPETES.includes(site.label)),
    autoPicks: [...localPicks, ...nationalPicks].map(site => site.domain),
  };
}

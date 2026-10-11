import type { KeywordCompetitorScan } from "@shared/keywordResearch";
import type { KeywordResearchProject } from "@shared/schema";
import {
  assembleScan, candidateDomains, discoveryCandidates, discoveryKeywords, MAP_PACK_SHOWN, mapPackLeaders, NATIONAL_METROS, scoreLocal, scoreNational, serviceWeights,
} from "./competitors";
import { fetchDomainStrength, fetchSerp, fetchSerpCompetitors, KeywordDataError, searchAreas, type DomainStrength } from "./dataforseo";
import { stateName } from "./keywords";
import { readHomepage } from "./readWebsite";
import { checkRelevance, chooseSearchCities, labelSites } from "./suggestServices";

const CONCURRENCY = 8;

/** Share of searches allowed to fail (DataForSEO answers some with a server error) before a run gives up. */
export const MAX_FAILED_SHARE = 0.25;

/**
 * Runs paid searches, skipping any that DataForSEO fails on instead of throwing the rest away. Throws only when
 * more than `maxFailedShare` fail (a quarter by default), since the result would then be missing too much to trust.
 * A step that marks each failure for retry passes 1: it keeps every search that worked and fails only if none did.
 */
export async function tolerantSearches<T, R>(items: T[], run: (item: T) => Promise<R>, maxFailedShare = MAX_FAILED_SHARE) {
  let failed = 0;
  const results = await inBatches(items, async item => {
    try {
      return await run(item);
    } catch (error) {
      if (!(error instanceof KeywordDataError)) throw error;
      failed += 1;
      return null;
    }
  });
  if (items.length && (failed / items.length > maxFailedShare || failed === items.length)) {
    throw new KeywordDataError(`DataForSEO failed on ${failed} of ${items.length} searches. Try again in a few minutes.`);
  }
  return { results: results.filter((result): result is Awaited<R> & {} => result != null), failed };
}

export async function inBatches<T, R>(items: T[], run: (item: T) => Promise<R>) {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += CONCURRENCY) {
    results.push(...await Promise.all(items.slice(index, index + CONCURRENCY).map(run)));
  }
  return results;
}

export function clientDomainOf(website: string | null) {
  if (!website) return null;
  try {
    return new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Google location names for "City, ST" pairs, keeping only places Google can search from. */
export async function searchLocations(cities: Array<{ city: string; state: string }>) {
  const known = new Map((await searchAreas()).filter(area => area.type === "City").map(area => [area.name.toLowerCase(), area.name]));
  const names = cities.map(({ city, state }) => known.get(`${city.trim()},${stateName(state)},United States`.toLowerCase()));
  return [...new Set(names.filter((name): name is string => !!name))];
}

/** "Charlotte, NC" → { city, state }; null when it is not in that form. */
export function parseCity(value: string) {
  const comma = value.lastIndexOf(",");
  const city = value.slice(0, comma).trim();
  const state = value.slice(comma + 1).trim();
  return comma > 0 && city && state.length >= 2 ? { city, state } : null;
}

/** The client's city plus the 2 largest other served cities, or the 2 largest in its metro when none are listed. */
async function defaultCities(project: KeywordResearchProject) {
  const own = { city: project.city, state: project.state };
  const served = project.serviceCities.map(parseCity).filter((place): place is { city: string; state: string } => !!place && place.city.toLowerCase() !== project.city.toLowerCase());
  if (served.length) return [own, ...served.slice(0, 2)];
  const others = await chooseSearchCities(project.city, project.state, project.locationName.replace(/,United States$/, "")).catch(() => []);
  return [own, ...others.filter(other => other.city.toLowerCase() !== project.city.toLowerCase()).slice(0, 2)];
}

/**
 * Finds the strongest local and national competitors for a researched project: runs the searches, scores who
 * wins them, has Claude label what each site is, measures the contenders and picks 2 local and 2 national models.
 */
export async function discoverCompetitors(project: KeywordResearchProject, cities?: Array<{ city: string; state: string }>): Promise<KeywordCompetitorScan> {
  let cost = 0;
  const services = project.services.filter(service => service.selected).map(service => service.name);
  // Every query is checked as the client's work before anything is searched: matching words is not enough.
  const queryCandidates = discoveryCandidates(project.keywords, services);
  const relevance = await checkRelevance(project.trade, services, project.exclusions, queryCandidates);
  const searches = discoveryKeywords(project.keywords, services, relevance);
  if (!searches.local.length) throw new KeywordDataError("No keyword on this list was judged to be the client's work. Check the services and exclusions, then re-run the research.");
  const rejectedQueries = queryCandidates
    .map(keyword => ({ keyword, check: relevance.get(keyword) }))
    .filter((entry): entry is { keyword: string; check: NonNullable<typeof entry.check> } => !!entry.check && entry.check.verdict !== "yes")
    .slice(0, 40)
    .map(entry => ({ keyword: entry.keyword, verdict: entry.check.verdict as "no" | "uncertain", reason: entry.check.reason }));
  const locations = await searchLocations(cities?.length ? cities : await defaultCities(project));
  if (!locations.length) throw new KeywordDataError("Google has none of those cities. Check the spelling, for example \"Charlotte, NC\".");
  const clientDomain = clientDomainOf(project.website);

  const serp = async (keyword: string, location: string) => {
    const result = await fetchSerp(keyword, location);
    cost += result.cost;
    return result.serp;
  };
  const localJobs = locations.flatMap(location => searches.local.map(keyword => [keyword, location] as const));
  const nationalJobs = NATIONAL_METROS.filter(metro => !locations.includes(metro)).flatMap(metro => searches.national.map(keyword => [keyword, metro] as const));
  const [localRun, nationalRun, content] = await Promise.all([
    tolerantSearches(localJobs, ([keyword, location]) => serp(keyword, location)),
    tolerantSearches(nationalJobs, ([keyword, location]) => serp(keyword, location)),
    searches.content.length ? fetchSerpCompetitors(searches.content).catch(error => {
      if (!(error instanceof KeywordDataError)) throw error;
      return { domains: [], cost: 0 };
    }) : Promise.resolve({ domains: [], cost: 0 }),
  ]);
  const localSerps = localRun.results;
  const nationalSerps = nationalRun.results;
  cost += content.cost;

  // Each service pulls equally, so window replacement's search value cannot drown out commercial doors.
  const weights = serviceWeights(project.keywords, searches.serviceOf);
  const local = scoreLocal(localSerps, weights, clientDomain, searches.serviceOf);
  const national = scoreNational(nationalSerps, content.domains, clientDomain, searches.serviceOf);
  const mapPack = mapPackLeaders(localSerps, clientDomain);
  const candidates = candidateDomains(local.standings, national, mapPack);

  const homepages = await inBatches(candidates, domain => readHomepage(`https://${domain}`));
  const labels = await labelSites(project.trade, services, candidates.map((domain, index) => ({
    domain,
    resultTitles: [...(local.standings.get(domain)?.titles ?? []), ...(national.get(domain)?.titles ?? [])],
    homepage: homepages[index],
  })));

  const contenders = candidates.filter(domain => ["contractor", "franchise"].includes(labels.get(domain)?.label ?? ""));
  const strength = new Map<string, DomainStrength>();
  await inBatches(contenders, async domain => {
    try {
      const result = await fetchDomainStrength(domain);
      cost += result.cost;
      strength.set(domain, result.strength);
    } catch (error) {
      // One missing measurement leaves that site unranked by strength; it does not stop discovery.
      if (!(error instanceof KeywordDataError)) throw error;
    }
  });

  const lists = assembleScan({ candidates, local: local.standings, national, labels, strength });
  return {
    ranAt: new Date().toISOString(),
    searchCities: locations.map(location => location.replace(/,United States$/, "")),
    localKeywords: searches.local,
    nationalKeywords: searches.national,
    contentKeywords: searches.content,
    ...lists,
    mapPack: mapPack.slice(0, MAP_PACK_SHOWN),
    picks: lists.autoPicks,
    confirmedAt: null,
    clientAppearances: local.clientAppearances,
    rejectedQueries,
    failedSearches: localRun.failed + nationalRun.failed,
    costUsd: Number(cost.toFixed(4)),
  };
}

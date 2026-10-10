import type { KeywordCompetitorScan } from "@shared/keywordResearch";
import { keywordScore } from "@shared/keywordResearch";
import type { KeywordResearchProject } from "@shared/schema";
import {
  assembleScan, candidateDomains, discoveryKeywords, MAP_PACK_SHOWN, mapPackLeaders, NATIONAL_METROS, scoreLocal, scoreNational,
} from "./competitors";
import { fetchDomainStrength, fetchSerp, fetchSerpCompetitors, KeywordDataError, searchAreas, type DomainStrength } from "./dataforseo";
import { stateName } from "./keywords";
import { readHomepage } from "./readWebsite";
import { chooseSearchCities, labelSites } from "./suggestServices";

const CONCURRENCY = 8;

async function inBatches<T, R>(items: T[], run: (item: T) => Promise<R>) {
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
async function searchLocations(cities: Array<{ city: string; state: string }>) {
  const known = new Map((await searchAreas()).filter(area => area.type === "City").map(area => [area.name.toLowerCase(), area.name]));
  const names = cities.map(({ city, state }) => known.get(`${city.trim()},${stateName(state)},United States`.toLowerCase()));
  return [...new Set(names.filter((name): name is string => !!name))];
}

/** The client's city plus the 2 largest other cities in its metro area, unless the cities were given. */
async function defaultCities(project: KeywordResearchProject) {
  const own = { city: project.city, state: project.state };
  const others = await chooseSearchCities(project.city, project.state, project.locationName.replace(/,United States$/, "")).catch(() => []);
  return [own, ...others.filter(other => other.city.toLowerCase() !== project.city.toLowerCase()).slice(0, 2)];
}

/**
 * Finds the strongest local and national competitors for a researched project: runs the searches, scores who
 * wins them, has Claude label what each site is, measures the contenders and picks 2 local and 2 national models.
 */
export async function discoverCompetitors(project: KeywordResearchProject, cities?: Array<{ city: string; state: string }>): Promise<KeywordCompetitorScan> {
  let cost = 0;
  const searches = discoveryKeywords(project.keywords);
  if (!searches.local.length) throw new KeywordDataError("This keyword list has no service or city keywords to search. Re-run the research first.");
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
  const [localSerps, nationalSerps, content] = await Promise.all([
    inBatches(localJobs, ([keyword, location]) => serp(keyword, location)),
    inBatches(nationalJobs, ([keyword, location]) => serp(keyword, location)),
    searches.content.length ? fetchSerpCompetitors(searches.content) : Promise.resolve({ domains: [], cost: 0 }),
  ]);
  cost += content.cost;

  const scores = new Map(project.keywords.map(row => [row.keyword, keywordScore(row) ?? 0]));
  const local = scoreLocal(localSerps, scores, clientDomain);
  const national = scoreNational(nationalSerps, content.domains, clientDomain);
  const mapPack = mapPackLeaders(localSerps, clientDomain);
  const candidates = candidateDomains(local.standings, national, mapPack);

  const homepages = await inBatches(candidates, domain => readHomepage(`https://${domain}`));
  const services = project.services.filter(service => service.selected).map(service => service.name);
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
    costUsd: Number(cost.toFixed(4)),
  };
}

import { planCell, planKeyword, type PlanFacts } from "@shared/keywordPlan";
import {
  keywordDemand, keywordScore, type GridCell, type KeywordResearchKeyword, type KeywordResearchSummary, type PageMatch, type PageOneCheck,
} from "@shared/keywordResearch";
import type { KeywordResearchProject } from "@shared/schema";
import { isNotCompetitor } from "./competitors";
import { fetchSerp, fetchTrafficEstimates, type SerpResult } from "./dataforseo";
import { clientDomainOf, inBatches, parseCity, searchLocations } from "./discover";
import { stateName } from "./keywords";
import { assessPageOne, coveringPage, isForum, pageTypeFromPageOne, sitePages, type SitePage } from "./pageCheck";
import { meaningStems } from "./quality";
import { listSitePages, readPageHeadlines } from "./readWebsite";

/** Keywords checked from the client's own city: the top by score, which carry most of the value. */
export const PAGE_CHECK_LIMIT = 75;
/** From each other served city: the top money keywords plus every service's main keyword, so the grid has observations. */
const OTHER_CITY_LIMIT = 15;
const OTHER_CITIES = 2;
// Pages whose titles are read for coverage; past this, pages are matched on their URL alone.
const HEADLINE_LIMIT = 150;
// Two cities' results count as identical when this share of their shared keywords returned the same top 10.
const IDENTICAL_SHARE = 0.8;

type Place = { city: string; state: string };

const byScore = (a: KeywordResearchKeyword, b: KeywordResearchKeyword) => (keywordScore(b) ?? -1) - (keywordScore(a) ?? -1) || (keywordDemand(b) ?? 0) - (keywordDemand(a) ?? 0);

/** The row that stands for a service: the service phrase itself, else its best-scoring service keyword. */
function serviceHeads<T extends KeywordResearchKeyword>(keywords: T[], services: string[]) {
  const heads = new Map<string, T>();
  for (const service of services) {
    const own = keywords.find(row => row.keyword === service);
    const best = own ?? keywords.filter(row => row.service === service && row.pageType === "service").sort(byScore)[0];
    if (best) heads.set(service, best);
  }
  return heads;
}

/** Pairs of checked cities whose top-10 domains matched for most keywords checked from both. Reported, not explained. */
function identicalResults(serps: Array<{ city: string; serp: SerpResult }>) {
  const cities = [...new Set(serps.map(entry => entry.city))];
  const key = (serp: SerpResult) => serp.organic.filter(row => row.position <= 10).map(row => row.domain).join("|");
  const pairs: Array<[string, string]> = [];
  for (let a = 0; a < cities.length; a += 1) {
    for (let b = a + 1; b < cities.length; b += 1) {
      const left = new Map(serps.filter(entry => entry.city === cities[a]).map(entry => [entry.serp.keyword, key(entry.serp)]));
      const shared = serps.filter(entry => entry.city === cities[b] && left.has(entry.serp.keyword));
      const same = shared.filter(entry => left.get(entry.serp.keyword) === key(entry.serp)).length;
      if (shared.length >= 5 && same / shared.length >= IDENTICAL_SHARE) pairs.push([cities[a], cities[b]]);
    }
  }
  return pairs;
}

/**
 * Searches the top keywords from the client's city and up to 2 other served cities, records what page 1 holds from
 * each, matches every keyword to a page on the assessed site, decides an action per keyword with its reasons, and
 * assesses every service × served city.
 */
export async function runPageCheck(project: KeywordResearchProject): Promise<{ keywords: KeywordResearchKeyword[]; summary: KeywordResearchSummary }> {
  let cost = 0;
  const liveHost = clientDomainOf(project.liveDomain || project.website);
  const siteHost = clientDomainOf(project.website);
  const siteKind: "live" | "staging" = siteHost && liveHost && siteHost !== liveHost ? "staging" : "live";

  const home: Place = { city: project.city, state: project.state };
  const served = project.serviceCities.map(parseCity).filter((place): place is Place => !!place);
  const otherPlaces = served.filter(place => place.city.toLowerCase() !== home.city.toLowerCase()).slice(0, OTHER_CITIES);
  const locations = await searchLocations([home, ...otherPlaces]);
  const cityOf = (location: string) => location.split(",")[0];
  const homeLocation = locations.find(location => cityOf(location).toLowerCase() === home.city.toLowerCase()) ?? project.locationName;
  const otherLocations = locations.filter(location => location !== homeLocation);

  type Checked = KeywordResearchKeyword & { pageOne: PageOneCheck[] };
  const keywords: Checked[] = project.keywords.map(row => ({ ...row, pageOne: [] }));
  const services = project.services.filter(service => service.selected);
  const heads = serviceHeads(keywords, services.map(service => service.name));
  const withDemand = keywords.filter(row => (keywordDemand(row) ?? 0) > 0).sort(byScore);
  const homeTargets = withDemand.slice(0, PAGE_CHECK_LIMIT);
  const otherTargets = [...new Set([...withDemand.filter(row => row.pageType !== "blog").slice(0, OTHER_CITY_LIMIT), ...heads.values()])];
  const jobs = [
    ...homeTargets.map(row => ({ row, location: homeLocation })),
    ...otherLocations.flatMap(location => otherTargets.map(row => ({ row, location }))),
  ];

  const serps = await inBatches(jobs, async job => {
    const result = await fetchSerp(job.row.keyword, job.location, 20);
    cost += result.cost;
    return { row: job.row, city: cityOf(job.location), serp: result.serp };
  });
  const domains = [...new Set(serps.flatMap(entry => entry.serp.organic.filter(row => row.position <= 10).map(row => row.domain)))]
    .filter(domain => domain !== liveHost && !isForum(domain) && !isNotCompetitor(domain));
  const estimates = domains.length ? await fetchTrafficEstimates(domains) : { traffic: new Map<string, number>(), cost: 0 };
  cost += estimates.cost;
  for (const entry of serps) entry.row.pageOne.push(assessPageOne(entry.serp, estimates.traffic, liveHost, entry.city));

  let movedToBlog = 0;
  for (const row of keywords) {
    const mostArticles = [...row.pageOne].sort((a, b) => b.articles - a.articles)[0];
    if (!mostArticles) continue;
    const pageType = pageTypeFromPageOne(row, mostArticles);
    if (pageType !== row.pageType) movedToBlog += 1;
    row.pageType = pageType;
  }

  // Pages on the assessed site. Without a readable site, "no page" is never claimed.
  const urls = project.website ? await listSitePages(project.website) : null;
  let pages: SitePage[] = [];
  const servicePages = new Map(services.filter(service => service.pageUrl).map(service => [service.name, new URL(service.pageUrl!).pathname]));
  const cityNames = [home.city, ...served.map(place => place.city)];
  const homeStems = meaningStems([project.trade, home.city, home.state, stateName(home.state)].join(" "));
  const cityStems = meaningStems(cityNames.join(" "));
  const context = { servicePages, homeStems, cityStems };
  const matchFor = (row: KeywordResearchKeyword): PageMatch => {
    const path = urls ? coveringPage(row, pages, context) : null;
    return path ? { status: siteKind, path } : { status: "none", path: null };
  };
  if (urls) {
    pages = sitePages(urls, await readPageHeadlines(urls.slice(0, HEADLINE_LIMIT)));
    for (const row of keywords) row.pageMatch = matchFor(row);
  }

  const priorities = new Set(services.filter(service => service.priority).map(service => service.name));
  const servedStems = served.length ? meaningStems(cityNames.join(" ")) : null;
  const demandArea = project.locationName.replace(/,United States$/, "");
  for (const row of keywords) {
    const facts: PlanFacts = {
      demandArea,
      priorityService: !!row.service && priorities.has(row.service),
      servesCity: row.pageType === "city" && servedStems ? [...meaningStems(row.keyword)].some(stem => servedStems.has(stem)) : null,
      siteRead: !!urls,
      competitor: row.competitors?.[0] ?? null,
    };
    row.plan = planKeyword(row, facts);
  }

  const checkedCities = [...new Set(serps.map(entry => entry.city))];
  const grid: GridCell[] = [];
  for (const place of served.length ? served : [home]) {
    for (const service of services) {
      const head = heads.get(service.name);
      const check = head?.pageOne.find(entry => entry.city.toLowerCase() === place.city.toLowerCase()) ?? null;
      const cityRow = { keyword: `${service.name} ${place.city}`, pageType: "city", service: service.name } as KeywordResearchKeyword;
      const cityMatch = urls ? matchFor(cityRow) : null;
      const generalRow = { keyword: service.name, pageType: "service", service: service.name } as KeywordResearchKeyword;
      const generalMatch = urls ? matchFor(generalRow) : null;
      grid.push(planCell({
        service: service.name,
        city: place.city,
        cityPage: cityMatch?.path ? cityMatch : null,
        generalPage: generalMatch?.path ? generalMatch : null,
        checked: !!check,
        position: check?.clientPosition ?? null,
        smallSites: check ? check.smallSites + check.forums : null,
        demandKnown: !!head && (keywordDemand(head) ?? 0) > 0,
        priorityService: !!service.priority,
        competitorTop10: !!head?.competitors?.some(entry => entry.position <= 10),
      }));
    }
  }

  const siteNote = !project.website ? "No website on the project, so pages were not checked."
    : urls ? null : "The website could not be read, so pages were not checked.";
  return {
    keywords,
    summary: {
      ...(project.summary ?? { ideasReturned: 0, keptKeywords: keywords.length, droppedAsJunk: 0, droppedNoVolume: 0 }),
      pageCheck: {
        ranAt: new Date().toISOString(),
        location: homeLocation.replace(/,United States$/, ""),
        cities: checkedCities,
        siteKind,
        identicalResults: identicalResults(serps),
        grid,
        checked: homeTargets.length,
        movedToBlog,
        sitePages: urls?.length ?? null,
        siteNote,
        costUsd: Number(cost.toFixed(4)),
      },
    },
  };
}

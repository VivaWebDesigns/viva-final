import { CITY_PAGES_REWARDED_AT, comparePages, draftGroups, mainKeyword, planPage, type DraftGroup, type PlannedKeyword } from "@shared/pagePlan";
import {
  keywordDemand, keywordScore,
  type InventoryPage, type KeywordResearchKeyword, type KeywordResearchService, type KeywordResearchSummary, type PageEvidence, type PageKind, type PageMatch, type PagePlan,
  type MeasurementContext, type ReferenceMetrics, type RelevanceCheck,
} from "@shared/keywordResearch";
import type { KeywordResearchProject } from "@shared/schema";
import { isNotCompetitor } from "./competitors";
import { fetchSearchVolume, fetchSerp, fetchTrafficEstimates, KeywordDataError } from "./dataforseo";
import { clientDomainOf, parseCity, searchLocations, tolerantSearches } from "./discover";
import { excludedWork, stateName } from "./keywords";
import { coveringPage, evidenceFrom, isForum, isPlacePage, sitePages, type SitePage } from "./pageCheck";
import { meaningStems } from "./quality";
import { listSitePages, readPageContent } from "./readWebsite";
import { checkRelevance, reviewGroups, suggestCityPhrases } from "./suggestServices";
import { differentIntent } from "./quality";

// Keywords with no matched service judged for relevance per run, by value: past this they stay on the list, counted
// as not judged. Keywords matched to a confirmed service are always judged, whatever Google reports for them.
const MAX_UNMATCHED = 600;
const RELEVANCE_PARALLEL = 5;
const RELEVANCE_CHUNK = 150;
// Pages whose main keyword is checked on page 1, existing pages first. About $0.004 each.
const MAX_CHECKS = 150;
const CHECK_ATTEMPTS = 3;
// A page-1 check stays usable this long: later runs reuse it instead of paying for it again.
const CHECK_REUSE_DAYS = 14;
// Proposed pages sent to Claude's split/merge review.
const MAX_REVIEW = 60;
// Pages read in full for the inventory; past this they are matched by their URL alone and listed as not read.
const PAGE_READ_LIMIT = 150;
// A proposed service page whose page 1 holds this many articles, guides or forum threads is a blog topic.
const ARTICLES_FOR_BLOG = 6;
const QUESTION_STEMS = meaningStems("how what why when where which who can does do is are should will vs best");
const ACTION_WORDS = meaningStems("install installation installer repair repairs replace replacement service fix custom professional new");

const byValue = (a: KeywordResearchKeyword, b: KeywordResearchKeyword) =>
  (keywordScore(b) ?? -1) - (keywordScore(a) ?? -1) || (keywordDemand(b) ?? 0) - (keywordDemand(a) ?? 0);

/** Relevance for the top keywords, reusing verdicts from earlier steps and running the rest in parallel batches. */
async function relevanceFor(project: KeywordResearchProject, rows: KeywordResearchKeyword[], services: string[]) {
  const checks = new Map<string, RelevanceCheck>();
  const pending: string[] = [];
  for (const row of rows) {
    if (row.relevance && (row.relevance.verdict !== "yes" || (row.relevance.service && services.includes(row.relevance.service)))) checks.set(row.keyword, row.relevance);
    else pending.push(row.keyword);
  }
  const chunks: string[][] = [];
  for (let index = 0; index < pending.length; index += RELEVANCE_CHUNK) chunks.push(pending.slice(index, index + RELEVANCE_CHUNK));
  for (let index = 0; index < chunks.length; index += RELEVANCE_PARALLEL) {
    const results = await Promise.all(chunks.slice(index, index + RELEVANCE_PARALLEL).map(chunk => checkRelevance(project.trade, services, project.exclusions, chunk)));
    for (const result of results) for (const [keyword, check] of result) checks.set(keyword, check);
  }
  return checks;
}

/**
 * The service's metro numbers, shown beside city phrases, never as their own numbers: the service searched with the
 * metro city ("glass shower door installer charlotte nc"), the profile city pages are built on; else the service's
 * median CPC across its hiring searches with at least 10 searches a month (not product or how-to searches), so one
 * brand or outlier keyword does not set it.
 */
function referenceMetrics(rows: KeywordResearchKeyword[], service: string, metroCity: string, measurements: Map<string, MeasurementContext>): ReferenceMetrics | null {
  const mine = rows.filter(row => row.cpc != null && (row.service === service || row.relevance?.service === service));
  // The most-searched metro phrase, never the one with the highest number.
  const byDemand = (a: KeywordResearchKeyword, b: KeywordResearchKeyword) => (keywordDemand(b) ?? -1) - (keywordDemand(a) ?? -1) || a.keyword.localeCompare(b.keyword);
  const best = mine.filter(row => row.keyword.includes(metroCity.toLowerCase())).sort(byDemand)[0];
  if (best) {
    return {
      keyword: best.keyword, basis: "metro_phrase", searchVolume: best.searchVolume, avgCpc: best.cpc, lowTopOfPageBid: best.lowTopOfPageBid,
      highTopOfPageBid: best.highTopOfPageBid, competition: best.competition, difficulty: best.difficulty ?? null,
      measurement: best.measurement ? measurements.get(best.measurement) ?? null : null,
    };
  }
  const hiring = mine.filter(row => row.source !== "grid" && row.pageType === "service" && row.intent !== "shopping" && row.intent !== "diy" && (keywordDemand(row) ?? 0) >= 10);
  if (!hiring.length) return null;
  const median = (values: Array<number | null | undefined>) => {
    const known = values.filter((value): value is number => value != null).sort((a, b) => a - b);
    return known.length ? known[Math.floor((known.length - 1) / 2)] : null;
  };
  const ids = [...new Set(hiring.map(row => row.measurement).filter(Boolean))];
  return {
    keyword: `median of ${hiring.length} hiring searches`, basis: "median", searchVolume: null,
    avgCpc: median(hiring.map(row => row.cpc)), lowTopOfPageBid: median(hiring.map(row => row.lowTopOfPageBid)),
    highTopOfPageBid: median(hiring.map(row => row.highTopOfPageBid)), competition: null, difficulty: null,
    measurement: ids.length === 1 ? measurements.get(ids[0]!) ?? null : null,
  };
}

/** Blog keywords of one service clustered by shared topic words, so "how to fix foggy windows" and "fix foggy window" share a post. */
function topicClusters(rows: Array<{ keyword: string; service: string }>, serviceStems: Map<string, Set<string>>) {
  const clusterOf = new Map<string, string>();
  const clusters: Array<{ id: string; service: string; stems: Set<string> }> = [];
  for (const row of rows) {
    const own = serviceStems.get(row.service) ?? new Set<string>();
    const stems = new Set([...meaningStems(row.keyword)].filter(stem => !QUESTION_STEMS.has(stem) && !own.has(stem)));
    const match = clusters.find(cluster => cluster.service === row.service && stems.size > 0 && (() => {
      const shared = [...stems].filter(stem => cluster.stems.has(stem)).length;
      return shared / new Set([...stems, ...cluster.stems]).size >= 0.5;
    })());
    if (match) {
      clusterOf.set(row.keyword, match.id);
      continue;
    }
    const id = `t${clusters.length}`;
    clusters.push({ id, service: row.service, stems });
    clusterOf.set(row.keyword, id);
  }
  return clusterOf;
}

/**
 * Builds the page plan: judges the top keywords as the client's work or not, matches them to pages on the assessed
 * site, groups them into pages (existing pages first), has Claude propose merges and splits, checks page 1 once per
 * page from the city that page is for, and decides an action per page with its reasons and open questions.
 */
export async function runPlan(project: KeywordResearchProject, options: { retryFailedOnly?: boolean } = {}): Promise<{ keywords: KeywordResearchKeyword[]; summary: KeywordResearchSummary; services: KeywordResearchService[] }> {
  let cost = 0;
  const services = project.services.filter(service => service.selected);
  const serviceNames = services.map(service => service.name);
  const priorities = new Set(services.filter(service => service.priority).map(service => service.name));
  const liveHost = clientDomainOf(project.liveDomain || project.website);
  const siteHost = clientDomainOf(project.website);
  const siteKind: "live" | "staging" = siteHost && liveHost && siteHost !== liveHost ? "staging" : "live";
  const servedCities = (project.serviceCities.length ? project.serviceCities : [`${project.city}, ${project.state}`])
    .map(parseCity).filter((place): place is { city: string; state: string } => !!place);

  // Confirmed service × served city phrases, generated: keyword ideas never suggest small towns, and Google Ads
  // usually reports nothing for them. A city phrase stays in the plan whatever Google reports.
  const missing = services.filter(service => !service.cityPhrases?.length).map(service => service.name);
  const suggested = missing.length ? await suggestCityPhrases(project.trade, missing) : new Map<string, string[]>();
  const updatedServices = project.services.map(service => suggested.get(service.name)?.length ? { ...service, cityPhrases: suggested.get(service.name) } : service);
  const grid = new Map<string, { service: string; city: string; primary: boolean }>();
  for (const service of updatedServices.filter(entry => entry.selected)) {
    for (const place of servedCities) {
      (service.cityPhrases ?? []).forEach((phrase, index) => {
        const keyword = `${phrase} ${place.city} ${place.state}`.toLowerCase().replace(/\s+/g, " ").trim();
        if (!excludedWork(keyword, project.exclusions) && !grid.has(keyword)) grid.set(keyword, { service: service.name, city: place.city, primary: index === 0 });
      });
    }
  }
  const keywords = project.keywords.filter(row => row.source !== "grid" || grid.has(row.keyword)).map(row => ({ ...row }));
  const listed = new Set(keywords.map(row => row.keyword));
  const fresh = [...grid.keys()].filter(keyword => !listed.has(keyword));
  // The service with the metro city, for the reference numbers ("glass shower door installer charlotte").
  const metro = `${project.city} ${project.state}`.toLowerCase();
  const probes = new Map<string, string>();
  for (const service of updatedServices.filter(entry => entry.selected)) {
    for (const phrase of [service.name, ...(service.cityPhrases ?? [])]) {
      for (const keyword of [`${phrase} ${project.city.toLowerCase()}`, `${phrase} ${metro}`]) if (!listed.has(keyword) && !grid.has(keyword)) probes.set(keyword, service.name);
    }
  }
  const volumes = fresh.length || probes.size
    ? await fetchSearchVolume([...fresh, ...probes.keys()], project.locationName, "plan-volume").catch(error => {
      if (!(error instanceof KeywordDataError)) throw error;
      return { metrics: [], cost: 0, measurement: null };
    })
    : { metrics: [], cost: 0, measurement: null };
  const measurements = new Map((project.summary?.measurements ?? []).filter(item => item.id !== "plan-volume").map(item => [item.id, item]));
  if (volumes.measurement) measurements.set(volumes.measurement.id, volumes.measurement);
  cost += volumes.cost;
  const metricsOf = new Map(volumes.metrics.map(row => [row.keyword.toLowerCase(), row]));
  const probeRows: KeywordResearchKeyword[] = [...probes].flatMap(([keyword, service]) => {
    const metrics = metricsOf.get(keyword);
    return metrics ? [{ ...metrics, keyword, service, pageType: "city" as const }] : [];
  });
  for (const keyword of fresh) {
    const metrics = metricsOf.get(keyword);
    keywords.push({
      keyword, service: grid.get(keyword)!.service, measurement: metrics ? "plan-volume" : undefined,
      searchVolume: metrics?.searchVolume ?? null, cpc: metrics?.cpc ?? null, competition: metrics?.competition ?? null, competitionIndex: metrics?.competitionIndex ?? null,
      lowTopOfPageBid: metrics?.lowTopOfPageBid ?? null, highTopOfPageBid: metrics?.highTopOfPageBid ?? null,
      pageType: "city", source: "grid",
    });
  }

  const unresolved: Array<{ keyword: string; reason: string }> = [];
  const pool = keywords
    .filter(row => !grid.has(row.keyword))
    .filter(row => {
      const work = excludedWork(row.keyword, project.exclusions);
      if (work) unresolved.push({ keyword: row.keyword, reason: `names excluded work (${work})` });
      return !work;
    });
  // Every candidate for a confirmed service is judged, measured or not; the review budget caps only the rest.
  const unmatched = pool.filter(row => !row.service).sort(byValue);
  const candidates = [...pool.filter(row => row.service), ...unmatched.slice(0, MAX_UNMATCHED)];
  const notJudged = unmatched.length - Math.min(unmatched.length, MAX_UNMATCHED);
  const relevance = await relevanceFor(project, candidates, serviceNames);
  for (const row of keywords) row.relevance = relevance.get(row.keyword) ?? row.relevance;

  // Pages on the assessed site. Without a readable site, nothing is claimed to be missing.
  const urls = project.website ? await listSitePages(project.website) : null;
  let pages: SitePage[] = [];
  if (urls) pages = sitePages(urls, await readPageContent(urls.slice(0, PAGE_READ_LIMIT)));
  const cityStems = new Map(servedCities.map(place => [place.city, meaningStems(place.city)] as const));
  // The inventory: each page by the services and served cities it names, and its kind.
  const inventory: InventoryPage[] = pages.map(page => {
    const named = new Set([...meaningStems(page.path.replace(/[^a-zA-Z0-9]+/g, " ")), ...page.subjectStems]);
    const cities = servedCities.filter(place => [...meaningStems(place.city)].every(stem => named.has(stem))).map(place => place.city);
    const kind: InventoryPage["kind"] = page.article ? "article" : page.aboutCost ? "cost" : page.placePage && cities.length ? "city"
      : serviceNames.some(service => [...meaningStems(service)].every(stem => page.stems.has(stem))) ? "service" : "other";
    return {
      path: page.path, title: page.title, h1: page.h1, words: page.words, textSource: page.textSource, kind, cities,
      // Services the page is about: named in its own title or main heading (the site's name left out), or its address.
      services: serviceNames.filter(service => [...meaningStems(service)].filter(stem => !ACTION_WORDS.has(stem)).every(stem => named.has(stem))),
    };
  });
  const allCityStems = new Set([...cityStems.values()].flatMap(stems => [...stems]));
  const context = {
    // A page for one place is never a service's own page, whatever the intake matched it to.
    servicePages: new Map(services.filter(service => service.pageUrl).map(service => [service.name, new URL(service.pageUrl!).pathname] as const).filter(([, path]) => !isPlacePage(path))),
    cityNames: servedCities.map(place => place.city),
    serviceNames,
    homeStems: meaningStems([project.trade, project.city, project.state, stateName(project.state)].join(" ")),
    cityStems: allCityStems,
  };
  const matchFor = (row: KeywordResearchKeyword): PageMatch => {
    const path = urls ? coveringPage(row, pages, context) : null;
    return path ? { status: siteKind, path } : { status: "none", path: null };
  };
  // The page that serves each service: the intake's page for it, else the page matching the service phrase.
  const servicePages = new Map<string, PageMatch>();
  for (const service of serviceNames) {
    const match = matchFor({ keyword: service, service, pageType: "service" } as KeywordResearchKeyword);
    if (match.path && !isPlacePage(match.path)) servicePages.set(service, match);
  }

  const planned: PlannedKeyword[] = [];
  for (const row of candidates) {
    const check = relevance.get(row.keyword);
    if (!check || check.verdict === "no") continue;
    if (check.verdict === "uncertain" || !check.service) {
      unresolved.push({ keyword: row.keyword, reason: `uncertain it is the client's work: ${check.reason}` });
      continue;
    }
    let kind: PageKind = row.pageType ?? "service";
    let city: string | null = null;
    if (kind === "city") {
      const words = meaningStems(row.keyword);
      city = [...cityStems].find(([, stems]) => [...stems].every(stem => words.has(stem)))?.[0] ?? null;
      if (!city) {
        // A city the client does not list: a question for the client, never a page on its own.
        unresolved.push({ keyword: row.keyword, reason: "names a city the client does not list as served" });
        continue;
      }
    }
    row.pageMatch = matchFor(row);
    planned.push({ row, service: check.service, kind, city, match: row.pageMatch });
  }
  for (const row of keywords) {
    const cell = grid.get(row.keyword);
    if (!cell) continue;
    row.pageType = "city";
    row.service = cell.service;
    row.relevance = { verdict: "yes", service: cell.service, reason: "generated from a confirmed service and a served city" };
    row.pageMatch = matchFor(row);
    planned.push({ row, service: cell.service, kind: "city", city: cell.city, match: row.pageMatch });
  }
  // A service's phrases for one city share a page: when one of them is on an existing page, the others go there too.
  // Services that are one customer need share one page per city: the client serves them on the same page, or Google
  // reports their metro phrases as one search (identical numbers) without a difference in intent. Otherwise each
  // service keeps its own city pages.
  const root = new Map(serviceNames.map(service => [service, service]));
  const familyOf = (service: string): string => {
    let current = service;
    while (root.get(current) && root.get(current) !== current) current = root.get(current)!;
    return current;
  };
  const familyReasons = new Map<string, string>();
  const join = (a: string, b: string, reason: string) => {
    const [x, y] = [familyOf(a), familyOf(b)];
    if (x === y) return;
    root.set(y, x);
    familyReasons.set(x, [familyReasons.get(x), familyReasons.get(y), reason].filter(Boolean).join("; "));
  };
  const onPage = new Map<string, string>();
  for (const [service, page] of servicePages) {
    const other = page.path ? onPage.get(page.path) : undefined;
    if (other) join(other, service, `the client serves "${other}" and "${service}" on ${page.path}`);
    else if (page.path) onPage.set(page.path, service);
  }
  const metroCity = project.city.toLowerCase();
  const metroRows = [...keywords.filter(row => grid.get(row.keyword)?.city.toLowerCase() === metroCity), ...probeRows]
    .filter(row => row.searchVolume != null && row.cpc != null && row.service);
  const bySearch = new Map<string, KeywordResearchKeyword>();
  for (const row of metroRows) {
    const key = [row.searchVolume, row.cpc, row.lowTopOfPageBid, row.highTopOfPageBid].join("|");
    const twin = bySearch.get(key);
    if (twin && twin.service !== row.service && !differentIntent(twin.keyword, row.keyword)) {
      join(twin.service!, row.service!, `Google reports "${twin.keyword}" and "${row.keyword}" as one search (${row.searchVolume}/mo, average CPC $${row.cpc!.toFixed(2)})`);
    } else if (!twin) bySearch.set(key, row);
  }

  const cellPage = new Map<string, PageMatch>();
  for (const item of planned) if (grid.has(item.row.keyword) && item.match.path) cellPage.set(`${familyOf(item.service)}|${item.city}`, item.match);
  for (const item of planned) {
    const page = grid.has(item.row.keyword) && !item.match.path ? cellPage.get(`${familyOf(item.service)}|${item.city}`) : undefined;
    if (page) item.match = item.row.pageMatch = page;
  }

  const serviceStems = new Map(serviceNames.map(service => [service, meaningStems(service)] as const));
  const clusters = topicClusters(planned.filter(item => item.kind === "blog").map(item => ({ keyword: item.row.keyword, service: item.service })), serviceStems);
  let groups = draftGroups(planned, servicePages, keyword => clusters.get(keyword) ?? keyword, familyOf);
  // A page holding grid phrases is checked for its own service's target phrase, with that service's metro numbers beside it.
  const references = new Map(serviceNames.map(service => [service, referenceMetrics([...keywords, ...probeRows], service, project.city, measurements)] as const));
  for (const group of groups) {
    // A page for one place is a city page, whatever kind of keyword reached it first.
    if (group.page.path && isPlacePage(group.page.path)) {
      group.kind = "city";
      group.city = group.city ?? group.members.find(member => member.city)?.city ?? null;
    }
    const cells = group.members.filter(member => grid.has(member.row.keyword));
    if (!cells.length) continue;
    // The target is the most specific primary phrase on the page: "glass shower door installer", not "door installer".
    const specificity = (member: PlannedKeyword) => Number(grid.get(member.row.keyword)!.primary) * 100 + meaningStems(member.row.keyword).size;
    const target = [...cells].sort((a, b) => specificity(b) - specificity(a))[0];
    group.target = target.row.keyword;
    group.service = target.service;
    group.city = grid.get(target.row.keyword)!.city;
    // The best metro reference among the services the page serves: a service searched with the metro city beats a median.
    const served = [...new Set(group.members.map(member => member.service))];
    if (served.length > 1 && familyReasons.has(familyOf(target.service))) {
      group.services = served;
      group.familyReason = `one page for ${served.map(service => `"${service}"`).join(" and ")}: ${familyReasons.get(familyOf(target.service))}`;
    }
    group.reference = [...new Set(group.members.map(member => member.service))].map(service => references.get(service) ?? null)
      .filter((ref): ref is ReferenceMetrics => !!ref)
      .sort((a, b) => Number(a.basis === "median") - Number(b.basis === "median") || (b.searchVolume ?? -1) - (a.searchVolume ?? -1) || a.keyword.localeCompare(b.keyword))[0] ?? null;
  }

  // Claude's split/merge pass over pages that do not exist yet; existing pages keep their keywords.
  const adjusted = new Map<string, string>();
  const reviewable = groups.filter(group => !group.page.path && !group.target)
    .sort((a, b) => (keywordScore(mainKeyword(b.members.map(m => m.row))) ?? -1) - (keywordScore(mainKeyword(a.members.map(m => m.row))) ?? -1))
    .slice(0, MAX_REVIEW);
  const decisions = await reviewGroups(project.trade, reviewable.map(group => ({ id: group.key, kind: group.kind, service: group.service, keywords: group.members.map(m => m.row.keyword) }))).catch(() => []);
  const byKey = new Map(groups.map(group => [group.key, group]));
  for (const decision of decisions) {
    const group = byKey.get(decision.id);
    if (!group) continue;
    if (decision.decision === "merge" && decision.into && decision.into !== group.key) {
      const target = byKey.get(decision.into);
      if (!target || target.kind !== group.kind || target.service !== group.service || target.page.path) continue;
      target.members.push(...group.members);
      byKey.delete(group.key);
      adjusted.set(target.key, `Claude merged in "${mainKeyword(group.members.map(m => m.row)).keyword}": ${decision.reason}`);
    } else if (decision.decision === "split" && decision.parts && decision.parts.length > 1) {
      const parts = decision.parts.map(part => group.members.filter(member => part.includes(member.row.keyword))).filter(part => part.length);
      const placed = new Set(parts.flat());
      const leftover = group.members.filter(member => !placed.has(member));
      if (parts.length < 2) continue;
      parts[0].push(...leftover);
      byKey.delete(group.key);
      parts.forEach((part, index) => {
        const key = `${group.key}#${index}`;
        byKey.set(key, { ...group, key, members: part });
        adjusted.set(key, `Claude split this from a larger group: ${decision.reason}`);
      });
    }
  }
  groups = [...byKey.values()];

  // One page-1 check per page, from the city the page is for. A recent check of the same search from the same city is
  // reused; the budget pays only for new checks: earlier failures first, then existing pages, priority services, value.
  const homeCity = servedCities.find(place => place.city.toLowerCase() === project.city.toLowerCase()) ?? { city: project.city, state: project.state };
  const checkKey = (group: DraftGroup) => `${group.target ?? mainKeyword(group.members.map(m => m.row)).keyword}|${group.city ?? homeCity.city}`;
  const previous = project.summary?.plan;
  const reusable = new Map<string, PageEvidence>();
  const failedBefore = new Set<string>();
  for (const page of previous?.pages ?? []) {
    const key = `${page.evidence?.keyword ?? page.mainKeyword}|${page.evidence?.city ?? page.city ?? homeCity.city}`;
    if (page.checkStatus === "failed") failedBefore.add(key);
    const at = page.evidence?.checkedAt ?? previous!.ranAt;
    if (page.evidence && Date.now() - new Date(at).getTime() < CHECK_REUSE_DAYS * 86_400_000) reusable.set(key, { ...page.evidence, checkedAt: at });
  }
  const evidence = new Map<string, PageEvidence>();
  const reused = new Set<string>();
  for (const group of groups) {
    const hit = reusable.get(checkKey(group));
    if (hit) {
      evidence.set(group.key, hit);
      reused.add(group.key);
    }
  }
  const ordered = groups.filter(group => !reused.has(group.key) && (!options.retryFailedOnly || failedBefore.has(checkKey(group)))).sort((a, b) =>
    Number(failedBefore.has(checkKey(b))) - Number(failedBefore.has(checkKey(a)))
    || Number(!!b.page.path) - Number(!!a.page.path)
    || Number(priorities.has(b.service)) - Number(priorities.has(a.service))
    || (keywordScore(mainKeyword(b.members.map(m => m.row))) ?? -1) - (keywordScore(mainKeyword(a.members.map(m => m.row))) ?? -1)
    || (b.reference?.avgCpc ?? b.reference?.cpc ?? 0) - (a.reference?.avgCpc ?? a.reference?.cpc ?? 0));
  const toCheck = ordered.slice(0, MAX_CHECKS);
  const locationFor = new Map<string, string>();
  for (const name of await searchLocations([homeCity, ...servedCities])) locationFor.set(name.split(",")[0].toLowerCase(), name);
  const homeLocation = locationFor.get(homeCity.city.toLowerCase()) ?? project.locationName;
  const { results: serps, failed: failedChecks } = await tolerantSearches(toCheck, async group => {
    const keyword = group.target ?? mainKeyword(group.members.map(m => m.row)).keyword;
    const city = group.city ?? homeCity.city;
    for (let attempt = 1; ; attempt += 1) {
      try {
        const result = await fetchSerp(keyword, locationFor.get(city.toLowerCase()) ?? homeLocation, 20);
        cost += result.cost;
        return { group, city, serp: result.serp };
      } catch (error) {
        if (!(error instanceof KeywordDataError) || attempt >= CHECK_ATTEMPTS) throw error;
      }
    }
  });
  const domains = [...new Set(serps.flatMap(entry => entry.serp.organic.filter(row => row.position <= 10).map(row => row.domain)))]
    .filter(domain => domain !== liveHost && !isForum(domain) && !isNotCompetitor(domain));
  const estimates = domains.length ? await fetchTrafficEstimates(domains) : { traffic: new Map<string, number>(), cost: 0 };
  cost += estimates.cost;
  for (const entry of serps) evidence.set(entry.group.key, evidenceFrom(entry.serp, entry.city, estimates.traffic, liveHost));

  // A city page is only proposed when page 1 from that city rewards city pages; otherwise its keywords fold into
  // the service's page, which can serve the city.
  for (const group of [...groups]) {
    // Existing pages and confirmed service × served city pages stay pages of their own.
    if (group.kind !== "city" || group.page.path || group.target) continue;
    const seen = evidence.get(group.key);
    if (!seen || seen.cityPages >= CITY_PAGES_REWARDED_AT) continue;
    const servicePage = servicePages.get(group.service);
    const targetKey = servicePage?.path ? `page:${servicePage.path}` : `service:${group.service}`;
    const target = groups.find(candidate => candidate.key === targetKey)
      ?? (() => {
        const created: DraftGroup = { key: targetKey, kind: "service", service: group.service, city: null, page: servicePage ?? { status: "none", path: null }, members: [] };
        groups.push(created);
        return created;
      })();
    target.members.push(...group.members);
    groups = groups.filter(candidate => candidate !== group);
    adjusted.set(target.key, `${group.city} keywords folded in: page 1 from ${group.city} shows ${seen.cityPages} city-specific results, so this page can serve it`);
  }

  const checkedKeys = new Set(toCheck.map(group => group.key));
  // A proposed service page whose page 1 is mostly articles is a blog topic, whatever its wording suggested.
  const plans: PagePlan[] = groups.map((group, index) => {
    const seen = evidence.get(group.key) ?? null;
    if (seen && group.kind === "service" && !group.page.path) {
      const articles = seen.articles ?? 0;
      if (articles >= ARTICLES_FOR_BLOG) group.kind = "blog";
    }
    return planPage(group, {
      id: `p${index + 1}`,
      evidence: seen,
      priorityService: priorities.has(group.service),
      demandArea: project.locationName.replace(/,United States$/, ""),
      siteRead: !!urls,
      adjusted: adjusted.get(group.key) ?? null,
      checkStatus: reused.has(group.key) ? "reused" : seen ? "checked" : checkedKeys.has(group.key) ? "failed" : "not_run",
    });
  }).sort(comparePages);
  plans.forEach((plan, index) => { plan.id = `p${index + 1}`; });
  const pageOf = new Map(plans.flatMap(plan => plan.keywords.map(keyword => [keyword, plan.id] as const)));
  for (const row of keywords) row.pageId = pageOf.get(row.keyword);

  const siteNote = !project.website ? "No website on the project, so existing pages were not checked."
    : urls ? null : "The website could not be read, so existing pages were not checked.";
  return {
    keywords,
    services: updatedServices,
    summary: {
      ...(project.summary ?? { ideasReturned: 0, keptKeywords: keywords.length, droppedAsJunk: 0, droppedNoVolume: 0 }),
      pageCheck: undefined,
      measurements: [...measurements.values()],
      plan: {
        ranAt: new Date().toISOString(),
        pages: plans,
        unresolved: unresolved.slice(0, 150),
        checkedCity: homeLocation.replace(/,United States$/, ""),
        siteKind,
        sitePages: urls?.length ?? null,
        siteNote,
        inventory,
        costUsd: Number(cost.toFixed(4)),
        failedChecks,
        uncheckedPages: groups.filter(group => !evidence.has(group.key) && !checkedKeys.has(group.key)).length,
        reusedChecks: reused.size,
        notJudged,
      },
    },
  };
}

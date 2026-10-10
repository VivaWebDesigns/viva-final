import { CITY_PAGES_REWARDED_AT, comparePages, draftGroups, mainKeyword, planPage, type DraftGroup, type PlannedKeyword } from "@shared/pagePlan";
import {
  keywordDemand, keywordScore,
  type KeywordResearchKeyword, type KeywordResearchSummary, type PageEvidence, type PageKind, type PageMatch, type PagePlan, type RelevanceCheck,
} from "@shared/keywordResearch";
import type { KeywordResearchProject } from "@shared/schema";
import { isNotCompetitor } from "./competitors";
import { fetchSerp, fetchTrafficEstimates } from "./dataforseo";
import { clientDomainOf, inBatches, parseCity, searchLocations } from "./discover";
import { excludedWork, stateName } from "./keywords";
import { coveringPage, evidenceFrom, isArticle, isForum, sitePages, type SitePage } from "./pageCheck";
import { meaningStems } from "./quality";
import { listSitePages, readPageHeadlines } from "./readWebsite";
import { checkRelevance, reviewGroups } from "./suggestServices";

// Keywords judged for relevance per run, by value: past this they stay on the list but outside the plan.
const MAX_RELEVANCE = 900;
const RELEVANCE_PARALLEL = 3;
const RELEVANCE_CHUNK = 150;
// Pages whose main keyword is checked on page 1. About $0.004 each.
const MAX_CHECKS = 60;
// Proposed pages sent to Claude's split/merge review.
const MAX_REVIEW = 60;
const HEADLINE_LIMIT = 150;
// A proposed service page whose page 1 holds this many articles, guides or forum threads is a blog topic.
const ARTICLES_FOR_BLOG = 6;
const QUESTION_STEMS = meaningStems("how what why when where which who can does do is are should will vs best");

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
export async function runPlan(project: KeywordResearchProject): Promise<{ keywords: KeywordResearchKeyword[]; summary: KeywordResearchSummary }> {
  let cost = 0;
  const services = project.services.filter(service => service.selected);
  const serviceNames = services.map(service => service.name);
  const priorities = new Set(services.filter(service => service.priority).map(service => service.name));
  const liveHost = clientDomainOf(project.liveDomain || project.website);
  const siteHost = clientDomainOf(project.website);
  const siteKind: "live" | "staging" = siteHost && liveHost && siteHost !== liveHost ? "staging" : "live";
  const keywords = project.keywords.map(row => ({ ...row }));

  const unresolved: Array<{ keyword: string; reason: string }> = [];
  const candidates = keywords
    .filter(row => (keywordDemand(row) ?? 0) > 0 || (row.cpc ?? 0) > 0)
    .filter(row => {
      const work = excludedWork(row.keyword, project.exclusions);
      if (work) unresolved.push({ keyword: row.keyword, reason: `names excluded work (${work})` });
      return !work;
    })
    .sort(byValue)
    .slice(0, MAX_RELEVANCE);
  const relevance = await relevanceFor(project, candidates, serviceNames);
  for (const row of keywords) row.relevance = relevance.get(row.keyword) ?? row.relevance;

  // Pages on the assessed site. Without a readable site, nothing is claimed to be missing.
  const urls = project.website ? await listSitePages(project.website) : null;
  let pages: SitePage[] = [];
  if (urls) pages = sitePages(urls, await readPageHeadlines(urls.slice(0, HEADLINE_LIMIT)));
  const servedCities = (project.serviceCities.length ? project.serviceCities : [`${project.city}, ${project.state}`])
    .map(parseCity).filter((place): place is { city: string; state: string } => !!place);
  const cityStems = new Map(servedCities.map(place => [place.city, meaningStems(place.city)] as const));
  const allCityStems = new Set([...cityStems.values()].flatMap(stems => [...stems]));
  const context = {
    servicePages: new Map(services.filter(service => service.pageUrl).map(service => [service.name, new URL(service.pageUrl!).pathname])),
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
    if (match.path) servicePages.set(service, match);
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

  const serviceStems = new Map(serviceNames.map(service => [service, meaningStems(service)] as const));
  const clusters = topicClusters(planned.filter(item => item.kind === "blog").map(item => ({ keyword: item.row.keyword, service: item.service })), serviceStems);
  let groups = draftGroups(planned, servicePages, keyword => clusters.get(keyword) ?? keyword);

  // Claude's split/merge pass over pages that do not exist yet; existing pages keep their keywords.
  const adjusted = new Map<string, string>();
  const reviewable = groups.filter(group => !group.page.path)
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

  // One page-1 check per page, from the city the page is for, highest value first.
  const ordered = [...groups].sort((a, b) =>
    Number(priorities.has(b.service)) - Number(priorities.has(a.service))
    || (keywordScore(mainKeyword(b.members.map(m => m.row))) ?? -1) - (keywordScore(mainKeyword(a.members.map(m => m.row))) ?? -1));
  const toCheck = ordered.slice(0, MAX_CHECKS);
  const homeCity = servedCities.find(place => place.city.toLowerCase() === project.city.toLowerCase()) ?? { city: project.city, state: project.state };
  const locationFor = new Map<string, string>();
  for (const name of await searchLocations([homeCity, ...servedCities])) locationFor.set(name.split(",")[0].toLowerCase(), name);
  const homeLocation = locationFor.get(homeCity.city.toLowerCase()) ?? project.locationName;
  const serps = await inBatches(toCheck, async group => {
    const main = mainKeyword(group.members.map(m => m.row));
    const city = group.city ?? homeCity.city;
    const result = await fetchSerp(main.keyword, locationFor.get(city.toLowerCase()) ?? homeLocation, 20);
    cost += result.cost;
    return { group, city, serp: result.serp };
  });
  const domains = [...new Set(serps.flatMap(entry => entry.serp.organic.filter(row => row.position <= 10).map(row => row.domain)))]
    .filter(domain => domain !== liveHost && !isForum(domain) && !isNotCompetitor(domain));
  const estimates = domains.length ? await fetchTrafficEstimates(domains) : { traffic: new Map<string, number>(), cost: 0 };
  cost += estimates.cost;
  const evidence = new Map<string, PageEvidence>();
  for (const entry of serps) evidence.set(entry.group.key, evidenceFrom(entry.serp, entry.city, estimates.traffic, liveHost));

  // A city page is only proposed when page 1 from that city rewards city pages; otherwise its keywords fold into
  // the service's page, which can serve the city.
  for (const group of [...groups]) {
    if (group.kind !== "city") continue;
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

  // A proposed service page whose page 1 is mostly articles is a blog topic, whatever its wording suggested.
  const plans: PagePlan[] = groups.map((group, index) => {
    const seen = evidence.get(group.key) ?? null;
    if (seen && group.kind === "service" && !group.page.path) {
      const articles = serps.find(entry => entry.group.key === group.key)?.serp.organic.filter(row => row.position <= 10 && isArticle(row)).length ?? 0;
      if (articles >= ARTICLES_FOR_BLOG) group.kind = "blog";
    }
    return planPage(group, {
      id: `p${index + 1}`,
      evidence: seen,
      priorityService: priorities.has(group.service),
      demandArea: project.locationName.replace(/,United States$/, ""),
      siteRead: !!urls,
      adjusted: adjusted.get(group.key) ?? null,
    });
  }).sort(comparePages);
  plans.forEach((plan, index) => { plan.id = `p${index + 1}`; });
  const pageOf = new Map(plans.flatMap(plan => plan.keywords.map(keyword => [keyword, plan.id] as const)));
  for (const row of keywords) row.pageId = pageOf.get(row.keyword);

  const siteNote = !project.website ? "No website on the project, so existing pages were not checked."
    : urls ? null : "The website could not be read, so existing pages were not checked.";
  return {
    keywords,
    summary: {
      ...(project.summary ?? { ideasReturned: 0, keptKeywords: keywords.length, droppedAsJunk: 0, droppedNoVolume: 0 }),
      pageCheck: undefined,
      plan: {
        ranAt: new Date().toISOString(),
        pages: plans,
        unresolved: unresolved.slice(0, 150),
        checkedCity: homeLocation.replace(/,United States$/, ""),
        siteKind,
        sitePages: urls?.length ?? null,
        siteNote,
        costUsd: Number(cost.toFixed(4)),
      },
    },
  };
}

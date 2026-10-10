import { keywordDemand, keywordScore, type KeywordResearchKeyword, type KeywordResearchSummary } from "@shared/keywordResearch";
import type { KeywordResearchProject } from "@shared/schema";
import { isNotCompetitor } from "./competitors";
import { fetchSerp, fetchTrafficEstimates } from "./dataforseo";
import { clientDomainOf, inBatches, searchLocations } from "./discover";
import { stateName } from "./keywords";
import { assessPageOne, coveringPage, isForum, pageTypeFromPageOne, sitePages } from "./pageCheck";
import { meaningStems } from "./quality";
import { listSitePages, readPageHeadlines } from "./readWebsite";

/** Keywords checked per run: the top by score, which carry most of the value. About $0.002 each. */
export const PAGE_CHECK_LIMIT = 75;
// Pages whose titles are read for coverage; past this, pages are matched on their URL alone.
const HEADLINE_LIMIT = 150;

/**
 * Searches the top keywords from the client's city to see what holds page 1, corrects page types page 1
 * contradicts, and matches every keyword to the client page that targets it.
 */
export async function runPageCheck(project: KeywordResearchProject): Promise<{ keywords: KeywordResearchKeyword[]; summary: KeywordResearchSummary }> {
  let cost = 0;
  const clientDomain = clientDomainOf(project.website);
  const [location = project.locationName] = await searchLocations([{ city: project.city, state: project.state }]);
  const keywords = project.keywords.map(row => ({ ...row }));
  const targets = keywords.filter(row => (keywordDemand(row) ?? 0) > 0)
    .sort((a, b) => (keywordScore(b) ?? -1) - (keywordScore(a) ?? -1) || (keywordDemand(b) ?? 0) - (keywordDemand(a) ?? 0))
    .slice(0, PAGE_CHECK_LIMIT);

  const serps = await inBatches(targets, async row => {
    const result = await fetchSerp(row.keyword, location, 10);
    cost += result.cost;
    return result.serp;
  });
  const domains = [...new Set(serps.flatMap(serp => serp.organic.filter(row => row.position <= 10).map(row => row.domain)))]
    .filter(domain => domain !== clientDomain && !isForum(domain) && !isNotCompetitor(domain));
  const estimates = domains.length ? await fetchTrafficEstimates(domains) : { traffic: new Map<string, number>(), cost: 0 };
  cost += estimates.cost;

  let movedToBlog = 0;
  targets.forEach((row, index) => {
    row.pageOne = assessPageOne(serps[index], estimates.traffic, clientDomain);
    const pageType = pageTypeFromPageOne(row, row.pageOne);
    if (pageType !== row.pageType) movedToBlog += 1;
    row.pageType = pageType;
  });

  const urls = project.website ? await listSitePages(project.website) : null;
  if (urls) {
    const pages = sitePages(urls, await readPageHeadlines(urls.slice(0, HEADLINE_LIMIT)));
    const servicePages = new Map(project.services.filter(service => service.pageUrl).map(service => [service.name, new URL(service.pageUrl!).pathname]));
    const cities = [project.city, ...(project.competitors?.searchCities ?? []).map(name => name.split(",")[0])];
    const homeStems = meaningStems([project.trade, project.city, project.state, stateName(project.state)].join(" "));
    const cityStems = meaningStems(cities.join(" "));
    for (const row of keywords) row.coveredBy = coveringPage(row, pages, { servicePages, homeStems, cityStems });
  }

  const siteNote = !project.website ? "No website on the project, so coverage was not checked."
    : urls ? null : "The website could not be read, so coverage was not checked.";
  return {
    keywords,
    summary: {
      ...(project.summary ?? { ideasReturned: 0, keptKeywords: keywords.length, droppedAsJunk: 0, droppedNoVolume: 0 }),
      pageCheck: {
        ranAt: new Date().toISOString(),
        location: location.replace(/,United States$/, ""),
        checked: targets.length,
        movedToBlog,
        sitePages: urls?.length ?? null,
        siteNote,
        costUsd: Number(cost.toFixed(4)),
      },
    },
  };
}

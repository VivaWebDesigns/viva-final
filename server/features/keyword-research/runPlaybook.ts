import { keywordDemand, keywordScore, type KeywordPlaybook, type KeywordResearchKeyword } from "@shared/keywordResearch";
import type { KeywordResearchProject } from "@shared/schema";
import {
  fetchKeywordDifficulty, fetchRankedKeywords, fetchSearchHistory, fetchSearchIntent, fetchSearchVolume, KeywordDataError, searchAreas,
  type RankedKeyword,
} from "./dataforseo";
import { applySearchIntent, classifyKeyword, cleanKeyword, isJunkKeyword, serviceMatcher } from "./keywords";
import { competitorProfile, competitorSearches, localize, placeIndex, RISING_TREND, yearOverYear, type CompetitorSearch } from "./playbook";
import { mergeCloseVariants, sameSearch } from "./quality";
import { assignServices } from "./suggestServices";

// Caps that keep one run near $1: Google Ads takes 1,000 keywords per task.
const MAX_CANDIDATES = 900;
const MAX_CLAUDE_KEYWORDS = 400;
const MAX_HISTORY_KEYWORDS = 1000;
const MAX_REVIEW = 50;

const value = (search: CompetitorSearch) => search.nationalVolume * (search.cpc ?? 0);
// Google Ads rejects phrases over 10 words or 80 characters.
const askable = (phrase: string) => phrase.length > 2 && phrase.length <= 80 && phrase.split(" ").length <= 10;

function bestPerDomain(lists: Array<Array<{ domain: string; position: number }>>) {
  const best = new Map<string, number>();
  for (const entry of lists.flat()) best.set(entry.domain, Math.min(best.get(entry.domain) ?? Infinity, entry.position));
  return [...best].map(([domain, position]) => ({ domain, position })).sort((a, b) => a.position - b.position);
}

/**
 * Turns the picked competitors' rankings into the client's plan: each competitor's keywords with their city
 * stripped, kept only when they match a confirmed service and are searched in the client's area. Also marks which
 * existing keywords competitors rank for, which nobody does, and which are searched more than a year ago.
 */
export async function buildPlaybook(project: KeywordResearchProject): Promise<{ keywords: KeywordResearchKeyword[]; playbook: KeywordPlaybook }> {
  const scan = project.competitors;
  if (!scan?.picks.length) throw new KeywordDataError("Pick at least one competitor first.");
  let cost = 0;

  const ranked = new Map<string, RankedKeyword[]>();
  await Promise.all(scan.picks.map(async domain => {
    const result = await fetchRankedKeywords(domain);
    cost += result.cost;
    ranked.set(domain, result.rows);
  }));

  const services = project.services.filter(service => service.selected).map(service => service.name);
  const ownCities = [project.city, ...scan.searchCities.map(name => name.split(",")[0])];
  const cityNames = (await searchAreas()).filter(area => area.type === "City").map(area => area.name);
  const index = placeIndex(cityNames, [...services, project.trade], ownCities);
  const searches = competitorSearches(ranked, index);

  // Which competitors rank for what the list already has, matched on the phrase without places.
  const keywords: KeywordResearchKeyword[] = project.keywords.map(row => ({ ...row, source: row.source ?? "research" }));
  const known = new Set<string>();
  for (const row of keywords) {
    const heads = [row.keyword, ...(row.variants ?? [])].map(phrase => localize(phrase, index).head);
    heads.forEach(head => known.add(head));
    row.competitors = bestPerDomain(heads.map(head => searches.get(head)?.competitors ?? []));
  }

  const candidates = [...searches.values()]
    .filter(search => !known.has(search.head) && askable(search.head) && !isJunkKeyword(search.head))
    .sort((a, b) => value(b) - value(a) || b.nationalVolume - a.nationalVolume)
    .slice(0, MAX_CANDIDATES);

  // Services: exact word matches first, Claude for the rest. No service means review, never the plan.
  const match = serviceMatcher({ services, trade: project.trade, city: project.city, state: project.state });
  const service = new Map<string, string | null>();
  const unmatched: string[] = [];
  for (const candidate of candidates) {
    const found = match(candidate.head).service;
    if (found) service.set(candidate.head, found);
    else unmatched.push(candidate.head);
  }
  const fromClaude = await assignServices(project.trade, services, unmatched.slice(0, MAX_CLAUDE_KEYWORDS));
  for (const [keyword, name] of fromClaude) service.set(cleanKeyword(keyword), name);

  // Local demand decides: a competitor's keyword nobody searches for in the client's area is dropped.
  const local = await fetchSearchVolume(candidates.map(candidate => candidate.head), project.locationName);
  cost += local.cost;
  const localRows = new Map(local.metrics.map(row => [cleanKeyword(row.keyword), row]));
  const fresh: KeywordResearchKeyword[] = [];
  const review: KeywordPlaybook["review"] = [];
  for (const candidate of candidates) {
    const row = localRows.get(candidate.head);
    if (!row?.searchVolume) continue;
    const name = service.get(candidate.head) ?? null;
    if (!name) {
      review.push({ keyword: candidate.head, searchVolume: row.searchVolume, cpc: row.cpc, competitors: candidate.competitors });
      continue;
    }
    const twin = keywords.find(existing => sameSearch(existing, { ...row, keyword: candidate.head }));
    if (twin) {
      // Google counts it as the same search as a keyword already on the list.
      twin.variants = [...new Set([...(twin.variants ?? []), candidate.head])];
      twin.competitors = bestPerDomain([twin.competitors ?? [], candidate.competitors]);
      continue;
    }
    fresh.push({
      ...row, keyword: candidate.head, nearMeVolume: null, variants: [], service: name, source: "competitor",
      competitors: candidate.competitors, ...classifyKeyword(candidate.head, project),
    });
  }
  const added = mergeCloseVariants(fresh).rows as KeywordResearchKeyword[];

  const phrases = added.map(row => row.keyword);
  if (phrases.length) {
    const [scores, intents] = await Promise.allSettled([fetchKeywordDifficulty(phrases), fetchSearchIntent(phrases)]);
    if (scores.status === "fulfilled") {
      cost += scores.value.cost;
      for (const row of added) row.difficulty = scores.value.difficulty.get(row.keyword) ?? null;
    }
    if (intents.status === "fulfilled") {
      cost += intents.value.cost;
      applySearchIntent(added, intents.value.intent);
    }
  }

  const all = [...keywords, ...added];
  const forHistory = [...all].sort((a, b) => (keywordScore(b) ?? -1) - (keywordScore(a) ?? -1)).slice(0, MAX_HISTORY_KEYWORDS);
  const history = await fetchSearchHistory(forHistory.map(row => row.keyword).filter(askable), project.locationName);
  cost += history.cost;
  for (const row of all) {
    const months = history.history.get(row.keyword);
    row.trend = months ? yearOverYear(months) : (row.trend ?? null);
  }

  all.sort((a, b) => (keywordDemand(b) ?? 0) - (keywordDemand(a) ?? 0) || a.keyword.localeCompare(b.keyword));
  const money = all.filter(row => row.pageType !== "blog" && (keywordDemand(row) ?? 0) > 0);
  return {
    keywords: all,
    playbook: {
      ranAt: new Date().toISOString(),
      domains: scan.picks.map(domain => competitorProfile(domain, ranked.get(domain) ?? [])),
      added: added.length,
      review: review.sort((a, b) => (b.searchVolume ?? 0) * (b.cpc ?? 0) - (a.searchVolume ?? 0) * (a.cpc ?? 0)).slice(0, MAX_REVIEW),
      rising: all.filter(row => (row.trend ?? 0) >= RISING_TREND && (keywordDemand(row) ?? 0) >= 30).length,
      unclaimed: money.filter(row => !row.competitors?.length).length,
      costUsd: Number(cost.toFixed(4)),
    },
  };
}

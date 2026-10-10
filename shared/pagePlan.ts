import {
  keywordDemand, keywordScore,
  type KeywordResearchKeyword, type Opportunity, type PageAction, type PageEvidence, type PageKind, type PageMatch, type PagePlan, type PlanConfidence,
} from "./keywordResearch";

/** A money keyword with no local number is still worth a look when advertisers pay this much a click. */
export const NICHE_CPC = 15;
/** Small sites plus forum threads on page 1 from which an opportunity reads as having more room. */
export const MORE_ROOM_AT = 3;
/** Top-10 results naming the checked city from which page 1 rewards a city-specific page. */
export const CITY_PAGES_REWARDED_AT = 3;

/** A keyword ready to plan: judged the client's work, with its service, page type and any page match resolved. */
export interface PlannedKeyword {
  row: KeywordResearchKeyword;
  service: string;
  kind: PageKind;
  /** For a city keyword: the served city it names. */
  city: string | null;
  match: PageMatch;
}

export interface DraftGroup {
  key: string;
  kind: PageKind;
  service: string;
  city: string | null;
  page: PageMatch;
  members: PlannedKeyword[];
}

const value = (row: KeywordResearchKeyword) => keywordScore(row);

/** Sum of searches × CPC over keywords with known numbers, and how many keywords have unknown value. */
export function groupValue(rows: KeywordResearchKeyword[]) {
  const known = rows.map(value).filter((score): score is number => score != null);
  const demand = rows.map(row => keywordDemand(row)).filter((searches): searches is number => searches != null);
  return {
    value: known.reduce((sum, score) => sum + score, 0),
    unknownValue: rows.length - known.length,
    demand: demand.length ? demand.reduce((sum, searches) => sum + searches, 0) : null,
  };
}

/**
 * First grouping: keywords on an existing page stay with that page; a service's other phrasings join the service's
 * existing page when it has one (a page that serves the service is improved before a new URL is recommended);
 * city keywords form a tentative group per served city, decided after page 1 from that city is seen; cost and blog
 * keywords group per service and topic.
 */
export function draftGroups(keywords: PlannedKeyword[], servicePages: Map<string, PageMatch>, topicKey: (keyword: string, service: string) => string): DraftGroup[] {
  const groups = new Map<string, DraftGroup>();
  const add = (key: string, base: Omit<DraftGroup, "key" | "members">, member: PlannedKeyword) => {
    const group = groups.get(key) ?? { key, ...base, members: [] };
    group.members.push(member);
    groups.set(key, group);
  };
  for (const item of keywords) {
    if (item.match.path) {
      add(`page:${item.match.path}`, { kind: item.kind, service: item.service, city: item.city, page: item.match }, item);
      continue;
    }
    const servicePage = servicePages.get(item.service);
    if (item.kind === "service") {
      if (servicePage?.path) add(`page:${servicePage.path}`, { kind: "service", service: item.service, city: null, page: servicePage }, item);
      else add(`service:${item.service}`, { kind: "service", service: item.service, city: null, page: { status: "none", path: null } }, item);
    } else if (item.kind === "city" && item.city) {
      add(`city:${item.service}:${item.city}`, { kind: "city", service: item.service, city: item.city, page: { status: "none", path: null } }, item);
    } else if (item.kind === "cost") {
      add(`cost:${item.service}`, { kind: "cost", service: item.service, city: null, page: { status: "none", path: null } }, item);
    } else {
      add(`blog:${item.service}:${topicKey(item.row.keyword, item.service)}`, { kind: "blog", service: item.service, city: null, page: { status: "none", path: null } }, item);
    }
  }
  // An existing page's group takes the kind of the page's purpose, not of whichever keyword arrived first.
  for (const group of groups.values()) {
    if (group.page.path && group.members.some(member => member.kind === "service")) group.kind = "service";
  }
  return [...groups.values()];
}

/** The keyword a page's evidence is checked for: the one with the most known value, else the most searches. */
export function mainKeyword(rows: KeywordResearchKeyword[]) {
  return [...rows].sort((a, b) => (value(b) ?? -1) - (value(a) ?? -1) || (keywordDemand(b) ?? 0) - (keywordDemand(a) ?? 0))[0];
}

export function opportunityOf(evidence: PageEvidence | null): Opportunity {
  if (!evidence) return "unchecked";
  const room = evidence.smallSites + evidence.forums;
  if (room >= MORE_ROOM_AT) return "more_room";
  if (room === 0 && evidence.unknownSites === 0) return "contested";
  return "normal";
}

export function confidenceOf(demandKnown: boolean, checked: boolean): PlanConfidence {
  return demandKnown && checked ? "high" : demandKnown || checked ? "medium" : "low";
}

const KIND_TITLES: Record<PageKind, (service: string, city: string | null) => string> = {
  service: service => `${service} service page`,
  city: (service, city) => `${service} in ${city}`,
  cost: service => `${service} cost guide`,
  blog: () => "",
};

/**
 * What to do with one page and why. An existing live page: keep when the client ranks #1–3 from the checked city,
 * otherwise improve. A staging page: review and publish. No page: recommended when it has known demand (and, for a
 * city page, page 1 from that city is mostly city-specific pages); otherwise investigate, naming what is missing.
 * Contested lowers the order, never removes the page: it means harder, not "do not build".
 */
export function planPage(group: DraftGroup, input: {
  id: string;
  evidence: PageEvidence | null;
  priorityService: boolean;
  demandArea: string;
  siteRead: boolean;
  adjusted: string | null;
}): PagePlan {
  const rows = group.members.map(member => member.row);
  const totals = groupValue(rows);
  const main = mainKeyword(rows);
  const evidence = input.evidence;
  const opportunity = opportunityOf(evidence);
  const demandKnown = (totals.demand ?? 0) > 0;
  const confidence = confidenceOf(demandKnown, !!evidence);
  const reasons: string[] = [];
  const questions: string[] = [];

  if (input.priorityService) reasons.push("priority service");
  reasons.push(demandKnown ? `${totals.demand!.toLocaleString()} searches/mo across ${rows.length} keyword${rows.length === 1 ? "" : "s"} (${input.demandArea})` : `no local volume from Google for these keywords (${input.demandArea})`);
  if (totals.unknownValue) reasons.push(`${totals.unknownValue} keyword${totals.unknownValue === 1 ? " has" : "s have"} no CPC, so value is unknown for ${totals.unknownValue === 1 ? "it" : "them"}`);
  if (evidence) {
    reasons.push(`checked "${evidence.keyword}" from ${evidence.city}: ${evidence.smallSites} small sites, ${evidence.forums} forum threads, ${evidence.unknownSites} unknown in the top 10${evidence.clientPosition ? `; client #${evidence.clientPosition}` : "; client not in the top 20"}`);
    reasons.push("the check supports this page; it does not cover every keyword or city under it");
  } else {
    questions.push(`Page 1 not checked. Check "${main.keyword}" from the client's city before acting.`);
  }
  const competitor = rows.flatMap(row => row.competitors ?? []).sort((a, b) => a.position - b.position)[0];
  if (competitor) reasons.push(`${competitor.domain} ranks #${competitor.position} for one of these (sampled rankings)`);
  if (group.page.path) reasons.push(`${group.page.status} page ${group.page.path}`);
  else if (input.siteRead) reasons.push("no page on the assessed site serves these keywords");

  let action: PageAction;
  if (group.page.status === "live" && group.page.path) {
    action = evidence?.clientPosition != null && evidence.clientPosition <= 3 ? "keep" : "improve";
  } else if (group.page.status === "staging" && group.page.path) {
    action = "staging";
    questions.push("A staging page exists. Review it before publishing; existing is not the same as ready.");
  } else if (!input.siteRead) {
    action = "investigate";
    questions.push("The website was not read, so it is unknown whether a page already exists.");
  } else if (!demandKnown && !input.priorityService) {
    action = "investigate";
    questions.push("Google has no local number for these searches. Ask the client how often they get these jobs.");
  } else if (group.kind === "city" && (!evidence || evidence.cityPages < CITY_PAGES_REWARDED_AT)) {
    action = "investigate";
    questions.push(evidence
      ? `Page 1 from ${evidence.city} shows ${evidence.cityPages} city-specific results, so the general service page may serve this city. A separate city page is not recommended yet.`
      : `Check page 1 from ${group.city} to see whether it rewards city-specific pages.`);
  } else {
    action = "recommend";
    if ((group.kind === "blog" || group.kind === "cost") && !evidence?.aiOverview) {
      // Demand alone does not make a separate post worthwhile; say what would.
      questions.push("Worth a separate page only if the client can answer it with their own prices, photos or experience.");
    }
  }
  if (opportunity === "contested" && action !== "keep") reasons.push("contested: page 1 holds no small sites or forum threads from the checked city, so this is harder, not ruled out");
  if (evidence?.mapPack) reasons.push("a map pack shows: Google Business Profile work matters here too");

  const title = group.page.path
    ? `${group.page.path}`
    : group.kind === "blog" ? main.keyword : KIND_TITLES[group.kind](group.service, group.city);
  return {
    id: input.id,
    title,
    kind: group.kind,
    service: group.service,
    city: group.city,
    action,
    page: group.page,
    mainKeyword: main.keyword,
    keywords: rows.map(row => row.keyword),
    value: totals.value,
    unknownValue: totals.unknownValue,
    demand: totals.demand,
    priorityService: input.priorityService,
    opportunity,
    confidence,
    evidence,
    reasons,
    questions,
    adjusted: input.adjusted,
  };
}

const ACTION_RANK: Record<PageAction, number> = { improve: 0, recommend: 0, staging: 1, investigate: 2, keep: 3 };
const OPPORTUNITY_RANK: Record<Opportunity, number> = { more_room: 0, normal: 1, unchecked: 2, contested: 3 };
const KIND_RANK: Record<PageKind, number> = { service: 0, city: 1, cost: 2, blog: 3 };

/**
 * Plan order: things to act on (improve, build) before staging pages, open questions and keepers; within that, the
 * client's priority services first, then service pages before city, cost and blog pages, then more room first,
 * then value. Unknown value never sorts as zero: it sorts after known value of the same rank.
 */
export function comparePages(a: PagePlan, b: PagePlan) {
  return ACTION_RANK[a.action] - ACTION_RANK[b.action]
    || Number(b.priorityService) - Number(a.priorityService)
    || KIND_RANK[a.kind] - KIND_RANK[b.kind]
    || OPPORTUNITY_RANK[a.opportunity] - OPPORTUNITY_RANK[b.opportunity]
    || b.value - a.value
    || a.unknownValue - b.unknownValue;
}

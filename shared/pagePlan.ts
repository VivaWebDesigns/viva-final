import {
  keywordDemand, keywordDemandRange, keywordScore, keywordScoreRange, possibleOverlaps,
  type KeywordResearchKeyword, type Opportunity, type PageAction, type PageEvidence, type PageKind, type PageMatch, type PageObservation, type PagePlan,
  type PlanConfidence, type ReferenceMetrics,
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
  /** A confirmed service × served city page: its target phrase is what page 1 is checked for. */
  target?: string;
  reference?: ReferenceMetrics | null;
}

const value = (row: KeywordResearchKeyword) => keywordScore(row);
const money = (amount: number | null | undefined) => (amount == null ? "not reported" : `$${amount.toFixed(2)}`);
const bids = (low: number | null | undefined, high: number | null | undefined) => (low == null && high == null ? "not reported" : `${money(low)} to ${money(high)}`);

/** A related phrase's numbers as a labelled reference, each metric separate, with its source; then the city phrase's own. */
export function describeReference(ref: ReferenceMetrics, own: KeywordResearchKeyword) {
  const from = ref.basis === "median" ? ref.keyword : `"${ref.keyword}"`;
  const where = ref.measurement
    ? ` (${ref.measurement.source}; ${ref.measurement.location}${ref.measurement.locationCode ? ` [${ref.measurement.locationCode}]` : ""}; ${ref.measurement.monthsFrom ?? "?"} to ${ref.measurement.monthsTo ?? "?"}; language ${ref.measurement.language}; ${ref.measurement.network})`
    : "";
  const avg = ref.avgCpc ?? ref.cpc ?? null;
  return `reference, not measured for this phrase: ${from}${where}: average CPC ${money(avg)}; top-of-page bid ${bids(ref.lowTopOfPageBid, ref.highTopOfPageBid)}; `
    + `paid-ad competition ${ref.competition?.toLowerCase() ?? "not reported"}; organic difficulty (US) ${ref.difficulty ?? "not reported"}. `
    + `"${own.keyword}" itself: ${own.searchVolume ?? "not reported"} searches, average CPC ${money(own.cpc)}, top-of-page bid ${bids(own.lowTopOfPageBid, own.highTopOfPageBid)}`;
}

/** Sum of searches × CPC over keywords with known numbers, and how many keywords have unknown value. */
export function groupValue(rows: KeywordResearchKeyword[]) {
  const known = rows.map(value).filter((score): score is number => score != null);
  const demand = rows.map(row => keywordDemand(row)).filter((searches): searches is number => searches != null);
  const high = rows.map(row => keywordDemandRange(row).high).filter((searches): searches is number => searches != null);
  return {
    value: known.reduce((sum, score) => sum + score, 0),
    unknownValue: rows.length - known.length,
    demand: demand.length ? demand.reduce((sum, searches) => sum + searches, 0) : null,
    demandHigh: high.length ? high.reduce((sum, searches) => sum + searches, 0) : null,
    valueHigh: rows.reduce((sum, row) => sum + (keywordScoreRange(row).high ?? 0), 0),
    overlaps: rows.reduce((sum, row) => sum + possibleOverlaps(row).length, 0),
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
  checkStatus?: PagePlan["checkStatus"];
}): PagePlan {
  const rows = group.members.map(member => member.row);
  const totals = groupValue(rows);
  const main = rows.find(row => row.keyword === group.target) ?? mainKeyword(rows);
  const grid = !!group.target;
  const evidence = input.evidence;
  const opportunity = opportunityOf(evidence);
  const demandKnown = (totals.demand ?? 0) > 0;
  const confidence = confidenceOf(demandKnown, !!evidence);
  const reasons: string[] = [];
  const questions: string[] = [];

  if (input.priorityService) reasons.push("priority service");
  if (grid) reasons.push(`confirmed service × served city: target phrase "${main.keyword}"`);
  const range = totals.demandHigh != null && totals.demandHigh > (totals.demand ?? 0) ? `${(totals.demand ?? 0).toLocaleString()}–${totals.demandHigh.toLocaleString()}` : null;
  reasons.push(demandKnown || range
    ? `${range ?? totals.demand!.toLocaleString()} searches/mo across ${rows.length} keyword${rows.length === 1 ? "" : "s"} (${input.demandArea})`
    : `searches not reported by Google Ads for these phrases (${input.demandArea})`);
  if (range) reasons.push(`the higher figure counts ${totals.overlaps} phrasing${totals.overlaps === 1 ? "" : "s"} with identical Google Ads numbers separately: identical numbers suggest one search, but Google does not confirm it`);
  if (totals.unknownValue) reasons.push(`${totals.unknownValue} keyword${totals.unknownValue === 1 ? "'s" : "s'"} CPC not reported, so value is unknown for ${totals.unknownValue === 1 ? "it" : "them"}`);
  if (group.reference) reasons.push(describeReference(group.reference, main));
  if (evidence) {
    const map = evidence.clientMapPosition != null ? `; client #${evidence.clientMapPosition} in the map pack` : evidence.mapPack ? "; client not in the map pack" : "";
    reasons.push(`checked "${evidence.keyword}" from ${evidence.city}${evidence.checkedAt ? ` on ${evidence.checkedAt.slice(0, 10)}` : ""}: ${evidence.smallSites} small sites, ${evidence.forums} forum threads, ${evidence.unknownSites} unknown in the top 10${evidence.clientPosition ? `; client #${evidence.clientPosition} in regular results` : "; client not in the top 20 regular results"}${map}`);
    reasons.push("the check supports this page; it does not cover every keyword or city under it");
  } else if (input.checkStatus === "failed") {
    questions.push(`The page-1 check for "${main.keyword}" failed at DataForSEO. The ranking is unknown, not absent; check it again.`);
  } else {
    questions.push(`Page 1 not checked. Check "${main.keyword}" from ${group.city ?? "the client's city"} before acting.`);
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
  } else if (!demandKnown && !input.priorityService && !grid) {
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
    demandHigh: totals.demandHigh,
    valueHigh: totals.valueHigh,
    possibleOverlaps: totals.overlaps,
    priorityService: input.priorityService,
    opportunity,
    confidence,
    evidence,
    reasons,
    questions,
    adjusted: input.adjusted,
    checkStatus: input.checkStatus ?? (evidence ? "checked" : "not_run"),
    reference: group.reference ?? null,
    grid,
  };
}

const ACTION_RANK: Record<PageAction, number> = { improve: 0, recommend: 0, staging: 1, investigate: 2, keep: 3 };
const OPPORTUNITY_RANK: Record<Opportunity, number> = { more_room: 0, normal: 1, unchecked: 2, contested: 3 };
const KIND_RANK: Record<PageKind, number> = { service: 0, city: 1, cost: 2, blog: 3 };

/**
 * Plan order: things to act on (improve, build) before staging pages, open questions and keepers; within that, the
 * client's priority services first, then service pages before city, cost and blog pages, then value, then the metro
 * reference CPC for pages Google reports no numbers for, then how much room page 1 showed. Room is one input, never
 * the strategy: it only breaks ties. Unknown value never sorts as zero: it sorts after known value of the same rank.
 */
export function comparePages(a: PagePlan, b: PagePlan) {
  return ACTION_RANK[a.action] - ACTION_RANK[b.action]
    || Number(b.priorityService) - Number(a.priorityService)
    || KIND_RANK[a.kind] - KIND_RANK[b.kind]
    || b.value - a.value
    || (b.reference?.avgCpc ?? b.reference?.cpc ?? 0) - (a.reference?.avgCpc ?? a.reference?.cpc ?? 0)
    || OPPORTUNITY_RANK[a.opportunity] - OPPORTUNITY_RANK[b.opportunity]
    || a.unknownValue - b.unknownValue;
}

/** Recorded evidence that belongs to a page: by its path, by a captured query among its keywords, or by its service and city. */
export function observationsFor(page: PagePlan, observations: PageObservation[]) {
  return observations.filter(item => (item.path && item.path === page.page.path)
    || (item.query && page.keywords.includes(item.query.toLowerCase()))
    || (item.kind === "city_leads" && page.kind === "city" && !!page.city && item.cities.includes(page.city))
    || (item.kind === "captured_ranking" && !item.query && !item.path && item.service === page.service && !!page.city && item.cities.includes(page.city)));
}

const SURFACE_LABELS: Record<NonNullable<PageObservation["surface"]>, string> = { organic: "regular results", map_pack: "map pack", ai_answer: "AI answer" };

export function describeObservation(item: PageObservation) {
  const when = `${item.observedOn}, ${item.source}`;
  if (item.kind === "city_leads") return `Client reports leads from ${item.cities.join(", ")} (${when})${item.note ? `: ${item.note}` : ""}`;
  if (item.kind === "page_leads") return `Leads attributed to this page (${when})${item.note ? `: ${item.note}` : ""}`;
  return `Captured search${item.query ? ` "${item.query}"` : ""}: #${item.position ?? "?"} in the ${SURFACE_LABELS[item.surface ?? "organic"]} (${when})${item.note ? `: ${item.note}` : ""}`;
}

/** Success evidence for a page: reported leads, or a captured #1–3 in regular results or an AI answer. */
const isSuccess = (item: PageObservation) => item.kind !== "captured_ranking"
  || (item.position != null && item.position <= 3 && (item.surface === "organic" || item.surface === "ai_answer"));

/**
 * A page with its recorded evidence applied. A live page with success evidence is kept: nothing replaces it without a
 * specific reason. Evidence and the page-1 check sit side by side; when they disagree the conflict is shown for
 * reconciliation, and a failed or missing check is an incomplete measurement, never "not ranking".
 */
export function withObservations(page: PagePlan, observations: PageObservation[], checkedOn: string): PagePlan {
  const mine = observationsFor(page, observations);
  if (!mine.length) return page;
  const questions = [...page.questions];
  const reasons = [...page.reasons];
  let action = page.action;
  if (page.page.status === "live" && page.page.path && mine.some(isSuccess)) {
    action = "keep";
    reasons.push("kept: success evidence is recorded for this page; no replacement is recommended without a specific reason");
  }
  const evidence = page.evidence;
  for (const item of mine) {
    if (item.kind !== "captured_ranking" || item.surface !== "organic" || item.position == null || !evidence) continue;
    if (item.query && item.query.toLowerCase() !== evidence.keyword.toLowerCase()) continue;
    const seen = evidence.clientPosition;
    if (seen == null || Math.abs(seen - item.position) >= 3) {
      questions.push(`Rankings disagree for "${evidence.keyword}": captured #${item.position} (${item.observedOn}, ${item.source}); the check from ${evidence.city} on ${checkedOn} saw ${seen == null ? "it outside the top 20" : `#${seen}`}. Both are kept. To reconcile, search it signed out in a private window from ${evidence.city}.`);
    }
  }
  if (action === "keep" && page.checkStatus !== "checked" && page.action !== "keep") {
    questions.push("The page-1 measurement is incomplete. The page stays Keep while it is re-checked.");
  }
  return { ...page, action, reasons, questions };
}

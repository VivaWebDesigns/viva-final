import {
  keywordDemand, keywordScore,
  type GridCell, type KeywordPlan, type KeywordResearchKeyword, type PageMatch, type PageOneCheck, type PlanAction, type PlanConfidence,
} from "./keywordResearch";

/** Under this difficulty a new site has a fair chance; the checklist's ceiling. */
export const EASY_DIFFICULTY = 15;
/** This many small sites or forum threads in a top 10 is evidence the keyword can be won. */
export const SMALL_SITES_FOR_EVIDENCE = 2;
/** A money keyword with no local number is still worth a look when advertisers pay this much a click. */
export const NICHE_CPC = 15;

/** The facts about a keyword that the rules need beyond the row itself. Computed by the server, never guessed here. */
export interface PlanFacts {
  /** The metro (or state) the demand number is for, for the reasons. */
  demandArea: string;
  priorityService: boolean;
  /** For a city keyword: whether the client serves that city. Null when the project lists no served cities. */
  servesCity: boolean | null;
  /** Whether the assessed site was read; without it "no page" cannot be claimed. */
  siteRead: boolean;
  /** The best-ranking picked competitor for this search, from the playbook's sampled rankings. */
  competitor: { domain: string; position: number } | null;
}

const isMoney = (row: KeywordResearchKeyword) => row.pageType !== "blog";

function bestClient(checks: PageOneCheck[]) {
  const ranked = checks.filter(check => check.clientPosition != null).sort((a, b) => a.clientPosition! - b.clientPosition!);
  return ranked[0] ?? null;
}

/** The checked city with the most small sites and forum threads on page 1, when that reaches the evidence bar. */
function easiestPageOne(checks: PageOneCheck[]) {
  const best = [...checks].sort((a, b) => b.smallSites + b.forums - (a.smallSites + a.forums))[0];
  return best && best.smallSites + best.forums >= SMALL_SITES_FOR_EVIDENCE ? best : null;
}

export function planConfidence(demandKnown: boolean, checked: boolean): PlanConfidence {
  return demandKnown && checked ? "high" : demandKnown || checked ? "medium" : "low";
}

/**
 * What to do about a keyword, in this order: keep (client ranks #1–3), improve (client at #4–20, or a live page exists
 * that does not rank), publish (a page exists only on staging), create (no page anywhere and the proxies below hold),
 * else investigate, naming the missing evidence. The reasons list every fact the decision used.
 *
 * Create proxies: a money keyword (or a blog topic), known demand in the metro, a served city for a city keyword, the
 * site was read and has no page, and at least one of: a picked competitor ranks top 10 for it, 2+ small sites or
 * forum threads on page 1 in a checked city, or (when page 1 was not checked) difficulty under 15.
 */
export function planKeyword(row: KeywordResearchKeyword, facts: PlanFacts): KeywordPlan {
  const checks = Array.isArray(row.pageOne) ? row.pageOne : [];
  const demand = keywordDemand(row);
  const demandKnown = demand != null && demand > 0;
  const match: PageMatch = row.pageMatch ?? { status: "none", path: null };
  const client = bestClient(checks);
  const easy = easiestPageOne(checks);
  // Difficulty is a national backlink proxy: it only counts when page 1 has not been seen. Seen and contested beats it.
  const difficultyEasy = row.difficulty != null && row.difficulty < EASY_DIFFICULTY && checks.length === 0;
  const competitorTop10 = facts.competitor && facts.competitor.position <= 10 ? facts.competitor : null;
  const confidence = planConfidence(demandKnown, checks.length > 0);

  const reasons: string[] = [];
  if (facts.priorityService) reasons.push("priority service");
  reasons.push(demandKnown ? `${demand.toLocaleString()}/mo in ${facts.demandArea}` : `no local volume from Google (${facts.demandArea})`);
  if (row.cpc != null) reasons.push(`$${row.cpc.toFixed(2)} CPC`);
  if (row.difficulty != null) reasons.push(`difficulty ${row.difficulty}`);
  if (client) reasons.push(`client #${client.clientPosition} from ${client.city}`);
  if (match.path) reasons.push(`${match.status} page ${match.path}`);
  else if (facts.siteRead) reasons.push("no page on the assessed site");
  else reasons.push("site not read");
  for (const check of checks) reasons.push(`page 1 from ${check.city}: ${check.smallSites} small sites, ${check.forums} forum threads, ${check.unknownSites} unknown`);
  if (!checks.length) reasons.push("page 1 not checked");
  if (facts.competitor) reasons.push(`${facts.competitor.domain} ranks #${facts.competitor.position} (sampled rankings)`);
  if (row.pageType === "city" && facts.servesCity === false) reasons.push("city not in the served list");

  const plan = (action: PlanAction, tier: number, nextCheck: string | null = null): KeywordPlan => ({ action, reasons, nextCheck, confidence, tier });

  if (client && client.clientPosition! <= 3) return plan("keep", 1);
  if (client && client.clientPosition! <= 20) return plan("improve", 1);
  if (match.status === "live" && match.path) return plan("improve", demandKnown ? 1 : 5);
  if (match.status === "staging" && match.path) return plan("publish", 4);

  const served = row.pageType !== "city" || facts.servesCity !== false;
  const evidence = competitorTop10 || easy || difficultyEasy;
  if (demandKnown && served && facts.siteRead && !match.path && evidence) {
    if (!isMoney(row)) return plan("create", 7);
    return plan("create", facts.priorityService ? 2 : 3);
  }

  // Investigate: name what is missing and the next useful check.
  if (!facts.siteRead) return plan("investigate", isMoney(row) ? 6 : 8, "Read the website (or enter its address) to see whether a page already exists.");
  if (row.pageType === "city" && facts.servesCity === false) return plan("investigate", 8, "Ask the client whether they serve this city before building a page for it.");
  if (!demandKnown) {
    const niche = isMoney(row) && (row.cpc ?? 0) >= NICHE_CPC;
    return plan("investigate", niche ? 5 : 8, "Google has no local number for this search. Ask the client how often they get these jobs; keep it if they do.");
  }
  if (!checks.length) return plan("investigate", isMoney(row) ? 6 : 8, "Check page 1 from the client's city to see who ranks and how strong they are.");
  if (!isMoney(row)) return plan("create", 7);
  return plan("investigate", 6, "Contested: no small site or forum thread in the top 10 from the checked cities. Compare the client's reviews and links with the sites that rank before building.");
}

/** Default order: tier, then cost before blog within a tier, then score; unknown score sorts by CPC. */
export function comparePlans(a: KeywordResearchKeyword, b: KeywordResearchKeyword) {
  const tierA = a.plan?.tier ?? 9;
  const tierB = b.plan?.tier ?? 9;
  if (tierA !== tierB) return tierA - tierB;
  const costFirst = Number(b.pageType === "cost") - Number(a.pageType === "cost");
  if (costFirst) return costFirst;
  const scoreA = keywordScore(a);
  const scoreB = keywordScore(b);
  if (scoreA != null || scoreB != null) return (scoreB ?? -1) - (scoreA ?? -1);
  return (b.cpc ?? 0) - (a.cpc ?? 0);
}

export interface CellFacts {
  service: string;
  city: string;
  /** A page for this service that names this city, else the general service page, else none. */
  cityPage: PageMatch | null;
  generalPage: PageMatch | null;
  checked: boolean;
  /** The client's position from this city for the service's main keyword, when checked. */
  position: number | null;
  /** Small sites plus forum threads on page 1 from this city, when checked. */
  smallSites: number | null;
  demandKnown: boolean;
  priorityService: boolean;
  competitorTop10: boolean;
}

/**
 * One service × served-city cell. A general service page can serve a city: the cell only recommends a city page
 * when the city has no page at all, demand is known, page 1 from that city was checked and shows room, or a picked
 * competitor ranks for the service. Otherwise it says what to check first.
 */
export function planCell(facts: CellFacts): GridCell {
  const page = facts.cityPage ?? facts.generalPage ?? { status: "none" as const, path: null };
  const reasons: string[] = [];
  if (facts.priorityService) reasons.push("priority service");
  if (facts.cityPage?.path) reasons.push(`${facts.cityPage.status} city page ${facts.cityPage.path}`);
  else if (facts.generalPage?.path) reasons.push(`${facts.generalPage.status} general service page ${facts.generalPage.path}`);
  else reasons.push("no page for this service");
  reasons.push(facts.checked ? `page 1 from ${facts.city}: client ${facts.position ? `#${facts.position}` : "not in top 20"}, ${facts.smallSites ?? 0} small sites or forum threads` : `page 1 not checked from ${facts.city}`);
  if (facts.competitorTop10) reasons.push("a picked competitor ranks top 10 for the service (sampled rankings)");
  if (!facts.demandKnown) reasons.push("demand known at metro level only");

  const cell = (action: PlanAction): GridCell => ({ service: facts.service, city: facts.city, page, position: facts.position, checked: facts.checked, action, reasons });
  if (facts.position != null && facts.position <= 3) return cell("keep");
  if (facts.position != null && facts.position <= 20) return cell("improve");
  if (page.status === "live" && page.path) return cell(facts.checked ? "improve" : "investigate");
  if (page.status === "staging" && page.path) return cell("publish");
  const evidence = (facts.smallSites ?? 0) >= SMALL_SITES_FOR_EVIDENCE || facts.competitorTop10;
  if (facts.demandKnown && facts.checked && evidence) return cell("create");
  return cell("investigate");
}

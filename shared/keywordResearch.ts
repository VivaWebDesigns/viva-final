export type KeywordResearchStatus = "choosing_services" | "researched";

export interface KeywordResearchService {
  name: string;
  /** "client" when typed in at intake, "website" when found on the client's site, "suggested" when Claude proposed it, "added" when typed in on the checklist. */
  source: "client" | "website" | "suggested" | "added";
  /** Page on the client's website that describes the service, when it was found there. */
  pageUrl?: string | null;
  /** Combined monthly searches for the service, "<service> <city>" and "<service> near me". Null until volumes are pulled. */
  demand: number | null;
  selected: boolean;
  /** One of the up to 3 services the client most wants more jobs for. Raises a keyword's place in the plan. */
  priority?: boolean;
  /**
   * How customers search for the service with a city, without the city ("glass shower door installer", "window repair").
   * The first is the target phrase checked on page 1 for each served city. Suggested by Claude, editable.
   */
  cityPhrases?: string[];
}

/** The page a keyword belongs on: a service page, a city page, a cost or quote page, or a blog post. */
export type KeywordPageType = "service" | "city" | "cost" | "blog";
/** Who is searching: someone hiring a pro, someone doing it themselves, or someone buying a product. */
export type KeywordIntent = "service" | "diy" | "shopping";

/**
 * Where a set of Google Ads numbers came from: the call, the geographic target Google answered for, the months
 * averaged, the language and the network. Every keyword's numbers point to one of these by id.
 */
export interface MeasurementContext {
  id: string;
  /** e.g. "Google Ads search volume (DataForSEO)" or "Google Ads keyword ideas (DataForSEO)". */
  source: string;
  /** The location asked for and the location code Google answered for. */
  location: string;
  locationCode: number | null;
  /** "en", or "all" when no language was set. */
  language: string;
  /** "Google Search" (search partners excluded) or "Google Search and partners". */
  network: string;
  /** First and last month averaged, "2025-09" to "2026-08"; null when no keyword had monthly data. */
  monthsFrom: string | null;
  monthsTo: string | null;
  fetchedAt: string;
}

/** One phrase's own Google Ads measurement, kept as returned when the phrase is grouped under another. */
export interface RawKeywordMetrics {
  measurement?: string;
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: string | null;
  lowTopOfPageBid: number | null;
  highTopOfPageBid: number | null;
  /** For a "near me" phrasing: whether its volume is counted in the plain phrase's demand (false when Google grouped it as the same search). */
  counted?: boolean;
}

export interface KeywordResearchKeyword {
  keyword: string;
  /** Id of the measurement (in the summary's measurements) this keyword's volume, CPC, bids and competition came from. */
  measurement?: string;
  /** Selected service the keyword belongs to, or null when it is related but did not match one service. */
  service: string | null;
  searchVolume: number | null;
  cpc: number | null;
  competition: string | null;
  competitionIndex: number | null;
  lowTopOfPageBid: number | null;
  highTopOfPageBid: number | null;
  /** Monthly searches for the phrase with "near me", folded in because Google answers those by location. Missing on lists built before it was added. */
  nearMeVolume?: number | null;
  /** Phrasings Google reports as the same search, merged into this keyword so demand is counted once. */
  variants?: string[];
  /** The merged variants' own measurements, unchanged. This keyword's numbers are always its own. */
  variantMetrics?: RawKeywordMetrics[];
  /** The "near me" phrasings folded in, with their own measurements. Only their volume counts toward demand. */
  nearMeMetrics?: RawKeywordMetrics[];
  /** DataForSEO's 0–100 organic ranking difficulty (US). Null when it has no score; missing on lists built before it was added. */
  difficulty?: number | null;
  pageType?: KeywordPageType;
  intent?: KeywordIntent;
  /**
   * "competitor" when the playbook added it from a picked competitor's rankings; "grid" when the plan generated it as a
   * confirmed service × served city phrase; missing for research keywords.
   */
  source?: "research" | "competitor" | "grid";
  /** Picked competitors ranking for this search (their own city stripped), best position first. Set by the playbook. */
  competitors?: Array<{ domain: string; position: number }>;
  /** Change in searches over the last 11 months against the same months a year earlier (0.4 = +40%). Set by the playbook. */
  trend?: number | null;
  /** What page 1 looks like from each checked city. Set by the page-1 check for the top keywords only. */
  pageOne?: PageOneCheck[];
  /** The page on the assessed site that targets this keyword. Missing until the page-1 check runs. */
  pageMatch?: PageMatch;
  /** What to do about this keyword and why. Set by the page-1 check. */
  plan?: KeywordPlan;
  /** The page plan this keyword belongs to. */
  pageId?: string;
  /** Claude's judgment of whether the search is work the client offers. */
  relevance?: RelevanceCheck;
}

/** Observations about page 1 from one city. Counts are evidence, not a verdict: the plan rules say what they imply. */
export interface PageOneCheck {
  city: string;
  /** The location asked for and the location code Google answered for, so a fallback is visible rather than assumed. */
  requestedLocation: string;
  returnedLocationCode: number | null;
  /** Top-10 sites with under 1,000 estimated monthly visits (directories and big brands excluded). */
  smallSites: number;
  /** Top-10 results that are forum threads. */
  forums: number;
  /** Top-10 sites whose traffic is unknown; they count as neither small nor strong. */
  unknownSites: number;
  mapPack: boolean;
  aiOverview: boolean;
  /** Top-10 results that are articles, guides or forum posts. */
  articles: number;
  clientPosition: number | null;
  clientUrl: string | null;
}

/** Whether a page exists for the keyword, and where it was found. A staging page is not published or visible in Google. */
export interface PageMatch {
  status: "live" | "staging" | "none";
  path: string | null;
}

export type PlanAction = "keep" | "improve" | "publish" | "create" | "investigate";
export type PlanConfidence = "high" | "medium" | "low";

export interface KeywordPlan {
  action: PlanAction;
  /** The facts the action rests on, in plain words. */
  reasons: string[];
  /** For investigate: the missing evidence and the next useful check, which may be a question for the client. */
  nextCheck: string | null;
  /** High: metro demand known and page 1 checked. Medium: one of the two. Low: neither. */
  confidence: PlanConfidence;
  /** Ordering tier, 1 first. See keywordPlan.ts for the rules. */
  tier: number;
}

export interface KeywordResearchSummary {
  ideasReturned: number;
  keptKeywords: number;
  droppedAsJunk: number;
  droppedNoVolume: number;
  /** Close variants merged into another keyword. Missing on lists built before it was added. */
  mergedVariants?: number;
  /** "near me" keywords folded into their plain phrase. */
  foldedNearMe?: number;
  /** Keywords kept with unknown volume because Google returned none for them. */
  unknownVolume?: number;
  /** Keywords for a confirmed service kept although Google reported no searches (none, or zero). */
  keptWithoutSearches?: number;
  /** False when the difficulty scores could not be pulled; the list is still usable without them. */
  difficultyAvailable?: boolean;
  /** Keywords dropped because they name excluded work. */
  droppedExcluded?: number;
  /** The page plan. Replaces the per-keyword pageCheck output. */
  plan?: ProjectPlan;
  /** Where the keywords' Google Ads numbers came from, by measurement id. */
  measurements?: MeasurementContext[];
  /** The user's decisions on suggested combinations, by services joined with "|". Kept across plan and research runs. */
  groupDecisions?: Record<string, import("./blueprint").GroupDecision>;
  pageCheck?: PageCheckSummary;
}

export interface PageCheckSummary {
  ranAt: string;
  /** Where the searches were run from. */
  location: string;
  /** Every city searched from; cells of other served cities read "not checked". */
  cities?: string[];
  /** Whether the assessed site is the live domain or a staging site. */
  siteKind?: "live" | "staging";
  /** Pairs of checked cities whose top-10 results were identical for most keywords: an observation, not an explanation. */
  identicalResults?: Array<[string, string]>;
  /** Service × served city assessment. */
  grid?: GridCell[];
  checked: number;
  /** Keywords moved to blog posts because page 1 is mostly articles. */
  movedToBlog: number;
  /** Pages found on the client's site, or null when it could not be read. */
  sitePages: number | null;
  siteNote: string | null;
  costUsd: number;
}

/** One cell of the service × served-city assessment: whether a page exists, whether it ranks there, and what to do. */
export interface GridCell {
  service: string;
  city: string;
  page: PageMatch;
  /** Observed from that city for the service's main keyword; null when not checked or not in the top 20. */
  position: number | null;
  checked: boolean;
  action: PlanAction;
  reasons: string[];
}

/** Searches including "near me", which Google answers by location and are counted with the plain phrase. */
export function keywordDemand(row: Pick<KeywordResearchKeyword, "searchVolume" | "nearMeVolume">) {
  if (row.searchVolume == null && row.nearMeVolume == null) return null;
  return (row.searchVolume ?? 0) + (row.nearMeVolume ?? 0);
}

/**
 * Phrasings grouped under a keyword because Google Ads gave them identical numbers: merged variants, and "near me"
 * phrasings not counted in demand. Identical numbers suggest one search but Google does not confirm it, so these are
 * possible overlaps: the low demand figure counts them once, the high figure counts them separately.
 */
export function possibleOverlaps(row: Pick<KeywordResearchKeyword, "variantMetrics" | "nearMeMetrics">) {
  return [...(row.variantMetrics ?? []), ...(row.nearMeMetrics ?? []).filter(item => item.counted === false)];
}

/** Demand with possible overlaps counted once (low) and separately (high). Null when nothing is known. */
export function keywordDemandRange(row: KeywordResearchKeyword) {
  const low = keywordDemand(row);
  const extra = possibleOverlaps(row).map(item => item.searchVolume).filter((volume): volume is number => volume != null);
  if (low == null && !extra.length) return { low: null, high: null };
  return { low: low ?? 0, high: (low ?? 0) + extra.reduce((sum, volume) => sum + volume, 0) };
}

/** Value with possible overlaps counted once (low) and separately (high, each at its own CPC). */
export function keywordScoreRange(row: KeywordResearchKeyword) {
  const low = keywordScore(row);
  const extra = possibleOverlaps(row).filter(item => item.searchVolume != null && item.cpc != null).reduce((sum, item) => sum + Math.round(item.searchVolume! * item.cpc!), 0);
  return { low, high: low == null ? (extra || null) : low + extra };
}

/** Monthly search value: searches × CPC. Null when either is unknown. */
export function keywordScore(row: Pick<KeywordResearchKeyword, "searchVolume" | "nearMeVolume" | "cpc">) {
  const demand = keywordDemand(row);
  return demand == null || row.cpc == null ? null : Math.round(demand * row.cpc);
}

/** What a site in the search results really is. Only contractors are models to copy. */
export type CompetitorSiteLabel = "contractor" | "franchise" | "manufacturer" | "retailer" | "directory" | "other";

export interface CompetitorSite {
  domain: string;
  label: CompetitorSiteLabel | null;
  /** Claude's one-line reason for the label. */
  labelReason: string | null;
  /** Position points across the local searches, weighted by each keyword's score. 0 for national-only sites. */
  localPoints: number;
  /** Local searches the site shows on page 1 or 2 for. */
  localAppearances: number;
  bestPosition: number | null;
  /** National metros (of the 12 checked) the site ranks in for the client's top services. */
  metros: number;
  /** Blog and cost keywords (of the client's top 15) the site ranks for nationally. Missing on scans before it was added. */
  contentKeywords?: number;
  /** Client services the site ranks top 10 for in discovery's searches. Missing on scans before it was added. */
  services?: string[];
  /** Organic keywords, top-10 keywords and estimated monthly traffic value (US), from DataForSEO. Null until pulled. */
  organicKeywords: number | null;
  top10Keywords: number | null;
  trafficValue: number | null;
}

export interface MapPackBusiness {
  title: string;
  domain: string | null;
  /** Local searches whose map pack showed the business. */
  appearances: number;
  rating: number | null;
  reviews: number | null;
}

export interface KeywordCompetitorScan {
  ranAt: string;
  /** Cities the local searches were run from. */
  searchCities: string[];
  localKeywords: string[];
  nationalKeywords: string[];
  contentKeywords: string[];
  /** Strongest local contractors and franchises, best first. */
  local: CompetitorSite[];
  /** Strongest contractors found anywhere (this market, the 12 metros or national content), by organic traffic value. */
  national: CompetitorSite[];
  mapPack: MapPackBusiness[];
  /** Sites labelled manufacturer, retailer, directory or other, kept out of the lists above. */
  excluded: CompetitorSite[];
  /** Domains picked for the deep keyword pull: what discovery chose, and what was confirmed. */
  autoPicks: string[];
  picks: string[];
  confirmedAt: string | null;
  /** Page-1 appearances of the client's own site across the local searches. */
  clientAppearances: number;
  costUsd: number;
  playbook?: KeywordPlaybook | null;
  /** Discovery queries dropped or held as not the client's work, with Claude's reason. */
  rejectedQueries?: Array<{ keyword: string; verdict: "no" | "uncertain"; reason: string }>;
  /** Searches DataForSEO failed on and that were skipped. */
  failedSearches?: number;
}

/** What a picked competitor's rankings look like: how much it ranks for and where its search value sits. */
export interface CompetitorProfile {
  domain: string;
  keywords: number;
  top10Keywords: number;
  /** Ranking pages, and the share of top-30 search value (searches × CPC) on blog posts. */
  pages: number;
  blogValueShare: number;
  /** Top-level folders by ranking keywords, e.g. "/maryland" 79. */
  topFolders: Array<{ folder: string; keywords: number }>;
}

export interface PlaybookReviewKeyword {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  competitors: Array<{ domain: string; position: number }>;
  /** Why it needs a decision: Claude was uncertain it is the client's work, or Google has no local volume for it. */
  reason?: "no_service" | "no_local_data" | "uncertain";
  /** Claude's reason for its relevance verdict. */
  note?: string;
}

export interface KeywordPlaybook {
  ranAt: string;
  domains: CompetitorProfile[];
  /** Competitor keywords matched to a client service and added to the list. */
  added: number;
  /** Competitor keywords with local demand that match none of the client's services: shown, never added on their own. */
  review: PlaybookReviewKeyword[];
  /** Keywords searched at least 25% more than a year ago. */
  rising: number;
  /** Money keywords with local demand that none of the picked competitors rank for. */
  unclaimed: number;
  costUsd: number;
}

/** Work the client does not do, with the search terms that name it ("auto glass": windshield, car window, safelite). */
export interface Exclusion {
  work: string;
  terms: string[];
  reason: string;
  /** "website": Claude inferred it because the site never mentions the work. "user": added by hand. */
  source: "website" | "user";
}

export type ProjectRunStep = "competitors" | "playbook" | "plan";

/** A long step running in the background. A step left "running" after a restart reads as interrupted, never resubmitted. */
export interface ProjectRun {
  step: ProjectRunStep;
  status: "running" | "done" | "failed";
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
}

/** Whether a search describes work the client offers, judged against the confirmed services and exclusions. */
export interface RelevanceCheck {
  verdict: "yes" | "no" | "uncertain";
  service: string | null;
  reason: string;
  /** Fingerprint of the confirmed services and exclusions the verdict was judged against. Reused only on an exact match. */
  basis?: string;
}

/** Fingerprint of what a relevance verdict depends on: the confirmed services and the exclusions, order ignored. */
export function relevanceBasis(services: string[], exclusions: Array<{ work: string; terms: string[] }>) {
  const text = JSON.stringify([
    [...services].map(service => service.trim().toLowerCase()).sort(),
    exclusions.map(item => `${item.work.trim().toLowerCase()}:${[...item.terms].map(term => term.trim().toLowerCase()).sort().join(",")}`).sort(),
  ]);
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) hash = ((hash * 33) ^ text.charCodeAt(index)) >>> 0;
  return `${services.length}s${exclusions.length}x-${hash.toString(36)}`;
}

export type PageKind = "service" | "city" | "cost" | "blog";
/** How promising page 1 looked for the page's main keyword from the checked city. Contested means harder, not "don't build". */
export type Opportunity = "more_room" | "normal" | "contested" | "unchecked";
export type PageAction = "keep" | "improve" | "staging" | "recommend" | "investigate";

/** The one search that was checked for a proposed page. It supports the page; it does not validate every keyword or city under it. */
export interface PageEvidence {
  keyword: string;
  city: string;
  smallSites: number;
  forums: number;
  unknownSites: number;
  /** Top-10 results whose title or address names the checked city: how much page 1 rewards city-specific pages. */
  cityPages: number;
  mapPack: boolean;
  aiOverview: boolean;
  clientPosition: number | null;
  clientUrl: string | null;
  /** The client's place in the map pack, or null when it is not there. Missing on plans before it was added. */
  clientMapPosition?: number | null;
  /** Top-10 results that are articles, guides or forum posts. */
  articles?: number;
  /** When page 1 was fetched. A check is reused by later runs for a while instead of being paid for again. */
  checkedAt?: string;
  /** Exactly how page 1 was fetched. A check is reused only when every setting matches; without them it is history only. */
  settings?: SerpSettings;
}

/** The settings a page-1 check was fetched with: the location asked for and answered, language, device, depth, and the client domain looked for. */
export interface SerpSettings {
  location: string;
  locationCode: number | null;
  language: string;
  device: string;
  depth: number;
  clientDomain: string | null;
}

export function sameSerpSettings(a: SerpSettings | undefined, b: Omit<SerpSettings, "locationCode">) {
  return !!a && a.location === b.location && a.language === b.language && a.device === b.device && a.depth === b.depth && a.clientDomain === b.clientDomain;
}

/**
 * Numbers of a related phrase, shown beside a city phrase as a labelled reference. They describe that phrase, never
 * the city phrase, whose own numbers stay as measured (often not reported). Each metric is its own field.
 */
export interface ReferenceMetrics {
  /** The phrase the numbers belong to, or "median of N hiring searches" when basis is "median". */
  keyword: string;
  /** "metro_phrase": the service searched with the metro city; "median": the median of each field across the service's hiring searches. */
  basis?: "metro_phrase" | "median";
  searchVolume: number | null;
  /** Google Ads average CPC. */
  avgCpc?: number | null;
  /** Google Ads top-of-page bid range. */
  lowTopOfPageBid?: number | null;
  highTopOfPageBid?: number | null;
  /** Google Ads paid-ad competition (LOW, MEDIUM, HIGH). Not organic difficulty. */
  competition: string | null;
  /** DataForSEO Labs organic ranking difficulty, 0–100, scored for the US. */
  difficulty: number | null;
  measurement?: MeasurementContext | null;
  /** Plans before the fields were split: the average CPC. */
  cpc?: number;
}

/**
 * Evidence about a page from outside the page-1 check, kept beside it and never overwritten by it:
 * - city_leads: the client reports leads from these cities (not tied to a page)
 * - page_leads: leads attributed to this landing page
 * - captured_ranking: a search someone captured (organic, map pack or an AI answer), with where and when
 */
export interface PageObservation {
  id: string;
  kind: "city_leads" | "page_leads" | "captured_ranking";
  surface: "organic" | "map_pack" | "ai_answer" | null;
  query: string | null;
  position: number | null;
  path: string | null;
  service: string | null;
  cities: string[];
  /** The day it was observed, YYYY-MM-DD. */
  observedOn: string;
  /** Who reported it and how, e.g. "Matt, screenshots". */
  source: string;
  note: string;
  recordedAt: string;
}

/** A page to keep, improve, publish from staging, build, or look into, with the keywords it serves. */
export interface PagePlan {
  id: string;
  title: string;
  kind: PageKind;
  service: string | null;
  city: string | null;
  action: PageAction;
  /** The existing page this plan is about, and whether it is live or only on staging. */
  page: PageMatch;
  mainKeyword: string;
  keywords: string[];
  /** Searches × CPC summed over keywords with known numbers, and how many keywords have unknown value. */
  value: number;
  unknownValue: number;
  demand: number | null;
  /** Demand and value with possible overlaps (identical Google Ads numbers, grouping not confirmed) counted separately. */
  demandHigh?: number | null;
  valueHigh?: number;
  /** Phrasings counted once in demand because Google Ads gave them identical numbers. */
  possibleOverlaps?: number;
  priorityService: boolean;
  opportunity: Opportunity;
  confidence: PlanConfidence;
  evidence: PageEvidence | null;
  reasons: string[];
  /** What is still unknown or needs a decision before acting. */
  questions: string[];
  /** Set when the client moved a keyword out to its own page or Claude split or merged the group. */
  adjusted: string | null;
  /**
   * Page 1 for the main keyword: checked this run, reused from an earlier run (see evidence.checkedAt), failed at
   * DataForSEO, or not checked (past the check budget). A failed or missing check is never "not ranking".
   */
  checkStatus?: "checked" | "reused" | "failed" | "not_run";
  /** For a city phrase Google reports nothing for: the service's metro numbers, labelled as such. */
  reference?: ReferenceMetrics | null;
  /** An earlier page-1 check of this page that was not reused (settings not recorded, or different): history, not evidence. */
  previousEvidence?: PageEvidence | null;
  /** A confirmed service × served city page: kept in the plan whatever Google reports for its phrases. */
  grid?: boolean;
  /** What the page-1 check alone decided, before recorded evidence was applied. `action` is the final, evidence-adjusted one. */
  base?: { action: PageAction; reasons: string[]; questions: string[] };
  /** Whether recorded evidence changed the action from the check's own. */
  evidenceApplied?: boolean;
}

/** One page of the assessed site as read: what it is about, for which services and places, and how much was read. */
export interface InventoryPage {
  path: string;
  title: string;
  h1: string;
  /** Words of main content read; 0 when the page was not read (past the read limit or it failed to load). */
  words: number;
  textSource: "html" | "embedded" | null;
  /** service, city (a page for one place), cost, article, or other (home, about, listing pages). */
  kind: "service" | "city" | "cost" | "article" | "other";
  /** Confirmed services the page's title, main heading or section headings name. */
  services: string[];
  /** Served cities the page's address, title or main heading names. */
  cities: string[];
}

/** Services that may be one customer need, proposed for review with their evidence. Never applied on its own. */
export interface GroupSuggestion {
  services: string[];
  /** page_names_both: an existing page's own title or main heading names both. page_body_covers_both: the page's own
   * body text covers the second service (quoted). intake_match: the intake matched both to one page (a guess).
   * identical_numbers: identical Google Ads numbers for their metro phrases (possible overlap). */
  strength: "page_names_both" | "page_body_covers_both" | "intake_match" | "identical_numbers";
  evidence: string[];
  /** The separate pages it would combine, per city (or the service pages when there is no city). */
  pages: Array<{ city: string | null; pageIds: string[] }>;
}

export interface ProjectPlan {
  ranAt: string;
  /** Pages with recorded evidence applied: `action` is final; `base` keeps what the page-1 check alone decided. */
  pages: PagePlan[];
  /** Addresses, build phases, evidence status and approved combinations, generated from the pages. */
  blueprint?: import("./blueprint").Blueprint;
  /** Possible combined pages for review. Missing on plans before it was added. */
  groupSuggestions?: GroupSuggestion[];
  /** Every page found on the assessed site, as read. Missing on plans before it was added. */
  inventory?: InventoryPage[];
  /** Keywords held back: relevance uncertain, or no service. */
  unresolved: Array<{ keyword: string; reason: string }>;
  checkedCity: string;
  siteKind: "live" | "staging";
  sitePages: number | null;
  siteNote: string | null;
  costUsd: number;
  /** Page-1 checks DataForSEO failed on; those pages read as unchecked. */
  failedChecks?: number;
  /** Pages past the page-1 check budget: kept in the plan, read as not checked. */
  uncheckedPages?: number;
  /** Pages whose page-1 check was reused from an earlier run (within 14 days) instead of paid for again. */
  reusedChecks?: number;
  /** The last retry of failed checks on this plan: when, how many were tried, how many recovered. */
  retriedAt?: string;
  retried?: { attempted: number; recovered: number; stillFailed: number };
  /** Keywords with no matched service left unjudged this run (past the review budget). Still on the list. */
  notJudged?: number;
}

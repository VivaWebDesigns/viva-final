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
}

/** The page a keyword belongs on: a service page, a city page, a cost or quote page, or a blog post. */
export type KeywordPageType = "service" | "city" | "cost" | "blog";
/** Who is searching: someone hiring a pro, someone doing it themselves, or someone buying a product. */
export type KeywordIntent = "service" | "diy" | "shopping";

export interface KeywordResearchKeyword {
  keyword: string;
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
  /** DataForSEO's 0–100 organic ranking difficulty (US). Null when it has no score; missing on lists built before it was added. */
  difficulty?: number | null;
  pageType?: KeywordPageType;
  intent?: KeywordIntent;
  /** "competitor" when the playbook added it from a picked competitor's rankings; missing for research keywords. */
  source?: "research" | "competitor";
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
  /** Service phrases kept with unknown volume because Google returned none for them. */
  unknownVolume?: number;
  /** False when the difficulty scores could not be pulled; the list is still usable without them. */
  difficultyAvailable?: boolean;
  /** Keywords dropped because they name excluded work. */
  droppedExcluded?: number;
  /** The page plan. Replaces the per-keyword pageCheck output. */
  plan?: ProjectPlan;
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
  priorityService: boolean;
  opportunity: Opportunity;
  confidence: PlanConfidence;
  evidence: PageEvidence | null;
  reasons: string[];
  /** What is still unknown or needs a decision before acting. */
  questions: string[];
  /** Set when the client moved a keyword out to its own page or Claude split or merged the group. */
  adjusted: string | null;
}

export interface ProjectPlan {
  ranAt: string;
  pages: PagePlan[];
  /** Keywords held back: relevance uncertain, or no service. */
  unresolved: Array<{ keyword: string; reason: string }>;
  checkedCity: string;
  siteKind: "live" | "staging";
  sitePages: number | null;
  siteNote: string | null;
  costUsd: number;
}

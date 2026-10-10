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
}

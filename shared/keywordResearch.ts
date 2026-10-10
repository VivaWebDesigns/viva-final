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

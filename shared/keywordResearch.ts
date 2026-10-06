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
}

export interface KeywordResearchSummary {
  ideasReturned: number;
  keptKeywords: number;
  droppedAsJunk: number;
  droppedNoVolume: number;
}

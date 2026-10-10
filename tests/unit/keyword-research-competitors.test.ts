import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { CompetitorSite, CompetitorSiteLabel, KeywordResearchKeyword } from "@shared/keywordResearch";
import {
  assembleScan, candidateDomains, discoveryCandidates, discoveryKeywords, isNotCompetitor, mapPackLeaders, scoreLocal, scoreNational, serviceWeights, spreadPicks,
} from "../../server/features/keyword-research/competitors";
import type { DomainStrength, SerpResult } from "../../server/features/keyword-research/dataforseo";
import { clientDomainOf, tolerantSearches } from "../../server/features/keyword-research/discover";
import { KeywordDataError } from "../../server/features/keyword-research/dataforseo";
import { kkcGlass } from "../fixtures/keyword-research/kkcGlass";

const dir = path.resolve(import.meta.dirname, "../fixtures/keyword-research/kkc-glass");
const load = <T>(name: string): T => JSON.parse(readFileSync(path.join(dir, name), "utf8"));

type SavedSerp = { keyword: string; location: string; organic: Array<{ position: number; domain: string }>; localPack: Array<{ title: string; domain: string | null; reviews: number | null }> };
const serps: SerpResult[] = load<{ serps: SavedSerp[] }>("serps.json").serps.map(serp => ({
  keyword: serp.keyword,
  locationName: serp.location,
  organic: serp.organic.map(row => ({ position: row.position, domain: row.domain.replace(/^www\./, ""), title: null })),
  localPack: serp.localPack.map(row => ({ title: row.title, domain: row.domain?.replace(/^www\./, "") ?? null, rating: null, reviews: row.reviews })),
}));
const localSerps = serps.filter(serp => serp.locationName.startsWith("Charlotte"));
const metroSerps = serps.filter(serp => !serp.locationName.startsWith("Charlotte"));
const strength = new Map(Object.entries(load<{ domains: Record<string, DomainStrength> }>("strength.json").domains));
const content = load<{ domains: Array<{ domain: string; keywords: number }> }>("content.json").domains;

describe("discovery keywords", () => {
  const row = (keyword: string, service: string | null, pageType: KeywordResearchKeyword["pageType"], searchVolume: number, cpc: number | null, intent: KeywordResearchKeyword["intent"] = "service") =>
    ({ keyword, service, pageType, intent, searchVolume, cpc, competition: null, competitionIndex: null, lowTopOfPageBid: null, highTopOfPageBid: null }) as KeywordResearchKeyword;
  const yes = (service: string) => ({ verdict: "yes" as const, service, reason: "" });
  const keywords = [
    row("window replacement", "window replacement", "service", 1280, 78),
    row("window replacement charlotte", "window replacement", "city", 480, 84),
    row("commercial door repair", "commercial door repair", "service", 70, 66),
    row("storefront glass repair", "storefront glass repair", "service", 20, null),
    row("repair car window", "window repair", "service", 900, 30),
    row("window repair", "window repair", "service", 800, 20),
    row("window replacement cost", "window replacement", "cost", 300, 12),
  ];
  const relevance = new Map([
    ["window replacement", yes("window replacement")], ["window replacement charlotte", yes("window replacement")],
    ["commercial door repair", yes("commercial door repair")], ["storefront glass repair", yes("storefront glass repair")],
    ["window repair", yes("window repair")], ["window replacement cost", yes("window replacement")],
    ["repair car window", { verdict: "no" as const, service: null, reason: "auto glass" }],
  ]);
  const services = ["window replacement", "window repair", "commercial door repair", "storefront glass repair"];

  it("gives every confirmed service its own local and national search, however small its value", () => {
    const searches = discoveryKeywords(keywords, services, relevance);
    for (const keyword of ["commercial door repair", "storefront glass repair", "window repair", "window replacement"]) expect(searches.local).toContain(keyword);
    expect(searches.national).toEqual(["window replacement", "window repair", "commercial door repair", "storefront glass repair"]);
    expect(searches.content).toEqual(["window replacement cost"]);
  });

  it("never searches a keyword Claude judged not to be the client's work, whatever its words match", () => {
    const searches = discoveryKeywords(keywords, services, relevance);
    expect([...searches.local, ...searches.national]).not.toContain("repair car window");
  });

  it("weights each service equally, and counts unknown value like the service's best rather than zero", () => {
    const weights = serviceWeights(keywords, discoveryKeywords(keywords, services, relevance).serviceOf);
    expect(weights.get("window replacement")).toBe(1000);
    expect(weights.get("commercial door repair")).toBe(1000);
    expect(weights.get("storefront glass repair")).toBe(1000);
    expect(weights.get("window replacement charlotte")).toBeGreaterThan(weights.get("window replacement cost")!);
  });

  it("checks the best few keywords of every service for relevance before choosing", () => {
    const candidates = discoveryCandidates(keywords, services);
    expect(candidates).toContain("storefront glass repair");
    expect(candidates).toContain("repair car window");
  });
});

describe("spread picks", () => {
  const site = (domain: string, services: string[]) => ({ domain, services, label: "contractor" }) as CompetitorSite;

  it("takes the leader, then a site covering a service the leader does not", () => {
    const ranked = [site("windownation.com", ["window replacement"]), site("windowsource.com", ["window replacement", "window repair"]), site("binswanger.com", ["commercial door repair"])];
    expect(spreadPicks(ranked, []).map(pick => pick.domain)).toEqual(["windownation.com", "windowsource.com"]);
    expect(spreadPicks(ranked, ["window replacement", "window repair"]).map(pick => pick.domain)).toEqual(["windownation.com", "binswanger.com"]);
  });
});

describe("local scoring", () => {
  const serp = (keyword: string, domains: string[]): SerpResult => ({ keyword, locationName: "Matthews,North Carolina,United States", organic: domains.map((domain, index) => ({ position: index + 1, domain, title: null })), localPack: [] });

  it("weights a ranking by the keyword's score and skips directories and the client", () => {
    const { standings, clientAppearances } = scoreLocal([
      serp("big", ["yelp.com", "kkcglass.com", "a.com"]),
      serp("small", ["b.com", "a.com"]),
    ], new Map([["big", 40000], ["small", 500]]), "kkcglass.com");
    expect(standings.has("yelp.com")).toBe(false);
    expect(clientAppearances).toBe(1);
    expect(standings.get("a.com")!.points).toBeGreaterThan(standings.get("b.com")!.points);
    expect(standings.get("a.com")).toMatchObject({ appearances: 2, bestPosition: 2 });
  });

  it("reads the client's domain from its website however it was typed", () => {
    expect(clientDomainOf("https://www.KKCglass.com/contact")).toBe("kkcglass.com");
    expect(clientDomainOf("kkcglass.com")).toBe("kkcglass.com");
    expect(clientDomainOf(null)).toBeNull();
  });
});

// Replays the saved KKC Glass searches and checks discovery lands on the answers reviewed by hand.
describe("KKC Glass discovery", () => {
  const client = kkcGlass.client.domain;
  const local = scoreLocal(localSerps, new Map(), client);
  const national = scoreNational(metroSerps, content, client);
  const mapPack = mapPackLeaders(localSerps, client);
  const candidates = candidateDomains(local.standings, national, mapPack);
  // Sites not reviewed by hand are treated as contractors, the label that makes picking hardest.
  const labels = new Map(candidates.map(domain => [domain, {
    label: (kkcGlass.siteLabels as Record<string, CompetitorSiteLabel>)[domain] ?? "contractor",
    reason: "",
  }]));
  const scan = assembleScan({ candidates, local: local.standings, national, labels, strength });

  it("never treats a directory as a candidate", () => {
    expect(candidates.filter(isNotCompetitor)).toEqual([]);
  });

  it("measures every reviewed contractor that matters", () => {
    for (const domain of [...kkcGlass.expectedBenchmarks, "glasssolutionsnc.com"]) expect(candidates).toContain(domain);
  });

  it("keeps manufacturers and retailers out of both lists", () => {
    const listed = [...scan.local, ...scan.national].map(site => site.domain);
    for (const [domain, label] of Object.entries(kkcGlass.siteLabels)) {
      if (label !== "contractor" && label !== "franchise") expect(listed).not.toContain(domain);
    }
  });

  it("shows the franchise as a local leader but never picks it", () => {
    expect(scan.local.map(site => site.domain)).toContain("glassdoctor.com");
    expect(scan.autoPicks).not.toContain("glassdoctor.com");
  });

  it("picks the reviewed benchmarks", () => {
    for (const domain of kkcGlass.expectedBenchmarks) expect(scan.autoPicks).toContain(domain);
    expect(scan.autoPicks).toHaveLength(4);
  });

  it("lists Shower Doors of Charlotte's 1,100 reviews among the map pack leaders", () => {
    expect(mapPack.find(business => business.domain === "showerdoorsofcharlotte.com")?.reviews).toBe(1100);
  });
});

describe("tolerant searches", () => {
  it("skips a search DataForSEO fails on and keeps the rest", async () => {
    const { results, failed } = await tolerantSearches([1, 2, 3, 4, 5], async item => {
      if (item === 3) throw new KeywordDataError("DataForSEO: Internal SE Server Error.");
      return item * 10;
    });
    expect(results).toEqual([10, 20, 40, 50]);
    expect(failed).toBe(1);
  });

  it("gives up when more than a quarter of the searches fail", async () => {
    await expect(tolerantSearches([1, 2, 3, 4], async item => {
      if (item <= 2) throw new KeywordDataError("down");
      return item;
    })).rejects.toThrow(/failed on 2 of 4/);
  });
});

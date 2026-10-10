import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { CompetitorSiteLabel, KeywordResearchKeyword } from "@shared/keywordResearch";
import {
  assembleScan, candidateDomains, discoveryKeywords, isNotCompetitor, mapPackLeaders, scoreLocal, scoreNational,
} from "../../server/features/keyword-research/competitors";
import type { DomainStrength, SerpResult } from "../../server/features/keyword-research/dataforseo";
import { clientDomainOf } from "../../server/features/keyword-research/discover";
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
  const row = (keyword: string, pageType: KeywordResearchKeyword["pageType"], searchVolume: number, cpc: number, intent: KeywordResearchKeyword["intent"] = "service") =>
    ({ keyword, pageType, intent, searchVolume, cpc, service: null, competition: null, competitionIndex: null, lowTopOfPageBid: null, highTopOfPageBid: null }) as KeywordResearchKeyword;
  const keywords = [
    row("frameless shower doors", "service", 1000, 9),
    row("glass shower doors matthews nc", "city", 40, 12),
    row("frameless shower door cost", "cost", 900, 6),
    row("buy shower door kit", "service", 3000, 2, "shopping"),
    row("how to fix foggy windows", "blog", 1300, 2, "diy"),
  ];

  it("searches the best keyword of each service nationally before a second keyword of any one service", () => {
    const service = (keyword: string, name: string, searchVolume: number) => ({ ...row(keyword, "service", searchVolume, 10), service: name });
    const lines = [
      service("window glass replacement", "window glass repair", 5000),
      service("window glass repair", "window glass repair", 4000),
      service("foggy window repair", "window glass repair", 3000),
      service("window repair", "window glass repair", 2500),
      service("frameless shower doors", "frameless shower doors", 1000),
      service("glass railings", "glass railings", 500),
    ];
    expect(discoveryKeywords(lines).national).toEqual(["window glass replacement", "frameless shower doors", "glass railings", "window glass repair"]);
  });

  it("searches money keywords locally, plain hiring keywords nationally and blog and cost keywords for content", () => {
    expect(discoveryKeywords(keywords)).toEqual({
      local: ["frameless shower doors", "buy shower door kit", "glass shower doors matthews nc"],
      national: ["frameless shower doors"],
      content: ["frameless shower door cost", "how to fix foggy windows"],
    });
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

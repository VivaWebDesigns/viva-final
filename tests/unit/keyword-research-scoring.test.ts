import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { keywordDemand, keywordScore, type KeywordResearchKeyword } from "@shared/keywordResearch";
import type { KeywordMetrics } from "../../server/features/keyword-research/dataforseo";
import { applySearchIntent, buildKeywordList, classifyKeyword, pickSearchArea } from "../../server/features/keyword-research/keywords";

const place = { city: "Matthews", state: "NC" };
const metrics = (keyword: string, searchVolume: number | null, cpc: number | null = null): KeywordMetrics => ({
  keyword, searchVolume, cpc, competition: null, competitionIndex: null, lowTopOfPageBid: null, highTopOfPageBid: null,
});

describe("page type and intent", () => {
  it.each([
    ["frameless shower doors", "service", "service"],
    ["sliding door repair", "service", "service"],
    ["glass shower doors matthews nc", "city", "service"],
    ["window repair north carolina", "city", "service"],
    ["frameless shower door cost", "cost", "service"],
    ["how much does a shower door cost", "cost", "service"],
    ["metal roof vs shingles", "blog", "service"],
    ["what is a float switch", "blog", "service"],
    ["water leaking from ceiling", "blog", "service"],
    ["leaking shower door repair", "service", "service"],
    ["how to fix foggy windows", "blog", "diy"],
    ["diy shower door install", "blog", "diy"],
    ["buy frameless shower door kit", "service", "shopping"],
  ])("%s → %s page, %s intent", (keyword, pageType, intent) => {
    expect(classifyKeyword(keyword, place)).toEqual({ pageType, intent });
  });

  it("treats another state's abbreviation as a place only for that project", () => {
    expect(classifyKeyword("plumber eden prairie mn", { city: "Burnsville", state: "MN" }).pageType).toBe("city");
  });

  it("turns informational bare topics into blog posts but leaves hiring searches alone", () => {
    const rows = [
      { keyword: "air exchanger", service: null, pageType: "service" },
      { keyword: "air exchanger installation", service: null, pageType: "service" },
      { keyword: "glass shower doors matthews nc", service: null, pageType: "city" },
      // Google's real label for this money keyword is informational (2026-10-10).
      { keyword: "frameless shower doors", service: "frameless shower doors", pageType: "service" },
    ] as KeywordResearchKeyword[];
    applySearchIntent(rows, new Map(rows.map(row => [row.keyword, "informational"])));
    expect(rows.map(row => row.pageType)).toEqual(["blog", "service", "city", "service"]);
  });
});

// Real rankings: which keywords Hook client sites win with blog posts versus service and city pages.
describe("blog calls against Hook client rankings", () => {
  const { rows } = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../fixtures/keyword-research/blogRankings.json"), "utf8")) as {
    rows: Array<{ keyword: string; rankedOnBlog: boolean; intent: string | null; city: string; state: string }>;
  };
  const called = rows.map(row => {
    const keyword = { keyword: row.keyword, service: null, ...classifyKeyword(row.keyword, row) } as KeywordResearchKeyword;
    if (row.intent) applySearchIntent([keyword], new Map([[row.keyword, row.intent]]));
    return { ...row, blog: keyword.pageType === "blog" || keyword.pageType === "cost" };
  });
  const found = called.filter(row => row.rankedOnBlog && row.blog).length;

  it("is right at least 88% of the time it says blog or cost page", () => {
    expect(found / called.filter(row => row.blog).length).toBeGreaterThanOrEqual(0.88);
  });

  it("finds at least 65% of the keywords that rank on blog posts", () => {
    expect(found / called.filter(row => row.rankedOnBlog).length).toBeGreaterThanOrEqual(0.65);
  });
});

describe("keyword list", () => {
  const input = { services: ["shower door installation", "foggy window repair"], trade: "glass", city: "Matthews", state: "NC" };

  it("keeps how-to and DIY questions as blog topics but still drops job searches", () => {
    const { keywords } = buildKeywordList([
      metrics("how to fix foggy windows", 1300, 2.1),
      metrics("shower door installation jobs", 90, 1.2),
      metrics("shower door installation", 1000, 9),
    ], input);
    expect(keywords.map(row => [row.keyword, row.pageType, row.intent])).toEqual([
      ["how to fix foggy windows", "blog", "diy"],
      ["shower door installation", "service", "service"],
    ]);
  });
});

describe("score", () => {
  it("is searches including near me times CPC", () => {
    expect(keywordDemand({ searchVolume: 880, nearMeVolume: 1600 })).toBe(2480);
    expect(keywordScore({ searchVolume: 880, nearMeVolume: 1600, cpc: 15.5 })).toBe(38440);
  });

  it("is unknown when searches or CPC are unknown", () => {
    expect(keywordScore({ searchVolume: null, nearMeVolume: null, cpc: 9 })).toBeNull();
    expect(keywordScore({ searchVolume: 500, cpc: null })).toBeNull();
  });
});

describe("default search area", () => {
  const areas = [
    { name: "Charlotte, NC,United States", type: "DMA Region" },
    { name: "North Carolina,United States", type: "State" },
    { name: "Matthews,North Carolina,United States", type: "City" },
  ];

  it("uses the metro area Claude picked when Google has it", () => {
    expect(pickSearchArea(areas, place, "Charlotte, NC,United States")).toBe("Charlotte, NC,United States");
  });

  it("falls back to the state when the pick is missing or not a real metro", () => {
    expect(pickSearchArea(areas, place, null)).toBe("North Carolina,United States");
    expect(pickSearchArea(areas, place, "Charlotte Metro")).toBe("North Carolina,United States");
    expect(pickSearchArea(areas, place, "Matthews,North Carolina,United States")).toBe("North Carolina,United States");
  });

  it("uses the city only when Google has neither", () => {
    expect(pickSearchArea([], place, null)).toBe("Matthews,North Carolina,United States");
  });
});

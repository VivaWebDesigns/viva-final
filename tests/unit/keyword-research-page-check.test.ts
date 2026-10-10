import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { KeywordResearchKeyword } from "@shared/keywordResearch";
import type { SerpResult } from "../../server/features/keyword-research/dataforseo";
import { assessPageOne, coveringPage, isArticle, pageTypeFromPageOne, sitePages } from "../../server/features/keyword-research/pageCheck";
import { meaningStems } from "../../server/features/keyword-research/quality";

const organic = (rows: Array<[string, string, string?]>) => rows.map(([domain, url, title], index) => ({ position: index + 1, domain, url, title: title ?? null }));
const serp = (rows: Array<[string, string, string?]>, extra: Partial<SerpResult> = {}): SerpResult => ({ keyword: "k", locationName: "Matthews,North Carolina,United States", organic: organic(rows), localPack: [], ...extra });

// Page 1 for "how to fix foggy windows" from Matthews, NC on 2026-10-10.
const foggy = serp([
  ["reddit.com", "https://www.reddit.com/r/HomeMaintenance/comments/1ei79xx/windows_are_permanently_fogged_cleaned_both/"],
  ["binswangerglass.com", "https://www.binswangerglass.com/blog/foggy-window-repair/"],
  ["facebook.com", "https://www.facebook.com/groups/143500329685716/posts/1599473767421691/"],
  ["argowindowrepair.com", "https://argowindowrepair.com/blog/glass/foggy-windows"],
  ["thespruce.com", "https://www.thespruce.com/fogged-windows-repair-options-1822911"],
  ["quora.com", "https://www.quora.com/Can-fogged-windows-be-fixed"],
  ["diychatroom.com", "https://www.diychatroom.com/threads/defogging-double-pane-windows-a-gimmick.3301/"],
  ["facebook.com", "https://www.facebook.com/groups/1484016468494795/posts/4235446523351762/"],
], { aiOverview: true });
const traffic = new Map([["binswangerglass.com", 423_407], ["argowindowrepair.com", 11_896], ["thespruce.com", 9_000_000], ["glassanddoorpro.com", 38], ["theshowerglass.com", 219]]);

describe("page 1", () => {
  it("counts what a forum-heavy page 1 holds without calling it a verdict", () => {
    expect(assessPageOne(foggy, traffic, "kkcglass.com", "Matthews")).toEqual({
      city: "Matthews", requestedLocation: "Matthews,North Carolina,United States", returnedLocationCode: null,
      smallSites: 0, forums: 5, unknownSites: 0, mapPack: false, aiOverview: true, articles: 8, clientPosition: null, clientUrl: null,
    });
  });

  it("moves a service keyword to the blog when page 1 is mostly articles, and leaves city keywords alone", () => {
    const check = assessPageOne(foggy, traffic, null, "Matthews");
    expect(pageTypeFromPageOne({ pageType: "service" } as KeywordResearchKeyword, check)).toBe("blog");
    expect(pageTypeFromPageOne({ pageType: "city" } as KeywordResearchKeyword, check)).toBe("city");
  });

  it("finds the client and its page, and leaves directories out of the counts", () => {
    const strong = serp([
      ["yelp.com", "https://www.yelp.com/search?find_desc=glass"],
      ["argowindowrepair.com", "https://argowindowrepair.com/north-carolina/window-repair-charlotte"],
      ["kkcglass.com", "https://kkcglass.com/"],
      ["binswangerglass.com", "https://www.binswangerglass.com/locations/charlotte"],
    ], { localPack: [{ title: "Glass & Door Pro", domain: "glassanddoorpro.com", rating: 5, reviews: 86 }] });
    expect(assessPageOne(strong, traffic, "kkcglass.com", "Matthews")).toMatchObject({ smallSites: 0, unknownSites: 0, mapPack: true, clientPosition: 3, clientUrl: "https://kkcglass.com/" });
  });

  it("counts small sites and unknown sites separately, so unknown never reads as weak", () => {
    const mixed = serp([["glassanddoorpro.com", "https://glassanddoorpro.com/"], ["theshowerglass.com", "https://theshowerglass.com/"], ["newglassco.com", "https://newglassco.com/"], ["argowindowrepair.com", "https://argowindowrepair.com/"]]);
    expect(assessPageOne(mixed, traffic, null, "Matthews")).toMatchObject({ smallSites: 2, unknownSites: 1, forums: 0 });
  });

  it("recognises articles by path, publisher, forum or question title", () => {
    expect(isArticle({ domain: "kkcglass.com", url: "https://kkcglass.com/services/window-repair", title: "Window Repair in Charlotte" })).toBe(false);
    expect(isArticle({ domain: "kkcglass.com", url: "https://kkcglass.com/foggy-windows", title: "Why Do Windows Fog Up?" })).toBe(true);
  });
});

// The KKC Glass staging site's real pages and titles.
describe("coverage on the KKC staging site", () => {
  const { pages: saved } = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../fixtures/keyword-research/kkc-glass/site.json"), "utf8")) as { pages: Array<{ url: string; headline: string | null }> };
  const pages = sitePages(saved.map(page => page.url), new Map(saved.filter(page => page.headline).map(page => [page.url, page.headline!])));
  const context = {
    servicePages: new Map([["frameless shower doors", "/services/frameless-shower-enclosures"]]),
    homeStems: meaningStems("glass matthews nc north carolina"),
    cityStems: meaningStems("matthews charlotte concord"),
  };
  const page = (keyword: string, pageType: KeywordResearchKeyword["pageType"], service: string | null = null) =>
    coveringPage({ keyword, pageType, service } as KeywordResearchKeyword, pages, context);

  it("finds the service page for its service keyword", () => {
    expect(page("frameless shower doors", "service", "frameless shower doors")).toBe("/services/frameless-shower-enclosures");
  });

  it("finds pages by their titles, not just their URLs", () => {
    expect(page("sash replacement", "service")).toBe("/services/sash-replacement");
    expect(page("glass shower doors matthews nc", "city")).toBe("/service-areas/matthews-nc");
  });

  it("needs every word that names the thing, not just most of them", () => {
    // The "Glass Door Repair & Installation" page is not about shower doors or sliding doors.
    expect(page("glass shower door installation", "service")).toBeNull();
    expect(page("sliding glass door repair", "service")).toBeNull();
    expect(page("commercial glass repairs", "service")).toBe("/services/commercial-glass-services");
  });

  it("never lets a listing page or another city's page cover a general keyword", () => {
    // /service-areas and /service-areas/monroe-nc both say "Glass Shower Door" in their titles.
    expect(page("shower door", "service")).toBeNull();
  });

  it("requires a city keyword's page to name that city", () => {
    expect(page("glass shower doors concord", "city")).toBeNull();
  });

  it("reports no page for work the site does not cover", () => {
    expect(page("frameless shower door cost", "cost")).toBeNull();
    expect(page("how to fix foggy windows", "blog")).toBeNull();
  });

  it("matches a cost keyword only to a page about prices, and a blog topic only to an article", () => {
    const extra = sitePages(["https://kkcglass.com/frameless-shower-door-cost", "https://kkcglass.com/blog/fix-foggy-windows"]);
    const find = (keyword: string, pageType: KeywordResearchKeyword["pageType"]) => coveringPage({ keyword, pageType, service: null } as KeywordResearchKeyword, [...pages, ...extra], context);
    expect(find("frameless shower door cost", "cost")).toBe("/frameless-shower-door-cost");
    expect(find("how to fix foggy windows", "blog")).toBe("/blog/fix-foggy-windows");
  });

  it("lets the homepage cover trade-and-place searches", () => {
    expect(page("glass company matthews nc", "city")).toBe("/");
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { KeywordResearchKeyword } from "@shared/keywordResearch";
import type { SerpResult } from "../../server/features/keyword-research/dataforseo";
import { coveringPage, evidenceFrom, isArticle, sitePages } from "../../server/features/keyword-research/pageCheck";
import { meaningStems } from "../../server/features/keyword-research/quality";
import { parsePage } from "../../server/features/keyword-research/readWebsite";
import { suggestCombinations } from "../../server/features/keyword-research/runPlan";

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
    expect(evidenceFrom(foggy, "Matthews", traffic, "kkcglass.com")).toEqual({
      keyword: "k", city: "Matthews", smallSites: 0, forums: 5, unknownSites: 0, cityPages: 0,
      mapPack: false, aiOverview: true, clientPosition: null, clientMapPosition: null, clientUrl: null, articles: 8, checkedAt: expect.any(String), settings: expect.objectContaining({ clientDomain: "kkcglass.com", device: "desktop", language: "en" }),
    });
  });

  it("finds the client and its page, and leaves directories out of the counts", () => {
    const strong = serp([
      ["yelp.com", "https://www.yelp.com/search?find_desc=glass"],
      ["argowindowrepair.com", "https://argowindowrepair.com/north-carolina/window-repair-charlotte"],
      ["kkcglass.com", "https://kkcglass.com/"],
      ["binswangerglass.com", "https://www.binswangerglass.com/locations/charlotte"],
    ], { localPack: [{ title: "Glass & Door Pro", domain: "glassanddoorpro.com", rating: 5, reviews: 86 }] });
    expect(evidenceFrom(strong, "Charlotte", traffic, "kkcglass.com")).toMatchObject({ smallSites: 0, unknownSites: 0, mapPack: true, clientPosition: 3, clientUrl: "https://kkcglass.com/", cityPages: 2 });
  });

  it("counts small sites and unknown sites separately, so unknown never reads as weak", () => {
    const mixed = serp([["glassanddoorpro.com", "https://glassanddoorpro.com/"], ["theshowerglass.com", "https://theshowerglass.com/"], ["newglassco.com", "https://newglassco.com/"], ["argowindowrepair.com", "https://argowindowrepair.com/"]]);
    expect(evidenceFrom(mixed, "Matthews", traffic, null)).toMatchObject({ smallSites: 2, unknownSites: 1, forums: 0 });
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

describe("reading a page in full", () => {
  it("keeps the whole main content of a real city page, not just its title and first heading", () => {
    const html = readFileSync(path.join(__dirname, "../fixtures/keyword-research/city-page.html"), "utf8");
    const page = parsePage(html, "https://glassanddoorpro.com/service-areas/matthews", 60_000);
    expect(page.textSource).toBe("html");
    expect(page.h1).toBe("Glass Shower Door Installer in Matthews, NC");
    expect(page.text.length).toBeGreaterThan(2_500);
    expect(page.text).toMatch(/frameless/i);
    expect(page.headings).toContain("Should I choose frameless or semi-frameless?");
  });

  it("leaves menus and footers out of the content", () => {
    const page = parsePage("<html><body><nav>Window Repair Door Repair</nav><main><h1>Shower Doors</h1><p>We install shower doors.</p></main><footer>Garage doors</footer></body></html>", "https://x.com/a", 60_000);
    expect(page.text).toBe("Shower Doors We install shower doors.");
  });

  it("reads a JavaScript-rendered page from its embedded data, and says so", () => {
    const data = { page: { title: "Window Repair in Monroe, NC", sections: [{ body: "<p>We repair foggy and broken windows across Monroe and Union County.</p>" }], image: "https://x.com/a.jpg" } };
    const html = `<html><head><title>Window Repair</title></head><body><div id="root">Loading</div><script type="application/json">${JSON.stringify(data)}</script></body></html>`;
    const page = parsePage(html, "https://x.com/monroe", 60_000);
    expect(page.textSource).toBe("embedded");
    expect(page.text).toBe("Window Repair in Monroe, NC We repair foggy and broken windows across Monroe and Union County.");
  });
});

// Saved pages of the reference site (2026-10-11), read the way the plan reads them.
describe("matching against the reference site's saved pages", () => {
  const files: Record<string, string> = {
    "/services/window-installation": "services_window-installation.html",
    "/services/window-repair": "services_window-repair.html",
    "/services/commercial-storefront-glass-replacement-repair": "services_commercial-storefront-glass-replacement-repair.html",
    "/services/commercial-door-replacement-repair": "services_commercial-door-replacement-repair.html",
    "/services/frameless-showers": "services_frameless-showers.html",
    "/service-areas/monroe": "service-areas_monroe.html",
    "/": "home.html",
  };
  const contents = new Map(Object.entries(files).map(([route, file]) => {
    const url = `https://glassanddoorpro.com${route}`;
    const page = parsePage(readFileSync(path.join(__dirname, "../fixtures/keyword-research/pages", file), "utf8"), url, 60_000);
    return [url, { title: page.title, h1: page.h1, headings: page.headings, text: page.text, textSource: page.textSource }] as const;
  }));
  const pages = sitePages([...contents.keys()], contents);
  const cityNames = ["Charlotte", "Matthews", "Monroe", "Pineville", "Weddington", "Indian Trail", "Wesley Chapel", "Stallings", "Waxhaw", "Fort Mill", "Indian Land"];
  const serviceNames = ["frameless shower doors", "glass shower door installation", "window installation", "window replacement", "door installation", "window repair",
    "foggy window repair", "storefront glass installation", "storefront glass repair", "emergency board up", "commercial door installation", "commercial door repair",
    "door closer repair", "commercial window replacement", "window glass replacement", "broken window repair", "sliding glass door repair",
    "sliding glass door replacement", "insulated glass replacement", "glass shower enclosures", "shower door repair", "patio door installation", "storm door installation", "glass partitions"];
  // The intake's service pages, as the reference project saved them.
  const intake = new Map([
    ["emergency board up", "/services/commercial-storefront-glass-replacement-repair"], ["storefront glass repair", "/services/commercial-storefront-glass-replacement-repair"],
    ["door closer repair", "/services/commercial-door-replacement-repair"], ["commercial door repair", "/services/commercial-door-replacement-repair"],
    ["window installation", "/services/window-installation"], ["window replacement", "/services/window-installation"], ["window repair", "/services/window-repair"],
  ]);
  const context = {
    servicePages: intake, homeStems: meaningStems("glass charlotte nc"),
    cityStems: new Set(cityNames.flatMap(name => [...meaningStems(name)])), cityNames, serviceNames,
  };
  const covering = (keyword: string, pageType: KeywordResearchKeyword["pageType"] = "city", service: string | null = null) =>
    coveringPage({ keyword, service, pageType } as KeywordResearchKeyword, pages, context);

  it("leaves the site's repeated link lists out of a page's own sentences", () => {
    const repair = pages.find(page => page.path === "/services/window-repair")!;
    expect(repair.bodySentences.some(sentence => /foggy/i.test(sentence.text))).toBe(true);
    expect(repair.bodySentences.some(sentence => /Pineville Matthews Weddington/.test(sentence.text))).toBe(false);
    expect(repair.textStems.has("frameless")).toBe(false);
  });

  it("never puts a repair search on an installation page (the Monroe case)", () => {
    expect(covering("window repair monroe nc")).toBeNull();
    expect(covering("window installation monroe nc")).toBe("/services/window-installation");
    expect(covering("window replacement charlotte nc")).toBe("/services/window-installation");
  });

  it("lets a page that genuinely covers repair and installation match both, and only then", () => {
    const both = sitePages(["https://y.com/services/window-installation", "https://y.com/a", "https://y.com/b", "https://y.com/c"], new Map([
      ["https://y.com/services/window-installation", { title: "Window Installation in Matthews, NC", h1: "Window Installation", headings: [], textSource: "html" as const,
        text: "We install new windows across Matthews. We also repair windows with broken seals and failed hardware. Our crew can repair window sashes that stick or rattle." }],
      ["https://y.com/a", { title: "About", h1: "About", headings: [], text: "About us.", textSource: "html" as const }],
      ["https://y.com/b", { title: "Contact", h1: "Contact", headings: [], text: "Call us.", textSource: "html" as const }],
      ["https://y.com/c", { title: "Reviews", h1: "Reviews", headings: [], text: "Read reviews.", textSource: "html" as const }],
    ]));
    const match = (keyword: string) => coveringPage({ keyword, service: null, pageType: "service" } as KeywordResearchKeyword, both, { ...context, cityNames: ["Matthews"] });
    expect(match("window repair matthews nc")).toBe("/services/window-installation");
    expect(match("window installation matthews nc")).toBe("/services/window-installation");
    // On the saved reference page, repair appears in one statement and one question only: distinct, so no match.
    expect(covering("window repair monroe nc")).toBeNull();
  });

  it("finds the service a page covers in its own body (board-up and door closers)", () => {
    expect(covering("emergency board up charlotte nc", "city", "emergency board up")).toBe("/services/commercial-storefront-glass-replacement-repair");
    expect(covering("door closer repair charlotte nc", "city", "door closer repair")).toBe("/services/commercial-door-replacement-repair");
    // Body text confirms a page matched to the service; it never claims a service for a page that was not.
    expect(covering("window glass replacement charlotte nc", "city", "window glass replacement")).not.toBe("/services/window-installation");
    expect(covering("double pane window repair charlotte nc", "city", "insulated glass replacement")).toBeNull();
    expect(covering("emergency board up charlotte nc", "city", null)).toBeNull();
    // Not on any page's body: no match is claimed.
    expect(covering("glass partitions charlotte nc")).toBeNull();
  });

  it("rates a pairing by what the existing page's own body says, quoting it", () => {
    const live = (route: string) => ({ status: "live" as const, path: route });
    const store = "/services/commercial-storefront-glass-replacement-repair";
    const door = "/services/commercial-door-replacement-repair";
    const servicePages = new Map([
      ["storefront glass repair", live(store)], ["emergency board up", live(store)],
      ["commercial door repair", live(door)], ["door closer repair", live(door)],
      ["window installation", live("/services/window-installation")], ["glass partitions", live("/services/window-installation")],
    ]);
    const inventory = [
      { path: store, title: "", h1: "", words: 600, textSource: "html" as const, kind: "service" as const, services: ["storefront glass repair"], cities: [] },
      { path: door, title: "", h1: "", words: 600, textSource: "html" as const, kind: "service" as const, services: ["commercial door repair"], cities: [] },
      { path: "/services/window-installation", title: "", h1: "", words: 600, textSource: "html" as const, kind: "service" as const, services: ["window installation"], cities: [] },
    ];
    const found = [...suggestCombinations(servicePages, inventory, [], pages).values()];
    const boardUp = found.find(item => item.services.includes("emergency board up"))!;
    expect(boardUp.strength).toBe("page_body_covers_both");
    expect(boardUp.evidence[0]).toMatch(/board-up/i);
    expect(found.find(item => item.services.includes("door closer repair"))!.strength).toBe("page_body_covers_both");
    // A repair paired with an installation page whose own statements never offer that repair: still only a guess.
    const showers = new Map([["frameless shower doors", live("/services/frameless-showers")], ["shower door repair", live("/services/frameless-showers")]]);
    const showerInventory = [{ path: "/services/frameless-showers", title: "", h1: "", words: 700, textSource: "html" as const, kind: "service" as const, services: ["frameless shower doors"], cities: [] }];
    expect([...suggestCombinations(showers, showerInventory, [], pages).values()][0].strength).toBe("intake_match");
    // Matched at intake but never mentioned on the page: still only a guess.
    expect(found.find(item => item.services.includes("glass partitions"))!.strength).toBe("intake_match");
  });

  it("never lets the homepage catch service searches (sentences styled as headings are not topics)", () => {
    const home = pages.find(page => page.path === "/")!;
    expect(home.stems.has("welco")).toBe(false);
    for (const keyword of ["frameless glass shower doors", "home window repair", "installing a shower door", "glass shower door installation"]) {
      expect(covering(keyword, "service")).not.toBe("/");
    }
    expect(covering("door closer repair charlotte", "city", "door closer repair")).toBe("/services/commercial-door-replacement-repair");
    // Trade-and-place searches still belong on the homepage.
    expect(covering("glass charlotte nc", "service")).toBe("/");
  });

  it("keeps the earlier correct matches", () => {
    expect(covering("foggy window repair charlotte nc")).toBe("/services/window-repair");
    expect(covering("storefront glass repair charlotte nc")).toBe("/services/commercial-storefront-glass-replacement-repair");
    expect(covering("glass shower door installer monroe nc")).toBe("/service-areas/monroe");
    expect(covering("frameless shower doors monroe nc")).toBe("/service-areas/monroe");
  });
});

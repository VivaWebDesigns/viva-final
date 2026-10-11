import { describe, expect, it } from "vitest";
import { comparePages, draftGroups, groupValue, opportunityOf, planPage, withObservations, type DraftGroup, type PlannedKeyword } from "@shared/pagePlan";
import type { KeywordResearchKeyword, PageEvidence, PageKind, PageMatch, PageObservation, PagePlan } from "@shared/keywordResearch";
import { excludedWork } from "../../server/features/keyword-research/keywords";
import { coveringPage, isPlacePage, sitePages } from "../../server/features/keyword-research/pageCheck";
import { cachedRelevance, suggestCombinations } from "../../server/features/keyword-research/runPlan";
import { relevanceBasis, sameSerpSettings } from "@shared/keywordResearch";
import { meaningStems } from "../../server/features/keyword-research/quality";

const none: PageMatch = { status: "none", path: null };
const row = (keyword: string, searchVolume: number | null, cpc: number | null, pageType: KeywordResearchKeyword["pageType"] = "service") =>
  ({ keyword, searchVolume, cpc, pageType, service: null, competition: null, competitionIndex: null, lowTopOfPageBid: null, highTopOfPageBid: null }) as KeywordResearchKeyword;
const planned = (keyword: string, service: string, kind: PageKind, options: { volume?: number | null; cpc?: number | null; city?: string; match?: PageMatch } = {}): PlannedKeyword => ({
  row: row(keyword, options.volume === undefined ? 100 : options.volume, options.cpc === undefined ? 10 : options.cpc, kind),
  service, kind, city: options.city ?? null, match: options.match ?? none,
});
const evidence = (overrides: Partial<PageEvidence> = {}): PageEvidence => ({
  keyword: "k", city: "Charlotte", smallSites: 0, forums: 0, unknownSites: 0, cityPages: 0, mapPack: true, aiOverview: false, clientPosition: null, clientUrl: null, ...overrides,
});
const plan = (group: DraftGroup, overrides: Partial<Parameters<typeof planPage>[1]> = {}) =>
  planPage(group, { id: "p1", evidence: null, priorityService: false, demandArea: "Charlotte, NC", siteRead: true, adjusted: null, ...overrides });
const group = (kind: PageKind, members: PlannedKeyword[], page: PageMatch = none, city: string | null = null): DraftGroup =>
  ({ key: "g", kind, service: members[0].service, city, page, members });

describe("grouping keywords into pages", () => {
  const live = (path: string): PageMatch => ({ status: "live", path });
  const servicePages = new Map([["window repair", live("/services/window-repair")]]);
  const groups = draftGroups([
    planned("window repair", "window repair", "service", { match: live("/services/window-repair") }),
    planned("home window repair", "window repair", "service"),
    planned("commercial door repair", "commercial door repair", "service"),
    planned("commercial door repairs near", "commercial door repair", "service"),
    planned("window repair cost", "window repair", "cost"),
    planned("window repair huntersville", "window repair", "city", { city: "Huntersville" }),
    planned("how to fix a cracked window", "window repair", "blog"),
  ], servicePages, keyword => (keyword.includes("crack") ? "crack" : keyword));

  it("keeps a service's other phrasings on its existing page instead of proposing a new URL", () => {
    const page = groups.find(entry => entry.page.path === "/services/window-repair");
    expect(page?.members.map(member => member.row.keyword)).toEqual(["window repair", "home window repair"]);
  });

  it("proposes one page per service without a page, and separate cost, city and blog pages", () => {
    expect(groups.map(entry => entry.key).sort()).toEqual([
      "blog:window repair:crack", "city:window repair:Huntersville", "cost:window repair", "page:/services/window-repair", "service:commercial door repair",
    ]);
    expect(groups.find(entry => entry.key === "service:commercial door repair")?.members).toHaveLength(2);
  });
});

describe("page actions", () => {
  const live: PageMatch = { status: "live", path: "/services/window-repair" };

  it("keeps a live page the client ranks #1-3 for, and improves one it does not", () => {
    const members = [planned("window repair", "window repair", "service", { match: live })];
    expect(plan(group("service", members, live), { evidence: evidence({ clientPosition: 2 }) }).action).toBe("keep");
    expect(plan(group("service", members, live), { evidence: evidence({ clientPosition: 14 }) }).action).toBe("improve");
  });

  it("calls a staging page 'review and publish', never ready", () => {
    const staging: PageMatch = { status: "staging", path: "/services/sash-replacement" };
    const result = plan(group("service", [planned("sash replacement", "sash replacement", "service", { match: staging })], staging));
    expect(result.action).toBe("staging");
    expect(result.questions.join(" ")).toMatch(/not the same as ready/);
  });

  it("recommends a page with known demand even when page 1 is contested, and says contested means harder", () => {
    const result = plan(group("service", [planned("commercial door repair", "commercial door repair", "service")]), { evidence: evidence() });
    expect(result).toMatchObject({ action: "recommend", opportunity: "contested", confidence: "high" });
    expect(result.reasons.join(" ")).toMatch(/harder, not ruled out/);
  });

  it("states which keyword and city were checked, and that the check does not cover everything under the page", () => {
    const result = plan(group("service", [planned("commercial door repair", "commercial door repair", "service")]), { evidence: evidence({ keyword: "commercial door repair", smallSites: 3 }) });
    expect(result.opportunity).toBe("more_room");
    expect(result.reasons.join(" ")).toMatch(/checked "commercial door repair" from Charlotte/);
    expect(result.reasons).toContain("the check supports this page; it does not cover every keyword or city under it");
  });

  it("investigates instead of recommending when demand is unknown and the service is not a priority", () => {
    const unknown = [planned("emergency board up", "emergency board up", "service", { volume: null, cpc: null })];
    expect(plan(group("service", unknown)).action).toBe("investigate");
    expect(plan(group("service", unknown), { priorityService: true }).action).toBe("recommend");
  });

  it("does not recommend a city page unless page 1 from that city rewards city pages", () => {
    const members = [planned("window repair huntersville", "window repair", "city", { city: "Huntersville" })];
    expect(plan(group("city", members, none, "Huntersville"), { evidence: evidence({ city: "Huntersville", cityPages: 1 }) }).action).toBe("investigate");
    expect(plan(group("city", members, none, "Huntersville"), { evidence: evidence({ city: "Huntersville", cityPages: 5 }) }).action).toBe("recommend");
  });

  it("never claims a page is missing when the site was not read", () => {
    const result = plan(group("service", [planned("commercial door repair", "commercial door repair", "service")]), { siteRead: false });
    expect(result.action).toBe("investigate");
    expect(result.questions.join(" ")).toMatch(/not read/);
  });
});

describe("value and order", () => {
  it("keeps unknown value out of the sum and counts it separately", () => {
    expect(groupValue([row("a", 100, 10), row("b", 50, null), row("c", null, 20)])).toMatchObject({ value: 1000, unknownValue: 2, demand: 150 });
  });

  it("keeps possible overlaps (identical Google Ads numbers) as a range instead of a single figure", () => {
    const grouped = {
      ...row("window replacement", 480, 78.61),
      variantMetrics: [{ keyword: "replacement windows", searchVolume: 480, cpc: 78.61, competition: null, lowTopOfPageBid: null, highTopOfPageBid: null }],
      nearMeMetrics: [
        { keyword: "window replacement near me", searchVolume: 390, cpc: 70, competition: null, lowTopOfPageBid: null, highTopOfPageBid: null, counted: true },
        { keyword: "window replacement nearby", searchVolume: 480, cpc: 78.61, competition: null, lowTopOfPageBid: null, highTopOfPageBid: null, counted: false },
      ],
      nearMeVolume: 390,
    };
    expect(groupValue([grouped])).toMatchObject({ demand: 870, demandHigh: 870 + 480 + 480, overlaps: 2 });
    const result = plan(group("service", [{ ...planned("window replacement", "window replacement", "service"), row: grouped }]));
    expect(result).toMatchObject({ demand: 870, demandHigh: 1830, possibleOverlaps: 2 });
    expect(result.reasons.join(" ")).toMatch(/870–1,830 searches\/mo/);
    expect(result.reasons.join(" ")).toMatch(/identical Google Ads numbers separately: identical numbers suggest one search, but Google does not confirm it/);
  });

  it("reads opportunity from small sites and forum threads, with unknown sites never counting as contested", () => {
    expect(opportunityOf(null)).toBe("unchecked");
    expect(opportunityOf(evidence({ smallSites: 2, forums: 1 }))).toBe("more_room");
    expect(opportunityOf(evidence({ unknownSites: 2 }))).toBe("normal");
    expect(opportunityOf(evidence())).toBe("contested");
  });

  it("orders actions first, then priority services, then service pages, then value, with room only breaking ties", () => {
    const page = (id: string, overrides: Partial<PagePlan>) => ({ id, action: "recommend", priorityService: false, kind: "service", opportunity: "normal", value: 0, unknownValue: 0, ...overrides }) as PagePlan;
    const pages = [
      page("keep", { action: "keep", value: 99999 }),
      page("blog", { kind: "blog", value: 5000 }),
      page("contested", { opportunity: "contested", value: 3000 }),
      page("room", { opportunity: "more_room", value: 100 }),
      page("priority", { priorityService: true, opportunity: "contested", value: 10 }),
      page("investigate", { action: "investigate", value: 8000 }),
    ];
    expect([...pages].sort(comparePages).map(entry => entry.id)).toEqual(["priority", "contested", "room", "blog", "investigate", "keep"]);
  });
});

describe("exclusions", () => {
  const exclusions = [
    { work: "auto glass", terms: ["auto glass", "windshield", "car window", "safelite"], reason: "", source: "website" as const },
    { work: "garage doors", terms: ["garage door"], reason: "", source: "website" as const },
  ];

  it("catches excluded work whatever the word order, by any of its terms", () => {
    expect(excludedWork("repair car window", exclusions)).toBe("auto glass");
    expect(excludedWork("garage door installation charlotte", exclusions)).toBe("garage doors");
    expect(excludedWork("safelite near me", exclusions)).toBe("auto glass");
  });

  it("leaves the client's own work alone", () => {
    expect(excludedWork("window repair", exclusions)).toBeNull();
    expect(excludedWork("door installation", exclusions)).toBeNull();
    expect(excludedWork("commercial glass door repair", exclusions)).toBeNull();
  });
});

// The reference case: Glass & Door Pro's shower-door city pages, built on "glass shower door installer + city".
describe("service × city pages (reference case)", () => {
  const monroe: PageMatch = { status: "live", path: "/service-areas/monroe" };
  const reference = {
    keyword: "glass shower doors charlotte nc", basis: "metro_phrase" as const, searchVolume: 20, avgCpc: 26.46, lowTopOfPageBid: 4, highTopOfPageBid: 27.5, competition: "HIGH", difficulty: null,
    measurement: { id: "research-volume", source: "Google Ads search volume (DataForSEO)", location: "Charlotte, NC,United States", locationCode: 200517, language: "en", network: "Google Search", monthsFrom: "2025-09", monthsTo: "2026-08", fetchedAt: "2026-10-10T00:00:00Z" },
  };
  const gridGroup = (page: PageMatch = monroe): DraftGroup => ({
    ...group("city", [planned("glass shower door installer monroe nc", "glass shower doors", "city", { volume: null, cpc: null, city: "Monroe", match: page })], page, "Monroe"),
    target: "glass shower door installer monroe nc", reference,
  });

  it("finds the existing city page for the target phrase, not the service page", () => {
    const pages = sitePages(
      ["https://x.com/service-areas/monroe", "https://x.com/service-areas/charlotte", "https://x.com/services/frameless-showers", "https://x.com/service-areas", "https://x.com/service-areas/stallings"],
      new Map([
        ["https://x.com/service-areas/stallings", "Glass Shower Door Installation in Stallings, NC"],
        ["https://x.com/service-areas/monroe", {
          title: "Glass Shower Door Installation in Monroe, NC", h1: "Glass Shower Door Installer in Monroe, NC", textSource: "html" as const,
          headings: ["Glass Shower Door Installer in Monroe, NC", "Frequently Asked Questions", "Should I choose frameless or semi-frameless?"],
          text: "Custom glass shower doors in Monroe. We install frameless and semi-frameless shower doors measured to your opening.",
        }],
        ["https://x.com/service-areas/charlotte", "Glass Shower Door Installation in Charlotte, NC"],
        ["https://x.com/services/frameless-showers", "Frameless Glass Shower Doors"],
      ]),
    );
    const cityNames = ["Monroe", "Charlotte", "Stallings"];
    const serviceNames = ["glass shower door installation", "frameless shower doors", "sliding glass door repair", "door installation", "window glass replacement", "storefront glass repair"];
    const context = { servicePages: new Map<string, string>(), homeStems: meaningStems("glass company charlotte nc"), cityStems: new Set(cityNames.flatMap(name => [...meaningStems(name)])), cityNames, serviceNames };
    const covering = (keyword: string) => coveringPage({ ...row(keyword, null, null, "city"), service: "glass shower doors" }, pages, context);
    expect(covering("glass shower door installer monroe nc")).toBe("/service-areas/monroe");
    expect(covering("glass shower door installer charlotte nc")).toBe("/service-areas/charlotte");
    expect(covering("shower door repair stallings nc")).toBe("/service-areas/stallings");
    // Another service's words all appear on the page, but it is not the page's subject.
    expect(covering("door installation charlotte nc")).toBeNull();
    expect(covering("glass replacement stallings nc")).toBeNull();
    // Variants of the page's subject belong on it; a different service sharing its common words does not.
    expect(covering("frameless shower doors monroe nc")).toBe("/service-areas/monroe");
    // The same search with no content saying the page covers it is not matched to it.
    expect(covering("frameless shower doors charlotte nc")).toBeNull();
    expect(covering("sliding glass door repair monroe nc")).toBeNull();
    // "stall" shares a stem with Stallings; it does not name the city.
    expect(coveringPage({ ...row("glass shower stall", 50, 2), service: "glass shower enclosures" }, pages, context)).toBeNull();
    expect(isPlacePage("/service-areas/charlotte")).toBe(true);
    expect(isPlacePage("/services/frameless-showers")).toBe(false);
  });

  it("keeps a city phrase Google reports nothing for, labelled not reported, with the metro reference CPC labelled as such", () => {
    const result = plan(gridGroup(none), { evidence: evidence({ keyword: "glass shower door installer monroe nc", city: "Monroe", cityPages: 6 }) });
    expect(result.action).toBe("recommend");
    expect(result.mainKeyword).toBe("glass shower door installer monroe nc");
    const text = result.reasons.join(" ");
    expect(text).toMatch(/not reported by Google Ads/);
    // Each metric separate, with the exact phrase, target, months, language and network; never as the city phrase's own.
    expect(text).toContain('reference, not measured for this phrase: "glass shower doors charlotte nc" (Google Ads search volume (DataForSEO); Charlotte, NC,United States [200517]; 2025-09 to 2026-08; language en; Google Search): average CPC $26.46; top-of-page bid $4.00 to $27.50; paid-ad competition high; organic difficulty (US) not reported.');
    expect(text).toContain('"glass shower door installer monroe nc" itself: not reported searches, average CPC not reported, top-of-page bid not reported');
    expect(text).not.toMatch(/too small/);
  });

  it("says a failed check is unknown, never not ranking", () => {
    const result = plan(gridGroup(), { checkStatus: "failed" });
    expect(result.checkStatus).toBe("failed");
    expect(result.questions.join(" ")).toMatch(/failed at DataForSEO\. The ranking is unknown, not absent/);
    expect(result.reasons.join(" ")).not.toMatch(/not in the top 20/);
  });

  const observation = (overrides: Partial<PageObservation>): PageObservation => ({
    id: "o1", kind: "captured_ranking", surface: "organic", query: "glass shower door installer monroe nc", position: 1, path: null, service: "glass shower doors",
    cities: ["Monroe"], observedOn: "2026-10-10", source: "Matt, screenshots", note: "", recordedAt: "2026-10-10T00:00:00Z", ...overrides,
  });

  it("keeps a live page with recorded success and shows a conflicting check for reconciliation instead of erasing either", () => {
    const checked = plan(gridGroup(), { evidence: evidence({ keyword: "glass shower door installer monroe nc", city: "Monroe", clientPosition: 13, clientMapPosition: 1 }) });
    expect(checked.action).toBe("improve");
    const kept = withObservations(checked, [observation({})], "10/10/2026");
    expect(kept.action).toBe("keep");
    expect(kept.reasons.join(" ")).toMatch(/client #13 in regular results; client #1 in the map pack/);
    expect(kept.questions.join(" ")).toMatch(/Rankings disagree .*captured #1 .*saw #13\. Both are kept/);
  });

  it("keeps a page on reported city leads while an incomplete check stays visible", () => {
    const failed = plan(gridGroup(), { checkStatus: "failed" });
    const kept = withObservations(failed, [observation({ kind: "city_leads", surface: null, query: null, position: null })], "10/10/2026");
    expect(kept.action).toBe("keep");
    expect(kept.questions.join(" ")).toMatch(/ranking is unknown, not absent/);
    expect(kept.questions.join(" ")).toMatch(/measurement is incomplete/);
  });

  it("never turns a proposed page into a keeper, and ignores evidence for another service in the same city", () => {
    const proposed = plan(gridGroup(none), { evidence: evidence({ city: "Monroe", cityPages: 6 }) });
    expect(withObservations(proposed, [observation({ kind: "city_leads", surface: null, query: null, position: null })], "x").action).toBe("recommend");
    const other = { ...proposed, service: "window repair", keywords: ["window repair monroe nc"] };
    expect(withObservations(other, [observation({ query: null })], "x")).toBe(other);
  });
});

describe("distinct services stay distinct", () => {
  it("keeps each confirmed service's city candidates on its own page; combining them is a suggestion, not a grouping rule", () => {
    const groups = draftGroups([
      planned("window installation matthews nc", "window installation", "city", { city: "Matthews", volume: null, cpc: null }),
      planned("window replacement matthews nc", "window replacement", "city", { city: "Matthews", volume: null, cpc: null }),
      planned("window repair matthews nc", "window repair", "city", { city: "Matthews", volume: null, cpc: null }),
    ], new Map(), keyword => keyword);
    expect(groups.map(entry => entry.key)).toEqual(["city:window installation:Matthews", "city:window replacement:Matthews", "city:window repair:Matthews"]);
  });
});

describe("possible combined pages", () => {
  const live = (path: string): PageMatch => ({ status: "live", path });
  const inventoryPage = (path: string, services: string[]) => ({ path, title: "", h1: "", words: 500, textSource: "html" as const, kind: "service" as const, services, cities: [] });

  it("rates a page that names both above an intake match, and identical numbers as a possible overlap only", () => {
    const pages = new Map([
      ["window installation", live("/services/window-installation")], ["window replacement", live("/services/window-installation")],
      ["door installation", live("/services/door-installation")], ["storm door installation", live("/services/door-installation")],
    ]);
    const inventory = [inventoryPage("/services/window-installation", ["window installation", "window replacement"]), inventoryPage("/services/door-installation", ["door installation"])];
    const metro = [
      { ...row("window repair charlotte", 170, 21.25, "city"), service: "window repair" },
      { ...row("window installation charlotte nc", 480, 84.16, "city"), service: "window installation" },
      { ...row("replacement windows charlotte nc", 480, 84.16, "city"), service: "window replacement" },
      { ...row("sliding glass door repair charlotte", 480, 84.16, "city"), service: "sliding glass door repair" },
    ] as KeywordResearchKeyword[];
    const found = [...suggestCombinations(pages, inventory, metro).values()];
    expect(found.find(item => item.services.includes("window replacement"))).toMatchObject({ strength: "page_names_both", services: ["window installation", "window replacement"] });
    expect(found.find(item => item.services.includes("storm door installation"))).toMatchObject({ strength: "intake_match" });
    // A repair never pairs with an installation, whatever the numbers.
    expect(found.some(item => item.services.includes("sliding glass door repair") && item.services.includes("window installation"))).toBe(false);
    expect(found.find(item => item.services.includes("window replacement"))!.evidence.join(" ")).toMatch(/possible overlap, not confirmed/);
  });
});

describe("site template", () => {
  it("leaves the site's name and its repeated section headings out of every page's topic", () => {
    const page = (title: string, h1: string) => ({ title: `${title} | Glass & Door Pro`, h1, headings: [h1, "Related Links", "Services", "Commercial Services", "Service Areas"], text: "", textSource: "html" as const });
    const pages = sitePages(
      ["https://x.com/services/window-installation", "https://x.com/services/door-repair", "https://x.com/services/shower-doors", "https://x.com/about"],
      new Map([
        ["https://x.com/services/window-installation", page("Window Installation in Charlotte, NC | Replacement Windows", "Window Installation")],
        ["https://x.com/services/door-repair", page("Door Repair", "Door Repair")],
        ["https://x.com/services/shower-doors", page("Shower Doors", "Shower Doors")],
        ["https://x.com/about", page("About", "About Us")],
      ]),
    );
    const windows = pages[0];
    // Subject: what the page is about, without the site's name or action words.
    expect([...windows.subjectStems].sort()).toEqual([...meaningStems("charlotte window")].sort());
    expect(windows.stems.has("commercial")).toBe(false);
    expect(windows.stems.has("pro")).toBe(false);
  });
});

describe("reusing earlier work", () => {
  const services = ["window repair", "door installation"];
  const exclusions = [{ work: "garage doors", terms: ["garage door"] }];
  const judged = (keyword: string, basis?: string) => ({ ...row(keyword, 10, 5), relevance: { verdict: "no" as const, service: null, reason: "", basis } }) as KeywordResearchKeyword;

  it("reuses a relevance verdict only when the services and exclusions are exactly the ones it was judged against", () => {
    const basis = relevanceBasis(services, exclusions);
    expect(relevanceBasis([...services].reverse(), exclusions)).toBe(basis);
    const rows = [judged("window repair matthews", basis), judged("storm door installation", relevanceBasis(services, [])), judged("door closer repair")];
    const { checks, pending } = cachedRelevance(rows, basis);
    expect([...checks.keys()]).toEqual(["window repair matthews"]);
    // Judged before the exclusion was added, and judged with no recorded basis: both judged again.
    expect(pending).toEqual(["storm door installation", "door closer repair"]);
    expect(cachedRelevance(rows, relevanceBasis([...services, "storm door installation"], exclusions)).checks.size).toBe(0);
  });

  it("reuses a page-1 check only when every search setting matches", () => {
    const wanted = { location: "Matthews,North Carolina,United States", language: "en", device: "desktop", depth: 20, clientDomain: "glassanddoorpro.com" };
    const done = { ...wanted, locationCode: 1021208 };
    expect(sameSerpSettings(done, wanted)).toBe(true);
    expect(sameSerpSettings(undefined, wanted)).toBe(false);
    expect(sameSerpSettings({ ...done, clientDomain: "staging.example.com" }, wanted)).toBe(false);
    expect(sameSerpSettings({ ...done, location: "Charlotte,North Carolina,United States" }, wanted)).toBe(false);
    expect(sameSerpSettings({ ...done, device: "mobile" }, wanted)).toBe(false);
    expect(sameSerpSettings({ ...done, depth: 10 }, wanted)).toBe(false);
  });
});

describe("site template keeps meaningful service words", () => {
  const page = (title: string, h1: string, headings: string[] = []) => ({ title, h1, headings: [h1, ...headings], text: "", textSource: "html" as const });
  const urls = ["https://x.com/frameless", "https://x.com/repair", "https://x.com/enclosures", "https://x.com/matthews"];

  it("drops a service named only in the repeated title ending, but keeps each page's own heading as its subject", () => {
    const pages = sitePages(urls, new Map([
      [urls[0], page("Frameless Doors | Charlotte Shower Doors", "Frameless Shower Doors", ["Window Repair"])],
      [urls[1], page("Shower Door Repair | Charlotte Shower Doors", "Shower Door Repair", ["Window Repair"])],
      [urls[2], page("Enclosures | Charlotte Shower Doors", "Glass Shower Enclosures", ["Window Repair"])],
      [urls[3], page("Window Repair in Matthews | Charlotte Shower Doors", "Window Repair in Matthews", ["Window Repair"])],
    ]));
    // The repeated title ending is template, but each page's own words remain its subject.
    expect([...pages[0].subjectStems].sort()).toEqual([...meaningStems("frameless shower doors")].sort());
    expect([...pages[1].subjectStems].sort()).toEqual([...meaningStems("shower door")].sort());
    // A sidebar heading repeated on every page is not a topic of the pages it repeats on...
    expect(pages[0].stems.has("windo")).toBe(false);
    // ...but the page that is about it keeps it in its own title and main heading.
    expect(pages[3].subjectStems.has("windo")).toBe(true);
  });
});

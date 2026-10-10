import { describe, expect, it } from "vitest";
import { comparePages, draftGroups, groupValue, opportunityOf, planPage, type DraftGroup, type PlannedKeyword } from "@shared/pagePlan";
import type { KeywordResearchKeyword, PageEvidence, PageKind, PageMatch, PagePlan } from "@shared/keywordResearch";
import { excludedWork } from "../../server/features/keyword-research/keywords";

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
    expect(groupValue([row("a", 100, 10), row("b", 50, null), row("c", null, 20)])).toEqual({ value: 1000, unknownValue: 2, demand: 150 });
  });

  it("reads opportunity from small sites and forum threads, with unknown sites never counting as contested", () => {
    expect(opportunityOf(null)).toBe("unchecked");
    expect(opportunityOf(evidence({ smallSites: 2, forums: 1 }))).toBe("more_room");
    expect(opportunityOf(evidence({ unknownSites: 2 }))).toBe("normal");
    expect(opportunityOf(evidence())).toBe("contested");
  });

  it("orders actions first, then priority services, then service pages, then room, then value", () => {
    const page = (id: string, overrides: Partial<PagePlan>) => ({ id, action: "recommend", priorityService: false, kind: "service", opportunity: "normal", value: 0, unknownValue: 0, ...overrides }) as PagePlan;
    const pages = [
      page("keep", { action: "keep", value: 99999 }),
      page("blog", { kind: "blog", value: 5000 }),
      page("contested", { opportunity: "contested", value: 3000 }),
      page("room", { opportunity: "more_room", value: 100 }),
      page("priority", { priorityService: true, opportunity: "contested", value: 10 }),
      page("investigate", { action: "investigate", value: 8000 }),
    ];
    expect([...pages].sort(comparePages).map(entry => entry.id)).toEqual(["priority", "room", "contested", "blog", "investigate", "keep"]);
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

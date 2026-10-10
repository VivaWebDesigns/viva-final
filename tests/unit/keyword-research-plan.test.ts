import { describe, expect, it } from "vitest";
import { comparePlans, planCell, planKeyword, type PlanFacts } from "@shared/keywordPlan";
import type { KeywordResearchKeyword, PageOneCheck } from "@shared/keywordResearch";

const facts = (overrides: Partial<PlanFacts> = {}): PlanFacts => ({
  demandArea: "Charlotte, NC", priorityService: false, servesCity: null, siteRead: true, competitor: null, ...overrides,
});
const check = (overrides: Partial<PageOneCheck> = {}): PageOneCheck => ({
  city: "Matthews", requestedLocation: "Matthews,North Carolina,United States", returnedLocationCode: 1021208,
  smallSites: 0, forums: 0, unknownSites: 0, mapPack: true, aiOverview: false, articles: 0, clientPosition: null, clientUrl: null, ...overrides,
});
const row = (overrides: Partial<KeywordResearchKeyword> = {}): KeywordResearchKeyword => ({
  keyword: "sliding glass door repair", service: "glass door repair", searchVolume: 70, cpc: 27.67, competition: null, competitionIndex: null,
  lowTopOfPageBid: null, highTopOfPageBid: null, pageType: "service", intent: "service", difficulty: 0, pageOne: [], pageMatch: { status: "none", path: null }, ...overrides,
});

describe("keyword actions", () => {
  it("keeps what the client already wins and improves what it nearly wins", () => {
    expect(planKeyword(row({ pageOne: [check({ clientPosition: 2 })] }), facts()).action).toBe("keep");
    const improve = planKeyword(row({ pageOne: [check({ clientPosition: 14, city: "Charlotte" })] }), facts());
    expect(improve).toMatchObject({ action: "improve", tier: 1, confidence: "high" });
    expect(improve.reasons).toContain("client #14 from Charlotte");
  });

  it("improves a live page that does not rank, and publishes a page that exists only on staging", () => {
    expect(planKeyword(row({ pageMatch: { status: "live", path: "/services/glass-door-repair" }, pageOne: [check()] }), facts()).action).toBe("improve");
    const staging = planKeyword(row({ pageMatch: { status: "staging", path: "/services/sash-replacement" } }), facts());
    expect(staging).toMatchObject({ action: "publish", tier: 4 });
    expect(staging.reasons).toContain("staging page /services/sash-replacement");
  });

  it("creates only when demand is known, the site was read, no page exists and there is evidence", () => {
    const evidence = check({ smallSites: 3, forums: 1 });
    const create = planKeyword(row({ pageOne: [evidence], difficulty: null }), facts());
    expect(create).toMatchObject({ action: "create", tier: 3 });
    expect(create.reasons).toContain("page 1 from Matthews: 3 small sites, 1 forum threads, 0 unknown");
    expect(planKeyword(row({ pageOne: [evidence] }), facts({ priorityService: true })).tier).toBe(2);
    // A picked competitor in the top 10 or low difficulty is also evidence.
    expect(planKeyword(row({ difficulty: null }), facts({ competitor: { domain: "argowindowrepair.com", position: 8 } })).action).toBe("create");
    expect(planKeyword(row({ difficulty: 5 }), facts()).action).toBe("create");
  });

  it("lets an observed contested page 1 outrank the national difficulty proxy", () => {
    const plan = planKeyword(row({ difficulty: 0, pageOne: [check({ smallSites: 0, forums: 0 })] }), facts());
    expect(plan.action).toBe("investigate");
    expect(plan.nextCheck).toMatch(/^Contested/);
  });

  it("never claims no page when the site was not read", () => {
    const plan = planKeyword(row({ pageMatch: undefined }), facts({ siteRead: false }));
    expect(plan.action).toBe("investigate");
    expect(plan.reasons).toContain("site not read");
    expect(plan.nextCheck).toMatch(/Read the website/);
  });

  it("keeps a niche search visible when Google has no local number but advertisers pay for it", () => {
    const niche = planKeyword(row({ searchVolume: null, cpc: 125.21, pageOne: [] }), facts());
    expect(niche).toMatchObject({ action: "investigate", tier: 5, confidence: "low" });
    expect(niche.nextCheck).toMatch(/Ask the client how often/);
    expect(planKeyword(row({ searchVolume: null, cpc: 4, pageOne: [] }), facts()).tier).toBe(8);
  });

  it("asks before building for a city the client did not list", () => {
    const plan = planKeyword(row({ keyword: "glass shower doors monroe nc", pageType: "city", pageOne: [check({ smallSites: 4 })] }), facts({ servesCity: false }));
    expect(plan.action).toBe("investigate");
    expect(plan.nextCheck).toMatch(/serve this city/);
  });

  it("labels an unchecked or contested page 1 as missing evidence, not as hard", () => {
    expect(planKeyword(row({ difficulty: 40 }), facts()).nextCheck).toMatch(/Check page 1/);
    const contested = planKeyword(row({ difficulty: 40, pageOne: [check({ unknownSites: 4 })] }), facts());
    expect(contested).toMatchObject({ action: "investigate", tier: 6 });
    expect(contested.nextCheck).toMatch(/^Contested/);
  });

  it("puts blog topics after money keywords", () => {
    expect(planKeyword(row({ keyword: "how to fix foggy windows", pageType: "blog", intent: "diy", pageOne: [check({ forums: 5 })] }), facts())).toMatchObject({ action: "create", tier: 7 });
  });
});

describe("plan order", () => {
  const ordered = [
    row({ keyword: "a", plan: { action: "investigate", reasons: [], nextCheck: null, confidence: "low", tier: 5 }, searchVolume: null, cpc: 50 }),
    row({ keyword: "b", plan: { action: "create", reasons: [], nextCheck: null, confidence: "high", tier: 3 }, searchVolume: 50, cpc: 10 }),
    row({ keyword: "c", plan: { action: "create", reasons: [], nextCheck: null, confidence: "high", tier: 3 }, searchVolume: 500, cpc: 10 }),
    row({ keyword: "d", plan: { action: "improve", reasons: [], nextCheck: null, confidence: "high", tier: 1 }, searchVolume: 10, cpc: 1 }),
    row({ keyword: "e", pageType: "cost", plan: { action: "create", reasons: [], nextCheck: null, confidence: "high", tier: 7 }, searchVolume: 900, cpc: 6 }),
    row({ keyword: "f", pageType: "blog", plan: { action: "create", reasons: [], nextCheck: null, confidence: "high", tier: 7 }, searchVolume: 2000, cpc: 4 }),
  ];

  it("sorts by tier, then cost before blog, then score", () => {
    expect([...ordered].sort(comparePlans).map(entry => entry.keyword)).toEqual(["d", "c", "b", "a", "e", "f"]);
  });
});

describe("service × city cells", () => {
  const base = { service: "window glass repair", city: "Monroe", cityPage: null, generalPage: null, checked: false, position: null, smallSites: null, demandKnown: true, priorityService: false, competitorTop10: false };

  it("treats an empty cell as a question until page 1 from that city has been seen", () => {
    expect(planCell(base).action).toBe("investigate");
    expect(planCell({ ...base, checked: true, smallSites: 3 })).toMatchObject({ action: "create", page: { status: "none" } });
    expect(planCell({ ...base, competitorTop10: true, checked: true, smallSites: 0 }).action).toBe("create");
  });

  it("lets a general service page serve a city and says to improve it when it does not rank there", () => {
    const general = { status: "live" as const, path: "/services/window-repair" };
    expect(planCell({ ...base, generalPage: general, checked: true, position: null, smallSites: 3 })).toMatchObject({ action: "improve", page: general });
    expect(planCell({ ...base, generalPage: general }).action).toBe("investigate");
    expect(planCell({ ...base, generalPage: general, checked: true, position: 2 }).action).toBe("keep");
  });

  it("marks a staging city page as publish, never as live coverage", () => {
    const cell = planCell({ ...base, cityPage: { status: "staging", path: "/service-areas/monroe-nc" } });
    expect(cell.action).toBe("publish");
    expect(cell.reasons).toContain("staging city page /service-areas/monroe-nc");
  });
});

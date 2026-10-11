import { describe, expect, it } from "vitest";
import { blogTopicReview, buildBlueprint } from "@shared/blueprint";
import type { GroupSuggestion, InventoryPage, PagePlan } from "@shared/keywordResearch";

const page = (id: string, overrides: Partial<PagePlan>): PagePlan => ({
  id, title: id, kind: "city", service: "window repair", city: null, action: "recommend", page: { status: "none", path: null }, mainKeyword: id, keywords: [id],
  value: 0, unknownValue: 1, demand: null, priorityService: false, opportunity: "normal", confidence: "medium", evidence: null, reasons: [], questions: [], adjusted: null,
  checkStatus: "not_run", ...overrides,
});
const inv = (path: string, kind: InventoryPage["kind"], h1 = "", services: string[] = []): InventoryPage => ({ path, title: h1, h1, words: 500, textSource: "html", kind, services, cities: [] });
const checked = { keyword: "k", city: "Matthews", smallSites: 0, forums: 0, unknownSites: 0, cityPages: 6, mapPack: false, aiOverview: false, clientPosition: null, clientUrl: null };
const ref = (avgCpc: number | null) => (avgCpc == null ? null : { keyword: "ref", basis: "metro_phrase" as const, searchVolume: 10, avgCpc, competition: null, difficulty: null });

describe("blueprint", () => {
  const inventory = [
    { ...inv("/services/window-repair", "service", "Window Repair", ["window repair"]), prices: ["IGU replacement typically runs $150–$350 per window."] },
    inv("/services/window-installation", "service", "Window Installation | Replacement Windows", ["window installation", "window replacement"]),
    inv("/blog/foggy-windows", "article"), inv("/service-areas/matthews", "city"),
    inv("/", "service", "Charlotte Glass, Door & Window Services", ["window repair", "window installation"]),
    inv("/services/commercial-window-replacement", "service", "Commercial Window Replacement", ["window replacement", "commercial window replacement"]),
  ];
  const pages = [
    page("repair-page", { kind: "service", city: null, action: "improve", page: { status: "live", path: "/services/window-repair" }, checkStatus: "checked", reference: ref(21.25) }),
    page("repair-matthews", { city: "Matthews", evidence: { ...checked }, checkStatus: "checked", reference: ref(21.25) }),
    page("repair-monroe", { city: "Monroe", reference: ref(21.25) }),
    page("install-matthews", { service: "window installation", city: "Matthews", evidence: { ...checked }, checkStatus: "checked", reference: ref(84.16) }),
    page("replace-matthews", { service: "window replacement", city: "Matthews", reference: ref(84.16) }),
    page("install-page", { kind: "service", service: "window installation", action: "improve", page: { status: "live", path: "/services/window-installation" }, reference: ref(84.16) }),
    page("closer-matthews", { service: "door closer repair", city: "Matthews", reference: null }),
    page("commercial-windows-matthews", { service: "commercial window replacement", city: "Matthews", reference: ref(30.02) }),
    page("glass-service", { kind: "service", service: "window glass replacement", evidence: { ...checked } }),
    page("repair-cost", { kind: "cost" }),
    page("replace-cost", { kind: "cost", service: "window replacement" }),
    page("foggy-post", { kind: "blog", mainKeyword: "how to fix foggy windows" }),
  ];
  const suggestion: GroupSuggestion = { services: ["window installation", "window replacement"], strength: "page_names_both", evidence: ["names both"], pages: [{ city: "Matthews", pageIds: ["install-matthews", "replace-matthews"] }] };
  const at = "2026-10-11T00:00:00Z";
  const entryFor = (blueprint: ReturnType<typeof buildBlueprint>, id: string) => blueprint.entries.find(entry => entry.pageIds.includes(id))!;

  it("gives every page an address that follows the site's own pattern, never one the site already uses", () => {
    const blueprint = buildBlueprint(pages, inventory, [], {}, at);
    expect(entryFor(blueprint, "repair-page")).toMatchObject({ url: "/services/window-repair", urlStatus: "existing", phase: 1 });
    expect(entryFor(blueprint, "repair-matthews")).toMatchObject({ url: "/services/window-repair/matthews", urlStatus: "proposed" });
    expect(entryFor(blueprint, "closer-matthews").url).toBe("/services/door-closer-repair/matthews");
    expect(entryFor(blueprint, "glass-service")).toMatchObject({ url: "/services/window-glass-replacement", phase: 2 });
    expect(entryFor(blueprint, "repair-cost").url).toBe("/services/window-repair/cost");
    expect(entryFor(blueprint, "replace-cost").url).toBe("/services/window-replacement/cost");
    expect(entryFor(blueprint, "foggy-post")).toMatchObject({ url: "/blog/how-to-fix-foggy-windows", phase: 4 });
    expect(blueprint.urlPattern).toEqual({ services: "/services/{service}/{city}", blog: "/blog/{topic}" });
    // One service per existing page: window replacement is not nested under the installation page, and the homepage
    // is never a service's base.
    expect(entryFor(blueprint, "replace-matthews").url).toBe("/services/window-replacement/matthews");
    expect(blueprint.entries.some(entry => entry.url.startsWith("//"))).toBe(false);
    // The most specific service named on a page is its owner.
    expect(entryFor(blueprint, "commercial-windows-matthews").url).toBe("/services/commercial-window-replacement/matthews");
  });

  it("orders the build by business value and shows evidence separately: an unchecked page is not ranked lower", () => {
    const blueprint = buildBlueprint(pages, inventory, [], {}, at);
    const checkedPage = entryFor(blueprint, "repair-matthews");
    const uncheckedPage = entryFor(blueprint, "repair-monroe");
    expect(uncheckedPage.phase).toBe(checkedPage.phase);
    expect([checkedPage.evidenceStatus, uncheckedPage.evidenceStatus]).toEqual(["supported", "not_checked"]);
    // Upper half of the services' metro average CPCs goes first; a service with no figures is not ranked lower by default.
    expect(entryFor(blueprint, "install-matthews").phase).toBe(2);
    expect(entryFor(blueprint, "closer-matthews").phaseReason).toMatch(/no Google Ads figures and no page of its own yet: mark it a priority/);
  });

  it("combines suggested pages only after the user approves, and says where each decision stands", () => {
    const pending = buildBlueprint(pages, inventory, [suggestion], {}, at);
    expect(entryFor(pending, "install-matthews").pageIds).toEqual(["install-matthews"]);
    expect(entryFor(pending, "install-matthews").grouping).toMatchObject({ decision: "pending", strength: "page_names_both" });
    const combined = buildBlueprint(pages, inventory, [suggestion], { "window installation|window replacement": "combine" }, at);
    expect(entryFor(combined, "replace-matthews")).toMatchObject({
      pageIds: ["install-matthews", "replace-matthews"], title: "window installation & window replacement in Matthews",
      url: "/services/window-installation/matthews", evidenceStatus: "supported",
    });
    const separate = buildBlueprint(pages, inventory, [suggestion], { "window installation|window replacement": "separate" }, at);
    expect(entryFor(separate, "replace-matthews").pageIds).toEqual(["replace-matthews"]);
  });
});

describe("phases for cost pages and unmeasured services", () => {
  const inventory = [
    { ...inv("/services/window-repair", "service", "Window Repair", ["window repair"]), prices: ["IGU replacement typically runs $150–$350 per window."] },
    inv("/services/window-installation", "service", "Window Installation", ["window installation"]),
    inv("/services/storefront-glass-installation", "service", "Storefront Glass Installation", ["storefront glass installation"]),
  ];
  const pages = [
    page("repair-page", { kind: "service", action: "improve", page: { status: "live", path: "/services/window-repair" }, reference: ref(84.16), priorityService: true }),
    page("repair-cost", { kind: "cost", reference: ref(84.16), priorityService: true }),
    page("install-cost", { kind: "cost", service: "window installation", reference: ref(84.16) }),
    page("closer-cost", { kind: "cost", service: "door closer repair", reference: ref(4.72) }),
    page("storefront-city", { service: "storefront glass installation", city: "Matthews", reference: null }),
    page("board-up-city", { service: "emergency board up", city: "Matthews", reference: null }),
  ];
  const blueprint = buildBlueprint(pages, inventory, [], {}, "2026-10-11T00:00:00Z");
  const entry = (id: string) => blueprint.entries.find(item => item.pageIds.includes(id))!;

  it("brings a core service's cost page into phase 2 when the site already states prices, and says what it is waiting for otherwise", () => {
    expect(entry("repair-cost")).toMatchObject({ phase: 2 });
    expect(entry("repair-cost").phaseReason).toMatch(/already states prices: “IGU replacement/);
    expect(entry("install-cost")).toMatchObject({ phase: 3 });
    expect(entry("install-cost").phaseReason).toMatch(/waiting for the client's price ranges/);
    expect(entry("closer-cost").phase).toBe(3);
  });

  it("lets a service with no Google Ads figures be core when the client already has a page for it", () => {
    expect(entry("storefront-city")).toMatchObject({ phase: 2 });
    expect(entry("storefront-city").phaseReason).toMatch(/already has a page/);
    expect(entry("board-up-city")).toMatchObject({ phase: 3 });
    expect(entry("board-up-city").phaseReason).toMatch(/mark it a priority/);
  });
});

describe("blog topics for review", () => {
  it("flags size and spec searches and bare product terms, and leaves real questions and problems alone", () => {
    expect(blogTopicReview("3 4 glass shower door")[0]).toMatch(/size or spec/);
    expect(blogTopicReview("1 2 glass shower door")[0]).toMatch(/size or spec/);
    expect(blogTopicReview("anzzi frameless shower doors")[0]).toMatch(/no question, problem or task/);
    expect(blogTopicReview("how to fix foggy windows")).toEqual([]);
    expect(blogTopicReview("replacing cracked window glass")).toEqual([]);
    expect(blogTopicReview("frameless vs semi frameless shower doors")).toEqual([]);
  });
});

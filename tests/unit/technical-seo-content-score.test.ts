import { describe, expect, it } from "vitest";
import type { TechnicalSeoAuditContext, TechnicalSeoPageAudit, TechnicalSeoScanResult } from "../../shared/technicalSeo";
import { scoreSeoContentTargeting } from "../../shared/technicalSeoContent";
import { normalizeTechnicalSeoResult } from "../../shared/technicalSeoScoring";

const context: TechnicalSeoAuditContext = {
  businessName: "Lake Wylie Dog Boarding",
  trade: "Dog boarding",
  city: "Clover",
  state: "SC",
  targetServices: ["Dog daycare"],
  serviceAreas: ["Lake Wylie"],
};

function page(overrides: Partial<TechnicalSeoPageAudit>): TechnicalSeoPageAudit {
  return {
    statusCode: 200,
    title: null,
    h1: [],
    url: "https://example.com/",
    metaDescription: null,
    headings: [],
    wordCount: 0,
    ...overrides,
  } as TechnicalSeoPageAudit;
}

describe("technical SEO content and local targeting score", () => {
  it("rewards meaningful service and location coverage without ranking inputs", () => {
    const result = scoreSeoContentTargeting([
      page({
        title: "Dog Boarding and Dog Daycare in Clover, SC",
        h1: ["Dog Boarding for Clover and Lake Wylie"],
        url: "https://example.com/dog-boarding-clover",
        metaDescription: "Dog daycare serving Clover and Lake Wylie.",
        wordCount: 500,
      }),
    ], context);

    expect(result).toMatchObject({ score: 100, grade: "A", serviceMatches: 2, locationMatches: 2, combinedPages: 1, substantivePages: 1 });
    expect(result.rationale).toContain("Google rankings are not used");
  });

  it("does not mistake an unrelated page or a failed crawl for local targeting", () => {
    const result = scoreSeoContentTargeting([
      page({ title: "Welcome", h1: ["About our team"], wordCount: 500 }),
      page({ statusCode: 500, title: "Dog Boarding in Clover", h1: ["Dog Daycare in Lake Wylie"], wordCount: 500 }),
    ], context);

    expect(result).toMatchObject({ score: 10, grade: "F", serviceMatches: 0, locationMatches: 0, combinedPages: 0, substantivePages: 1 });
  });

  it("scores the individual services in a comma-separated trade rather than requiring the entire input as one phrase", () => {
    const glassContext = { ...context, businessName: "Glass and Door Pro", trade: "windows, doors, frameless showers", city: "Charlotte", targetServices: [], serviceAreas: [] };
    const pages = [
      page({ url: "https://glassanddoorpro.com/", title: "Glass and Door Pro | Charlotte Glass, Door & Window Services", h1: ["Glass and Door Pro: Charlotte Glass, Door & Window Services"], metaDescription: "Frameless showers, window installation, and door installation in Charlotte, NC.", wordCount: 998 }),
      page({ url: "https://glassanddoorpro.com/services/frameless-showers", title: "Frameless Shower Doors Charlotte NC", h1: ["Frameless Showers"], wordCount: 796 }),
      page({ url: "https://glassanddoorpro.com/services/commercial-door-installation", title: "Commercial Door Installation in Charlotte, NC", h1: ["Commercial Door Installation"], wordCount: 700 }),
      page({ url: "https://glassanddoorpro.com/service-areas", title: "Glass and Door Pro | Service Areas", h1: ["Service Areas"], wordCount: 224 }),
    ];
    const corrected = scoreSeoContentTargeting(pages, glassContext);
    expect(corrected).toMatchObject({ grade: "A", serviceMatches: 3, serviceTargetCount: 3, locationMatches: 1, combinedPages: 3, substantivePages: 3, successfulPages: 4 });
    expect(corrected.score).toBe(98);

    const saved = {
      version: 3,
      issues: [],
      summary: { finalUrl: pages[0].url, issueCounts: { critical: 0, high: 0, medium: 0, low: 0, informational: 0 } },
      profiles: { simulatedGooglebotRaw: { redirects: [] }, simulatedGooglebotRendered: { viewport: "width=device-width, initial-scale=1" } },
      siteAudit: {
        context: glassContext,
        pages: pages.map((item) => ({ ...item, internalLinks: pages.map((linked) => linked.url), platformHints: [] })),
        crawl: { sitemapUrlsFound: 4 },
        grades: [{ key: "local_seo", label: "On-page SEO, content & local targeting", grade: "F", score: 45, rationale: "0/1 service targets" }],
        plainLanguageSummary: ["The site does not yet give each priority service and market a clear, substantial destination, limiting its ability to compete for high-intent local searches."],
        insights: { themes: [{ title: "Search demand is broader than the site architecture", summary: "Old score", issueIds: [] }], opportunities: [{ title: "Build dedicated priority-service pages", rationale: "Old score", evidence: "0/1 supplied service targets appear in meaningful page signals.", priority: "high" }] },
      },
    } as unknown as TechnicalSeoScanResult;
    const normalized = normalizeTechnicalSeoResult(saved);
    expect(normalized.siteAudit?.grades[0]).toMatchObject({ grade: "A", score: 98 });
    expect(normalized.siteAudit?.plainLanguageSummary).toEqual([]);
    expect(normalized.siteAudit?.insights?.themes.some((theme) => theme.title === "Search demand is broader than the site architecture")).toBe(false);
    expect(normalized.siteAudit?.insights?.opportunities).toEqual([]);
  });

  it("matches normal singular and plural wording when title order differs from the trade input", () => {
    const result = scoreSeoContentTargeting([
      page({ title: "Charlotte Glass, Door & Window Services", h1: ["Window and Door Installation in Charlotte"], wordCount: 500 }),
    ], { ...context, trade: "windows and doors", city: "Charlotte", targetServices: [], serviceAreas: [] });
    expect(result).toMatchObject({ serviceMatches: 1, serviceTargetCount: 1, locationMatches: 1, combinedPages: 1, grade: "A" });
  });

  it("does not assemble a claimed service from unrelated headings", () => {
    const result = scoreSeoContentTargeting([
      page({ title: "Window Installation in Charlotte", headings: [{ level: 2, text: "Door Repair" }], wordCount: 500 }),
    ], { ...context, trade: "window repair", city: "Charlotte", targetServices: [], serviceAreas: [] });
    expect(result).toMatchObject({ serviceMatches: 0, serviceTargetCount: 1, combinedPages: 0 });
  });
});

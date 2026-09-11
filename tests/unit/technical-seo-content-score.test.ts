import { describe, expect, it } from "vitest";
import type { TechnicalSeoAuditContext, TechnicalSeoPageAudit } from "../../shared/technicalSeo";
import { scoreSeoContentTargeting } from "../../shared/technicalSeoContent";

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
});

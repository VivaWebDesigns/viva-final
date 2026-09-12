import { describe, expect, it } from "vitest";
import type { TechnicalSeoIssue, TechnicalSeoScanResult } from "../../shared/technicalSeo";
import { assignTechnicalSeoIssueGrades, normalizeTechnicalSeoResult, scoreTechnicalSeoIssues } from "../../shared/technicalSeoScoring";

function issue(id: string, severity: TechnicalSeoIssue["severity"], category: string): TechnicalSeoIssue {
  return { id, severity, category, name: id, observation: id, evidence: id, interpretation: id, recommendedAction: id };
}

describe("independent technical SEO scoring", () => {
  it("keeps speed, content, profile, and conversion findings out of the technical grade", () => {
    const findings = [
      issue("multiple-h1", "low", "Headings"),
      issue("site-missing-alt", "medium", "Images"),
      issue("heading-hierarchy-skips", "medium", "Content structure"),
      issue("mobile-performance-poor", "high", "Page speed"),
      issue("mobile-lcp", "high", "Core Web Vitals"),
      issue("missing-service-targeting", "high", "Local SEO"),
      issue("no-onsite-reviews", "medium", "Trust & conversion"),
    ];

    expect(scoreTechnicalSeoIssues(findings)).toEqual({ score: 83, grade: "B", findingCount: 3, deduction: 17 });
  });

  it("assigns every known finding to one independent grade and excludes other grades from technical deductions", () => {
    const findings = assignTechnicalSeoIssueGrades([
      issue("technical", "medium", "Metadata"),
      issue("speed", "critical", "Page speed"),
      issue("profile", "critical", "Google Business Profile"),
      issue("content", "critical", "Content quality"),
      issue("trust", "critical", "Trust & conversion"),
      issue("measurement", "medium", "Measurement"),
    ]);

    expect(findings.map((finding) => finding.gradeKey)).toEqual(["technical", "performance", "business_profile", "local_seo", "trust_conversion", "trust_conversion"]);
    expect(scoreTechnicalSeoIssues(findings)).toMatchObject({ score: 93, grade: "A", findingCount: 1 });
  });

  it("deduplicates homepage and site-wide versions of the same condition", () => {
    const score = scoreTechnicalSeoIssues([
      issue("noindex", "high", "Indexability"),
      issue("site-noindex-pages", "critical", "Indexability"),
    ]);

    expect(score).toEqual({ score: 45, grade: "F", findingCount: 1, deduction: 55 });
  });

  it("corrects a saved v3 result without requiring another crawl", () => {
    const homepage = { statusCode: 200, url: "https://lakewylieboarding.com/", h1: ["Welcome", "Welcome"], internalLinks: ["https://lakewylieboarding.com/agreement%2Fforms"], platformHints: ["GoDaddy Websites + Marketing"] };
    const forms = { statusCode: 200, url: "https://lakewylieboarding.com/agreement%2Fforms", h1: ["Agreement forms"], internalLinks: ["https://lakewylieboarding.com/"], platformHints: ["GoDaddy Websites + Marketing"] };
    const result = {
      version: 3,
      issues: [
        issue("multiple-h1", "low", "Headings"),
        issue("site-missing-alt", "medium", "Images"),
        issue("heading-hierarchy-skips", "medium", "Content structure"),
      ],
      summary: { finalUrl: homepage.url, issueCounts: { critical: 0, high: 0, medium: 2, low: 1, informational: 0 } },
      profiles: {
        simulatedGooglebotRaw: { redirects: [] },
        simulatedGooglebotRendered: { viewport: "width=device-width, initial-scale=1" },
      },
      siteAudit: {
        pages: [homepage, forms],
        crawl: { sitemapUrlsFound: 2 },
        grades: [
          { key: "technical", label: "Technical SEO & source code", grade: "A", score: 97, rationale: "Old premature score" },
          { key: "local_seo", label: "SEO content & local targeting", grade: "F", score: 50, rationale: "Measured" },
        ],
      },
    } as unknown as TechnicalSeoScanResult;

    const corrected = normalizeTechnicalSeoResult(result);
    expect(corrected.siteAudit?.grades[0]).toMatchObject({ grade: "C", score: 70 });
    expect(corrected.siteAudit?.grades[0].rationale).toContain("6 confirmed technical findings scored once");
    expect(corrected.siteAudit?.grades[1].label).toBe("On-page SEO, content & local targeting");
    expect(corrected.issues.map((finding) => finding.id)).toEqual(expect.arrayContaining(["insufficient-site-architecture", "encoded-url-path", "duplicate-primary-dom-content", "restricted-builder-platform"]));
    expect(corrected.issues.some((finding) => finding.id === "multiple-h1")).toBe(false);
    expect(corrected.issues.every((finding) => !!finding.gradeKey)).toBe(true);
    expect(corrected.issues.filter((finding) => ["insufficient-site-architecture", "encoded-url-path", "duplicate-primary-dom-content", "restricted-builder-platform"].includes(finding.id)).every((finding) => finding.gradeKey === "technical")).toBe(true);
  });
});

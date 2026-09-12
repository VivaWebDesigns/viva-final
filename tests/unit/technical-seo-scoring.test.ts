import { describe, expect, it } from "vitest";
import type { TechnicalSeoIssue, TechnicalSeoScanResult } from "../../shared/technicalSeo";
import { assignTechnicalSeoIssueGrades, normalizeTechnicalSeoResult, scoreTechnicalSeoIssues } from "../../shared/technicalSeoScoring";

function issue(id: string, severity: TechnicalSeoIssue["severity"], category: string): TechnicalSeoIssue {
  return { id, severity, category, name: id, observation: id, evidence: id, interpretation: id, recommendedAction: id };
}

describe("independent technical SEO scoring", () => {
  it("grades the Lake Wylie evidence as B after all site-wide technical findings exist", () => {
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
    const result = {
      version: 3,
      issues: [
        issue("multiple-h1", "low", "Headings"),
        issue("site-missing-alt", "medium", "Images"),
        issue("heading-hierarchy-skips", "medium", "Content structure"),
      ],
      siteAudit: {
        pages: [{}, {}],
        grades: [{ key: "technical", label: "Technical SEO & source code", grade: "A", score: 97, rationale: "Old premature score" }],
      },
    } as unknown as TechnicalSeoScanResult;

    const corrected = normalizeTechnicalSeoResult(result);
    expect(corrected.siteAudit?.grades[0]).toMatchObject({ grade: "B", score: 83 });
    expect(corrected.siteAudit?.grades[0].rationale).toContain("3 confirmed technical findings scored once");
    expect(corrected.issues.every((finding) => finding.gradeKey === "technical")).toBe(true);
  });
});

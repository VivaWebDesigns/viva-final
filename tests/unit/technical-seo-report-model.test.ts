import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { TechnicalSeoIssue, TechnicalSeoScanResult } from "../../shared/technicalSeo";
import { buildTechnicalSeoReportModel, consolidateReportIssues, prioritizeReportIssues, truncateReportText } from "../../client/src/features/technical-seo/reportModel";

function issue(id: string, severity: TechnicalSeoIssue["severity"]): TechnicalSeoIssue {
  return { id, severity, name: id, category: "Test", observation: id, evidence: id, interpretation: id, recommendedAction: id };
}

describe("technical SEO client report model", () => {
  it("limits findings and orders them by SEO severity", () => {
    const issues = [issue("info", "informational"), issue("medium", "medium"), issue("critical", "critical"), issue("high", "high"), issue("low", "low"), issue("extra", "medium"), issue("seventh", "high")];
    expect(prioritizeReportIssues(issues).map((item) => item.id)).toEqual(["critical", "high", "seventh", "medium", "extra", "low"]);
  });

  it("keeps client-facing evidence concise", () => {
    expect(truncateReportText("  A   short finding  ", 40)).toBe("A short finding");
    expect(truncateReportText("A".repeat(30), 12)).toBe(`${"A".repeat(11)}…`);
  });

  it("consolidates related findings before filling the client priority list", () => {
    const issues = [
      { ...issue("mobile-performance-poor", "high"), category: "Page speed" },
      { ...issue("mobile-lcp", "high"), category: "Core Web Vitals" },
      { ...issue("missing-service-targeting", "high"), category: "Local SEO" },
    ];
    expect(consolidateReportIssues(issues, 2).map((item) => item.id)).toEqual(["mobile-performance-poor", "missing-service-targeting"]);
  });

  it("hides retired ranking findings and rebuilds the content grade without ranking data", () => {
    const result = {
      issues: [issue("maps-not-top-ten", "high"), issue("technical-problem", "medium")],
      summary: { finalUrl: "https://example.com/", issueCounts: {} },
      profiles: { simulatedGooglebotRendered: { capturedAt: "2026-09-10T00:00:00.000Z" } },
      siteAudit: {
        context: { businessName: "Example", trade: "Dog boarding", city: "Clover", state: "SC", targetServices: [], serviceAreas: [] },
        pages: [{ statusCode: 200, title: "Dog Boarding in Clover", h1: ["Dog Boarding in Clover"], url: "https://example.com/dog-boarding-clover", metaDescription: "Dog boarding for Clover families.", headings: [], wordCount: 300 }],
        grades: [
          { key: "technical", label: "Technical SEO", grade: "B", score: 85, rationale: "Measured" },
          { key: "local_seo", label: "Local SEO strength", grade: "F", score: 35, rationale: "Old ranking model" },
        ],
        plainLanguageSummary: [],
      },
    } as unknown as TechnicalSeoScanResult;

    const report = buildTechnicalSeoReportModel(result);
    expect(report.issues.map((item) => item.id)).toEqual(["technical-problem"]);
    expect(report.grades.map((item) => item.key)).toEqual(["technical", "local_seo"]);
    expect(report.grades[1]).toMatchObject({ label: "SEO content & local targeting", grade: "A", score: 100 });
    expect(report.grades[1].rationale).toContain("Google rankings are not used");
  });

  it("keeps the client PDF to four pages, independent grades, and the header logo in every footer", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "client/src/features/technical-seo/TechnicalSeoReportPage.tsx"), "utf8");
    expect(source.match(/<section className="seo-report-page/g)).toHaveLength(4);
    expect(source).toContain("logo-header-lockup-20260713-v4.png?v=20260910-technical-report-v1");
    expect(source).toContain("Each category is graded independently from A–F");
    expect(source).toContain("Content and conversion opportunities");
    expect(source).not.toContain("Copy email");
    expect(source).not.toContain("EMAIL VERSION");
    expect(source).not.toContain("Measured site, speed, and local evidence");
    const scannerSource = fs.readFileSync(path.join(process.cwd(), "client/src/features/technical-seo/TechnicalSeoScannerPage.tsx"), "utf8");
    expect(scannerSource).toContain('const RETIRED_RANKING_ISSUES = new Set(["organic-not-top-ten", "maps-not-top-ten"]);');
  });
});

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { TechnicalSeoIssue, TechnicalSeoScanResult } from "../../shared/technicalSeo";
import { buildTechnicalSeoReportModel, prioritizeReportIssues, truncateReportText } from "../../client/src/features/technical-seo/reportModel";

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

  it("hides retired ranking findings and the local ranking-derived grade from saved scans", () => {
    const result = {
      issues: [issue("maps-not-top-ten", "high"), issue("technical-problem", "medium")],
      summary: { finalUrl: "https://example.com/", issueCounts: {} },
      profiles: { simulatedGooglebotRendered: { capturedAt: "2026-09-10T00:00:00.000Z" } },
      siteAudit: {
        grades: [
          { key: "technical", label: "Technical SEO", grade: "B", score: 85, rationale: "Measured" },
          { key: "local_seo", label: "Local SEO strength", grade: "F", score: 35, rationale: "Old ranking model" },
        ],
        plainLanguageSummary: [],
      },
    } as unknown as TechnicalSeoScanResult;

    const report = buildTechnicalSeoReportModel(result);
    expect(report.issues.map((item) => item.id)).toEqual(["technical-problem"]);
    expect(report.grades.map((item) => item.key)).toEqual(["technical"]);
  });

  it("keeps the client PDF to three pages and uses the header logo in every footer", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "client/src/features/technical-seo/TechnicalSeoReportPage.tsx"), "utf8");
    expect(source.match(/<section className="seo-report-page/g)).toHaveLength(3);
    expect(source).toContain("logo-header-lockup-20260713-v4.png?v=20260910-technical-report-v1");
    expect(source).not.toContain("Copy email");
    expect(source).not.toContain("EMAIL VERSION");
    expect(source).not.toContain("Measured site, speed, and local evidence");
    const scannerSource = fs.readFileSync(path.join(process.cwd(), "client/src/features/technical-seo/TechnicalSeoScannerPage.tsx"), "utf8");
    expect(scannerSource).toContain('const RETIRED_RANKING_ISSUES = new Set(["organic-not-top-ten", "maps-not-top-ten"]);');
  });
});

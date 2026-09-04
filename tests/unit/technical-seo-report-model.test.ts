import { describe, expect, it } from "vitest";
import type { TechnicalSeoIssue } from "../../shared/technicalSeo";
import { prioritizeReportIssues, truncateReportText } from "../../client/src/features/technical-seo/reportModel";

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
});

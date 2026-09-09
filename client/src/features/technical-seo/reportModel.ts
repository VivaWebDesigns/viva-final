import type { TechnicalSeoGrade, TechnicalSeoIssue, TechnicalSeoScanResult } from "@shared/technicalSeo";

const ORDER: Record<TechnicalSeoIssue["severity"], number> = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 };
export function truncateReportText(value: string, limit: number) { const clean = value.replace(/\s+/g, " ").trim(); return clean.length <= limit ? clean : `${clean.slice(0, limit - 1).trimEnd()}…`; }
export function prioritizeReportIssues(issues: TechnicalSeoIssue[], limit = 6) { return [...issues].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]).slice(0, limit); }

export function buildTechnicalSeoReportModel(result: TechnicalSeoScanResult) {
  const audit = result.siteAudit;
  const domain = new URL(result.summary.finalUrl).hostname;
  const fallbackGrades: TechnicalSeoGrade[] = [{ key: "technical", label: "Technical SEO & source code", grade: result.summary.issueCounts.critical || result.summary.issueCounts.high ? "F" : result.summary.issueCounts.medium ? "C" : "A", score: null, rationale: "Legacy one-page scan; run a new full audit for site-wide grading." }];
  const issues = prioritizeReportIssues(result.issues.filter((item) => item.severity !== "informational"), 999);
  return { domain, finalUrl: result.summary.finalUrl, capturedAt: result.profiles.simulatedGooglebotRendered.capturedAt, context: audit?.context, grades: audit?.grades ?? fallbackGrades, issues, summary: audit?.plainLanguageSummary ?? issues.slice(0, 4).map((item) => `${item.name}: ${item.interpretation}`), pages: audit?.pages ?? [], crawl: audit?.crawl, performance: audit?.performance, local: audit?.local, coverage: audit?.coverage, counts: result.summary.issueCounts };
}

function value(input: unknown) { return input === null || input === undefined || input === "" ? "Not available" : String(input); }
export function buildEmailVersion(result: TechnicalSeoScanResult): string {
  const report = buildTechnicalSeoReportModel(result);
  const lines: string[] = ["EMAIL VERSION — COPY AND PASTE READY", "", "LOCAL SEO AND TECHNICAL AUDIT", report.context?.businessName ?? report.domain, report.finalUrl, "", "CATEGORY GRADES"];
  for (const grade of report.grades) lines.push(`- ${grade.label}: ${grade.grade}${grade.score === null ? "" : ` (${grade.score}/100)`}`, `  ${grade.rationale}`);
  lines.push("", "PLAIN-LANGUAGE SUMMARY");
  for (const item of report.summary) lines.push(`- ${item}`);
  lines.push("", "COMPREHENSIVE ISSUE LIST — ORDERED BY RANKING IMPACT");
  if (!report.issues.length) lines.push("- No confirmed material issue was detected within the completed checks.");
  report.issues.forEach((issue, index) => {
    lines.push(`${index + 1}. [${issue.severity.toUpperCase()}] ${issue.name}`, `- Problem: ${issue.observation}`, `- Evidence: ${issue.evidence}`, `- Why it matters: ${issue.rankingImpact ?? issue.interpretation}`);
    if (issue.affectedUrls?.length) lines.push(`- Affected pages: ${issue.affectedUrls.length}${issue.affectedUrls.length <= 5 ? ` (${issue.affectedUrls.join(", ")})` : ""}`);
  });
  if (report.crawl) lines.push("", "CRAWL EVIDENCE", `- Pages discovered: ${report.crawl.discovered}`, `- Pages crawled: ${report.crawl.crawled}`, `- Broken internal links: ${report.crawl.brokenInternalLinks.length}`, `- Thin pages: ${report.crawl.thinPages.length}`, `- Duplicate title groups: ${report.crawl.duplicateTitles.length}`);
  if (report.performance) lines.push("", "PAGE SPEED EVIDENCE", `- Status: ${report.performance.status.replace("_", " ")}`, `- Mobile score: ${value(report.performance.mobile?.score)}`, `- Mobile LCP: ${report.performance.mobile?.lcpMs ? `${Math.round(report.performance.mobile.lcpMs)} ms` : "Not available"}`, `- Desktop score: ${value(report.performance.desktop?.score)}`);
  if (report.local) lines.push("", "LOCAL SEARCH EVIDENCE", `- Status: ${report.local.status.replace("_", " ")}`, `- Representative query: ${value(report.local.query)}`, `- Organic rank: ${value(report.local.organicRank)}`, `- Map rank: ${value(report.local.mapRank)}`, `- Matched profile: ${value(report.local.profile?.title)}`);
  lines.push("", "AUDIT COVERAGE");
  for (const item of report.coverage?.assessed ?? []) lines.push(`- Assessed: ${item}`);
  for (const item of report.coverage?.notAssessed ?? []) lines.push(`- Not assessed: ${item}`);
  return lines.join("\n");
}

import type { TechnicalSeoGrade, TechnicalSeoIssue, TechnicalSeoScanResult } from "@shared/technicalSeo";
import { scoreSeoContentTargeting } from "@shared/technicalSeoContent";

const ORDER: Record<TechnicalSeoIssue["severity"], number> = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 };
export function truncateReportText(value: string, limit: number) { const clean = value.replace(/\s+/g, " ").trim(); return clean.length <= limit ? clean : `${clean.slice(0, limit - 1).trimEnd()}…`; }
export function prioritizeReportIssues(issues: TechnicalSeoIssue[], limit = 6) { return [...issues].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]).slice(0, limit); }

export function buildTechnicalSeoReportModel(result: TechnicalSeoScanResult) {
  const audit = result.siteAudit;
  const domain = new URL(result.summary.finalUrl).hostname;
  const fallbackGrades: TechnicalSeoGrade[] = [{ key: "technical", label: "Technical SEO & source code", grade: result.summary.issueCounts.critical || result.summary.issueCounts.high ? "F" : result.summary.issueCounts.medium ? "C" : "A", score: null, rationale: "Legacy one-page scan; run a new full audit for site-wide grading." }];
  const retiredRankingIssues = new Set(["organic-not-top-ten", "maps-not-top-ten"]);
  const issues = prioritizeReportIssues(result.issues.filter((item) => item.severity !== "informational" && !retiredRankingIssues.has(item.id)), 999);
  const grades = (audit?.grades ?? fallbackGrades).map((item) => {
    if (item.key !== "local_seo" || !audit) return item;
    const contentTargeting = scoreSeoContentTargeting(audit.pages, audit.context);
    return { ...item, label: "SEO content & local targeting", score: contentTargeting.score, grade: contentTargeting.grade, rationale: contentTargeting.rationale };
  });
  return { domain, finalUrl: result.summary.finalUrl, capturedAt: result.profiles.simulatedGooglebotRendered.capturedAt, context: audit?.context, grades, issues, summary: audit?.plainLanguageSummary ?? issues.slice(0, 4).map((item) => `${item.name}: ${item.interpretation}`), pages: audit?.pages ?? [], crawl: audit?.crawl, performance: audit?.performance, local: audit?.local, coverage: audit?.coverage, counts: result.summary.issueCounts };
}

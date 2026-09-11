import type { TechnicalSeoGrade, TechnicalSeoIssue, TechnicalSeoScanResult } from "@shared/technicalSeo";
import { scoreSeoContentTargeting } from "@shared/technicalSeoContent";

const ORDER: Record<TechnicalSeoIssue["severity"], number> = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 };
export function truncateReportText(value: string, limit: number) { const clean = value.replace(/\s+/g, " ").trim(); return clean.length <= limit ? clean : `${clean.slice(0, limit - 1).trimEnd()}…`; }
export function prioritizeReportIssues(issues: TechnicalSeoIssue[], limit = 6) { return [...issues].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]).slice(0, limit); }

function rootCause(issue: TechnicalSeoIssue) {
  if (/performance|web vitals|page speed/i.test(issue.category)) return "performance";
  if (/business profile|nap consistency/i.test(issue.category)) return "business-identity";
  if (/local seo|content quality/i.test(issue.category)) return issue.id.includes("location") ? "local-coverage" : "service-architecture";
  if (/trust|conversion/i.test(issue.category)) return "conversion-trust";
  if (/metadata|content structure|headings/i.test(issue.category)) return "page-structure";
  if (/crawl|index|http|render|canonical|internal linking|javascript/i.test(issue.category)) return "technical-access";
  return issue.category.toLowerCase();
}

export function consolidateReportIssues(issues: TechnicalSeoIssue[], limit = 6) {
  const ordered = prioritizeReportIssues(issues, 999);
  const roots = new Set<string>();
  const selected: TechnicalSeoIssue[] = [];
  for (const issue of ordered) {
    const root = rootCause(issue);
    if (roots.has(root)) continue;
    roots.add(root); selected.push(issue);
    if (selected.length === limit) return selected;
  }
  for (const issue of ordered) {
    if (!selected.includes(issue)) selected.push(issue);
    if (selected.length === limit) break;
  }
  return selected;
}

export function buildTechnicalSeoReportModel(result: TechnicalSeoScanResult) {
  const audit = result.siteAudit;
  const domain = new URL(result.summary.finalUrl).hostname;
  const fallbackGrades: TechnicalSeoGrade[] = [{ key: "technical", label: "Technical SEO & source code", grade: result.summary.issueCounts.critical || result.summary.issueCounts.high ? "F" : result.summary.issueCounts.medium ? "C" : "A", score: null, rationale: "Legacy one-page scan; run a new full audit for site-wide grading." }];
  const retiredRankingIssues = new Set(["organic-not-top-ten", "maps-not-top-ten"]);
  const issues = consolidateReportIssues(result.issues.filter((item) => item.severity !== "informational" && !retiredRankingIssues.has(item.id)), 6);
  const grades = (audit?.grades ?? fallbackGrades).map((item) => {
    if (item.key !== "local_seo" || !audit) return item;
    const contentTargeting = scoreSeoContentTargeting(audit.pages, audit.context);
    return { ...item, label: "SEO content & local targeting", score: contentTargeting.score, grade: contentTargeting.grade, rationale: contentTargeting.rationale };
  });
  const themes = audit?.insights?.themes?.length ? audit.insights.themes : (audit?.plainLanguageSummary ?? []).map((summary, index) => ({ title: `Business impact ${index + 1}`, summary, issueIds: [] }));
  const opportunities = audit?.insights?.opportunities ?? [];
  return { domain, finalUrl: result.summary.finalUrl, capturedAt: result.profiles.simulatedGooglebotRendered.capturedAt, context: audit?.context, grades, issues, summary: audit?.plainLanguageSummary ?? issues.slice(0, 4).map((item) => `${item.name}: ${item.interpretation}`), themes, opportunities, pages: audit?.pages ?? [], crawl: audit?.crawl, performance: audit?.performance, local: audit?.local, coverage: audit?.coverage, counts: result.summary.issueCounts };
}

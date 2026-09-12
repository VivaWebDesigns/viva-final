import type { TechnicalSeoGrade, TechnicalSeoIssue, TechnicalSeoScanResult } from "@shared/technicalSeo";
import { scoreSeoContentTargeting } from "@shared/technicalSeoContent";
import { normalizeTechnicalSeoResult } from "@shared/technicalSeoScoring";

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
  result = normalizeTechnicalSeoResult(result);
  const audit = result.siteAudit;
  const domain = new URL(result.summary.finalUrl).hostname;
  const fallbackGrades: TechnicalSeoGrade[] = [{ key: "technical", label: "Technical SEO & source code", grade: result.summary.issueCounts.critical || result.summary.issueCounts.high ? "F" : result.summary.issueCounts.medium ? "C" : "A", score: null, rationale: "Legacy one-page scan; run a new full audit for site-wide grading." }];
  const retiredIssues = new Set(["organic-not-top-ten", "maps-not-top-ten", "missing-review-schema", "missing-service-schema"]);
  const issues = consolidateReportIssues(result.issues.filter((item) => item.severity !== "informational" && !retiredIssues.has(item.id)), 6);
  const contentTargeting = audit ? scoreSeoContentTargeting(audit.pages, audit.context) : null;
  const grades = (audit?.grades ?? fallbackGrades).map((item) => {
    if (item.key === "technical" && result.version === 2) return { ...item, grade: "Not assessed" as const, score: null, rationale: "This legacy scan used the retired overlapping score. Rerun the audit for an independent technical grade." };
    if (item.key !== "local_seo" || !audit) return item;
    return { ...item, label: "SEO content & local targeting", score: contentTargeting!.score, grade: contentTargeting!.grade, rationale: contentTargeting!.rationale };
  });
  const themeTitle = (summary: string) => /mobile performance/i.test(summary) ? "Mobile speed is creating customer friction" : /services?, locations?|alignment/i.test(summary) ? "The site architecture does not match local search demand" : /trust|contact|credib/i.test(summary) ? "The website is not converting confidence into action" : /business profile|identity/i.test(summary) ? "The website and Business Profile need one consistent identity" : "Technical conditions are limiting the site’s potential";
  const themes = audit?.insights?.themes?.length ? audit.insights.themes : (audit?.plainLanguageSummary ?? []).map((summary) => ({ title: themeTitle(summary), summary, issueIds: [] }));
  const successfulPages = audit?.pages.filter((page) => page.statusCode === 200) ?? [];
  const legacyOpportunities = audit && contentTargeting ? [
    ...(successfulPages.length < 3 ? [{ title: "Create a clearer core page architecture", rationale: "Separate the homepage, primary services, company proof, and contact journey so each page has one useful purpose.", evidence: `Only ${successfulPages.length} successful page(s) were available in the crawl.`, priority: "high" as const }] : []),
    ...(contentTargeting.serviceMatches < contentTargeting.serviceTargetCount ? [{ title: "Build dedicated priority-service pages", rationale: "Give each priority service a substantial page with a specific promise, process, proof, questions, and direct next step.", evidence: `${contentTargeting.serviceMatches}/${contentTargeting.serviceTargetCount} service targets appear in meaningful page signals.`, priority: "high" as const }] : []),
    ...(contentTargeting.locationMatches < contentTargeting.locationTargetCount ? [{ title: "Strengthen local relevance", rationale: "Connect real service areas to relevant service pages using useful, natural location detail.", evidence: `${contentTargeting.locationMatches}/${contentTargeting.locationTargetCount} location targets appear in meaningful page signals.`, priority: "high" as const }] : []),
    ...(!successfulPages.some((page) => page.signals?.reviewMentions) ? [{ title: "Place proof beside key decisions", rationale: "Use authentic testimonials, credentials, and concrete business details near service claims and calls to action.", evidence: "Review or testimonial language was not detected in the stored crawl.", priority: "medium" as const }] : []),
    ...(!successfulPages.some((page) => page.signals?.forms || page.signals?.callsToAction) ? [{ title: "Create a dependable inquiry path", rationale: "Use a clear action with a working phone, booking destination, or concise lead form.", evidence: "No clear CTA or form was detected in the stored crawl.", priority: "high" as const }] : []),
  ].slice(0, 6) : [];
  const opportunities = audit?.insights?.opportunities?.length ? audit.insights.opportunities : legacyOpportunities;
  return { domain, finalUrl: result.summary.finalUrl, capturedAt: result.profiles.simulatedGooglebotRendered.capturedAt, context: audit?.context, grades, issues, summary: audit?.plainLanguageSummary ?? issues.slice(0, 4).map((item) => `${item.name}: ${item.interpretation}`), themes, opportunities, pages: audit?.pages ?? [], crawl: audit?.crawl, performance: audit?.performance, local: audit?.local, coverage: audit?.coverage, counts: result.summary.issueCounts };
}

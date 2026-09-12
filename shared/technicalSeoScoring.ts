import type { TechnicalSeoGrade, TechnicalSeoIssue, TechnicalSeoScanResult } from "./technicalSeo";

type GradeKey = TechnicalSeoGrade["key"];

const CATEGORY_OWNERS: Record<string, GradeKey> = {
  HTTP: "technical",
  Crawlability: "technical",
  Indexability: "technical",
  Rendering: "technical",
  Canonicalization: "technical",
  JavaScript: "technical",
  Resources: "technical",
  Metadata: "technical",
  Headings: "technical",
  "Content structure": "technical",
  Images: "technical",
  "Structured data": "technical",
  "Internal linking": "technical",
  "Page speed": "performance",
  "Core Web Vitals": "performance",
  "Google Business Profile": "business_profile",
  "NAP consistency": "business_profile",
  "Local SEO": "local_seo",
  "Content quality": "local_seo",
  "Trust & conversion": "trust_conversion",
  Measurement: "trust_conversion",
};

const DUPLICATE_ROOTS: Record<string, string> = {
  noindex: "index-blocked",
  "site-noindex-pages": "index-blocked",
  "missing-title": "missing-title",
  "site-missing-titles": "missing-title",
  "missing-description": "missing-description",
  "site-missing-descriptions": "missing-description",
  "missing-h1": "missing-h1",
  "site-missing-h1": "missing-h1",
};

const TECHNICAL_GROUPS: Record<string, { key: string; cap: number }> = {
  HTTP: { key: "access", cap: 75 },
  Crawlability: { key: "access", cap: 75 },
  Indexability: { key: "access", cap: 75 },
  Rendering: { key: "access", cap: 75 },
  Canonicalization: { key: "access", cap: 75 },
  Metadata: { key: "metadata", cap: 30 },
  Headings: { key: "structure", cap: 25 },
  "Content structure": { key: "structure", cap: 25 },
  Images: { key: "structure", cap: 25 },
  "Structured data": { key: "structured-data", cap: 20 },
  "Internal linking": { key: "internal-links", cap: 20 },
  JavaScript: { key: "runtime", cap: 15 },
  Resources: { key: "runtime", cap: 15 },
};

const SEVERITY_PENALTIES: Record<TechnicalSeoIssue["severity"], number> = {
  critical: 55,
  high: 15,
  medium: 7,
  low: 3,
  informational: 0,
};

function letterGrade(score: number): Exclude<TechnicalSeoGrade["grade"], "Not assessed"> {
  return score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
}

export function gradeKeyForTechnicalSeoIssue(issue: TechnicalSeoIssue): GradeKey {
  return issue.gradeKey ?? CATEGORY_OWNERS[issue.category] ?? "technical";
}

export function assignTechnicalSeoIssueGrades(issues: TechnicalSeoIssue[]): TechnicalSeoIssue[] {
  return issues.map((issue) => ({ ...issue, gradeKey: gradeKeyForTechnicalSeoIssue(issue) }));
}

export function scoreTechnicalSeoIssues(issues: TechnicalSeoIssue[]) {
  const strongestByRoot = new Map<string, TechnicalSeoIssue>();
  for (const issue of issues) {
    if (issue.severity === "informational" || gradeKeyForTechnicalSeoIssue(issue) !== "technical") continue;
    const root = DUPLICATE_ROOTS[issue.id] ?? issue.id;
    const existing = strongestByRoot.get(root);
    if (!existing || SEVERITY_PENALTIES[issue.severity] > SEVERITY_PENALTIES[existing.severity]) strongestByRoot.set(root, issue);
  }

  const groupDeductions = new Map<string, number>();
  const groupCaps = new Map<string, number>();
  for (const issue of strongestByRoot.values()) {
    const group = TECHNICAL_GROUPS[issue.category] ?? { key: "other-technical", cap: 15 };
    groupDeductions.set(group.key, (groupDeductions.get(group.key) ?? 0) + SEVERITY_PENALTIES[issue.severity]);
    groupCaps.set(group.key, group.cap);
  }

  const deduction = [...groupDeductions.entries()].reduce((total, [key, value]) => total + Math.min(value, groupCaps.get(key) ?? value), 0);
  const score = Math.max(0, 100 - deduction);
  return { score, grade: letterGrade(score), findingCount: strongestByRoot.size, deduction };
}

export function normalizeTechnicalSeoResult(result: TechnicalSeoScanResult): TechnicalSeoScanResult {
  if (result.version !== 3 || !result.siteAudit) return result;
  const issues = assignTechnicalSeoIssueGrades(result.issues);
  const technical = scoreTechnicalSeoIssues(issues);
  const rationale = `${technical.findingCount} confirmed technical finding${technical.findingCount === 1 ? "" : "s"} scored once with capped deductions across ${result.siteAudit.pages.length} crawled page${result.siteAudit.pages.length === 1 ? "" : "s"}. Performance, business-profile, content, and conversion findings do not affect this grade.`;
  const grades = result.siteAudit.grades.map((item) => item.key === "technical" ? { ...item, grade: technical.grade, score: technical.score, rationale } : item);
  return { ...result, issues, siteAudit: { ...result.siteAudit, grades } };
}

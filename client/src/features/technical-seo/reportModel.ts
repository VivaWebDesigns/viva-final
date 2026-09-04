import type { TechnicalSeoIssue, TechnicalSeoScanResult } from "@shared/technicalSeo";

export type ReportTone = "positive" | "warning" | "negative" | "neutral";

export interface ReportSignal {
  label: string;
  value: string;
  tone: ReportTone;
}

const SEVERITY_ORDER: Record<TechnicalSeoIssue["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  informational: 4,
};

export function truncateReportText(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1).trimEnd()}…`;
}

export function prioritizeReportIssues(issues: TechnicalSeoIssue[], limit = 6): TechnicalSeoIssue[] {
  return [...issues]
    .sort((left, right) => SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity])
    .slice(0, limit);
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function reportVerdict(result: TechnicalSeoScanResult): { title: string; body: string; tone: ReportTone } {
  const { summary } = result;
  if (summary.crawlable === "no" || summary.indexability === "not_indexable" || summary.renderable === "no") {
    return {
      title: "Material search-access barriers detected",
      body: "The scanned page contains conditions that can prevent or materially limit crawling, rendering, or indexing. These should become non-negotiable requirements in any fresh website build.",
      tone: "negative",
    };
  }
  if (summary.issueCounts.critical > 0 || summary.issueCounts.high > 0) {
    return {
      title: "Search-accessible with significant SEO risk",
      body: "Search engines can reach the page, but high-impact signals deserve attention. A fresh build should solve them at the template and architecture level instead of treating them as isolated patches.",
      tone: "warning",
    };
  }
  if (summary.issueCounts.medium > 0 || summary.renderable === "with_issues") {
    return {
      title: "Search-accessible with important opportunities",
      body: "The page is technically available to search engines, with specific gaps or dependencies that should inform the architecture, templates, and quality controls of a fresh build.",
      tone: "warning",
    };
  }
  return {
    title: "Sound page-level technical foundation",
    body: "The scanned page exposes its primary technical signals successfully. A fresh build should preserve these strengths while improving site architecture, search targeting, conversion paths, and long-term maintainability.",
    tone: "positive",
  };
}

export function buildTechnicalSeoReportModel(result: TechnicalSeoScanResult) {
  const rendered = result.profiles.simulatedGooglebotRendered;
  const raw = result.profiles.simulatedGooglebotRaw;
  const topIssues = prioritizeReportIssues(result.issues);
  const changedSignals = Object.entries(result.comparisons.rawVsRendered)
    .filter(([, value]) => Boolean((value as { changed?: boolean })?.changed))
    .map(([key]) => titleCase(key));
  const schemaTypes = [...new Set(rendered.structuredData.flatMap((item) => item.types))];
  const noindex = rendered.robots.noindex || rendered.xRobotsTag.noindex;
  const nofollow = rendered.robots.nofollow || rendered.xRobotsTag.nofollow;

  const accessSignals: ReportSignal[] = [
    { label: "HTTP response", value: rendered.statusCode ? String(rendered.statusCode) : "Unavailable", tone: rendered.statusCode === 200 ? "positive" : "negative" },
    { label: "robots.txt", value: result.robotsTxt.allowed === true ? "Allowed" : result.robotsTxt.allowed === false ? "Blocked" : "Uncertain", tone: result.robotsTxt.allowed === true ? "positive" : result.robotsTxt.allowed === false ? "negative" : "warning" },
    { label: "Index directive", value: noindex ? "Noindex detected" : "No noindex detected", tone: noindex ? "negative" : "positive" },
    { label: "Link directive", value: nofollow ? "Nofollow detected" : "Links may be followed", tone: nofollow ? "warning" : "positive" },
    { label: "Canonical", value: rendered.canonical[0] ?? "Missing", tone: rendered.canonical.length === 1 ? "positive" : "warning" },
    { label: "Sitemap", value: result.sitemap.foundIn.length ? "URL found" : "Not confirmed", tone: result.sitemap.foundIn.length ? "positive" : "warning" },
    { label: "Redirects", value: rendered.redirects.length ? `${rendered.redirects.length} hop(s)` : "None", tone: rendered.redirects.length > 2 ? "warning" : "neutral" },
    { label: "Final URL", value: rendered.finalUrl, tone: "neutral" },
  ];

  const pageSignals: ReportSignal[] = [
    { label: "Page title", value: rendered.title ?? "Missing", tone: rendered.title ? "positive" : "negative" },
    { label: "Meta description", value: rendered.metaDescription ?? "Missing", tone: rendered.metaDescription ? "positive" : "warning" },
    { label: "Primary heading", value: rendered.h1.join(" · ") || "Missing", tone: rendered.h1.length === 1 ? "positive" : "warning" },
    { label: "Heading structure", value: `${rendered.headings.length} heading(s)`, tone: rendered.headings.length ? "positive" : "warning" },
    { label: "Structured data", value: schemaTypes.length ? schemaTypes.join(", ") : "Not detected", tone: schemaTypes.length ? "positive" : "neutral" },
    { label: "Internal links", value: `${rendered.internalLinks.length} detected`, tone: rendered.internalLinks.length ? "positive" : "warning" },
    { label: "Visible content", value: `${rendered.visibleWordCount.toLocaleString()} words`, tone: rendered.meaningfulContent ? "positive" : "warning" },
    { label: "Language", value: rendered.language ?? "Not declared", tone: rendered.language ? "positive" : "neutral" },
  ];

  const strengths = [
    result.summary.crawlable === "yes" ? "The scanned page is allowed by the evaluated robots.txt rules." : null,
    result.summary.indexability === "indexable" ? "No deterministic page-level block to indexing was detected." : null,
    result.summary.renderable !== "no" ? "Primary page content could be rendered in Chromium." : null,
    result.summary.canonicalStatus === "self_referencing" ? "A self-referencing canonical was detected." : null,
    result.summary.structuredDataDetected ? "Structured data was detected in the page output." : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const requirements = [
    "Deliver primary service content and metadata in crawlable HTML, with JavaScript used as enhancement rather than a dependency.",
    "Plan the information architecture around services, markets, user intent, and intentional internal-link pathways.",
    "Control titles, descriptions, headings, canonicals, robots directives, and schema at the template level.",
    "Build performance, accessibility, responsive behavior, analytics, and conversion measurement into acceptance testing.",
    "Preserve valuable URLs and authority with a reviewed redirect and migration plan before launch.",
    ...topIssues.slice(0, 3).map((issue) => `Resolve “${issue.name}” systematically: ${truncateReportText(issue.recommendedAction, 150)}`),
  ].slice(0, 8);

  return {
    domain: new URL(result.summary.finalUrl).hostname,
    finalUrl: result.summary.finalUrl,
    capturedAt: rendered.capturedAt,
    verdict: reportVerdict(result),
    accessSignals,
    pageSignals,
    topIssues,
    changedSignals,
    rawWordCount: raw.visibleWordCount,
    renderedWordCount: rendered.visibleWordCount,
    browserErrors: rendered.pageErrors.length,
    failedRequests: rendered.failedRequests.length,
    renderError: rendered.renderError,
    strengths,
    requirements,
  };
}

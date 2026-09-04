export type TechnicalSeoScanStatus = "queued" | "validating" | "fetching" | "rendering" | "analyzing" | "completed" | "failed" | "cancelled";
export type TechnicalSeoSeverity = "critical" | "high" | "medium" | "low" | "informational";

export interface SeoDirectiveSet {
  raw: string[];
  noindex: boolean;
  nofollow: boolean;
  none: boolean;
  noarchive: boolean;
  nosnippet: boolean;
  maxSnippet?: string;
  maxImagePreview?: string;
  maxVideoPreview?: string;
  unavailableAfter?: string;
}

export interface TechnicalSeoSnapshot {
  profile: "neutral_raw" | "simulated_googlebot_raw" | "simulated_googlebot_rendered";
  requestProfile: { userAgent: string; browserEngine?: string; browserVersion?: string; viewport?: string };
  requestedUrl: string;
  finalUrl: string;
  statusCode: number | null;
  responseTimeMs: number | null;
  redirects: Array<{ from: string; to: string; status: number }>;
  headers: Record<string, string>;
  title: string | null;
  metaDescription: string | null;
  robots: SeoDirectiveSet;
  xRobotsTag: SeoDirectiveSet;
  canonical: string[];
  viewport: string | null;
  charset: string | null;
  language: string | null;
  headings: Array<{ level: number; text: string }>;
  h1: string[];
  visibleTextSample: string;
  visibleWordCount: number;
  meaningfulContent: boolean;
  internalLinks: string[];
  externalLinks: string[];
  links: { total: number; withoutHref: number; javascript: number; fragments: number; mailto: number; tel: number; nofollow: number };
  structuredData: Array<{ valid: boolean; types: string[]; data?: unknown; error?: string }>;
  openGraph: Record<string, string>;
  twitter: Record<string, string>;
  consoleMessages: Array<{ type: string; text: string }>;
  pageErrors: string[];
  failedRequests: Array<{ url: string; error: string }>;
  renderError: string | null;
  capturedAt: string;
}

export interface TechnicalSeoIssue {
  id: string;
  name: string;
  severity: TechnicalSeoSeverity;
  category: string;
  observation: string;
  evidence: string;
  interpretation: string;
  recommendedAction: string;
}

export interface TechnicalSeoScanResult {
  version: 1;
  disclaimer: string;
  limits: Record<string, number | string>;
  profiles: { neutralRaw: TechnicalSeoSnapshot; simulatedGooglebotRaw: TechnicalSeoSnapshot; simulatedGooglebotRendered: TechnicalSeoSnapshot };
  robotsTxt: { url: string; statusCode: number | null; allowed: boolean | null; matchedAgent: string | null; applicableRules: string[]; sitemaps: string[]; error: string | null };
  sitemap: { checked: string[]; foundIn: string[]; errors: string[] };
  comparisons: { fetchProfiles: Record<string, unknown>; rawVsRendered: Record<string, unknown> };
  issues: TechnicalSeoIssue[];
  summary: {
    finalUrl: string;
    httpStatus: number | null;
    crawlable: "yes" | "no" | "partial" | "uncertain";
    indexability: "indexable" | "not_indexable" | "uncertain";
    renderable: "yes" | "no" | "with_issues";
    canonicalStatus: string;
    robotsStatus: string;
    structuredDataDetected: boolean;
    importantRawRenderedDifferences: number;
    issueCounts: Record<TechnicalSeoSeverity, number>;
  };
}

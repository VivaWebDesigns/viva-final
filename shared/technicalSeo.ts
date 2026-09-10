export type TechnicalSeoScanStatus = "queued" | "validating" | "fetching" | "rendering" | "analyzing" | "completed" | "failed" | "cancelled";
export type TechnicalSeoSeverity = "critical" | "high" | "medium" | "low" | "informational";
export type TechnicalSeoConfidence = "confirmed" | "strong" | "limited";

export interface TechnicalSeoAuditContext {
  businessName: string;
  trade: string;
  city: string;
  state: string;
  address?: string;
  phone?: string;
  googleBusinessUrl?: string;
  targetServices: string[];
  serviceAreas: string[];
}

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
  confidence?: TechnicalSeoConfidence;
  affectedUrls?: string[];
  rankingImpact?: string;
}

export interface TechnicalSeoPageAudit {
  url: string;
  statusCode: number | null;
  responseTimeMs: number | null;
  title: string | null;
  metaDescription: string | null;
  canonical: string[];
  robots: SeoDirectiveSet;
  h1: string[];
  headings: Array<{ level: number; text: string }>;
  wordCount: number;
  internalLinks: string[];
  externalLinks: string[];
  schemaTypes: string[];
  images: { total: number; missingAlt: number; emptyAlt: number; missingDimensions: number; lazyLoaded: number; modernFormat: number };
  contact: { phones: string[]; emails: string[]; addresses: string[] };
  signals: { forms: number; callsToAction: number; reviewMentions: number; socialLinks: string[]; analytics: string[] };
  platformHints: string[];
  fetchError: string | null;
}

export interface TechnicalSeoPerformanceResult {
  status: "measured" | "estimated" | "not_assessed" | "provider_error";
  source?: "google_pagespeed" | "local_chromium";
  reason?: string;
  mobile?: TechnicalSeoPerformanceProfile;
  desktop?: TechnicalSeoPerformanceProfile;
}

export interface TechnicalSeoPerformanceProfile {
  score: number | null;
  accessibilityScore: number | null;
  seoScore: number | null;
  lcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  speedIndexMs: number | null;
  transferBytes: number | null;
  requestCount: number | null;
  renderBlockingResources: number | null;
  oversizedImagesBytes: number | null;
}

export interface TechnicalSeoLocalResult {
  status: "measured" | "not_assessed" | "provider_error";
  reason?: string;
  profileStatus?: "measured" | "not_assessed" | "provider_error";
  profileReason?: string;
  profileMatchMethod?: "google_business_url" | "search_result_identity" | "name_location";
  rankingsStatus?: "measured" | "not_assessed" | "provider_error";
  rankingsReason?: string;
  query?: string;
  profile?: {
    title: string | null; address: string | null; phone: string | null; website: string | null;
    category: string | null; additionalCategories: string[]; rating: number | null; reviewCount: number | null;
    claimed: boolean | null; services: string[]; hoursPresent: boolean | null;
  };
  organicRank: number | null;
  mapRank: number | null;
  competitors: Array<{ name: string; domain: string | null; rank: number; source: "organic" | "maps"; rating?: number | null; reviewCount?: number | null }>;
  receipt: { provider: string; paidRequests: number; keywords: string[] };
}

export interface TechnicalSeoGrade {
  key: "technical" | "performance" | "business_profile" | "local_seo" | "trust_conversion";
  label: string;
  grade: "A" | "B" | "C" | "D" | "F" | "Not assessed";
  score: number | null;
  rationale: string;
}

export interface TechnicalSeoSiteAudit {
  context: TechnicalSeoAuditContext;
  pages: TechnicalSeoPageAudit[];
  crawl: {
    discovered: number; crawled: number; capped: boolean; sitemapUrlsFound: number;
    brokenInternalLinks: Array<{ sourceUrl: string; targetUrl: string; statusCode: number | null }>;
    duplicateTitles: Array<{ value: string; urls: string[] }>;
    duplicateDescriptions: Array<{ value: string; urls: string[] }>;
    thinPages: string[];
  };
  performance: TechnicalSeoPerformanceResult;
  local: TechnicalSeoLocalResult;
  grades: TechnicalSeoGrade[];
  coverage: { assessed: string[]; notAssessed: string[] };
  plainLanguageSummary: string[];
}

export interface TechnicalSeoScanResult {
  version: 1 | 2;
  disclaimer: string;
  limits: Record<string, number | string>;
  profiles: { neutralRaw: TechnicalSeoSnapshot; simulatedGooglebotRaw: TechnicalSeoSnapshot; simulatedGooglebotRendered: TechnicalSeoSnapshot };
  robotsTxt: { url: string; statusCode: number | null; allowed: boolean | null; matchedAgent: string | null; applicableRules: string[]; sitemaps: string[]; error: string | null };
  sitemap: { checked: string[]; foundIn: string[]; errors: string[]; urls?: string[] };
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
  siteAudit?: TechnicalSeoSiteAudit;
}

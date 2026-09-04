export const SCAN_LIMITS = {
  maxRedirects: 8,
  maxResponseBytes: 2_000_000,
  maxDomBytes: 4_000_000,
  requestTimeoutMs: 15_000,
  navigationTimeoutMs: 25_000,
  totalScanTimeoutMs: 75_000,
  maxBrowserRequests: 150,
  maxConsoleMessages: 50,
  maxFailedRequests: 50,
  maxLinksPerKind: 500,
  maxStructuredDataBlocks: 30,
  maxSitemaps: 3,
  maxActiveScansPerUser: 2,
  maxScansPerTenMinutes: 10,
  leaseSeconds: 45,
  resultRetentionDays: 90,
} as const;

export const VIVA_SCANNER_USER_AGENT = "VivaTechnicalScanner/1.0 (+https://vivawebdesigns.com/)";
export const SIMULATED_GOOGLEBOT_USER_AGENT =
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/151.0.0.0 Safari/537.36";

export const SCAN_DISCLAIMER =
  "This scan approximates technical conditions a search crawler may encounter. It is not Google Search Console and is not a Google-generated result. The simulated Googlebot profile is unverified and does not originate from Google's infrastructure.";

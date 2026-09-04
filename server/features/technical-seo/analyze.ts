import type { TechnicalSeoIssue, TechnicalSeoScanResult, TechnicalSeoSeverity, TechnicalSeoSnapshot } from "@shared/technicalSeo";
import { SCAN_DISCLAIMER, SCAN_LIMITS, SIMULATED_GOOGLEBOT_USER_AGENT, VIVA_SCANNER_USER_AGENT } from "./constants";

function normalize(value: unknown): string { return JSON.stringify(value ?? null); }
function change(before: unknown, after: unknown) { return { raw: before, rendered: after, changed: normalize(before) !== normalize(after) }; }

function buildComparison(raw: TechnicalSeoSnapshot, rendered: TechnicalSeoSnapshot) {
  return {
    finalUrl: change(raw.finalUrl, rendered.finalUrl),
    title: change(raw.title, rendered.title),
    metaDescription: change(raw.metaDescription, rendered.metaDescription),
    robots: change(raw.robots.raw, rendered.robots.raw),
    canonical: change(raw.canonical, rendered.canonical),
    h1: change(raw.h1, rendered.h1),
    headingStructure: change(raw.headings, rendered.headings),
    visibleWordCount: change(raw.visibleWordCount, rendered.visibleWordCount),
    meaningfulContent: change(raw.meaningfulContent, rendered.meaningfulContent),
    internalLinks: change(raw.internalLinks, rendered.internalLinks),
    externalLinks: change(raw.externalLinks, rendered.externalLinks),
    structuredData: change(raw.structuredData, rendered.structuredData),
  };
}

function issue(id: string, name: string, severity: TechnicalSeoSeverity, category: string, observation: string, evidence: string, interpretation: string, recommendedAction: string): TechnicalSeoIssue {
  return { id, name, severity, category, observation, evidence, interpretation, recommendedAction };
}

export function analyzeScan(
  neutral: TechnicalSeoSnapshot,
  raw: TechnicalSeoSnapshot,
  rendered: TechnicalSeoSnapshot,
  robotsTxt: TechnicalSeoScanResult["robotsTxt"],
  sitemap: TechnicalSeoScanResult["sitemap"],
): TechnicalSeoScanResult {
  const rawVsRendered = buildComparison(raw, rendered);
  const fetchProfiles = buildComparison(neutral, raw);
  const issues: TechnicalSeoIssue[] = [];
  const status = raw.statusCode;
  if (status !== null && status >= 500) issues.push(issue("http-5xx", "Server error response", "critical", "HTTP", `The simulated-Googlebot fetch returned HTTP ${status}.`, raw.finalUrl, "Search crawlers normally cannot process a page that returns a server error.", "Fix the server error and confirm the URL returns the intended content with a successful status."));
  else if (status !== null && status >= 400) issues.push(issue("http-4xx", "Client error response", "high", "HTTP", `The simulated-Googlebot fetch returned HTTP ${status}.`, raw.finalUrl, "A 4xx response normally prevents the page content from being processed as an indexable page.", "Restore the page or redirect the URL to the appropriate replacement."));
  if (robotsTxt.allowed === false) issues.push(issue("robots-blocked", "Page blocked by robots.txt", "critical", "Crawlability", "The applicable robots.txt rule disallows this URL.", robotsTxt.applicableRules.join("; "), "A compliant crawler using these rules would normally skip fetching the page.", "Update robots.txt if this page is intended to be crawlable."));
  if (raw.robots.noindex || raw.xRobotsTag.noindex || rendered.robots.noindex || rendered.xRobotsTag.noindex) issues.push(issue("noindex", "Noindex directive detected", "high", "Indexability", "A noindex directive was found in the raw response or rendered page.", `raw meta=${raw.robots.raw.join(", ") || "none"}; raw header=${raw.xRobotsTag.raw.join(", ") || "none"}; rendered meta=${rendered.robots.raw.join(", ") || "none"}`, "This directive would normally prevent indexing if a search engine processes the same evidence.", "Remove noindex only if the page is intended to appear in search results."));
  if (rendered.renderError) issues.push(issue("render-failed", "Browser rendering failed", "high", "Rendering", "The simulated-Googlebot browser profile did not complete rendering.", rendered.renderError, "The scan cannot confirm the final DOM or JavaScript-generated content.", "Review the browser error and ensure the page can load without unsupported navigation or long-running scripts."));
  if (!raw.title && !rendered.title) issues.push(issue("missing-title", "Title element missing", "medium", "Metadata", "No title was found in the raw or rendered document.", "title: null", "A missing title removes a strong page-identification signal.", "Add a concise, descriptive title element."));
  if (!rendered.metaDescription) issues.push(issue("missing-description", "Meta description missing", "low", "Metadata", "No rendered meta description was found.", "meta description: null", "Search engines may create a snippet from page content instead.", "Add a useful description when controlling the likely snippet is valuable."));
  if (!rendered.canonical.length) issues.push(issue("missing-canonical", "Canonical link missing", "medium", "Canonicalization", "No canonical link was found in the rendered DOM.", rendered.finalUrl, "The page provides no explicit canonical preference.", "Add an absolute canonical URL if this page should declare a preferred version."));
  if (rendered.canonical.length > 1) issues.push(issue("multiple-canonicals", "Multiple canonical links", "medium", "Canonicalization", `${rendered.canonical.length} canonical URLs were found.`, rendered.canonical.join("; "), "Multiple declarations can be ambiguous, especially when values conflict.", "Emit one consistent canonical link."));
  if ((rawVsRendered.canonical as any).changed) issues.push(issue("canonical-render-change", "Canonical changed after rendering", "high", "Canonicalization", "The raw and rendered canonical declarations differ.", `raw=${raw.canonical.join(", ") || "none"}; rendered=${rendered.canonical.join(", ") || "none"}`, "JavaScript changes which canonical preference is presented in the final DOM.", "Make the canonical stable and available in the initial HTML where possible."));
  if (!rendered.h1.length) issues.push(issue("missing-h1", "H1 missing", "low", "Headings", "No H1 was found in the rendered page.", "H1 count: 0", "This may make the primary page heading less explicit.", "Add a clear primary heading when appropriate."));
  if (rendered.h1.length > 1) issues.push(issue("multiple-h1", "Multiple H1 headings", "low", "Headings", `${rendered.h1.length} H1 elements were found.`, rendered.h1.join("; "), "Multiple H1 elements are not automatically invalid, but the hierarchy may merit review.", "Confirm each H1 is intentional and the page hierarchy remains clear."));
  const malformed = rendered.structuredData.filter((item) => !item.valid);
  if (malformed.length) issues.push(issue("malformed-jsonld", "Malformed JSON-LD", "medium", "Structured data", `${malformed.length} JSON-LD block(s) could not be parsed.`, malformed.map((item) => item.error).join("; "), "Malformed JSON cannot be interpreted as structured data.", "Correct the JSON syntax and validate the resulting markup."));
  if (raw.meaningfulContent && !rendered.meaningfulContent) issues.push(issue("content-removed", "Meaningful content disappeared after rendering", "high", "Rendering", "Meaningful text existed in the initial HTML but was not present after rendering.", `raw words=${raw.visibleWordCount}; rendered words=${rendered.visibleWordCount}`, "Client-side behavior may be removing content that was initially available.", "Review hydration and conditional rendering so important content remains present."));
  else if (!raw.meaningfulContent && rendered.meaningfulContent) issues.push(issue("js-dependent-content", "Meaningful content depends on JavaScript", "informational", "Rendering", "Meaningful content appeared only after browser rendering.", `raw words=${raw.visibleWordCount}; rendered words=${rendered.visibleWordCount}`, "A JavaScript-capable renderer can access the content, while non-rendering crawlers may not.", "Keep important content server-rendered when practical and ensure required resources remain crawlable."));
  const importantChanges = Object.values(rawVsRendered).filter((value: any) => value.changed).length;
  if (importantChanges >= 5) issues.push(issue("large-render-difference", "Large raw/rendered difference", "medium", "Rendering", `${importantChanges} tracked signals changed after rendering.`, "Review the Raw vs Rendered section for field-level evidence.", "The page relies heavily on client-side rendering or rewrites several technical signals.", "Verify that each change is intentional and that critical metadata is stable."));
  const fetchChanges = Object.values(fetchProfiles).filter((value: any) => value.changed).length;
  if (fetchChanges >= 3) issues.push(issue("ua-response-difference", "Fetch profiles received materially different evidence", "medium", "HTTP", `${fetchChanges} tracked signals differed between the neutral and simulated-Googlebot raw fetches.`, "Review the Fetch Profile comparison.", "The server or edge layer may vary its response by user agent. This observation is not, by itself, proof of cloaking.", "Confirm the variation is intentional and does not hide or add materially different search-facing content."));
  if (rendered.pageErrors.length) issues.push(issue("javascript-errors", "Uncaught JavaScript errors", "low", "JavaScript", `${rendered.pageErrors.length} uncaught page error(s) occurred.`, rendered.pageErrors.slice(0, 5).join("; "), "Errors may interfere with some rendered content or interactions.", "Inspect and resolve errors that affect important page content or metadata."));
  if (rendered.failedRequests.length) issues.push(issue("failed-resources", "Browser requests failed or were blocked", "informational", "Resources", `${rendered.failedRequests.length} request failure(s) were recorded.`, rendered.failedRequests.slice(0, 5).map((item) => `${item.url}: ${item.error}`).join("; "), "Some failures are normal, but important CSS, JavaScript, or API failures can affect rendering.", "Review failures and prioritize resources required for primary content and metadata."));

  const severities: TechnicalSeoSeverity[] = ["critical", "high", "medium", "low", "informational"];
  const issueCounts = Object.fromEntries(severities.map((severity) => [severity, issues.filter((item) => item.severity === severity).length])) as Record<TechnicalSeoSeverity, number>;
  const noindex = raw.robots.noindex || raw.xRobotsTag.noindex || rendered.robots.noindex || rendered.xRobotsTag.noindex;
  const canonicalStatus = !rendered.canonical.length ? "missing" : rendered.canonical.length > 1 ? "multiple" : rendered.canonical[0] === rendered.finalUrl ? "self_referencing" : "points_elsewhere";
  return {
    version: 1,
    disclaimer: SCAN_DISCLAIMER,
    limits: { ...SCAN_LIMITS, neutralUserAgent: VIVA_SCANNER_USER_AGENT, simulatedGooglebotUserAgent: SIMULATED_GOOGLEBOT_USER_AGENT, browserViewport: "1365x768 desktop" },
    profiles: { neutralRaw: neutral, simulatedGooglebotRaw: raw, simulatedGooglebotRendered: rendered },
    robotsTxt,
    sitemap,
    comparisons: { fetchProfiles, rawVsRendered },
    issues,
    summary: {
      finalUrl: rendered.renderError ? raw.finalUrl : rendered.finalUrl,
      httpStatus: raw.statusCode,
      crawlable: robotsTxt.allowed === false ? "no" : robotsTxt.allowed === true ? "yes" : "uncertain",
      indexability: noindex || robotsTxt.allowed === false || (status !== null && status >= 400) ? "not_indexable" : status === 200 && robotsTxt.allowed === true ? "indexable" : "uncertain",
      renderable: rendered.renderError ? "no" : rendered.pageErrors.length || rendered.failedRequests.length ? "with_issues" : "yes",
      canonicalStatus,
      robotsStatus: robotsTxt.allowed === false ? "blocked" : robotsTxt.allowed === true ? "allowed" : "uncertain",
      structuredDataDetected: rendered.structuredData.length > 0,
      importantRawRenderedDifferences: importantChanges,
      issueCounts,
    },
  };
}

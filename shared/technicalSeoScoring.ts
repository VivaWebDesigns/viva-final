import type { TechnicalSeoGrade, TechnicalSeoIssue, TechnicalSeoScanResult } from "./technicalSeo";
import { assessTrustConversion } from "./technicalSeoTrust";

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
  "Site architecture": "technical",
  "URL structure": "technical",
  "Source code": "technical",
  "Platform & server": "technical",
  "Server & security": "technical",
  "Mobile delivery": "technical",
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
  "multiple-h1": "duplicated-primary-content",
  "duplicate-primary-dom-content": "duplicated-primary-content",
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
  "Site architecture": { key: "architecture", cap: 20 },
  "URL structure": { key: "architecture", cap: 20 },
  "Source code": { key: "structure", cap: 25 },
  "Platform & server": { key: "platform", cap: 10 },
  "Server & security": { key: "access", cap: 75 },
  "Mobile delivery": { key: "access", cap: 75 },
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

  const uncappedDeduction = [...groupDeductions.entries()].reduce((total, [key, value]) => total + Math.min(value, groupCaps.get(key) ?? value), 0);
  // Reserve an F for blocking failures such as robots exclusion, noindex, or server errors.
  // Accumulated non-blocking implementation debt can still lower an accessible site to C.
  const hasCriticalFinding = [...strongestByRoot.values()].some((issue) => issue.severity === "critical");
  const deduction = hasCriticalFinding ? uncappedDeduction : Math.min(30, uncappedDeduction);
  const score = Math.max(0, 100 - deduction);
  return { score, grade: letterGrade(score), findingCount: strongestByRoot.size, deduction };
}

function confirmedIssue(id: string, name: string, severity: TechnicalSeoIssue["severity"], category: string, observation: string, evidence: string, interpretation: string, recommendedAction: string, affectedUrls: string[] = []): TechnicalSeoIssue {
  return { id, name, severity, category, observation, evidence, interpretation, recommendedAction, confidence: "confirmed", evidenceStatus: "confirmed", affectedUrls, rankingImpact: interpretation, gradeKey: "technical" };
}

function normalizedUrl(value: string) {
  try { const url = new URL(value); url.hash = ""; return url.toString(); } catch { return value; }
}

export function buildTechnicalArchitectureIssues(audit: NonNullable<TechnicalSeoScanResult["siteAudit"]>): TechnicalSeoIssue[] {
  const issues: TechnicalSeoIssue[] = [];
  const successful = audit.pages.filter((page) => page.statusCode === 200);
  if (successful.length < 3) issues.push(confirmedIssue(
    "insufficient-site-architecture", "Insufficient indexable site architecture", "high", "Site architecture",
    `Only ${successful.length} successful page${successful.length === 1 ? " was" : "s were"} available in the crawl.`,
    successful.map((page) => page.url).join("; ") || "No successful pages.",
    "A site with almost no distinct page destinations cannot clearly organize its services, locations, and customer journeys for crawling or discovery.",
    "Create a deliberate page hierarchy with distinct destinations for the homepage, primary services, business proof, customer questions, and contact journey.",
    successful.map((page) => page.url),
  ));

  const encodedPaths = successful.filter((page) => { try { return /%2f/i.test(new URL(page.url).pathname); } catch { return false; } });
  if (encodedPaths.length) issues.push(confirmedIssue(
    "encoded-url-path", "Encoded slash in a page URL", "medium", "URL structure",
    `${encodedPaths.length} page URL${encodedPaths.length === 1 ? " contains" : "s contain"} an encoded slash in the path.`,
    encodedPaths.map((page) => page.url).join("; "),
    "An encoded path separator creates an awkward, less readable URL and can complicate routing, migration, and canonical management.",
    "Replace the encoded path with a short, readable page slug and permanently redirect the old URL.",
    encodedPaths.map((page) => page.url),
  ));

  const repeatedPrimaryHeadings = successful.filter((page) => {
    const headings = (page.h1 ?? []).map((value) => value.replace(/\s+/g, " ").trim().toLowerCase()).filter(Boolean);
    return new Set(headings).size < headings.length;
  });
  if (repeatedPrimaryHeadings.length) issues.push(confirmedIssue(
    "duplicate-primary-dom-content", "Primary content is duplicated in the DOM", "medium", "Source code",
    `${repeatedPrimaryHeadings.length} page${repeatedPrimaryHeadings.length === 1 ? " repeats" : "s repeat"} the same primary heading in the delivered document.`,
    repeatedPrimaryHeadings.map((page) => `${page.url}: ${(page.h1 ?? []).join(" | ")}`).join("; "),
    "Duplicated responsive or template blocks make the source hierarchy noisier and can present repeated primary content to assistive technology and search renderers.",
    "Render one semantic primary-content block and use responsive CSS rather than duplicating the same hero content.",
    repeatedPrimaryHeadings.map((page) => page.url),
  ));

  if (!audit.crawl.sitemapUrlsFound) issues.push(confirmedIssue(
    "xml-sitemap-not-confirmed", "XML sitemap not confirmed", "low", "Crawlability",
    "The audit did not discover any page URLs through an XML sitemap.", "Sitemap URL count: 0.",
    "A sitemap helps confirm the intended canonical URL inventory and reveal pages that are not linked prominently.",
    "Publish a valid XML sitemap containing canonical indexable pages and reference it from robots.txt.",
  ));

  const root = normalizedUrl(audit.pages[0]?.url ?? "");
  const internalTargets = new Set(audit.pages.flatMap((page) => page.internalLinks ?? []).map(normalizedUrl));
  const orphaned = successful.filter((page) => normalizedUrl(page.url) !== root && !internalTargets.has(normalizedUrl(page.url)));
  if (orphaned.length) issues.push(confirmedIssue(
    "orphaned-crawled-pages", "Crawled pages lack an internal link path", "high", "Site architecture",
    `${orphaned.length} crawled page${orphaned.length === 1 ? " has" : "s have"} no internal link pointing to it from another crawled page.`,
    orphaned.map((page) => page.url).join("; "),
    "Pages discovered only through a sitemap or other source receive weaker navigational context and may be harder for visitors and crawlers to reach.",
    "Link each important page from relevant navigation or page content using descriptive anchor text.",
    orphaned.map((page) => page.url),
  ));

  const knownPages = new Set(successful.map((page) => normalizedUrl(page.url)));
  const pageByUrl = new Map(successful.map((page) => [normalizedUrl(page.url), page]));
  const depths = new Map<string, number>(root ? [[root, 0]] : []);
  const queue = root ? [root] : [];
  while (queue.length) {
    const source = queue.shift()!;
    const nextDepth = (depths.get(source) ?? 0) + 1;
    for (const target of pageByUrl.get(source)?.internalLinks ?? []) {
      const normalizedTarget = normalizedUrl(target);
      if (!knownPages.has(normalizedTarget) || depths.has(normalizedTarget)) continue;
      depths.set(normalizedTarget, nextDepth);
      queue.push(normalizedTarget);
    }
  }
  const deepPages = successful.filter((page) => (depths.get(normalizedUrl(page.url)) ?? 0) > 3);
  if (deepPages.length) issues.push(confirmedIssue(
    "excessive-click-depth", "Important pages sit too deep in the site", "medium", "Site architecture",
    `${deepPages.length} crawled page${deepPages.length === 1 ? " requires" : "s require"} more than three internal-link steps from the homepage.`,
    deepPages.map((page) => `${page.url}: depth ${depths.get(normalizedUrl(page.url))}`).join("; "),
    "Excessive click depth weakens discovery, internal authority flow, and the visitor’s ability to reach important destinations.",
    "Move important service and conversion pages closer to the homepage through navigation and relevant contextual links.",
    deepPages.map((page) => page.url),
  ));

  const restrictedPlatforms = [...new Set(successful.flatMap((page) => page.platformHints ?? []).filter((hint) => /GoDaddy Websites \+ Marketing/i.test(hint)))];
  if (restrictedPlatforms.length) issues.push(confirmedIssue(
    "restricted-builder-platform", "Builder platform limits technical control", "low", "Platform & server",
    "The site is delivered through a hosted website-builder platform with restricted code and server-level controls.", restrictedPlatforms.join(", "),
    "Restricted routing, markup, caching, script loading, and export controls can make structural and performance improvements harder to implement cleanly.",
    "Evaluate whether the platform can support the required architecture, redirects, markup, and performance work before investing in incremental patches.",
  ));
  return issues;
}

function buildTechnicalDeliveryIssues(result: TechnicalSeoScanResult): TechnicalSeoIssue[] {
  const issues: TechnicalSeoIssue[] = [];
  const rendered = result.profiles.simulatedGooglebotRendered;
  const raw = result.profiles.simulatedGooglebotRaw;
  if (!/^https:/i.test(result.summary.finalUrl)) issues.push(confirmedIssue("https-not-used", "HTTPS not used", "critical", "Server & security", "The final audited URL does not use HTTPS.", result.summary.finalUrl, "An insecure final URL weakens transport security and can prevent the page from being treated as a secure canonical destination.", "Serve every public page over HTTPS and permanently redirect HTTP URLs to their HTTPS equivalents."));
  if (!rendered.viewport) issues.push(confirmedIssue("viewport-missing", "Mobile viewport declaration missing", "medium", "Mobile delivery", "No viewport meta declaration was detected in the rendered page.", "viewport: missing", "Without a correct viewport declaration, mobile rendering and usability can be impaired.", "Add a standard responsive viewport meta tag and verify mobile layouts at common widths."));
  if ((raw.redirects ?? []).length > 1) issues.push(confirmedIssue("redirect-chain", "Redirect chain detected", "medium", "HTTP", `The initial page request passed through ${raw.redirects.length} redirects.`, raw.redirects.map((redirect) => `${redirect.status} ${redirect.from} → ${redirect.to}`).join("; "), "Redirect chains add crawl latency and create unnecessary failure points.", "Update internal and canonical URLs to point directly to the final destination and collapse the chain to one redirect."));
  return issues;
}

export function normalizeTechnicalSeoResult(result: TechnicalSeoScanResult): TechnicalSeoScanResult {
  if (result.version !== 3 || !result.siteAudit) return result;
  const trust = assessTrustConversion(result);
  const derived = [...buildTechnicalArchitectureIssues(result.siteAudit), ...buildTechnicalDeliveryIssues(result), ...(trust?.issues ?? [])];
  const replacesGenericMultipleH1 = derived.some((issue) => issue.id === "duplicate-primary-dom-content");
  const storedIssues = replacesGenericMultipleH1 ? result.issues.filter((issue) => issue.id !== "multiple-h1") : result.issues;
  const existingIds = new Set(storedIssues.map((issue) => issue.id));
  const issues = assignTechnicalSeoIssueGrades([...storedIssues, ...derived.filter((issue) => !existingIds.has(issue.id))]);
  const technical = scoreTechnicalSeoIssues(issues);
  const rationale = `${technical.findingCount} confirmed technical finding${technical.findingCount === 1 ? "" : "s"} scored once with capped deductions across ${result.siteAudit.pages.length} crawled page${result.siteAudit.pages.length === 1 ? "" : "s"}. Performance, business-profile, content, and conversion findings do not affect this grade.`;
  const grades = result.siteAudit.grades.map((item) => item.key === "technical"
    ? { ...item, grade: technical.grade, score: technical.score, rationale }
    : item.key === "trust_conversion" && trust ? { ...item, grade: trust.grade, score: trust.score, rationale: `Trust evidence ${trust.trustPoints}/60 and conversion readiness ${trust.conversionPoints}/40. ${trust.caps.length ? `Grade cap applied because ${trust.caps.join("; ")}.` : "No limiting evidence gate was triggered."}` }
    : item.key === "local_seo" ? { ...item, label: "On-page SEO, content & local targeting" } : item);
  const technicalTheme = {
    title: "The technical foundation needs a clearer, cleaner structure",
    summary: "Crawl access alone is not enough: page architecture, URLs, delivered source structure, machine-readable markup, and platform controls must work together before the site can scale reliably.",
    issueIds: issues.filter((issue) => issue.gradeKey === "technical").map((issue) => issue.id),
  };
  const existingThemes = result.siteAudit.insights?.themes ?? [];
  const trustTheme = {
    title: "Trust evidence and the inquiry journey do not yet resolve customer risk",
    summary: "Authentic identity and operational proof matter, but customers also need visible third-party reassurance, clear policies, consistent claims, and a dependable path from interest to inquiry or booking.",
    issueIds: issues.filter((issue) => issue.gradeKey === "trust_conversion").map((issue) => issue.id),
  };
  let themes = technical.score < 80 && !existingThemes.some((theme) => theme.title === technicalTheme.title) ? [technicalTheme, ...existingThemes].slice(0, 4) : existingThemes;
  if (trust && trust.score < 80 && !themes.some((theme) => theme.title === trustTheme.title)) themes = [trustTheme, ...themes].slice(0, 4);
  const issueCounts = { ...result.summary.issueCounts };
  for (const severity of Object.keys(issueCounts) as Array<keyof typeof issueCounts>) issueCounts[severity] = issues.filter((issue) => issue.severity === severity).length;
  return {
    ...result,
    issues,
    summary: { ...result.summary, issueCounts },
    siteAudit: { ...result.siteAudit, grades, insights: result.siteAudit.insights ? { ...result.siteAudit.insights, themes } : { themes, opportunities: [] } },
  };
}

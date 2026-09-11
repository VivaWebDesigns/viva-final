import { Window } from "happy-dom";
import type { TechnicalSeoAuditContext, TechnicalSeoIssue, TechnicalSeoPageAudit, TechnicalSeoSiteAudit } from "@shared/technicalSeo";
import { scoreSeoContentTargeting } from "@shared/technicalSeoContent";
import { SCAN_LIMITS, SIMULATED_GOOGLEBOT_USER_AGENT } from "./constants";
import { extractSnapshot } from "./extract";
import { safeFetchHtml } from "./http-fetch";
import { runLocalSearchAudit } from "./dataforseo-audit";
import { runPageSpeedAudit } from "./pagespeed";

const SKIP_EXTENSIONS = /\.(?:jpe?g|png|gif|webp|avif|svg|pdf|zip|mp4|mov|mp3|css|js|xml|json|woff2?|ttf)(?:$|\?)/i;
const SOCIAL_HOSTS = /(?:facebook|instagram|linkedin|youtube|tiktok|x|twitter|pinterest)\.com$/i;

function canonicalPageUrl(value: string): string | null {
  try {
    const url = new URL(value); url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|gclid|fbclid)/i.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch { return null; }
}

function text(value: string | null | undefined) { return (value ?? "").replace(/\s+/g, " ").trim(); }
function unique(values: string[]) { return [...new Set(values.filter(Boolean))]; }

function enrichPage(html: string, snapshot: ReturnType<typeof extractSnapshot>): Omit<TechnicalSeoPageAudit, "fetchError"> {
  const window = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  window.document.write(html.slice(0, SCAN_LIMITS.maxDomBytes));
  const document = window.document;
  const images = Array.from(document.querySelectorAll("img"));
  const socialLinks = unique(snapshot.externalLinks.filter((value) => { try { return SOCIAL_HOSTS.test(new URL(value).hostname); } catch { return false; } }));
  const bodyText = text(document.body?.textContent);
  const phones = unique([
    ...Array.from(document.querySelectorAll('a[href^="tel:"]')).map((node) => text(node.getAttribute("href")?.replace(/^tel:/i, ""))),
    ...(bodyText.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g) ?? []),
  ]).slice(0, 12);
  const emails = unique([
    ...Array.from(document.querySelectorAll('a[href^="mailto:"]')).map((node) => text(node.getAttribute("href")?.replace(/^mailto:/i, "").split("?")[0])),
    ...(bodyText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []),
  ]).slice(0, 12);
  const addresses = unique([
    ...Array.from(document.querySelectorAll("address")).map((node) => text(node.textContent)),
    ...(bodyText.match(/\b\d{1,6}\s+[A-Z0-9][A-Z0-9 .'-]{2,60}\s(?:street|st|road|rd|avenue|ave|drive|dr|lane|ln|boulevard|blvd|highway|hwy|court|ct|parkway|pkwy|way)\b[^\n,]{0,40}(?:,\s*[A-Z .'-]+,?\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?)?/gi) ?? []),
  ]).slice(0, 8);
  const analytics: string[] = [];
  const source = html.toLowerCase();
  if (/googletagmanager\.com|gtag\(|google-analytics\.com/.test(source)) analytics.push("Google Analytics / Tag Manager");
  if (/connect\.facebook\.net|fbq\(/.test(source)) analytics.push("Meta Pixel");
  if (/clarity\.ms/.test(source)) analytics.push("Microsoft Clarity");
  const platformHints: string[] = [];
  if (/wp-content|wp-includes|wordpress/i.test(html)) platformHints.push("WordPress");
  if (/cdn\.shopify\.com|shopify-section/i.test(html)) platformHints.push("Shopify");
  if (/static\.wixstatic\.com|wix-code-sdk/i.test(html)) platformHints.push("Wix");
  if (/squarespace\.com|static1\.squarespace/i.test(html)) platformHints.push("Squarespace");
  const ctaPattern = /\b(call|contact|get (?:a )?quote|request|schedule|book|free estimate|start)\b/i;
  const callsToAction = Array.from(document.querySelectorAll("a,button,input[type=submit]")).filter((node) => ctaPattern.test(text(node.textContent || node.getAttribute("value")))).length;
  const result = {
    url: snapshot.finalUrl, statusCode: snapshot.statusCode, responseTimeMs: snapshot.responseTimeMs,
    title: snapshot.title, metaDescription: snapshot.metaDescription, canonical: snapshot.canonical, robots: snapshot.robots,
    h1: snapshot.h1, headings: snapshot.headings, wordCount: snapshot.visibleWordCount,
    internalLinks: snapshot.internalLinks, externalLinks: snapshot.externalLinks,
    schemaTypes: unique(snapshot.structuredData.flatMap((block) => block.types)),
    images: {
      total: images.length,
      missingAlt: images.filter((node) => !node.hasAttribute("alt")).length,
      emptyAlt: images.filter((node) => node.hasAttribute("alt") && !text(node.getAttribute("alt"))).length,
      missingDimensions: images.filter((node) => !(node.hasAttribute("width") && node.hasAttribute("height"))).length,
      lazyLoaded: images.filter((node) => node.getAttribute("loading")?.toLowerCase() === "lazy").length,
      modernFormat: images.filter((node) => /\.(?:webp|avif)(?:$|\?)/i.test(node.getAttribute("src") ?? "")).length,
    },
    contact: { phones, emails, addresses },
    signals: { forms: document.querySelectorAll("form").length, callsToAction, reviewMentions: (bodyText.match(/\breviews?|testimonials?\b/gi) ?? []).length, socialLinks, analytics },
    platformHints,
  };
  window.close();
  return result;
}

async function fetchPage(url: string, signal?: AbortSignal): Promise<TechnicalSeoPageAudit> {
  try {
    const fetched = await safeFetchHtml(url, SIMULATED_GOOGLEBOT_USER_AGENT, { signal });
    const { body, ...evidence } = fetched;
    const snapshot = extractSnapshot({ profile: "simulated_googlebot_raw", ...evidence, html: body, requestProfile: { userAgent: SIMULATED_GOOGLEBOT_USER_AGENT } });
    return { ...enrichPage(body, snapshot), fetchError: null };
  } catch (error) {
    return { url, statusCode: null, responseTimeMs: null, title: null, metaDescription: null, canonical: [], robots: { raw: [], noindex: false, nofollow: false, none: false, noarchive: false, nosnippet: false }, h1: [], headings: [], wordCount: 0, internalLinks: [], externalLinks: [], schemaTypes: [], images: { total: 0, missingAlt: 0, emptyAlt: 0, missingDimensions: 0, lazyLoaded: 0, modernFormat: 0 }, contact: { phones: [], emails: [], addresses: [] }, signals: { forms: 0, callsToAction: 0, reviewMentions: 0, socialLinks: [], analytics: [] }, platformHints: [], fetchError: error instanceof Error ? error.message : "Fetch failed" };
  }
}

function duplicates(pages: TechnicalSeoPageAudit[], field: "title" | "metaDescription") {
  const groups = new Map<string, string[]>();
  for (const page of pages) { const value = page[field]?.trim(); if (value) groups.set(value, [...(groups.get(value) ?? []), page.url]); }
  return [...groups.entries()].filter(([, urls]) => urls.length > 1).map(([value, urls]) => ({ value, urls }));
}

function grade(score: number) { return score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F"; }

export async function buildSiteAudit(args: { rootUrl: string; homepage: TechnicalSeoPageAudit; sitemapUrls: string[]; context: TechnicalSeoAuditContext; issues: TechnicalSeoIssue[]; signal?: AbortSignal }): Promise<TechnicalSeoSiteAudit> {
  const origin = new URL(args.rootUrl).origin;
  const queue = unique([args.rootUrl, ...args.sitemapUrls, ...args.homepage.internalLinks].map((url) => canonicalPageUrl(url) ?? ""))
    .filter((url) => { try { return new URL(url).origin === origin && !SKIP_EXTENSIONS.test(url) && !/\/(?:wp-admin|cart|checkout)(?:\/|$)/i.test(new URL(url).pathname); } catch { return false; } });
  const pages: TechnicalSeoPageAudit[] = [args.homepage];
  const seen = new Set([canonicalPageUrl(args.homepage.url)]);
  for (const url of queue) {
    if (pages.length >= SCAN_LIMITS.maxCrawlPages) break;
    if (seen.has(url)) continue;
    seen.add(url);
    const page = await fetchPage(url, args.signal);
    pages.push(page);
    for (const discovered of page.internalLinks) {
      const normalized = canonicalPageUrl(discovered);
      if (normalized && !seen.has(normalized) && !SKIP_EXTENSIONS.test(normalized) && new URL(normalized).origin === origin) queue.push(normalized);
    }
  }
  const linked = pages.flatMap((page) => page.internalLinks.map((targetUrl) => ({ sourceUrl: page.url, targetUrl: canonicalPageUrl(targetUrl) ?? targetUrl }))).filter((link) => !SKIP_EXTENSIONS.test(link.targetUrl)).slice(0, SCAN_LIMITS.maxBrokenLinkChecks);
  const known = new Map(pages.map((page) => [canonicalPageUrl(page.url), page.statusCode]));
  const brokenInternalLinks: TechnicalSeoSiteAudit["crawl"]["brokenInternalLinks"] = [];
  for (const link of linked) {
    let statusCode = known.get(link.targetUrl);
    if (statusCode === undefined) { const checked = await fetchPage(link.targetUrl, args.signal); statusCode = checked.statusCode; known.set(link.targetUrl, statusCode); }
    if (statusCode === null || statusCode >= 400) brokenInternalLinks.push({ ...link, statusCode });
  }
  const performance = await runPageSpeedAudit(args.rootUrl, args.signal);
  const local = await runLocalSearchAudit(args.rootUrl, args.context, args.signal);
  const duplicateTitles = duplicates(pages, "title");
  const duplicateDescriptions = duplicates(pages, "metaDescription");
  const thinPages = pages.filter((page) => page.statusCode === 200 && page.wordCount < 200).map((page) => page.url);
  const confirmed = args.issues.filter((item) => item.severity !== "informational");
  const technicalScore = Math.max(0, 100 - confirmed.reduce((sum, item) => sum + ({ critical: 30, high: 18, medium: 9, low: 3, informational: 0 }[item.severity]), 0) - brokenInternalLinks.length * 3 - duplicateTitles.length * 5);
  const perfScore = performance.status === "measured" ? performance.mobile?.score ?? null : null;
  const profileStatus = local.profileStatus ?? local.status;
  const gbpScore = profileStatus === "measured" ? Math.max(0, 100 - (!local.profile ? 65 : 0) - (local.profile && !local.profile.phone ? 15 : 0) - (local.profile && !local.profile.address ? 10 : 0) - (local.profile && !local.profile.category ? 10 : 0)) : null;
  const contentTargeting = args.context.city && args.context.trade ? scoreSeoContentTargeting(pages, args.context) : null;
  const localScore = contentTargeting?.score ?? null;
  const trustScore = Math.min(100, (pages.some((p) => p.contact.emails.some((e) => !/@(?:gmail|yahoo|hotmail|outlook)\./i.test(e))) ? 25 : 0) + (pages.some((p) => p.contact.phones.length) ? 20 : 0) + (pages.some((p) => p.signals.forms) ? 15 : 0) + (pages.some((p) => p.signals.callsToAction) ? 15 : 0) + (pages.some((p) => p.signals.reviewMentions) ? 15 : 0) + (pages.some((p) => p.signals.socialLinks.length) ? 10 : 0));
  const grades: TechnicalSeoSiteAudit["grades"] = [
    { key: "technical", label: "Technical SEO & source code", grade: grade(technicalScore), score: technicalScore, rationale: `${confirmed.length} confirmed technical findings across ${pages.length} crawled pages.` },
    { key: "performance", label: "Page speed", grade: perfScore === null ? "Not assessed" : grade(perfScore), score: perfScore, rationale: performance.status === "measured" ? "Based on Google PageSpeed Lighthouse lab data." : performance.reason ?? "PageSpeed was not available." },
    { key: "business_profile", label: "Google Business Profile signals", grade: gbpScore === null ? "Not assessed" : grade(gbpScore), score: gbpScore, rationale: profileStatus === "measured" ? `Based on public profile fields matched by ${local.profileMatchMethod === "google_business_url" ? "the supplied Google Business Profile URL" : local.profileMatchMethod === "search_result_identity" ? "the exact business name and website in Google local results" : "business name and location"}.` : local.profileReason ?? "Business profile data was not available." },
    { key: "local_seo", label: "SEO content & local targeting", grade: localScore === null ? "Not assessed" : contentTargeting!.grade, score: localScore, rationale: contentTargeting?.rationale ?? "Service and location targeting could not be assessed." },
    { key: "trust_conversion", label: "Trust & conversion signals", grade: grade(trustScore), score: trustScore, rationale: "Based on visible contact, professional email, forms, calls to action, reviews, and social links." },
  ];
  const summary: string[] = [];
  if (technicalScore < 70) summary.push(`The site has ${confirmed.length} confirmed technical problems that reduce search engines’ ability to consistently crawl, interpret, or select its pages.`);
  if (perfScore !== null && perfScore < 70) summary.push(`Measured mobile performance is ${perfScore}/100, creating a slower experience and weaker page-experience signals.`);
  if (localScore !== null && localScore < 70) summary.push(`The crawled pages show limited alignment between services, locations, and the searches local customers use.`);
  if (trustScore < 70) summary.push("Important trust or contact signals are absent or inconsistent across the pages reviewed, which weakens credibility and conversion clarity.");
  if (!summary.length) summary.push("No category fell below the audit’s material-risk threshold, although the detailed findings and coverage limits still apply.");
  return {
    context: args.context, pages,
    crawl: { discovered: queue.length, crawled: pages.length, capped: queue.length > pages.length, sitemapUrlsFound: args.sitemapUrls.length, brokenInternalLinks, duplicateTitles, duplicateDescriptions, thinPages },
    performance, local, grades,
    coverage: { assessed: ["Technical HTML and crawlability", `Up to ${SCAN_LIMITS.maxCrawlPages} same-origin pages`, "Homepage rendered output", "On-site SEO content and local targeting", ...(performance.status === "measured" ? ["Google PageSpeed Lighthouse lab data"] : performance.status === "estimated" ? ["Controlled local Chromium performance estimate"] : []), ...(profileStatus === "measured" ? ["Google Business Profile public data via DataForSEO"] : [])], notAssessed: ["Google Search Console account data", "Google Analytics conversion data", "Backlink quality", "Google organic and Maps rankings (covered by the dedicated map-pack scan)", "Review-response behavior without a matched profile", "Reliable AI-authorship detection", ...(performance.status === "estimated" ? ["Google PageSpeed Lighthouse lab data"] : []), ...(profileStatus !== "measured" ? ["Google Business Profile public data"] : [])] },
    plainLanguageSummary: summary,
  };
}

export function pageAuditFromHomepage(html: string, snapshot: ReturnType<typeof extractSnapshot>): TechnicalSeoPageAudit {
  return { ...enrichPage(html, snapshot), fetchError: null };
}

export function buildSiteIssues(audit: TechnicalSeoSiteAudit): TechnicalSeoIssue[] {
  const issues: TechnicalSeoIssue[] = [];
  const add = (id: string, name: string, severity: TechnicalSeoIssue["severity"], category: string, observation: string, evidence: string, interpretation: string, affectedUrls: string[] = []) => issues.push({ id, name, severity, category, observation, evidence, interpretation, recommendedAction: "Internal remediation guidance is intentionally excluded from the client report.", confidence: "confirmed", affectedUrls, rankingImpact: interpretation });
  const missingTitles = audit.pages.filter((p) => p.statusCode === 200 && !p.title);
  const missingDescriptions = audit.pages.filter((p) => p.statusCode === 200 && !p.metaDescription);
  const missingH1 = audit.pages.filter((p) => p.statusCode === 200 && !p.h1.length);
  const noindex = audit.pages.filter((p) => p.robots.noindex);
  const missingAlt = audit.pages.reduce((sum, p) => sum + p.images.missingAlt, 0);
  const schemaTypes = new Set(audit.pages.flatMap((p) => p.schemaTypes).map((value) => value.toLowerCase()));
  const normalizedPhone = (value: string) => value.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  const suppliedPhone = normalizedPhone(audit.context.phone ?? "");
  const observedPhones = new Set(audit.pages.flatMap((p) => p.contact.phones).map(normalizedPhone).filter(Boolean));
  const successfulPages = audit.pages.filter((p) => p.statusCode === 200);
  if (audit.crawl.brokenInternalLinks.length) add("site-broken-links", "Broken internal links", "high", "Internal linking", `${audit.crawl.brokenInternalLinks.length} internal link occurrence(s) lead to an error or could not be fetched.`, audit.crawl.brokenInternalLinks.slice(0, 8).map((x) => `${x.sourceUrl} → ${x.targetUrl} (${x.statusCode ?? "failed"})`).join("; "), "Broken internal links waste crawl paths, interrupt users, and weaken the site’s internal authority flow.", audit.crawl.brokenInternalLinks.map((x) => x.sourceUrl));
  if (noindex.length) add("site-noindex-pages", "Index-blocked pages in the crawl", "critical", "Indexability", `${noindex.length} crawled page(s) contain a noindex directive.`, noindex.map((p) => p.url).join("; "), "Pages carrying noindex are excluded from search results when the directive is processed.", noindex.map((p) => p.url));
  if (missingTitles.length) add("site-missing-titles", "Pages missing title tags", "high", "Metadata", `${missingTitles.length} successful page(s) have no title tag.`, missingTitles.map((p) => p.url).join("; "), "Missing titles remove a primary relevance and search-result labeling signal.", missingTitles.map((p) => p.url));
  if (audit.crawl.duplicateTitles.length) add("site-duplicate-titles", "Duplicate title tags", "high", "Metadata", `${audit.crawl.duplicateTitles.length} title value(s) are reused across multiple pages.`, audit.crawl.duplicateTitles.slice(0, 5).map((g) => `${g.value}: ${g.urls.join(", ")}`).join("; "), "Repeated titles make distinct pages harder to differentiate and target to separate searches.", audit.crawl.duplicateTitles.flatMap((g) => g.urls));
  if (missingDescriptions.length) add("site-missing-descriptions", "Pages missing meta descriptions", "medium", "Metadata", `${missingDescriptions.length} successful page(s) have no meta description.`, missingDescriptions.map((p) => p.url).join("; "), "Search engines must construct snippets without a supplied page summary, reducing control over result messaging.", missingDescriptions.map((p) => p.url));
  if (audit.crawl.duplicateDescriptions.length) add("site-duplicate-descriptions", "Duplicate meta descriptions", "medium", "Metadata", `${audit.crawl.duplicateDescriptions.length} description value(s) are reused.`, audit.crawl.duplicateDescriptions.slice(0, 5).map((g) => `${g.value}: ${g.urls.join(", ")}`).join("; "), "Repeated descriptions do not distinguish page purpose in search results.", audit.crawl.duplicateDescriptions.flatMap((g) => g.urls));
  if (missingH1.length) add("site-missing-h1", "Pages missing a primary heading", "medium", "Content structure", `${missingH1.length} successful page(s) have no H1.`, missingH1.map((p) => p.url).join("; "), "The primary subject is less explicit to search engines and visitors.", missingH1.map((p) => p.url));
  if (audit.crawl.thinPages.length) add("site-thin-pages", "Thin page content", "high", "Content quality", `${audit.crawl.thinPages.length} successful page(s) contain fewer than 200 visible words.`, audit.crawl.thinPages.join("; "), "Very limited page copy provides weak evidence of service relevance, expertise, and local intent.", audit.crawl.thinPages);
  if (missingAlt) add("site-missing-alt", "Images missing alt attributes", "medium", "Images", `${missingAlt} image(s) lack an alt attribute.`, audit.pages.filter((p) => p.images.missingAlt).map((p) => `${p.url}: ${p.images.missingAlt}`).join("; "), "Search engines and assistive technology receive no text alternative for these images.", audit.pages.filter((p) => p.images.missingAlt).map((p) => p.url));
  const headingSkips = successfulPages.filter((p) => p.headings.some((h, index) => index > 0 && h.level > p.headings[index - 1].level + 1));
  if (headingSkips.length) add("heading-hierarchy-skips", "Heading hierarchy skips levels", "medium", "Content structure", `${headingSkips.length} page(s) jump over heading levels.`, headingSkips.map((p) => p.url).join("; "), "Irregular hierarchy makes page sections and their relationships less explicit.", headingSkips.map((p) => p.url));
  if (![...schemaTypes].some((type) => ["localbusiness", "professionalservice", "organization"].includes(type))) add("missing-localbusiness-schema", "Local business schema not detected", "medium", "Structured data", "No LocalBusiness, ProfessionalService, or Organization JSON-LD type was detected across the crawled pages.", `Schema types detected: ${[...schemaTypes].join(", ") || "none"}.`, "Search engines receive less explicit machine-readable information about the business entity.");
  if (audit.context.targetServices.length && !schemaTypes.has("service")) add("missing-service-schema", "Service schema not detected", "low", "Structured data", "No Service JSON-LD type was detected for the supplied target services.", `Target services: ${audit.context.targetServices.join(", ")}.`, "The site does not provide machine-readable service entities for the services under review.");
  if (!schemaTypes.has("review") && !schemaTypes.has("aggregaterating")) add("missing-review-schema", "Review schema not detected", "low", "Structured data", "No Review or AggregateRating JSON-LD type was detected.", "Crawled JSON-LD blocks contained neither type.", "Search engines receive no structured review signal from the pages reviewed.");
  if (suppliedPhone && !observedPhones.has(suppliedPhone)) add("nap-phone-mismatch", "Supplied business phone not found", "high", "NAP consistency", "The business phone supplied for the audit was not detected in visible page text or telephone links.", `Expected: ${audit.context.phone}; observed: ${[...observedPhones].join(", ") || "none"}.`, "A missing or conflicting phone number weakens entity consistency and makes direct contact harder.");
  if (audit.context.address && !successfulPages.some((p) => `${p.contact.addresses.join(" ")} ${p.url} ${p.title}`.toLowerCase().includes(audit.context.city.toLowerCase()))) add("nap-address-not-found", "Business address not confirmed on site", "high", "NAP consistency", "The supplied business location was not confirmed in the crawled address elements or prominent page signals.", `Expected: ${audit.context.address}.`, "Weak address consistency makes it harder to connect the website with the same local business entity represented elsewhere.");
  const serviceTargets = audit.context.targetServices.filter((service) => !successfulPages.some((p) => `${p.url} ${p.title} ${p.h1.join(" ")}`.toLowerCase().includes(service.toLowerCase())));
  if (serviceTargets.length) add("missing-service-targeting", "Target services lack dedicated page targeting", "high", "Local SEO", `${serviceTargets.length} supplied service(s) were not matched in page URLs, titles, or H1 headings.`, serviceTargets.join(", "), "The site has weak page-level relevance for important commercial service searches.");
  const areaTargets = audit.context.serviceAreas.filter((area) => !successfulPages.some((p) => `${p.url} ${p.title} ${p.h1.join(" ")}`.toLowerCase().includes(area.toLowerCase())));
  if (areaTargets.length) add("missing-location-targeting", "Service areas lack dedicated page targeting", "high", "Local SEO", `${areaTargets.length} supplied service area(s) were not matched in page URLs, titles, or H1 headings.`, areaTargets.join(", "), "The site provides limited page-level evidence for relevance in the geographic markets under review.");
  const allEmails = unique(successfulPages.flatMap((p) => p.contact.emails));
  if (!allEmails.length) add("no-visible-email", "No visible email address detected", "medium", "Trust & conversion", "No email address was detected across the crawled pages.", `${successfulPages.length} successful pages checked.`, "Visitors have one fewer verifiable contact path and business identity signal.");
  else if (!allEmails.some((email) => !/@(?:gmail|yahoo|hotmail|outlook|aol)\./i.test(email))) add("free-email-only", "Only free-provider email addresses detected", "medium", "Trust & conversion", "The site exposes only consumer email-provider addresses.", allEmails.join(", "), "A non-domain email weakens the consistency of the business’s professional identity.");
  if (!successfulPages.some((p) => p.signals.socialLinks.length)) add("no-social-links", "Social profiles not linked", "low", "Trust & conversion", "No recognized social profile links were detected across the crawled pages.", `${successfulPages.length} successful pages checked.`, "The website provides no direct connection to external social proof or ongoing business activity.");
  if (!successfulPages.some((p) => p.signals.reviewMentions)) add("no-onsite-reviews", "Reviews or testimonials not detected on site", "medium", "Trust & conversion", "No visible review or testimonial wording was detected across the crawled pages.", `${successfulPages.length} successful pages checked.`, "Visitors are not shown customer proof while evaluating the business.");
  if (!successfulPages.some((p) => p.signals.callsToAction)) add("no-clear-cta", "Clear call to action not detected", "high", "Trust & conversion", "No call, contact, quote, scheduling, booking, or estimate call to action was detected.", `${successfulPages.length} successful pages checked.`, "Visitors are not given an obvious next step to become a lead.");
  if (!successfulPages.some((p) => p.signals.analytics.length)) add("analytics-not-detected", "Analytics tags not detected", "medium", "Measurement", "Google Analytics, Google Tag Manager, Meta Pixel, and Microsoft Clarity signatures were not detected in page source.", `${successfulPages.length} successful pages checked.`, "The site shows no detectable measurement layer for evaluating traffic or conversion behavior.");
  if (audit.performance.status === "measured" && audit.performance.mobile?.score !== null && audit.performance.mobile?.score !== undefined && audit.performance.mobile.score < 50) add("mobile-performance-poor", "Poor measured mobile performance", "high", "Page speed", `The measured mobile lab performance score is ${audit.performance.mobile.score}/100.`, `LCP ${Math.round(audit.performance.mobile.lcpMs ?? 0)} ms; TBT ${Math.round(audit.performance.mobile.tbtMs ?? 0)} ms; CLS ${audit.performance.mobile.cls ?? "unavailable"}. ${audit.performance.reason ?? "Google PageSpeed measurement."}`, "Slow mobile delivery creates a weaker user experience and can undermine search performance in competitive results.");
  if (audit.performance.status === "measured" && audit.performance.mobile?.lcpMs && audit.performance.mobile.lcpMs > 2500) add("mobile-lcp", "Slow mobile Largest Contentful Paint", audit.performance.mobile.lcpMs > 4000 ? "high" : "medium", "Core Web Vitals", `Measured mobile LCP is ${Math.round(audit.performance.mobile.lcpMs)} ms.`, audit.performance.reason ?? "Google PageSpeed lab measurement.", "The main visible content takes longer than the recommended threshold to appear.");
  if ((audit.local.profileStatus ?? audit.local.status) === "measured" && !audit.local.profile) add("gbp-not-matched", "Google Business Profile not matched", "high", "Google Business Profile", "The provider did not return a confident business profile match for the supplied identity.", `${audit.context.businessName}; ${audit.context.city}, ${audit.context.state}; ${audit.context.googleBusinessUrl ?? "no profile URL supplied"}`, "The audit cannot confirm a consistent business entity in the local search data returned for the supplied identity.");
  return issues;
}

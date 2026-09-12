import { Window } from "happy-dom";
import type { TechnicalSeoAuditContext, TechnicalSeoIssue, TechnicalSeoPageAudit, TechnicalSeoSiteAudit } from "@shared/technicalSeo";
import { scoreSeoContentTargeting } from "@shared/technicalSeoContent";
import { assignTechnicalSeoIssueGrades, scoreTechnicalSeoIssues } from "@shared/technicalSeoScoring";
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
  if (/godaddy|secureserver\.net|wsimg\.com/i.test(`${html} ${snapshot.pageEvidence?.generator ?? ""}`)) platformHints.push("GoDaddy Websites + Marketing");
  const ctaPattern = /\b(call|contact|get (?:a )?quote|request|schedule|book|free estimate|start)\b/i;
  const callsToAction = Array.from(document.querySelectorAll("a,button,input[type=submit]")).filter((node) => ctaPattern.test(text(node.textContent || node.getAttribute("value")))).length;
  const result = {
    url: snapshot.finalUrl, statusCode: snapshot.statusCode, responseTimeMs: snapshot.responseTimeMs,
    title: snapshot.title, metaDescription: snapshot.metaDescription, canonical: snapshot.canonical, robots: snapshot.robots,
    h1: snapshot.h1, headings: snapshot.headings, wordCount: snapshot.visibleWordCount,
    internalLinks: snapshot.internalLinks, externalLinks: snapshot.externalLinks,
    schemaTypes: unique(snapshot.structuredData.flatMap((block) => block.types)),
    images: {
      total: snapshot.pageEvidence?.images.total ?? images.length,
      missingAlt: snapshot.pageEvidence?.images.missingAlt ?? images.filter((node) => !node.hasAttribute("alt")).length,
      emptyAlt: snapshot.pageEvidence?.images.emptyAlt ?? images.filter((node) => node.hasAttribute("alt") && !text(node.getAttribute("alt"))).length,
      missingDimensions: images.filter((node) => !(node.hasAttribute("width") && node.hasAttribute("height"))).length,
      lazyLoaded: images.filter((node) => node.getAttribute("loading")?.toLowerCase() === "lazy").length,
      modernFormat: images.filter((node) => /\.(?:webp|avif)(?:$|\?)/i.test(node.getAttribute("src") ?? "")).length,
    },
    contact: { phones, emails, addresses },
    signals: { forms: snapshot.pageEvidence?.forms.length ?? document.querySelectorAll("form").length, callsToAction: snapshot.pageEvidence?.ctas.filter((item) => item.usable).length ?? callsToAction, reviewMentions: (bodyText.match(/\breviews?|testimonials?\b/gi) ?? []).length, socialLinks, analytics },
    evidence: snapshot.pageEvidence,
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

function rootHost(value: string | null | undefined) {
  try { return new URL(value ?? "").hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}

function trustCategoryScore(pages: TechnicalSeoPageAudit[]) {
  const successful = pages.filter((page) => page.statusCode === 200);
  const allEvidence = successful.flatMap((page) => page.evidence ? [page.evidence] : []);
  const ctas = allEvidence.flatMap((evidence) => evidence.ctas);
  const forms = allEvidence.flatMap((evidence) => evidence.forms);
  const signals = allEvidence.map((evidence) => evidence.contentSignals);
  const professionalEmail = successful.some((page) => page.contact.emails.some((email) => !/@(?:gmail|yahoo|hotmail|outlook|aol)\./i.test(email)));
  const contactPaths = Number(successful.some((page) => page.contact.phones.length)) + Number(successful.some((page) => page.contact.emails.length)) + Number(forms.some((form) => form.hasContactField));
  const usablePrimaryCta = ctas.some((cta) => cta.usable && ["phone", "email", "form", "booking"].includes(cta.type));
  const usefulForm = forms.some((form) => form.hasContactField && !!form.submitLabel);
  const score = Math.min(100,
    Math.min(30, contactPaths * 10)
    + (professionalEmail ? 15 : 0)
    + (usablePrimaryCta ? 20 : 0)
    + (usefulForm ? 15 : forms.length ? 6 : 0)
    + (signals.some((signal) => signal.reviews) ? 8 : 0)
    + (signals.some((signal) => signal.credentials || signal.about) ? 7 : 0)
    + (successful.some((page) => page.signals.socialLinks.length) ? 5 : 0),
  );
  return { score, contactPaths, usablePrimaryCta, usefulForm };
}

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
  const crawl: TechnicalSeoSiteAudit["crawl"] = { discovered: queue.length, crawled: pages.length, capped: queue.length > pages.length, sitemapUrlsFound: args.sitemapUrls.length, brokenInternalLinks, duplicateTitles, duplicateDescriptions, thinPages };
  const issueEvidence = { context: args.context, pages, crawl, performance, local };
  const technicalIssues = assignTechnicalSeoIssueGrades([...args.issues, ...buildSiteIssues(issueEvidence)]);
  const technical = scoreTechnicalSeoIssues(technicalIssues);
  const technicalScore = technical.score;
  const perfScore = performance.status === "measured" ? performance.mobile?.score ?? null : null;
  const profileStatus = local.profileStatus ?? local.status;
  const profileWebsiteMatches = !!local.profile?.website && rootHost(local.profile.website) === rootHost(args.rootUrl);
  const gbpScore = profileStatus === "measured" ? Math.max(0, 100
    - (!local.profile ? 100 : 0)
    - (local.profile && !local.profile.phone ? 15 : 0)
    - (local.profile && !local.profile.address ? 15 : 0)
    - (local.profile && !local.profile.category ? 10 : 0)
    - (local.profile && !local.profile.hoursPresent ? 10 : 0)
    - (local.profile && local.profile.claimed === false ? 20 : 0)
    - (local.profile && !profileWebsiteMatches ? 20 : 0)) : null;
  const contentTargeting = args.context.city && args.context.trade ? scoreSeoContentTargeting(pages, args.context) : null;
  const localScore = contentTargeting?.score ?? null;
  const trust = trustCategoryScore(pages);
  const trustScore = trust.score;
  const grades: TechnicalSeoSiteAudit["grades"] = [
    { key: "technical", label: "Technical SEO & source code", grade: technical.grade, score: technicalScore, rationale: `${technical.findingCount} confirmed technical finding${technical.findingCount === 1 ? "" : "s"} scored once with capped deductions across ${pages.length} crawled page${pages.length === 1 ? "" : "s"}. Performance, business-profile, content, and conversion findings do not affect this grade.` },
    { key: "performance", label: "Page speed", grade: perfScore === null ? "Not assessed" : grade(perfScore), score: perfScore, rationale: performance.status === "measured" ? "Based on official Google PageSpeed mobile Lighthouse lab data." : performance.reason ?? "PageSpeed was not available." },
    { key: "business_profile", label: "Google Business Profile consistency", grade: gbpScore === null ? "Not assessed" : grade(gbpScore), score: gbpScore, rationale: profileStatus === "measured" ? `Public profile completeness and website identity were checked after matching by ${local.profileMatchMethod === "google_business_url" ? "the supplied profile URL" : local.profileMatchMethod === "search_result_identity" ? "exact business and website identity" : "business name and location"}. Map rankings are excluded.` : local.profileReason ?? "Business profile data was not available." },
    { key: "local_seo", label: "On-page SEO, content & local targeting", grade: localScore === null ? "Not assessed" : contentTargeting!.grade, score: localScore, rationale: contentTargeting?.rationale ?? "Service and location targeting could not be assessed." },
    { key: "trust_conversion", label: "Trust & conversion", grade: grade(trustScore), score: trustScore, rationale: `Based on ${trust.contactPaths} usable contact path(s), CTA destinations, form usefulness, professional identity, reviews, credentials, and social proof—not element counts alone.` },
  ];
  const summary: string[] = [];
  if (technicalScore < 70) summary.push("Technical obstacles and page-level inconsistencies are making the site harder for search engines to process and distinguish reliably.");
  if (perfScore !== null && perfScore < 70) summary.push(`Measured mobile performance is ${perfScore}/100, creating a slower experience and weaker page-experience signals.`);
  if (gbpScore !== null && gbpScore < 70) summary.push("The public Google Business Profile identity is incomplete or does not fully align with the website, weakening confidence that both represent the same business.");
  if (localScore !== null && localScore < 70) summary.push("The site does not yet give each priority service and market a clear, substantial destination, limiting its ability to compete for high-intent local searches.");
  if (trustScore < 70) summary.push("Visitors are not consistently given a credible reason to choose the business and a dependable next step to call, book, or inquire.");
  if (!summary.length) summary.push("No category fell below the audit’s material-risk threshold, although the detailed findings and coverage limits still apply.");
  return {
    context: args.context, pages,
    crawl,
    performance, local, grades,
    coverage: { assessed: ["Technical HTML and crawlability", `Up to ${SCAN_LIMITS.maxCrawlPages} same-origin pages`, "Homepage rendered output", "On-site SEO content and local targeting", ...(performance.status === "measured" ? ["Google PageSpeed mobile Lighthouse lab data"] : performance.status === "estimated" ? ["Controlled local Chromium performance estimate"] : []), ...(profileStatus === "measured" ? ["Google Business Profile public data via DataForSEO"] : [])], notAssessed: ["Google Search Console account data", "Google Analytics conversion data", "Backlink quality", "Google organic and Maps rankings (covered by the dedicated map-pack scan)", "Google PageSpeed desktop lab data", "Review-response behavior without a matched profile", "Reliable AI-authorship detection", ...(performance.status === "estimated" ? ["Google PageSpeed Lighthouse lab data"] : []), ...(profileStatus !== "measured" ? ["Google Business Profile public data"] : [])] },
    plainLanguageSummary: summary,
    insights: {
      themes: [
        ...(localScore !== null && localScore < 80 ? [{ title: "Search demand is broader than the site architecture", summary: "Priority services and locations need distinct, useful page destinations so search engines and customers can understand exactly what the business offers and where.", issueIds: ["missing-service-targeting", "missing-location-targeting", "site-thin-pages"] }] : []),
        ...(trustScore < 80 ? [{ title: "Interest is not consistently converted into action", summary: "Calls to action, lead forms, proof, and professional identity should work together as one clear path from evaluation to contact.", issueIds: ["no-clear-cta", "no-onsite-reviews", "no-visible-email", "free-email-only"] }] : []),
        ...(technicalScore < 80 || (perfScore !== null && perfScore < 80) ? [{ title: "The website experience is weakening otherwise valuable content", summary: "Technical consistency and mobile speed affect whether service content can be discovered, understood, and used without friction.", issueIds: ["site-broken-links", "site-duplicate-titles", "mobile-performance-poor", "mobile-lcp"] }] : []),
      ].slice(0, 4),
      opportunities: [
        ...(pages.filter((page) => page.statusCode === 200).length < 3 ? [{ title: "Create a clearer core page architecture", rationale: "Separate the homepage, primary services, company proof, and contact journey so each page has one useful purpose instead of forcing one page to do every job.", evidence: `Only ${pages.filter((page) => page.statusCode === 200).length} successful page(s) were available in the crawl.`, priority: "high" as const }] : []),
        ...(contentTargeting && contentTargeting.serviceMatches < contentTargeting.serviceTargetCount ? [{ title: "Build dedicated priority-service pages", rationale: "Give each supplied service its own page with a specific promise, process, proof, FAQs, and direct next step.", evidence: `${contentTargeting.serviceMatches}/${contentTargeting.serviceTargetCount} supplied service targets appear in meaningful page signals.`, priority: "high" as const }] : []),
        ...(contentTargeting && contentTargeting.locationMatches < contentTargeting.locationTargetCount ? [{ title: "Strengthen local relevance where the business truly serves", rationale: "Use the primary city and real service areas naturally within relevant service pages, supporting copy, titles, and headings.", evidence: `${contentTargeting.locationMatches}/${contentTargeting.locationTargetCount} supplied location targets appear in meaningful page signals.`, priority: "high" as const }] : []),
        ...(!trust.usefulForm ? [{ title: "Create a dependable inquiry path", rationale: "Use a clear action with a working destination and a concise form that captures at least one contact method.", evidence: "No form with both a contact field and clear submit action was confirmed.", priority: "high" as const }] : []),
        ...(!pages.some((page) => page.evidence?.contentSignals.faq) ? [{ title: "Add decision-stage questions and answers", rationale: "Answer the questions customers ask before contacting the business, including process, eligibility, timing, and expectations.", evidence: "No clearly labeled FAQ content was detected on the crawled pages.", priority: "medium" as const }] : []),
        ...(!pages.some((page) => page.evidence?.contentSignals.pricing) ? [{ title: "Clarify pricing or the quoting process", rationale: "Set expectations with useful pricing context, starting ranges, package details, or a clear explanation of how estimates are prepared.", evidence: "No pricing, rates, package, or dollar-value signal was detected on the crawled pages.", priority: "medium" as const }] : []),
        ...(!pages.some((page) => page.evidence?.contentSignals.policies) ? [{ title: "Publish important customer policies", rationale: "Explain requirements, scheduling, deposits, cancellations, and other decision-stage conditions relevant to the service.", evidence: "No clearly identifiable policy or requirements content was detected.", priority: "medium" as const }] : []),
        ...(!pages.some((page) => page.evidence?.contentSignals.reviews) ? [{ title: "Place proof beside key decisions", rationale: "Use authentic testimonials, credentials, and concrete business details near service claims and calls to action.", evidence: "On-page review or testimonial language was not detected.", priority: "medium" as const }] : []),
      ].slice(0, 6),
    },
  };
}

export function pageAuditFromHomepage(html: string, snapshot: ReturnType<typeof extractSnapshot>): TechnicalSeoPageAudit {
  return { ...enrichPage(html, snapshot), fetchError: null };
}

export function buildSiteIssues(audit: Pick<TechnicalSeoSiteAudit, "context" | "pages" | "crawl" | "performance" | "local">): TechnicalSeoIssue[] {
  const issues: TechnicalSeoIssue[] = [];
  const add = (id: string, name: string, severity: TechnicalSeoIssue["severity"], category: string, observation: string, evidence: string, interpretation: string, affectedUrls: string[] = []) => issues.push({ id, name, severity, category, observation, evidence, interpretation, recommendedAction: "Address the confirmed condition using the evidence and affected URLs shown in the internal audit.", confidence: "confirmed", evidenceStatus: "confirmed", affectedUrls, rankingImpact: interpretation });
  const missingTitles = audit.pages.filter((p) => p.statusCode === 200 && !p.title);
  const missingDescriptions = audit.pages.filter((p) => p.statusCode === 200 && !p.metaDescription);
  const missingH1 = audit.pages.filter((p) => p.statusCode === 200 && !p.h1.length);
  const noindex = audit.pages.filter((p) => p.robots.noindex);
  const missingAlt = audit.pages.reduce((sum, p) => sum + p.images.missingAlt, 0);
  const genericAlt = audit.pages.reduce((sum, page) => sum + (page.evidence?.images.genericAlt ?? 0), 0);
  const schemaTypes = new Set(audit.pages.flatMap((p) => p.schemaTypes).map((value) => value.toLowerCase()));
  const schemaEntities = audit.pages.flatMap((page) => page.evidence?.schemaEntities ?? []);
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
  if (genericAlt) add("site-generic-alt", "Images use generic alt text", "low", "Images", `${genericAlt} image(s) use labels such as “image,” “photo,” or “logo” without describing meaningful content.`, audit.pages.filter((page) => page.evidence?.images.genericAlt).map((page) => `${page.url}: ${page.evidence?.images.genericAlt}`).join("; "), "Generic labels provide little accessibility or topical context; decorative images should instead use intentionally empty alt text.", audit.pages.filter((page) => page.evidence?.images.genericAlt).map((page) => page.url));
  const headingSkips = successfulPages.filter((p) => p.headings.some((h, index) => index > 0 && h.level > p.headings[index - 1].level + 1));
  if (headingSkips.length) add("heading-hierarchy-skips", "Heading hierarchy skips levels", "medium", "Content structure", `${headingSkips.length} page(s) jump over heading levels.`, headingSkips.map((p) => p.url).join("; "), "Irregular hierarchy makes page sections and their relationships less explicit.", headingSkips.map((p) => p.url));
  if (![...schemaTypes].some((type) => ["localbusiness", "professionalservice", "organization"].includes(type))) add("missing-localbusiness-schema", "Local business schema not detected", "medium", "Structured data", "No LocalBusiness, ProfessionalService, or Organization JSON-LD type was detected across the crawled pages.", `Schema types detected: ${[...schemaTypes].join(", ") || "none"}.`, "Search engines receive less explicit machine-readable information about the business entity.");
  else {
    const businessEntities = schemaEntities.filter((entity) => entity.types.some((type) => /localbusiness|professionalservice|organization/i.test(type)));
    const businessProperties = new Set(businessEntities.flatMap((entity) => entity.properties).map((property) => property.toLowerCase()));
    const missingProperties = ["name", "telephone", "address"].filter((property) => !businessProperties.has(property));
    if (businessEntities.length && missingProperties.length) add("incomplete-business-schema", "Business schema is incomplete", "medium", "Structured data", `Business schema was detected, but ${missingProperties.join(", ")} ${missingProperties.length === 1 ? "is" : "are"} absent from the inspected entity properties.`, `Present properties: ${[...businessProperties].join(", ") || "none"}.`, "Incomplete entity markup leaves search engines with fewer explicit signals tying the website to the real-world business.");
  }
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
  else if (!successfulPages.some((page) => page.evidence?.ctas.some((cta) => cta.usable && ["phone", "email", "form", "booking"].includes(cta.type)))) add("cta-destination-unconfirmed", "Calls to action lack a confirmed lead destination", "high", "Trust & conversion", "CTA wording was detected, but the scan did not confirm a phone, email, booking destination, or connected form.", successfulPages.flatMap((page) => page.evidence?.ctas ?? []).slice(0, 8).map((cta) => `${cta.label} → ${cta.destination ?? "no destination"}`).join("; "), "Prominent buttons can create a dead end if visitors cannot reliably complete the intended action.");
  const observedForms = successfulPages.flatMap((page) => page.evidence?.forms ?? []);
  if (observedForms.length && !observedForms.some((form) => form.hasContactField && form.submitLabel)) add("weak-lead-form", "Lead form usefulness could not be confirmed", "medium", "Trust & conversion", "A form exists, but no form combined a recognizable contact field with a clear submit action.", observedForms.slice(0, 6).map((form) => `${form.method} ${form.action ?? "no action"}; fields: ${form.fields.join(", ") || "none"}; submit: ${form.submitLabel ?? "unlabeled"}`).join("; "), "A form that cannot clearly capture and submit contact information adds friction instead of creating a dependable lead path.");
  if (!successfulPages.some((p) => p.signals.analytics.length)) add("analytics-not-detected", "Analytics tags not detected", "medium", "Measurement", "Google Analytics, Google Tag Manager, Meta Pixel, and Microsoft Clarity signatures were not detected in page source.", `${successfulPages.length} successful pages checked.`, "The site shows no detectable measurement layer for evaluating traffic or conversion behavior.");
  if (audit.performance.status === "measured" && audit.performance.mobile?.score !== null && audit.performance.mobile?.score !== undefined && audit.performance.mobile.score < 50) add("mobile-performance-poor", "Poor measured mobile performance", "high", "Page speed", `The measured mobile lab performance score is ${audit.performance.mobile.score}/100.`, `LCP ${Math.round(audit.performance.mobile.lcpMs ?? 0)} ms; TBT ${Math.round(audit.performance.mobile.tbtMs ?? 0)} ms; CLS ${audit.performance.mobile.cls ?? "unavailable"}. ${audit.performance.reason ?? "Google PageSpeed measurement."}`, "Slow mobile delivery creates a weaker user experience and can undermine search performance in competitive results.");
  if (audit.performance.status === "measured" && audit.performance.mobile?.lcpMs && audit.performance.mobile.lcpMs > 2500) add("mobile-lcp", "Slow mobile Largest Contentful Paint", audit.performance.mobile.lcpMs > 4000 ? "high" : "medium", "Core Web Vitals", `Measured mobile LCP is ${Math.round(audit.performance.mobile.lcpMs)} ms.`, audit.performance.reason ?? "Google PageSpeed lab measurement.", "The main visible content takes longer than the recommended threshold to appear.");
  if ((audit.local.profileStatus ?? audit.local.status) === "measured" && !audit.local.profile) add("gbp-not-matched", "Google Business Profile not matched", "high", "Google Business Profile", "The provider did not return a confident business profile match for the supplied identity.", `${audit.context.businessName}; ${audit.context.city}, ${audit.context.state}; ${audit.context.googleBusinessUrl ?? "no profile URL supplied"}`, "The audit cannot confirm a consistent business entity in the local search data returned for the supplied identity.");
  if ((audit.local.profileStatus ?? audit.local.status) === "measured" && audit.local.profile?.website && rootHost(audit.local.profile.website) !== rootHost(audit.pages[0]?.url)) add("gbp-website-mismatch", "Business Profile website does not match the audited site", "high", "Google Business Profile", "The matched public profile links to a different website host than the site audited.", `Profile: ${audit.local.profile.website}; audited: ${audit.pages[0]?.url}.`, "A conflicting website destination can split business identity signals and send prospective customers to the wrong property.");
  return issues;
}

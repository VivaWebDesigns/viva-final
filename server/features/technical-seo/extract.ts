import { Window } from "happy-dom";
import type { SeoDirectiveSet, TechnicalSeoSnapshot } from "@shared/technicalSeo";
import { SCAN_LIMITS } from "./constants";

export function parseDirectives(...values: Array<string | null | undefined>): SeoDirectiveSet {
  const raw = values.flatMap((value) => (value ?? "").split(",")).map((item) => item.trim().toLowerCase()).filter(Boolean);
  const lookup = (name: string) => raw.find((item) => item === name || item.startsWith(`${name}:`));
  const value = (name: string) => lookup(name)?.split(":").slice(1).join(":").trim();
  return {
    raw,
    noindex: raw.includes("noindex") || raw.includes("none"),
    nofollow: raw.includes("nofollow") || raw.includes("none"),
    none: raw.includes("none"),
    noarchive: raw.includes("noarchive"),
    nosnippet: raw.includes("nosnippet"),
    maxSnippet: value("max-snippet"),
    maxImagePreview: value("max-image-preview"),
    maxVideoPreview: value("max-video-preview"),
    unavailableAfter: value("unavailable_after"),
  };
}

function cleanText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function schemaTypes(value: unknown): string[] {
  if (Array.isArray(value)) return [...new Set(value.flatMap(schemaTypes))];
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const own = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
  const graph = schemaTypes(record["@graph"]);
  return [...new Set([...own.filter((item): item is string => typeof item === "string"), ...graph])];
}

function absoluteUrl(value: string, baseUrl: string): string | null {
  try { return new URL(value, baseUrl).toString(); } catch { return null; }
}

export interface ExtractSnapshotInput {
  profile: TechnicalSeoSnapshot["profile"];
  requestedUrl: string;
  finalUrl: string;
  statusCode: number | null;
  responseTimeMs: number | null;
  redirects: TechnicalSeoSnapshot["redirects"];
  headers: Record<string, string>;
  html: string;
  consoleMessages?: TechnicalSeoSnapshot["consoleMessages"];
  pageErrors?: string[];
  failedRequests?: TechnicalSeoSnapshot["failedRequests"];
  renderError?: string | null;
  visibleTextOverride?: string;
  requestProfile?: TechnicalSeoSnapshot["requestProfile"];
}

export function extractSnapshot(input: ExtractSnapshotInput): TechnicalSeoSnapshot {
  const window = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  const document = window.document;
  document.write(input.html.slice(0, SCAN_LIMITS.maxDomBytes));

  const meta = (selector: string) => cleanText(document.querySelector(selector)?.getAttribute("content")) || null;
  const title = cleanText(document.querySelector("title")?.textContent) || null;
  const metaDescription = meta('meta[name="description" i]');
  const robotsValues = Array.from(document.querySelectorAll('meta[name="robots" i], meta[name="googlebot" i]'))
    .map((element) => element.getAttribute("content"));
  const canonical = Array.from(document.querySelectorAll('link[rel~="canonical" i]'))
    .map((element) => element.getAttribute("href") ?? "")
    .map((href) => absoluteUrl(href, input.finalUrl))
    .filter((url): url is string => !!url);
  const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((element) => ({
    level: Number(element.tagName.slice(1)),
    text: cleanText(element.textContent),
  }));

  const internal = new Set<string>();
  const external = new Set<string>();
  const baseOrigin = (() => { try { return new URL(input.finalUrl).origin; } catch { return ""; } })();
  const links = { total: 0, withoutHref: 0, javascript: 0, fragments: 0, mailto: 0, tel: 0, nofollow: 0 };
  for (const anchor of Array.from(document.querySelectorAll("a"))) {
    links.total += 1;
    const href = anchor.getAttribute("href");
    if (!href) { links.withoutHref += 1; continue; }
    const lower = href.trim().toLowerCase();
    if (lower.startsWith("javascript:")) { links.javascript += 1; continue; }
    if (lower.startsWith("#")) { links.fragments += 1; continue; }
    if (lower.startsWith("mailto:")) { links.mailto += 1; continue; }
    if (lower.startsWith("tel:")) { links.tel += 1; continue; }
    if ((anchor.getAttribute("rel") ?? "").toLowerCase().split(/\s+/).includes("nofollow")) links.nofollow += 1;
    const resolved = absoluteUrl(href, input.finalUrl);
    if (!resolved) continue;
    try {
      if (new URL(resolved).origin === baseOrigin) internal.add(resolved);
      else external.add(resolved);
    } catch { /* ignored */ }
  }

  const structuredData = Array.from(document.querySelectorAll('script[type="application/ld+json" i]'))
    .slice(0, SCAN_LIMITS.maxStructuredDataBlocks)
    .map((element) => {
      try {
        const data = JSON.parse(element.textContent ?? "");
        return { valid: true, types: schemaTypes(data), data };
      } catch (error) {
        return { valid: false, types: [], error: error instanceof Error ? error.message : "Malformed JSON-LD" };
      }
    });
  const collectSocial = (prefix: string) => Object.fromEntries(
    Array.from(document.querySelectorAll(`meta[property^="${prefix}" i], meta[name^="${prefix}" i]`))
      .map((element) => [element.getAttribute("property") ?? element.getAttribute("name") ?? "", element.getAttribute("content") ?? ""])
      .filter(([key]) => !!key),
  );
  const visibleText = cleanText(input.visibleTextOverride ?? document.body?.innerText).slice(0, 20_000);
  const visibleWordCount = visibleText ? visibleText.split(/\s+/).length : 0;
  window.close();

  return {
    profile: input.profile,
    requestProfile: input.requestProfile ?? { userAgent: "not recorded" },
    requestedUrl: input.requestedUrl,
    finalUrl: input.finalUrl,
    statusCode: input.statusCode,
    responseTimeMs: input.responseTimeMs,
    redirects: input.redirects,
    headers: input.headers,
    title,
    metaDescription,
    robots: parseDirectives(...robotsValues),
    xRobotsTag: parseDirectives(input.headers["x-robots-tag"]),
    canonical,
    viewport: meta('meta[name="viewport" i]'),
    charset: document.querySelector("meta[charset]")?.getAttribute("charset") ?? meta('meta[http-equiv="content-type" i]'),
    language: document.documentElement.getAttribute("lang"),
    headings,
    h1: headings.filter((heading) => heading.level === 1).map((heading) => heading.text),
    visibleTextSample: visibleText,
    visibleWordCount,
    meaningfulContent: visibleWordCount >= 50,
    internalLinks: [...internal].slice(0, SCAN_LIMITS.maxLinksPerKind),
    externalLinks: [...external].slice(0, SCAN_LIMITS.maxLinksPerKind),
    links,
    structuredData,
    openGraph: collectSocial("og:"),
    twitter: collectSocial("twitter:"),
    consoleMessages: input.consoleMessages ?? [],
    pageErrors: input.pageErrors ?? [],
    failedRequests: input.failedRequests ?? [],
    renderError: input.renderError ?? null,
    capturedAt: new Date().toISOString(),
  };
}

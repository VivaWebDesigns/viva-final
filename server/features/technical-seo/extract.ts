import { Window } from "happy-dom";
import type { SeoDirectiveSet, TechnicalSeoPageEvidence, TechnicalSeoSnapshot } from "@shared/technicalSeo";
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

function schemaEntities(value: unknown): Array<{ types: string[]; properties: string[] }> {
  if (Array.isArray(value)) return value.flatMap(schemaEntities);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const types = (Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]]).filter((item): item is string => typeof item === "string");
  return [
    ...(types.length ? [{ types, properties: Object.keys(record).filter((key) => !key.startsWith("@")).slice(0, 30) }] : []),
    ...schemaEntities(record["@graph"]),
  ];
}

function absoluteUrl(value: string, baseUrl: string): string | null {
  try { return new URL(value, baseUrl).toString(); } catch { return null; }
}

function extractPageEvidence(document: Document, baseUrl: string, structuredData: TechnicalSeoSnapshot["structuredData"]): TechnicalSeoPageEvidence {
  const clean = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();
  const ctaPattern = /\b(call|contact|get (?:a )?quote|request|schedule|book|reserve|appointment|free estimate|start|email|apply|send|submit)\b/i;
  const ctas = Array.from(document.querySelectorAll("a,button,input[type=submit]")).map((node) => {
    const label = clean(node.textContent || node.getAttribute("value") || node.getAttribute("aria-label"));
    const rawDestination = node.getAttribute("href") || node.getAttribute("formaction") || (node.tagName.toLowerCase() === "button" ? node.closest("form")?.getAttribute("action") : null);
    const destination = rawDestination ? absoluteUrl(rawDestination, baseUrl) ?? rawDestination : null;
    const lower = (rawDestination ?? "").toLowerCase();
    const type = lower.startsWith("tel:") ? "phone" as const : lower.startsWith("mailto:") ? "email" as const : /book|schedul|appoint|reserv/.test(`${label} ${lower}`.toLowerCase()) ? "booking" as const : node.closest("form") ? "form" as const : node.tagName.toLowerCase() === "button" ? "button" as const : "link" as const;
    const usable = type === "phone" || type === "email" || type === "form" || type === "booking" && !!destination || type === "link" && !!destination && !/^#?$|^javascript:/i.test(rawDestination ?? "");
    return { label, destination, type, usable };
  }).filter((item) => item.label && ctaPattern.test(item.label)).slice(0, 30);
  const forms = Array.from(document.querySelectorAll("form")).slice(0, 12).map((form) => {
    const controls = Array.from(form.querySelectorAll("input,select,textarea")).filter((control) => control.getAttribute("type")?.toLowerCase() !== "hidden" && !/display\s*:\s*none/i.test(control.getAttribute("style") ?? "") && !control.getAttribute("name")?.startsWith("_"));
    const describe = (control: Element) => clean([control.getAttribute("name"), control.getAttribute("aria-label"), control.getAttribute("placeholder"), control.getAttribute("data-aid"), control.getAttribute("type")].filter(Boolean).join(" "));
    const fields = controls.map((control) => clean(control.getAttribute("aria-label") || control.getAttribute("placeholder") || control.getAttribute("data-aid")?.replace(/^CONTACT_FORM_/i, "") || control.getAttribute("name") || control.getAttribute("type"))).filter(Boolean);
    const submit = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
    return {
      action: form.getAttribute("action") ? absoluteUrl(form.getAttribute("action")!, baseUrl) ?? form.getAttribute("action") : null,
      method: (form.getAttribute("method") ?? "get").toUpperCase(), fields,
      requiredFields: controls.filter((control) => control.hasAttribute("required")).length,
      hasContactField: controls.some((control) => /email|tel|phone/i.test(describe(control))),
      submitLabel: clean(submit?.textContent || submit?.getAttribute("value")) || null,
    };
  });
  const structuredEntities = structuredData.filter((block) => block.valid).flatMap((block) => schemaEntities(block.data));
  const body = clean(document.body?.textContent).toLowerCase();
  const images = Array.from(document.querySelectorAll("img"));
  return {
    ctas, forms, schemaEntities: structuredEntities,
    contentSignals: {
      pricing: /\b(price|pricing|rates?|packages?)\b|\$\s?\d/.test(body),
      faq: /\bfaq\b|frequently asked questions|common questions/.test(body),
      policies: /\b(policy|policies|vaccin|cancel(?:lation)?|deposit|terms|requirements?)\b/.test(body),
      reviews: /\b(reviews?|testimonials?|what (?:our )?customers say)\b/.test(body),
      credentials: /\b(licensed|insured|certified|accredited|years? (?:of )?experience|award)\b/.test(body),
      about: /\babout us|our story|meet (?:the )?team\b/.test(body),
    },
    images: {
      total: images.length,
      missingAlt: images.filter((image) => !image.hasAttribute("alt")).length,
      emptyAlt: images.filter((image) => image.hasAttribute("alt") && !clean(image.getAttribute("alt"))).length,
      genericAlt: images.filter((image) => /^(image|photo|picture|logo|banner|img|dsc[ _-]?\d+)$/i.test(clean(image.getAttribute("alt")))).length,
    },
    generator: clean(document.querySelector('meta[name="generator" i]')?.getAttribute("content")) || null,
  };
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
  const pageEvidence = extractPageEvidence(document as unknown as Document, input.finalUrl, structuredData);
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
    pageEvidence,
    openGraph: collectSocial("og:"),
    twitter: collectSocial("twitter:"),
    consoleMessages: input.consoleMessages ?? [],
    pageErrors: input.pageErrors ?? [],
    failedRequests: input.failedRequests ?? [],
    renderError: input.renderError ?? null,
    capturedAt: new Date().toISOString(),
  };
}

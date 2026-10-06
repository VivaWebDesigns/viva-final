import { Window } from "happy-dom";
import { safeFetchHtml } from "../technical-seo/http-fetch";
import { normalizePublicUrl } from "../technical-seo/url-safety";
import { VIVA_SCANNER_USER_AGENT } from "../technical-seo/constants";

const MAX_PAGES = 15;
const CONCURRENCY = 4;
const MAX_TEXT_PER_PAGE = 2_500;
const MIN_SITE_TEXT = 300;
const CRAWL_TIMEOUT_MS = 45_000;

// Pages that describe the company or its content rather than what it offers.
const SKIP_PATH = /\/(blog|news|posts?|articles?|tag|tags|category|categories|author|contact|about|about-us|team|careers?|jobs|reviews?|testimonials?|gallery|photos|faq|privacy|privacy-policy|terms|terms-of-service|accessibility|sitemap|login|account|cart|checkout|feed|wp-json|wp-admin)(\/|$)/i;
const FILE_PATH = /\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|xml|css|js)$/i;
const SERVICE_HINT = /servic|repair|install|replac|clean|inspect|maint|emergenc/i;

export interface WebsitePage {
  url: string;
  title: string;
  headings: string[];
  text: string;
}

export class WebsiteReadError extends Error {}

interface ParsedPage extends WebsitePage {
  links: Array<{ url: string; inNav: boolean }>;
}

function parsePage(html: string, pageUrl: string): ParsedPage {
  const origin = new URL(pageUrl).origin;
  const window = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  try {
    const document = window.document;
    document.write(html.slice(0, 2_000_000));
    const links: ParsedPage["links"] = [];
    for (const anchor of document.querySelectorAll("a[href]")) {
      try {
        const url = new URL(anchor.getAttribute("href") ?? "", pageUrl);
        url.hash = "";
        url.search = "";
        if (url.origin !== origin) continue;
        links.push({ url: url.toString(), inNav: !!anchor.closest("nav, header, footer, [role=navigation]") });
      } catch {
        // Ignore malformed links.
      }
    }
    const headings = [...document.querySelectorAll("h1, h2, h3")].map(node => node.textContent.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 40);
    // Menus and footers repeat on every page; the main content says what the page offers.
    for (const node of document.querySelectorAll("script, style, noscript, svg, iframe, nav, header, footer, [role=navigation]")) node.remove();
    const text = ((document.querySelector("main") ?? document.body)?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_PER_PAGE);
    return { url: pageUrl, title: document.title.trim(), headings, text, links };
  } finally {
    window.close();
  }
}

async function fetchPage(url: string, signal: AbortSignal) {
  try {
    const result = await safeFetchHtml(url, VIVA_SCANNER_USER_AGENT, { signal });
    if (result.statusCode >= 400 || !(result.headers["content-type"] ?? "text/html").includes("html")) return null;
    return parsePage(result.body, result.finalUrl);
  } catch {
    return null;
  }
}

async function sitemapUrls(origin: string, signal: AbortSignal) {
  const found: string[] = [];
  const queue = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  const seen = new Set<string>();
  while (queue.length && seen.size < 4) {
    const sitemap = queue.shift()!;
    if (seen.has(sitemap)) continue;
    seen.add(sitemap);
    try {
      const result = await safeFetchHtml(sitemap, VIVA_SCANNER_USER_AGENT, { signal, maxBytes: 1_000_000 });
      if (result.statusCode >= 400) continue;
      for (const match of result.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
        const loc = match[1].replace(/&amp;/g, "&");
        if (!loc.startsWith(origin)) continue;
        if (/\.xml$/i.test(loc)) queue.push(loc);
        else found.push(loc);
      }
    } catch {
      // A missing sitemap is normal.
    }
  }
  return found;
}

function isCandidate(url: string) {
  const path = new URL(url).pathname;
  return path !== "/" && !SKIP_PATH.test(path) && !FILE_PATH.test(path);
}

/** Reads the homepage, then the service-looking pages from the menu and sitemap. */
export async function readWebsite(input: string): Promise<{ url: string; pages: WebsitePage[] }> {
  const signal = AbortSignal.timeout(CRAWL_TIMEOUT_MS);
  const startUrl = normalizePublicUrl(input);
  const home = await fetchPage(startUrl, signal);
  if (!home) throw new WebsiteReadError("The website could not be loaded.");
  const finalOrigin = new URL(home.url).origin;

  // Menu links first, then links that look like services, then the rest of the sitemap.
  const ranked = new Map<string, number>();
  const rank = (url: string, score: number) => {
    if (!url.startsWith(finalOrigin) || !isCandidate(url)) return;
    const withHint = score + (SERVICE_HINT.test(new URL(url).pathname) ? 2 : 0);
    ranked.set(url, Math.max(ranked.get(url) ?? 0, withHint));
  };
  for (const link of home.links) rank(link.url, link.inNav ? 3 : 1);
  for (const url of await sitemapUrls(finalOrigin, signal)) rank(url, 0);
  const queue = [...ranked].sort((a, b) => b[1] - a[1]).map(([url]) => url).filter(url => url !== home.url).slice(0, MAX_PAGES - 1);

  const pages: WebsitePage[] = [home];
  for (let index = 0; index < queue.length; index += CONCURRENCY) {
    if (signal.aborted) break;
    const batch = await Promise.all(queue.slice(index, index + CONCURRENCY).map(url => fetchPage(url, signal)));
    pages.push(...batch.filter((page): page is ParsedPage => page != null));
  }

  const result = pages.map(({ url, title, headings, text }) => ({ url, title, headings, text }));
  if (result.reduce((sum, page) => sum + page.text.length, 0) < MIN_SITE_TEXT) {
    throw new WebsiteReadError("The website returned almost no text. It may be built with JavaScript that this reader cannot run.");
  }
  return { url: home.url, pages: result };
}

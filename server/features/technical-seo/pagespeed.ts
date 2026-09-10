import type { TechnicalSeoPerformanceProfile, TechnicalSeoPerformanceResult } from "@shared/technicalSeo";
import { chromium } from "playwright";
import { SCAN_LIMITS } from "./constants";
import { assertSafePublicUrl } from "./url-safety";

function numberValue(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function profile(data: any): TechnicalSeoPerformanceProfile {
  const audits = data?.lighthouseResult?.audits ?? {};
  const categories = data?.lighthouseResult?.categories ?? {};
  return {
    score: numberValue(categories.performance?.score) === null ? null : Math.round(categories.performance.score * 100),
    accessibilityScore: numberValue(categories.accessibility?.score) === null ? null : Math.round(categories.accessibility.score * 100),
    seoScore: numberValue(categories.seo?.score) === null ? null : Math.round(categories.seo.score * 100),
    lcpMs: numberValue(audits["largest-contentful-paint"]?.numericValue), cls: numberValue(audits["cumulative-layout-shift"]?.numericValue),
    tbtMs: numberValue(audits["total-blocking-time"]?.numericValue), speedIndexMs: numberValue(audits["speed-index"]?.numericValue),
    transferBytes: numberValue(audits["total-byte-weight"]?.numericValue), requestCount: numberValue(audits["network-requests"]?.details?.items?.length),
    renderBlockingResources: numberValue(audits["render-blocking-resources"]?.details?.items?.length),
    oversizedImagesBytes: numberValue(audits["uses-optimized-images"]?.details?.overallSavingsBytes) ?? numberValue(audits["modern-image-formats"]?.details?.overallSavingsBytes),
  };
}

export function isRetryablePageSpeedStatus(status: number) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function fetchPageSpeedProfile(url: string, strategy: string, apiKey: string, signal?: AbortSignal) {
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url); endpoint.searchParams.set("strategy", strategy);
  for (const category of ["performance", "accessibility", "seo"]) endpoint.searchParams.append("category", category);
  endpoint.searchParams.set("key", apiKey);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(endpoint, { signal });
    if (response.ok) return profile(await response.json());
    if (!isRetryablePageSpeedStatus(response.status) || attempt === 2) throw new Error(`PageSpeed returned HTTP ${response.status} after ${attempt + 1} attempt${attempt ? "s" : ""}`);
    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? Math.min(retryAfterSeconds * 1_000, 5_000) : 1_000 * (attempt + 1);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delayMs);
      signal?.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
    });
  }
  throw new Error("PageSpeed request failed");
}

export async function runPageSpeedAudit(url: string, signal?: AbortSignal): Promise<TechnicalSeoPerformanceResult> {
  const apiKey = process.env.PAGESPEED_API_KEY?.trim();
  try {
    if (!apiKey) throw new Error("PAGESPEED_API_KEY is not configured on the scanner worker");
    const results = await Promise.all(["mobile", "desktop"].map((strategy) => fetchPageSpeedProfile(url, strategy, apiKey, signal)));
    return { status: "measured", source: "google_pagespeed", mobile: results[0], desktop: results[1] };
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    try {
      const local = await runLocalPerformance(url, signal);
      return { status: "estimated", source: "local_chromium", reason: `Local Chromium estimate only. Google PageSpeed was unavailable (${error instanceof Error ? error.message : "request failed"}).`, ...local };
    } catch (fallbackError) {
      if (signal?.aborted) throw signal.reason;
      return { status: "provider_error", reason: fallbackError instanceof Error ? fallbackError.message : "Performance measurement failed" };
    }
  }
}

function estimatedScore(lcp: number | null, cls: number | null, tbt: number | null) {
  let score = 100;
  if (lcp !== null) score -= lcp > 4000 ? 35 : lcp > 2500 ? 18 : 0;
  if (cls !== null) score -= cls > .25 ? 25 : cls > .1 ? 12 : 0;
  if (tbt !== null) score -= tbt > 600 ? 30 : tbt > 200 ? 15 : 0;
  return Math.max(0, score);
}

async function runLocalPerformance(url: string, signal?: AbortSignal) {
  await assertSafePublicUrl(url);
  const browser = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
  const abort = () => void browser.close(); signal?.addEventListener("abort", abort, { once: true });
  try {
    const run = async (mobile: boolean): Promise<TechnicalSeoPerformanceProfile> => {
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1365, height: 768 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, serviceWorkers: "block" });
      let requests = 0;
      await context.route("**/*", async (route) => {
        const target = route.request().url(); if (/^(data|blob|about):/i.test(target)) return route.continue();
        requests += 1; if (requests > SCAN_LIMITS.maxBrowserRequests) return route.abort("blockedbyclient");
        try { await assertSafePublicUrl(target); return route.continue(); } catch { return route.abort("blockedbyclient"); }
      });
      const page = await context.newPage();
      await page.addInitScript(() => {
        (window as any).__seoVitals = { lcp: 0, cls: 0, longTasks: [] as number[] };
        try { new PerformanceObserver((list) => { const entries = list.getEntries(); (window as any).__seoVitals.lcp = entries[entries.length - 1]?.startTime ?? 0; }).observe({ type: "largest-contentful-paint", buffered: true } as any); } catch { /* unsupported */ }
        try { new PerformanceObserver((list) => { for (const entry of list.getEntries() as any) if (!entry.hadRecentInput) (window as any).__seoVitals.cls += entry.value; }).observe({ type: "layout-shift", buffered: true } as any); } catch { /* unsupported */ }
        try { new PerformanceObserver((list) => { (window as any).__seoVitals.longTasks.push(...list.getEntries().map((entry) => entry.duration)); }).observe({ type: "longtask", buffered: true } as any); } catch { /* unsupported */ }
      });
      if (mobile) {
        const cdp = await context.newCDPSession(page);
        await cdp.send("Network.enable");
        await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8, connectionType: "cellular4g" });
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      }
      const started = Date.now(); await page.goto(url, { waitUntil: "domcontentloaded", timeout: SCAN_LIMITS.navigationTimeoutMs }); await page.waitForTimeout(3_000);
      const metrics = await page.evaluate(() => {
        const vitals = (window as any).__seoVitals ?? {}; const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        return { lcp: vitals.lcp || null, cls: vitals.cls ?? null, tbt: Array.isArray(vitals.longTasks) ? vitals.longTasks.reduce((sum: number, duration: number) => sum + Math.max(0, duration - 50), 0) : null, transfer: resources.reduce((sum, item) => sum + (item.transferSize || 0), 0), navTransfer: nav?.transferSize ?? 0 };
      });
      const elapsed = Date.now() - started; await context.close();
      return { score: estimatedScore(metrics.lcp, metrics.cls, metrics.tbt), accessibilityScore: null, seoScore: null, lcpMs: metrics.lcp, cls: metrics.cls, tbtMs: metrics.tbt, speedIndexMs: elapsed, transferBytes: metrics.transfer + metrics.navTransfer, requestCount: requests, renderBlockingResources: null, oversizedImagesBytes: null };
    };
    return { mobile: await run(true), desktop: await run(false) };
  } finally { signal?.removeEventListener("abort", abort); await browser.close().catch(() => undefined); }
}

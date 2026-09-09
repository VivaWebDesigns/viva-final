import type { TechnicalSeoPerformanceProfile, TechnicalSeoPerformanceResult } from "@shared/technicalSeo";

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

export async function runPageSpeedAudit(url: string, signal?: AbortSignal): Promise<TechnicalSeoPerformanceResult> {
  try {
    const results = await Promise.all(["mobile", "desktop"].map(async (strategy) => {
      const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
      endpoint.searchParams.set("url", url); endpoint.searchParams.set("strategy", strategy);
      for (const category of ["performance", "accessibility", "seo"]) endpoint.searchParams.append("category", category);
      if (process.env.PAGESPEED_API_KEY) endpoint.searchParams.set("key", process.env.PAGESPEED_API_KEY);
      const response = await fetch(endpoint, { signal });
      if (!response.ok) throw new Error(`PageSpeed returned HTTP ${response.status}`);
      return profile(await response.json());
    }));
    return { status: "measured", mobile: results[0], desktop: results[1] };
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    return { status: "provider_error", reason: error instanceof Error ? error.message : "PageSpeed request failed" };
  }
}

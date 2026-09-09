import type { TechnicalSeoScan } from "@shared/schema";
import { SCAN_LIMITS, SIMULATED_GOOGLEBOT_USER_AGENT, VIVA_SCANNER_USER_AGENT } from "./constants";
import { analyzeScan } from "./analyze";
import { renderSimulatedGooglebot } from "./browser-render";
import { extractSnapshot } from "./extract";
import { safeFetchHtml } from "./http-fetch";
import { inspectRobots, inspectSitemaps } from "./robots";
import { assertSafePublicUrl } from "./url-safety";
import { cancelClaimedScan, completeScan, heartbeatScan, updateScanStage } from "./repository";
import { buildSiteAudit, buildSiteIssues, pageAuditFromHomepage } from "./site-audit";

class ScanCancelledError extends Error {}

async function checkpoint(scanId: string, workerId: string, status: any, stage: string, progress: number) {
  const updated = await updateScanStage(scanId, workerId, status, stage, progress);
  if (!updated) throw new ScanCancelledError("Scan was cancelled.");
}

export async function processTechnicalSeoScan(scan: TechnicalSeoScan, workerId: string) {
  const controller = new AbortController();
  const totalTimer = setTimeout(() => controller.abort(Object.assign(new Error(`Scan exceeded the ${SCAN_LIMITS.totalScanTimeoutMs}-millisecond runtime limit.`), { code: "SCAN_TIMEOUT" })), SCAN_LIMITS.totalScanTimeoutMs);
  const heartbeat = setInterval(() => void heartbeatScan(scan.id, workerId).then((state) => {
    if (state?.cancellationRequested && !controller.signal.aborted) controller.abort(new ScanCancelledError("Scan was cancelled."));
  }).catch((error) => {
    if (!controller.signal.aborted) controller.abort(error);
  }), 15_000);
  try {
    await checkpoint(scan.id, workerId, "validating", "validating_url", 5);
    const normalizedUrl = (await assertSafePublicUrl(scan.normalizedUrl)).toString();

    await checkpoint(scan.id, workerId, "fetching", "fetching_neutral_and_simulated_googlebot", 20);
    const [neutralFetch, googleFetch] = await Promise.all([
      safeFetchHtml(normalizedUrl, VIVA_SCANNER_USER_AGENT, { signal: controller.signal }),
      safeFetchHtml(normalizedUrl, SIMULATED_GOOGLEBOT_USER_AGENT, { signal: controller.signal }),
    ]);
    const { body: neutralHtml, ...neutralEvidence } = neutralFetch;
    const { body: googleHtml, ...googleEvidence } = googleFetch;
    const neutralRaw = extractSnapshot({ profile: "neutral_raw", ...neutralEvidence, html: neutralHtml, requestProfile: { userAgent: VIVA_SCANNER_USER_AGENT } });
    const simulatedGooglebotRaw = extractSnapshot({ profile: "simulated_googlebot_raw", ...googleEvidence, html: googleHtml, requestProfile: { userAgent: SIMULATED_GOOGLEBOT_USER_AGENT } });

    await checkpoint(scan.id, workerId, "fetching", "checking_robots_and_sitemaps", 40);
    const robotsTxt = await inspectRobots(googleFetch.finalUrl, controller.signal);
    const defaultSitemap = new URL("/sitemap.xml", googleFetch.finalUrl).toString();
    const sitemap = await inspectSitemaps(googleFetch.finalUrl, robotsTxt.sitemaps.length ? robotsTxt.sitemaps : [defaultSitemap], controller.signal);

    await checkpoint(scan.id, workerId, "rendering", "rendering_simulated_googlebot", 55);
    const simulatedGooglebotRendered = await renderSimulatedGooglebot(normalizedUrl, controller.signal);

    await checkpoint(scan.id, workerId, "analyzing", "crawling_site_and_checking_local_search", 70);
    const result = analyzeScan(neutralRaw, simulatedGooglebotRaw, simulatedGooglebotRendered, robotsTxt, sitemap);
    const fallbackContext = { businessName: new URL(normalizedUrl).hostname.replace(/^www\./, ""), trade: "local business", city: "", state: "", targetServices: [], serviceAreas: [] };
    const siteAudit = await buildSiteAudit({
      rootUrl: googleFetch.finalUrl,
      homepage: pageAuditFromHomepage(googleHtml, simulatedGooglebotRaw),
      sitemapUrls: sitemap.urls ?? [],
      context: scan.auditContext ?? fallbackContext,
      issues: result.issues,
      signal: controller.signal,
    });
    const siteIssues = buildSiteIssues(siteAudit);
    result.version = 2;
    result.siteAudit = siteAudit;
    const supersededHomepageIssues = new Set(["missing-title", "missing-description", "missing-h1"]);
    result.issues = result.issues.filter((item) => !supersededHomepageIssues.has(item.id));
    result.issues.push(...siteIssues);
    for (const severity of Object.keys(result.summary.issueCounts) as Array<keyof typeof result.summary.issueCounts>) result.summary.issueCounts[severity] = result.issues.filter((item) => item.severity === severity).length;
    const technicalGrade = siteAudit.grades.find((item) => item.key === "technical");
    if (technicalGrade && technicalGrade.score !== null) {
      technicalGrade.score = Math.max(0, technicalGrade.score - siteIssues.reduce((sum, item) => sum + ({ critical: 22, high: 12, medium: 6, low: 2, informational: 0 }[item.severity]), 0));
      technicalGrade.grade = technicalGrade.score >= 90 ? "A" : technicalGrade.score >= 80 ? "B" : technicalGrade.score >= 70 ? "C" : technicalGrade.score >= 60 ? "D" : "F";
      technicalGrade.rationale = `${result.issues.filter((item) => item.severity !== "informational").length} confirmed technical findings across ${siteAudit.pages.length} crawled pages.`;
    }
    await checkpoint(scan.id, workerId, "analyzing", "building_report", 95);
    const completed = await completeScan(scan.id, workerId, result);
    if (!completed) await cancelClaimedScan(scan.id, workerId);
  } catch (error) {
    if (error instanceof ScanCancelledError) {
      await cancelClaimedScan(scan.id, workerId);
      return;
    }
    throw error;
  } finally {
    clearInterval(heartbeat);
    clearTimeout(totalTimer);
  }
}

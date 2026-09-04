import { chromium, type Browser } from "playwright";
import type { TechnicalSeoSnapshot } from "@shared/technicalSeo";
import { SCAN_LIMITS, SIMULATED_GOOGLEBOT_USER_AGENT } from "./constants";
import { assertSafePublicUrl } from "./url-safety";
import { extractSnapshot } from "./extract";

function boundedPush<T>(items: T[], item: T, limit: number) {
  if (items.length < limit) items.push(item);
}

export async function renderSimulatedGooglebot(requestedUrl: string, signal?: AbortSignal): Promise<TechnicalSeoSnapshot> {
  await assertSafePublicUrl(requestedUrl);
  let browser: Browser | null = null;
  const consoleMessages: TechnicalSeoSnapshot["consoleMessages"] = [];
  const pageErrors: string[] = [];
  const failedRequests: TechnicalSeoSnapshot["failedRequests"] = [];
  let requestCount = 0;
  const started = Date.now();
  const abortBrowser = () => void browser?.close();
  signal?.addEventListener("abort", abortBrowser, { once: true });
  try {
    if (signal?.aborted) throw signal.reason;
    browser = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
    const browserVersion = browser.version();
    const context = await browser.newContext({
      userAgent: SIMULATED_GOOGLEBOT_USER_AGENT,
      viewport: { width: 1365, height: 768 },
      locale: "en-US",
      javaScriptEnabled: true,
      ignoreHTTPSErrors: false,
      serviceWorkers: "block",
    });
    await context.route("**/*", async (route) => {
      const requestUrl = route.request().url();
      if (/^(data|blob|about):/i.test(requestUrl)) return route.continue();
      requestCount += 1;
      if (requestCount > SCAN_LIMITS.maxBrowserRequests) return route.abort("blockedbyclient");
      try {
        await assertSafePublicUrl(requestUrl);
        return route.continue();
      } catch {
        boundedPush(failedRequests, { url: requestUrl, error: "Blocked by scanner network safety policy" }, SCAN_LIMITS.maxFailedRequests);
        return route.abort("blockedbyclient");
      }
    });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(SCAN_LIMITS.navigationTimeoutMs);
    page.on("console", (message) => boundedPush(consoleMessages, { type: message.type(), text: message.text().slice(0, 1000) }, SCAN_LIMITS.maxConsoleMessages));
    page.on("pageerror", (error) => boundedPush(pageErrors, error.message.slice(0, 2000), SCAN_LIMITS.maxConsoleMessages));
    page.on("requestfailed", (request) => boundedPush(failedRequests, {
      url: request.url().slice(0, 2000),
      error: request.failure()?.errorText ?? "Request failed",
    }, SCAN_LIMITS.maxFailedRequests));

    const response = await page.goto(requestedUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2_000);
    const finalUrl = page.url();
    await assertSafePublicUrl(finalUrl);
    const html = (await page.content()).slice(0, SCAN_LIMITS.maxDomBytes);
    const visibleText = await page.locator("body").innerText({ timeout: 2_000 }).catch(() => "");
    const headers = response ? Object.fromEntries(
      Object.entries(await response.allHeaders()).filter(([name]) => [
        "content-type", "content-encoding", "cache-control", "etag", "last-modified", "expires", "x-robots-tag", "server", "vary", "content-language",
      ].includes(name.toLowerCase())),
    ) : {};
    const redirects: TechnicalSeoSnapshot["redirects"] = [];
    let request = response?.request() ?? null;
    while (request?.redirectedFrom()) {
      const previous = request.redirectedFrom()!;
      const previousResponse = await previous.response();
      redirects.unshift({ from: previous.url(), to: request.url(), status: previousResponse?.status() ?? 0 });
      request = previous;
    }
    const snapshot = extractSnapshot({
      profile: "simulated_googlebot_rendered",
      requestedUrl,
      finalUrl,
      statusCode: response?.status() ?? null,
      responseTimeMs: Date.now() - started,
      redirects,
      headers,
      html,
      visibleTextOverride: visibleText,
      consoleMessages,
      pageErrors,
      failedRequests,
      requestProfile: { userAgent: SIMULATED_GOOGLEBOT_USER_AGENT, browserEngine: "Chromium", browserVersion, viewport: "1365x768 desktop" },
    });
    await context.close();
    return snapshot;
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    return extractSnapshot({
      profile: "simulated_googlebot_rendered",
      requestedUrl,
      finalUrl: requestedUrl,
      statusCode: null,
      responseTimeMs: Date.now() - started,
      redirects: [],
      headers: {},
      html: "",
      consoleMessages,
      pageErrors,
      failedRequests,
      renderError: error instanceof Error ? error.message : "Browser rendering failed",
      requestProfile: { userAgent: SIMULATED_GOOGLEBOT_USER_AGENT, browserEngine: "Chromium", viewport: "1365x768 desktop" },
    });
  } finally {
    signal?.removeEventListener("abort", abortBrowser);
    await browser?.close().catch(() => undefined);
  }
}

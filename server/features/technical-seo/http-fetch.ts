import { SCAN_LIMITS } from "./constants";
import { assertSafePublicUrl } from "./url-safety";

const SAFE_RESPONSE_HEADERS = [
  "content-type", "content-encoding", "cache-control", "etag", "last-modified", "expires",
  "x-robots-tag", "server", "vary", "content-language",
];

export interface SafeFetchResult {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  responseTimeMs: number;
  redirects: Array<{ from: string; to: string; status: number }>;
  headers: Record<string, string>;
  body: string;
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw Object.assign(new Error(`Response exceeded the ${maxBytes}-byte scan limit.`), { code: "RESPONSE_TOO_LARGE" });
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export async function safeFetchHtml(urlInput: string, userAgent: string, options: { maxBytes?: number; method?: "GET" | "HEAD"; signal?: AbortSignal } = {}): Promise<SafeFetchResult> {
  const requestedUrl = (await assertSafePublicUrl(urlInput)).toString();
  const redirects: SafeFetchResult["redirects"] = [];
  const started = Date.now();
  let current = requestedUrl;
  for (let hop = 0; hop <= SCAN_LIMITS.maxRedirects; hop += 1) {
    await assertSafePublicUrl(current);
    const controller = new AbortController();
    const abortFromParent = () => controller.abort(options.signal?.reason);
    if (options.signal?.aborted) controller.abort(options.signal.reason);
    else options.signal?.addEventListener("abort", abortFromParent, { once: true });
    const timer = setTimeout(() => controller.abort(), SCAN_LIMITS.requestTimeoutMs);
    let response: Response;
    try {
      response = await fetch(current, {
        method: options.method ?? "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": userAgent, accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
      });
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abortFromParent);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw Object.assign(new Error("Redirect response did not include a Location header."), { code: "INVALID_REDIRECT" });
      const next = new URL(location, current).toString();
      await assertSafePublicUrl(next);
      await response.body?.cancel().catch(() => undefined);
      redirects.push({ from: current, to: next, status: response.status });
      current = next;
      continue;
    }
    const headers = Object.fromEntries(SAFE_RESPONSE_HEADERS.flatMap((name) => {
      const value = response.headers.get(name);
      return value ? [[name, value]] : [];
    }));
    const body = options.method === "HEAD" ? "" : await readBoundedBody(response, options.maxBytes ?? SCAN_LIMITS.maxResponseBytes);
    return { requestedUrl, finalUrl: current, statusCode: response.status, responseTimeMs: Date.now() - started, redirects, headers, body };
  }
  throw Object.assign(new Error(`Redirect limit of ${SCAN_LIMITS.maxRedirects} exceeded.`), { code: "TOO_MANY_REDIRECTS" });
}

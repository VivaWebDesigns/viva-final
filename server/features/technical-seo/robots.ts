import { SCAN_LIMITS, SIMULATED_GOOGLEBOT_USER_AGENT } from "./constants";
import { safeFetchHtml } from "./http-fetch";
import { assertSafePublicUrl } from "./url-safety";

interface RobotsGroup { agents: string[]; rules: Array<{ type: "allow" | "disallow"; path: string }> }

export function parseRobots(text: string): { groups: RobotsGroup[]; sitemaps: string[] } {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === "user-agent") {
      if (!current || current.rules.length) { current = { agents: [], rules: [] }; groups.push(current); }
      current.agents.push(value.toLowerCase());
    } else if ((field === "allow" || field === "disallow") && current) {
      current.rules.push({ type: field, path: value });
    } else if (field === "sitemap" && value) sitemaps.push(value);
  }
  return { groups, sitemaps: [...new Set(sitemaps)] };
}

function ruleMatches(rulePath: string, pathname: string): boolean {
  if (!rulePath) return false;
  const anchored = rulePath.endsWith("$");
  const pattern = anchored ? rulePath.slice(0, -1) : rulePath;
  const escaped = pattern.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  try { return new RegExp(`^${escaped}${anchored ? "$" : ""}`).test(pathname); } catch { return pathname.startsWith(pattern); }
}

export function evaluateRobots(text: string, pageUrl: string) {
  const parsed = parseRobots(text);
  const googleGroups = parsed.groups.filter((group) => group.agents.some((agent) => agent === "googlebot" || agent.startsWith("googlebot-")));
  const wildcardGroups = parsed.groups.filter((group) => group.agents.includes("*"));
  const selected = googleGroups.length ? googleGroups : wildcardGroups;
  const page = new URL(pageUrl);
  const pathname = `${page.pathname}${page.search}`;
  const matching = selected.flatMap((group) => group.rules).filter((rule) => ruleMatches(rule.path, pathname));
  matching.sort((a, b) => b.path.length - a.path.length || (a.type === "allow" ? -1 : 1));
  return {
    allowed: matching[0]?.type !== "disallow",
    matchedAgent: googleGroups.length ? "googlebot" : wildcardGroups.length ? "*" : null,
    applicableRules: selected.flatMap((group) => group.rules).map((rule) => `${rule.type}: ${rule.path}`),
    sitemaps: parsed.sitemaps.slice(0, SCAN_LIMITS.maxSitemaps),
  };
}

export async function inspectRobots(pageUrl: string, signal?: AbortSignal) {
  const page = await assertSafePublicUrl(pageUrl);
  const robotsUrl = new URL("/robots.txt", page.origin).toString();
  try {
    const response = await safeFetchHtml(robotsUrl, SIMULATED_GOOGLEBOT_USER_AGENT, { maxBytes: 500_000, signal });
    if (response.statusCode === 404) return { url: robotsUrl, statusCode: 404, allowed: true, matchedAgent: null, applicableRules: [], sitemaps: [], error: null };
    if (response.statusCode < 200 || response.statusCode >= 300) return { url: robotsUrl, statusCode: response.statusCode, allowed: null, matchedAgent: null, applicableRules: [], sitemaps: [], error: `robots.txt returned HTTP ${response.statusCode}` };
    const evaluation = evaluateRobots(response.body, page.toString());
    return {
      url: robotsUrl,
      statusCode: response.statusCode,
      ...evaluation,
      error: null,
    };
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    return { url: robotsUrl, statusCode: null, allowed: null, matchedAgent: null, applicableRules: [], sitemaps: [], error: error instanceof Error ? error.message : "robots.txt fetch failed" };
  }
}

export async function inspectSitemaps(pageUrl: string, sitemapUrls: string[], signal?: AbortSignal) {
  const checked: string[] = [];
  const foundIn: string[] = [];
  const errors: string[] = [];
  const normalizedPage = new URL(pageUrl).toString();
  for (const sitemapUrl of sitemapUrls.slice(0, SCAN_LIMITS.maxSitemaps)) {
    try {
      await assertSafePublicUrl(sitemapUrl);
      const result = await safeFetchHtml(sitemapUrl, SIMULATED_GOOGLEBOT_USER_AGENT, { maxBytes: 1_000_000, signal });
      checked.push(sitemapUrl);
      if (result.statusCode < 200 || result.statusCode >= 300) { errors.push(`${sitemapUrl}: HTTP ${result.statusCode}`); continue; }
      const locations = [...result.body.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => match[1].replace(/&amp;/g, "&").trim());
      if (locations.some((location) => { try { return new URL(location).toString() === normalizedPage; } catch { return false; } })) foundIn.push(sitemapUrl);
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      errors.push(`${sitemapUrl}: ${error instanceof Error ? error.message : "fetch failed"}`);
    }
  }
  return { checked, foundIn, errors };
}

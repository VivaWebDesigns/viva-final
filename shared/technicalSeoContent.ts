import type { TechnicalSeoAuditContext, TechnicalSeoGrade, TechnicalSeoPageAudit } from "./technicalSeo";

export const LOW_ON_PAGE_SUMMARY = "The site does not yet give each priority service and market a clear, substantial destination, limiting its ability to compete for high-intent local searches.";
export const LOW_ON_PAGE_THEME = "Search demand is broader than the site architecture";
export const MISSING_SERVICE_OPPORTUNITY = "Build dedicated priority-service pages";
export const MISSING_LOCATION_OPPORTUNITY = "Strengthen local relevance where the business truly serves";

function normalized(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).map((word) => {
    if (word.length > 4 && /[^s]ies$/.test(word)) return `${word.slice(0, -3)}y`;
    if (word.length > 3 && word.endsWith("s") && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
    return word;
  }).join(" ");
}

function splitTargets(values: string[]) {
  return values.flatMap((value) => value.split(/[,;]+/).map((part) => part.trim()).filter(Boolean));
}

function uniquePhrases(values: string[]) {
  const phrases = new Map<string, string>();
  for (const value of values) {
    const key = normalized(value);
    if (key && !phrases.has(key)) phrases.set(key, value.trim());
  }
  return [...phrases.values()];
}

function includesPhrase(haystack: string, phrase: string) {
  const needle = normalized(phrase);
  return !!needle && ` ${haystack} `.includes(` ${needle} `);
}

function includesService(haystack: string, phrase: string) {
  if (includesPhrase(haystack, phrase)) return true;
  const words = normalized(phrase).split(" ").filter((word) => word && !["and", "or", "the", "for", "in"].includes(word));
  return words.length > 1 && words.every((word) => includesPhrase(haystack, word));
}

function pageSignals(page: TechnicalSeoPageAudit) {
  const prominent = [page.title ?? "", ...(page.h1 ?? []), page.url].map(normalized).filter(Boolean);
  const supporting = [...prominent, page.metaDescription ?? "", ...(page.headings ?? []).map((heading) => heading.text)].map(normalized).filter(Boolean);
  return { prominent, supporting };
}

export function seoContentGrade(score: number): TechnicalSeoGrade["grade"] {
  return score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
}

export function scoreSeoContentTargeting(pages: TechnicalSeoPageAudit[], context: TechnicalSeoAuditContext) {
  const successful = pages.filter((page) => page.statusCode === 200);
  const signals = successful.map((page) => ({ page, ...pageSignals(page) }));
  const serviceTargets = uniquePhrases(splitTargets([context.trade, ...context.targetServices]));
  const locationTargets = uniquePhrases(splitTargets([context.city, ...context.serviceAreas]));
  const appearsService = (phrase: string, field: "prominent" | "supporting" = "supporting") => signals.some((entry) => entry[field].some((text) => includesService(text, phrase)));
  const appearsLocation = (phrase: string, field: "prominent" | "supporting" = "supporting") => signals.some((entry) => entry[field].some((text) => includesPhrase(text, phrase)));
  const serviceMatches = serviceTargets.filter((phrase) => appearsService(phrase)).length;
  const locationMatches = locationTargets.filter((phrase) => appearsLocation(phrase)).length;
  const tradeProminent = serviceTargets.some((phrase) => appearsService(phrase, "prominent"));
  const tradeSupporting = serviceTargets.some((phrase) => appearsService(phrase));
  const cityProminent = appearsLocation(context.city, "prominent");
  const citySupporting = appearsLocation(context.city);
  const combinedPages = signals.filter((entry) => serviceTargets.some((phrase) => entry.supporting.some((text) => includesService(text, phrase))) && entry.supporting.some((text) => includesPhrase(text, context.city))).length;
  const substantivePages = successful.filter((page) => page.wordCount >= 250).length;
  const serviceCoverage = serviceTargets.length ? serviceMatches / serviceTargets.length : 0;
  const locationCoverage = locationTargets.length ? locationMatches / locationTargets.length : 0;
  const depthCoverage = successful.length ? substantivePages / successful.length : 0;
  const score = Math.round(
    (tradeProminent ? 20 : tradeSupporting ? 10 : 0)
    + (cityProminent ? 20 : citySupporting ? 10 : 0)
    + (20 * serviceCoverage)
    + (15 * locationCoverage)
    + (combinedPages ? 15 : tradeSupporting && citySupporting ? 5 : 0)
    + (10 * depthCoverage),
  );
  const rationale = `${serviceMatches}/${serviceTargets.length || 0} service targets and ${locationMatches}/${locationTargets.length || 0} location targets appear in meaningful page signals; ${combinedPages} page${combinedPages === 1 ? "" : "s"} combine the primary service and city, and ${substantivePages}/${successful.length} crawled pages contain at least 250 visible words. Google rankings are not used.`;
  return { score, grade: seoContentGrade(score), rationale, serviceMatches, serviceTargetCount: serviceTargets.length, locationMatches, locationTargetCount: locationTargets.length, combinedPages, substantivePages, successfulPages: successful.length };
}

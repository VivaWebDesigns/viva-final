import type { TechnicalSeoAuditContext, TechnicalSeoGrade, TechnicalSeoPageAudit } from "./technicalSeo";

function normalized(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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

function pageSignals(page: TechnicalSeoPageAudit) {
  const prominent = normalized(`${page.title ?? ""} ${page.h1.join(" ")} ${page.url}`);
  const supporting = normalized(`${prominent} ${page.metaDescription ?? ""} ${page.headings.map((heading) => heading.text).join(" ")}`);
  return { prominent, supporting };
}

export function seoContentGrade(score: number): TechnicalSeoGrade["grade"] {
  return score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
}

export function scoreSeoContentTargeting(pages: TechnicalSeoPageAudit[], context: TechnicalSeoAuditContext) {
  const successful = pages.filter((page) => page.statusCode === 200);
  const signals = successful.map((page) => ({ page, ...pageSignals(page) }));
  const serviceTargets = uniquePhrases([context.trade, ...context.targetServices]);
  const locationTargets = uniquePhrases([context.city, ...context.serviceAreas]);
  const appears = (phrase: string, field: "prominent" | "supporting" = "supporting") => signals.some((entry) => includesPhrase(entry[field], phrase));
  const serviceMatches = serviceTargets.filter((phrase) => appears(phrase)).length;
  const locationMatches = locationTargets.filter((phrase) => appears(phrase)).length;
  const tradeProminent = appears(context.trade, "prominent");
  const tradeSupporting = appears(context.trade);
  const cityProminent = appears(context.city, "prominent");
  const citySupporting = appears(context.city);
  const combinedPages = signals.filter((entry) => includesPhrase(entry.supporting, context.trade) && includesPhrase(entry.supporting, context.city)).length;
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

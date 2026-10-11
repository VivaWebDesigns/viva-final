import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { relevanceBasis, type Exclusion, type RelevanceCheck } from "@shared/keywordResearch";
import type { WebsitePage } from "./readWebsite";

const MODEL = "claude-opus-5-5";

const SERVICE_WORDING = `- Each service is 1 to 5 plain lowercase words: no city names, no "near me", no brand names, no punctuation.
- Keep services that would need their own page separate (repair vs installation when people search them separately); do not list near-duplicates or plurals of the same service.`;

const SUGGEST_INSTRUCTIONS = `You help a web agency plan the service pages for a local service business website.
Given a trade, a US city and the services already known for the business, list other distinct services a typical business in that trade offers that are not already known, phrased the way homeowners and businesses type them into Google (for example "drain cleaning", "water heater repair", "slab leak repair").
Rules:
- Return 10 to 25 services, most commonly searched first.
${SERVICE_WORDING}
- Never repeat a known service or a rewording, plural or near-duplicate of one.`;

const WEBSITE_INSTRUCTIONS = `You help a web agency plan the service pages for a local service business website.
You are given text from pages of the business's current website. List only the services the business says it offers, phrased the way people type them into Google (for example "Hydro-Jet Drain Solutions" becomes "hydro jetting").
Rules:
${SERVICE_WORDING}
- Only include services the website actually states; never add services that are merely typical for the trade.
- Ignore products sold, brands carried, service areas, financing, and company slogans.
- For each service give the URL of the page that best describes it, copied exactly from the page URLs provided.`;

const suggestionSchema = z.object({
  services: z.array(z.string()),
});

const websiteSchema = z.object({
  services: z.array(z.object({ name: z.string(), url: z.string() })),
});

const metroSchema = z.object({
  metro: z.string().nullable(),
});

const METRO_INSTRUCTIONS = `You match a US city to the Google Ads metro area (Nielsen DMA region) it belongs to.
Answer with one name copied exactly from the list provided, or null when you are not sure. A metro area often crosses state lines (Fort Mill, SC is in "Charlotte, NC").`;

const citiesSchema = z.object({
  cities: z.array(z.object({ city: z.string(), state: z.string() })),
});

const CITIES_INSTRUCTIONS = `You help a web agency check Google results for a local service business.
Given the business's city and metro area, name the 2 largest other cities in that metro area that the business would serve.
Use the city's official name and its 2-letter state code. Never repeat the business's own city.`;

const sitesSchema = z.object({
  sites: z.array(z.object({
    domain: z.string(),
    label: z.enum(["contractor", "franchise", "manufacturer", "retailer", "directory", "other"]),
    reason: z.string(),
  })),
});

const SITES_INSTRUCTIONS = `You sort websites found in Google results for a trade into what kind of business each one is.
Labels:
- contractor: an independent local or regional company that does the same kind of work as the client's services, at customers' homes or businesses, even with several locations.
- franchise: a location or the brand site of a national franchise or national service brand (for example Glass Doctor, Mr. Rooter, ARS).
- manufacturer: makes and sells products under its own brand (for example DreamLine, Vigo).
- retailer: sells products to buy and install yourself, online or in stores, including cut-to-size and DIY kit sellers.
- directory: lists or rates many businesses, sells leads, or publishes reviews of companies (Yelp, Angi, HomeAdvisor, BBB).
- other: anything else, such as magazines, how-to publishers, government, forums, and companies whose work is mainly outside the client's services (an auto glass shop when the client does home glass).
Judge from the homepage text when it is given, otherwise from the domain and the result titles. Give a reason of at most 15 words.
Return every domain you are given, spelled exactly as given.`;

const assignSchema = z.object({
  keywords: z.array(z.object({ keyword: z.string(), service: z.string().nullable() })),
});

const ASSIGN_INSTRUCTIONS = `You decide which of a local business's services each Google search belongs to.
For every keyword, give the one service from the list whose page should answer that search, copied exactly, or null when the business does not offer what the searcher wants.
Rules:
- Use null for work outside the listed services, even in the same trade (auto glass or windshields for a home glass company, roofing for a plumber).
- Use null for searches about another company's brand or name, jobs, and product shopping.
- Questions and costs about a listed service belong to that service ("how much is a frameless shower door" → the shower door service).
Return every keyword you are given, spelled exactly as given.`;

const exclusionsSchema = z.object({
  exclusions: z.array(z.object({ work: z.string(), terms: z.array(z.string()), reason: z.string() })),
});

const EXCLUSIONS_INSTRUCTIONS = `You help a web agency keep a local business's SEO research to work the business actually does.
You are given the trade, the services the business confirmed, and text from its website. List kinds of work that searchers often confuse with this trade, or that neighbouring businesses offer, which this website never says it does.
Examples for a glass and door company: auto glass and windshields, garage doors, roofing, window tinting, if the site never mentions them.
Rules:
- Only list work the website does not mention. If the site mentions it anywhere, do not list it.
- Never list anything that overlaps a confirmed service.
- For each, give 3 to 8 lowercase search terms that name it ("auto glass", "windshield", "car window", "safelite") and a reason of at most 15 words that cites what the site lacks.
- Return 3 to 10 items, most likely confusions first.`;

const relevanceSchema = z.object({
  keywords: z.array(z.object({
    keyword: z.string(),
    verdict: z.enum(["yes", "no", "uncertain"]),
    service: z.string().nullable(),
    reason: z.string(),
  })),
});

const RELEVANCE_INSTRUCTIONS = `You check whether Google searches describe work a local business offers. You do not decide what the business offers: the confirmed services and the exclusions are given, and are the only facts.
For each keyword answer:
- yes: the searcher wants work covered by one of the confirmed services. Give that service, copied exactly.
- no: the searcher wants excluded work, a different trade, another company's brand or name, a job, or a product to buy.
- uncertain: it could go either way, or it names work near a confirmed service that is not clearly the same thing (garage doors when the service is door installation, car windows when the service is window repair).
Matching words are not enough: "repair car window" shares words with "window repair" but is auto glass.
Give a reason of at most 12 words. Return every keyword you are given, spelled exactly as given.`;

const reviewSchema = z.object({
  groups: z.array(z.object({
    id: z.string(),
    decision: z.enum(["keep", "merge", "split"]),
    into: z.string().nullable(),
    parts: z.array(z.array(z.string())).nullable(),
    reason: z.string(),
  })),
});

const REVIEW_INSTRUCTIONS = `You review a proposed list of web pages for a local business. Each proposed page has an id, a kind (service, city, cost, blog) and the Google searches grouped under it.
For each page decide:
- keep: the searches belong on one page.
- merge: the searches are the same need as another proposed page; give its id in "into". Only merge pages of the same kind and service.
- split: the searches are different needs that deserve separate pages; give the parts as lists of the searches, copied exactly.
Prefer fewer pages: merge near-duplicates, and split only when one page could not satisfy both searchers.
Give a reason of at most 15 words. Return every id you are given.`;

export class ServiceSuggestionError extends Error {}

async function askClaude<T>(system: string, content: string, schema: z.ZodType<T>, maxTokens: number): Promise<T> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    throw new ServiceSuggestionError("ANTHROPIC_API_KEY is not set on the server. Add it in Railway to get service suggestions.");
  }
  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      system,
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      throw new ServiceSuggestionError("Claude did not return a service list. Try again or type the services in.");
    }
    return response.parsed_output;
  } catch (error) {
    if (error instanceof ServiceSuggestionError) throw error;
    if (error instanceof Anthropic.AuthenticationError) throw new ServiceSuggestionError("The ANTHROPIC_API_KEY on the server was rejected.");
    if (error instanceof Anthropic.RateLimitError) throw new ServiceSuggestionError("Claude is rate limited right now. Try again in a minute.");
    if (error instanceof Anthropic.APIError) throw new ServiceSuggestionError(`Claude API error ${error.status ?? ""}: ${error.message}`.trim());
    throw error;
  }
}

export async function suggestServices(input: { trade: string; city: string; state: string; knownServices: string[] }) {
  const knownList = input.knownServices.length ? input.knownServices.join(", ") : "none yet";
  const result = await askClaude(
    SUGGEST_INSTRUCTIONS,
    `Trade: ${input.trade}\nCity: ${input.city}, ${input.state}\nKnown services: ${knownList}`,
    suggestionSchema,
    4000,
  );
  return result.services;
}

/** The services a business's own website says it offers, with the page each was found on. */
export async function servicesFromWebsite(trade: string, pages: WebsitePage[]) {
  const pageText = pages.map(page => [
    `URL: ${page.url}`,
    `Title: ${page.title}`,
    `Headings: ${page.headings.join(" | ")}`,
    `Text: ${page.text}`,
  ].join("\n")).join("\n\n---\n\n");
  const result = await askClaude(WEBSITE_INSTRUCTIONS, `Trade: ${trade}\n\n${pageText}`, websiteSchema, 6000);
  const pageUrls = new Set(pages.map(page => page.url));
  return result.services.map(service => ({ name: service.name, url: pageUrls.has(service.url) ? service.url : null }));
}

/** The metro area (DMA) a city belongs to, copied from `metros`, or null when Claude is not sure. */
export async function chooseMetro(city: string, state: string, metros: string[]) {
  const result = await askClaude(METRO_INSTRUCTIONS, `City: ${city}, ${state}\n\nMetro areas:\n${metros.join("\n")}`, metroSchema, 300);
  return result.metro;
}

/** The 2 largest other cities in the client's metro area, to search from alongside the client's own city. */
export async function chooseSearchCities(city: string, state: string, metro: string) {
  const result = await askClaude(CITIES_INSTRUCTIONS, `Business city: ${city}, ${state}\nMetro area: ${metro}`, citiesSchema, 300);
  return result.cities;
}

export interface SiteToLabel {
  domain: string;
  /** Titles of the site's pages seen in the results. */
  resultTitles: string[];
  homepage: WebsitePage | null;
}

/** What kind of business each site is, so only contractors are treated as models to copy. */
export async function labelSites(trade: string, services: string[], sites: SiteToLabel[]) {
  const content = sites.map(site => [
    `Domain: ${site.domain}`,
    `Result titles: ${site.resultTitles.slice(0, 3).join(" | ") || "none"}`,
    site.homepage
      ? `Homepage title: ${site.homepage.title}\nHomepage headings: ${site.homepage.headings.join(" | ")}\nHomepage text: ${site.homepage.text}`
      : "Homepage: could not be read",
  ].join("\n")).join("\n\n---\n\n");
  const result = await askClaude(SITES_INSTRUCTIONS, `Trade: ${trade}\nClient's services: ${services.join(", ")}\n\n${content}`, sitesSchema, 6000);
  return new Map(result.sites.map(site => [site.domain.toLowerCase(), { label: site.label, reason: site.reason }]));
}

const ASSIGN_BATCH = 200;

/** The client service each keyword belongs to, or null when the client does not offer it. Answers outside the list become null. */
export async function assignServices(trade: string, services: string[], keywords: string[]) {
  const allowed = new Set(services);
  const assigned = new Map<string, string | null>();
  for (let index = 0; index < keywords.length; index += ASSIGN_BATCH) {
    const batch = keywords.slice(index, index + ASSIGN_BATCH);
    const result = await askClaude(
      ASSIGN_INSTRUCTIONS,
      `Trade: ${trade}\nServices:\n${services.join("\n")}\n\nKeywords:\n${batch.join("\n")}`,
      assignSchema,
      12000,
    );
    for (const row of result.keywords) assigned.set(row.keyword, row.service && allowed.has(row.service) ? row.service : null);
  }
  return assigned;
}

/** Work the website never mentions that searchers confuse with the trade. Applied as exclusions until someone removes them. */
export async function inferExclusions(trade: string, services: string[], pages: WebsitePage[]): Promise<Exclusion[]> {
  const pageText = pages.map(page => `URL: ${page.url}\nTitle: ${page.title}\nHeadings: ${page.headings.join(" | ")}\nText: ${page.text}`).join("\n\n---\n\n");
  const result = await askClaude(EXCLUSIONS_INSTRUCTIONS, `Trade: ${trade}\nConfirmed services: ${services.join(", ")}\n\n${pageText}`, exclusionsSchema, 3000);
  return result.exclusions.map(item => ({
    work: item.work.toLowerCase().trim(),
    terms: [...new Set(item.terms.map(term => term.toLowerCase().trim()).filter(Boolean))],
    reason: item.reason,
    source: "website" as const,
  }));
}

const RELEVANCE_BATCH = 150;

/**
 * Whether each search is work the client offers. Claude judges against the confirmed services and exclusions only;
 * a service it names outside the confirmed list is dropped and the verdict becomes uncertain.
 */
export async function checkRelevance(trade: string, services: string[], exclusions: Exclusion[], keywords: string[]) {
  const allowed = new Set(services);
  const basis = relevanceBasis(services, exclusions);
  const checks = new Map<string, RelevanceCheck>();
  const excluded = exclusions.length ? exclusions.map(item => `${item.work} (${item.terms.join(", ")})`).join("\n") : "none";
  for (let index = 0; index < keywords.length; index += RELEVANCE_BATCH) {
    const batch = keywords.slice(index, index + RELEVANCE_BATCH);
    const result = await askClaude(
      RELEVANCE_INSTRUCTIONS,
      `Trade: ${trade}\nConfirmed services:\n${services.join("\n")}\n\nExcluded work:\n${excluded}\n\nKeywords:\n${batch.join("\n")}`,
      relevanceSchema,
      16000,
    );
    for (const row of result.keywords) {
      const service = row.service && allowed.has(row.service) ? row.service : null;
      const verdict = row.verdict === "yes" && !service ? "uncertain" : row.verdict;
      checks.set(row.keyword.toLowerCase(), { verdict, service: verdict === "yes" ? service : null, reason: row.reason, basis });
    }
  }
  return checks;
}

export interface GroupToReview {
  id: string;
  kind: string;
  service: string;
  keywords: string[];
}

/** Claude's split/merge pass over proposed pages. Its groups are proposals until the user accepts them. */
export async function reviewGroups(trade: string, groups: GroupToReview[]) {
  if (!groups.length) return [];
  const content = groups.map(group => `id: ${group.id}\nkind: ${group.kind}\nservice: ${group.service}\nsearches: ${group.keywords.slice(0, 15).join(" | ")}`).join("\n\n");
  const result = await askClaude(REVIEW_INSTRUCTIONS, `Trade: ${trade}\n\n${content}`, reviewSchema, 8000);
  return result.groups;
}

const phrasesSchema = z.object({
  services: z.array(z.object({ service: z.string(), phrases: z.array(z.string()) })),
});

const PHRASES_INSTRUCTIONS = `You help a web agency target "service + city" searches for a local service business.
For each service, give the 1 or 2 phrases a customer types into Google together with a city name, written without the city.
Rules:
- Use the wording people actually search for that service. Add a word such as "installer", "installation", "company" or "contractor" only where people search the service that way: "glass shower door installer" is natural, "window repair installer" is not ("window repair").
- Plain lowercase words, no city, no state, no "near me", no brand names.
- The first phrase is the one most customers type. Return every service exactly as given.`;

/** How customers search each service with a city ("glass shower door installer", "window repair"). Suggestions; the user can edit them. */
export async function suggestCityPhrases(trade: string, services: string[]) {
  if (!services.length) return new Map<string, string[]>();
  const result = await askClaude(PHRASES_INSTRUCTIONS, `Trade: ${trade}\nServices:\n${services.join("\n")}`, phrasesSchema, 4000);
  const allowed = new Set(services);
  return new Map(result.services.filter(row => allowed.has(row.service)).map(row => [
    row.service,
    [...new Set(row.phrases.map(phrase => phrase.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean))].slice(0, 2),
  ] as const));
}

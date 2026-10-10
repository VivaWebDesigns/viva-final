import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
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

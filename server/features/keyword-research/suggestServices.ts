import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";

const MODEL = "claude-opus-5-5";

const suggestionSchema = z.object({
  services: z.array(z.string()),
});

const INSTRUCTIONS = `You help a web agency plan the service pages for a local service business website.
Given a trade and a US city, list the distinct services a typical business in that trade offers, phrased the way homeowners and businesses type them into Google (for example "drain cleaning", "water heater repair", "slab leak repair").
Rules:
- Return 15 to 30 services, most commonly searched first.
- Each service is 1 to 5 plain lowercase words: no city names, no "near me", no brand names, no punctuation.
- Keep services that would need their own page separate (repair vs installation when people search them separately); do not list near-duplicates or plurals of the same service.
- Include every service the client already listed, rewritten into searcher wording if needed.`;

export class ServiceSuggestionError extends Error {}

export async function suggestServices(input: { trade: string; city: string; state: string; clientServices: string[] }) {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    throw new ServiceSuggestionError("ANTHROPIC_API_KEY is not set on the server. Add it in Railway to get service suggestions.");
  }
  const client = new Anthropic();
  const clientList = input.clientServices.length ? input.clientServices.join(", ") : "none given";
  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(suggestionSchema) },
      system: INSTRUCTIONS,
      messages: [{
        role: "user",
        content: `Trade: ${input.trade}\nCity: ${input.city}, ${input.state}\nServices the client listed: ${clientList}`,
      }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      throw new ServiceSuggestionError("Claude did not return a service list. Try again or type the services in.");
    }
    return response.parsed_output.services;
  } catch (error) {
    if (error instanceof ServiceSuggestionError) throw error;
    if (error instanceof Anthropic.AuthenticationError) throw new ServiceSuggestionError("The ANTHROPIC_API_KEY on the server was rejected.");
    if (error instanceof Anthropic.RateLimitError) throw new ServiceSuggestionError("Claude is rate limited right now. Try again in a minute.");
    if (error instanceof Anthropic.APIError) throw new ServiceSuggestionError(`Claude API error ${error.status ?? ""}: ${error.message}`.trim());
    throw error;
  }
}

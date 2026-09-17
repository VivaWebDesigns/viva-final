import { isIP } from "node:net";
import { z } from "zod";

export function normalizeBacklinkDomain(value: string): string {
  const url = new URL(value.includes("://") ? value : `https://${value}`);
  const host = url.hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port ||
      isIP(host) || !host.includes(".") || host.length > 253 ||
      !host.split(".").every(part => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part)) ||
      /\.(localhost|local|internal|test|invalid)$/.test(host)) {
    throw new Error("Enter a public website domain or HTTP(S) URL without credentials or a port.");
  }
  return host;
}

export const backlinkDomain = z.string().trim().min(1).max(2048).transform((value, ctx) => {
  try { return normalizeBacklinkDomain(value); }
  catch { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A public website domain or HTTP(S) URL is required." }); return z.NEVER; }
});
const common = {
  domain: backlinkDomain,
  limit: z.number().int().min(1).max(100).default(20).describe("Maximum rows per detail section; counts are provider totals, not sample sizes."),
  max_cost_usd: z.number().min(0).max(1).default(0.5).describe("Preflight estimate ceiling. Provider actual charges are reported separately; this is not a provider-enforced billing cap."),
  refresh_id: z.string().uuid().optional().describe("Omit to reuse today's UTC snapshot. For an explicitly requested fresh scan use a UUID, reusing the same UUID for retries. Never automatically retry ambiguous paid requests."),
};
export const backlinkReportInput = z.object(common).strict();
export const backlinkComparisonInput = z.object({
  ...common,
  competitors: z.array(backlinkDomain).min(1).max(3).describe("One to three explicitly chosen competitors in the same service/market. Domains are deduplicated."),
}).strict().superRefine((value, ctx) => {
  if (value.competitors.includes(value.domain)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["competitors"], message: "The client domain cannot also be a competitor." });
});
export const backlinkHistoryInput = z.object({
  domain: backlinkDomain,
  snapshot_id: z.string().uuid().optional().describe("Retrieve one full saved report. Must belong to the requested domain."),
  kind: z.enum(["report", "comparison"]).optional(),
  limit: z.number().int().min(1).max(50).default(10),
  offset: z.number().int().min(0).max(10000).default(0),
}).strict();
export type BacklinkInput = z.infer<typeof backlinkReportInput> & { competitors?: string[] };

import { z } from "zod";

export const SCALE_FIRST_WORKFLOW = "scale_first_v2" as const;
export const SCALE_FIRST_CONTACT_TAGS = ["Email Ready", "Needs Email"] as const;
export const SAB_ADDRESS_LABEL = "Service Area Business" as const;

export type ScaleFirstContactTag = typeof SCALE_FIRST_CONTACT_TAGS[number];

export const NO_VISIBILITY_OUTCOME = "no_visibility_core_found" as const;
export const CRM_ONLY_LOCAL_FALCON_SOURCE = "local_falcon_crm_only" as const;

/** Compact returned enrichment, never a validated scan center or qualification decision. */
export const sabBusinessProfileSchema = z.object({
  source: z.literal("dataforseo_my_business_info_live"),
  place_id: z.string().trim().min(1),
  name: z.string().trim().min(1).nullable().optional(),
  cid: z.string().trim().min(1).nullable().optional(),
  phone: z.string().trim().min(1).nullable().optional(),
  website: z.string().trim().url().nullable().optional(),
  rating: z.number().finite().min(0).max(5).nullable().optional(),
  review_count: z.number().int().min(0).nullable().optional(),
  primary_category: z.string().trim().min(1).nullable().optional(),
  categories: z.array(z.object({ name: z.string().trim().min(1), id: z.string().trim().min(1).nullable() }).strict()).optional(),
  service_count: z.number().int().min(0).optional(),
  service_names: z.array(z.string().trim().min(1)).max(20).optional(),
  omitted_service_count: z.number().int().min(0).optional(),
  description: z.string().trim().min(1).nullable().optional(),
  is_claimed: z.boolean().nullable().optional(),
  latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.number().finite().min(-180).max(180).nullable().optional(),
  place_topics: z.array(z.string().trim().min(1)).max(20).optional(),
  phone_resolution: z.object({
    selected_phone: z.string().trim().min(1),
    evidence_references: z.array(z.string().trim().min(1).max(2000)).min(1).max(20),
  }).strict().optional(),
}).strict().refine(profile => JSON.stringify(profile).length <= 40000, "Compact business_profile must fit one workflow cell (40,000 characters)");

export type SabBusinessProfile = z.infer<typeof sabBusinessProfileSchema>;

/** Return unresolved identity/contact evidence without guessing or replacing a verified contact. */
export function sabBusinessProfileIssues(profile: SabBusinessProfile, placeId: string, verifiedPhone: string | null | undefined): string[] {
  const issues: string[] = [];
  if (profile.place_id !== placeId) issues.push("business_profile Place ID must exactly match the prospect");
  const digits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");
  const sourcePhone = digits(profile.phone);
  const selectedPhone = digits(verifiedPhone);
  if (sourcePhone && !selectedPhone) issues.push("A returned provider phone must be preserved as a verified contact or its conflict resolved before export");
  if (sourcePhone && selectedPhone && sourcePhone !== selectedPhone &&
      (!profile.phone_resolution || digits(profile.phone_resolution.selected_phone) !== selectedPhone)) {
    issues.push("Provider phone conflicts with the selected verified phone; record phone_resolution and supporting evidence before export");
  }
  if (profile.phone_resolution && digits(profile.phone_resolution.selected_phone) !== selectedPhone) {
    issues.push("phone_resolution must identify the current selected verified phone");
  }
  return issues;
}
export interface SabMarketReference {
  kind: "market_reference_only";
  source: "auxiliary_scan_reverse_geocode";
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  zip: string;
  auxiliary_report_key: string;
  auxiliary_report_url: string;
}

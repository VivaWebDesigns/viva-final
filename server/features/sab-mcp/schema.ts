import { z } from "zod";

export const SAB_STATUSES = [
  "assigned",
  "in_progress",
  "complete",
  "blocked",
  "qa_ready",
  "imported",
] as const;
export const SAB_QUALIFICATION_STATUSES = [
  "qualified",
  "disqualified",
  "deferred",
] as const;

export const SAB_HEADERS = [
  "batch_id",
  "batch_position",
  "status",
  "company",
  "place_id",
  "arp",
  "solv",
  "found_in",
  "center_type",
  "scan_center",
  "report_key",
  "report_url",
  "scan_date",
  "scan_keyword",
  "competitors",
  "address",
  "city",
  "state",
  "zip",
  "phone",
  "owner_name",
  "email",
  "website",
  "google_maps_url",
  "has_website",
  "website_platform",
  "service_page_count",
  "website_analysis",
  "reviews_analysis",
  "rating",
  "review_count",
  "qualification_status",
  "blocker",
  "research_notes",
  "updated_at",
  "updated_by",
  "sales_priority",
  "sales_priority_reason",
] as const;

export type SabHeader = typeof SAB_HEADERS[number];
export type SabRow = Record<SabHeader, string>;

const nullableString = z.string().trim().max(20_000).nullable();
const auditFindings = z.array(z.string().trim().min(1).max(1_000)).min(3).max(6);
const workflowSheet = z.string().trim().min(1).max(2_000).describe(
  "Exact Google Sheets URL or spreadsheet ID for this city run's SAB Workflow Sheet.",
);
const workflowSheetTab = z.string().trim().min(1).max(200).default("SAB Workflow").describe(
  "Worksheet tab containing the SAB workflow table.",
);
const batchId = z.string().trim().min(1).max(100).describe(
  "Batch ID assigned in this city run's Workflow Sheet, such as B01.",
);
const workflowSheetInputSchema = {
  workflow_sheet: workflowSheet,
  sheet_name: workflowSheetTab,
};

export const sabCompanyUpdatesSchema = z.object({
  status: z.enum(SAB_STATUSES).optional(),
  address: nullableString.optional(),
  city: nullableString.optional(),
  state: nullableString.optional(),
  zip: nullableString.optional(),
  phone: nullableString.optional(),
  owner_name: nullableString.optional(),
  email: nullableString.optional(),
  website: nullableString.optional(),
  google_maps_url: nullableString.optional(),
  has_website: z.boolean().nullable().optional(),
  website_platform: nullableString.optional(),
  service_page_count: z.number().int().min(0).nullable().optional(),
  website_analysis: auditFindings.nullable().optional(),
  reviews_analysis: auditFindings.optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  review_count: z.number().int().min(0).nullable().optional(),
  qualification_status: z.enum(SAB_QUALIFICATION_STATUSES).optional().describe(
    "Final audit disposition. Use qualified, disqualified, or deferred before marking a company complete.",
  ),
  sales_priority: z.number().int().min(1).max(3).optional().describe(
    "Website-sales priority: 3 is strongest, 2 is viable, and 1 is low priority.",
  ),
  sales_priority_reason: nullableString.optional(),
  blocker: nullableString.optional(),
  research_notes: nullableString.optional(),
}).strict();

export const getSabBatchInputSchema = {
  ...workflowSheetInputSchema,
  batch_id: batchId,
  include_completed: z.boolean().default(false).describe("Include rows already marked complete, qa_ready, or imported"),
};

export const getSabCompanyInputSchema = {
  ...workflowSheetInputSchema,
  place_id: z.string().trim().min(1).describe("Google Place ID from the SAB source sheet"),
};

export const saveSabCompanyInputSchema = {
  ...workflowSheetInputSchema,
  place_id: z.string().trim().min(1).describe("Google Place ID from the SAB source sheet"),
  updates: sabCompanyUpdatesSchema.describe(
    "Only the company fields that should change. Audit arrays must contain 3–6 concise, relevant findings.",
  ),
};

export const markSabBlockedInputSchema = {
  ...workflowSheetInputSchema,
  place_id: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(2_000),
};

export const getSabProgressInputSchema = {
  ...workflowSheetInputSchema,
  batch_id: batchId.optional().describe("Omit to return progress for every batch in the selected Workflow Sheet"),
};

export const checkCrmPlaceIdsInputSchema = {
  place_ids: z.array(
    z.string().trim().min(1).max(500),
  ).min(1).max(2_000).describe(
    "Google Place IDs discovered in the completed master scan. Matching is exact Place-ID equality only.",
  ),
};

export type SabCompanyUpdates = z.infer<typeof sabCompanyUpdatesSchema>;

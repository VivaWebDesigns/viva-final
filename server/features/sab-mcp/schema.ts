import { z } from "zod";
import { sabAddressCorroborationSchema } from "./addressCorroboration";
import { SCALE_FIRST_CONTACT_TAGS, SCALE_FIRST_WORKFLOW, sabBusinessProfileSchema } from "@shared/sabCrm";

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
export const SAB_SCAN_ROLES = ["deliverable", "auxiliary"] as const;
export const SAB_SCAN_TYPES = [
  "standard",
  "scout",
  "fine",
  "recenter",
] as const;
export const SAB_CENTER_TYPES = [
  "weighted_cell_centroid",
  "corroborated_address",
  "scout_recentered",
  "fine_scan_recentered",
  "ranked_peak_recentered",
  "master_edge_offset",
] as const;

export const SAB_RANKED_PEAK_CENTER_DESCRIPTION =
  "ranked_peak_recentered: an evidenced best-pin or compact peak-cluster center from a completed scan. Persist the source report, rule and selected coordinates in decision_state; notes are history only. master_edge_offset is an auxiliary launch point, never a validated deliverable center. Neither label authorizes spending.";

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
  "scan_history",
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
  "workflow",
  "contact_tag",
  "outcome",
  "market_reference",
  "decision_state",
  "qualification_reason",
  "eligibility_state",
  "scan_spec",
  "business_profile",
] as const;

export type SabHeader = (typeof SAB_HEADERS)[number];
export type SabRow = Record<SabHeader, string>;
export const SAB_LEGACY_REQUIRED_HEADERS = SAB_HEADERS.filter(
  (header) => !["scan_history", "workflow", "contact_tag", "outcome", "market_reference", "decision_state", "qualification_reason", "eligibility_state", "scan_spec", "business_profile"].includes(header),
);
// Backward-compatible alias for existing connector consumers.
export const SAB_REQUIRED_HEADERS = SAB_LEGACY_REQUIRED_HEADERS;
export const SAB_SCALE_FIRST_UPGRADEABLE_HEADERS = [
  "workflow",
  "contact_tag",
  "outcome",
  "market_reference",
  "decision_state",
  "qualification_reason",
  "eligibility_state",
  "scan_spec",
  "business_profile",
] as const satisfies readonly SabHeader[];

const nullableString = z.string().trim().max(20_000).nullable();
const sabScanCenterString = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .superRefine((value, ctx) => {
    const match = value.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (!match) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expected scan center in exact 'latitude,longitude' format",
      });
      return;
    }
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Scan center latitude must be between -90 and 90",
      });
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Scan center longitude must be between -180 and 180",
      });
    }
  });

const sabReportKey = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{12,64}$/i);
const auditFindings = z
  .array(z.string().trim().min(1).max(1_000))
  .min(3)
  .max(6);
const workflowSheet = z
  .string()
  .trim()
  .min(1)
  .max(2_000)
  .describe(
    "Exact Google Sheets URL or spreadsheet ID for this city run's SAB Workflow Sheet.",
  );
const workflowSheetTab = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .default("SAB Workflow")
  .describe("Worksheet tab containing the SAB workflow table.");
const batchId = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .describe(
    "Batch ID assigned in this city run's Workflow Sheet, such as B01.",
  );
const workflowSheetInputSchema = {
  workflow_sheet: workflowSheet,
  sheet_name: workflowSheetTab,
};

export const sabExclusionReviewSchema = z.object({
  status: z.enum(["pending", "approved", "declined"]),
  report_key: sabReportKey,
  evidence_hash: z.string().regex(/^[a-f0-9]{64}$/i),
  approval_reference: z.string().trim().min(1).max(2000).optional(),
  approved_by: z.literal("Matt").optional(),
  decline_reference: z.string().trim().min(1).max(2000).optional(),
  declined_by: z.literal("Matt").optional(),
}).strict().superRefine((review, context) => {
  if (review.status === "approved" && (!review.approval_reference || review.approved_by !== "Matt")) {
    context.addIssue({code:z.ZodIssueCode.custom,path:["approval_reference"],message:"An exclusion requires Matt's explicit approval reference"});
  }
  if (review.status === "declined" && (!review.decline_reference || review.declined_by !== "Matt")) {
    context.addIssue({code:z.ZodIssueCode.custom,path:["decline_reference"],message:"An exclusion decline requires Matt's explicit decision reference"});
  }
  if (review.status === "pending" && (review.approval_reference !== undefined || review.approved_by !== undefined || review.decline_reference !== undefined || review.declined_by !== undefined)) {
    context.addIssue({code:z.ZodIssueCode.custom,path:["status"],message:"A pending exclusion must not imply that Matt has approved it"});
  }
  if (review.status === "approved" && (review.decline_reference !== undefined || review.declined_by !== undefined)) {
    context.addIssue({code:z.ZodIssueCode.custom,path:["status"],message:"An approved exclusion cannot also be declined"});
  }
  if (review.status === "declined" && (review.approval_reference !== undefined || review.approved_by !== undefined)) {
    context.addIssue({code:z.ZodIssueCode.custom,path:["status"],message:"A declined exclusion cannot also be approved"});
  }
});

/** Inspect the hold markers even when a hand-edited sheet has malformed state. */
export function hasSabExclusionReviewHold(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Record<string, any>;
  return state.exclusion_review?.status === "pending" || state.evidence?.next_action === "high_visibility_exclusion_pending_review";
}

export const sabDecisionStateSchema = z.object({
  source_report_key: sabReportKey,
  rule_id: z.string().trim().min(1).max(100),
  evidence_hash: z.string().regex(/^[a-f0-9]{64}$/i),
  center_type: z.enum(SAB_CENTER_TYPES).optional(),
  proposed_center: sabScanCenterString.optional(),
  centering_status: z.enum(["planned", "validated", "failed", "market_reference_only"]),
  outcome: z.enum(["deliverable", "no_visibility_core_found", "existing_visibility_too_strong", "deferred"]).optional(),
  routine_recenter_count: z.number().int().min(0).default(0),
  exclusion_review: sabExclusionReviewSchema.optional(),
  address_corroboration: sabAddressCorroborationSchema.optional(),
  evidence: z.record(z.unknown()).optional(),
}).strict().superRefine((state, context) => {
  const review=state.exclusion_review;
  if (review && (review.report_key !== state.source_report_key || review.evidence_hash !== state.evidence_hash)) {
    context.addIssue({code:z.ZodIssueCode.custom,path:["exclusion_review"],message:"Exclusion approval must match this exact source report and evidence hash"});
  }
  if (state.evidence?.next_action === "high_visibility_exclusion_pending_review" && review?.status !== "pending") {
    context.addIssue({code:z.ZodIssueCode.custom,path:["exclusion_review"],message:"A pending exclusion decision requires its matching pending review"});
  }
  if ((state.evidence?.next_action === "high_visibility_excluded" || state.outcome === "existing_visibility_too_strong") && review?.status !== "approved") {
    context.addIssue({code:z.ZodIssueCode.custom,path:["exclusion_review"],message:"A final high-visibility exclusion requires Matt's approved review"});
  }
});

export const sabMarketReferenceSchema = z.object({
  kind: z.literal("market_reference_only"),
  source: z.literal("auxiliary_scan_reverse_geocode"),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  city: z.string().trim().min(1),
  state: z.string().regex(/^[A-Za-z]{2}$/),
  zip: z.string().trim().min(1),
  auxiliary_report_key: sabReportKey,
  auxiliary_report_url: z.string().url(),
}).strict();

export const sabEffectiveScanSpecSchema = z.object({
  grid_size: z.literal("7x7"),
  radius_miles: z.union([z.literal(3), z.literal(5)]),
}).strict();

const sabContactResearchPathSchema = z.object({
  status: z.enum(["completed", "not_required_verified_earlier"]),
  sources_inspected: z.array(z.string().trim().min(1).max(2000)).max(20),
}).strict().superRefine((value, ctx) => {
  if (value.status === "completed" && value.sources_inspected.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A completed contact-research path requires inspected-source evidence" });
  }
  if (value.status === "not_required_verified_earlier" && value.sources_inspected.length > 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A path stopped after earlier verification cannot claim inspected sources" });
  }
});

export const sabContactResearchSchema = z.object({
  exact_name_search: sabContactResearchPathSchema,
  exact_phone_fallback: sabContactResearchPathSchema,
  company_controlled_inspection: sabContactResearchPathSchema,
  accepted_evidence: z.array(z.object({
    email: z.string().trim().email(),
    verification_gate: z.string().trim().min(1).max(1000),
    sources: z.array(z.string().trim().min(1).max(2000)).min(1).max(20),
  }).strict()).max(10),
  rejected_candidates: z.array(z.object({
    email: z.string().trim().email(),
    reason: z.string().trim().min(1).max(2000),
    sources: z.array(z.string().trim().min(1).max(2000)).min(1).max(20),
  }).strict()).max(50),
  result: z.enum(["verified_email", "exhausted"]),
  completed_at: z.string().datetime(),
  exhaustion_completed_at: z.string().datetime().nullable(),
  no_unverified_email_retained: z.literal(true),
  orchestrator_reconciled: z.literal(true),
}).strict().superRefine((value, ctx) => {
  const paths = [value.exact_name_search, value.exact_phone_fallback, value.company_controlled_inspection];
  if (value.exact_name_search.status !== "completed") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["exact_name_search"], message: "Exact-name search is always required" });
  }
  if (value.result === "verified_email") {
    if (value.accepted_evidence.length === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["accepted_evidence"], message: "Verified email requires accepted evidence" });
    if (value.exhaustion_completed_at !== null) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["exhaustion_completed_at"], message: "Verified email is not an exhaustion result" });
    const firstStopped = paths.findIndex(path => path.status === "not_required_verified_earlier");
    if (firstStopped >= 0 && paths.slice(firstStopped).some(path => path.status !== "not_required_verified_earlier")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Later contact paths cannot resume after verified-email early stop" });
    }
  } else {
    if (paths.some(path => path.status !== "completed")) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Exhaustion requires every contact-research path to be completed" });
    if (value.accepted_evidence.length > 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["accepted_evidence"], message: "Exhausted contact research cannot retain accepted email evidence" });
    if (value.exhaustion_completed_at === null) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["exhaustion_completed_at"], message: "Exhaustion requires its final timestamp" });
  }
});

export const sabEligibilityStateSchema = z.object({
  sab_confirmed: z.literal(true), trade_match: z.literal(true), franchise_excluded: z.literal(true),
  crm_dedup_checked: z.literal(true), contact_verified: z.literal(true),
  evidence_references: z.array(z.string().trim().min(1).max(2000)).min(1).max(20),
  contact_research: sabContactResearchSchema.optional(),
}).strict();

const structuredCompanyFields = {
  business_profile: sabBusinessProfileSchema.nullable().optional().describe("Compact exact-Place-ID DataForSEO enrichment history. Preserve returned categories, services, is_claimed and phone; never include a hidden street address. Provider coordinates are not a validated scan center. Resolve source-phone conflicts with explicit phone_resolution evidence; profile prose never establishes eligibility."),
  outcome: z.enum(["deliverable", "no_visibility_core_found"]).nullable().optional(),
  market_reference: sabMarketReferenceSchema.nullable().optional(),
  decision_state: sabDecisionStateSchema.nullable().optional(),
  qualification_reason: nullableString.optional(),
  eligibility_state: sabEligibilityStateSchema.nullable().optional().describe("Structured pre-scan eligibility. It authorizes guarded planning only when complete; it never establishes final qualification. Before complete or qa_ready, add contact_research with matching accepted-email evidence or full path exhaustion; rejected candidates require reasons and no unverified email may remain."),
  scan_spec: sabEffectiveScanSpecSchema.nullable().optional(),
};

export const sabCompanyUpdatesSchema = z
  .object({
    ...structuredCompanyFields,
    scan_keyword: nullableString.optional(),
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
    qualification_status: z
      .enum(SAB_QUALIFICATION_STATUSES)
      .nullable()
      .optional()
      .describe(
        "Final disposition, separate from pre-scan eligibility. Keep null while scan work remains in progress. Use qualified only after a valid deliverable or completed no_visibility_core_found path; use disqualified or deferred for a reasoned final disposition.",
      ),
    sales_priority: z
      .number()
      .int()
      .min(1)
      .max(3)
      .optional()
      .describe(
        "Website-sales priority: 3 is strongest, 2 is viable, and 1 is low priority.",
      ),
    sales_priority_reason: nullableString.optional(),
    workflow: z.literal(SCALE_FIRST_WORKFLOW).optional(),
    contact_tag: z.enum(SCALE_FIRST_CONTACT_TAGS).nullable().optional(),
    scan_center: sabScanCenterString
      .nullable()
      .optional()
      .describe(
        "Planned pre-scan center in exact latitude,longitude form. Supply center_type in the same call. This does not create a completed or canonical scan.",
      ),
    center_type: z
      .enum(SAB_CENTER_TYPES)
      .nullable()
      .optional()
      .describe(
        `Center type. Supply scan_center in the same call. Uses the same enum as save_sab_scan_result. ${SAB_RANKED_PEAK_CENTER_DESCRIPTION}`,
      ),
    blocker: nullableString.optional(),
    research_notes: nullableString
      .optional()
      .describe(
        "Supporting history only; never establishes current decision, qualification, center or approval state. Use structured decision_state and qualification_reason.",
      ),
  })
  .strict()
  .superRefine((updates, ctx) => {
    const hasScanCenter = Object.prototype.hasOwnProperty.call(
      updates,
      "scan_center",
    );
    const hasCenterType = Object.prototype.hasOwnProperty.call(
      updates,
      "center_type",
    );
    if (hasScanCenter !== hasCenterType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: hasScanCenter ? ["center_type"] : ["scan_center"],
        message: "scan_center and center_type must be supplied together",
      });
    }
    if (
      hasScanCenter &&
      hasCenterType &&
      (updates.scan_center === null) !== (updates.center_type === null)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scan_center"],
        message:
          "scan_center and center_type must both be values or both be null",
      });
    }
  });

export const sabScanResultSchema = z
  .object({
    scan_role: z
      .enum(SAB_SCAN_ROLES)
      .describe(
        "Use deliverable for the canonical qualified-company scan shown in the current scan columns. Use auxiliary for scout or fine scans retained only in scan history.",
      ),
    scan_type: z.enum(SAB_SCAN_TYPES).optional(),
    arp: z.number().min(0).nullable(),
    solv: z.number().min(0).max(100).nullable(),
    found_in: z.number().int().min(0).nullable().optional(),
    scan_center: sabScanCenterString.optional(),
    report_key: z.string().trim().min(1).max(1_000),
    report_url: z.string().trim().url().max(2_000),
    center_type: z.enum(SAB_CENTER_TYPES).optional().describe(SAB_RANKED_PEAK_CENTER_DESCRIPTION),
    scan_date: z.string().trim().min(1).max(100),
    scan_keyword: z.string().trim().min(1).max(500),
    scan_spec: sabEffectiveScanSpecSchema.optional(),
    atrp: z.number().min(1).nullable().optional(),
    notes: nullableString.optional(),
  })
  .strict();

export const sabWorkflowRowSchema = z
  .object({
    ...structuredCompanyFields,
    batch_id: batchId,
    batch_position: z.number().int().min(1),
    status: z.enum(SAB_STATUSES).default("assigned"),
    company: z.string().trim().min(1).max(1_000),
    place_id: z.string().trim().min(1).max(500),
    arp: z.number().min(0).nullable().optional(),
    solv: z.number().min(0).max(100).nullable().optional(),
    found_in: z.number().int().min(0).nullable().optional(),
    center_type: z.enum(SAB_CENTER_TYPES).nullable().optional(),
    scan_center: nullableString.optional(),
    report_key: nullableString.optional(),
    report_url: z.string().trim().url().max(2_000).nullable().optional(),
    scan_date: nullableString.optional(),
    scan_keyword: nullableString.optional(),
    competitors: z
      .array(z.string().trim().min(1).max(1_000))
      .max(200)
      .optional(),
    address: nullableString.optional(),
    city: nullableString.optional(),
    state: nullableString.optional(),
    zip: nullableString.optional(),
    phone: nullableString.optional(),
    owner_name: nullableString.optional(),
    email: nullableString.optional(),
    website: nullableString.optional(),
    google_maps_url: z.string().trim().url().max(2_000).nullable().optional(),
    has_website: z.boolean().nullable().optional(),
    website_platform: nullableString.optional(),
    service_page_count: z.number().int().min(0).nullable().optional(),
    website_analysis: auditFindings.nullable().optional(),
    reviews_analysis: auditFindings.nullable().optional(),
    rating: z.number().min(0).max(5).nullable().optional(),
    review_count: z.number().int().min(0).nullable().optional(),
    qualification_status: z
      .enum(SAB_QUALIFICATION_STATUSES)
      .nullable()
      .optional(),
    blocker: nullableString.optional(),
    research_notes: nullableString.optional(),
    sales_priority: z.number().int().min(1).max(3).nullable().optional(),
    sales_priority_reason: nullableString.optional(),
    workflow: z.literal(SCALE_FIRST_WORKFLOW).nullable().optional(),
    contact_tag: z.enum(SCALE_FIRST_CONTACT_TAGS).nullable().optional(),
  })
  .strict();

export const getSabBatchInputSchema = {
  ...workflowSheetInputSchema,
  batch_id: batchId,
  include_completed: z
    .boolean()
    .default(false)
    .describe("Include rows already marked complete, qa_ready, or imported"),
};

export const getSabCompanyInputSchema = {
  ...workflowSheetInputSchema,
  place_id: z
    .string()
    .trim()
    .min(1)
    .describe("Google Place ID from the SAB source sheet"),
};

export const saveSabCompanyInputSchema = {
  ...workflowSheetInputSchema,
  place_id: z
    .string()
    .trim()
    .min(1)
    .describe("Google Place ID from the SAB source sheet"),
  updates: sabCompanyUpdatesSchema.describe(
    "Only the fields that should change. Scale-First uses structured decisions and eligibility; legacy audit fields are not required.",
  ),
};

export const saveSabScanResultInputSchema = {
  ...workflowSheetInputSchema,
  place_id: z
    .string()
    .trim()
    .min(1)
    .describe("Google Place ID from the SAB source sheet"),
  scan_result: sabScanResultSchema,
};

const sabVerifiedScanSpecSchema = z
  .object({
    scan_role: z.literal("auxiliary"),
    scan_type: z.enum(["scout", "fine"]),
    scan_center: sabScanCenterString,
    grid_size: z.union([z.literal(7), z.literal(9)]),
    radius: z.number().finite().min(0.1).max(100),
    measurement: z.enum(["mi", "km"]),
    keyword: z.string().trim().min(1).max(500),
    platform: z.literal("google"),
  })
  .strict();

const sabScanHistoryRepairSchema = z
  .object({
    report_key: sabReportKey,
    expected_place_id: z.string().trim().min(1).max(500),
    disposition: z.enum(["attach_verified_auxiliary", "void_excess_duplicate"]),
    remove_from_place_ids: z
      .array(z.string().trim().min(1).max(500))
      .max(10)
      .default([]),
    authorization_id: z.string().uuid(),
    reason: z.string().trim().min(1).max(2_000),
    expected: sabVerifiedScanSpecSchema,
  })
  .strict();

export const reconcileSabScanHistoryInputSchema = {
  ...workflowSheetInputSchema,
  repairs: z.array(sabScanHistoryRepairSchema).min(1).max(20),
};

export const runSabScanOnceInputSchema = {
  ...workflowSheetInputSchema,
  run_id: z.string().trim().min(1).max(200).optional().describe("Required for every new paid submission; omission is allowed only to retrieve an existing idempotent receipt."),
  authorization_id: z.string().uuid(),
  company_name: z.string().trim().min(1).max(1_000),
  place_id: z.string().trim().min(1).max(500),
  scan_role: z.enum(SAB_SCAN_ROLES),
  scan_type: z.enum(SAB_SCAN_TYPES),
  center: z
    .object({
      latitude: z.number().finite().min(-90).max(90),
      longitude: z.number().finite().min(-180).max(180),
    })
    .strict(),
  grid_size: z.union([z.literal(7), z.literal(9)]),
  radius: z.number().finite().min(0.1).max(100),
  measurement: z.enum(["mi", "km"]),
  keyword: z.string().trim().min(1).max(500),
  platform: z.literal("google"),
  estimated_credits: z.number().int().positive(),
  save_location_required: z.boolean(),
  eligibility_gate_result: z.literal("passed"),
  duplicate_report_result: z.literal("none"),
  retry_after_ambiguous_submission: z.literal(false),
  center_derivation: z.string().trim().min(1).max(5_000),
  sop_routing_rule: z.string().trim().min(1).max(5_000),
};

export const upgradeSabWorkflowSchemaInputSchema = {
  ...workflowSheetInputSchema,
};

export const createSabWorkflowInputSchema = {
  title: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe("Google Sheet file title for the city run."),
  companies: z
    .array(sabWorkflowRowSchema)
    .min(1)
    .max(2_000)
    .describe(
      "The complete reconciled roster. The connector validates every row and writes the roster once.",
    ),
};

export const markSabBlockedInputSchema = {
  ...workflowSheetInputSchema,
  place_id: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(2_000),
};

export const getSabProgressInputSchema = {
  ...workflowSheetInputSchema,
  batch_id: batchId
    .optional()
    .describe(
      "Omit to return progress for every batch in the selected Workflow Sheet",
    ),
};

export const getSabCrmImportContractInputSchema = {
  workflow: z
    .enum(["audit_first_v1_1", SCALE_FIRST_WORKFLOW])
    .default("audit_first_v1_1")
    .describe(
      "Explicit contract workflow. Use scale_first_v2 for Scale-First Manifest v2; omit only for the backward-compatible Audit-First v1.1 contract.",
    ),
};

export const checkCrmPlaceIdsInputSchema = {
  place_ids: z
    .array(z.string().trim().min(1).max(500))
    .min(1)
    .max(2_000)
    .describe(
      "Google Place IDs discovered in the completed master scan. Matching is exact Place-ID equality only.",
    ),
};

export const checkCrmLocalFalconReportInputSchema = {
  report_key: z
    .string()
    .trim()
    .min(1)
    .max(1_000)
    .describe(
      "Completed Local Falcon competitor report key. The connector fetches the report and extracts every discovered Google Place ID server-side.",
    ),
};

export const createSabWorkflowFromMasterReportInputSchema = {
  title: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe("Google Sheet file title for this city run."),
  report_key: z
    .string()
    .trim()
    .min(1)
    .max(1_000)
    .describe(
      "Completed Local Falcon master competitor report key. The connector builds the durable ledger server-side and never returns the full roster inline.",
    ),
  batch_size: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(40)
    .describe(
      "Maximum companies per execution batch. Batching changes capacity only, not run identity or final manifest cardinality.",
    ),
};

export const getSabRankedCellsInputSchema = {
  report_key: z
    .string()
    .trim()
    .min(1)
    .max(1_000)
    .describe(
      "Completed Local Falcon master scan report key. This tool reads the existing report and never runs a scan.",
    ),
  place_ids: z
    .array(z.string().trim().min(1).max(500))
    .min(1)
    .max(50)
    .describe(
      "Selected qualified-company Google Place IDs. The connector filters the completed master report server-side and returns only their ranked cells.",
    ),
};

export const analyzeSabMasterCentersInputSchema = {
  report_key: z
    .string()
    .trim()
    .min(1)
    .max(1_000)
    .describe(
      "Completed Local Falcon master scan report key. This tool reads the existing report and never runs a scan.",
    ),
  place_ids: z
    .array(z.string().trim().min(1).max(500))
    .min(1)
    .max(200)
    .describe(
      "Survivor Place IDs to analyze. The connector returns compact centering diagnostics and hashes, not raw ranked cells.",
    ),
};

export const evaluateSabAddressCandidateInputSchema = {
  report_key: z
    .string()
    .trim()
    .min(1)
    .max(1_000)
    .describe(
      "Completed Local Falcon report key whose exact ranked cells must be used for the geographic-fit calculation.",
    ),
  place_id: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe("Exact survivor Google Place ID in the completed report."),
  address_candidate: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe(
      "Temporary independently discovered address candidate. It is geocoded in memory and is never returned, logged, or persisted by this tool.",
    ),
};

export const enrichSabBusinessesInputSchema = {
  place_ids: z
    .array(z.string().trim().min(1).max(500))
    .min(1)
    .max(50)
    .describe(
      "Survivor Google Place IDs. Duplicate inputs are collapsed before any provider request.",
    ),
  location_name: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe(
      "DataForSEO location_name, for example Charlotte,North Carolina,United States.",
    ),
  language_code: z.string().trim().min(2).max(10).default("en"),
};

export const reverseGeocodeSabCentersInputSchema = {
  centers: z
    .array(
      z
        .object({
          place_id: z
            .string()
            .trim()
            .min(1)
            .max(500)
            .describe(
              "Google Place ID used only as the stable result identifier.",
            ),
          company: z.string().trim().min(1).max(1_000).optional(),
          latitude: z.number().finite().min(-90).max(90),
          longitude: z.number().finite().min(-180).max(180),
        })
        .strict(),
    )
    .min(1)
    .max(100)
    .describe(
      "Exact final scan-center coordinates to reverse-geocode. Results preserve the input order and Place IDs.",
    ),
};

export const validateSabCrmManifestInputSchema = {
  manifest_json: z
    .string()
    .trim()
    .min(2)
    .max(2_000_000)
    .describe(
      "Complete candidate CRM batch.json payload as JSON text. This validates only and never imports or writes CRM records.",
    ),
};

export type SabCompanyUpdates = z.infer<typeof sabCompanyUpdatesSchema>;
export type SabScanResult = z.infer<typeof sabScanResultSchema>;
export type SabVerifiedScanSpec = z.infer<typeof sabVerifiedScanSpecSchema>;
export type SabScanHistoryRepairInput = z.infer<
  typeof sabScanHistoryRepairSchema
>;
export type SabWorkflowRowInput = z.infer<typeof sabWorkflowRowSchema>;

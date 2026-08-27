import { z } from "zod";

export const verdictSchema = z.enum([
  "continue",
  "correct",
  "reconcile",
  "approval_required",
  "user_ruling_required",
  "handoff_ready",
  "complete",
]);

export const checkpointInputSchema = z.object({
  registered_sop_handle: z
    .string()
    .trim()
    .regex(/^sop_[a-f0-9]{24}_[a-f0-9]{24}$/),
  claude_message: z.string().trim().min(1).max(60000),
  run_context: z.string().trim().min(1).max(40000),
  user_rulings: z.array(z.string().trim().min(1).max(4000)).max(50).default([]),
});

export const reviewResultSchema = z.object({
  verdict: verdictSchema,
  summary: z.string().max(2000),
  problems: z.array(z.string().max(2000)).max(30),
  instructions_for_claude: z.string().max(8000),
  approval_boundary: z.string().max(2000),
  evidence_gaps: z.array(z.string().max(2000)).max(30),
});

export type CheckpointInput = z.infer<typeof checkpointInputSchema>;
export type ReviewResult = z.infer<typeof reviewResultSchema>;
export type SupervisedReviewResult = ReviewResult & {
  review_id: string;
  response_gate: import("./response-gate.js").SupervisorResponseGate;
};

export const registerSopInputSchema = z.object({
  source_url: z.string().trim().url().max(4096),
  document_title_version: z.string().trim().min(1).max(1000),
  drive_revision_id: z.string().trim().min(1).max(1000).optional(),
  exact_document_text: z.string().min(1).max(2_000_000),
});

export const registeredSopSchema = z.object({
  registered_sop_handle: z.string().regex(/^sop_[a-f0-9]{24}_[a-f0-9]{24}$/),
  local_file_path: z.string().min(1),
  content_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  source_url: z.string().url(),
  document_title_version: z.string().min(1),
  drive_revision_id: z.string().min(1).nullable(),
});

export const proposedScanSchema = z.object({
  company_name: z.string().trim().min(1).max(500),
  place_id: z.string().trim().min(1).max(1000),
  scan_role: z.string().trim().min(1).max(500),
  scan_type: z.string().trim().min(1).max(500),
  source_report_key: z.string().trim().min(1).max(1000).nullable(),
  center: z.object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  }),
  center_derivation: z.string().trim().min(1).max(2000),
  sop_routing_rule: z.string().trim().min(1).max(2000),
  grid_size: z.object({
    rows: z.number().int().positive().max(99),
    columns: z.number().int().positive().max(99),
  }),
  radius: z.number().positive().finite(),
  measurement_unit: z.enum(["miles", "kilometers"]),
  keyword: z.string().trim().min(1).max(1000),
  platform: z.string().trim().min(1).max(500),
  estimated_credits: z.number().int().nonnegative().max(1_000_000),
  duplicate_report_result: z.enum(["none", "equivalent_exists", "unknown"]),
  prior_history: z.object({
    auxiliary_count: z.number().int().nonnegative().max(1000),
    deliverable_count: z.number().int().nonnegative().max(1000),
    recenter_count: z.number().int().nonnegative().max(1000),
    summary: z.string().trim().max(4000),
  }),
  save_place_id_required: z.boolean(),
  eligibility_gate_result: z.enum(["passed", "failed", "unknown"]),
  retry_after_ambiguous_submission: z.boolean(),
  master_run_parameters_changed: z.boolean(),
  crm_export_included: z.boolean(),
});

export const scanPlanInputSchema = z.object({
  registered_sop_handle: z
    .string()
    .trim()
    .regex(/^sop_[a-f0-9]{24}_[a-f0-9]{24}$/),
  durable_run_state: z.string().trim().min(1).max(40000),
  proposed_scans: z.array(proposedScanSchema).min(1).max(100),
  user_rulings: z.array(z.string().trim().min(1).max(4000)).max(50).default([]),
});

export const scanReviewDraftSchema = z.object({
  verdict: z.enum(["scan_approved", "correct", "user_ruling_required"]),
  summary: z.string().max(2000),
  problems: z.array(z.string().max(2000)).max(30),
  instructions_for_claude: z.string().max(8000),
  applicable_sop_rule: z.string().max(4000),
  explicit_exclusions: z.array(z.string().max(2000)).max(30),
});

export const scanAuthorizationSchema = z.object({
  authorization_id: z.string().uuid(),
  approved_scans: z.array(proposedScanSchema).min(1).max(100),
  prerequisite_save_location_actions: z.array(
    z.object({
      action: z.literal("saveLocalFalconBusinessLocationToAccount"),
      company_name: z.string().min(1),
      place_id: z.string().min(1),
    }),
  ),
  total_approved_credits: z.number().int().nonnegative(),
  applicable_sop_rule: z.string().min(1),
  timestamp: z.string().datetime(),
  explicit_exclusions: z.array(z.string().min(1)),
});

export const scanReviewResultSchema = z.object({
  verdict: z.enum(["scan_approved", "correct", "user_ruling_required"]),
  summary: z.string().max(2000),
  problems: z.array(z.string().max(2000)).max(30),
  instructions_for_claude: z.string().max(8000),
  authorization: scanAuthorizationSchema.nullable(),
});

export type RegisterSopInput = z.infer<typeof registerSopInputSchema>;
export type RegisteredSop = z.infer<typeof registeredSopSchema>;
export type ProposedScan = z.infer<typeof proposedScanSchema>;
export type ScanPlanInput = z.infer<typeof scanPlanInputSchema>;
export type ScanReviewDraft = z.infer<typeof scanReviewDraftSchema>;
export type ScanReviewResult = z.infer<typeof scanReviewResultSchema>;
export type SupervisedScanReviewResult = ScanReviewResult & {
  review_id: string;
  response_gate: import("./response-gate.js").SupervisorResponseGate;
};

export type CodexExecution = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
  resultText?: string;
  usage?: CodexTokenUsage;
};

export type CodexTokenUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
};

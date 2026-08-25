import crypto from "node:crypto";
import { loadConfig, type SupervisorConfig } from "./config.js";
import { executeCodex } from "./codex.js";
import { appendJsonLog } from "./logging.js";
import { scanReviewSchemaPath } from "./paths.js";
import { buildScanReviewPrompt } from "./prompt.js";
import { ReviewExecutionError } from "./reviewer.js";
import { resolveRegisteredSop } from "./sop-registry.js";
import {
  scanPlanInputSchema,
  scanReviewDraftSchema,
  scanReviewResultSchema,
  type CodexExecution,
  type ScanPlanInput,
  type ScanReviewResult,
} from "./types.js";

export type ScanReviewerDependencies = {
  config?: SupervisorConfig;
  execute?: (
    prompt: string,
    config: SupervisorConfig,
    outputSchemaPath: string,
  ) => Promise<CodexExecution>;
  now?: () => Date;
  authorizationId?: () => string;
};

const fixedExclusions = [
  "No scans, centers, specifications, companies, Place IDs, or credits beyond this exact authorization.",
  "No retry after an ambiguous submission or failure.",
  "No excess auxiliary scan or recenter beyond the controlling SOP limit.",
  "No changed master-run parameters, CRM export, unrelated account modification, or unrelated purchase.",
];

function hardBoundaryProblems(input: ScanPlanInput): string[] {
  const problems: string[] = [];
  for (const scan of input.proposed_scans) {
    const label = `${scan.company_name} (${scan.place_id})`;
    if (scan.eligibility_gate_result !== "passed")
      problems.push(
        `${label}: eligibility gate is ${scan.eligibility_gate_result}.`,
      );
    if (scan.duplicate_report_result !== "none")
      problems.push(
        `${label}: duplicate-report result is ${scan.duplicate_report_result}.`,
      );
    if (scan.retry_after_ambiguous_submission)
      problems.push(
        `${label}: proposed action is a retry after an ambiguous submission.`,
      );
    if (scan.master_run_parameters_changed)
      problems.push(`${label}: master-run parameters changed.`);
    if (scan.crm_export_included)
      problems.push(`${label}: CRM export is included.`);
  }
  return problems;
}

async function audit(
  config: SupervisorConfig,
  input: ScanPlanInput,
  result: ScanReviewResult,
): Promise<void> {
  await appendJsonLog(config.logDirectory, "scan-approvals.jsonl", {
    timestamp: new Date().toISOString(),
    registered_sop_handle: input.registered_sop_handle,
    result,
  });
}

export async function reviewSabScanPlan(
  rawInput: unknown,
  dependencies: ScanReviewerDependencies = {},
): Promise<ScanReviewResult> {
  const input = scanPlanInputSchema.parse(rawInput);
  const config = dependencies.config || loadConfig();
  const { registration, exactText } = await resolveRegisteredSop(
    input.registered_sop_handle,
    config,
  );
  const hardProblems = hardBoundaryProblems(input);
  if (hardProblems.length) {
    const result = scanReviewResultSchema.parse({
      verdict: "user_ruling_required",
      summary: "The proposed scan plan crosses a protected approval boundary.",
      problems: hardProblems,
      instructions_for_claude:
        "Stop and obtain Matt's explicit ruling. Do not submit or retry any scan.",
      authorization: null,
    });
    await audit(config, input, result);
    return result;
  }

  const prompt = await buildScanReviewPrompt(input, registration, exactText);
  let execution: CodexExecution;
  try {
    execution = await (dependencies.execute || executeCodex)(
      prompt,
      config,
      scanReviewSchemaPath,
    );
  } catch (error) {
    throw new ReviewExecutionError("Codex could not be started", {
      code: "codex_spawn_failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
  if (execution.timedOut) {
    throw new ReviewExecutionError("Codex scan review timed out", {
      code: "codex_timeout",
      timeout_ms: config.codexTimeoutMs,
    });
  }
  if (execution.exitCode !== 0 || !execution.resultText) {
    throw new ReviewExecutionError("Codex scan review failed", {
      code: "codex_failed",
      exit_code: execution.exitCode,
      stderr: execution.stderr.slice(-4000),
    });
  }

  let draft;
  try {
    draft = scanReviewDraftSchema.parse(JSON.parse(execution.resultText));
  } catch (error) {
    throw new ReviewExecutionError("Codex returned an invalid scan review", {
      code: "invalid_codex_scan_review",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  let result: ScanReviewResult;
  if (draft.verdict === "scan_approved") {
    if (!draft.applicable_sop_rule.trim() || draft.problems.length) {
      throw new ReviewExecutionError(
        "Codex returned an incomplete scan authorization",
        {
          code: "invalid_scan_authorization",
        },
      );
    }
    const exclusions = [
      ...new Set([...fixedExclusions, ...draft.explicit_exclusions]),
    ];
    result = scanReviewResultSchema.parse({
      verdict: "scan_approved",
      summary: draft.summary,
      problems: [],
      instructions_for_claude: draft.instructions_for_claude,
      authorization: {
        authorization_id: (dependencies.authorizationId || crypto.randomUUID)(),
        approved_scans: input.proposed_scans,
        prerequisite_save_location_actions: input.proposed_scans
          .filter((scan) => scan.save_place_id_required)
          .map((scan) => ({
            action: "saveLocalFalconBusinessLocationToAccount" as const,
            company_name: scan.company_name,
            place_id: scan.place_id,
          })),
        total_approved_credits: input.proposed_scans.reduce(
          (sum, scan) => sum + scan.estimated_credits,
          0,
        ),
        applicable_sop_rule: draft.applicable_sop_rule,
        timestamp: (dependencies.now || (() => new Date()))().toISOString(),
        explicit_exclusions: exclusions,
      },
    });
  } else {
    result = scanReviewResultSchema.parse({
      verdict: draft.verdict,
      summary: draft.summary,
      problems: draft.problems,
      instructions_for_claude: draft.instructions_for_claude,
      authorization: null,
    });
  }
  await audit(config, input, result);
  return result;
}

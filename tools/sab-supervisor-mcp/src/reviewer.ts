import crypto from "node:crypto";
import { loadConfig, type SupervisorConfig } from "./config.js";
import { executeCodex } from "./codex.js";
import { appendJsonLog, codexTelemetryFields } from "./logging.js";
import { buildReviewPrompt } from "./prompt.js";
import { resolveRegisteredSop } from "./sop-registry.js";
import {
  checkpointInputSchema,
  reviewResultSchema,
  type CheckpointInput,
  type CodexExecution,
  type ReviewResult,
} from "./types.js";

export type ReviewerDependencies = {
  config?: SupervisorConfig;
  execute?: (
    prompt: string,
    config: SupervisorConfig,
  ) => Promise<CodexExecution>;
};

export class ReviewExecutionError extends Error {
  constructor(
    message: string,
    readonly details: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ReviewExecutionError";
  }
}

export async function reviewSabCheckpoint(
  rawInput: unknown,
  dependencies: ReviewerDependencies = {},
): Promise<ReviewResult> {
  const input: CheckpointInput = checkpointInputSchema.parse(rawInput);
  const config = dependencies.config || loadConfig();
  const execute = dependencies.execute || executeCodex;
  const reviewId = crypto.randomUUID();
  const { registration, exactText } = await resolveRegisteredSop(
    input.registered_sop_handle,
    config,
  );
  const prompt = await buildReviewPrompt(input, registration, exactText);
  let execution: CodexExecution;

  try {
    execution = await execute(prompt, config);
  } catch (error) {
    await appendJsonLog(config.logDirectory, "reviews.jsonl", {
      timestamp: new Date().toISOString(),
      review_id: reviewId,
      status: "spawn_error",
      registered_sop_handle: input.registered_sop_handle,
      sop_content_sha256: registration.content_sha256,
      sop_chars: exactText.length,
      prompt_chars: prompt.length,
      checkpoint_chars: input.claude_message.length,
      durable_state_chars: input.run_context.length,
    });
    throw new ReviewExecutionError("Codex could not be started", {
      code: "codex_spawn_failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (execution.timedOut) {
    await appendJsonLog(config.logDirectory, "reviews.jsonl", {
      timestamp: new Date().toISOString(),
      review_id: reviewId,
      status: "timeout",
      duration_ms: execution.durationMs,
      registered_sop_handle: input.registered_sop_handle,
      sop_content_sha256: registration.content_sha256,
      sop_chars: exactText.length,
      prompt_chars: prompt.length,
      ...codexTelemetryFields(execution),
    });
    throw new ReviewExecutionError("Codex review timed out", {
      code: "codex_timeout",
      timeout_ms: config.codexTimeoutMs,
      exit_code: execution.exitCode,
      stderr: execution.stderr.slice(-4000),
    });
  }

  if (execution.exitCode !== 0 || !execution.resultText) {
    await appendJsonLog(config.logDirectory, "reviews.jsonl", {
      timestamp: new Date().toISOString(),
      review_id: reviewId,
      status: "codex_error",
      duration_ms: execution.durationMs,
      exit_code: execution.exitCode,
      registered_sop_handle: input.registered_sop_handle,
      sop_content_sha256: registration.content_sha256,
      sop_chars: exactText.length,
      prompt_chars: prompt.length,
      ...codexTelemetryFields(execution),
    });
    throw new ReviewExecutionError("Codex review failed", {
      code: "codex_failed",
      exit_code: execution.exitCode,
      stdout: execution.stdout.slice(-4000),
      stderr: execution.stderr.slice(-4000),
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(execution.resultText);
  } catch {
    throw new ReviewExecutionError("Codex returned invalid JSON", {
      code: "invalid_codex_json",
      exit_code: execution.exitCode,
      output: execution.resultText.slice(0, 4000),
    });
  }
  const result = reviewResultSchema.parse(parsed);

  await appendJsonLog(config.logDirectory, "reviews.jsonl", {
    timestamp: new Date().toISOString(),
    review_id: reviewId,
    status: "complete",
    verdict: result.verdict,
    duration_ms: execution.durationMs,
    exit_code: execution.exitCode,
    registered_sop_handle: input.registered_sop_handle,
    sop_content_sha256: registration.content_sha256,
    sop_chars: exactText.length,
    prompt_chars: prompt.length,
    checkpoint_chars: input.claude_message.length,
    durable_state_chars: input.run_context.length,
    user_ruling_chars: input.user_rulings.reduce(
      (sum, ruling) => sum + ruling.length,
      0,
    ),
    user_ruling_count: input.user_rulings.length,
    problem_count: result.problems.length,
    evidence_gap_count: result.evidence_gaps.length,
    ...codexTelemetryFields(execution),
  });

  return result;
}

import fs from "node:fs/promises";
import { reviewPromptPath } from "./paths.js";
import type { CheckpointInput, RegisteredSop, ScanPlanInput } from "./types.js";

export async function buildReviewPrompt(
  input: CheckpointInput,
  registration: RegisteredSop,
  exactSopText: string,
): Promise<string> {
  const fixedPrompt = await fs.readFile(reviewPromptPath, "utf8");
  const payload = {
    registered_sop_handle: input.registered_sop_handle,
    controlling_sop_source_url: registration.source_url,
    controlling_sop_title_version: registration.document_title_version,
    controlling_sop_drive_revision_id: registration.drive_revision_id,
    controlling_sop_content_sha256: registration.content_sha256,
    claude_latest_checkpoint: input.claude_message,
    durable_run_state: input.run_context,
    explicit_user_rulings_for_this_run: input.user_rulings,
  };

  return `${fixedPrompt}\n\n<controlling_sop_text>\n${exactSopText}\n</controlling_sop_text>\n\n<single_review_payload>\n${JSON.stringify(
    payload,
    null,
    2,
  )}\n</single_review_payload>\n`;
}

export async function buildScanReviewPrompt(
  input: ScanPlanInput,
  registration: RegisteredSop,
  exactSopText: string,
): Promise<string> {
  const { scanReviewPromptPath } = await import("./paths.js");
  const fixedPrompt = await fs.readFile(scanReviewPromptPath, "utf8");
  const payload = {
    registered_sop_handle: input.registered_sop_handle,
    controlling_sop_source_url: registration.source_url,
    controlling_sop_title_version: registration.document_title_version,
    controlling_sop_drive_revision_id: registration.drive_revision_id,
    controlling_sop_content_sha256: registration.content_sha256,
    concise_verified_durable_run_state: input.durable_run_state,
    exact_proposed_scans: input.proposed_scans,
    explicit_user_rulings_for_this_run: input.user_rulings,
  };
  return `${fixedPrompt}\n\n<controlling_sop_text>\n${exactSopText}\n</controlling_sop_text>\n\n<single_scan_review_payload>\n${JSON.stringify(payload, null, 2)}\n</single_scan_review_payload>\n`;
}

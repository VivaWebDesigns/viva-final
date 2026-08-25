import fs from "node:fs/promises";
import { reviewPromptPath } from "./paths.js";
import type { CheckpointInput } from "./types.js";

export async function buildReviewPrompt(
  input: CheckpointInput,
): Promise<string> {
  const fixedPrompt = await fs.readFile(reviewPromptPath, "utf8");
  const payload = {
    controlling_sop_reference: input.sop_path_or_url,
    claude_latest_checkpoint: input.claude_message,
    durable_run_state: input.run_context,
    explicit_user_rulings_for_this_run: input.user_rulings,
  };

  return `${fixedPrompt}\n\n<single_review_payload>\n${JSON.stringify(
    payload,
    null,
    2,
  )}\n</single_review_payload>\n`;
}

import fs from "node:fs/promises";
import path from "node:path";
import type { CodexExecution } from "./types.js";

export function codexTelemetryFields(
  execution: CodexExecution,
): Record<string, number | boolean> {
  if (!execution.usage) return { token_usage_available: false };
  const usage = execution.usage;
  return {
    token_usage_available: true,
    input_tokens: usage.inputTokens,
    cached_input_tokens: usage.cachedInputTokens,
    cache_write_input_tokens: usage.cacheWriteInputTokens,
    output_tokens: usage.outputTokens,
    reasoning_output_tokens: usage.reasoningOutputTokens,
  };
}

export async function appendJsonLog(
  logDirectory: string,
  fileName: string,
  record: Record<string, unknown>,
): Promise<void> {
  await fs.mkdir(logDirectory, { recursive: true, mode: 0o700 });
  await fs.appendFile(
    path.join(logDirectory, fileName),
    `${JSON.stringify(record)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
}

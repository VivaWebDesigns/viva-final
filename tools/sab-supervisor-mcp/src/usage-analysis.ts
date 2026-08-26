import fs from "node:fs/promises";
import path from "node:path";

type LogRecord = Record<string, unknown>;

export type UsageAnalysisOptions = {
  since?: Date;
  until?: Date;
};

export type UsageAnalysis = {
  window: { since: string | null; until: string | null };
  reviews: {
    total: number;
    checkpoint: number;
    scan_plan: number;
    completed: number;
    policy_blocked: number;
    failed: number;
    verdicts: Record<string, number>;
  };
  tokens: {
    measured_reviews: number;
    unavailable_reviews: number;
    input: number;
    cached_input: number;
    cache_write_input: number;
    uncached_input: number;
    output: number;
    reasoning_output: number;
    cache_rate: number | null;
  };
  timing: {
    measured_reviews: number;
    total_ms: number;
    average_ms: number | null;
    p95_ms: number | null;
    maximum_ms: number | null;
  };
  input_size: {
    measured_reviews: number;
    average_prompt_chars: number | null;
    maximum_prompt_chars: number | null;
  };
  highest_token_reviews: Array<{
    timestamp: string;
    kind: "checkpoint" | "scan_plan";
    verdict: string;
    total_tokens: number;
    input_tokens: number;
    cached_input_tokens: number;
    output_tokens: number;
  }>;
  signals: string[];
};

async function readJsonLines(filePath: string): Promise<LogRecord[]> {
  let text: string;
  try {
    text = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return text
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const value = JSON.parse(line);
        return value && typeof value === "object" ? [value as LogRecord] : [];
      } catch {
        return [];
      }
    });
}

function number(record: LogRecord, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function percentile(values: number[], fraction: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * fraction) - 1] ?? null;
}

function inWindow(record: LogRecord, options: UsageAnalysisOptions): boolean {
  if (typeof record.timestamp !== "string") return false;
  const timestamp = new Date(record.timestamp);
  if (Number.isNaN(timestamp.getTime())) return false;
  if (options.since && timestamp < options.since) return false;
  if (options.until && timestamp > options.until) return false;
  return true;
}

export async function analyzeUsage(
  logDirectory: string,
  options: UsageAnalysisOptions = {},
): Promise<UsageAnalysis> {
  const [checkpoints, scans] = await Promise.all([
    readJsonLines(path.join(logDirectory, "reviews.jsonl")),
    readJsonLines(path.join(logDirectory, "scan-approvals.jsonl")),
  ]);
  const records: Array<LogRecord & { kind: "checkpoint" | "scan_plan" }> = [
    ...checkpoints.map((record) => ({
      ...record,
      kind: "checkpoint" as const,
    })),
    ...scans.map((record) => ({ ...record, kind: "scan_plan" as const })),
  ].filter((record) => inWindow(record, options));

  const verdicts: Record<string, number> = {};
  for (const record of records) {
    const nestedResult =
      record.result && typeof record.result === "object"
        ? (record.result as LogRecord)
        : undefined;
    const verdict =
      typeof record.verdict === "string"
        ? record.verdict
        : typeof nestedResult?.verdict === "string"
          ? nestedResult.verdict
          : "unknown";
    verdicts[verdict] = (verdicts[verdict] || 0) + 1;
  }

  const measuredTokens = records.filter(
    (record) => record.token_usage_available === true,
  );
  const tokenSum = (key: string) =>
    measuredTokens.reduce((sum, record) => sum + (number(record, key) || 0), 0);
  const input = tokenSum("input_tokens");
  const cachedInput = tokenSum("cached_input_tokens");
  const durations = records.flatMap((record) => {
    const value = number(record, "duration_ms");
    return value === undefined ? [] : [value];
  });
  const promptSizes = records.flatMap((record) => {
    const value = number(record, "prompt_chars");
    return value === undefined ? [] : [value];
  });

  const highestTokenReviews = measuredTokens
    .map((record) => {
      const nestedResult =
        record.result && typeof record.result === "object"
          ? (record.result as LogRecord)
          : undefined;
      const inputTokens = number(record, "input_tokens") || 0;
      const outputTokens = number(record, "output_tokens") || 0;
      return {
        timestamp: String(record.timestamp),
        kind: record.kind as "checkpoint" | "scan_plan",
        verdict:
          typeof record.verdict === "string"
            ? record.verdict
            : typeof nestedResult?.verdict === "string"
              ? nestedResult.verdict
              : "unknown",
        total_tokens: inputTokens + outputTokens,
        input_tokens: inputTokens,
        cached_input_tokens: number(record, "cached_input_tokens") || 0,
        output_tokens: outputTokens,
      };
    })
    .sort((left, right) => right.total_tokens - left.total_tokens)
    .slice(0, 5);

  const completed = records.filter((record) => record.status === "complete");
  const policyBlocked = records.filter(
    (record) => record.status === "policy_blocked",
  );
  const failed = records.filter((record) =>
    ["spawn_error", "timeout", "codex_error"].includes(String(record.status)),
  );
  const correctionCount = (verdicts.correct || 0) + (verdicts.reconcile || 0);
  const signals: string[] = [];
  if (measuredTokens.length < completed.length)
    signals.push(
      "Some completed reviews predate token telemetry or did not emit a usage event.",
    );
  if (measuredTokens.length >= 3 && input > 0 && cachedInput / input < 0.25)
    signals.push(
      "Prompt-cache reuse is below 25%; check whether stable SOP content and fixed instructions remain unchanged between reviews.",
    );
  if (completed.length >= 4 && correctionCount / completed.length > 0.25)
    signals.push(
      "More than 25% of completed reviews returned correct/reconcile; inspect those checkpoints for recurring SOP ambiguity or weak durable-state summaries.",
    );
  if (failed.length)
    signals.push(
      `${failed.length} reviewer execution(s) failed or timed out; separate run-mechanics failures from SOP/process issues.`,
    );
  const timestamps = records
    .flatMap((record) => {
      const value = new Date(String(record.timestamp)).getTime();
      return Number.isNaN(value) ? [] : [value];
    })
    .sort((left, right) => left - right);
  const gaps = timestamps
    .slice(1)
    .map((value, index) => value - timestamps[index]);
  const medianGap = percentile(gaps, 0.5);
  if (records.length >= 6 && medianGap !== null && medianGap < 60_000)
    signals.push(
      "Median review spacing is under one minute; verify Claude is reviewing meaningful checkpoints rather than individual tool calls.",
    );
  if (!signals.length)
    signals.push(
      "No obvious telemetry warning was detected; review the highest-token checkpoints and verdict distribution for smaller improvements.",
    );

  const durationTotal = durations.reduce((sum, value) => sum + value, 0);
  return {
    window: {
      since: options.since?.toISOString() || null,
      until: options.until?.toISOString() || null,
    },
    reviews: {
      total: records.length,
      checkpoint: records.filter((record) => record.kind === "checkpoint")
        .length,
      scan_plan: records.filter((record) => record.kind === "scan_plan").length,
      completed: completed.length,
      policy_blocked: policyBlocked.length,
      failed: failed.length,
      verdicts,
    },
    tokens: {
      measured_reviews: measuredTokens.length,
      unavailable_reviews: records.length - measuredTokens.length,
      input,
      cached_input: cachedInput,
      cache_write_input: tokenSum("cache_write_input_tokens"),
      uncached_input: Math.max(0, input - cachedInput),
      output: tokenSum("output_tokens"),
      reasoning_output: tokenSum("reasoning_output_tokens"),
      cache_rate: input ? cachedInput / input : null,
    },
    timing: {
      measured_reviews: durations.length,
      total_ms: durationTotal,
      average_ms: durations.length ? durationTotal / durations.length : null,
      p95_ms: percentile(durations, 0.95),
      maximum_ms: durations.length ? Math.max(...durations) : null,
    },
    input_size: {
      measured_reviews: promptSizes.length,
      average_prompt_chars: promptSizes.length
        ? promptSizes.reduce((sum, value) => sum + value, 0) /
          promptSizes.length
        : null,
      maximum_prompt_chars: promptSizes.length
        ? Math.max(...promptSizes)
        : null,
    },
    highest_token_reviews: highestTokenReviews,
    signals,
  };
}

function integer(value: number | null): string {
  return value === null ? "n/a" : Math.round(value).toLocaleString("en-US");
}

export function formatUsageAnalysis(analysis: UsageAnalysis): string {
  const verdicts = Object.entries(analysis.reviews.verdicts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([verdict, count]) => `${verdict}=${count}`)
    .join(", ");
  const cacheRate =
    analysis.tokens.cache_rate === null
      ? "n/a"
      : `${(analysis.tokens.cache_rate * 100).toFixed(1)}%`;
  const lines = [
    "SAB supervisor usage analysis",
    `Window: ${analysis.window.since || "all logs"} to ${analysis.window.until || "latest"}`,
    `Reviews: ${analysis.reviews.total} (${analysis.reviews.checkpoint} checkpoint, ${analysis.reviews.scan_plan} scan-plan; ${analysis.reviews.failed} failed)`,
    `Verdicts: ${verdicts || "none"}`,
    `Tokens: ${analysis.tokens.input.toLocaleString("en-US")} input (${analysis.tokens.cached_input.toLocaleString("en-US")} cached, ${analysis.tokens.cache_write_input.toLocaleString("en-US")} cache-write, ${cacheRate}), ${analysis.tokens.output.toLocaleString("en-US")} output, ${analysis.tokens.reasoning_output.toLocaleString("en-US")} reasoning output`,
    `Telemetry coverage: ${analysis.tokens.measured_reviews}/${analysis.reviews.total} reviews`,
    `Timing: ${integer(analysis.timing.average_ms)} ms average, ${integer(analysis.timing.p95_ms)} ms p95, ${integer(analysis.timing.maximum_ms)} ms maximum`,
    `Prompt size: ${integer(analysis.input_size.average_prompt_chars)} chars average, ${integer(analysis.input_size.maximum_prompt_chars)} chars maximum`,
    "Highest-token reviews:",
    ...analysis.highest_token_reviews.map(
      (review) =>
        `  ${review.timestamp} ${review.kind} ${review.verdict}: ${review.total_tokens.toLocaleString("en-US")} total (${review.cached_input_tokens.toLocaleString("en-US")} cached input)`,
    ),
    "Efficiency signals:",
    ...analysis.signals.map((signal) => `  - ${signal}`),
  ];
  return `${lines.join("\n")}\n`;
}

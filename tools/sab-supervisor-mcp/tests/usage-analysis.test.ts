import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseCodexUsageEvent } from "../src/codex.js";
import { analyzeUsage, formatUsageAnalysis } from "../src/usage-analysis.js";

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "sab-usage-test-"));
});

afterEach(async () => fs.rm(root, { recursive: true, force: true }));

describe("Codex token telemetry", () => {
  it("extracts usage only from a completed-turn event", () => {
    expect(parseCodexUsageEvent('{"type":"turn.started"}')).toBeUndefined();
    expect(
      parseCodexUsageEvent(
        JSON.stringify({
          type: "turn.completed",
          usage: {
            input_tokens: 100,
            cached_input_tokens: 75,
            cache_write_input_tokens: 10,
            output_tokens: 20,
            reasoning_output_tokens: 5,
          },
        }),
      ),
    ).toEqual({
      inputTokens: 100,
      cachedInputTokens: 75,
      cacheWriteInputTokens: 10,
      outputTokens: 20,
      reasoningOutputTokens: 5,
    });
  });

  it("aggregates a bounded run window without retaining prompt content", async () => {
    await fs.writeFile(
      path.join(root, "reviews.jsonl"),
      [
        {
          timestamp: "2026-01-01T00:00:00.000Z",
          status: "complete",
          verdict: "continue",
          duration_ms: 1000,
          prompt_chars: 12000,
          token_usage_available: true,
          input_tokens: 3000,
          cached_input_tokens: 2000,
          cache_write_input_tokens: 500,
          output_tokens: 100,
          reasoning_output_tokens: 20,
        },
        {
          timestamp: "2026-01-02T00:00:00.000Z",
          status: "complete",
          verdict: "correct",
          duration_ms: 2000,
          prompt_chars: 18000,
          token_usage_available: true,
          input_tokens: 4000,
          cached_input_tokens: 3000,
          cache_write_input_tokens: 250,
          output_tokens: 200,
          reasoning_output_tokens: 40,
        },
      ]
        .map(JSON.stringify)
        .join("\n"),
    );
    await fs.writeFile(
      path.join(root, "scan-approvals.jsonl"),
      `${JSON.stringify({
        timestamp: "2026-01-02T00:01:00.000Z",
        status: "complete",
        verdict: "scan_approved",
        duration_ms: 3000,
        prompt_chars: 24000,
        token_usage_available: true,
        input_tokens: 5000,
        cached_input_tokens: 4000,
        cache_write_input_tokens: 125,
        output_tokens: 300,
        reasoning_output_tokens: 60,
      })}\n`,
    );

    const analysis = await analyzeUsage(root, {
      since: new Date("2026-01-01T12:00:00.000Z"),
    });
    expect(analysis.reviews).toMatchObject({
      total: 2,
      checkpoint: 1,
      scan_plan: 1,
      completed: 2,
      verdicts: { correct: 1, scan_approved: 1 },
    });
    expect(analysis.tokens).toMatchObject({
      measured_reviews: 2,
      input: 9000,
      cached_input: 7000,
      cache_write_input: 375,
      uncached_input: 2000,
      output: 500,
      reasoning_output: 100,
    });
    expect(analysis.tokens.cache_rate).toBeCloseTo(7 / 9);
    expect(analysis.highest_token_reviews[0]).toMatchObject({
      kind: "scan_plan",
      total_tokens: 5300,
    });
    expect(formatUsageAnalysis(analysis)).toContain("SAB supervisor usage");
  });
});

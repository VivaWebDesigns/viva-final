import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SupervisorConfig } from "../src/config.js";
import { ReviewExecutionError, reviewSabCheckpoint } from "../src/reviewer.js";
import { registerSopForReview } from "../src/sop-registry.js";
import type { CodexExecution, ReviewResult } from "../src/types.js";

const fixtureDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);
let testDirectory: string;
let config: SupervisorConfig;

beforeEach(async () => {
  testDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "sab-reviewer-test-"),
  );
  config = {
    codexPath: "codex",
    codexTimeoutMs: 50,
    maxCodexOutputBytes: 4096,
    logDirectory: testDirectory,
    watcher: {
      pollIntervalMs: 750,
      resumeTimeoutMs: 1000,
      maxRetries: 2,
      claudeExtensionId: "test-extension",
    },
  };
});

afterEach(async () => fs.rm(testDirectory, { recursive: true, force: true }));

function execution(result: ReviewResult): CodexExecution {
  return {
    exitCode: 0,
    stdout: "",
    stderr: "",
    timedOut: false,
    durationMs: 10,
    resultText: JSON.stringify(result),
    usage: {
      inputTokens: 1000,
      cachedInputTokens: 750,
      cacheWriteInputTokens: 0,
      outputTokens: 100,
      reasoningOutputTokens: 25,
    },
  };
}

async function registerFixture(name: string, revision: string) {
  return registerSopForReview(
    {
      source_url: `https://docs.google.com/document/d/${name}`,
      document_title_version: name,
      drive_revision_id: revision,
      exact_document_text: await fs.readFile(
        path.join(fixtureDirectory, `${name}.md`),
        "utf8",
      ),
    },
    config,
  );
}

describe("reviewSabCheckpoint", () => {
  it.each([
    "continue",
    "correct",
    "approval_required",
    "reconcile",
    "handoff_ready",
  ] as const)("returns the mocked %s verdict", async (verdict) => {
    const sop = await registerFixture("neutral-sop-a", "rev-a");
    const result = await reviewSabCheckpoint(
      {
        registered_sop_handle: sop.registered_sop_handle,
        claude_message: "Checkpoint complete.",
        run_context: "Durable state confirms step A is saved.",
        user_rulings: [],
      },
      {
        config,
        execute: async () =>
          execution({
            verdict,
            summary: "Neutral fixture result",
            problems: verdict === "continue" ? [] : ["Specific issue"],
            instructions_for_claude: "Perform only the next required step.",
            approval_boundary:
              verdict === "approval_required" ? "Exact paid action" : "none",
            evidence_gaps: [],
          }),
      },
    );
    expect(result.verdict).toBe(verdict);
  });

  it("exposes separate handoff and full-run completion semantics to Codex", async () => {
    const prompts: string[] = [];
    const sop = await registerFixture("neutral-sop-a", "rev-a");
    await reviewSabCheckpoint(
      {
        registered_sop_handle: sop.registered_sop_handle,
        claude_message: "I prepared a continuation package.",
        run_context: "The run objective remains incomplete.",
        user_rulings: [],
      },
      {
        config,
        execute: async (prompt) => {
          prompts.push(prompt);
          return execution({
            verdict: "handoff_ready",
            summary: "Necessary handoff is ready.",
            problems: [],
            instructions_for_claude:
              "Present the verified continuation package.",
            approval_boundary: "none",
            evidence_gaps: [],
          });
        },
      },
    );

    expect(prompts[0]).toContain("`handoff_ready` means the run is incomplete");
    expect(prompts[0]).toContain("`complete` means the entire run objective");
    expect(prompts[0]).toContain(
      "must not be used merely because a checkpoint is long",
    );
  });

  it("returns a useful timeout error", async () => {
    const sop = await registerFixture("neutral-sop-a", "rev-a");
    await expect(
      reviewSabCheckpoint(
        {
          registered_sop_handle: sop.registered_sop_handle,
          claude_message: "Checkpoint complete.",
          run_context: "State saved.",
          user_rulings: [],
        },
        {
          config,
          execute: async () => ({
            exitCode: null,
            stdout: "",
            stderr: "timeout",
            timedOut: true,
            durationMs: 50,
          }),
        },
      ),
    ).rejects.toBeInstanceOf(ReviewExecutionError);
  });

  it("logs token telemetry without storing review content", async () => {
    const sop = await registerFixture("neutral-sop-a", "rev-a");
    await reviewSabCheckpoint(
      {
        registered_sop_handle: sop.registered_sop_handle,
        claude_message: "PRIVATE_CHECKPOINT_MARKER",
        run_context: "PRIVATE_STATE_MARKER",
        user_rulings: ["PRIVATE_RULING_MARKER"],
      },
      {
        config,
        execute: async () =>
          execution({
            verdict: "continue",
            summary: "Continue",
            problems: [],
            instructions_for_claude: "Continue.",
            approval_boundary: "none",
            evidence_gaps: [],
          }),
      },
    );
    const logText = await fs.readFile(
      path.join(testDirectory, "reviews.jsonl"),
      "utf8",
    );
    const record = JSON.parse(logText.trim());
    expect(record).toMatchObject({
      token_usage_available: true,
      input_tokens: 1000,
      cached_input_tokens: 750,
      output_tokens: 100,
      reasoning_output_tokens: 25,
    });
    expect(logText).not.toContain("PRIVATE_CHECKPOINT_MARKER");
    expect(logText).not.toContain("PRIVATE_STATE_MARKER");
    expect(logText).not.toContain("PRIVATE_RULING_MARKER");
  });

  it("does not leak SOP, state, or rulings between calls", async () => {
    const prompts: string[] = [];
    const execute = async (prompt: string) => {
      prompts.push(prompt);
      return execution({
        verdict: "continue",
        summary: "Isolated",
        problems: [],
        instructions_for_claude: "Continue.",
        approval_boundary: "none",
        evidence_gaps: [],
      });
    };
    const alpha = await registerFixture("neutral-sop-a", "rev-a");
    const beta = await registerFixture("neutral-sop-b", "rev-b");
    await reviewSabCheckpoint(
      {
        registered_sop_handle: alpha.registered_sop_handle,
        claude_message: "Alpha",
        run_context: "ALPHA_STATE_ONLY",
        user_rulings: ["ALPHA_RULING_ONLY"],
      },
      { config, execute },
    );
    await reviewSabCheckpoint(
      {
        registered_sop_handle: beta.registered_sop_handle,
        claude_message: "Beta",
        run_context: "BETA_STATE_ONLY",
        user_rulings: ["BETA_RULING_ONLY"],
      },
      { config, execute },
    );

    expect(prompts[0]).toContain("ALPHA_STATE_ONLY");
    expect(prompts[0]).toContain("Neutral workflow A");
    expect(prompts[0]).not.toContain("BETA_STATE_ONLY");
    expect(prompts[1]).toContain("Neutral workflow B");
    expect(prompts[1]).toContain("BETA_STATE_ONLY");
    expect(prompts[1]).not.toContain("ALPHA_STATE_ONLY");
    expect(prompts[1]).not.toContain("ALPHA_RULING_ONLY");
  });
});

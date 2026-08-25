import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SupervisorConfig } from "../src/config.js";
import { ReviewExecutionError, reviewSabCheckpoint } from "../src/reviewer.js";
import type { CodexExecution, ReviewResult } from "../src/types.js";

const config: SupervisorConfig = {
  codexPath: "codex",
  codexTimeoutMs: 50,
  maxCodexOutputBytes: 4096,
  logDirectory: path.join(os.tmpdir(), "sab-supervisor-tests"),
  watcher: {
    pollIntervalMs: 750,
    resumeTimeoutMs: 1000,
    maxRetries: 2,
    claudeExtensionId: "test-extension",
  },
};

const fixtureDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);

const baseInput = {
  sop_path_or_url: path.join(fixtureDirectory, "neutral-sop-a.md"),
  claude_message: "Checkpoint complete.",
  run_context: "Durable state confirms step A is saved.",
  user_rulings: [],
};

function execution(result: ReviewResult): CodexExecution {
  return {
    exitCode: 0,
    stdout: "",
    stderr: "",
    timedOut: false,
    durationMs: 10,
    resultText: JSON.stringify(result),
  };
}

describe("reviewSabCheckpoint", () => {
  it.each([
    ["on-track", "continue"],
    ["SOP drift", "correct"],
    ["paid boundary", "approval_required"],
    ["missing reconciliation", "reconcile"],
  ] as const)("returns the mocked %s verdict", async (_name, verdict) => {
    const result = await reviewSabCheckpoint(baseInput, {
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
    });
    expect(result.verdict).toBe(verdict);
  });

  it("returns a useful timeout error", async () => {
    await expect(
      reviewSabCheckpoint(baseInput, {
        config,
        execute: async () => ({
          exitCode: null,
          stdout: "",
          stderr: "timeout",
          timedOut: true,
          durationMs: 50,
        }),
      }),
    ).rejects.toMatchObject({
      message: "Codex review timed out",
    });
  });

  it("does not leak SOP or run state between calls", async () => {
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

    await reviewSabCheckpoint(
      {
        ...baseInput,
        sop_path_or_url: path.join(fixtureDirectory, "neutral-sop-a.md"),
        run_context: "ALPHA_STATE_ONLY",
        user_rulings: ["ALPHA_RULING_ONLY"],
      },
      { config, execute },
    );
    await reviewSabCheckpoint(
      {
        ...baseInput,
        sop_path_or_url: path.join(fixtureDirectory, "neutral-sop-b.md"),
        run_context: "BETA_STATE_ONLY",
        user_rulings: ["BETA_RULING_ONLY"],
      },
      { config, execute },
    );

    expect(prompts[0]).toContain("ALPHA_STATE_ONLY");
    expect(prompts[0]).not.toContain("BETA_STATE_ONLY");
    expect(prompts[1]).toContain("BETA_STATE_ONLY");
    expect(prompts[1]).not.toContain("ALPHA_STATE_ONLY");
    expect(prompts[1]).not.toContain("ALPHA_RULING_ONLY");
  });
});

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const instructionPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../prompts/claude-instruction.md",
);

let instruction = "";

beforeAll(async () => {
  instruction = await fs.readFile(instructionPath, "utf8");
});

describe("fixed Claude checkpoint instruction", () => {
  it.each(["continue", "correct", "reconcile"])(
    "%s tells Claude to proceed",
    (verdict) => {
      expect(instruction).toMatch(
        /immediately follow `continue`, `correct`, or `reconcile` instructions and keep working/,
      );
      expect(instruction).toContain(`\`${verdict}\``);
    },
  );

  it("stops only for a user ruling, paid approval, verified handoff, or completion", () => {
    expect(instruction).toMatch(
      /stop and ask the user only for `user_ruling_required` or `approval_required`/,
    );
    expect(instruction).toContain("stop normally for `complete`");
    expect(instruction).toContain(
      "for `handoff_ready`, present the verified continuation package and stop normally",
    );
    expect(instruction).toContain(
      "only a structured `scan_approved` record does",
    );
    expect(instruction).not.toContain("After calling the reviewer, stop");
  });

  it("does not confuse a chat handoff with completion of the run", () => {
    expect(instruction).toContain(
      "Treat `complete` as completion of the full run objective",
    );
    expect(instruction).toContain(
      "Do not start a replacement chat for convenience, payload size, or an unsupported context-limit guess.",
    );
  });

  it("registers one private SOP revision and reuses its handle", () => {
    expect(instruction).toContain("call `register_sop_for_review` once");
    expect(instruction).toContain("use it for every review");
    expect(instruction).toContain("Register a changed SOP revision separately");
  });

  it("automatically executes only an exact scan_approved authorization", () => {
    expect(instruction).toContain("call `review_sab_scan_plan`");
    expect(instruction).toMatch(
      /for `scan_approved`, immediately execute each exact approved scan only through Viva SAB Workflow's `run_sab_scan_once`/,
    );
    expect(instruction).toContain(
      "Do not call `runLocalFalconScan` or `saveLocalFalconBusinessLocationToAccount` directly.",
    );
    expect(instruction).toContain(
      "If it returns `ambiguous_response`, `location_unverified`, or another manual-reconciliation stop, do not retry",
    );
    expect(instruction).toContain(
      "never add, change, retry, or broaden anything",
    );
    expect(instruction).toMatch(
      /for `correct`, stop the paid stage, make the instructed corrections, and submit the corrected plan for review/,
    );
    expect(instruction).toMatch(
      /for `user_ruling_required`, stop and ask Matt/,
    );
  });

  it("keeps non-stopping review loops private", () => {
    expect(instruction).toContain(
      "keep working without displaying the checkpoint, verdict, correction, reconciliation, or a request to continue to Matt",
    );
    expect(instruction).toContain(
      "repeat this private review-and-correction loop",
    );
    expect(instruction).toContain(
      "Do not turn those records into user-visible checkpoints",
    );
    expect(instruction).toContain("obey its deterministic `response_gate`");
    expect(instruction).toContain(
      "Any subsequent Workflow tool call invalidates the prior gate",
    );
    expect(instruction).not.toContain(
      "During the first supervisor-managed runs, display",
    );
  });

  it("does not wait on an authorized non-paid next step", () => {
    expect(instruction).toContain(
      "Do not present a checkpoint to the user and wait if the reviewer has already authorized a non-paid next step.",
    );
  });

  it("requires evidence before claiming a tool is unavailable", () => {
    expect(instruction).toContain(
      "First attempt the exact tool call when its required inputs are known",
    );
    expect(instruction).toContain(
      "exact attempted tool name and exact returned error",
    );
  });
});

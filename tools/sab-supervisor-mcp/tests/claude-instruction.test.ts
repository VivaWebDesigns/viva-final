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

  it("stops only for a user ruling, paid approval, or completion", () => {
    expect(instruction).toMatch(
      /stop and ask the user only for `user_ruling_required` or `approval_required`/,
    );
    expect(instruction).toContain("stop normally for `complete`");
    expect(instruction).toContain(
      "only a structured `scan_approved` record does",
    );
    expect(instruction).not.toContain("After calling the reviewer, stop");
  });

  it("registers one private SOP revision and reuses its handle", () => {
    expect(instruction).toContain("call `register_sop_for_review` once");
    expect(instruction).toContain("use it for every review");
    expect(instruction).toContain("Register a changed SOP revision separately");
  });

  it("automatically executes only an exact scan_approved authorization", () => {
    expect(instruction).toContain("call `review_sab_scan_plan`");
    expect(instruction).toMatch(
      /for `scan_approved`, immediately execute exactly the approved scans/,
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

  it("shows observation-mode fields", () => {
    for (const field of [
      "supervisor verdict",
      "approval ID",
      "exact approved scans and credits",
      "problems or corrections",
      "action taken",
    ]) {
      expect(instruction).toContain(field);
    }
  });

  it("does not wait on an authorized non-paid next step", () => {
    expect(instruction).toContain(
      "Do not present a checkpoint to the user and wait if the reviewer has already authorized a non-paid next step.",
    );
  });
});

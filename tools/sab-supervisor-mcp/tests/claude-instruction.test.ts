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
      "Never treat the reviewer as approval for paid or consequential actions.",
    );
    expect(instruction).not.toContain("After calling the reviewer, stop");
  });

  it("does not wait on an authorized non-paid next step", () => {
    expect(instruction).toContain(
      "Do not present a checkpoint to the user and wait if the reviewer has already authorized a non-paid next step.",
    );
  });
});

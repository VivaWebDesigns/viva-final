import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SupervisorConfig } from "../src/config.js";
import {
  registerSopForReview,
  resolveRegisteredSop,
} from "../src/sop-registry.js";

let root: string;
let config: SupervisorConfig;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "sab-sop-registry-"));
  config = {
    codexPath: "codex",
    codexTimeoutMs: 1000,
    maxCodexOutputBytes: 4096,
    logDirectory: root,
    watcher: {
      pollIntervalMs: 1,
      resumeTimeoutMs: 1,
      maxRetries: 1,
      claudeExtensionId: "test",
    },
  };
});
afterEach(async () => fs.rm(root, { recursive: true, force: true }));

const base = {
  source_url: "https://docs.google.com/document/d/private-a",
  document_title_version: "Neutral SOP A",
  drive_revision_id: "revision-1",
  exact_document_text: "Exact private SOP text.\n",
};

describe("private SOP registry", () => {
  it("registers once and reuses the exact same source/revision/content handle", async () => {
    const first = await registerSopForReview(base, config);
    const second = await registerSopForReview(base, config);
    expect(second).toEqual(first);
    const resolved = await resolveRegisteredSop(
      first.registered_sop_handle,
      config,
    );
    expect(resolved.exactText).toBe(base.exact_document_text);
    expect((await fs.stat(first.local_file_path)).mode & 0o777).toBe(0o600);
  });

  it("isolates revisions, content changes, and source identity", async () => {
    const first = await registerSopForReview(base, config);
    const revision = await registerSopForReview(
      { ...base, drive_revision_id: "revision-2" },
      config,
    );
    const content = await registerSopForReview(
      { ...base, exact_document_text: "Changed exact text.\n" },
      config,
    );
    const source = await registerSopForReview(
      { ...base, source_url: "https://docs.google.com/document/d/private-b" },
      config,
    );
    expect(
      new Set([
        first.registered_sop_handle,
        revision.registered_sop_handle,
        content.registered_sop_handle,
        source.registered_sop_handle,
      ]).size,
    ).toBe(4);
  });
});

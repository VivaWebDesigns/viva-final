import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SupervisorConfig } from "../src/config.js";
import { reviewSabScanPlan } from "../src/scan-reviewer.js";
import { registerSopForReview } from "../src/sop-registry.js";
import type {
  CodexExecution,
  ProposedScan,
  ScanReviewDraft,
} from "../src/types.js";

let root: string;
let config: SupervisorConfig;
let handle: string;

const baseScan: ProposedScan = {
  company_name: "Example Company",
  place_id: "neutral-place-id-1",
  scan_role: "deliverable",
  scan_type: "standard",
  source_report_key: null,
  center: { latitude: 40.7128, longitude: -74.006 },
  center_derivation: "Verified business center from durable state",
  sop_routing_rule: "Standard eligible route",
  grid_size: { rows: 7, columns: 7 },
  radius: 5,
  measurement_unit: "miles",
  keyword: "neutral service",
  platform: "google",
  estimated_credits: 49,
  duplicate_report_result: "none",
  prior_history: {
    auxiliary_count: 0,
    deliverable_count: 0,
    recenter_count: 0,
    summary: "No prior scans.",
  },
  save_place_id_required: true,
  eligibility_gate_result: "passed",
  retry_after_ambiguous_submission: false,
  master_run_parameters_changed: false,
  crm_export_included: false,
};

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "sab-scan-review-"));
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
  const registration = await registerSopForReview(
    {
      source_url: "https://docs.google.com/document/d/private-neutral",
      document_title_version: "Neutral Scan SOP",
      drive_revision_id: "rev-1",
      exact_document_text:
        "Eligible standard scans use a verified center and a 7 by 7 grid. One recenter is permitted.\n",
    },
    config,
  );
  handle = registration.registered_sop_handle;
});
afterEach(async () => fs.rm(root, { recursive: true, force: true }));

function execution(draft: ScanReviewDraft): CodexExecution {
  return {
    exitCode: 0,
    stdout: "",
    stderr: "",
    timedOut: false,
    durationMs: 5,
    resultText: JSON.stringify(draft),
    usage: {
      inputTokens: 2000,
      cachedInputTokens: 1500,
      cacheWriteInputTokens: 0,
      outputTokens: 150,
      reasoningOutputTokens: 30,
    },
  };
}

const approve = async () =>
  execution({
    verdict: "scan_approved",
    summary: "Every exact field is mechanically compliant.",
    problems: [],
    instructions_for_claude: "Execute only this authorization.",
    applicable_sop_rule:
      "Eligible standard scans use a verified center and 7 by 7 grid.",
    explicit_exclusions: ["No keyword changes."],
  });

async function review(scan: ProposedScan = baseScan, execute = approve) {
  return reviewSabScanPlan(
    {
      registered_sop_handle: handle,
      durable_run_state: "Verified neutral state.",
      proposed_scans: [scan],
      user_rulings: [],
    },
    {
      config,
      execute,
      authorizationId: () => "11111111-1111-4111-8111-111111111111",
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    },
  );
}

describe("delegated scan review", () => {
  it("approves a compliant exact plan, includes save prerequisite, reconciles credits, and audits it", async () => {
    const result = await review();
    expect(result.verdict).toBe("scan_approved");
    expect(result.authorization?.approved_scans).toEqual([baseScan]);
    expect(result.authorization?.prerequisite_save_location_actions).toEqual([
      {
        action: "saveLocalFalconBusinessLocationToAccount",
        company_name: "Example Company",
        place_id: "neutral-place-id-1",
      },
    ]);
    expect(result.authorization?.total_approved_credits).toBe(49);
    const auditText = await fs.readFile(
      path.join(root, "scan-approvals.jsonl"),
      "utf8",
    );
    const audit = JSON.parse(auditText.trim());
    expect(audit.result.authorization.approved_scans).toEqual([baseScan]);
    expect(audit.result.authorization.total_approved_credits).toBe(49);
    expect(audit).toMatchObject({
      token_usage_available: true,
      input_tokens: 2000,
      cached_input_tokens: 1500,
      output_tokens: 150,
      reasoning_output_tokens: 30,
    });
    expect(auditText).not.toContain("Verified neutral state");
    expect(auditText).not.toContain("One recenter is permitted.");
  });

  it("tells the reviewer that the required save flag is the explicit prerequisite request", async () => {
    let prompt = "";
    await review(baseScan, async (value) => {
      prompt = value;
      return approve();
    });
    expect(prompt).toContain(
      "Treat `save_place_id_required: true` as the explicit request",
    );
    expect(prompt).toContain("do not require a duplicate call-list field");
  });

  it.each([
    ["duplicate", { duplicate_report_result: "equivalent_exists" as const }],
    ["ambiguous retry", { retry_after_ambiguous_submission: true }],
    ["CRM export", { crm_export_included: true }],
    ["eligibility failure", { eligibility_gate_result: "failed" as const }],
    ["changed master parameters", { master_run_parameters_changed: true }],
  ])(
    "requires a user ruling for %s before invoking Codex",
    async (_name, patch) => {
      let invoked = false;
      const result = await review({ ...baseScan, ...patch }, async () => {
        invoked = true;
        return approve();
      });
      expect(result.verdict).toBe("user_ruling_required");
      expect(result.authorization).toBeNull();
      expect(invoked).toBe(false);
    },
  );

  it.each([
    [
      "unsupported center/specification",
      { ...baseScan, center_derivation: "Unsupported guess" },
    ],
    [
      "second unauthorized auxiliary",
      {
        ...baseScan,
        scan_role: "auxiliary",
        prior_history: { ...baseScan.prior_history, auxiliary_count: 1 },
      },
    ],
    [
      "second unauthorized recenter",
      {
        ...baseScan,
        scan_role: "recenter",
        prior_history: { ...baseScan.prior_history, recenter_count: 1 },
      },
    ],
  ])(
    "requires a user ruling when the SOP review finds %s",
    async (_name, scan) => {
      const result = await review(scan, async () =>
        execution({
          verdict: "user_ruling_required",
          summary: "Outside delegated SOP authority.",
          problems: [String(_name)],
          instructions_for_claude: "Stop and ask Matt.",
          applicable_sop_rule:
            "The controlling limit does not permit this proposal.",
          explicit_exclusions: [],
        }),
      );
      expect(result.verdict).toBe("user_ruling_required");
      expect(result.authorization).toBeNull();
    },
  );

  it("keeps SOP and run payloads isolated between scan reviews", async () => {
    const prompts: string[] = [];
    const capture = async (prompt: string) => {
      prompts.push(prompt);
      return approve();
    };
    await reviewSabScanPlan(
      {
        registered_sop_handle: handle,
        durable_run_state: "RUN_ALPHA_ONLY",
        proposed_scans: [baseScan],
        user_rulings: ["RULING_ALPHA_ONLY"],
      },
      { config, execute: capture },
    );
    const second = await registerSopForReview(
      {
        source_url: "https://docs.google.com/document/d/private-second",
        document_title_version: "Second Neutral SOP",
        drive_revision_id: "rev-2",
        exact_document_text: "SECOND_SOP_ONLY\n",
      },
      config,
    );
    await reviewSabScanPlan(
      {
        registered_sop_handle: second.registered_sop_handle,
        durable_run_state: "RUN_BETA_ONLY",
        proposed_scans: [{ ...baseScan, company_name: "Second Example" }],
        user_rulings: [],
      },
      { config, execute: capture },
    );
    expect(prompts[0]).toContain("RUN_ALPHA_ONLY");
    expect(prompts[0]).not.toContain("RUN_BETA_ONLY");
    expect(prompts[1]).toContain("SECOND_SOP_ONLY");
    expect(prompts[1]).toContain("RUN_BETA_ONLY");
    expect(prompts[1]).not.toContain("RUN_ALPHA_ONLY");
    expect(prompts[1]).not.toContain("RULING_ALPHA_ONLY");
  });
});

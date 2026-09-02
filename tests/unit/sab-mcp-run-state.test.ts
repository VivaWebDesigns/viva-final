import { describe, expect, it } from "vitest";
import {
  authorizeSabScanBatch, claimSabRunScan, completeSabRunReports, createSabRunState,
  endSabTestingMode, reconcileSabAmbiguousSubmission, recordSabRunSubmission, sabScanPlanFingerprint,
  pinSabSopRevision, recordSabManifest,
  type SabScanPlan, type SabRunState,
} from "../../server/features/sab-mcp/runState";

const scan: SabScanPlan = {
  place_id: "exact-place", scan_role: "auxiliary", scan_type: "scout",
  center: { latitude: 35, longitude: -80 }, grid_size: 9, radius: 6,
  measurement: "mi", keyword: "service near me", platform: "google", estimated_credits: 81, save_location_required: false,
};
const approved = { approved_by: "Matt" as const, approval_reference: "explicit-user-message" };
const batch = (authorization_id = "first", scans = [scan]) => ({
  authorization_id, orchestrator_id: "codex-owner", authorization_reference: "approved-exact-plan", scans, matt_initial_approval: approved,
});
const run = (credit_limit = 500) => createSabRunState({
  run_id: "run", orchestrator_id: "codex-owner", authorization_reference: "user-run-approval", credit_limit,
});
function completed(state: SabRunState, authorizationId = "first", plan = scan, key = "key") {
  const claimed = claimSabRunScan(state, authorizationId, plan, key);
  const submitted = recordSabRunSubmission(claimed, key, { submission_status: "submitted", report_key: `report-${key}` });
  return completeSabRunReports(submitted, [`report-${key}`]);
}

describe("structured SAB run authorization", () => {
  it("starts testing mode enabled and requires a real run authorization and spending limit", () => {
    expect(run()).toMatchObject({ testing_mode: true, committed_credits: 0, batches: [], public_business_phone_search_authorization: null });
    expect(createSabRunState({ run_id: "phone", orchestrator_id: "owner", authorization_reference: "run", credit_limit: 100,
      public_business_phone_search_authorization: approved })).toMatchObject({ public_business_phone_search_authorization: {
        ...approved, scope: "verified_public_business_phone_exact_search_only",
      } });
    expect(() => createSabRunState({ run_id: "run", orchestrator_id: "owner", authorization_reference: "", credit_limit: 100 })).toThrow(/authorization/);
    expect(() => run(0)).toThrow(/credit/);
    expect(() => authorizeSabScanBatch(run(), { ...batch(), matt_initial_approval: undefined })).toThrow(/Matt/);
    const authorized = authorizeSabScanBatch(run(), batch());
    expect(authorized.batches[0].initial_approval).toMatchObject({
      ...approved, approved_plan_digest: authorized.batches[0].plan_digest,
    });
  });

  it("pins the governing SOP revision and a compact hash-bound manifest expectation",()=>{
    const pinned=pinSabSopRevision(run(),{document_id:"doc",revision_id:"rev-2",title:"SAB SOP"});
    expect(pinned.sop_revision).toMatchObject({document_id:"doc",revision_id:"rev-2",title:"SAB SOP"});
    const manifest=recordSabManifest(pinned,{sha256:"a".repeat(64),batch_id:"batch",built_at:"2026-09-01T20:00:00.000Z",prospects:[{
      place_id:"place",company_name:"Example",contact_tag:"Email Ready",address:"Service Area Business",outcome:"deliverable",report_key:"report",
    }]});
    expect(manifest.latest_manifest).toMatchObject({sha256:"a".repeat(64),batch_id:"batch",prospects:[{place_id:"place",report_key:"report"}]});
    expect(manifest.version).toBe(pinned.version+1);
  });

  it("requires explicit exceptions for scan specifications outside the SOP", () => {
    const unusual = { ...scan, radius: 8 };
    expect(() => authorizeSabScanBatch(run(), batch("unusual", [unusual]))).toThrow(/Matt/);
    expect(authorizeSabScanBatch(run(), {
      ...batch("unusual", [unusual]), exception: { ...approved, reason: "Explicit nonstandard scan authorization" },
    }).batches[0].exception).toMatchObject(approved);
  });

  it("permits one same-center 3-to-5 comparison but prevents unlabelled recenters and repeated comparisons", () => {
    const standard = { ...scan, scan_role: "deliverable" as const, scan_type: "standard" as const, grid_size: 7 as const, radius: 3, estimated_credits: 49 };
    const first = completed(authorizeSabScanBatch(run(), batch("first", [standard])), "first", standard);
    const review = { ...approved, reviewed_batch_id: "first" };
    const comparison = { ...standard, radius: 5 };
    expect(() => authorizeSabScanBatch(first, { ...batch("move", [{ ...standard, center: { latitude: 35.01, longitude: -80 } }]), matt_review: review })).toThrow(/Matt/);
    const next = authorizeSabScanBatch(first, { ...batch("comparison", [comparison]), matt_review: review });
    const done = completed(next, "comparison", comparison, "comparison-key");
    expect(() => authorizeSabScanBatch(done, { ...batch("again", [comparison]), matt_review: { ...approved, reviewed_batch_id: "comparison" } })).toThrow(/Matt/);
  });

  it("binds the normalized envelope independently of object ordering and excludes incidental prose", () => {
    expect(sabScanPlanFingerprint(scan)).toBe(sabScanPlanFingerprint({ ...scan, place_id: " exact-place ", keyword: " service near me " }));
    for (const changed of [{ radius: 5 }, { keyword: "other" }, { place_id: "other" }, { center: { latitude: 35.001, longitude: -80 } }]) {
      expect(sabScanPlanFingerprint({ ...scan, ...changed })).not.toBe(sabScanPlanFingerprint(scan));
    }
  });

  it("only accepts the assigned orchestrator and an exact nonduplicated plan within budget", () => {
    expect(() => authorizeSabScanBatch(run(), { ...batch(), orchestrator_id: "worker" })).toThrow(/orchestrator/);
    expect(() => authorizeSabScanBatch(run(80), batch())).toThrow(/credits/);
    expect(() => authorizeSabScanBatch(run(), batch("first", [scan, scan]))).toThrow(/duplicate/);
    const state = authorizeSabScanBatch(run(), batch());
    expect(() => claimSabRunScan(state, "made-up-uuid", scan, "key")).toThrow(/authorization/);
    expect(() => claimSabRunScan(state, "first", { ...scan, radius: 3 }, "key")).toThrow(/envelope/);
  });

  it("does not authorize the next batch merely because provider submission returned a report key", () => {
    const state = claimSabRunScan(authorizeSabScanBatch(run(), batch()), "first", scan, "key");
    const pending = recordSabRunSubmission(state, "key", { submission_status: "submitted", report_key: "report" });
    expect(pending.batches[0].status).toBe("awaiting_completion");
    expect(() => authorizeSabScanBatch(pending, { ...batch("next"), matt_review: { ...approved, reviewed_batch_id: "first" } })).toThrow(/finish/);
    expect(() => completeSabRunReports(pending, ["unrelated-report"])).toThrow(/match/);
  });

  it("requires Matt review of the completed batch and records approval of the exact next plan", () => {
    const state = completed(authorizeSabScanBatch(run(), batch()));
    expect(state.batches[0].status).toBe("awaiting_review");
    const nextScan = { ...scan, scan_role: "deliverable" as const, scan_type: "standard" as const, grid_size: 7 as const, radius: 3, estimated_credits: 49 };
    expect(() => authorizeSabScanBatch(state, batch("next", [nextScan]))).toThrow(/Matt/);
    expect(() => authorizeSabScanBatch(state, { ...batch("next", [nextScan]), matt_review: { ...approved, reviewed_batch_id: "wrong" } })).toThrow(/immediately/);
    const next = authorizeSabScanBatch(state, { ...batch("next", [nextScan]), matt_review: { ...approved, reviewed_batch_id: "first" } });
    expect(next.batches[1].review).toMatchObject({ ...approved, reviewed_batch_id: "first", approved_plan_digest: next.batches[1].plan_digest });
    expect(() => claimSabRunScan(next, "next", { ...nextScan, radius: 5 }, "next-key")).toThrow(/envelope/);
  });

  it("counts cumulative committed spend and preserves credits after ambiguous submissions", () => {
    const state = completed(authorizeSabScanBatch(run(130), batch()));
    const plan = { ...scan, scan_role: "deliverable" as const, scan_type: "standard" as const, grid_size: 7 as const, radius: 3, estimated_credits: 49 };
    const second = authorizeSabScanBatch(state, { ...batch("second", [plan]), matt_review: { ...approved, reviewed_batch_id: "first" } });
    const claimed = claimSabRunScan(second, "second", plan, "second-key");
    expect(claimed.committed_credits).toBe(130);
    const ambiguous = recordSabRunSubmission(claimed, "second-key", { submission_status: "ambiguous_response", report_key: "possibly-spent" });
    expect(ambiguous.committed_credits).toBe(130);
    expect(ambiguous.batches[1].status).toBe("blocked");
    expect(() => claimSabRunScan(ambiguous, "second", plan, "another-key")).toThrow(/authorization/);
    const recovered=reconcileSabAmbiguousSubmission(ambiguous,{authorization_id:"second",place_id:plan.place_id,report_key:"verified-existing-report"});
    expect(recovered).toMatchObject({committed_credits:130,batches:[{}, {status:"awaiting_completion",scans:[{submission_status:"submitted",report_key:"verified-existing-report",idempotency_key:"second-key"}]}]});
    expect(()=>reconcileSabAmbiguousSubmission(recovered,{authorization_id:"second",place_id:plan.place_id,report_key:"another"})).toThrow(/ambiguous scan claim/);
    expect(() => authorizeSabScanBatch(state, { ...batch("overspend", [scan]), matt_review: { ...approved, reviewed_batch_id: "first" }, exception: { ...approved, reason: "second auxiliary" } })).toThrow(/credits/);
  });

  it("allows one routine recenter but requires a recorded exception for additional auxiliary or recenter attempts", () => {
    const initial = completed(authorizeSabScanBatch(run(), batch()));
    expect(() => authorizeSabScanBatch(initial, { ...batch("second-aux"), matt_review: { ...approved, reviewed_batch_id: "first" } })).toThrow(/Matt/);
    const recenter = { ...scan, scan_role: "deliverable" as const, scan_type: "recenter" as const, grid_size: 7 as const, radius: 3, estimated_credits: 49 };
    const firstRecenter = authorizeSabScanBatch(initial, { ...batch("recenter", [recenter]), matt_review: { ...approved, reviewed_batch_id: "first" } });
    const done = completed(firstRecenter, "recenter", recenter, "recenter-key");
    expect(() => authorizeSabScanBatch(done, { ...batch("extra", [recenter]), matt_review: { ...approved, reviewed_batch_id: "recenter" } })).toThrow(/Matt/);
    const exception = authorizeSabScanBatch(done, { ...batch("extra", [recenter]), matt_review: { ...approved, reviewed_batch_id: "recenter" }, exception: { ...approved, reason: "Explicit additional attempt authorization" } });
    expect(exception.batches[2].exception?.reason).toContain("additional attempt");
  });

  it("ends testing only through an explicit Matt approval and never skips pending completion", () => {
    const authorized = authorizeSabScanBatch(run(), batch());
    expect(() => endSabTestingMode(authorized, { approved_by: "worker" as never, approval_reference: "note" })).toThrow(/Matt/);
    expect(() => endSabTestingMode(authorized, { ...approved, approval_reference: "" })).toThrow(/reference/);
    const off = endSabTestingMode(authorized, approved);
    expect(off.testing_mode).toBe(false);
    expect(() => authorizeSabScanBatch(off, batch("next"))).toThrow(/finish/);
    const done = completed(off);
    expect(done.batches[0].status).toBe("completed");
    expect(authorizeSabScanBatch(done, batch("next", [{ ...scan, place_id: "second-place" }])).batches).toHaveLength(2);
  });

  it("does not close a partly completed multi-company batch or allow a repeated claim", () => {
    const second = { ...scan, place_id: "second-place" };
    const state = authorizeSabScanBatch(run(), batch("first", [scan, second]));
    const one = completed(state);
    expect(one.batches[0].status).toBe("authorized");
    expect(() => claimSabRunScan(one, "first", scan, "different-key")).toThrow(/already claimed/);
    expect(() => authorizeSabScanBatch(one, batch("next"))).toThrow(/finish/);
    const all = completed(one, "first", second, "second-key");
    expect(all.batches[0].status).toBe("awaiting_review");
    expect(all.committed_credits).toBe(162);
  });

  it("blocks other companies too when a process stopped after a durable claim", () => {
    const second = { ...scan, place_id: "second-place" };
    const state = authorizeSabScanBatch(run(), batch("first", [scan, second]));
    const orphanClaim = claimSabRunScan(state, "first", scan, "key");
    expect(() => claimSabRunScan(orphanClaim, "first", second, "second-key")).toThrow(/prior run claim is unresolved/);
    expect(orphanClaim.committed_credits).toBe(81);
  });
});

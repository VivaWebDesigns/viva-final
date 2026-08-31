import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { buildSabRunManifest, type SabExportBatch } from "../../server/features/sab-mcp/exportManifest";
import { SAB_HEADERS } from "../../server/features/sab-mcp/schema";
import type { SabSheetsRepository } from "../../server/features/sab-mcp/sheets";

type Row = Awaited<ReturnType<SabSheetsRepository["getExportCandidates"]>>[number];
const batch: SabExportBatch = {
  batch_id: "whole-run", market: { city: "Test Market", state: "NC" }, trade: "plumbing", keyword: "plumber",
  export_date: "2026-08-31", scan_spec: { grid_size: "7x7", radius_miles: 3 },
};
const key = "abcdef123456789";
const market = {
  kind: "market_reference_only", source: "auxiliary_scan_reverse_geocode", latitude: 35, longitude: -80,
  city: "Test Market", state: "NC", zip: "28000", auxiliary_report_key: "abcdef123456788",
  auxiliary_report_url: "https://www.localfalcon.com/reports/view/abcdef123456788",
};
function deliverable(overrides: Partial<Row> = {}): Row {
  return {
    ...Object.fromEntries(SAB_HEADERS.map((header) => [header, ""])),
    workflow: "scale_first_v2", batch_id: "B01", batch_position: "1", status: "complete", qualification_status: "qualified",
    company: "Test prospect", place_id: "ChIJ-deliverable", address: "Service Area Business", city: "Test Market", state: "NC", zip: "28000",
    phone: "7045550111", owner_name: "", email: "contact@example.com", contact_tag: "Email Ready",
    has_website: false, website: "", website_platform: "", scan_keyword: "plumber", rating: 4.5, review_count: 10,
    report_key: key, report_url: `https://www.localfalcon.com/reports/view/${key}`, scan_date: "2026-08-31",
    arp: "3", solv: "4", scan_center: "35,-80", center_type: "ranked_peak_recentered", outcome: "deliverable",
    scan_spec: { grid_size: "7x7", radius_miles: 5 }, market_reference: null,
    decision_state: { source_report_key: key, rule_id: "S05", evidence_hash: "a".repeat(64), centering_status: "validated",
      outcome: "deliverable", center_type: "ranked_peak_recentered", proposed_center: "35,-80", routine_recenter_count: 0 },
    eligibility_state: { sab_confirmed: true, trade_match: true, franchise_excluded: true, crm_dedup_checked: true, contact_verified: true, evidence_references: ["verified-source"] },
    scan_history: [{ report_key: key, atrp: 20.6, scan_role: "deliverable" }], competitors: [],
    website_analysis: null, reviews_analysis: null, sales_priority: null, service_page_count: null,
    ...overrides,
  } as Row;
}
function crmOnly(overrides: Partial<Row> = {}): Row {
  return deliverable({
    batch_id: "B02", place_id: "ChIJ-crm-only", status: "qa_ready", outcome: "no_visibility_core_found",
    report_key: "", report_url: "", scan_date: "", arp: "", solv: "", scan_center: "", center_type: "", scan_spec: null,
    market_reference: market, scan_history: [{ report_key: market.auxiliary_report_key, atrp: 21, scan_role: "auxiliary" }],
    decision_state: { source_report_key: market.auxiliary_report_key, rule_id: "S03", evidence_hash: "b".repeat(64),
      centering_status: "market_reference_only", outcome: "no_visibility_core_found", evidence: { exact_top20_count: 0 } },
    ...overrides,
  });
}
function build(rows: Row[]) {
  return buildSabRunManifest({ getExportCandidates: vi.fn(async () => rows) }, batch);
}

describe("one consolidated SAB run manifest", () => {
  it("exports all complete and qa_ready rows across execution batches into exactly one mixed batch.json", async () => {
    const rows = [deliverable(), crmOnly(), deliverable({ batch_id: "B04", place_id: "ChIJ-another", report_key: "abcdef123456787",
      decision_state: { ...(deliverable().decision_state as object), source_report_key: "abcdef123456787" },
      scan_spec: { grid_size: "7x7", radius_miles: 3 }, scan_history: [],
    })];
    const result = await build(rows);
    expect(result).toMatchObject({ artifact_name: "batch.json", eligible_count: 3, exported_count: 3,
      from_complete: 2, from_qa_ready: 1, crm_only_count: 1, competitor_sidecar: false,
      import_performed: false, final_import_confirmation_required: true });
    expect(result.sha256).toBe(createHash("sha256").update(result.manifest_json).digest("hex"));
    const manifest = JSON.parse(result.manifest_json);
    expect(Object.keys(manifest).sort()).toEqual(["batch", "prospects", "workflow"]);
    expect(manifest.batch.batch_id).toBe("whole-run");
    expect(manifest.prospects.map((row: any) => row.place_id)).toEqual(rows.map((row) => row.place_id));
    expect(manifest.prospects[0]).toMatchObject({ arp: 3, atrp: 20.6, scan_spec: { grid_size: "7x7", radius_miles: 5 } });
    expect(manifest.prospects[1]).toMatchObject({ outcome: "no_visibility_core_found", market_reference: market });
    for (const forbidden of ["report_key", "report_url", "scan_date", "arp", "atrp", "solv", "scan_center", "scan_spec", "heatmap_file"]) {
      expect(manifest.prospects[1]).not.toHaveProperty(forbidden);
    }
    expect(manifest.prospects[2]).not.toHaveProperty("atrp"); // CRM hydrates authoritative ATRP, never ARP.
    expect(manifest.prospects[0]).not.toHaveProperty("research_notes");
    expect(manifest.prospects[0]).not.toHaveProperty("competitors");
  });

  it("rejects empty, ineligible and exact-Place-ID duplicate populations rather than quietly dropping rows", async () => {
    await expect(build([])).rejects.toThrow(/No eligible/);
    for (const overrides of [{ status: "blocked" }, { workflow: "audit_first_v1_1" }, { qualification_status: "deferred" }]) {
      await expect(build([deliverable(overrides)])).rejects.toThrow(/Ineligible/);
    }
    await expect(build([deliverable(), crmOnly({ place_id: "ChIJ-deliverable" })])).rejects.toThrow(/place_id is duplicated/);
  });

  it.each([null, {}, { grid_size: "9x9", radius_miles: 6 }, { grid_size: "7x7", radius_miles: 2.5 }])(
    "rejects absent or unsupported effective specification %j", async (scan_spec) => {
      await expect(build([deliverable({ scan_spec })])).rejects.toThrow(/effective scan_spec/);
    },
  );

  it.each(["", "35,", ",", "35,-80,12", "91,-80"])("rejects invalid validated coordinates %s", async (scan_center) => {
    await expect(build([deliverable({ scan_center })])).rejects.toThrow();
  });

  it("rejects stale or conflicting decision state, outcomes, and auxiliary center types", async () => {
    for (const decision_state of [null, {}, { ...(deliverable().decision_state as object), centering_status: "planned" },
      { ...(deliverable().decision_state as object), source_report_key: "another-report" },
      { ...(deliverable().decision_state as object), outcome: "deferred" },
      { ...(deliverable().decision_state as object), center_type: "weighted_cell_centroid" }]) {
      await expect(build([deliverable({ decision_state })])).rejects.toThrow(/decision_state/);
    }
    await expect(build([deliverable({ center_type: "master_edge_offset" })])).rejects.toThrow(/decision_state/);
    await expect(build([deliverable({ outcome: "" })])).rejects.toThrow(/explicit/);
    await expect(build([deliverable({ market_reference: market })])).rejects.toThrow(/stale market_reference/);
  });

  it("requires zero exact top-20 auxiliary pins and matching structured market evidence for CRM-only export", async () => {
    for (const decision_state of [
      { ...(crmOnly().decision_state as object), source_report_key: "another-report" },
      { ...(crmOnly().decision_state as object), evidence: { exact_top20_count: 1 } },
      { ...(crmOnly().decision_state as object), evidence: undefined },
      { ...(crmOnly().decision_state as object), centering_status: "validated" },
    ]) await expect(build([crmOnly({ decision_state })])).rejects.toThrow(/zero exact top-20|decision_state/);
    await expect(build([crmOnly({ market_reference: null })])).rejects.toThrow();
    await expect(build([crmOnly({ city: "An inferred business city" })])).rejects.toThrow(/market_reference/);
    await expect(build([crmOnly({ report_key: key })])).rejects.toThrow(/stale report_key/);
  });

  it("fails closed on absent metrics, unknown website status, hidden addresses and incomplete contact routing", async () => {
    await expect(build([deliverable({ eligibility_state: null })])).rejects.toThrow(/eligibility_state/);
    await expect(build([deliverable({ arp: "" })])).rejects.toThrow(/arp/);
    await expect(build([deliverable({ solv: "" })])).rejects.toThrow(/solv/);
    await expect(build([deliverable({ has_website: null })])).rejects.toThrow(/has_website/);
    await expect(build([deliverable({ address: "123 Private Street" })])).rejects.toThrow(/privacy/);
    await expect(build([crmOnly({ email: "" })])).rejects.toThrow(/email/);
    await expect(build([crmOnly({ contact_tag: "Needs Email", email: "", phone: "" })])).rejects.toThrow(/verified phone/);
    await expect(build([crmOnly({ contact_tag: "Needs Email" })])).rejects.toThrow(/null email/);
    const accepted = JSON.parse((await build([crmOnly({ contact_tag: "Needs Email", email: "" })])).manifest_json);
    expect(accepted.prospects[0]).toMatchObject({ contact_tag: "Needs Email", email: null, phone: "7045550111" });
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  createSabWorkflowInputSchema,
  getSabBatchInputSchema,
  SAB_HEADERS,
  SAB_SCALE_FIRST_UPGRADEABLE_HEADERS,
  sabCompanyUpdatesSchema,
  sabScanResultSchema,
  sabWorkflowRowSchema,
} from "../../server/features/sab-mcp/schema";
import {
  GoogleSheetsValuesClient,
  SabSheetsRepository,
  spreadsheetIdFromReference,
  type SheetsValuesClient,
} from "../../server/features/sab-mcp/sheets";
import { z } from "zod";

function columnIndex(name: string) {
  return (
    [...name].reduce(
      (value, character) => value * 26 + character.charCodeAt(0) - 64,
      0,
    ) - 1
  );
}

class FakeSheetsClient implements SheetsValuesClient {
  updates: Array<{ range: string; value: string | number | boolean }> = [];
  columnAppends: Array<{ sheetId: number; columnCount: number }> = [];
  readonly tabs = new Map([
    ["SAB Workflow", { sheetId: 101, columnCount: 0 }],
    ["Other Tab", { sheetId: 202, columnCount: 17 }],
  ]);

  constructor(
    public values: string[][],
    columnCapacity?: number,
  ) {
    this.tabs.get("SAB Workflow")!.columnCount =
      columnCapacity ??
      values.reduce((maximum, row) => Math.max(maximum, row.length), 0);
  }

  async getValues() {
    return this.values.map((row) => [...row]);
  }

  async getSheetGridProperties(_spreadsheetId: string, sheetName: string) {
    const tab = this.tabs.get(sheetName);
    if (!tab) throw new Error(`Unknown fake tab ${sheetName}`);
    return { ...tab };
  }

  async appendColumns(
    _spreadsheetId: string,
    sheetId: number,
    columnCount: number,
  ) {
    if (columnCount <= 0) return;
    const tab = [...this.tabs.values()].find(
      (candidate) => candidate.sheetId === sheetId,
    );
    if (!tab) throw new Error(`Unknown fake sheetId ${sheetId}`);
    this.columnAppends.push({ sheetId, columnCount });
    tab.columnCount += columnCount;
  }

  async updateValues(
    _spreadsheetId: string,
    updates: Array<{ range: string; value: string | number | boolean }>,
  ) {
    this.updates.push(...updates);
    for (const update of updates) {
      const match = update.range.match(/!([A-Z]+)(\d+)$/);
      if (!match) throw new Error(`Unexpected range ${update.range}`);
      const column = columnIndex(match[1]);
      const row = Number(match[2]) - 1;
      const selectedTab = this.tabs.get("SAB Workflow")!;
      if (column >= selectedTab.columnCount) {
        throw new Error(
          `Range (${update.range}) exceeds grid limits. Max columns: ${selectedTab.columnCount}`,
        );
      }
      this.values[row] ??= [];
      this.values[row][column] = String(update.value);
    }
  }
}

function row(
  overrides: Partial<Record<(typeof SAB_HEADERS)[number], string>> = {},
) {
  const defaults: Record<(typeof SAB_HEADERS)[number], string> =
    Object.fromEntries(SAB_HEADERS.map((header) => [header, ""])) as Record<
      (typeof SAB_HEADERS)[number],
      string
    >;

  return SAB_HEADERS.map(
    (header) =>
      ({
        ...defaults,
        batch_id: "B01",
        batch_position: "1",
        status: "assigned",
        company: "Example Plumbing",
        place_id: "place-1",
        address: "Service Area Business",
        city: "Charlotte",
        state: "NC",
        zip: "28202",
        has_website: "TRUE",
        website: "https://example.com",
        service_page_count: "4",
        website_analysis: JSON.stringify([
          "Finding 1",
          "Finding 2",
          "Finding 3",
        ]),
        reviews_analysis: JSON.stringify([
          "Trajectory",
          "Response behavior",
          "Job mix",
        ]),
        qualification_status: "qualified",
        ...overrides,
      })[header],
  );
}

function buildRepository(rows: string[][]) {
  const client = new FakeSheetsClient([Array.from(SAB_HEADERS), ...rows]);
  return {
    client,
    repository: new SabSheetsRepository(client, "sheet-id", "SAB Workflow"),
  };
}

function valuesForHeaders(headers: readonly string[], rows: string[][]) {
  return [
    Array.from(headers),
    ...rows.map((sourceRow) =>
      headers.map(
        (header) =>
          sourceRow[
            SAB_HEADERS.indexOf(header as (typeof SAB_HEADERS)[number])
          ] ?? "",
      ),
    ),
  ];
}

describe("SabSheetsRepository", () => {
  it("protects corroboration evidence and technical holds from generic writes while permitting verified resolution", async () => {
    const source_report_key = "abcdef123456", evidence_hash = "a".repeat(64);
    const failure = { source_report_key, evidence_hash, status: "technical_failure" as const,
      research_complete: true, evidence_references: ["https://example.com/contact"], source_type: "company website",
      identity_method: "exact verified business phone", fit_rationale: "Geocoder unavailable" };
    const decision = { source_report_key, evidence_hash, rule_id: "S01", centering_status: "failed" as const,
      routine_recenter_count: 0, address_corroboration: failure, evidence: { next_action: "address_corroboration_incomplete" } };
    const { repository } = buildRepository([row({ status: "blocked", blocker: "address_corroboration_incomplete", decision_state: JSON.stringify(decision) })]);
    for (const patch of [
      { status: "in_progress" }, { blocker: null }, { decision_state: { ...decision, address_corroboration: undefined } },
      { decision_state: { ...decision, address_corroboration: { ...failure, status: "no_candidate" } } },
      { decision_state: { ...decision, centering_status: "planned", proposed_center: "35,-80", evidence: { next_action: "plan_auxiliary" } } },
    ]) await expect(repository.saveCompany("place-1", sabCompanyUpdatesSchema.parse(patch), "worker@example.com")).rejects.toThrow(/corroboration/);
    await expect(repository.saveCompany("place-1", { phone: "7045550111", decision_state: decision }, "worker@example.com")).resolves.toMatchObject({ status: "blocked" });
    await expect(repository.saveCompany("place-1", { decision_state: { ...decision, address_corroboration: { ...failure, status: "no_candidate" } } }, "actor@example.com", { corroborationRecorded: true })).resolves.toMatchObject({ status: "blocked" });
    const accepted = { ...failure, status: "accepted" as const, candidate_coordinates: { latitude: 35, longitude: -80 },
      geocoder: { location_type: "ROOFTOP", partial_match: false }, distances_miles: { weighted_centroid: 1, nearest_ranked_cell: 0.5, best_rank_cluster_centroid: 1 } };
    await repository.saveCompany("place-1", { decision_state: { ...decision, address_corroboration: accepted } }, "actor@example.com", { corroborationRecorded: true });
    await repository.saveCompany("place-1", { status: "in_progress", blocker: null, decision_state: { ...decision,
      address_corroboration: accepted, centering_status: "planned", proposed_center: "35,-80", evidence: { next_action: "plan_deliverable" } } }, "actor@example.com", { corroborationAnalysisVerified: true });
    expect(await repository.getCompany("place-1")).toMatchObject({ status: "in_progress", blocker: "", decision_state: { address_corroboration: accepted } });
  });

  it("allows an explicitly verified legacy corroboration hash migration and rejects an unverified one", async () => {
    const source_report_key = "abcdef123456", legacyHash = "a".repeat(64), currentHash = "b".repeat(64);
    const failure = { source_report_key, evidence_hash: legacyHash, status: "technical_failure" as const,
      research_complete: true, evidence_references: ["https://example.com/contact"], source_type: "company website",
      identity_method: "exact verified business phone", fit_rationale: "Prior writer failure" };
    const decision = { source_report_key, evidence_hash: legacyHash, rule_id: "S01", centering_status: "failed" as const,
      routine_recenter_count: 0, address_corroboration: failure, evidence: { next_action: "address_corroboration_incomplete" } };
    const migrated = { ...decision, evidence_hash: currentHash, address_corroboration: { ...failure, evidence_hash: currentHash, status: "no_candidate" as const } };
    const { repository } = buildRepository([row({ status: "blocked", blocker: "address_corroboration_incomplete", decision_state: JSON.stringify(decision) })]);
    await expect(repository.saveCompany("place-1", { decision_state: migrated }, "actor@example.com", { corroborationRecorded: true })).rejects.toThrow(/current exact evidence/);
    await expect(repository.saveCompany("place-1", { decision_state: migrated }, "actor@example.com", { corroborationRecorded: true, legacyHashCompatibilityVerified: true })).resolves.toMatchObject({ status: "blocked" });
    expect(await repository.getCompany("place-1")).toMatchObject({ decision_state: { evidence_hash: currentHash, address_corroboration: { evidence_hash: currentHash } } });

    const withoutPriorCorroboration = { ...decision, address_corroboration: undefined };
    const accepted = { ...failure, evidence_hash: currentHash, status: "accepted" as const,
      candidate_coordinates: { latitude: 35, longitude: -80 }, geocoder: { location_type: "ROOFTOP", partial_match: false },
      distances_miles: { weighted_centroid: 1, nearest_ranked_cell: 0.5, best_rank_cluster_centroid: 1 } };
    const migratedWithoutPriorCorroboration = { ...withoutPriorCorroboration, evidence_hash: currentHash, address_corroboration: accepted };
    const { repository: legacyMasterRepository } = buildRepository([row({ decision_state: JSON.stringify(withoutPriorCorroboration) })]);
    await expect(legacyMasterRepository.saveCompany("place-1", { decision_state: migratedWithoutPriorCorroboration }, "actor@example.com",
      { corroborationRecorded: true, legacyHashCompatibilityVerified: true })).resolves.toMatchObject({ place_id: "place-1" });
  });

  it("allows only an explicitly verified post-deliverable S01 recovery transition", async () => {
    const deliverable = "aaaaaaaaaaaa", master = "cccccccccccc", deliverableHash = "a".repeat(64), masterHash = "c".repeat(64);
    const previous = { source_report_key: deliverable, evidence_hash: deliverableHash, rule_id: "S05", centering_status: "failed" as const,
      routine_recenter_count: 0, evidence: { next_action: "evidence_review_required", exact_top20_count: 0 } };
    const noCandidate = { source_report_key: master, evidence_hash: masterHash, status: "no_candidate" as const, research_complete: true,
      evidence_references: ["completed-authorized-search"], source_type: "verified sources", identity_method: "exact identity", fit_rationale: "No candidate" };
    const recovery = { status: "verified", master_report_key: master, master_evidence_hash: masterHash,
      intervening_deliverable_report_key: deliverable, deliverable_evidence_hash: deliverableHash, deliverable_exact_top20_count: 0,
      master_centroid_trustworthy: true, completed_corroboration: "no_candidate" };
    const next = { source_report_key: master, evidence_hash: masterHash, rule_id: "S01", centering_status: "planned" as const,
      proposed_center: "35,-80", center_type: "weighted_cell_centroid" as const, routine_recenter_count: 0, address_corroboration: noCandidate,
      evidence: { next_action: "plan_deliverable", post_deliverable_s01_recovery: recovery } };
    const { repository } = buildRepository([row({ report_key: deliverable, status: "blocked", decision_state: JSON.stringify(previous) })]);
    await expect(repository.saveCompany("place-1", { decision_state: next, status: "in_progress", blocker: null }, "actor@example.com"))
      .rejects.toThrow(/dedicated corroboration/);
    await expect(repository.saveCompany("place-1", { decision_state: { ...next, address_corroboration: { ...noCandidate, status: "rejected" as const } } },
      "actor@example.com", { postDeliverableS01RecoveryVerified: true })).rejects.toThrow(/Post-deliverable S01 recovery/);
    await expect(repository.saveCompany("place-1", { decision_state: next, status: "in_progress", blocker: null }, "actor@example.com",
      { postDeliverableS01RecoveryVerified: true })).resolves.toMatchObject({ status: "in_progress" });
    expect(await repository.getCompany("place-1")).toMatchObject({ status: "in_progress", decision_state: { source_report_key: master,
      address_corroboration: { status: "no_candidate" }, evidence: { post_deliverable_s01_recovery: { status: "verified" } } } });
  });

  it("allows only a verified accepted-candidate post-deliverable auxiliary transition", async () => {
    const deliverable = "aaaaaaaaaaaa", master = "cccccccccccc", deliverableHash = "a".repeat(64), masterHash = "c".repeat(64);
    const accepted = { source_report_key: master, evidence_hash: masterHash, status: "accepted" as const, research_complete: true,
      evidence_references: ["verified-company-source"], source_type: "company-controlled website", identity_method: "exact phone",
      fit_rationale: "Complete distribution fit accepted", candidate_coordinates: { latitude: 35, longitude: -80 },
      geocoder: { location_type: "ROOFTOP", partial_match: false }, distances_miles: { weighted_centroid: 1, nearest_ranked_cell: 0, best_rank_cluster_centroid: 1 } };
    const previous = { source_report_key: deliverable, evidence_hash: deliverableHash, rule_id: "S05", centering_status: "failed" as const,
      routine_recenter_count: 0, address_corroboration: accepted, evidence: { next_action: "evidence_review_required", exact_top20_count: 0 } };
    const recovery = { status: "verified", master_report_key: master, master_evidence_hash: masterHash,
      intervening_deliverable_report_key: deliverable, deliverable_evidence_hash: deliverableHash, deliverable_exact_top20_count: 0,
      accepted_candidate_reused: true, auxiliary_scan_spec: { scan_type: "scout", grid_size: 9, radius: 6, measurement: "mi" } };
    const next = { source_report_key: master, evidence_hash: masterHash, rule_id: "S01,S03", centering_status: "planned" as const,
      proposed_center: "35,-80", center_type: "corroborated_address" as const, routine_recenter_count: 0, address_corroboration: accepted,
      evidence: { next_action: "plan_auxiliary", post_deliverable_accepted_corroboration_recovery: recovery } };
    const { repository } = buildRepository([row({ report_key: deliverable, status: "blocked", decision_state: JSON.stringify(previous) })]);
    await expect(repository.saveCompany("place-1", { decision_state: next, status: "in_progress", blocker: null }, "actor@example.com"))
      .rejects.toThrow(/dedicated corroboration/);
    await expect(repository.saveCompany("place-1", { decision_state: { ...next, proposed_center: "35.1,-80" }, status: "in_progress", blocker: null },
      "actor@example.com", { postDeliverableAcceptedCorroborationRecoveryVerified: true })).rejects.toThrow(/Accepted-candidate recovery/);
    await expect(repository.saveCompany("place-1", { decision_state: next, status: "in_progress", blocker: null }, "actor@example.com",
      { postDeliverableAcceptedCorroborationRecoveryVerified: true })).resolves.toMatchObject({ status: "in_progress" });
  });

  it("guards named canonical evidence exceptions against stale or policy-changing writes", async () => {
    const report="aaaaaaaaaaaa",hash="a".repeat(64),reason="No supported movement exists; accept this report for the named company only.";
    const previous={source_report_key:report,evidence_hash:hash,rule_id:"S04,S05",centering_status:"failed" as const,routine_recenter_count:0,
      evidence:{next_action:"evidence_review_required",reason:"Failed margin with zero movement",margin:{failed:true}}};
    const exception={kind:"canonical_centered_peak_no_movement",scope:"named_run_specific",approved_by:"Matt",approval_reference:"Matt approved exact report",
      reason,report_key:report,evidence_hash:hash,original_next_action:"evidence_review_required",original_reason:previous.evidence.reason,
      approved_at:"2026-09-02T14:00:00.000Z",creates_general_policy:false};
    const next={...previous,centering_status:"validated" as const,proposed_center:"35,-80",center_type:"corroborated_address" as const,outcome:"deliverable" as const,
      evidence:{...previous.evidence,next_action:"center_validated",reason,run_specific_exception:exception,
        center_validation:{report_key:report,evidence_hash:hash,proposed_center:"35,-80",center_type:"corroborated_address"}}};
    const {repository}=buildRepository([row({status:"blocked",blocker:"evidence_review_required",report_key:report,outcome:"deliverable",scan_center:"35,-80",
      center_type:"corroborated_address",decision_state:JSON.stringify(previous)})]);
    await expect(repository.saveCompany("place-1",{decision_state:{...next,evidence:{...next.evidence,run_specific_exception:{...exception,evidence_hash:"b".repeat(64)}}},status:"in_progress",blocker:null},
      "actor@example.com",{runSpecificCanonicalExceptionVerified:true})).rejects.toThrow(/Named canonical exception/);
    await expect(repository.saveCompany("place-1",{decision_state:next,status:"in_progress",blocker:null},"actor@example.com",
      {runSpecificCanonicalExceptionVerified:true})).resolves.toMatchObject({status:"in_progress"});
  });

  it("guards named master-cluster exceptions to the exact approved standard deliverable plan", async () => {
    const report="cccccccccccc",hash="c".repeat(64);
    const corroboration={source_report_key:report,evidence_hash:hash,status:"no_candidate" as const,research_complete:true,
      evidence_references:["completed-search"],source_type:"verified sources",identity_method:"exact phone",fit_rationale:"No candidate"};
    const previous={source_report_key:report,evidence_hash:hash,rule_id:"S01",centering_status:"failed" as const,routine_recenter_count:0,
      address_corroboration:corroboration,evidence:{next_action:"evidence_review_required",reason:"Disconnected clusters"}};
    const exception={kind:"master_singleton_outlier",scope:"named_run_specific",approved_by:"Matt",approval_reference:"Matt approved exact Birkey plan",
      reason:"Treat singleton as an outlier for this company only",report_key:report,evidence_hash:hash,dominant_cluster_size:23,outlier_cluster_size:1,
      outlier_rank:13,approved_center:"34.99,-80.64",approved_at:"2026-09-02T14:00:00.000Z",creates_general_policy:false};
    const next={...previous,centering_status:"planned" as const,proposed_center:"34.99,-80.64",center_type:"weighted_cell_centroid" as const,
      evidence:{...previous.evidence,next_action:"plan_deliverable",reason:exception.reason,run_specific_exception:exception,
        deliverable_scan_spec:{scan_type:"standard",grid_size:7,radius:3,measurement:"mi"}}};
    const {repository}=buildRepository([row({qualification_status:"",status:"blocked",blocker:"disconnected_master_clusters_evidence_review_required",
      scan_center:"",center_type:"",decision_state:JSON.stringify(previous)})]);
    await expect(repository.saveCompany("place-1",{decision_state:{...next,evidence:{...next.evidence,deliverable_scan_spec:{scan_type:"scout",grid_size:9,radius:6,measurement:"mi"}}},
      scan_center:"34.99,-80.64",center_type:"weighted_cell_centroid",status:"in_progress",blocker:null},"actor@example.com",
      {runSpecificMasterClusterExceptionVerified:true})).rejects.toThrow(/Named master-cluster exception/);
    await expect(repository.saveCompany("place-1",{decision_state:next,scan_center:"34.99,-80.64",center_type:"weighted_cell_centroid",status:"in_progress",blocker:null},
      "actor@example.com",{runSpecificMasterClusterExceptionVerified:true})).resolves.toMatchObject({status:"in_progress"});
  });

  it("allows only verified analysis to invalidate stale corroboration and never invent a replacement", async () => {
    const base = { source_report_key: "abcdef123456", evidence_hash: "a".repeat(64), rule_id: "S01", centering_status: "failed" as const, routine_recenter_count: 0,
      evidence: { next_action: "address_corroboration_incomplete" } };
    const address_corroboration = { source_report_key: base.source_report_key, evidence_hash: base.evidence_hash, status: "incomplete" as const,
      research_complete: true, evidence_references: ["https://example.com/contact"], source_type: "website", identity_method: "phone", fit_rationale: "Partial geocode" };
    const { repository } = buildRepository([row({ status: "blocked", blocker: "address_corroboration_incomplete", decision_state: JSON.stringify({ ...base, address_corroboration }) })]);
    await expect(repository.saveCompany("place-1", { decision_state: base }, "actor@example.com", { corroborationAnalysisVerified: true })).rejects.toThrow(/invalidate/);
    await expect(repository.saveCompany("place-1", { decision_state: { ...base, address_corroboration, evidence: { next_action: "plan_auxiliary" } } }, "actor@example.com", { corroborationAnalysisVerified: true })).rejects.toThrow(/paid auxiliary/);
    const changed = { ...base, evidence_hash: "b".repeat(64), evidence: { next_action: "address_corroboration_required" } };
    await repository.saveCompany("place-1", { decision_state: changed }, "actor@example.com", { corroborationAnalysisVerified: true });
    expect((await repository.getCompany("place-1")).decision_state).not.toHaveProperty("address_corroboration");
    await expect(repository.saveCompany("place-1", { decision_state: { ...changed, address_corroboration: { ...address_corroboration, evidence_hash: changed.evidence_hash } } }, "actor@example.com"))
      .rejects.toThrow(/dedicated corroboration/);
  });

  it("round-trips compact enrichment and warns about phone conflicts without overwriting the selected contact", async () => {
    const { repository } = buildRepository([row({ phone: "7045550111" })]);
    const business_profile = { source: "dataforseo_my_business_info_live", place_id: "place-1", phone: "7045550222",
      primary_category: "Plumber", categories: [{ name: "Plumber", id: "plumber" }], service_names: ["Drain repair"], is_claimed: false };
    const receipt = await repository.saveCompany("place-1", sabCompanyUpdatesSchema.parse({ business_profile }), "actor@example.com");
    expect(receipt.business_profile_review_required).toEqual([expect.stringMatching(/phone conflicts/)]);
    expect(await repository.getCompany("place-1")).toMatchObject({ phone: "7045550111", business_profile });
    await expect(repository.saveCompany("place-1", sabCompanyUpdatesSchema.parse({ business_profile: { ...business_profile, place_id: "wrong" } }), "actor@example.com"))
      .rejects.toThrow(/Place ID/);
    const resolved = await repository.saveCompany("place-1", sabCompanyUpdatesSchema.parse({ business_profile: { ...business_profile,
      phone_resolution: { selected_phone: "7045550111", evidence_references: ["https://example.com/contact"] } } }), "actor@example.com");
    expect(resolved.business_profile_review_required).toEqual([]);
  });

  it("accepts ranked-peak centers across both writers and workflow row validation", () => {
    const pair = { scan_center: "34.998114639235,-80.561507914342", center_type: "ranked_peak_recentered" };
    expect(sabCompanyUpdatesSchema.parse(pair)).toEqual(pair);
    expect(sabScanResultSchema.parse({
      ...pair, scan_role: "deliverable", scan_type: "recenter", arp: 17.55, solv: 0,
      report_key: "c6af45b39fd0bfd", report_url: "https://example.com/report",
      scan_date: "2026-08-30", scan_keyword: "deck builder near me",
    })).toMatchObject(pair);
    expect(sabWorkflowRowSchema.parse({
      ...pair, batch_id: "B01", batch_position: 1, company: "Example", place_id: "place-1",
    })).toMatchObject(pair);
    expect(() => sabCompanyUpdatesSchema.parse({ center_type: pair.center_type })).toThrow(/supplied together/);
    expect(() => sabCompanyUpdatesSchema.parse({ ...pair, center_type: null })).toThrow(/both be values or both be null/);
    expect(() => sabCompanyUpdatesSchema.parse({ ...pair, center_type: "deliverable_recentered" })).toThrow();
  });

  it("corrects a stale center type without changing coordinates, metrics, or scan history", async () => {
    const history = [{ report_key: "c6af45b39fd0bfd", center_type: "scout_recentered", notes: "Original record preserved" }];
    const { repository } = buildRepository([row({
      scan_center: "34.998114639235,-80.561507914342", center_type: "scout_recentered",
      report_key: "c6af45b39fd0bfd", arp: "17.55", solv: "0", found_in: "20",
      scan_history: JSON.stringify(history), status: "qa_ready",
      research_notes: "Authorized second recenter to the best-ranked pin (3,2) of completed deliverable f9aa0fea8eccc42. Rank 8. Existing center unchanged.",
    })]);
    const before = await repository.getCompany("place-1");
    await repository.saveCompany("place-1", sabCompanyUpdatesSchema.parse({
      scan_center: before.scan_center, center_type: "ranked_peak_recentered",
      decision_state: { source_report_key: "c6af45b39fd0bfd", rule_id: "S04", evidence_hash: "a".repeat(64), centering_status: "planned", proposed_center: before.scan_center, center_type: "ranked_peak_recentered" },
    }), "matt@vivawebdesigns.com");
    const after = await repository.getCompany("place-1");
    expect(after).toMatchObject({
      ...before, center_type: "ranked_peak_recentered", decision_state: expect.objectContaining({rule_id:"S04"}),
      updated_at: expect.any(String), updated_by: "matt@vivawebdesigns.com",
    });
    expect(after.scan_history).toEqual(history);
  });

  it("preserves a ranked-peak plan when saving its deliverable result", async () => {
    const pair = { scan_center: "34.998114639235,-80.561507914342", center_type: "ranked_peak_recentered" as const };
    const { repository } = buildRepository([row({ ...pair, research_notes: "Completed scan peak selected under Matt's ruling." })]);
    await repository.saveScanResult("place-1", sabScanResultSchema.parse({
      ...pair, scan_role: "deliverable", scan_type: "recenter", arp: 17.55, solv: 0,
      report_key: "c6af45b39fd0bfd", report_url: "https://example.com/report",
      scan_date: "2026-08-30", scan_keyword: "deck builder near me",
    }), "matt@vivawebdesigns.com");
    const saved = await repository.getCompany("place-1");
    expect(saved).toMatchObject(pair);
    expect(saved.scan_history).toEqual([
      expect.objectContaining({ ...pair, record_type: "center_plan", disposition: "confirmed_by_scan" }),
      expect.objectContaining({ ...pair, report_key: "c6af45b39fd0bfd" }),
    ]);
  });

  it("accepts an explicit null qualification status for clearing a premature disposition", () => {
    expect(
      sabCompanyUpdatesSchema.parse({ qualification_status: null }),
    ).toEqual({
      qualification_status: null,
    });
  });

  it("accepts an atomic planned center pair without changing coordinate precision", () => {
    const parsed = sabCompanyUpdatesSchema.parse({
      scan_center: "35.0299948,-80.7058378",
      center_type: "corroborated_address",
    });

    expect(parsed).toEqual({
      scan_center: "35.0299948,-80.7058378",
      center_type: "corroborated_address",
    });
    expect(() =>
      sabCompanyUpdatesSchema.parse({
        scan_center: "35.0299948,-80.7058378",
      }),
    ).toThrow(/must be supplied together/i);
    expect(() =>
      sabCompanyUpdatesSchema.parse({
        scan_center: "95,-80.7058378",
        center_type: "corroborated_address",
      }),
    ).toThrow(/latitude must be between/i);
  });

  it("accepts workflow Sheets by URL or raw spreadsheet ID", () => {
    const spreadsheetId = "1AbCdEfGhIjKlMnOpQrStUvWxYz_1234567890";

    expect(spreadsheetIdFromReference(spreadsheetId)).toBe(spreadsheetId);
    expect(
      spreadsheetIdFromReference(
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0`,
      ),
    ).toBe(spreadsheetId);
    expect(() =>
      spreadsheetIdFromReference(
        `https://docs.google.com/document/d/${spreadsheetId}/edit`,
      ),
    ).toThrow(/Google Sheets spreadsheet ID/);
  });

  it("reads exact tab grid properties and appends columns through authenticated Sheets API calls", async () => {
    const client = new GoogleSheetsValuesClient(
      JSON.stringify({
        installed: {
          client_id: "test-client",
          client_secret: "test-secret",
        },
      }),
      "test-refresh-token",
    );
    const request = vi.fn(
      async (options: {
        url: string;
        method: string;
        params?: Record<string, unknown>;
        data?: Record<string, unknown>;
      }) => {
        if (options.method === "GET") {
          return {
            data: {
              sheets: [
                {
                  properties: {
                    sheetId: 202,
                    title: "Other Tab",
                    gridProperties: { columnCount: 17 },
                  },
                },
                {
                  properties: {
                    sheetId: 101,
                    title: "SAB Workflow",
                    gridProperties: { columnCount: 39 },
                  },
                },
              ],
            },
          };
        }
        return { data: {} };
      },
    );
    (client as unknown as { auth: { request: typeof request } }).auth = {
      request,
    };

    await expect(
      client.getSheetGridProperties("sheet-id", "SAB Workflow"),
    ).resolves.toEqual({
      sheetId: 101,
      columnCount: 39,
    });
    await client.appendColumns("sheet-id", 101, 2);

    expect(request).toHaveBeenNthCalledWith(1, {
      url: "https://sheets.googleapis.com/v4/spreadsheets/sheet-id",
      method: "GET",
      params: {
        includeGridData: false,
        fields: "sheets.properties(sheetId,title,gridProperties)",
      },
    });
    expect(request).toHaveBeenNthCalledWith(2, {
      url: "https://sheets.googleapis.com/v4/spreadsheets/sheet-id:batchUpdate",
      method: "POST",
      data: {
        requests: [
          {
            appendDimension: {
              sheetId: 101,
              dimension: "COLUMNS",
              length: 2,
            },
          },
        ],
      },
    });
  });

  it("requires only core scan fields and rejects competitors", () => {
    const coreScan = {
      scan_role: "deliverable",
      arp: 14.2,
      solv: 31.5,
      report_key: "qualified-report",
      report_url: "https://example.com/qualified-report",
      scan_date: "2026-08-05",
      scan_keyword: "electrician near me",
    };

    expect(sabScanResultSchema.parse(coreScan)).toEqual(coreScan);
    expect(
      sabScanResultSchema.safeParse({
        ...coreScan,
        competitors: ["Competitor One"],
      }).success,
    ).toBe(false);
  });

  it("validates a complete native-workflow creation roster", () => {
    const parsed = z.object(createSabWorkflowInputSchema).parse({
      title: "Charlotte Electricians SAB Workflow",
      companies: [
        {
          batch_id: "B01",
          batch_position: 1,
          company: "Example Electric",
          place_id: "place-1",
          arp: 12.5,
          solv: 18.2,
          found_in: 7,
        },
      ],
    });

    expect(parsed.companies).toHaveLength(1);
    expect(parsed.companies[0].status).toBe("assigned");
  });

  it("creates and progress-validates a populated native Workflow Sheet", async () => {
    const client = new GoogleSheetsValuesClient(
      JSON.stringify({
        installed: {
          client_id: "test-client",
          client_secret: "test-secret",
        },
      }),
      "test-refresh-token",
    );
    let createdValues: Array<Array<string | number | boolean>> = [];
    const request = vi.fn(
      async (options: {
        url: string;
        method: string;
        data?: {
          sheets?: Array<{
            properties?: {
              title?: string;
            };
            data?: Array<{
              rowData?: Array<{
                values?: Array<{
                  userEnteredValue?: Record<string, string | number | boolean>;
                }>;
              }>;
            }>;
          }>;
        };
      }) => {
        if (
          options.url === "https://sheets.googleapis.com/v4/spreadsheets" &&
          options.method === "POST"
        ) {
          createdValues =
            options.data?.sheets?.[0]?.data?.[0]?.rowData?.map(
              (rowData) =>
                rowData.values?.map(
                  (cell) => Object.values(cell.userEnteredValue ?? {})[0] ?? "",
                ) ?? [],
            ) ?? [];
          return {
            data: {
              spreadsheetId: "created-sheet-id",
              spreadsheetUrl:
                "https://docs.google.com/spreadsheets/d/created-sheet-id/edit",
            },
          };
        }
        if (options.url.includes("/values/") && options.method === "GET") {
          return { data: { values: createdValues } };
        }
        throw new Error(`Unexpected request: ${options.method} ${options.url}`);
      },
    );
    (client as unknown as { auth: { request: typeof request } }).auth = {
      request,
    };

    const result = await client.createWorkflow(
      "Charlotte Electricians SAB Workflow",
      [
        {
          batch_id: "B01",
          batch_position: 1,
          status: "assigned",
          company: "Example Electric",
          place_id: "place-1",
          arp: 12.5,
          solv: 18.2,
          found_in: 7,
        },
      ],
      "matt@vivawebdesigns.com",
    );

    expect(result).toEqual({
      workflow_sheet:
        "https://docs.google.com/spreadsheets/d/created-sheet-id/edit",
      spreadsheet_id: "created-sheet-id",
      sheet_name: "SAB Workflow",
      row_count: 1,
      progress: {
        B01: { total: 1, assigned: 1 },
      },
    });
    const createCall = request.mock.calls.find(
      ([options]) =>
        options.url === "https://sheets.googleapis.com/v4/spreadsheets",
    )?.[0];
    expect(createCall?.data?.sheets?.[0]).toMatchObject({
      properties: { title: "SAB Workflow" },
    });
    expect(createdValues[0]).toEqual(Array.from(SAB_HEADERS));
    expect(createdValues[1][SAB_HEADERS.indexOf("company")]).toBe(
      "Example Electric",
    );
  });

  it("allows run-specific batch IDs instead of limiting the connector to B01-B04", () => {
    expect(getSabBatchInputSchema.batch_id.parse("Raleigh-Plumbing-B07")).toBe(
      "Raleigh-Plumbing-B07",
    );
  });

  it("returns only unfinished companies for an assigned batch by default", async () => {
    const { repository } = buildRepository([
      row(),
      row({
        place_id: "place-2",
        company: "Finished Plumbing",
        batch_position: "2",
        status: "complete",
      }),
      row({
        place_id: "place-3",
        company: "Other Batch",
        batch_id: "B02",
      }),
    ]);

    const pending = await repository.getBatch("B01");
    expect(pending.map((company) => company.place_id)).toEqual(["place-1"]);

    const all = await repository.getBatch("B01", true);
    expect(all.map((company) => company.place_id)).toEqual([
      "place-1",
      "place-2",
    ]);
  });

  it("updates only approved company cells and records the actor", async () => {
    const { client, repository } = buildRepository([row()]);

    const result = await repository.saveCompany(
      "place-1",
      {
        owner_name: "Pat Owner",
        email: "pat@example.com",
        reviews_analysis: [
          "Reviews are accelerating",
          "Owner responds consistently",
          "Residential work dominates",
        ],
      },
      "matt@vivawebdesigns.com",
    );

    expect(result.updated_fields).toEqual([
      "owner_name",
      "email",
      "reviews_analysis",
    ]);
    expect(client.updates).toHaveLength(5);
    expect((await repository.getCompany("place-1")).owner_name).toBe(
      "Pat Owner",
    );
    expect((await repository.getCompany("place-1")).updated_by).toBe(
      "matt@vivawebdesigns.com",
    );
  });

  it("stores an evidenced planned center without creating a report or scan history", async () => {
    const { repository } = buildRepository([row({ qualification_status: "" })]);

    await repository.saveCompany(
      "place-1",
      {
        research_notes: "Supporting contact history.",
        decision_state: { source_report_key:"abcdef123456",rule_id:"S01",evidence_hash:"a".repeat(64),centering_status:"planned",routine_recenter_count:0,proposed_center:"35.0299948,-80.7058378",center_type:"corroborated_address" },
        scan_center: "35.0299948,-80.7058378",
        center_type: "corroborated_address",
      },
      "matt@vivawebdesigns.com",
    );

    const company = await repository.getCompany("place-1");
    expect(company.scan_center).toBe("35.0299948,-80.7058378");
    expect(company.center_type).toBe("corroborated_address");
    expect(company.report_key).toBe("");
    expect(company.scan_history).toEqual([]);
  });

  it("rejects a planned center without matching durable evidence", async () => {
    const { client, repository } = buildRepository([
      row({ research_notes: "Contact verified." }),
    ]);

    await expect(
      repository.saveCompany(
        "place-1",
        {
          scan_center: "35.0299948,-80.7058378",
          center_type: "corroborated_address",
        },
        "matt@vivawebdesigns.com",
      ),
    ).rejects.toThrow(/structured decision_state/i);
    expect(client.updates).toEqual([]);
  });

  it("archives a planned center as confirmed when the first deliverable is saved", async () => {
    const { repository } = buildRepository([
      row({
        qualification_status: "",
        research_notes: "§10.4 corroboration PASS with ROOFTOP precision.",
        scan_center: "35.0299948,-80.7058378",
        center_type: "corroborated_address",
        updated_at: "2026-08-26T12:00:00.000Z",
        updated_by: "planner@vivawebdesigns.com",
      }),
    ]);

    const result = await repository.saveScanResult(
      "place-1",
      {
        scan_role: "deliverable",
        arp: 12.5,
        solv: 4.2,
        scan_center: "35.0299948, -80.7058378",
        center_type: "corroborated_address",
        report_key: "deliverable-report",
        report_url: "https://example.com/deliverable-report",
        scan_date: "2026-08-26",
        scan_keyword: "deck builder near me",
      },
      "scanner@vivawebdesigns.com",
    );

    expect(result.scan_history_count).toBe(2);
    const company = await repository.getCompany("place-1");
    expect(company.report_key).toBe("deliverable-report");
    expect(company.scan_history).toEqual([
      expect.objectContaining({
        record_type: "center_plan",
        scan_center: "35.0299948,-80.7058378",
        center_type: "corroborated_address",
        disposition: "confirmed_by_scan",
        resolved_by_report_key: "deliverable-report",
        saved_by: "planner@vivawebdesigns.com",
      }),
      expect.objectContaining({ report_key: "deliverable-report" }),
    ]);
  });

  it("preserves a differing planned center as superseded by the first deliverable", async () => {
    const { repository } = buildRepository([
      row({
        qualification_status: "",
        research_notes: "Trust decision: trustworthy weighted centroid.",
        scan_center: "35.1000000,-80.9000000",
        center_type: "weighted_cell_centroid",
      }),
    ]);

    await repository.saveScanResult(
      "place-1",
      {
        scan_role: "deliverable",
        arp: 10,
        solv: 5,
        scan_center: "35.2000000,-80.8000000",
        center_type: "scout_recentered",
        report_key: "recentered-report",
        report_url: "https://example.com/recentered-report",
        scan_date: "2026-08-26",
        scan_keyword: "deck builder near me",
      },
      "scanner@vivawebdesigns.com",
    );

    const company = await repository.getCompany("place-1");
    expect(company.scan_center).toBe("35.2000000,-80.8000000");
    expect(company.center_type).toBe("scout_recentered");
    expect(company.scan_history).toEqual([
      expect.objectContaining({
        record_type: "center_plan",
        scan_center: "35.1000000,-80.9000000",
        center_type: "weighted_cell_centroid",
        disposition: "superseded_by_scan",
        resolved_by_report_key: "recentered-report",
      }),
      expect.objectContaining({ report_key: "recentered-report" }),
    ]);
  });

  it("expands a legacy Sheet and adds all current structured headers without changing rows or Place IDs", async () => {
    const legacyHeaders = SAB_HEADERS.filter(
      (header) =>
        !SAB_SCALE_FIRST_UPGRADEABLE_HEADERS.includes(
          header as (typeof SAB_SCALE_FIRST_UPGRADEABLE_HEADERS)[number],
        ),
    );
    const client = new FakeSheetsClient(
      valuesForHeaders(legacyHeaders, [
        row({ research_notes: '=CONCAT("kept", " formula")' }),
        row({
          place_id: "place-2",
          company: "Second Plumbing",
          batch_position: "2",
        }),
      ]),
    );
    const originalRows = client.values
      .slice(1)
      .map((sourceRow) => [...sourceRow]);
    const repository = new SabSheetsRepository(
      client,
      "sheet-id",
      "SAB Workflow",
    );

    const result = await repository.upgradeWorkflowSchema();

    expect(result).toMatchObject({
      added_headers: Array.from(SAB_SCALE_FIRST_UPGRADEABLE_HEADERS),
      already_present_headers: [],
      changed: true,
      before_row_count: 2,
      after_row_count: 2,
      before_place_id_count: 2,
      after_place_id_count: 2,
      before_column_capacity: 39,
      after_column_capacity: SAB_HEADERS.length,
      columns_added: SAB_SCALE_FIRST_UPGRADEABLE_HEADERS.length,
      final_header_positions: {
        workflow: { column_number: legacyHeaders.length + 1 },
        contact_tag: { column_number: legacyHeaders.length + 2 },
      },
    });
    expect(result.before_place_id_checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(result.after_place_id_checksum).toBe(
      result.before_place_id_checksum,
    );
    expect(client.columnAppends).toEqual([{ sheetId: 101, columnCount: SAB_SCALE_FIRST_UPGRADEABLE_HEADERS.length }]);
    expect(client.updates.map(({ value }) => value)).toEqual(Array.from(SAB_SCALE_FIRST_UPGRADEABLE_HEADERS));
    expect(client.values.slice(1)).toEqual(originalRows);
  });

  it("expands only as needed and adds the missing header to a partially upgraded Sheet", async () => {
    const partialHeaders = SAB_HEADERS.filter(
      (header) => header !== "contact_tag",
    );
    const client = new FakeSheetsClient(
      valuesForHeaders(partialHeaders, [row()]),
    );
    const repository = new SabSheetsRepository(
      client,
      "sheet-id",
      "SAB Workflow",
    );

    await expect(repository.upgradeWorkflowSchema()).resolves.toMatchObject({
      added_headers: ["contact_tag"],
      already_present_headers: SAB_SCALE_FIRST_UPGRADEABLE_HEADERS.filter(header => header !== "contact_tag"),
      changed: true,
      before_column_capacity: SAB_HEADERS.length - 1,
      after_column_capacity: SAB_HEADERS.length,
      columns_added: 1,
    });
    expect(client.columnAppends).toEqual([{ sheetId: 101, columnCount: 1 }]);
    expect(client.updates.map(({ value }) => value)).toEqual(["contact_tag"]);
  });

  it("uses spare blank columns without resizing", async () => {
    const legacyHeaders = SAB_HEADERS.filter(
      (header) => header !== "workflow" && header !== "contact_tag",
    );
    const client = new FakeSheetsClient(
      valuesForHeaders(legacyHeaders, [row()]),
      50,
    );
    const repository = new SabSheetsRepository(
      client,
      "sheet-id",
      "SAB Workflow",
    );

    await expect(repository.upgradeWorkflowSchema()).resolves.toMatchObject({
      added_headers: ["workflow", "contact_tag"],
      changed: true,
      before_column_capacity: 50,
      after_column_capacity: 50,
      columns_added: 0,
    });
    expect(client.columnAppends).toEqual([]);
    expect(client.updates.map(({ value }) => value)).toEqual([
      "workflow",
      "contact_tag",
    ]);
  });

  it("returns a verified no-op for a current Sheet", async () => {
    const client = new FakeSheetsClient([Array.from(SAB_HEADERS), row()]);
    const repository = new SabSheetsRepository(
      client,
      "sheet-id",
      "SAB Workflow",
    );

    await expect(repository.upgradeWorkflowSchema()).resolves.toMatchObject({
      added_headers: [],
      already_present_headers: Array.from(SAB_SCALE_FIRST_UPGRADEABLE_HEADERS),
      changed: false,
      before_row_count: 1,
      after_row_count: 1,
      before_place_id_count: 1,
      after_place_id_count: 1,
      before_column_capacity: SAB_HEADERS.length,
      after_column_capacity: SAB_HEADERS.length,
      columns_added: 0,
    });
    expect(client.columnAppends).toEqual([]);
    expect(client.updates).toEqual([]);
  });

  it("is safe and idempotent when retrying after capacity was already expanded", async () => {
    const legacyHeaders = SAB_HEADERS.filter(
      (header) => header !== "workflow" && header !== "contact_tag",
    );
    const client = new FakeSheetsClient(
      valuesForHeaders(legacyHeaders, [row()]),
      SAB_HEADERS.length,
    );
    const repository = new SabSheetsRepository(
      client,
      "sheet-id",
      "SAB Workflow",
    );

    await expect(repository.upgradeWorkflowSchema()).resolves.toMatchObject({
      changed: true,
      before_column_capacity: SAB_HEADERS.length,
      after_column_capacity: SAB_HEADERS.length,
      columns_added: 0,
    });
    const updatesAfterFirstRun = [...client.updates];
    await expect(repository.upgradeWorkflowSchema()).resolves.toMatchObject({
      added_headers: [],
      already_present_headers: Array.from(SAB_SCALE_FIRST_UPGRADEABLE_HEADERS),
      changed: false,
    });
    expect(client.columnAppends).toEqual([]);
    expect(client.updates).toEqual(updatesAfterFirstRun);
  });

  it("rejects duplicate, ambiguous, or missing base headers before resizing or writing", async () => {
    const duplicateClient = new FakeSheetsClient([
      [...SAB_HEADERS, "workflow"],
      row(),
    ]);
    const duplicateRepository = new SabSheetsRepository(
      duplicateClient,
      "sheet-id",
      "SAB Workflow",
    );
    await expect(duplicateRepository.upgradeWorkflowSchema()).rejects.toThrow(
      /duplicate headers.*workflow/i,
    );
    expect(duplicateClient.columnAppends).toEqual([]);
    expect(duplicateClient.updates).toEqual([]);

    const ambiguousHeaders = SAB_HEADERS.map((header) =>
      header === "workflow" ? " Workflow " : header,
    );
    const ambiguousClient = new FakeSheetsClient(
      valuesForHeaders(ambiguousHeaders, [row()]),
    );
    const ambiguousRepository = new SabSheetsRepository(
      ambiguousClient,
      "sheet-id",
      "SAB Workflow",
    );
    await expect(ambiguousRepository.upgradeWorkflowSchema()).rejects.toThrow(
      /ambiguous canonical headers/i,
    );
    expect(ambiguousClient.columnAppends).toEqual([]);
    expect(ambiguousClient.updates).toEqual([]);

    const missingBaseHeaders = SAB_HEADERS.filter(
      (header) =>
        header !== "company" &&
        header !== "workflow" &&
        header !== "contact_tag",
    );
    const missingBaseClient = new FakeSheetsClient(
      valuesForHeaders(missingBaseHeaders, [row()]),
    );
    const missingBaseRepository = new SabSheetsRepository(
      missingBaseClient,
      "sheet-id",
      "SAB Workflow",
    );
    await expect(missingBaseRepository.upgradeWorkflowSchema()).rejects.toThrow(
      /legacy\/base required headers.*company/i,
    );
    expect(missingBaseClient.columnAppends).toEqual([]);
    expect(missingBaseClient.updates).toEqual([]);
  });

  it("expands only the selected tab", async () => {
    const legacyHeaders = SAB_HEADERS.filter(
      (header) => header !== "workflow" && header !== "contact_tag",
    );
    const client = new FakeSheetsClient(
      valuesForHeaders(legacyHeaders, [row()]),
    );
    const otherTabBefore = { ...client.tabs.get("Other Tab")! };
    const repository = new SabSheetsRepository(
      client,
      "sheet-id",
      "SAB Workflow",
    );

    await repository.upgradeWorkflowSchema();

    expect(client.columnAppends).toEqual([{ sheetId: 101, columnCount: 2 }]);
    expect(client.tabs.get("SAB Workflow")?.columnCount).toBe(SAB_HEADERS.length);
    expect(client.tabs.get("Other Tab")).toEqual(otherTabBefore);
  });

  it("rejects a missing writable header with upgrade instructions and no malformed range", async () => {
    const legacyHeaders = SAB_HEADERS.filter((header) => header !== "workflow");
    const client = new FakeSheetsClient(
      valuesForHeaders(legacyHeaders, [row()]),
    );
    const repository = new SabSheetsRepository(
      client,
      "sheet-id",
      "SAB Workflow",
    );

    await expect(
      repository.saveCompany(
        "place-1",
        { workflow: "scale_first_v2" },
        "matt@vivawebdesigns.com",
      ),
    ).rejects.toThrow(
      /missing writable header "workflow".*upgrade_sab_workflow_schema/i,
    );
    expect(client.updates).toEqual([]);
  });

  it("adds scan history to legacy Sheets and updates current deliverable fields", async () => {
    const legacyHeaders = SAB_HEADERS.filter(
      (header) => header !== "scan_history",
    );
    const legacyRow = row({
      arp: "22.4",
      solv: "8.7",
      found_in: "6",
      center_type: "weighted_cell_centroid",
      scan_center: "35.1000,-80.9000",
      report_key: "master-report",
      report_url: "https://example.com/master-report",
      scan_date: "2026-08-01",
      scan_keyword: "electrician near me",
    });
    const legacyValues = legacyHeaders.map(
      (header) => legacyRow[SAB_HEADERS.indexOf(header)],
    );
    const client = new FakeSheetsClient(
      [Array.from(legacyHeaders), legacyValues],
      SAB_HEADERS.length,
    );
    const repository = new SabSheetsRepository(
      client,
      "sheet-id",
      "SAB Workflow",
    );

    const result = await repository.saveScanResult(
      "place-1",
      {
        scan_role: "deliverable",
        arp: 14.2,
        solv: 31.5,
        report_key: "qualified-report",
        report_url: "https://example.com/qualified-report",
        scan_date: "2026-08-05",
        scan_keyword: "electrician near me",
        notes: "Centered on a corroborated company address.",
      },
      "matt@vivawebdesigns.com",
    );

    expect(result).toMatchObject({
      current_scan_updated: true,
      scan_history_count: 2,
    });
    const company = await repository.getCompany("place-1");
    expect(company.report_key).toBe("qualified-report");
    expect(company.arp).toBe("14.2");
    expect(company.found_in).toBe("6");
    expect(company.scan_center).toBe("35.1000,-80.9000");
    expect(company.center_type).toBe("weighted_cell_centroid");
    expect(company.scan_history).toEqual([
      expect.objectContaining({
        scan_type: "master",
        report_key: "master-report",
      }),
      expect.objectContaining({
        report_key: "qualified-report",
      }),
    ]);
    expect(company.scan_history).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ competitors: expect.anything() }),
      ]),
    );
  });

  it("retains auxiliary scans without replacing the current deliverable", async () => {
    const { repository } = buildRepository([
      row({
        report_key: "current-deliverable",
        report_url: "https://example.com/current-deliverable",
      }),
    ]);

    const result = await repository.saveScanResult(
      "place-1",
      {
        scan_role: "auxiliary",
        scan_type: "scout",
        arp: 30,
        solv: 10,
        found_in: 4,
        scan_center: "35.3000,-80.7000",
        report_key: "scout-report",
        report_url: "https://example.com/scout-report",
        center_type: "weighted_cell_centroid",
        scan_date: "2026-08-05",
        scan_keyword: "electrician near me",
      },
      "matt@vivawebdesigns.com",
    );

    expect(result.current_scan_updated).toBe(false);
    const company = await repository.getCompany("place-1");
    expect(company.report_key).toBe("current-deliverable");
    expect(company.scan_history).toEqual([
      expect.objectContaining({
        scan_type: "master",
        report_key: "current-deliverable",
      }),
      expect.objectContaining({
        scan_type: "scout",
        report_key: "scout-report",
      }),
    ]);
  });

  it("allows administrative location filler when marking a company complete", async () => {
    const { repository } = buildRepository([
      row({
        address: "",
        zip: "",
      }),
    ]);

    await expect(
      repository.saveCompany(
        "place-1",
        {
          address: "Service Area Business",
          zip: "28202",
          status: "complete",
        },
        "matt@vivawebdesigns.com",
      ),
    ).resolves.toMatchObject({ status: "complete" });
  });

  it("rejects complete status when required audits are missing", async () => {
    const { repository } = buildRepository([
      row({
        reviews_analysis: "",
      }),
    ]);

    await expect(
      repository.saveCompany(
        "place-1",
        { status: "complete" },
        "matt@vivawebdesigns.com",
      ),
    ).rejects.toThrow(/reviews_analysis/);
  });

  it("allows Scale-First qa_ready without Audit-First audit fields", async () => {
    const { repository } = buildRepository([
      row({
        workflow: "scale_first_v2",
        contact_tag: "Email Ready",
        email: "owner@example.com",
        outcome: "deliverable", scan_center:"35,-80",center_type:"weighted_cell_centroid",
        scan_spec: JSON.stringify({grid_size:"7x7",radius_miles:3}),
        decision_state: JSON.stringify({source_report_key:"abcdef123456",rule_id:"S05",evidence_hash:"a".repeat(64),centering_status:"validated",outcome:"deliverable",proposed_center:"35,-80",center_type:"weighted_cell_centroid"}),
        eligibility_state: JSON.stringify({sab_confirmed:true,trade_match:true,franchise_excluded:true,crm_dedup_checked:true,contact_verified:true,evidence_references:["verification-receipt"],contact_research:{"exact_name_search":{"status":"completed","sources_inspected":["google:exact-name-email"]},"exact_phone_fallback":{"status":"not_required_verified_earlier","sources_inspected":[]},"company_controlled_inspection":{"status":"not_required_verified_earlier","sources_inspected":[]},"accepted_evidence":[{"email":"owner@example.com","verification_gate":"website domain","sources":["https://example.com/contact"]}],"rejected_candidates":[],"result":"verified_email","completed_at":"2026-08-31T20:00:00.000Z","exhaustion_completed_at":null,"no_unverified_email_retained":true,"orchestrator_reconciled":true}}),
        arp: "12.5",
        solv: "18.2",
        report_key: "abcdef123456",
        report_url: "https://localrankingtracker.com/report/public-id",
        scan_date: "2026-08-25",
        scan_keyword: "plumber near me",
        rating: "4.8",
        review_count: "42",
        service_page_count: "",
        website_analysis: "",
        reviews_analysis: "",
        sales_priority: "",
        sales_priority_reason: "",
      }),
    ]);

    await expect(
      repository.saveCompany(
        "place-1",
        { status: "qa_ready" },
        "matt@vivawebdesigns.com",
      ),
    ).resolves.toMatchObject({ status: "qa_ready" });
  });

  it("enforces Scale-First contact, scan, and address privacy at qa_ready", async () => {
    const { repository } = buildRepository([
      row({
        workflow: "scale_first_v2",
        contact_tag: "Email Ready",
        email: "",
        address: "6226 Wild Meadow Trl",
        arp: "12.5",
        solv: "18.2",
        report_key: "",
        report_url: "https://localrankingtracker.com/report/public-id",
        scan_date: "2026-08-25",
        scan_keyword: "plumber near me",
        rating: "4.8",
        review_count: "42",
      }),
    ]);

    await expect(
      repository.saveCompany(
        "place-1",
        { status: "qa_ready" },
        "matt@vivawebdesigns.com",
      ),
    ).rejects.toThrow(
      /address.*Service Area Business|email.*Email Ready|report_key/i,
    );
  });

  it("rejects complete status until a final qualification disposition is set", async () => {
    const { repository } = buildRepository([
      row({
        qualification_status: "",
      }),
    ]);

    await expect(
      repository.saveCompany(
        "place-1",
        { status: "complete" },
        "matt@vivawebdesigns.com",
      ),
    ).rejects.toThrow(/qualification_status/);
  });

  it("clears a premature qualification disposition without changing in-progress status", async () => {
    const { client, repository } = buildRepository([
      row({
        status: "in_progress",
        qualification_status: "qualified",
      }),
    ]);

    await expect(
      repository.saveCompany(
        "place-1",
        { qualification_status: null },
        "matt@vivawebdesigns.com",
      ),
    ).resolves.toMatchObject({
      status: "in_progress",
      updated_fields: ["qualification_status"],
    });

    expect(client.values[1][SAB_HEADERS.indexOf("qualification_status")]).toBe(
      "",
    );
    expect(client.updates).toContainEqual(
      expect.objectContaining({
        range: expect.stringMatching(/![A-Z]+2$/),
        value: "",
      }),
    );
  });

  it("does not allow pre-scan eligibility to be promoted to final qualification before an outcome",async()=>{
    const eligibility={sab_confirmed:true,trade_match:true,franchise_excluded:true,crm_dedup_checked:true,contact_verified:true,evidence_references:["verified-prescan-evidence"]};
    const {repository}=buildRepository([row({workflow:"scale_first_v2",status:"in_progress",qualification_status:"",eligibility_state:JSON.stringify(eligibility),outcome:"",decision_state:"",report_key:""})]);
    await expect(repository.saveCompany("place-1",{qualification_status:"qualified"},"actor@example.com")).rejects.toThrow(/validated canonical report|completed no-visibility auxiliary evidence/);
    expect((await repository.getCompany("place-1")).qualification_status).toBe("");
  });

  it("allows a fully audited disqualified company to close without CRM location filler", async () => {
    const { repository } = buildRepository([
      row({
        address: "",
        city: "",
        state: "",
        zip: "",
        qualification_status: "disqualified",
        research_notes:
          "Review activity is outside the allowed recency window.",
      }),
    ]);

    await expect(
      repository.saveCompany(
        "place-1",
        { status: "complete" },
        "matt@vivawebdesigns.com",
      ),
    ).resolves.toMatchObject({ status: "complete" });
  });

  it("allows a reasoned manual disqualification to close without unfinished audits", async () => {
    const { repository } = buildRepository([
      row({
        has_website: "",
        website: "",
        service_page_count: "",
        website_analysis: "",
        reviews_analysis: "",
        qualification_status: "disqualified",
        qualification_reason: "primary_category_trade_mismatch",
        research_notes: "Supporting history.",
      }),
    ]);

    await expect(
      repository.saveCompany(
        "place-1",
        { status: "complete" },
        "matt@vivawebdesigns.com",
      ),
    ).resolves.toMatchObject({ status: "complete" });
  });

  it("allows a reasoned Scale-First disqualification to close without qa_ready fields", async () => {
    const { repository } = buildRepository([
      row({
        workflow: "scale_first_v2",
        city: "",
        state: "",
        zip: "",
        report_key: "",
        report_url: "",
        scan_date: "",
        scan_keyword: "",
        arp: "",
        solv: "",
        contact_tag: "",
        qualification_status: "disqualified",
        qualification_reason: "primary_category_trade_mismatch",
        research_notes: "Supporting history.",
      }),
    ]);

    await expect(
      repository.saveCompany(
        "place-1",
        { status: "complete" },
        "matt@vivawebdesigns.com",
      ),
    ).resolves.toMatchObject({ status: "complete" });
  });

  it("does not allow a Scale-First disqualification to enter qa_ready", async () => {
    const { repository } = buildRepository([
      row({
        workflow: "scale_first_v2",
        qualification_status: "disqualified",
        qualification_reason: "primary_category_trade_mismatch",
        research_notes: "Supporting history.",
      }),
    ]);

    await expect(
      repository.saveCompany(
        "place-1",
        { status: "qa_ready" },
        "matt@vivawebdesigns.com",
      ),
    ).rejects.toThrow(/qualification_status \(must be qualified\)/);
  });

  it("requires a reason before a manual disqualification can skip unfinished audits", async () => {
    const { repository } = buildRepository([
      row({
        website_analysis: "",
        reviews_analysis: "",
        qualification_status: "disqualified",
        research_notes: "",
      }),
    ]);

    await expect(
      repository.saveCompany(
        "place-1",
        { status: "complete" },
        "matt@vivawebdesigns.com",
      ),
    ).rejects.toThrow(/qualification reason/);
  });

  it("requires a reason when a company is disqualified or deferred", async () => {
    const { repository } = buildRepository([
      row({
        qualification_status: "deferred",
        research_notes: "",
      }),
    ]);

    await expect(
      repository.saveCompany(
        "place-1",
        { status: "complete" },
        "matt@vivawebdesigns.com",
      ),
    ).rejects.toThrow(/qualification reason/);
  });

  it("reconciles verified auxiliary history without changing rows or Place IDs", async () => {
    const falseAssociation = JSON.stringify([
      {
        scan_role: "auxiliary",
        scan_type: "scout",
        report_key: "c855cd48e82a5c4",
      },
    ]);
    const { client, repository } = buildRepository([
      row({
        place_id: "kj-place",
        company: "KJ",
        scan_history: falseAssociation,
      }),
      row({ place_id: "vivid-place", company: "Vivid", batch_position: "2" }),
    ]);
    const actual = {
      scan_center: "35.1,-80.9",
      grid_size: 9,
      radius: 6,
      measurement: "mi",
      keyword: "deck builder near me",
      found_in: 12,
      arp: 9.1,
      solv: 4.2,
      scan_date: "2026-08-26",
      report_url: "https://www.localfalcon.com/reports/view/c855cd48e82a5c4",
    };
    const verified = {
      report_key: "c855cd48e82a5c4",
      expected_place_id: "vivid-place",
      disposition: "attach_verified_auxiliary" as const,
      remove_from_place_ids: ["kj-place"],
      authorization_id: "e8f20e3a-5422-4fdf-a34b-21860cfbe6df",
      reason: "Correct the provider association.",
      expected: {
        scan_role: "auxiliary" as const,
        scan_type: "scout" as const,
        scan_center: "35.1,-80.9",
        grid_size: 9 as const,
        radius: 6,
        measurement: "mi" as const,
        keyword: "deck builder near me",
        platform: "google" as const,
      },
      actual,
      reconciliation_id: "repair-vivid",
    };

    const result = await repository.reconcileScanHistory(
      [verified],
      "matt@vivawebdesigns.com",
    );
    expect(result).toMatchObject({
      row_count_before: 2,
      row_count_after: 2,
      writes_performed: true,
    });
    expect(result.place_id_checksum_before).toBe(
      result.place_id_checksum_after,
    );
    const historyColumn = SAB_HEADERS.indexOf("scan_history");
    const kjHistory = JSON.parse(client.values[1][historyColumn]);
    const vividHistory = JSON.parse(client.values[2][historyColumn]);
    expect(kjHistory).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ report_key: "c855cd48e82a5c4" }),
      ]),
    );
    expect(kjHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "removed_false_association" }),
      ]),
    );
    expect(vividHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ report_key: "c855cd48e82a5c4" }),
        expect.objectContaining({ action: "attached_verified_auxiliary" }),
      ]),
    );

    const second = await repository.reconcileScanHistory(
      [verified],
      "matt@vivawebdesigns.com",
    );
    expect(second.writes_performed).toBe(false);
  });

  it("prevents a voided excess report from being saved later", async () => {
    const history = JSON.stringify([
      {
        record_type: "scan_reconciliation",
        disposition: "void_excess_duplicate",
        voided_report_key: "ece4b056cb33be8",
      },
    ]);
    const { repository } = buildRepository([row({ scan_history: history })]);

    await expect(
      repository.saveScanResult(
        "place-1",
        {
          scan_role: "auxiliary",
          scan_type: "scout",
          arp: null,
          solv: null,
          report_key: "ece4b056cb33be8",
          report_url:
            "https://www.localfalcon.com/reports/view/ece4b056cb33be8",
          scan_date: null,
          scan_keyword: "deck builder near me",
        },
        "matt@vivawebdesigns.com",
      ),
    ).rejects.toThrow("excess duplicate");
  });

  it("rejects a changed scan envelope under the same authorization", async () => {
    const { repository } = buildRepository([row()]);
    const reservation = {
      idempotency_key: "exact-envelope",
      authorization_id: "e8f20e3a-5422-4fdf-a34b-21860cfbe6df",
      company_name: "Example Plumbing",
      place_id: "place-1",
      scan_role: "auxiliary" as const,
      scan_type: "scout" as const,
      scan_center: "35.1,-80.9",
      grid_size: 9 as const,
      radius: 6,
      measurement: "mi" as const,
      keyword: "deck builder near me",
      platform: "google" as const,
      estimated_credits: 81,
      center_derivation: "Westward scout",
      sop_routing_rule: "SOP section 10.5",
    };
    await repository.reserveScanSubmission(
      reservation,
      "matt@vivawebdesigns.com",
    );

    await expect(
      repository.reserveScanSubmission(
        {
          ...reservation,
          idempotency_key: "changed-envelope",
          radius: 5,
        },
        "matt@vivawebdesigns.com",
      ),
    ).rejects.toThrow(
      "changed parameters require a new orchestrator batch authorization",
    );
  });

  it("reports progress by batch and status", async () => {
    const { repository } = buildRepository([
      row(),
      row({ place_id: "place-2", batch_position: "2", status: "complete" }),
      row({ place_id: "place-3", batch_id: "B02", status: "blocked" }),
    ]);

    await expect(repository.getProgress()).resolves.toEqual({
      B01: { total: 2, assigned: 1, complete: 1 },
      B02: { total: 1, blocked: 1 },
    });
  });
});

class FakeRunStateSheetsClient extends FakeSheetsClient {
  stateValues: string[][] | null = null;
  stateSheetCreates = 0;
  async ensureStateSheet() {
    if (!this.stateValues) { this.stateValues = []; this.stateSheetCreates++; }
  }
  override async getValues(_spreadsheetId?: string, range?: string) {
    if (range?.includes("SAB Workflow Run State")) {
      if (!this.stateValues) throw new Error("Unknown fake tab SAB Workflow Run State");
      return this.stateValues.map(value => [...value]);
    }
    return super.getValues();
  }
  override async updateValues(spreadsheetId: string, updates: Array<{ range: string; value: string | number | boolean }>) {
    const workflowUpdates = updates.filter(update => !update.range.includes("SAB Workflow Run State"));
    if (workflowUpdates.length) await super.updateValues(spreadsheetId, workflowUpdates);
    for (const update of updates.filter(update => update.range.includes("SAB Workflow Run State"))) {
      const match = update.range.match(/!([A-Z]+)(\d+)$/)!;
      if (!this.stateValues) throw new Error("State sheet must exist before writing");
      const rowIndex = Number(match[2]) - 1;
      this.stateValues[rowIndex] ??= [];
      this.stateValues[rowIndex][columnIndex(match[1])] = String(update.value);
      this.updates.push(update);
    }
  }
}

const initialStoredRun = () => ({
  schema_version: 1 as const, version: 1, run_id: "run-1", orchestrator_id: "codex-orchestrator",
  authorization_reference: "User approved this bounded run", testing_mode: true, testing_ended: null,
  credit_limit: 200, committed_credits: 0, batches: [],
});
function runStorage() {
  const client = new FakeRunStateSheetsClient([Array.from(SAB_HEADERS)]);
  return { client, repository: new SabSheetsRepository(client, "sheet-id", "SAB Workflow") };
}

describe("SAB durable run-state sheet storage", () => {
  it("does not create state or assume authorization during an uninitialized read", async () => {
    const { client, repository } = runStorage();
    await expect(repository.getRunState("run-1")).resolves.toBeNull();
    await expect(repository.assertOneActiveRun("run-1")).resolves.toBeUndefined();
    expect(client.stateSheetCreates).toBe(0);
    expect(client.updates).toEqual([]);
  });

  it("round-trips multiple chunks and clears obsolete chunks when state shrinks", async () => {
    const { client, repository } = runStorage();
    const state = { ...initialStoredRun(), authorization_reference: "verified authorization history\n".repeat(4000) };
    await repository.saveRunState(state, null, "actor@example.com");
    expect(client.stateValues!.length).toBeGreaterThan(2);
    expect(client.stateValues!.every(chunk => chunk[3].length <= 40000)).toBe(true);
    await expect(repository.getRunState(state.run_id)).resolves.toEqual(state);
    const next = { ...initialStoredRun(), version: 2, committed_credits: 49 };
    await repository.saveRunState(next, 1, "actor@example.com");
    await expect(repository.getRunState(state.run_id)).resolves.toEqual(next);
    expect(client.stateValues!.filter(chunk => chunk[0])).toHaveLength(1);
    expect(client.stateValues!.slice(1).every(chunk => chunk.every(value => value === ""))).toBe(true);
  });

  it.each(["missing_middle", "missing_tail", "duplicate_index", "nonnumeric_index", "corrupt_json"])("fails closed on %s chunk corruption", async corruption => {
    const { client, repository } = runStorage();
    await repository.saveRunState({ ...initialStoredRun(), authorization_reference: "x".repeat(90000) }, null, "actor@example.com");
    if (corruption === "missing_middle") client.stateValues!.splice(1, 1);
    if (corruption === "missing_tail") client.stateValues!.pop();
    if (corruption === "duplicate_index") client.stateValues![1][2] = "0";
    if (corruption === "nonnumeric_index") client.stateValues![1][2] = "invalid";
    if (corruption === "corrupt_json") client.stateValues![0][3] = "not-json";
    await expect(repository.getRunState("run-1")).rejects.toThrow();
  });

  it.each([
    { run_id: "other-run" }, { version: 2 }, { schema_version: 2 },
  ])("rejects mismatched stored identity/version: %j", async invalid => {
    const { client, repository } = runStorage();
    client.stateValues = [["run-1", "1", "0", JSON.stringify({ ...initialStoredRun(), ...invalid }), "actor@example.com"]];
    await expect(repository.getRunState("run-1")).rejects.toThrow("identity/version mismatch");
  });

  it("does not fall back to an older authorization after a partial newer write", async () => {
    const { client, repository } = runStorage();
    client.stateValues = [
      ["run-1", "1", "0", JSON.stringify(initialStoredRun()), "actor@example.com"],
      ["run-1", "2", "1", '{"run_id":"run-1"', "actor@example.com"],
    ];
    await expect(repository.getRunState("run-1")).rejects.toThrow("chunks are incomplete");
  });

  it("rejects stale expected versions without overwriting the persisted approval state", async () => {
    const { client, repository } = runStorage();
    const state = initialStoredRun();
    await repository.saveRunState(state, null, "actor@example.com");
    const written = client.updates.length;
    await expect(repository.saveRunState({ ...state, version: 2, testing_mode: false }, null, "actor@example.com")).rejects.toThrow("Run state changed");
    expect(client.updates).toHaveLength(written);
    await expect(repository.getRunState("run-1")).resolves.toEqual(state);
  });

  it("allows the same authoritative run but rejects a second run on that sheet", async () => {
    const { repository } = runStorage();
    await repository.saveRunState(initialStoredRun(), null, "actor@example.com");
    await expect(repository.assertOneActiveRun("run-1")).resolves.toBeUndefined();
    await expect(repository.assertOneActiveRun("run-2")).rejects.toThrow("another run");
    await expect(repository.saveRunState({ ...initialStoredRun(), run_id: "run-2" }, null, "actor@example.com")).rejects.toThrow("another run");
  });
});

const crmOnlyDecision = () => ({
  source_report_key: "abcdef123456", rule_id: "S03", evidence_hash: "a".repeat(64),
  centering_status: "market_reference_only", outcome: "no_visibility_core_found", evidence: { exact_top20_count: 0 },
});
const crmOnlyMarket = () => ({
  kind: "market_reference_only", source: "auxiliary_scan_reverse_geocode", latitude: 35, longitude: -80,
  city: "Charlotte", state: "NC", zip: "28202", auxiliary_report_key: "abcdef123456",
  auxiliary_report_url: "https://localrankingtracker.com/scan-report/abcdef123456/public/",
});
function crmOnlyRow(overrides: Parameters<typeof row>[0] = {}) {
  return row({
    workflow: "scale_first_v2", outcome: "no_visibility_core_found", scan_keyword: "plumber near me",
    contact_tag: "Needs Email", phone: "+17045550123", email: "", rating: "4.8", review_count: "42",
    report_key: "", report_url: "", scan_date: "", arp: "", solv: "", scan_center: "", center_type: "", scan_spec: "",
    decision_state: JSON.stringify(crmOnlyDecision()), market_reference: JSON.stringify(crmOnlyMarket()),
    eligibility_state: JSON.stringify({ sab_confirmed: true, trade_match: true, franchise_excluded: true, crm_dedup_checked: true, contact_verified: true, evidence_references: ["verified-source-receipt"], contact_research: {"exact_name_search":{"status":"completed","sources_inspected":["google:exact-name-email"]},"exact_phone_fallback":{"status":"completed","sources_inspected":["google:exact-public-business-phone"]},"company_controlled_inspection":{"status":"completed","sources_inspected":["https://example.com/contact"]},"accepted_evidence":[],"rejected_candidates":[],"result":"exhausted","completed_at":"2026-08-31T20:00:00.000Z","exhaustion_completed_at":"2026-08-31T20:00:00.000Z","no_unverified_email_retained":true,"orchestrator_reconciled":true} }),
    ...overrides,
  });
}

describe("SAB scan-history receipts and CRM-only QA", () => {
  it("preserves a submission receipt when the result shares its report key, including repeated history-only saves", async () => {
    const receipt = { record_type: "scan_submission", idempotency_key: "durable-idempotency-key", authorization_id: "authorized-batch", report_key: "abcdef123456", submission_status: "submitted", submitted_at: "2026-08-31T10:00:00Z" };
    const { repository } = buildRepository([row({ scan_history: JSON.stringify([receipt]), report_key: "abcdef111111", report_url: "https://localrankingtracker.com/existing/", scan_center: "35,-80", center_type: "weighted_cell_centroid", arp: "6", solv: "15" })]);
    const result = sabScanResultSchema.parse({ scan_role: "deliverable", scan_type: "recenter", scan_center: "35.1,-80.1", center_type: "ranked_peak_recentered", arp: 9, solv: 10, report_key: "abcdef123456", report_url: "https://localrankingtracker.com/new/", scan_date: "2026-08-31", scan_keyword: "plumber near me" });
    for (let attempt = 0; attempt < 2; attempt++) await repository.saveScanResult("place-1", result, "actor@example.com", { historyOnly: true });
    const saved = await repository.getCompany("place-1");
    expect(saved.scan_history).toHaveLength(2);
    expect(saved.scan_history).toContainEqual(receipt);
    expect(await repository.getScanSubmission("place-1", "durable-idempotency-key")).toEqual(receipt);
    expect(saved).toMatchObject({ report_key: "abcdef111111", report_url: "https://localrankingtracker.com/existing/", scan_center: "35,-80", center_type: "weighted_cell_centroid", arp: "6", solv: "15" });
  });

  it.each(["qa_ready", "complete"] as const)("accepts qualified no-visibility leads at %s with a labelled market reference and no canonical business report", async status => {
    const { repository } = buildRepository([crmOnlyRow()]);
    await expect(repository.saveCompany("place-1", { status }, "actor@example.com")).resolves.toMatchObject({ status });
    const saved = await repository.getCompany("place-1");
    expect(saved).toMatchObject({ outcome: "no_visibility_core_found", report_key: "", scan_center: "", market_reference: crmOnlyMarket() });
  });

  it.each([undefined, null, "0", 1, 20])("rejects no-visibility claims without numeric zero exact top20 proof (%s)", async count => {
    const { repository } = buildRepository([crmOnlyRow({ decision_state: JSON.stringify({ ...crmOnlyDecision(), evidence: { exact_top20_count: count } }) })]);
    await expect(repository.saveCompany("place-1", { status: "qa_ready" }, "actor@example.com")).rejects.toThrow("no-visibility auxiliary evidence required");
  });

  it.each(["report_key", "report_url", "scan_date", "arp", "solv", "scan_center", "center_type", "scan_spec"] as const)("rejects a fabricated canonical %s on a CRM-only lead", async header => {
    const values = { report_key: "abcdef123456", report_url: "https://localrankingtracker.com/fabricated/", scan_date: "2026-08-31", arp: "21", solv: "0", scan_center: "35,-80", center_type: "auxiliary_centroid", scan_spec: JSON.stringify({ grid_size: "7x7", radius_miles: 3 }) };
    const { repository } = buildRepository([crmOnlyRow({ [header]: values[header] })]);
    await expect(repository.saveCompany("place-1", { status: "qa_ready" }, "actor@example.com")).rejects.toThrow(`${header} (must be empty`);
  });

  it("rejects a fabricated validated decision center even when canonical cells are empty", async () => {
    const { repository } = buildRepository([crmOnlyRow({ decision_state: JSON.stringify({ ...crmOnlyDecision(), centering_status: "validated", proposed_center: "35,-80", center_type: "weighted_cell_centroid" }) })]);
    await expect(repository.saveCompany("place-1", { status: "qa_ready" }, "actor@example.com")).rejects.toThrow("no-visibility auxiliary evidence required");
  });

  it("rejects a market reference from a different auxiliary or a mismatched market location", async () => {
    for (const override of [
      { market_reference: JSON.stringify({ ...crmOnlyMarket(), auxiliary_report_key: "abcdef999999" }) },
      { city: "Different city" },
    ]) {
      const { repository } = buildRepository([crmOnlyRow(override)]);
      await expect(repository.saveCompany("place-1", { status: "qa_ready" }, "actor@example.com")).rejects.toThrow();
    }
  });
});

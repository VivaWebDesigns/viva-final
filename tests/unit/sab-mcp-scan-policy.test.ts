import { describe, expect, it } from "vitest";
import { analyzeSabScanPolicy, evaluateSabCoherentMargin, offsetSabCenter, selectSabCanonicalScan, selectSabPeakTarget, summarizeSabMasterEvidence, summarizeSabAllPointRanks, type SabScanGrid } from "../../server/features/sab-mcp/scanPolicy";
import type { SabAddressCorroboration } from "../../server/features/sab-mcp/addressCorroboration";
import type { SabRankedCell } from "../../server/features/sab-mcp/localFalconRankedCells";

const grid = (size = 7, radius = 3): SabScanGrid => ({ size, radius, point_count: size ** 2, center: { latitude: 0, longitude: 0 }, measurement: "mi" });
const cell = (row: number, column: number, rank: number, size = 7, radius = 3): SabRankedCell => ({ row, column, rank, latitude: ((size + 1) / 2 - row) * (2 * radius / (size - 1)) / 69.09, longitude: (column - (size + 1) / 2) * (2 * radius / (size - 1)) / 69.09 });
const field = (rank: (r: number, c: number) => number, size = 7, radius = 3) => Array.from({ length: size ** 2 }, (_, i) => cell(Math.floor(i / size) + 1, i % size + 1, rank(Math.floor(i / size) + 1, i % size + 1), size, radius));

const researchedNoCandidate:SabAddressCorroboration = {source_report_key:"aaaaaaaaaaaa",evidence_hash:"a".repeat(64),status:"no_candidate",research_complete:true,evidence_references:["official-contact-and-attributable-listing-search"],source_type:"business-controlled sources",identity_method:"exact business identity",fit_rationale:"Completed research produced no independently verifiable address candidate"};

describe("SAB master bounded and truncated evidence", () => {
  it("accepts one bounded near-edge point with a complete empty margin", () => {
    expect(analyzeSabScanPolicy({ stage: "master", grid: grid(), cells: [cell(2, 2, 12)] })).toMatchObject({ action: "plan_deliverable", rule_ids: ["S01"], center_source: "master_centroid" });
  });
  it("requires corroboration before unresolved auxiliaries, while an approved bounded source needs no address research",()=>{
    const input={stage:"master" as const,grid:grid(),cells:[cell(1,4,12)]};
    expect(analyzeSabScanPolicy(input).action).toBe("address_corroboration_required");
    for(const status of ["incomplete","technical_failure"] as const) {
      expect(analyzeSabScanPolicy({...input,addressCorroboration:{...researchedNoCandidate,status}}).action).toBe("address_corroboration_incomplete");
    }
    const rejected={...researchedNoCandidate,status:"rejected" as const};
    expect(analyzeSabScanPolicy({stage:"master",grid:grid(),cells:[cell(2,2,12)],addressCorroboration:rejected})).toMatchObject({action:"plan_deliverable",proposed_center:{latitude:cell(2,2,12).latitude,longitude:cell(2,2,12).longitude}});
  });
  it("retains a routine fine scan for disconnected sparse interior evidence", () => {
    const nearby = analyzeSabScanPolicy({stage:"master",addressCorroboration:researchedNoCandidate,grid:grid(),cells:[cell(4,3,12),cell(4,5,12)]});
    expect(nearby).toMatchObject({action:"plan_auxiliary",center_source:"master_centroid",evidence:{auxiliary_scan_spec:{scan_type:"fine",grid_size:7,radius:1.5,measurement:"mi"},remaining_islands_require_exception:false}});
    expect(nearby.proposed_center!.longitude).toBeCloseTo(0);
    const distant = analyzeSabScanPolicy({stage:"master",addressCorroboration:researchedNoCandidate,grid:grid(),cells:[cell(2,2,9),cell(6,6,12)]});
    expect(distant).toMatchObject({action:"plan_auxiliary",evidence:{remaining_islands_require_exception:true}});
    expect(distant.proposed_center).toEqual({latitude:cell(2,2,9).latitude,longitude:cell(2,2,9).longitude});
  });
  it("normalizes adjacent-edge ties to a three-mile diagonal", () => {
    const result = analyzeSabScanPolicy({ stage: "master", addressCorroboration:researchedNoCandidate, grid: grid(), cells: [cell(1, 4, 2), cell(4, 7, 2)] });
    expect(result).toMatchObject({ action: "plan_auxiliary", center_source: "master_edge_offset" });
    const point = result.proposed_center!;
    const anchor = (result.evidence.master as { offset_anchor: { latitude: number; longitude: number } }).offset_anchor;
    const miles = Math.hypot((point.latitude - anchor.latitude) * 69.09, (point.longitude - anchor.longitude) * 69.09);
    expect(miles).toBeCloseTo(3, 2);
    expect(point.latitude).toBeGreaterThan(0);
    expect(point.longitude).toBeGreaterThan(0);
    expect(miles).toBeLessThan(4);
  });
  it("anchors an offset at the evidence centroid, not the old master center", () => {
    const result = analyzeSabScanPolicy({ stage: "master", addressCorroboration:researchedNoCandidate, grid: grid(), cells: [cell(1, 1, 2)] });
    expect(result.proposed_center!.latitude).toBeGreaterThan(cell(1, 1, 2).latitude);
    expect(result.proposed_center!.longitude).toBeLessThan(cell(1, 1, 2).longitude);
    expect(result.evidence.master).toMatchObject({ selected_edges: ["north", "west"], offset_anchor: { latitude: cell(1, 1, 2).latitude, longitude: cell(1, 1, 2).longitude } });
  });
  it("leaves opposing-edge ambiguity for evidence review", () => {
    expect(analyzeSabScanPolicy({ stage: "master", grid: grid(), cells: [cell(1, 4, 2), cell(7, 4, 2)] }).action).toBe("evidence_review_required");
  });
  it("holds disconnected master clusters that have no deterministic route", () => {
    const result=analyzeSabScanPolicy({stage:"master",grid:grid(),cells:[cell(2,2,4),cell(2,3,5),cell(5,5,7),cell(5,6,8),cell(6,5,9)]});
    expect(result).toMatchObject({action:"evidence_review_required",proposed_center:null});
    expect(result.reason).toBe("If disconnected master-scan clusters do not match an existing deterministic route, hold the company for evidence review; do not invent a center or launch a scan.");
  });
  it("ignores ranks above 20 and rejects a zero offset", () => {
    expect(summarizeSabMasterEvidence([cell(1, 1, 21), cell(2, 2, 20)], 7)?.baseline_centroid_trustworthy).toBe(true);
    expect(() => offsetSabCenter({ latitude: 0, longitude: 0 }, 0, 0)).toThrow();
  });
});

describe("SAB completed auxiliary outcomes", () => {
  it("accepts one exact rank20 pin on the scout boundary", () => {
    expect(analyzeSabScanPolicy({ stage: "auxiliary", grid: grid(9, 6), cells: [cell(1, 1, 20, 9, 6)] })).toMatchObject({ action: "plan_deliverable", rule_ids: ["S03", "S04"] });
  });
  it("reserves no visibility for zero exact top20 pins", () => {
    const cells = [cell(4, 4, 21), cell(4, 5, 4.5), cell(4, 6, 0)];
    expect(analyzeSabScanPolicy({ stage: "auxiliary", grid: grid(), cells }).action).toBe("no_visibility_core_found");
  });
  it("applies all three wide scout exclusion criteria only to 9x9/6mi", () => {
    const cells = field(() => 3, 9, 6).slice(0, 61);
    expect(analyzeSabScanPolicy({ stage: "auxiliary", grid: grid(9, 6), cells, rawArp: 4, solv: 60 }).action).toBe("high_visibility_excluded");
    expect(analyzeSabScanPolicy({ stage: "auxiliary", grid: grid(9, 6), cells: cells.slice(0, 60), rawArp: 4, solv: 60 }).action).toBe("plan_deliverable");
    expect(analyzeSabScanPolicy({ stage: "auxiliary", grid: grid(9, 6), cells, rawArp: 4.01, solv: 60 }).action).toBe("plan_deliverable");
    expect(analyzeSabScanPolicy({ stage: "auxiliary", grid: grid(9, 6), cells, rawArp: 4, solv: 59.99 }).action).toBe("plan_deliverable");
    expect(analyzeSabScanPolicy({ stage: "auxiliary", grid: grid(9, 5), cells, rawArp: 1, solv: 100 }).action).toBe("plan_deliverable");
  });
  it("does not bypass a possible wide-scout exclusion when metrics are missing", () => {
    expect(analyzeSabScanPolicy({ stage: "auxiliary", grid: grid(9, 6), cells: field(() => 3, 9, 6) }).action).toBe("evidence_review_required");
  });
  it("rejects incomplete geometry rather than treating absence as no visibility", () => {
    expect(() => analyzeSabScanPolicy({ stage: "auxiliary", grid: { ...grid(), point_count: 48 }, cells: [] })).toThrow("complete grid geometry");
  });
});

describe("SAB deterministic peak targeting and recenter limits", () => {
  it("moves toward a strong displaced peak rather than the opposite whole-field centroid", () => {
    const cells = [cell(2, 6, 1), cell(2, 5, 2), ...field(() => 9).filter(p => p.column <= 3)];
    const peak = selectSabPeakTarget(cells, grid())!;
    expect(peak.dominant).toBe(true);
    expect(peak.target.longitude).toBeGreaterThan(0);
    expect(peak.moves_toward_peak).toBe(true);
    expect(peak.peak_at_or_adjacent_to_proposed_center).toBe(true);
    expect(peak.selected_cluster_size).toBe(2); // diagonal is adjacent
    expect(analyzeSabScanPolicy({ stage: "auxiliary", grid: grid(), cells }).proposed_center).toEqual(peak.target);
    expect(analyzeSabScanPolicy({ stage: "deliverable", grid: grid(), cells })).toMatchObject({action:"center_validated",proposed_center:grid().center,evidence:{unsupported_off_center_peak:true}});
  });
  it("resolves equal peaks independently of input ordering", () => {
    const cells = [cell(2, 2, 1), cell(6, 6, 1), cell(4, 4, 9), cell(4, 5, 9), cell(5, 4, 9)];
    expect(selectSabPeakTarget(cells, grid())).toEqual(selectSabPeakTarget([...cells].reverse(), grid()));
    expect(selectSabPeakTarget(cells, grid())?.selected_peak).toMatchObject({ row: 2, column: 2 });
  });
  it("permits one routine recenter and requires an explicit exception thereafter", () => {
    const cells = [cell(1, 4, 1), cell(4, 4, 7), cell(5, 4, 9)];
    const input = { stage: "deliverable" as const, grid: grid(), cells };
    expect(analyzeSabScanPolicy(input)).toMatchObject({action:"recenter",reason:expect.stringContaining("S05 independently fails")});
    expect(analyzeSabScanPolicy({ ...input, routineRecenterCount: 1 }).action).toBe("additional_recenter_exception_required");
    expect(analyzeSabScanPolicy({ ...input, routineRecenterCount: 1, additionalRecenterApproved: true }).action).toBe("recenter");
  });
  it("requires neighborhood support for a non-dominant off-center peak when the center is coherent",()=>{
    const cells=[cell(2,6,3),cell(4,4,5),cell(4,3,5),cell(5,4,5)];
    const result=analyzeSabScanPolicy({stage:"deliverable",grid:grid(),cells});
    expect(result).toMatchObject({action:"center_validated",proposed_center:grid().center});
    expect(result.evidence).toMatchObject({peak:{dominant:false,displaced_peak:true,central_3x3_best_rank:5,displaced_peak_central_contrast:2,central_3x3_coherent_cluster:true,neighborhood_support:{applies:true,three_rank_contrast_passes:false,candidate_median_improves:false,candidate_top20_support_passes:false,all_conditions_pass:false}},weak_off_center_peak:false,unsupported_off_center_peak:true});
  });
  it("reproduces the weak Vivid Edge footprint and retains its existing center",()=>{
    const cells=[
      cell(2,3,20),cell(2,6,20),cell(3,2,19),cell(3,3,18),cell(3,4,18),cell(3,5,17),
      cell(3,6,14),cell(4,2,20),cell(4,3,16),cell(4,4,19),cell(4,5,18),cell(4,6,16),
      cell(5,3,16),cell(5,4,18),cell(5,5,18),cell(6,4,18),cell(6,5,18),cell(7,6,20),
    ];
    const result=analyzeSabScanPolicy({stage:"deliverable",grid:grid(),cells,rawArp:17.94,atrp:19.88,solv:0});
    expect(result).toMatchObject({action:"center_validated",rule_ids:["S04","S05","S09"],proposed_center:grid().center});
    expect(result.evidence).toMatchObject({exact_top20_count:18,peak:{best_rank:14,median_rank:18,dominant:true,statistically_dominant_displaced_peak:true,central_3x3_best_rank:16,displaced_peak_central_contrast:2,central_3x3_coherent_cluster:true,neighborhood_support:{applies:true,computational_unranked_sentinel:21,sentinel_persisted_as_observed_rank:false,three_rank_contrast_passes:false,candidate_3x3_median_rank:20,central_3x3_median_rank:18,candidate_median_improves:false,candidate_3x3_exact_top20_count:5,central_3x3_exact_top20_count:9,candidate_top20_support_passes:false,all_conditions_pass:false},displaced_peak_has_centering_support:false,displaced_dominant_peak:false},weak_off_center_peak:false,unsupported_off_center_peak:true});
    expect(result.reason).toContain("unsupported_off_center_peak");
  });
  it("recenters only when all three off-center neighborhood conditions pass",()=>{
    const cells=[
      cell(2,6,1),cell(1,5,2),cell(1,6,2),cell(2,5,2),cell(3,6,2),
      cell(4,4,5),cell(4,3,6),cell(5,4,6),
    ];
    const result=analyzeSabScanPolicy({stage:"deliverable",grid:grid(),cells});
    expect(result).toMatchObject({action:"recenter",evidence:{peak:{central_3x3_best_rank:5,displaced_peak_central_contrast:4,neighborhood_support:{applies:true,three_rank_contrast_passes:true,candidate_median_improves:true,candidate_top20_support_passes:true,all_conditions_pass:true},displaced_peak_has_centering_support:true}}});
  });
  it("retains a coherent center when exact contrast passes but the candidate median does not improve",()=>{
    const cells=[cell(6,4,3),cell(6,3,5),cell(5,3,6),cell(5,4,6),cell(4,4,11)];
    const result=analyzeSabScanPolicy({stage:"deliverable",grid:grid(),cells,routineRecenterCount:1});
    expect(result).toMatchObject({action:"center_validated",evidence:{peak:{best_rank:3,central_3x3_best_rank:6,displaced_peak_central_contrast:3,neighborhood_support:{applies:true,three_rank_contrast_passes:true,candidate_median_improves:false,candidate_top20_support_passes:true,all_conditions_pass:false},displaced_peak_has_centering_support:false,displaced_dominant_peak:false}}});
  });
  it("retains a coherent center when the candidate has fewer exact top-20 neighbors",()=>{
    const cells=[
      cell(2,6,1),cell(1,5,2),cell(1,6,2),cell(2,5,2),cell(3,6,2),
      cell(3,3,6),cell(3,4,6),cell(4,3,6),cell(4,4,6),cell(4,5,6),cell(5,4,6),
    ];
    const result=analyzeSabScanPolicy({stage:"deliverable",grid:grid(),cells});
    expect(result).toMatchObject({action:"center_validated",evidence:{peak:{neighborhood_support:{applies:true,three_rank_contrast_passes:true,candidate_median_improves:true,candidate_3x3_exact_top20_count:5,central_3x3_exact_top20_count:6,candidate_top20_support_passes:false,all_conditions_pass:false}},unsupported_off_center_peak:true}});
  });
  it("keeps isolated central point-source routing outside the neighborhood safeguard",()=>{
    const cells=[cell(2,6,3),cell(4,4,5)];
    const result=analyzeSabScanPolicy({stage:"deliverable",grid:grid(),cells});
    expect(result).toMatchObject({action:"recenter",evidence:{peak:{central_3x3_coherent_cluster:false,neighborhood_support:{applies:false,all_conditions_pass:null,support_source:"existing_point_source_route"},displaced_peak_has_centering_support:true},weak_off_center_peak:true,unsupported_off_center_peak:false}});
  });
  it("leaves an incomplete boundary neighborhood to the existing boundary route",()=>{
    const cells=[cell(1,4,1),cell(4,4,7),cell(5,4,9)];
    const result=analyzeSabScanPolicy({stage:"deliverable",grid:grid(),cells});
    expect(result).toMatchObject({action:"recenter",evidence:{peak:{central_3x3_coherent_cluster:true,neighborhood_support:{applies:false,candidate_3x3_complete:false,all_conditions_pass:null,support_source:"existing_boundary_route"}}}});
  });
});

describe("SAB coherent margin and saturation precedence", () => {
  it("does not mistake two adjacent boundary pins within best+5 for failure", () => {
    expect(evaluateSabCoherentMargin([cell(4, 4, 1), cell(3, 4, 3), cell(2, 4, 5), cell(1, 4, 6), cell(1, 5, 6)], 7).failed).toBe(false);
  });
  it("records a path from a unique central best as directional extension", () => {
    const cells = [cell(4, 4, 1), cell(3, 5, 3), cell(3, 6, 3), cell(2, 7, 3)];
    expect(evaluateSabCoherentMargin(cells, 7)).toMatchObject({
      failed: false,
      reason: "directional_visibility_extension_from_centered_unique_best",
      outward_path: ["3:5", "3:6", "2:7"],
    });
    expect(analyzeSabScanPolicy({ stage: "deliverable", grid: grid(), cells }).action).toBe("center_validated");
  });
  it("still detects a qualifying path when the global best is not uniquely central", () => {
    const cells = [cell(4, 4, 1), cell(2, 2, 1), cell(3, 3, 3), cell(3, 4, 3), cell(3, 5, 3), cell(3, 6, 3), cell(2, 7, 3)];
    expect(evaluateSabCoherentMargin(cells, 7)).toMatchObject({ failed: true, reason: "maintained_or_improved_outward_path" });
  });
  it("still detects an actual best boundary peak", () => {
    expect(evaluateSabCoherentMargin([cell(4, 4, 2), cell(1, 4, 1)], 7).failed).toBe(true);
  });
  it("enables the approved saturation definition only during testing, before any recenter", () => {
    const input = { stage: "deliverable" as const, grid: grid(), cells: field(() => 2) };
    expect(analyzeSabScanPolicy(input).action).toBe("policy_review_required");
    expect(analyzeSabScanPolicy({ ...input, testingPolicyActive: true })).toMatchObject({ action: "same_center_five_mile_comparison", proposed_center: grid().center });
  });
  it("does not call all49 ranked weak pins saturation", () => {
    const result = analyzeSabScanPolicy({ stage: "deliverable", grid: grid(), cells: field(() => 14), testingPolicyActive: true });
    expect(result.evidence.saturation).toMatchObject({ candidate: false });
    expect(result.action).not.toBe("same_center_five_mile_comparison");
  });
  it("does not treat a populated grid with meaningful falloff as saturated", () => {
    const cells = field((r, c) => 2 * Math.max(Math.abs(r - 4), Math.abs(c - 4)) + 1);
    const result = analyzeSabScanPolicy({ stage: "deliverable", grid: grid(), cells, testingPolicyActive: true });
    expect(result.evidence.saturation).toMatchObject({ candidate: false, outer_median: 7, central_median: 3 });
    expect(result.action).toBe("center_validated");
  });
  it("does not activate the five-mile testing definition outside testing", () => {
    const result = analyzeSabScanPolicy({ stage: "deliverable", grid: grid(7, 5), cells: field(() => 1, 7, 5), rawArp: 1, solv: 100 });
    expect(result.action).toBe("policy_review_required");
    expect(result.evidence.five_mile_exclusion_enabled).toBe(false);
  });
});

describe("SAB strict canonical comparison", () => {
  it("classifies a non-excluded five-mile variation for comparison even when it has no pins or its best pin is on the boundary",()=>{
    for(const cells of [[],[cell(1,4,1,7,5),cell(4,4,9,7,5)]]) {
      expect(analyzeSabScanPolicy({stage:"deliverable",grid:grid(7,5),cells,rawArp:6,solv:5,testingPolicyActive:true})).toMatchObject({action:"comparison_ready",rule_ids:["S08"],proposed_center:grid(7,5).center});
    }
  });
  it.each([
    [6, 19, 5], [5, 19, 3], [6, 20, 3], [4, 19, 3], [6, 21, 3],
  ])("selects 5mi only with increased raw ARP and decreased SoLV (%s,%s)", (rawArp, solv, expected) => {
    expect(selectSabCanonicalScan({ threeMile: { rawArp: 5, solv: 20 }, fiveMile: { rawArp, solv } }).selected_radius_miles).toBe(expected);
  });
  it("rejects absent or nonfinite metrics", () => {
    expect(() => selectSabCanonicalScan({ threeMile: { rawArp: 5, solv: 20 }, fiveMile: { rawArp: NaN, solv: 19 } })).toThrow("finite");
  });
});


describe("SAB approved all-point testing saturation", () => {
  it.each([[45, true], [44, false]])("uses the exact 45-of-49 coverage boundary (%i)", (count, candidate) => {
    const result = analyzeSabScanPolicy({ stage: "deliverable", grid: grid(), cells: field(() => 2).slice(0, count), testingPolicyActive: true });
    expect(result.evidence).toMatchObject({ exact_top20_count: count, all_point_count: 49, all_point_median_rank: 2, outer_ring_point_count: 24, central_3x3_point_count: 9, saturation: { candidate } });
    if (candidate) expect(result.action).toBe("same_center_five_mile_comparison");
    else expect(result.action).not.toBe("same_center_five_mile_comparison");
  });
  it("includes missing pins in all49 median rather than taking the median of45 ranked pins", () => {
    const cells = field(() => 4).slice(0, 45).map((point, index) => ({ ...point, rank: index < 24 ? 3 : 4 }));
    const result = analyzeSabScanPolicy({ stage: "deliverable", grid: grid(), cells, testingPolicyActive: true });
    expect(result.evidence).toMatchObject({ all_point_median_rank: 4, peak: { median_rank: 3 }, saturation: { candidate: false } });
  });
  it("includes the four unranked outer cells in the24-cell boundary median", () => {
    let outerIndex = 0;
    const cells = field((r, c) => {
      if (r === 1 || c === 1 || r === 7 || c === 7) return outerIndex++ < 11 ? 3 : 7;
      return 1;
    }).filter(point => !(point.row === 7 && point.column >= 4));
    const result = analyzeSabScanPolicy({ stage: "deliverable", grid: grid(), cells, testingPolicyActive: true });
    expect(result.evidence).toMatchObject({ exact_top20_count: 45, all_point_median_rank: 1, outer_ring_median_rank: 7, central_3x3_median_rank: 1, saturation: { candidate: false } });
  });
  it("includes missing central cells and retains actual numeric ranks above20", () => {
    const cells = field(() => 30).map(point => ({ ...point, rank: point.row === 4 && point.column === 4 ? 1 : 30 }));
    const stats = summarizeSabAllPointRanks(cells, 7);
    expect(stats).toMatchObject({ all_point_median_rank: 30, outer_ring_median_rank: 30, central_3x3_median_rank: 30 });
    const sparse = [cell(3, 3, 1), cell(3, 4, 1), cell(3, 5, 1), cell(4, 3, 7), cell(4, 4, 7)];
    expect(summarizeSabAllPointRanks(sparse, 7)).toMatchObject({ all_point_median_rank: 21, central_3x3_median_rank: 7, outer_ring_median_rank: 21, unranked_median_sentinel: 21 });
  });
  it.each([[3, true], [4, false]])("uses a maximum all-point median of3 (%i)", (rank, candidate) => {
    const result = analyzeSabScanPolicy({ stage: "deliverable", grid: grid(), cells: field(() => rank), testingPolicyActive: true });
    expect(result.evidence.saturation).toMatchObject({ candidate });
  });
  it.each([[3, true], [4, false]])("requires boundary median no worse than central median+2 (%i)", (outerRank, candidate) => {
    const cells = field((r, c) => r === 1 || c === 1 || r === 7 || c === 7 ? outerRank : 1);
    const result = analyzeSabScanPolicy({ stage: "deliverable", grid: grid(), cells, testingPolicyActive: true });
    expect(result.evidence.saturation).toMatchObject({ candidate, central_median: 1, outer_median: outerRank });
  });
  it("does not allow a displaced dominant peak to pass saturation", () => {
    const cells = field((r, c) => r === 2 && c === 6 ? 1 : 5);
    const result = analyzeSabScanPolicy({ stage: "deliverable", grid: grid(), cells, testingPolicyActive: true });
    expect(result.evidence).toMatchObject({ displaced_dominant_peak: false, peak:{statistically_dominant_displaced_peak:true,neighborhood_support:{candidate_median_improves:false}}, unsupported_off_center_peak:true, saturation: { candidate: false } });
    expect(result.action).toBe("center_validated");
  });
});

describe("SAB provisional exact-specification testing exclusions", () => {
  it("returns a review proposal, full measured evidence and no validated center at the five-mile thresholds", () => {
    const result = analyzeSabScanPolicy({ stage: "deliverable", grid: grid(7, 5), cells: field(() => 2, 7, 5).slice(0, 45), rawArp: 3, atrp: 9, solv: 75, testingPolicyActive: true });
    expect(result).toMatchObject({ action: "high_visibility_exclusion_pending_review", rule_ids: ["S09"], proposed_center: null, center_source: null });
    expect(result.evidence).toMatchObject({ exact_top20_count: 45, coverage: 45 / 49, all_point_median_rank: 2, outer_ring_median_rank: 2, central_3x3_median_rank: 2, raw_arp: 3, atrp: 9, solv: 75, displaced_dominant_peak: false, exclusion: { qualifies: true, final_disposition: false, requires_matt_review: true, centering_classification: "not_validated_by_exclusion" } });
  });
  it.each([
    { count: 44, rawArp: 3, solv: 75 }, { count: 45, rawArp: 3.01, solv: 75 }, { count: 45, rawArp: 3, solv: 74.99 },
  ])("requires all three conditions independently (%j)", values => {
    const result = analyzeSabScanPolicy({ stage: "deliverable", grid: grid(7, 5), cells: field(() => 2, 7, 5).slice(0, values.count), rawArp: values.rawArp, solv: values.solv, testingPolicyActive: true });
    expect(result.action).not.toBe("high_visibility_exclusion_pending_review");
    expect(result.evidence.exclusion).toMatchObject({ qualifies: false });
  });
  it("uses rawARP rather than ATRP for exclusion", () => {
    const result = analyzeSabScanPolicy({ stage: "deliverable", grid: grid(7, 5), cells: field(() => 2, 7, 5), rawArp: 3.1, atrp: 1, solv: 100, testingPolicyActive: true });
    expect(result.action).toBe("comparison_ready");
    expect(result.evidence.exclusion).toMatchObject({ qualifies: false });
  });
  it("keeps a displaced dominant peak visible without adding a fourth exclusion condition or validating a center", () => {
    const result = analyzeSabScanPolicy({ stage: "deliverable", grid: grid(7, 5), cells: field((r, c) => r === 2 && c === 6 ? 1 : 4, 7, 5), rawArp: 3, solv: 75, testingPolicyActive: true });
    expect(result).toMatchObject({ action: "high_visibility_exclusion_pending_review", proposed_center: null, center_source: null });
    expect(result.evidence).toMatchObject({ displaced_dominant_peak: false, peak:{statistically_dominant_displaced_peak:true,neighborhood_support:{candidate_median_improves:false}}, saturation: { candidate: false }, exclusion: { qualifies: true, final_disposition: false, centering_classification: "not_validated_by_exclusion" } });
    expect(result.reason).toContain("high-visibility thresholds");
  });
  it("also keeps the existing9x9/6mi exclusion provisional throughout testing", () => {
    const result = analyzeSabScanPolicy({ stage: "auxiliary", grid: grid(9, 6), cells: field(() => 3, 9, 6).slice(0, 61), rawArp: 4, solv: 60, testingPolicyActive: true });
    expect(result).toMatchObject({ action: "high_visibility_exclusion_pending_review", rule_ids: ["S02"], proposed_center: null, center_source: null, evidence: { all_point_count: 81, outer_ring_point_count: 32, central_3x3_point_count: 9, exclusion: { final_disposition: false, requires_matt_review: true } } });
  });
  it.each([{ size: 7, radius: 3 }, { size: 9, radius: 5 }, { size: 9, radius: 6 }])("does not use the five-mile threshold on another deliverable specification (%j)", spec => {
    const result = analyzeSabScanPolicy({ stage: "deliverable", grid: grid(spec.size, spec.radius), cells: field(() => 2, spec.size, spec.radius), rawArp: 3, solv: 75, testingPolicyActive: true });
    expect(result.action).not.toBe("high_visibility_exclusion_pending_review");
    expect(result.evidence.exclusion).toMatchObject({ specification_matches: false });
  });
  it("requires measured exclusion metrics when coverage can qualify", () => {
    const result = analyzeSabScanPolicy({ stage: "deliverable", grid: grid(7, 5), cells: field(() => 2, 7, 5), testingPolicyActive: true });
    expect(result.action).toBe("evidence_review_required");
    expect(result.evidence.exclusion).toMatchObject({ valid_metrics: false });
  });
});

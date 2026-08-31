import { describe, expect, it } from "vitest";
import { analyzeSabScanPolicy, evaluateSabCoherentMargin, offsetSabCenter, selectSabCanonicalScan, selectSabPeakTarget, summarizeSabMasterEvidence, type SabScanGrid } from "../../server/features/sab-mcp/scanPolicy";
import type { SabRankedCell } from "../../server/features/sab-mcp/localFalconRankedCells";

const grid = (size = 7, radius = 3): SabScanGrid => ({ size, radius, point_count: size ** 2, center: { latitude: 0, longitude: 0 }, measurement: "mi" });
const cell = (row: number, column: number, rank: number, size = 7, radius = 3): SabRankedCell => ({ row, column, rank, latitude: ((size + 1) / 2 - row) * (2 * radius / (size - 1)) / 69.09, longitude: (column - (size + 1) / 2) * (2 * radius / (size - 1)) / 69.09 });
const field = (rank: (r: number, c: number) => number, size = 7, radius = 3) => Array.from({ length: size ** 2 }, (_, i) => cell(Math.floor(i / size) + 1, i % size + 1, rank(Math.floor(i / size) + 1, i % size + 1), size, radius));

describe("SAB master bounded and truncated evidence", () => {
  it("accepts one bounded near-edge point with a complete empty margin", () => {
    expect(analyzeSabScanPolicy({ stage: "master", grid: grid(), cells: [cell(2, 2, 12)] })).toMatchObject({ action: "plan_deliverable", rule_ids: ["S01"], center_source: "master_centroid" });
  });
  it("retains a routine fine scan for disconnected sparse interior evidence", () => {
    const nearby = analyzeSabScanPolicy({stage:"master",grid:grid(),cells:[cell(4,3,12),cell(4,5,12)]});
    expect(nearby).toMatchObject({action:"plan_auxiliary",center_source:"master_centroid",evidence:{auxiliary_scan_spec:{scan_type:"fine",grid_size:7,radius:1.5,measurement:"mi"},remaining_islands_require_exception:false}});
    expect(nearby.proposed_center!.longitude).toBeCloseTo(0);
    const distant = analyzeSabScanPolicy({stage:"master",grid:grid(),cells:[cell(2,2,9),cell(6,6,12)]});
    expect(distant).toMatchObject({action:"plan_auxiliary",evidence:{remaining_islands_require_exception:true}});
    expect(distant.proposed_center).toEqual({latitude:cell(2,2,9).latitude,longitude:cell(2,2,9).longitude});
  });
  it("normalizes adjacent-edge ties to a three-mile diagonal", () => {
    const result = analyzeSabScanPolicy({ stage: "master", grid: grid(), cells: [cell(1, 4, 2), cell(4, 7, 2)] });
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
    const result = analyzeSabScanPolicy({ stage: "master", grid: grid(), cells: [cell(1, 1, 2)] });
    expect(result.proposed_center!.latitude).toBeGreaterThan(cell(1, 1, 2).latitude);
    expect(result.proposed_center!.longitude).toBeLessThan(cell(1, 1, 2).longitude);
    expect(result.evidence.master).toMatchObject({ selected_edges: ["north", "west"], offset_anchor: { latitude: cell(1, 1, 2).latitude, longitude: cell(1, 1, 2).longitude } });
  });
  it("leaves opposing-edge ambiguity for evidence review", () => {
    expect(analyzeSabScanPolicy({ stage: "master", grid: grid(), cells: [cell(1, 4, 2), cell(7, 4, 2)] }).action).toBe("evidence_review_required");
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
    const cells = [cell(2, 6, 1), cell(3, 5, 2), ...field(() => 9).filter(p => p.column <= 3)];
    const peak = selectSabPeakTarget(cells, grid())!;
    expect(peak.dominant).toBe(true);
    expect(peak.target.longitude).toBeGreaterThan(0);
    expect(peak.moves_toward_peak).toBe(true);
    expect(peak.peak_at_or_adjacent_to_proposed_center).toBe(true);
    expect(peak.selected_cluster_size).toBe(2); // diagonal is adjacent
    expect(analyzeSabScanPolicy({ stage: "auxiliary", grid: grid(), cells }).proposed_center).toEqual(peak.target);
    expect(analyzeSabScanPolicy({ stage: "deliverable", grid: grid(), cells }).proposed_center).toEqual(peak.target);
  });
  it("resolves equal peaks independently of input ordering", () => {
    const cells = [cell(2, 2, 1), cell(6, 6, 1), cell(4, 4, 9), cell(4, 5, 9), cell(5, 4, 9)];
    expect(selectSabPeakTarget(cells, grid())).toEqual(selectSabPeakTarget([...cells].reverse(), grid()));
    expect(selectSabPeakTarget(cells, grid())?.selected_peak).toMatchObject({ row: 2, column: 2 });
  });
  it("permits one routine recenter and requires an explicit exception thereafter", () => {
    const cells = [cell(1, 4, 1), cell(4, 4, 7), cell(5, 4, 9)];
    const input = { stage: "deliverable" as const, grid: grid(), cells };
    expect(analyzeSabScanPolicy(input).action).toBe("recenter");
    expect(analyzeSabScanPolicy({ ...input, routineRecenterCount: 1 }).action).toBe("additional_recenter_exception_required");
    expect(analyzeSabScanPolicy({ ...input, routineRecenterCount: 1, additionalRecenterApproved: true }).action).toBe("recenter");
  });
});

describe("SAB coherent margin and saturation precedence", () => {
  it("does not mistake two adjacent boundary pins within best+5 for failure", () => {
    expect(evaluateSabCoherentMargin([cell(4, 4, 1), cell(3, 4, 3), cell(2, 4, 5), cell(1, 4, 6), cell(1, 5, 6)], 7).failed).toBe(false);
  });
  it("detects maintained outward strength and an actual best boundary peak", () => {
    expect(evaluateSabCoherentMargin([cell(4, 4, 1), cell(3, 4, 2), cell(2, 4, 2), cell(1, 4, 2)], 7)).toMatchObject({ failed: true, reason: "maintained_or_improved_outward_path" });
    expect(evaluateSabCoherentMargin([cell(4, 4, 2), cell(1, 4, 1)], 7).failed).toBe(true);
  });
  it("gates the numerical saturation proposal until approved, before any recenter", () => {
    const input = { stage: "deliverable" as const, grid: grid(), cells: field(() => 2) };
    expect(analyzeSabScanPolicy(input).action).toBe("policy_review_required");
    expect(analyzeSabScanPolicy({ ...input, saturationPolicyApproved: true })).toMatchObject({ action: "same_center_five_mile_comparison", proposed_center: grid().center });
  });
  it("does not call all49 ranked weak pins saturation", () => {
    const result = analyzeSabScanPolicy({ stage: "deliverable", grid: grid(), cells: field(() => 14), saturationPolicyApproved: true });
    expect(result.evidence.saturation).toMatchObject({ candidate: false });
    expect(result.action).not.toBe("same_center_five_mile_comparison");
  });
  it("does not treat a populated grid with meaningful falloff as saturated", () => {
    const cells = field((r, c) => 2 * Math.max(Math.abs(r - 4), Math.abs(c - 4)) + 1);
    const result = analyzeSabScanPolicy({ stage: "deliverable", grid: grid(), cells, saturationPolicyApproved: true });
    expect(result.evidence.saturation).toMatchObject({ candidate: false, outer_median: 7, central_median: 3 });
    expect(result.action).toBe("center_validated");
  });
  it("has no active five-mile high visibility exclusion", () => {
    const result = analyzeSabScanPolicy({ stage: "deliverable", grid: grid(7, 5), cells: field(() => 1, 7, 5), rawArp: 1, solv: 100, saturationPolicyApproved: true });
    expect(result.action).toBe("center_validated");
    expect(result.evidence.five_mile_exclusion_enabled).toBe(false);
  });
});

describe("SAB strict canonical comparison", () => {
  it.each([
    [6, 19, 5], [5, 19, 3], [6, 20, 3], [4, 19, 3], [6, 21, 3],
  ])("selects 5mi only with increased raw ARP and decreased SoLV (%s,%s)", (rawArp, solv, expected) => {
    expect(selectSabCanonicalScan({ threeMile: { rawArp: 5, solv: 20 }, fiveMile: { rawArp, solv } }).selected_radius_miles).toBe(expected);
  });
  it("rejects absent or nonfinite metrics", () => {
    expect(() => selectSabCanonicalScan({ threeMile: { rawArp: 5, solv: 20 }, fiveMile: { rawArp: NaN, solv: 19 } })).toThrow("finite");
  });
});

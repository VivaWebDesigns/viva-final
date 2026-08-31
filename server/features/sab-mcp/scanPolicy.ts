import type { SabRankedCell } from "./localFalconRankedCells";

export type SabCoordinate = { latitude: number; longitude: number };
export type SabScanGrid = {
  size: number;
  point_count: number;
  center: SabCoordinate;
  radius: number;
  measurement: string;
};
export type SabScanPolicyInput = {
  stage: "master" | "auxiliary" | "deliverable";
  cells: SabRankedCell[];
  grid: SabScanGrid;
  rawArp?: number | null;
  solv?: number | null;
  routineRecenterCount?: number;
  additionalRecenterApproved?: boolean;
  saturationPolicyApproved?: boolean;
};
export type SabScanDecision = {
  rule_ids: string[];
  action: "plan_deliverable" | "plan_auxiliary" | "no_visibility_core_found" |
    "high_visibility_excluded" | "same_center_five_mile_comparison" |
    "recenter" | "additional_recenter_exception_required" | "center_validated" |
    "policy_review_required" | "evidence_review_required";
  reason: string;
  proposed_center: SabCoordinate | null;
  center_source: "master_centroid" | "master_edge_offset" | "auxiliary_centroid" |
    "ranked_peak_recentered" | null;
  evidence: Record<string, unknown>;
};

// This proposal must not silently become run policy. The orchestrator must record
// explicit approval before passing saturationPolicyApproved=true.
export const PROPOSED_SAB_SATURATION_POLICY = Object.freeze({
  all_points_exact_top20: true,
  maximum_median_rank: 3,
  maximum_outer_minus_central_median: 2,
  forbid_displaced_dominant_peak: true,
  approval_required: true,
});
export const SAB_FIVE_MILE_EXCLUSION_POLICY = Object.freeze({ enabled: false, approval_required: true });
export const SAB_WIDE_SCOUT_EXCLUSION_POLICY = Object.freeze({
  grid_size: 9, radius_miles: 6, minimum_coverage: 0.75, maximum_raw_arp: 4, minimum_solv: 60,
});

export function exactSabTop20Cells(cells: SabRankedCell[]) {
  return cells.filter(({ rank }) => Number.isInteger(rank) && rank >= 1 && rank <= 20);
}
function positionKey(cell: SabRankedCell) { return `${cell.row}:${cell.column}`; }
function order(a: SabRankedCell, b: SabRankedCell) { return a.row - b.row || a.column - b.column; }
function boundary(cell: SabRankedCell, size: number) {
  return cell.row === 1 || cell.column === 1 || cell.row === size || cell.column === size;
}
function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function distance(a: SabCoordinate, b: SabCoordinate) {
  const radians = Math.PI / 180;
  const dLat = (a.latitude - b.latitude) * radians;
  const dLng = (a.longitude - b.longitude) * radians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * radians) *
    Math.cos(b.latitude * radians) * Math.sin(dLng / 2) ** 2;
  return 3958.7613 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
function centroid(cells: SabRankedCell[]): SabCoordinate {
  const weight = cells.reduce((sum, cell) => sum + 1 / cell.rank, 0);
  return {
    latitude: cells.reduce((sum, cell) => sum + cell.latitude / cell.rank, 0) / weight,
    longitude: cells.reduce((sum, cell) => sum + cell.longitude / cell.rank, 0) / weight,
  };
}
export function sabRankedClusters(cells: SabRankedCell[]) {
  const remaining = new Map([...cells].sort(order).map(cell => [positionKey(cell), cell]));
  const components: SabRankedCell[][] = [];
  while (remaining.size) {
    const first = remaining.values().next().value!;
    remaining.delete(positionKey(first));
    const queue = [first];
    for (let i = 0; i < queue.length; i++) {
      const cell = queue[i];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const key = `${cell.row + dr}:${cell.column + dc}`;
        const neighbor = remaining.get(key);
        if (neighbor) { remaining.delete(key); queue.push(neighbor); }
      }
    }
    components.push(queue.sort(order));
  }
  return components;
}

/** S04: select a best+2 8-connected component containing a global best pin.
 * Ties: greatest 1/rank weight, nearest old center, northmost then westmost pin.
 * A centroid outside the selected component is snapped to a component pin.
 */
export function selectSabPeakTarget(cellsInput: SabRankedCell[], grid: SabScanGrid) {
  const cells = exactSabTop20Cells(cellsInput);
  if (!cells.length) return null;
  const best = Math.min(...cells.map(cell => cell.rank));
  const rankedMedian = median(cells.map(cell => cell.rank))!;
  const dominant = rankedMedian - best >= 3;
  const candidates = sabRankedClusters(cells.filter(cell => cell.rank <= best + 2))
    .filter(component => component.some(cell => cell.rank === best))
    .map(component => ({
      cells: component,
      weight: component.reduce((sum, cell) => sum + 1 / cell.rank, 0),
      center: centroid(component),
    }))
    .sort((a, b) => b.weight - a.weight || distance(a.center, grid.center) - distance(b.center, grid.center) || order(a.cells[0], b.cells[0]));
  const selected = candidates[0];
  const peak = [...selected.cells].filter(cell => cell.rank === best)
    .sort((a, b) => distance(a, grid.center) - distance(b, grid.center) || order(a, b))[0];
  let target = dominant ? selected.center : centroid(cells);
  let targetingMethod: "peak_cluster_centroid" | "whole_field_centroid" | "selected_peak_pin" = dominant ? "peak_cluster_centroid" : "whole_field_centroid";
  // Target coordinates must remain in/adjacent to the
  // selected cluster on the proposed 7x7/3mi deliverable (one-mile spacing).
  const maxAdjacentDistance = Math.SQRT2;
  const nearestClusterDistance = Math.min(...selected.cells.map(cell => distance(cell, target)));
  const towardPeak = distance(target, peak) <= distance(grid.center, peak) + 1e-8;
  if (nearestClusterDistance > maxAdjacentDistance || !towardPeak) {
    target = { latitude: peak.latitude, longitude: peak.longitude };
    targetingMethod = "selected_peak_pin";
  }
  const movement = distance(grid.center, target);
  const displaced = Math.max(Math.abs(peak.row - (grid.size + 1) / 2), Math.abs(peak.column - (grid.size + 1) / 2)) > 1;
  return {
    target,
    targeting_method: targetingMethod,
    dominant,
    best_rank: best,
    median_rank: rankedMedian,
    selected_cluster_size: selected.cells.length,
    selected_cluster_weight: selected.weight,
    selected_peak: { row: peak.row, column: peak.column, rank: peak.rank },
    displaced_dominant_peak: dominant && displaced,
    movement_miles: movement,
    moves_toward_peak: distance(target, peak) <= distance(grid.center, peak) + 1e-8,
    peak_at_or_adjacent_to_proposed_center: Math.min(...selected.cells.map(cell => distance(cell, target))) <= maxAdjacentDistance,
    cluster_adjacency: "8_neighbors" as const,
    tie_break: "weight_desc_distance_to_old_center_asc_row_asc_column_asc" as const,
  };
}

export function offsetSabCenter(center: SabCoordinate, north: number, east: number, miles = 3): SabCoordinate {
  const length = Math.hypot(north, east);
  if (!length) throw new Error("Master edge evidence has no unique offset direction.");
  const bearing = Math.atan2(east / length, north / length);
  const angular = miles / 3958.7613;
  const lat = center.latitude * Math.PI / 180;
  const lng = center.longitude * Math.PI / 180;
  const nextLat = Math.asin(Math.sin(lat) * Math.cos(angular) + Math.cos(lat) * Math.sin(angular) * Math.cos(bearing));
  const nextLng = lng + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat), Math.cos(angular) - Math.sin(lat) * Math.sin(nextLat));
  return { latitude: nextLat * 180 / Math.PI, longitude: ((nextLng * 180 / Math.PI + 540) % 360) - 180 };
}

export function summarizeSabMasterEvidence(cellsInput: SabRankedCell[], gridSize: number, center?: SabCoordinate) {
  const cells = exactSabTop20Cells(cellsInput);
  if (!cells.length) return null;
  const components = sabRankedClusters(cells);
  const edges = { north: 0, east: 0, south: 0, west: 0 };
  cells.forEach(cell => {
    if (cell.row === 1) edges.north += 1 / cell.rank;
    if (cell.column === gridSize) edges.east += 1 / cell.rank;
    if (cell.row === gridSize) edges.south += 1 / cell.rank;
    if (cell.column === 1) edges.west += 1 / cell.rank;
  });
  const maximum = Math.max(...Object.values(edges));
  const weightedCenter = centroid(cells);
  const touchedEdges = Object.keys(edges).filter(edge => edges[edge as keyof typeof edges] > 0);
  const edgeDistances = Object.fromEntries(touchedEdges.map(edge => {
    const edgeCell = cells.find(cell => edge === "north" ? cell.row === 1 : edge === "south" ? cell.row === gridSize : edge === "west" ? cell.column === 1 : cell.column === gridSize)!;
    const edgeCoordinate = edge === "north" || edge === "south" ? { latitude: edgeCell.latitude, longitude: weightedCenter.longitude } : { latitude: weightedCenter.latitude, longitude: edgeCell.longitude };
    return [edge, distance(weightedCenter, edgeCoordinate)];
  }));
  const nearestEdge = Math.min(...Object.values(edgeDistances));
  // Sub-meter tolerance handles rounded provider coordinates; it is not a
  // policy preference for one neighboring edge over another.
  const selectedEdges = touchedEdges.filter(edge => Math.abs(edgeDistances[edge] - nearestEdge) <= 0.0001);
  const north = Number(selectedEdges.includes("north")) - Number(selectedEdges.includes("south"));
  const east = Number(selectedEdges.includes("east")) - Number(selectedEdges.includes("west"));
  const unambiguous = selectedEdges.length === 1 || (selectedEdges.length === 2 && north !== 0 && east !== 0);
  return {
    bounded_interior_evidence: maximum === 0 && components.length === 1,
    edge_flagged: maximum > 0,
    edge_rule: "actual_outer_boundary_top20_occupation" as const,
    edge_weights: edges,
    offset_anchor: weightedCenter,
    edge_distance_miles: edgeDistances,
    edge_selection: "nearest_physically_touched_edge_from_weighted_centroid" as const,
    selected_edges: selectedEdges,
    offset_miles: maximum > 0 && unambiguous ? 3 : null,
    offset_direction: maximum > 0 && unambiguous ? { north: north / Math.hypot(north, east), east: east / Math.hypot(north, east) } : null,
    proposed_offset_center: maximum > 0 && unambiguous ? offsetSabCenter(weightedCenter, north, east) : null,
    baseline_centroid_trustworthy: maximum === 0 && components.length === 1,
    cluster_count: components.length,
    cluster_sizes: components.map(component => component.length).sort((a, b) => b - a),
  };
}

/** S05: ordinary rank falloff is allowed. Failure requires a globally best
 * boundary pin, or a monotonic outward path of at least three top20 pins
 * starting at a best+2 peak-cluster pin, ending at the boundary, with no worse
 * rank along the path. Two neighboring boundary pins alone are never a path.
 */
export function evaluateSabCoherentMargin(cellsInput: SabRankedCell[], size: number) {
  const cells = exactSabTop20Cells(cellsInput);
  if (!cells.length) return { failed: false, reason: "no_exact_top20_pins", outward_path: [] as string[] };
  const best = Math.min(...cells.map(cell => cell.rank));
  const peakBoundary = cells.find(cell => cell.rank === best && boundary(cell, size));
  if (peakBoundary) return { failed: true, reason: "global_best_on_boundary", outward_path: [positionKey(peakBoundary)] };
  const map = new Map(cells.map(cell => [positionKey(cell), cell]));
  const edgeDistance = (cell: SabRankedCell) => Math.min(cell.row - 1, cell.column - 1, size - cell.row, size - cell.column);
  const peakCells = sabRankedClusters(cells.filter(cell => cell.rank <= best + 2))
    .filter(component => component.some(cell => cell.rank === best)).flat();
  for (const start of peakCells) {
    const queue: SabRankedCell[][] = [[start]];
    while (queue.length) {
      const path = queue.shift()!;
      const last = path.at(-1)!;
      if (path.length >= 3 && boundary(last, size)) return { failed: true, reason: "maintained_or_improved_outward_path", outward_path: path.map(positionKey) };
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const next = map.get(`${last.row + dr}:${last.column + dc}`);
        if (next && next.rank <= last.rank && edgeDistance(next) < edgeDistance(last)) queue.push([...path, next]);
      }
    }
  }
  return { failed: false, reason: "no_coherent_outward_strength", outward_path: [] as string[] };
}

function assertGeometry(input: SabScanPolicyInput) {
  const { grid } = input;
  if (!Number.isInteger(grid.size) || grid.size < 3 || grid.point_count !== grid.size ** 2 || !Number.isFinite(grid.radius) || grid.radius <= 0 ||
    !Number.isFinite(grid.center.latitude) || Math.abs(grid.center.latitude) > 90 || !Number.isFinite(grid.center.longitude) || Math.abs(grid.center.longitude) > 180) throw new Error("A completed valid scan with complete grid geometry is required.");
  const seen = new Set<string>();
  for (const cell of input.cells) {
    if (!Number.isInteger(cell.row) || !Number.isInteger(cell.column) || cell.row < 1 || cell.column < 1 || cell.row > grid.size || cell.column > grid.size ||
      !Number.isFinite(cell.latitude) || Math.abs(cell.latitude) > 90 || !Number.isFinite(cell.longitude) || Math.abs(cell.longitude) > 180 || seen.has(positionKey(cell))) throw new Error("Invalid or duplicate scan cell geometry.");
    seen.add(positionKey(cell));
  }
}

export function analyzeSabScanPolicy(input: SabScanPolicyInput): SabScanDecision {
  assertGeometry(input);
  const cells = exactSabTop20Cells(input.cells);
  const grid = input.grid;
  const mileGrid = ["mi", "mile", "miles"].includes(grid.measurement.toLowerCase());
  const peak = selectSabPeakTarget(cells, grid);
  const evidence: Record<string, unknown> = { exact_top20_count: cells.length, point_count: grid.point_count, coverage: cells.length / grid.point_count, raw_arp: input.rawArp ?? null, solv: input.solv ?? null, peak, five_mile_exclusion_enabled: false };
  const decision = (action: SabScanDecision["action"], rules: string[], reason: string, proposed_center: SabCoordinate | null = null, center_source: SabScanDecision["center_source"] = null): SabScanDecision => ({ action, rule_ids: rules, reason, proposed_center, center_source, evidence });
  if (input.stage === "master") {
    const master = summarizeSabMasterEvidence(cells, grid.size, grid.center);
    evidence.master = master;
    if (master?.baseline_centroid_trustworthy) return decision("plan_deliverable", ["S01"], "A coherent interior footprint has a complete empty outer margin; pin count and edge proximity do not require a scout.", centroid(cells), "master_centroid");
    if (master?.proposed_offset_center) return decision("plan_auxiliary", ["S01"], "Actual outer-boundary evidence is truncated; use the server-calculated normalized three-mile offset.", master.proposed_offset_center, "master_edge_offset");
    if (master && !master.edge_flagged && cells.length > 1 && cells.length < 5) {
      const spread = Math.max(...cells.flatMap(a => cells.map(b => distance(a,b))));
      const bestPin = cells.find(cell => cell.row === peak!.selected_peak.row && cell.column === peak!.selected_peak.column)!;
      evidence.auxiliary_scan_spec = { scan_type: "fine", grid_size: 7, radius: 1.5, measurement: "mi" };
      evidence.remaining_islands_require_exception = spread > 3;
      return decision("plan_auxiliary", ["S01"], spread > 3
        ? "Disconnected sparse interior pins are over three miles apart. Fine-scan the deterministic best pin; hold the other islands for an explicit exception."
        : "Disconnected sparse interior evidence needs one fine scan at its weighted centroid.",
      spread > 3 ? {latitude:bestPin.latitude,longitude:bestPin.longitude} : centroid(cells), "master_centroid");
    }
    return decision("evidence_review_required", ["S01"], "Master evidence is absent, unresolved, or has opposing-edge ambiguity; no arbitrary center is selected.");
  }
  if (input.stage === "auxiliary") {
    const validExclusionMetrics = typeof input.rawArp === "number" && Number.isFinite(input.rawArp) && input.rawArp >= 1 &&
      typeof input.solv === "number" && Number.isFinite(input.solv) && input.solv >= 0 && input.solv <= 100;
    if (mileGrid && grid.size === 9 && grid.radius === 6 && cells.length / grid.point_count >= 0.75 && !validExclusionMetrics) return decision("evidence_review_required", ["S02"], "Wide scout coverage can meet the exclusion; valid raw ARP and SoLV are required before authorizing a deliverable.");
    if (mileGrid && grid.size === 9 && grid.radius === 6 && cells.length / grid.point_count >= 0.75 &&
      typeof input.rawArp === "number" && input.rawArp <= 4 && typeof input.solv === "number" && input.solv >= 60) return decision("high_visibility_excluded", ["S02"], "The 9x9/6-mile scout meets all three approved high-visibility criteria.");
    if (!cells.length) return decision("no_visibility_core_found", ["S03"], "A completed valid auxiliary has zero exact rank 1–20 pins; use the CRM-only market-reference path.");
    return decision("plan_deliverable", ["S03", "S04"], "At least one exact rank 1–20 pin confirms visibility. Scout boundary occupation does not veto the peak-first deliverable.", peak!.target, peak!.targeting_method !== "whole_field_centroid" ? "ranked_peak_recentered" : "auxiliary_centroid");
  }
  if (!cells.length) return decision("evidence_review_required", ["S05"], "A deliverable without exact top20 pins cannot establish a validated visibility center; reconcile with auxiliary evidence.");
  const middle = (grid.size + 1) / 2;
  const outerMedian = median(cells.filter(cell => boundary(cell, grid.size)).map(cell => cell.rank));
  const centralMedian = median(cells.filter(cell => Math.abs(cell.row - middle) <= 1 && Math.abs(cell.column - middle) <= 1).map(cell => cell.rank));
  const saturationCandidate = cells.length === grid.point_count && peak!.median_rank <= PROPOSED_SAB_SATURATION_POLICY.maximum_median_rank &&
    outerMedian !== null && centralMedian !== null && outerMedian <= centralMedian + PROPOSED_SAB_SATURATION_POLICY.maximum_outer_minus_central_median && !peak!.displaced_dominant_peak;
  evidence.saturation = { candidate: saturationCandidate, policy_approved: input.saturationPolicyApproved === true, outer_median: outerMedian, central_median: centralMedian, proposed_policy: PROPOSED_SAB_SATURATION_POLICY };
  // S06 precedes S05/S07: a saturated field can occupy every boundary without
  // proving a misplaced center. Pending numerical policy must stop here.
  if (saturationCandidate && !input.saturationPolicyApproved) return decision("policy_review_required", ["S06"], "Strong rankings without material falloff match the proposed saturation test; its numeric definition needs explicit approval.");
  if (saturationCandidate && mileGrid && grid.size === 7 && grid.radius === 3) return decision("same_center_five_mile_comparison", ["S06", "S08"], "Saturation is the only centering issue; compare 7x7/5mi at the same center without spending a recenter.", grid.center);
  if (saturationCandidate) return decision("center_validated", ["S06", "S09"], "Saturation is the only centering issue. There is no active five-mile exclusion threshold.", grid.center);
  const margin = evaluateSabCoherentMargin(cells, grid.size);
  evidence.margin = margin;
  if (margin.failed || peak!.displaced_dominant_peak) {
    if ((input.routineRecenterCount ?? 0) >= 1 && !input.additionalRecenterApproved) return decision("additional_recenter_exception_required", ["S04", "S05", "S07"], "One routine recenter has already been used; another requires an explicit exception.", peak!.target, "ranked_peak_recentered");
    if (peak!.movement_miles < 1e-6) return decision("evidence_review_required", ["S04", "S05"], "The failed margin has no verified movement toward the selected peak; do not resubmit an identical center.");
    return decision("recenter", ["S04", "S05", "S07"], "Coherent outward strength or a displaced dominant peak supports the permitted peak-first recenter.", peak!.target, "ranked_peak_recentered");
  }
  return decision("center_validated", ["S05", "S09"], "The footprint has ordinary falloff without coherent outward strength or a displaced dominant peak.", grid.center);
}

export function selectSabCanonicalScan(input: { threeMile: { rawArp: number; solv: number }; fiveMile: { rawArp: number; solv: number } }) {
  const metrics = [input.threeMile.rawArp, input.threeMile.solv, input.fiveMile.rawArp, input.fiveMile.solv];
  if (!metrics.every(Number.isFinite)) throw new Error("Canonical selection requires finite raw ARP and SoLV from both scan specifications.");
  const selectFive = input.fiveMile.rawArp > input.threeMile.rawArp && input.fiveMile.solv < input.threeMile.solv;
  return { selected_radius_miles: selectFive ? 5 : 3, rule_id: "S08", raw_arp_increased: input.fiveMile.rawArp > input.threeMile.rawArp, solv_decreased: input.fiveMile.solv < input.threeMile.solv };
}

import { createHash } from "node:crypto";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SabSheetsRepository, SabSheetsRepositoryFactory } from "./sheets";
import { SCALE_FIRST_WORKFLOW, SAB_ADDRESS_LABEL, sabBusinessProfileSchema, sabBusinessProfileIssues } from "@shared/sabCrm";
import { getSabRankedCells } from "./localFalconRankedCells";
import { analyzeSabScanPolicy, exactSabTop20Cells, sabRankedClusters, selectSabCanonicalScan } from "./scanPolicy";
import { reverseGeocodeSabCenters } from "./reverseGeocode";
import { buildSabRunManifest } from "./exportManifest";
import { approveSabTerminalDeferral, createSabRunState, authorizeSabScanBatch, completeSabRunReports, inSabRunStateQueue, pinSabSopRevision, recordSabManifest, reconcileSabAmbiguousSubmission, recordSabRunSubmission, sabScanPlanFingerprint, type SabRunState, type SabScanPlan } from "./runState";
import { SAB_CENTER_TYPES, runSabScanOnceInputSchema, sabContactResearchV3Schema, sabEligibilityStateSchema, type SabCompanyUpdates, type SabScanResult } from "./schema";
import { corroborationAllowsAuxiliary, sabAddressCorroborationSchema, type SabAddressCorroboration } from "./addressCorroboration";
import { evaluateSabAddressCandidate, evaluateSabCoordinatesAgainstCells } from "./addressCandidate";
import { auditSabContactRows, isNormalModeException } from "./usageOptimization";
import { reconcileSabImportBatch } from "./importReconciliation";
import { validateSabContactResearchV3 } from "./contactResearch";

const common = {workflow_sheet:z.string().min(1),sheet_name:z.string().min(1).default("SAB Workflow")};
const run = {...common,run_id:z.string().min(1).max(200)};
const matt = z.object({approved_by:z.literal("Matt"),approval_reference:z.string().trim().min(1).max(2000)}).strict();
const plan = z.object(runSabScanOnceInputSchema).pick({place_id:true,scan_role:true,scan_type:true,center:true,grid_size:true,radius:true,measurement:true,keyword:true,platform:true,estimated_credits:true,save_location_required:true});
const result = (value:unknown) => ({content:[{type:"text" as const,text:JSON.stringify(value)}]});

async function requireRun(repository:SabSheetsRepository,runId:string) {
  const state=await repository.getRunState(runId);
  if(!state) throw new Error("Initialize the exact run with explicit authorization and credit limit before scans");
  return state;
}

type RankedReport = Awaited<ReturnType<typeof getSabRankedCells>>;
type Company = Awaited<ReturnType<SabSheetsRepository["getCompany"]>>;
type DecisionState = NonNullable<SabCompanyUpdates["decision_state"]>;
function reportUrl(report: RankedReport) {
  if (!report.public_url) throw new Error("Provider public report URL is missing; never fabricate a prospect-facing report link");
  return report.public_url;
}
function evidenceHash(report: RankedReport) {
  return createHash("sha256").update(JSON.stringify({report_key: report.report_key, grid: report.grid, cells: report.businesses[0].all_point_rank_cells ?? report.businesses[0].ranked_cells, arp: report.arp, atrp: report.atrp, solv: report.solv})).digest("hex");
}
function legacyRankedCellEvidenceHash(report: RankedReport) {
  return createHash("sha256").update(report.businesses[0].ranked_cells
    .filter(cell => Number.isInteger(cell.rank) && cell.rank >= 1 && cell.rank <= 20)
    .map(cell => [cell.row,cell.column,cell.rank,cell.latitude,cell.longitude].join(","))
    .sort()
    .join("\n"))
    .digest("hex");
}
const centerText = (center: { latitude: number; longitude: number }) => `${center.latitude},${center.longitude}`;
function sameCenter(value: unknown, center: { latitude: number; longitude: number }) {
  if (typeof value !== "string") return false;
  const coordinates = value.split(",").map(Number);
  return coordinates.length === 2 && coordinates[0] === center.latitude && coordinates[1] === center.longitude;
}
function centersWithin(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }, tolerance = 1e-9) {
  return Math.abs(a.latitude - b.latitude) <= tolerance && Math.abs(a.longitude - b.longitude) <= tolerance;
}
function rankedCentroid(cells: Array<{ latitude:number; longitude:number; rank:number }>) {
  const weight=cells.reduce((sum,cell)=>sum+1/cell.rank,0);
  if(!cells.length || !Number.isFinite(weight) || weight<=0) throw new Error("A nonempty exact ranked cluster is required");
  return {latitude:cells.reduce((sum,cell)=>sum+cell.latitude/cell.rank,0)/weight,
    longitude:cells.reduce((sum,cell)=>sum+cell.longitude/cell.rank,0)/weight};
}
function decisionState(row: Company): DecisionState | null {
  return row.decision_state as DecisionState | null;
}
function exclusionDecisionHistory(decision:DecisionState|null) {
  const prior=Array.isArray(decision?.evidence?.exclusion_decision_history) ? decision.evidence.exclusion_decision_history : [];
  return decision?.exclusion_review?.status==="declined" ? [...prior,decision.exclusion_review] : prior;
}
function isDeliverableCenter(value: unknown): value is typeof SAB_CENTER_TYPES[number] {
  return typeof value === "string" && SAB_CENTER_TYPES.includes(value as never) && value !== "master_edge_offset";
}
function assertExactReport(report: RankedReport, key: string, placeId: string, stage: string) {
  if (report.completion_verified !== true || report.completion_status !== "complete") throw new Error("Report completion has not been verified from provider evidence");
  const business = report.businesses[0];
  const exactRosterMatch = report.missing_place_id_count === 0 && report.found_place_id_count === 1 && business?.place_id === placeId && business.evidence_source !== "report_subject_absent_from_competitor_roster";
  const exactUnrankedSubject = stage !== "master" && report.report_subject_place_id === placeId && report.missing_place_id_count === 1 &&
    report.missing_place_ids.length === 1 && report.missing_place_ids[0] === placeId && report.found_place_id_count === 0 &&
    business?.place_id === placeId && business.evidence_source === "report_subject_absent_from_competitor_roster" &&
    business.ranked_cell_count === 0 && business.ranked_cells.length === 0 && business.all_point_rank_cells.length === report.grid.point_count;
  if (report.report_key !== key || (!exactRosterMatch && !exactUnrankedSubject)) {
    throw new Error("Completed report must contain the exact requested report key and Place ID");
  }
  if (stage !== "master" && report.report_subject_place_id !== placeId) throw new Error("Completed report subject does not match exact Place ID");
}
function assertReportPlan(report: RankedReport, scan: SabScanPlan) {
  assertExactReport(report, report.report_key, scan.place_id, scan.scan_role);
  if (report.grid.size !== scan.grid_size || report.grid.radius !== scan.radius ||
      report.grid.center.latitude !== scan.center.latitude || report.grid.center.longitude !== scan.center.longitude ||
      report.keyword !== scan.keyword || report.platform !== scan.platform || report.grid.measurement !== scan.measurement) {
    throw new Error("Completed report does not match the exact authorized scan envelope");
  }
}
function reportResult(report: RankedReport, role: "deliverable" | "auxiliary", type: SabScanPlan["scan_type"], centerType?: typeof SAB_CENTER_TYPES[number]): SabScanResult {
  if (!report.scan_date || !report.keyword) throw new Error("Completed report must provide its actual scan date and keyword");
  return {
    scan_role: role, scan_type: type, arp: report.arp, atrp: report.atrp, solv: report.solv,
    found_in: report.found_in, scan_center: centerText(report.grid.center),
    report_key: report.report_key, report_url: reportUrl(report), scan_date: report.scan_date, scan_keyword: report.keyword,
    ...(centerType ? { center_type: centerType } : {}),
    ...(role === "deliverable" && report.grid.size === 7 && report.grid.measurement === "mi" && [3, 5].includes(report.grid.radius)
      ? { scan_spec: { grid_size: "7x7" as const, radius_miles: report.grid.radius as 3 | 5 } } : {}),
  };
}
function scanForReport(state: SabRunState, reportKey: string, placeId: string) {
  return state.batches.flatMap(batch => batch.scans).find(scan => scan.report_key === reportKey && scan.plan.place_id === placeId && scan.submission_status === "submitted");
}
type CenterValidation = {report_key:string;evidence_hash:string;proposed_center:string;center_type:typeof SAB_CENTER_TYPES[number]};
function validatedThreeMileCenter(state: SabRunState, row: Company): CenterValidation {
  const decision = decisionState(row);
  const saved = decision?.evidence?.center_validation as CenterValidation | undefined;
  const value = saved ?? (decision?.centering_status === "validated" && decision.proposed_center && decision.center_type
    ? {report_key:decision.source_report_key,evidence_hash:decision.evidence_hash,proposed_center:decision.proposed_center,center_type:decision.center_type} : undefined);
  const scan = value && scanForReport(state,value.report_key,row.place_id);
  if (!value || !/^[a-f0-9]{64}$/i.test(value.evidence_hash) || !isDeliverableCenter(value.center_type) ||
      !scan?.completion_verified || scan.plan.scan_role !== "deliverable" || scan.plan.grid_size !== 7 || scan.plan.radius !== 3 || scan.plan.measurement !== "mi" ||
      !sameCenter(value.proposed_center,scan.plan.center)) throw new Error("A five-mile comparison requires preserved validation of a completed same-center three-mile deliverable");
  return value;
}
function assertPaidEligibility(row: Company, state: SabRunState) {
  if(row.business_profile) {
    const profile=sabBusinessProfileSchema.safeParse(row.business_profile);
    if(!profile.success || sabBusinessProfileIssues(profile.data,row.place_id,typeof row.phone==="string"?row.phone:null).length) throw new Error("Resolve the structured enrichment identity or phone conflict before paid scans");
  }
  const eligibility = sabEligibilityStateSchema.safeParse(row.eligibility_state);
  const qualificationStatus=row.qualification_status || null;
  if (row.workflow !== SCALE_FIRST_WORKFLOW || row.address !== SAB_ADDRESS_LABEL ||
      ["disqualified", "deferred"].includes(String(qualificationStatus)) ||
      typeof row.rating !== "number" || !Number.isFinite(row.rating) || row.rating < 4.5 || row.rating > 5 ||
      typeof row.review_count !== "number" || !Number.isSafeInteger(row.review_count) || row.review_count < 1 ||
      row.outcome === "no_visibility_core_found") throw new Error("Paid scans require structured pre-scan eligibility for an active SAB with rating >=4.5 and at least one review");
  if (qualificationStatus === "qualified") {
    const finalDecision = decisionState(row);
    if (row.outcome !== "deliverable" || !row.report_key || finalDecision?.centering_status !== "validated" || finalDecision.outcome !== "deliverable") {
      throw new Error("qualification_status cannot authorize spending; a qualified value is valid only after a completed deliverable");
    }
  } else if (qualificationStatus !== null) {
    throw new Error("Keep qualification_status null while scan work is in progress");
  }
  if (!eligibility.success) throw new Error("Structured SAB, trade, franchise, exact CRM deduplication and contact evidence must be verified before spending");
  const contactResearch=eligibility.data.contact_research;
  if(!contactResearch) throw new Error("Completed structured contact research is required before spending");
  if(contactResearch.evidence_version===3) {
    validateSabContactResearchV3({row,research:contactResearch,contact_tag:row.contact_tag as "Email Ready"|"Needs Email",
      email:typeof row.email==="string"?row.email:null,public_phone_search_authorized:Boolean(state.public_business_phone_search_authorization),
      completed_at:contactResearch.completed_at});
  } else if (contactResearch.exact_phone_fallback.status === "completed" && !state.public_business_phone_search_authorization) {
    throw new Error("Exact-phone contact research requires the run-wide verified public-business-phone authorization");
  }
  if (!((row.contact_tag === "Email Ready" && typeof row.email === "string" && row.email.includes("@") && contactResearch.result==="verified_email") ||
        (row.contact_tag === "Needs Email" && !row.email && typeof row.phone === "string" && row.phone.trim() && contactResearch.result==="exhausted"))) throw new Error("Verified contact and matching contact research are required before spending");
}
function assertDecisionPlan(row: Company, scan: SabScanPlan, hasException: boolean, state: SabRunState) {
  assertPaidEligibility(row,state);
  const decision = decisionState(row), evidence = decision?.evidence;
  if (!decision || !sameCenter(decision.proposed_center, scan.center) || !["planned", "validated"].includes(decision.centering_status)) throw new Error("Scan center must match persisted structured decision evidence");
  const action = evidence?.next_action;
  const correction = evidence?.corroboration_correction as Record<string, unknown> | undefined;
  const correctedAuxiliary = correction?.status === "corrected_rejected" && correction.source_report_key === decision.source_report_key &&
    correction.evidence_hash === decision.evidence_hash && correction.classification === "agent_error" &&
    typeof correction.invalidated_deliverable_report_key === "string" && Number(correction.nearest_ranked_cell_miles) > 3;
  if (scan.scan_role === "auxiliary" && !corroborationAllowsAuxiliary(decision.address_corroboration,decision.source_report_key,decision.evidence_hash) && !correctedAuxiliary) {
    const acceptedRecovery = evidence?.post_deliverable_accepted_corroboration_recovery as Record<string, unknown> | undefined;
    const recoveredAcceptedAuxiliary = decision.address_corroboration?.status === "accepted" &&
      acceptedRecovery?.status === "verified" && acceptedRecovery.master_report_key === decision.source_report_key &&
      acceptedRecovery.master_evidence_hash === decision.evidence_hash &&
      acceptedRecovery.accepted_candidate_reused === true && acceptedRecovery.deliverable_exact_top20_count === 0;
    if (!recoveredAcceptedAuxiliary) throw new Error("Complete structured address corroboration before an unresolved auxiliary; incomplete evaluation or a technical failure cannot authorize paid fallback");
  }
  const miles = scan.measurement === "mi";
  const selectedAuxiliary = evidence?.auxiliary_scan_spec as { scan_type?: string; grid_size?: number; radius?: number; measurement?: string } | undefined;
  const selectedFine = selectedAuxiliary?.scan_type === "fine" && selectedAuxiliary.grid_size === 7 && selectedAuxiliary.radius === 1.5 && selectedAuxiliary.measurement === "mi" && scan.scan_type === "fine" && scan.grid_size === 7 && scan.radius === 1.5;
  const matches = action === "plan_auxiliary" ? scan.scan_role === "auxiliary" && miles && (selectedFine || (!selectedAuxiliary && scan.scan_type === "scout" && scan.grid_size === 9 && scan.radius === 6)) :
    action === "plan_deliverable" ? scan.scan_role === "deliverable" && scan.scan_type === "standard" && scan.grid_size === 7 && scan.radius === 3 && miles :
    action === "same_center_five_mile_comparison" || action === "center_validated" ? scan.scan_role === "deliverable" && scan.scan_type === "standard" && scan.grid_size === 7 && scan.radius === 5 && miles && decision.centering_status === "validated" :
    action === "recenter" || (action === "additional_recenter_exception_required" && hasException) ? scan.scan_role === "deliverable" && scan.scan_type === "recenter" && scan.grid_size === 7 && miles && scan.radius === (evidence?.grid as { radius?: number } | undefined)?.radius : false;
  if (!matches) throw new Error("Requested scan role/type/specification does not match the persisted SOP next action; an exception cannot silently change pending general policy");
}

export async function analyzeAndRecordSabReport(repository: SabSheetsRepository, input: {
  run_id: string; report_key: string; place_id: string; stage: "master" | "auxiliary" | "deliverable";
}, actorEmail: string, verified?: { report: RankedReport; state: SabRunState }) {
  const state = verified?.state ?? await requireRun(repository, input.run_id);
  const report = verified?.report ?? await getSabRankedCells(input.report_key, [input.place_id]);
  assertExactReport(report, input.report_key, input.place_id, input.stage);
  const submitted = state.batches.flatMap(batch => batch.scans).filter(scan => scan.plan.place_id === input.place_id && scan.submission_status === "submitted");
  const ownedScan = scanForReport(state, input.report_key, input.place_id);
  const row = await repository.getCompany(input.place_id);
  const previous = decisionState(row);
  let corroborationCorrection: Record<string, unknown> | undefined;
  if (input.stage === "master") {
    if (submitted.length) {
      const latest = submitted.at(-1)!;
      const eligibilityReferences = ((row as Company & {eligibility_state?:{evidence_references?:unknown}}).eligibility_state?.evidence_references ?? []) as unknown[];
      const guardedRecovery = latest.completion_verified && latest.plan.scan_role === "deliverable" && latest.report_key &&
        previous?.source_report_key === latest.report_key && previous.centering_status === "failed" &&
        previous.evidence?.next_action === "evidence_review_required" && previous.evidence?.exact_top20_count === 0 &&
        !row.report_key && row.center_type === "corroborated_address" && sameCenter(row.scan_center,latest.plan.center) &&
        eligibilityReferences.some(reference => typeof reference === "string" && reference.includes(input.report_key));
      if (!guardedRecovery) throw new Error("Master analysis cannot overwrite newer submitted scan evidence");
      const failed = await getSabRankedCells(latest.report_key!,[input.place_id]);
      assertReportPlan(failed,latest.plan);
      const failedCells = failed.businesses[0].all_point_rank_cells ?? failed.businesses[0].ranked_cells;
      if (failedCells.some(cell => Number.isInteger(cell.rank) && cell.rank >= 1 && cell.rank <= 20)) throw new Error("Guarded master recovery requires an exact zero-top20 failed deliverable");
      const masterCells = report.businesses[0].ranked_cells;
      const distances = evaluateSabCoordinatesAgainstCells(masterCells,report.grid.size,latest.plan.center);
      if (Math.min(distances.weighted_centroid,distances.nearest_ranked_cell,distances.best_rank_cluster_centroid) <= 3) {
        throw new Error("The prior center is not an unmistakable three-mile corroboration contradiction; keep it in evidence review");
      }
      corroborationCorrection = {status:"corrected_rejected",classification:"agent_error",source_report_key:report.report_key,
        evidence_hash:evidenceHash(report),invalidated_deliverable_report_key:latest.report_key,original_center:centerText(latest.plan.center),
        weighted_centroid_miles:distances.weighted_centroid,nearest_ranked_cell_miles:distances.nearest_ranked_cell,
        best_rank_cluster_centroid_miles:distances.best_rank_cluster_centroid,
        original_corroboration_detail_available:false,reason:"The accepted center contradicted every complete-distribution reference by more than the established three-mile fit limit; preserve the completed report as noncanonical history and restore the deterministic master route."};
    }
  } else {
    if (!ownedScan || ownedScan.plan.scan_role !== input.stage || submitted.at(-1)?.report_key !== input.report_key) throw new Error("Analyze the latest submitted report from this exact run; stale or unrelated reports cannot replace its state");
    assertReportPlan(report, ownedScan.plan);
  }
  const recenters = submitted.filter(scan => scan.plan.scan_type === "recenter").length;
  const hash = evidenceHash(report);
  const activeCorroboration = previous?.address_corroboration?.source_report_key === report.report_key && previous.address_corroboration.evidence_hash === hash
    ? previous.address_corroboration : undefined;
  const policyCorroboration = corroborationCorrection ? ({status:"rejected"} as SabAddressCorroboration) : activeCorroboration;
  const decision = analyzeSabScanPolicy({stage: input.stage, cells: report.businesses[0].all_point_rank_cells ?? report.businesses[0].ranked_cells, grid: report.grid,
    rawArp: report.arp, atrp: report.atrp, solv: report.solv, routineRecenterCount: recenters,addressCorroboration:policyCorroboration});
  if (corroborationCorrection && (decision.action !== "plan_auxiliary" || decision.center_source !== "master_edge_offset")) {
    throw new Error("Corrected corroboration did not restore the deterministic truncated-master auxiliary route");
  }
  // Policy classification is not approval to finalize an exclusion.
  if (decision.action === "high_visibility_excluded") {
    decision.action = "high_visibility_exclusion_pending_review";
    decision.evidence.exclusion = {...(decision.evidence.exclusion as Record<string,unknown>),final_disposition:false,requires_matt_review:true};
  }
  const pendingExclusion = decision.action === "high_visibility_exclusion_pending_review";
  if (previous?.exclusion_review?.status === "approved" && previous.source_report_key === report.report_key && previous.evidence_hash === hash) {
    return {report_key: report.report_key, report_url: reportUrl(report), place_id: input.place_id,
      scan_specification: `${report.grid.size}×${report.grid.size}/${report.grid.radius} ${report.grid.measurement}`,
      raw_arp: report.arp, all_point_atrp: report.atrp, solv: report.solv, ...decision,
      evidence: previous.evidence ?? decision.evidence, action: "high_visibility_excluded" as const, reason: "Matt approved this exact report's exclusion at its completed batch checkpoint.", evidence_hash: hash};
  }
  const noVisibility = decision.action === "no_visibility_core_found";
  const isFiveMile = input.stage === "deliverable" && report.grid.size === 7 && report.grid.radius === 5 && report.grid.measurement === "mi";
  const comparisonValidation = isFiveMile ? validatedThreeMileCenter(state,row) : undefined;
  if (comparisonValidation && !sameCenter(comparisonValidation.proposed_center,report.grid.center)) throw new Error("Five-mile variation moved away from the validated three-mile center");
  // Five-mile evidence can propose an exclusion or require policy/evidence
  // review, but does not undo the accepted three-mile center validation.
  const validated = Boolean(comparisonValidation) || ["center_validated", "same_center_five_mile_comparison"].includes(decision.action);
  let centerType: typeof SAB_CENTER_TYPES[number] | undefined;
  if (comparisonValidation) centerType = comparisonValidation.center_type;
  else if (validated) {
    // Validation confirms the existing derivation; it does not invent a recenter.
    if (sameCenter(previous?.proposed_center, report.grid.center) && isDeliverableCenter(previous?.center_type)) centerType = previous.center_type;
    else if (sameCenter(row.scan_center, report.grid.center) && isDeliverableCenter(row.center_type)) centerType = row.center_type;
    else throw new Error("Validated report has no matching structured center derivation; reconcile instead of inventing one");
  } else if (decision.center_source === "master_edge_offset") centerType = "master_edge_offset";
  else if (decision.center_source === "corroborated_address") centerType = "corroborated_address";
  else if (decision.center_source === "ranked_peak_recentered") centerType = "ranked_peak_recentered";
  else if (decision.center_source === "master_centroid") centerType = "weighted_cell_centroid";
  else if (decision.center_source === "auxiliary_centroid") centerType = report.grid.size === 9 ? "scout_recentered" : "fine_scan_recentered";
  const center = comparisonValidation?.proposed_center ?? (decision.proposed_center ? centerText(decision.proposed_center) : undefined);
  const updates: SabCompanyUpdates = {decision_state: {
    source_report_key: report.report_key, rule_id: decision.rule_ids.join(","), evidence_hash: hash,
    centering_status: noVisibility ? "market_reference_only" : validated ? "validated" : center ? "planned" : "failed",
    ...(pendingExclusion ? {exclusion_review: {status: "pending" as const, report_key: report.report_key, evidence_hash: hash}} : {}),
    routine_recenter_count: recenters, ...(center && centerType ? { proposed_center: center, center_type: centerType } : {}),
    ...(previous?.address_corroboration ? {address_corroboration:previous.address_corroboration} : {}),
    ...(noVisibility ? { outcome: "no_visibility_core_found" as const } : validated ? { outcome: "deliverable" as const } : {}),
    evidence: {...decision.evidence, next_action: decision.action, reason: decision.reason, grid: report.grid,
      ...(exclusionDecisionHistory(previous).length ? {exclusion_decision_history:exclusionDecisionHistory(previous)} : {}),
      ...(comparisonValidation ? {center_validation:comparisonValidation} : validated && report.grid.radius === 3 && center && centerType
        ? {center_validation:{report_key:report.report_key,evidence_hash:hash,proposed_center:center,center_type:centerType}} : {}),
      ...(isFiveMile ? {comparison_report_key:report.report_key,centering_evaluated:false} : {}),
      ...(corroborationCorrection ? {corroboration_correction:corroborationCorrection} : {}),
    },
  }};
  if (validated) Object.assign(updates, {outcome: "deliverable", market_reference: null});
  // A planned recenter belongs in decision_state while existing canonical fields
  // continue describing their actual report until a new validated result exists.
  if (center && centerType && !row.report_key) Object.assign(updates, {scan_center: center, center_type: centerType});
  if (noVisibility) {
    if (row.report_key) throw new Error("No-visibility outcome cannot erase an existing canonical report; reconcile the conflict");
    const geocode = await reverseGeocodeSabCenters([{place_id: input.place_id, ...report.grid.center}]);
    const market = geocode.results[0];
    if (market.status !== "complete" || !market.city || !market.state || !market.zip) throw new Error("Auxiliary market reference is incomplete; resolve without guessing");
    Object.assign(updates, {outcome: "no_visibility_core_found", scan_center: null, center_type: null, scan_spec: null,
      scan_keyword: report.keyword, city: market.city, state: market.state, zip: market.zip,
      market_reference: {kind: "market_reference_only", source: "auxiliary_scan_reverse_geocode", ...report.grid.center,
        city: market.city, state: market.state, zip: market.zip, auxiliary_report_key: report.report_key, auxiliary_report_url: reportUrl(report)}});
  }
  if (pendingExclusion) Object.assign(updates, {status: "blocked", blocker: "high_visibility_exclusion_pending_matt_review"});
  else if (isFiveMile && decision.action==="evidence_review_required") Object.assign(updates,{status:"blocked",blocker:"five_mile_comparison_review_required"});
  else if (isFiveMile && decision.action === "comparison_ready" && row.blocker === "five_mile_comparison_review_required") Object.assign(updates,{status:"in_progress",blocker:null});
  if (["address_corroboration_required", "address_corroboration_incomplete"].includes(decision.action)) Object.assign(updates,{status:"blocked",blocker:decision.action});
  else if (typeof row.blocker === "string" && ["address_corroboration_required", "address_corroboration_incomplete"].includes(row.blocker)) Object.assign(updates,{status:"in_progress",blocker:null});
  // An additional recenter is an exception hold, not a change to eligibility.
  if (decision.action === "additional_recenter_exception_required") Object.assign(updates, {blocker: "additional_recenter_requires_explicit_exception"});
  if (ownedScan) {
    const canonicalThree = validated && report.grid.size === 7 && report.grid.radius === 3 && report.grid.measurement === "mi";
    await repository.saveScanResult(input.place_id, reportResult(report, ownedScan.plan.scan_role, ownedScan.plan.scan_type, validated ? centerType : undefined), actorEmail, {historyOnly: !canonicalThree});
  }
  await repository.saveCompany(input.place_id, updates, actorEmail,{corroborationAnalysisVerified:true,
    ...(previous?.exclusion_review?.status==="declined" ? {exclusionDecisionContinued:true} : {})});
  return {report_key: report.report_key, report_url: reportUrl(report), place_id: input.place_id,
    scan_specification: `${report.grid.size}×${report.grid.size}/${report.grid.radius} ${report.grid.measurement}`,
    raw_arp: report.arp, all_point_atrp: report.atrp, solv: report.solv, ...decision, evidence_hash: hash};
}

export function registerSabOrchestrationTools(server:McpServer,factory:SabSheetsRepositoryFactory,actorEmail:string) {
  function add(name:string,description:string,inputSchema:Record<string,z.ZodTypeAny>,handler:(args:any)=>Promise<unknown>) {
    const securitySchemes=[{type:"oauth2",scopes:["sab:read","sab:write"]}];
    const definition = {description,inputSchema,securitySchemes,_meta:{securitySchemes}};
    server.registerTool(name,definition,async args=>result(await handler(args)));
  }
  add("initialize_sab_run","Initialize persistent single-orchestrator state for autonomous operation with an explicit authorized credit ceiling, a pinned governing SOP revision, a hard maximum of 15 paid scans per execution batch, and optional grouped authorization for exact-phone searches using verified publicly listed business numbers only. Read the SOP once before initialization; compare later Drive metadata to this pin and reread only if its revision changes. Never launches scans.",{
    ...run,orchestrator_id:z.string().min(1),authorization_reference:z.string().min(1),credit_limit:z.number().int().positive(),
    sop_revision:z.object({document_id:z.string().trim().min(1),revision_id:z.string().trim().min(1),title:z.string().trim().min(1)}).strict(),
    public_business_phone_search_authorization:matt.optional(),
  },async args=>inSabRunStateQueue(async()=>{
    const repo=factory(args.workflow_sheet,args.sheet_name);if(await repo.getRunState(args.run_id)) throw new Error("Run already exists; read it instead of resetting approvals");
    await repo.assertOneActiveRun(args.run_id);
    const state=createSabRunState(args);await repo.saveRunState(state,null,actorEmail);return state;
  }));
  add("get_sab_run_state","Read authoritative run stages, exact authorizations, committed credits and execution-batch status. Notes are supporting history.",run,async args=>requireRun(factory(args.workflow_sheet,args.sheet_name),args.run_id));
  add("pin_sab_sop_revision","Record the exact Google Drive SOP revision after the orchestrator has read it in full. Use for legacy runs without a pin or only after Drive metadata proves the revision changed and the new revision was reread. Performs no paid work.",{
    ...run,sop_revision:z.object({document_id:z.string().trim().min(1),revision_id:z.string().trim().min(1),title:z.string().trim().min(1)}).strict(),
  },async args=>inSabRunStateQueue(async()=>{
    const repo=factory(args.workflow_sheet,args.sheet_name),state=await requireRun(repo,args.run_id);
    const next=pinSabSopRevision(state,args.sop_revision);await repo.saveRunState(next,state.version,actorEmail);
    return {run_id:args.run_id,sop_revision:next.sop_revision,full_sop_reread_required:false};
  }));
  add("reconcile_sab_ambiguous_submission","Recover one existing ambiguous paid submission without resubmitting or resetting the run. Verify a supplied provider report against the stored exact Place ID, center, keyword, platform and scan specification, bind it to the original durable claim, and preserve committed credits. Performs no paid call.",{
    ...run,orchestrator_id:z.string().min(1),authorization_id:z.string().uuid(),place_id:z.string().min(1),report_key:z.string().regex(/^[a-f0-9]{12,64}$/i),
  },async args=>inSabRunStateQueue(async()=>{
    const repo=factory(args.workflow_sheet,args.sheet_name),state=await requireRun(repo,args.run_id);
    if(args.orchestrator_id!==state.orchestrator_id) throw new Error("Only this run's orchestrator may reconcile an ambiguous submission");
    const batch=state.batches.find(candidate=>candidate.authorization_id===args.authorization_id);
    const scan=batch?.scans.find(candidate=>candidate.plan.place_id===args.place_id);
    if(!scan?.idempotency_key) throw new Error("No matching ambiguous durable claim exists");
    const receipt=await repo.getScanSubmission(args.place_id,scan.idempotency_key);
    const receiptStatus=typeof receipt?.submission_status==="string" ? receipt.submission_status.trim() : "";
    const receiptReportKey=typeof receipt?.report_key==="string" ? receipt.report_key.trim() : "";
    const postProviderReservedClaim=scan.submission_status==="reserved" && batch?.status==="authorized" &&
      (receiptStatus==="submitting" || (receiptStatus==="submitted" && receiptReportKey===args.report_key));
    if(scan.submission_status!=="ambiguous_response" && !postProviderReservedClaim) throw new Error("No matching ambiguous durable claim exists");
    const report=await getSabRankedCells(args.report_key,[args.place_id]);
    assertExactReport(report,args.report_key,args.place_id,scan.plan.scan_role);
    assertReportPlan(report,scan.plan);
    await repo.updateScanSubmission(args.place_id,scan.idempotency_key,{submission_status:"submitted",report_key:args.report_key,
      recovery:"verified_existing_report",reconciled_at:new Date().toISOString()},actorEmail);
    const next=postProviderReservedClaim
      ? recordSabRunSubmission(state,scan.idempotency_key,{submission_status:"submitted",report_key:args.report_key})
      : reconcileSabAmbiguousSubmission(state,args);
    await repo.saveRunState(next,state.version,actorEmail);
    return {run_id:args.run_id,authorization_id:args.authorization_id,place_id:args.place_id,report_key:args.report_key,
      submission_status:"submitted",recovered_existing_claim:true,recovery_source:postProviderReservedClaim?"verified_post_provider_reserved_claim":"ambiguous_response",
      scans_submitted:0,credits_added:0,next_batch_status:next.batches.find(candidate=>candidate.authorization_id===args.authorization_id)?.status};
  }));
  add("authorize_sab_scan_batch","Record the orchestrator's exact SOP-compliant execution batch. Enforces a hard maximum of 15 paid scans while preserving exception and credit limits. This does not submit scans.",{
    ...run,orchestrator_id:z.string().min(1),authorization_id:z.string().uuid(),authorization_reference:z.string().min(1),scans:z.array(plan).min(1).max(15),
    exception:matt.extend({reason:z.string().min(1)}).optional(),
    duplicate_report_checks:z.array(z.object({scan:plan,result:z.literal("none"),evidence_reference:z.string().trim().min(1).max(2000),checked_at:z.string().datetime()}).strict()).min(1).max(15)
      .describe("Plan-bound evidence returned by preflight_sab_local_falcon_batch after an automated read-only search for equivalent pending/completed provider reports. One check is required per exact scan envelope; this remains separate from CRM deduplication."),
  },async args=>inSabRunStateQueue(async()=>{
    const repo=factory(args.workflow_sheet,args.sheet_name),state=await requireRun(repo,args.run_id);
    const checks=args.duplicate_report_checks as NonNullable<SabRunState["batches"][number]["duplicate_report_checks"]>;
    if(checks.length!==args.scans.length || new Set(checks.map(check=>sabScanPlanFingerprint(check.scan))).size!==checks.length) throw new Error("Provide one exact duplicate-report check for every proposed scan");
    for (const scan of args.scans as SabScanPlan[]) {
      if(!checks.some(check=>sabScanPlanFingerprint(check.scan)===sabScanPlanFingerprint(scan))) throw new Error("Duplicate-report evidence does not match the exact proposed scan envelope");
      const row = await repo.getCompany(scan.place_id);
      const latest = state.batches.flatMap(batch => batch.scans).filter(candidate => candidate.plan.place_id === scan.place_id && candidate.submission_status === "submitted").at(-1);
      const currentDecision=decisionState(row),correction=currentDecision?.evidence?.corroboration_correction as Record<string,unknown>|undefined;
      const recovery=currentDecision?.evidence?.post_deliverable_s01_recovery as Record<string,unknown>|undefined;
      const acceptedRecovery=currentDecision?.evidence?.post_deliverable_accepted_corroboration_recovery as Record<string,unknown>|undefined;
      const correctedLatest=latest && correction?.status==="corrected_rejected" && correction.classification==="agent_error" &&
        correction.invalidated_deliverable_report_key===latest.report_key && correction.source_report_key===currentDecision?.source_report_key &&
        correction.evidence_hash===currentDecision?.evidence_hash;
      const recoveredLatest=latest && recovery?.status==="verified" && recovery.intervening_deliverable_report_key===latest.report_key &&
        recovery.master_report_key===currentDecision?.source_report_key && recovery.master_evidence_hash===currentDecision?.evidence_hash &&
        recovery.completed_corroboration==="no_candidate" && recovery.master_centroid_trustworthy===true &&
        currentDecision?.address_corroboration?.status==="no_candidate";
      const recoveredAcceptedLatest=latest && acceptedRecovery?.status==="verified" &&
        acceptedRecovery.intervening_deliverable_report_key===latest.report_key &&
        acceptedRecovery.master_report_key===currentDecision?.source_report_key &&
        acceptedRecovery.master_evidence_hash===currentDecision?.evidence_hash &&
        acceptedRecovery.deliverable_exact_top20_count===0 && acceptedRecovery.accepted_candidate_reused===true &&
        currentDecision?.address_corroboration?.status==="accepted";
      if (latest && currentDecision?.source_report_key !== latest.report_key && !correctedLatest && !recoveredLatest && !recoveredAcceptedLatest) throw new Error("A paid plan cannot use a stale source decision after newer scan evidence exists");
      if (scan.scan_role === "deliverable" && scan.grid_size === 7 && scan.radius === 5 && scan.measurement === "mi") {
        if (scan.scan_type !== "standard") throw new Error("A five-mile variation is a comparison, never a recenter");
        const prior = state.batches.flatMap(batch=>batch.scans).filter(candidate=>candidate.plan.place_id===scan.place_id);
        if (prior.some(candidate=>candidate.plan.scan_role==="deliverable" && candidate.plan.radius===5 && candidate.plan.measurement==="mi")) throw new Error("Only one five-mile comparison is permitted per company; never widen or repeat it automatically");
        const validation = validatedThreeMileCenter(state,row);
        const three = scanForReport(state,validation.report_key,scan.place_id)!;
        if (!sameCenter(validation.proposed_center,scan.center) || three.plan.keyword!==scan.keyword || three.plan.platform!==scan.platform) throw new Error("Five-mile comparison must preserve the validated three-mile center, keyword and platform");
      }
      assertDecisionPlan(row, scan, Boolean(args.exception),state);
    }
    const next=authorizeSabScanBatch(state,args);next.batches[next.batches.length-1].duplicate_report_checks=checks;
    await repo.saveRunState(next,state.version,actorEmail);return {state:next,scan_approved:true,paid_scans_submitted:0};
  }));
  add("analyze_sab_scan","Read exact completed report cells server-side, apply SOP decision precedence and persist structured decision evidence. Returns compact evidence only, not raw cells. Does not authorize or launch scans.",{
    ...run,report_key:z.string().regex(/^[a-f0-9]{12,64}$/i),place_id:z.string().min(1),stage:z.enum(["master","auxiliary","deliverable"]),
  },async args=>inSabRunStateQueue(async()=>analyzeAndRecordSabReport(factory(args.workflow_sheet,args.sheet_name),args,actorEmail)));
  add("record_sab_address_corroboration","Record required address corroboration before an unresolved master-center auxiliary. A temporary candidate is geocoded privately against the exact completed report; persist only identity/fit evidence and coordinates, never the address. No-candidate requires completed genuine research with sources. A guarded post-deliverable S01 recovery may name the exact intervening deliverable; it verifies both reports, zero deliverable visibility, terminal evidence ordering, and either a trustworthy no-candidate master-centroid plan or reuse of the existing accepted corroborated candidate for one wide auxiliary. Incomplete geocoding or technical failure holds this company and never becomes paid auxiliary permission. Does not submit scans.",{
    ...run,orchestrator_id:z.string().min(1),place_id:z.string().min(1),report_key:z.string().regex(/^[a-f0-9]{12,64}$/i),
    intervening_deliverable_report_key:z.string().regex(/^[a-f0-9]{12,64}$/i).optional(),
    research_complete:z.boolean(),evidence_references:z.array(z.string().trim().min(1).max(2000)).min(1).max(20),
    source_type:z.string().trim().min(1).max(200),identity_method:z.string().trim().min(1).max(500),fit_rationale:z.string().trim().min(1).max(2000),
    result:z.enum(["no_candidate","candidate"]),candidate_address:z.string().trim().min(1).max(2000).optional(),fit_decision:z.enum(["accepted","rejected"]).optional(),
  },async args=>inSabRunStateQueue(async()=>{
    const repo=factory(args.workflow_sheet,args.sheet_name),state=await requireRun(repo,args.run_id),row=await repo.getCompany(args.place_id),previous=decisionState(row);
    if(args.orchestrator_id!==state.orchestrator_id) throw new Error("Only the run's orchestrator may record a corroboration disposition");
    if(args.intervening_deliverable_report_key) {
      const reuseAccepted = args.result==="candidate" && args.fit_decision==="accepted" && !args.candidate_address && args.research_complete;
      const completedNoCandidate = args.result==="no_candidate" && !args.candidate_address && !args.fit_decision && args.research_complete;
      if(!reuseAccepted && !completedNoCandidate) throw new Error("Post-deliverable S01 recovery requires completed no-candidate corroboration or reuse of the existing accepted corroborated candidate");
      if(!previous || previous.exclusion_review || previous.address_corroboration?.status==="incomplete" ||
          previous.source_report_key!==args.intervening_deliverable_report_key || (row.report_key && row.report_key!==args.intervening_deliverable_report_key) ||
          previous.centering_status!=="failed" || previous.evidence?.exact_top20_count!==0) {
        throw new Error("Post-deliverable S01 recovery must begin from the exact current failed zero-visibility deliverable decision");
      }
      const scans=state.batches.flatMap(batch=>batch.scans).filter(scan=>scan.plan.place_id===args.place_id);
      const intervening=scans.find(scan=>scan.report_key===args.intervening_deliverable_report_key);
      if(!intervening || scans.at(-1)!==intervening || intervening.submission_status!=="submitted" || !intervening.completion_verified ||
          intervening.plan.scan_role!=="deliverable") throw new Error("The exact intervening deliverable must be the terminal completed scan with no later claim");
      const [master,deliverable]=await Promise.all([
        getSabRankedCells(args.report_key,[args.place_id]),
        getSabRankedCells(args.intervening_deliverable_report_key,[args.place_id]),
      ]);
      assertExactReport(master,args.report_key,args.place_id,"master");
      assertReportPlan(deliverable,intervening.plan);
      const deliverableHash=evidenceHash(deliverable);
      if(previous.evidence_hash!==deliverableHash) throw new Error("No later evidence may supersede the exact intervening deliverable");
      const deliverableCells=deliverable.businesses[0].all_point_rank_cells ?? deliverable.businesses[0].ranked_cells;
      const deliverableTop20=deliverableCells.filter(cell=>Number.isInteger(cell.rank) && cell.rank>=1 && cell.rank<=20).length;
      if(deliverableCells.length!==deliverable.grid.point_count || deliverableTop20!==0) throw new Error("Post-deliverable S01 recovery requires a complete exact zero-top20 deliverable");
      const masterHash=evidenceHash(master);
      if(reuseAccepted) {
        const corroboration=previous.address_corroboration;
        if(!corroboration || corroboration.status!=="accepted" || !corroboration.candidate_coordinates ||
            corroboration.source_report_key!==args.report_key || corroboration.evidence_hash!==masterHash) {
          throw new Error("Accepted-candidate recovery requires the exact previously verified master corroboration evidence");
        }
        const center=centerText(corroboration.candidate_coordinates);
        const recovery={status:"verified",master_report_key:args.report_key,master_evidence_hash:masterHash,
          intervening_deliverable_report_key:args.intervening_deliverable_report_key,deliverable_evidence_hash:deliverableHash,
          deliverable_exact_top20_count:deliverableTop20,accepted_candidate_reused:true,auxiliary_scan_spec:{scan_type:"scout",grid_size:9,radius:6,measurement:"mi"}};
        const next:DecisionState={source_report_key:args.report_key,rule_id:"S01,S03",evidence_hash:masterHash,
          centering_status:"planned",routine_recenter_count:scans.filter(scan=>scan.plan.scan_type==="recenter").length,
          proposed_center:center,center_type:"corroborated_address",address_corroboration:corroboration,
          evidence:{next_action:"plan_auxiliary",reason:"The accepted corroborated candidate remains authoritative after the same-center deliverable returned zero exact top-20 pins. Use one 9×9/6-mile scout at that accepted center to resolve visibility without discarding or relabelling the accepted evidence.",grid:master.grid,
            post_deliverable_accepted_corroboration_recovery:recovery}};
        await repo.saveCompany(args.place_id,{decision_state:next,status:"in_progress",blocker:null},actorEmail,{postDeliverableAcceptedCorroborationRecoveryVerified:true});
        return {report_key:master.report_key,report_url:reportUrl(master),place_id:args.place_id,
          scan_specification:`${master.grid.size}×${master.grid.size}/${master.grid.radius} ${master.grid.measurement}`,
          raw_arp:master.arp,all_point_atrp:master.atrp,solv:master.solv,action:"plan_auxiliary",rule_ids:["S01","S03"],
          reason:next.evidence?.reason,proposed_center:corroboration.candidate_coordinates,center_source:"corroborated_address",
          evidence:{auxiliary_scan_spec:recovery.auxiliary_scan_spec},evidence_hash:masterHash,address_corroboration:corroboration,
          post_deliverable_accepted_corroboration_recovery:recovery,paid_scans_submitted:0};
      }
      const corroboration=sabAddressCorroborationSchema.parse({source_report_key:args.report_key,evidence_hash:masterHash,status:"no_candidate",
        research_complete:true,evidence_references:args.evidence_references,source_type:args.source_type,identity_method:args.identity_method,fit_rationale:args.fit_rationale});
      const decision=analyzeSabScanPolicy({stage:"master",cells:master.businesses[0].all_point_rank_cells ?? master.businesses[0].ranked_cells,
        grid:master.grid,rawArp:master.arp,atrp:master.atrp,solv:master.solv,routineRecenterCount:scans.filter(scan=>scan.plan.scan_type==="recenter").length,
        addressCorroboration:corroboration});
      if(decision.action!=="plan_deliverable" || decision.center_source!=="master_centroid" || !decision.proposed_center ||
          (decision.evidence.master as {baseline_centroid_trustworthy?:boolean}|undefined)?.baseline_centroid_trustworthy!==true) {
        throw new Error("The exact master report no longer supports a trustworthy S01 centroid plan");
      }
      const center=centerText(decision.proposed_center);
      const recovery={status:"verified",master_report_key:args.report_key,master_evidence_hash:masterHash,
        intervening_deliverable_report_key:args.intervening_deliverable_report_key,deliverable_evidence_hash:deliverableHash,
        deliverable_exact_top20_count:deliverableTop20,master_centroid_trustworthy:true,completed_corroboration:"no_candidate"};
      const next:DecisionState={source_report_key:args.report_key,rule_id:decision.rule_ids.join(","),evidence_hash:masterHash,
        centering_status:"planned",routine_recenter_count:scans.filter(scan=>scan.plan.scan_type==="recenter").length,
        proposed_center:center,center_type:"weighted_cell_centroid",address_corroboration:corroboration,
        evidence:{...decision.evidence,next_action:decision.action,reason:decision.reason,grid:master.grid,post_deliverable_s01_recovery:recovery}};
      await repo.saveCompany(args.place_id,{decision_state:next,status:"in_progress",blocker:null},actorEmail,{postDeliverableS01RecoveryVerified:true});
      return {report_key:master.report_key,report_url:reportUrl(master),place_id:args.place_id,
        scan_specification:`${master.grid.size}×${master.grid.size}/${master.grid.radius} ${master.grid.measurement}`,
        raw_arp:master.arp,all_point_atrp:master.atrp,solv:master.solv,...decision,evidence_hash:masterHash,
        address_corroboration:corroboration,post_deliverable_s01_recovery:recovery,paid_scans_submitted:0};
    }
    if(!previous || previous.source_report_key!==args.report_key || previous.exclusion_review) throw new Error("Corroboration must reference the current reconciled master decision without an exclusion hold");
    if(state.batches.some(batch=>batch.scans.some(scan=>scan.plan.place_id===args.place_id))) throw new Error("Address corroboration cannot replace an already authorized or submitted scan plan");
    if(args.result==="no_candidate" && (!args.research_complete || args.candidate_address || args.fit_decision)) throw new Error("No-candidate disposition requires completed research and no unevaluated candidate");
    if(args.result==="candidate" && (!args.candidate_address || !args.fit_decision)) throw new Error("A candidate requires an ephemeral address and the orchestrator's complete-distribution fit decision");
    if(args.candidate_address && JSON.stringify([args.evidence_references,args.source_type,args.identity_method,args.fit_rationale]).includes(args.candidate_address)) throw new Error("Keep the temporary hidden address out of persistent source and fit descriptions");
    if(args.result==="no_candidate" && previous.address_corroboration?.status === "incomplete") throw new Error("Resolve the incomplete candidate evaluation; a known partial candidate cannot be relabelled as no candidate");
    const base={source_report_key:args.report_key,evidence_hash:previous.evidence_hash,evidence_references:args.evidence_references,
      source_type:args.source_type,identity_method:args.identity_method,fit_rationale:args.fit_rationale,research_complete:args.research_complete};
    let evidence:SabAddressCorroboration={...base,status:"technical_failure",fit_rationale:"Address or ranked-evidence evaluation could not be completed. Resolve the technical issue; no paid fallback is authorized."},report:RankedReport|undefined,legacyHashCompatibilityVerified=false;
    try {
      report=await getSabRankedCells(args.report_key,[args.place_id]);assertExactReport(report,args.report_key,args.place_id,"master");
    } catch {
      // Do not include provider errors, request URLs or the temporary address.
      evidence={...base,status:"technical_failure",fit_rationale:"Address or ranked-evidence evaluation could not be completed. Resolve the technical issue; no paid fallback is authorized."};
      report=undefined;
    }
    if(report) {
      const currentHash=evidenceHash(report),legacyHash=legacyRankedCellEvidenceHash(report);
      if(previous.evidence_hash!==currentHash && previous.evidence_hash!==legacyHash) {
        throw new Error("Address corroboration hash compatibility verification failed: the stored evidence hash matches neither the current full-report hash nor the verified legacy ranked-cell hash");
      }
      legacyHashCompatibilityVerified=previous.evidence_hash===legacyHash && previous.evidence_hash!==currentHash;
      const verifiedBase={...base,evidence_hash:currentHash};
      if(args.result==="no_candidate") evidence={...verifiedBase,status:"no_candidate"};
      else try {
        const evaluated=await evaluateSabAddressCandidate(args.report_key,args.place_id,args.candidate_address,{rankedCells:async()=>report!});
        const complete=evaluated.status==="complete" && !evaluated.geocoder.partial_match;
        const unmistakableContradiction=args.fit_decision==="accepted" && complete &&
          Math.min(evaluated.distances_miles.weighted_centroid,evaluated.distances_miles.nearest_ranked_cell,evaluated.distances_miles.best_rank_cluster_centroid)>3;
        // Preserve orchestrator judgment near the approximate threshold, but
        // never accept a candidate beyond every complete-distribution
        // reference. That is an objective contradiction, not a shape tie.
        evidence={...verifiedBase,...(unmistakableContradiction?{fit_rationale:"Server rejected the proposed acceptance because every complete-distribution reference exceeded the established three-mile fit limit."}:{}),
          status:!complete?"incomplete":unmistakableContradiction?"rejected":args.fit_decision,
          candidate_coordinates:evaluated.candidate_coordinates,geocoder:{location_type:evaluated.geocoder.location_type,partial_match:evaluated.geocoder.partial_match},
          distances_miles:evaluated.distances_miles};
      } catch {
        // Preserve the legacy hash on a provider/evaluator failure so a later
        // retry must re-verify the same report before migration.
        evidence={...base,status:"technical_failure",fit_rationale:"Address or ranked-evidence evaluation could not be completed. Resolve the technical issue; no paid fallback is authorized."};
        report=undefined;
      }
    }
    evidence=sabAddressCorroborationSchema.parse(evidence);
    const incomplete=["incomplete","technical_failure"].includes(evidence.status);
    await repo.saveCompany(args.place_id,{decision_state:{...previous,evidence_hash:evidence.evidence_hash,address_corroboration:evidence,
      ...(incomplete?{centering_status:"failed" as const,evidence:{...previous.evidence,next_action:"address_corroboration_incomplete"}}:{})},
      ...(incomplete?{status:"blocked" as const,blocker:"address_corroboration_incomplete"}:{})},actorEmail,{corroborationRecorded:true,legacyHashCompatibilityVerified});
    if(!report) return {place_id:args.place_id,address_corroboration:evidence,action:"address_corroboration_incomplete",paid_scans_submitted:0};
    const decision=await analyzeAndRecordSabReport(repo,{run_id:args.run_id,report_key:args.report_key,place_id:args.place_id,stage:"master"},actorEmail,{report,state});
    return {...decision,address_corroboration:evidence,paid_scans_submitted:0};
  }));
  add("approve_sab_canonical_evidence_exception","Apply Matt's named run-specific decision to preserve one completed 7x7/3-mile deliverable as canonical only when current S04/S05 evidence proves the selected peak is already at the exact scan center and no supported recenter movement exists. This includes a terminal standard or recenter deliverable whose stale next action requests another recenter at the same center. Re-verifies the report, run ownership, terminal evidence ordering and approval; preserves the failed-margin evidence and full scan history. Creates no general policy and submits no scan.",{
    ...run,orchestrator_id:z.string().min(1),place_id:z.string().min(1),report_key:z.string().regex(/^[a-f0-9]{12,64}$/i),
    evidence_hash:z.string().regex(/^[a-f0-9]{64}$/i),reason:z.string().trim().min(1).max(2000),approval:matt,
  },async args=>inSabRunStateQueue(async()=>{
    const repo=factory(args.workflow_sheet,args.sheet_name),state=await requireRun(repo,args.run_id),row=await repo.getCompany(args.place_id);
    if(args.orchestrator_id!==state.orchestrator_id) throw new Error("Only this run's orchestrator may apply a named canonical evidence exception");
    const previous=decisionState(row),owned=scanForReport(state,args.report_key,args.place_id);
    const companyScans=state.batches.flatMap(batch=>batch.scans).filter(scan=>scan.plan.place_id===args.place_id && scan.submission_status==="submitted");
    if(!owned || companyScans.at(-1)!==owned || !owned.completion_verified || owned.plan.scan_role!=="deliverable" ||
        !["standard","recenter"].includes(owned.plan.scan_type) || owned.plan.grid_size!==7 || owned.plan.radius!==3 || owned.plan.measurement!=="mi") {
      throw new Error("The named exception requires the terminal completed 7x7/3-mile deliverable from this run");
    }
    const report=await getSabRankedCells(args.report_key,[args.place_id]);assertReportPlan(report,owned.plan);
    const hash=evidenceHash(report);
    if(!previous?.evidence) throw new Error("Approval must match the current exact S04/S05 evidence-review report and hash");
    const previousEvidence=previous.evidence;
    const priorAction=previousEvidence.next_action;
    const exceptionReady=(previous.centering_status==="failed" && priorAction==="evidence_review_required") ||
      (previous.centering_status==="planned" && priorAction==="additional_recenter_exception_required");
    if(hash!==args.evidence_hash || previous.source_report_key!==args.report_key || previous.evidence_hash!==hash || !exceptionReady ||
        !String(previous.rule_id).split(",").includes("S05")) throw new Error("Approval must match the current exact S04/S05 centered-peak report and hash");
    const policy=analyzeSabScanPolicy({stage:"deliverable",cells:report.businesses[0].all_point_rank_cells ?? report.businesses[0].ranked_cells,
      grid:report.grid,rawArp:report.arp,atrp:report.atrp,solv:report.solv,routineRecenterCount:companyScans.filter(scan=>scan.plan.scan_type==="recenter").length,
      addressCorroboration:previous.address_corroboration});
    const peak=policy.evidence.peak as {movement_miles?:unknown;displaced_peak?:unknown;selected_peak?:{row?:unknown;column?:unknown}}|undefined;
    const middle=(report.grid.size+1)/2;
    const movement=Number(peak?.movement_miles);
    if(!["evidence_review_required","additional_recenter_exception_required"].includes(policy.action) || !policy.rule_ids.includes("S05") ||
        !Number.isFinite(movement) || Math.abs(movement)>1e-6 || peak?.displaced_peak!==false ||
        peak?.selected_peak?.row!==middle || peak?.selected_peak?.column!==middle) {
      throw new Error("The report no longer proves the exact centered-peak/no-movement evidence exception");
    }
    if(!sameCenter(row.scan_center,report.grid.center) || !isDeliverableCenter(row.center_type)) throw new Error("The exception cannot invent or change the existing center derivation");
    const exception={kind:"canonical_centered_peak_no_movement",scope:"named_run_specific",approved_by:"Matt",approval_reference:args.approval.approval_reference,
      reason:args.reason,report_key:args.report_key,evidence_hash:hash,original_next_action:previousEvidence.next_action,
      original_reason:previousEvidence.reason,approved_at:new Date().toISOString(),creates_general_policy:false};
    const center=centerText(report.grid.center),centerType=row.center_type;
    const next:DecisionState={...previous,centering_status:"validated",proposed_center:center,center_type:centerType,outcome:"deliverable",
      evidence:{...previousEvidence,next_action:"center_validated",reason:args.reason,run_specific_exception:exception,
        center_validation:{report_key:args.report_key,evidence_hash:hash,proposed_center:center,center_type:centerType}}};
    await repo.saveScanResult(args.place_id,reportResult(report,"deliverable",owned.plan.scan_type,centerType),actorEmail);
    await repo.saveCompany(args.place_id,{decision_state:next,outcome:"deliverable",status:"in_progress",blocker:null},actorEmail,{runSpecificCanonicalExceptionVerified:true});
    const verified=await repo.getCompany(args.place_id),verifiedDecision=decisionState(verified);
    if(verified.report_key!==args.report_key || verifiedDecision?.centering_status!=="validated" ||
        (verifiedDecision.evidence?.run_specific_exception as {evidence_hash?:unknown}|undefined)?.evidence_hash!==hash) throw new Error("Canonical exception readback failed");
    return {place_id:args.place_id,report_key:args.report_key,report_url:reportUrl(report),canonical_persisted:true,
      center_validated_by_named_exception:true,preserved_s05_evidence:true,paid_scans_submitted:0,creates_general_policy:false};
  }));
  add("approve_sab_master_cluster_exception","Apply Matt's named run-specific S01 decision to disregard one exact isolated outlier cluster and plan one standard 7x7/3-mile deliverable at the independently recomputed dominant-cluster 1/rank centroid. Re-verifies the master report, cluster geometry, no-candidate corroboration, exact approved center and absence of later scans. Creates no general policy and does not submit the scan.",{
    ...run,orchestrator_id:z.string().min(1),place_id:z.string().min(1),report_key:z.string().regex(/^[a-f0-9]{12,64}$/i),
    evidence_hash:z.string().regex(/^[a-f0-9]{64}$/i),center:z.object({latitude:z.number().finite().min(-90).max(90),longitude:z.number().finite().min(-180).max(180)}).strict(),
    dominant_cluster_size:z.number().int().positive(),outlier_cluster_size:z.literal(1),outlier_rank:z.number().int().min(1).max(20),
    reason:z.string().trim().min(1).max(2000),approval:matt,
  },async args=>inSabRunStateQueue(async()=>{
    const repo=factory(args.workflow_sheet,args.sheet_name),state=await requireRun(repo,args.run_id),row=await repo.getCompany(args.place_id),previous=decisionState(row);
    if(args.orchestrator_id!==state.orchestrator_id) throw new Error("Only this run's orchestrator may apply a named master-cluster exception");
    if(state.batches.some(batch=>batch.scans.some(scan=>scan.plan.place_id===args.place_id))) throw new Error("The master-cluster exception requires no existing scan claim for this company");
    const report=await getSabRankedCells(args.report_key,[args.place_id]);assertExactReport(report,args.report_key,args.place_id,"master");
    const hash=evidenceHash(report);
    if(!previous) throw new Error("Approval must match the current exact S01 disconnected-cluster evidence and completed no-candidate corroboration");
    if(hash!==args.evidence_hash || previous.source_report_key!==args.report_key || previous.evidence_hash!==hash || previous.rule_id!=="S01" ||
        previous.centering_status!=="failed" || previous.evidence?.next_action!=="evidence_review_required" ||
        previous.address_corroboration?.status!=="no_candidate" || previous.address_corroboration.research_complete!==true) {
      throw new Error("Approval must match the current exact S01 disconnected-cluster evidence and completed no-candidate corroboration");
    }
    const clusters=sabRankedClusters(exactSabTop20Cells(report.businesses[0].ranked_cells)).sort((a,b)=>b.length-a.length);
    if(clusters.length!==2 || clusters[0].length!==args.dominant_cluster_size || clusters[1].length!==args.outlier_cluster_size ||
        clusters[1][0].rank!==args.outlier_rank) throw new Error("Current master cluster geometry does not match Matt's named exception");
    const computed=rankedCentroid(clusters[0]);
    if(!centersWithin(computed,args.center)) throw new Error("Approved center does not match the independently recomputed dominant-cluster centroid");
    const exception={kind:"master_singleton_outlier",scope:"named_run_specific",approved_by:"Matt",approval_reference:args.approval.approval_reference,
      reason:args.reason,report_key:args.report_key,evidence_hash:hash,dominant_cluster_size:clusters[0].length,outlier_cluster_size:clusters[1].length,
      outlier_rank:clusters[1][0].rank,approved_center:centerText(args.center),approved_at:new Date().toISOString(),creates_general_policy:false};
    const next:DecisionState={...previous,centering_status:"planned",proposed_center:centerText(args.center),center_type:"weighted_cell_centroid",
      evidence:{...previous.evidence,next_action:"plan_deliverable",reason:args.reason,run_specific_exception:exception,
        dominant_cluster_centroid:computed,deliverable_scan_spec:{scan_type:"standard",grid_size:7,radius:3,measurement:"mi"}}};
    await repo.saveCompany(args.place_id,{decision_state:next,scan_center:centerText(args.center),center_type:"weighted_cell_centroid",status:"in_progress",blocker:null},actorEmail,{runSpecificMasterClusterExceptionVerified:true});
    const verified=decisionState(await repo.getCompany(args.place_id));
    if(verified?.centering_status!=="planned" || verified.proposed_center!==centerText(args.center) ||
        (verified.evidence?.run_specific_exception as {evidence_hash?:unknown}|undefined)?.evidence_hash!==hash) throw new Error("Master-cluster exception readback failed");
    return {place_id:args.place_id,report_key:args.report_key,action:"plan_deliverable",proposed_center:args.center,center_type:"weighted_cell_centroid",
      scan_specification:"7x7/3 mi",dominant_cluster_size:clusters[0].length,outlier_cluster_size:clusters[1].length,outlier_rank:clusters[1][0].rank,
      paid_scans_submitted:0,creates_general_policy:false};
  }));
  add("review_sab_completed_batch","Verify every submitted report, persist structured decisions, return one concise result row per completed scan plus genuine exceptions, and continue autonomously without requesting routine approval.",run,async args=>inSabRunStateQueue(async()=>{
    const repo=factory(args.workflow_sheet,args.sheet_name),state=await requireRun(repo,args.run_id),batch=state.batches.at(-1);
    if(!batch) throw new Error("No submitted scan batch");
    const table:Array<Record<string,any>>=[];
    // Verify all provider envelopes before any completion transition. Fetch each
    // report once and reuse that verified evidence when persisting decisions.
    const reports = await Promise.all(batch.scans.map(async scan => {
      if (!scan.report_key || scan.submission_status !== "submitted") throw new Error("Batch has unsubmitted or ambiguous scans; reconcile before completion");
      const report = await getSabRankedCells(scan.report_key,[scan.plan.place_id]);
      assertExactReport(report, scan.report_key, scan.plan.place_id, scan.plan.scan_role);
      assertReportPlan(report, scan.plan);
      return report;
    }));
    for (const [index, scan] of batch.scans.entries()) {
      const decision = await analyzeAndRecordSabReport(repo, {run_id: args.run_id, report_key: scan.report_key!, place_id: scan.plan.place_id, stage: scan.plan.scan_role}, actorEmail, {report: reports[index], state});
      const row=await repo.getCompany(scan.plan.place_id);
      if (decisionState(row)?.evidence_hash !== decision.evidence_hash || decisionState(row)?.source_report_key !== scan.report_key) throw new Error("Critical stage readback did not retain the verified decision evidence");
      table.push({company:row.company,report_url:reportUrl(reports[index]),scan_specification:decision.scan_specification,
        result:{classification:decision.action,measured_values:{
          exact_top20_count:decision.evidence.exact_top20_count,point_count:decision.evidence.point_count,
          top20_coverage:decision.evidence.coverage,raw_arp:decision.raw_arp,all_point_atrp:decision.all_point_atrp,solv:decision.solv,
          saturation:decision.evidence.saturation ?? null,centering:decision.evidence.peak ?? null,exclusion:decision.evidence.exclusion ?? null,
        }},proposed_next_step_and_reason:decision.reason,sop_rule:decision.rule_ids.join(", ")});
    }
    const next=completeSabRunReports(state,batch.scans.map(s=>s.report_key!));await repo.saveRunState(next,state.version,actorEmail);
    const exceptions=table.filter(row=>isNormalModeException(row.result.classification));
    const classification_counts=Object.fromEntries([...new Set(table.map(row=>row.result.classification))].sort().map(classification=>[
      classification,table.filter(row=>row.result.classification===classification).length,
    ]));
    return {stop_before_further_scans:false,matt_review_required:false,
      batch_summary:{report_count:table.length,classification_counts,exception_count:exceptions.length},scan_results:table,exceptions,
      routine_results_persisted:table.length-exceptions.length,full_histories_returned:false,continue_unaffected_work:true,
      next_action:exceptions.length?"resolve_listed_genuine_exceptions; continue_all_unaffected_work":"continue_autonomously"};
  }));
  add("approve_sab_exclusion","Finalize only Matt's explicitly approved exclusion from a completed batch checkpoint. Bind approval to exact Place ID, report and evidence hash; this never approves further scans or changes general policy.",{
    ...run,orchestrator_id:z.string().min(1),place_id:z.string().min(1),report_key:z.string().regex(/^[a-f0-9]{12,64}$/i),
    evidence_hash:z.string().regex(/^[a-f0-9]{64}$/i),approval:matt,
  },async args=>inSabRunStateQueue(async()=>{
    const repo=factory(args.workflow_sheet,args.sheet_name),state=await requireRun(repo,args.run_id);
    if(args.orchestrator_id!==state.orchestrator_id) throw new Error("Only this run's orchestrator may record Matt's exclusion approval");
    const row=await repo.getCompany(args.place_id),decision=decisionState(row);
    const scans=state.batches.flatMap(batch=>batch.scans).filter(scan=>scan.plan.place_id===args.place_id && scan.submission_status==="submitted");
    const scan=scans.at(-1);
    if(!scan?.completion_verified || scan.report_key!==args.report_key) throw new Error("Complete the latest scan's batch checkpoint before approving its exclusion");
    if(!decision || decision.source_report_key!==args.report_key || decision.evidence_hash!==args.evidence_hash ||
       !decision.exclusion_review || decision.exclusion_review.report_key!==args.report_key || decision.exclusion_review.evidence_hash!==args.evidence_hash) throw new Error("Exclusion approval must match the current report and evidence hash");
    if(decision.exclusion_review.status==="approved") return {place_id:args.place_id,report_key:args.report_key,exclusion_finalized:true,already_approved:true,paid_scans_submitted:0};
    if(decision.exclusion_review.status!=="pending" || decision.evidence?.next_action!=="high_visibility_exclusion_pending_review") throw new Error("No matching pending exclusion exists");
    await repo.saveCompany(args.place_id,{decision_state:{...decision,outcome:"existing_visibility_too_strong",
      exclusion_review:{status:"approved",report_key:args.report_key,evidence_hash:args.evidence_hash,...args.approval},
      evidence:{...decision.evidence,next_action:"high_visibility_excluded",exclusion:{...(decision.evidence?.exclusion as Record<string,unknown> ?? {}),final_disposition:true,requires_matt_review:false}}},qualification_status:"disqualified",
      qualification_reason:"existing_visibility_too_strong",status:"complete",blocker:null},actorEmail,{exclusionReviewApproved:true});
    const verified=decisionState(await repo.getCompany(args.place_id));
    if(verified?.exclusion_review?.status!=="approved" || verified.evidence_hash!==args.evidence_hash) throw new Error("Exclusion approval readback failed; reconcile before continuing");
    return {place_id:args.place_id,report_key:args.report_key,exclusion_finalized:true,paid_scans_submitted:0,continue_unaffected_work:true};
  }));
  add("decline_sab_exclusion","Record Matt's explicit decline of an exact pending S02 or S09 high-visibility proposal after its completed batch checkpoint. Resume only the deterministic follow-up already supported by that evidence; never submit a scan, invalidate a validated center or change general policy.",{
    ...run,orchestrator_id:z.string().min(1),place_id:z.string().min(1),report_key:z.string().regex(/^[a-f0-9]{12,64}$/i),
    evidence_hash:z.string().regex(/^[a-f0-9]{64}$/i),decision:matt,
  },async args=>inSabRunStateQueue(async()=>{
    const repo=factory(args.workflow_sheet,args.sheet_name),state=await requireRun(repo,args.run_id);
    if(args.orchestrator_id!==state.orchestrator_id) throw new Error("Only this run's orchestrator may record Matt's exclusion decline");
    const row=await repo.getCompany(args.place_id),decision=decisionState(row);
    const scans=state.batches.flatMap(batch=>batch.scans).filter(scan=>scan.plan.place_id===args.place_id && scan.submission_status==="submitted");
    const scan=scans.at(-1);
    if(!scan?.completion_verified || scan.report_key!==args.report_key) throw new Error("Complete the latest scan's batch checkpoint before declining its exclusion");
    const review=decision?.exclusion_review;
    if(!decision || !review || decision.source_report_key!==args.report_key || decision.evidence_hash!==args.evidence_hash ||
       review.report_key!==args.report_key || review.evidence_hash!==args.evidence_hash) {
      throw new Error("Exclusion decline must match the current report and evidence hash");
    }
    if(review.status==="declined") return {place_id:args.place_id,report_key:args.report_key,exclusion_declined:true,already_declined:true,paid_scans_submitted:0};
    if(review.status!=="pending" || decision.evidence?.next_action!=="high_visibility_exclusion_pending_review") throw new Error("No matching pending exclusion exists");
    const exclusion=decision.evidence.exclusion as Record<string,unknown>|undefined;
    const specification=exclusion?.specification;
    let resumed:DecisionState;
    if(specification==="9x9_6mi") {
      const peak=decision.evidence.peak as {target?:{latitude?:unknown;longitude?:unknown};targeting_method?:unknown}|undefined;
      const latitude=peak?.target?.latitude,longitude=peak?.target?.longitude;
      if(typeof latitude!=="number" || !Number.isFinite(latitude) || typeof longitude!=="number" || !Number.isFinite(longitude)) {
        throw new Error("The declined S02 proposal lacks a deterministic peak target; hold for evidence review");
      }
      resumed={...decision,centering_status:"planned",proposed_center:centerText({latitude,longitude}),
        center_type:peak?.targeting_method==="whole_field_centroid"?"scout_recentered":"ranked_peak_recentered",
        exclusion_review:{status:"declined",report_key:args.report_key,evidence_hash:args.evidence_hash,declined_by:"Matt",decline_reference:args.decision.approval_reference},
        evidence:{...decision.evidence,next_action:"plan_deliverable",exclusion:{...exclusion,final_disposition:false,requires_matt_review:false,decision:"declined"}}};
    } else if(specification==="7x7_5mi") {
      if(decision.centering_status!=="validated" || !decision.evidence.center_validation) throw new Error("A declined S09 proposal must retain the validated three-mile center");
      resumed={...decision,
        exclusion_review:{status:"declined",report_key:args.report_key,evidence_hash:args.evidence_hash,declined_by:"Matt",decline_reference:args.decision.approval_reference},
        evidence:{...decision.evidence,next_action:"comparison_ready",centering_evaluated:false,exclusion:{...exclusion,final_disposition:false,requires_matt_review:false,decision:"declined"}}};
    } else throw new Error("Only exact S02 or S09 high-visibility proposals support this transition");
    await repo.saveCompany(args.place_id,{decision_state:resumed,status:"in_progress",blocker:null},actorEmail,{exclusionReviewDeclined:true});
    const verified=decisionState(await repo.getCompany(args.place_id));
    if(verified?.exclusion_review?.status!=="declined" || verified.evidence_hash!==args.evidence_hash) throw new Error("Exclusion decline readback failed; reconcile before continuing");
    return {place_id:args.place_id,report_key:args.report_key,exclusion_declined:true,resumed_action:resumed.evidence?.next_action,paid_scans_submitted:0,continue_unaffected_work:true};
  }));
  add("audit_sab_contacts","Validate structured contact completion server-side for selected exact Place IDs or the full qualified population. Returns aggregate counts and only incomplete/conflicting records; it never replaces source inspection or returns full histories.",{
    ...run,place_ids:z.array(z.string().trim().min(1).max(500)).max(500).optional(),
  },async args=>{
    const repo=factory(args.workflow_sheet,args.sheet_name),state=await requireRun(repo,args.run_id);
    let rows=await repo.getRunCompletionRows();
    if(args.place_ids?.length){const ids=new Set(args.place_ids);rows=rows.filter(row=>ids.has(row.place_id));}
    else rows=rows.filter(row=>row.qualification_status==="qualified");
    return auditSabContactRows(rows,state);
  });
  add("record_sab_contact_research","Persist one exact Place ID's completed browser contact research. This is the only connector action that may create or replace contact-research evidence. It validates the exact unquoted GBP-name-plus-email query, the authorized exact-phone-only fallback when used, rendered AI Overview/first-page inspection, bounded official-website and surfaced company-controlled profile coverage, independent-source classification, accepted-email gates, and material technical failures. It writes one compact company record, submits no scan, and sends no outreach.",{
    ...run,orchestrator_id:z.string().trim().min(1),place_id:z.string().trim().min(1).max(500),
    contact_tag:z.enum(["Email Ready","Needs Email"]),email:z.string().trim().email().nullable(),
    contact_research:sabContactResearchV3Schema,
  },async args=>inSabRunStateQueue(async()=>{
    const repo=factory(args.workflow_sheet,args.sheet_name),state=await requireRun(repo,args.run_id);
    if(args.orchestrator_id!==state.orchestrator_id) throw new Error("Only this run's orchestrator may record authoritative contact research");
    const row=await repo.getCompany(args.place_id);
    const eligibility=sabEligibilityStateSchema.parse(row.eligibility_state);
    const contactResearch=validateSabContactResearchV3({row,research:args.contact_research,contact_tag:args.contact_tag,email:args.email,
      public_phone_search_authorized:Boolean(state.public_business_phone_search_authorization)});
    await repo.saveCompany(args.place_id,{email:args.email,contact_tag:args.contact_tag,
      eligibility_state:{...eligibility,contact_verified:true,contact_research:contactResearch}},actorEmail);
    const verified=await repo.getCompany(args.place_id);
    const verifiedEligibility=sabEligibilityStateSchema.parse(verified.eligibility_state);
    if(verified.contact_tag!==args.contact_tag || (verified.email||null)!==(args.email||null) || verifiedEligibility.contact_research?.evidence_version!==3) {
      throw new Error("Contact-research write readback failed; do not treat the company as contact complete");
    }
    return {place_id:args.place_id,company:row.company,contact_tag:args.contact_tag,email:args.email,
      evidence_version:3,recorded_at:contactResearch.completed_at,paid_scans_submitted:0,outreach_sent:false};
  }));
  add("approve_sab_terminal_deferral","Record Matt's explicit decision to abandon one named unresolved survivor as a terminal deferral. This is the only deferred state that satisfies the run-completion gate. It submits no scan, performs no import and establishes no general policy.",{
    ...run,orchestrator_id:z.string().min(1),place_id:z.string().min(1),reason:z.string().trim().min(1).max(2000),approval:matt,
  },async args=>inSabRunStateQueue(async()=>{
    const repo=factory(args.workflow_sheet,args.sheet_name),state=await requireRun(repo,args.run_id);
    if(args.orchestrator_id!==state.orchestrator_id) throw new Error("Only this run's orchestrator may record Matt's terminal deferral");
    const row=await repo.getCompany(args.place_id);
    if(row.qualification_status==="qualified" || row.qualification_status==="disqualified" || row.status==="imported") {
      throw new Error("A qualified, disqualified or imported company cannot be converted to a terminal deferral");
    }
    const next=approveSabTerminalDeferral(state,{place_id:args.place_id,reason:args.reason,approval:args.approval});
    await repo.saveRunState(next,state.version,actorEmail);
    await repo.saveCompany(args.place_id,{qualification_status:"deferred",qualification_reason:args.reason,status:"complete",blocker:null},actorEmail);
    const verifiedState=await repo.getRunState(args.run_id),verified=await repo.getCompany(args.place_id);
    if(!verifiedState?.terminal_deferrals?.[args.place_id] || verified.qualification_status!=="deferred" || verified.status!=="complete") {
      throw new Error("Terminal deferral readback failed; run completion remains blocked");
    }
    return {place_id:args.place_id,terminal_deferral:true,approved_by:"Matt",reason:args.reason,paid_scans_submitted:0,import_performed:false};
  }));
  add("select_sab_canonical_report","Verify paired same-center 7×7/3mi and 5mi reports. Persist 5mi ONLY when raw ARP increases AND SoLV decreases; retain both in history and use all-point ATRP for prospects.",{
    ...run,place_id:z.string().min(1),three_mile_report_key:z.string().min(1),five_mile_report_key:z.string().min(1),
  },async args=>inSabRunStateQueue(async()=>{
    const repo=factory(args.workflow_sheet,args.sheet_name),state=await requireRun(repo,args.run_id);
    const row=await repo.getCompany(args.place_id),decision=decisionState(row);
    if ((decision?.exclusion_review && decision.exclusion_review.status!=="declined") || !["comparison_ready","center_validated"].includes(String(decision?.evidence?.next_action))) throw new Error("Resolve the comparison's exclusion or evidence/policy review before canonical selection; preserved center validation is not disposition approval");
    const reports=await Promise.all([args.three_mile_report_key,args.five_mile_report_key].map(key=>getSabRankedCells(key,[args.place_id])));
    const [three,five]=reports;
    for (const [index, report] of reports.entries()) {
      const key=index === 0 ? args.three_mile_report_key : args.five_mile_report_key;
      assertExactReport(report,key,args.place_id,"deliverable");
      const scan=scanForReport(state,key,args.place_id);
      if (!scan || scan.plan.scan_role !== "deliverable" || !scan.completion_verified) throw new Error("Canonical reports must belong to this run and have completed stage verification");
      assertReportPlan(report,scan.plan);
    }
    if(reports.some(r=>r.grid.size!==7||r.grid.measurement!=="mi"||r.arp===null||r.solv===null||r.atrp===null) ||
       three.grid.radius!==3||five.grid.radius!==5||three.keyword!==five.keyword||three.platform!==five.platform||
       three.grid.center.latitude!==five.grid.center.latitude||three.grid.center.longitude!==five.grid.center.longitude) throw new Error("Canonical comparison requires verified paired same-center specifications, raw metrics and all-point ATRP");
    if (decision?.centering_status !== "validated" || !sameCenter(decision.proposed_center,three.grid.center) || !isDeliverableCenter(decision.center_type)) throw new Error("Canonical selection requires the existing validated center and its actual derivation");
    const validation = validatedThreeMileCenter(state,row);
    if (validation.report_key !== three.report_key || !sameCenter(validation.proposed_center,three.grid.center)) throw new Error("Canonical comparison must use the preserved three-mile center-validation source");
    const selection=selectSabCanonicalScan({threeMile:{rawArp:three.arp!,solv:three.solv!},fiveMile:{rawArp:five.arp!,solv:five.solv!}});
    const selected=selection.selected_radius_miles===5?five:three;
    for (const report of reports) {
      const scan=scanForReport(state,report.report_key,args.place_id)!;
      await repo.saveScanResult(args.place_id,reportResult(report,"deliverable",scan.plan.scan_type,decision.center_type),actorEmail,{historyOnly:true});
    }
    await repo.saveScanResult(args.place_id,reportResult(selected,"deliverable",scanForReport(state,selected.report_key,args.place_id)!.plan.scan_type,decision.center_type),actorEmail);
    const {exclusion_review:declinedReview,...continuedDecision}=decision;
    await repo.saveCompany(args.place_id,{decision_state:{...continuedDecision,source_report_key:selected.report_key,evidence_hash:evidenceHash(selected),rule_id:"S08",outcome:"deliverable",evidence:{
      next_action:"center_validated",grid:selected.grid,raw_arp:selected.arp,all_point_atrp:selected.atrp,solv:selected.solv,
      center_validation_source_report_key:validation.report_key,center_validation:validation,
      ...(declinedReview?.status==="declined" ? {exclusion_decision_history:[...exclusionDecisionHistory(decision)]} : {}),
      canonical_selection:{...selection,three_mile_report_key:three.report_key,five_mile_report_key:five.report_key,selected_report_key:selected.report_key,
        three_mile:{raw_arp:three.arp,solv:three.solv,all_point_atrp:three.atrp},five_mile:{raw_arp:five.arp,solv:five.solv,all_point_atrp:five.atrp}},
    }}},actorEmail,{exclusionDecisionContinued:declinedReview?.status==="declined"});
    const verified=await repo.getCompany(args.place_id);
    if (verified.report_key!==selected.report_key || !sameCenter(verified.scan_center,selected.grid.center) || (verified.scan_spec as {radius_miles?:number}|null)?.radius_miles!==selection.selected_radius_miles) throw new Error("Canonical stage readback failed; stop and reconcile before export");
    return {...selection,selected_report_key:selected.report_key,selected_report_url:reportUrl(selected),all_point_atrp:selected.atrp,raw_arp:selected.arp,three_mile_report_key:three.report_key,five_mile_report_key:five.report_key,preserve_both_reports:true,canonical_persisted:true};
  }));
  add("build_sab_run_manifest","Build exactly one validated batch.json from every qualified complete AND qa_ready row across the run. Fails closed while any survivor remains assigned, in progress, blocked or deferred without Matt's named terminal-deferral approval. Also requires structured verified-email evidence or complete contact-path exhaustion; Needs Email requires the run-wide public-business-phone search authorization. Pins a compact hash-bound import expectation in run state for one-call post-import reconciliation. Includes CRM-only no-visibility leads, excludes competitors, and does not import or send outreach.",{
    ...run,batch:z.object({batch_id:z.string().min(1),market:z.object({city:z.string().min(1),state:z.string().regex(/^[A-Za-z]{2}$/)}),trade:z.string().min(1),keyword:z.string().min(1),export_date:z.string().min(1),scan_spec:z.object({grid_size:z.literal("7x7"),radius_miles:z.literal(3)})}),
  },async args=>inSabRunStateQueue(async()=>{
    const repo=factory(args.workflow_sheet,args.sheet_name),state=await requireRun(repo,args.run_id);
    const built=await buildSabRunManifest(repo,args.batch,args.run_id);
    const manifest=JSON.parse(built.manifest_json) as {batch:{batch_id:string};prospects:Array<Record<string,any>>};
    const latest={sha256:built.sha256,batch_id:manifest.batch.batch_id,built_at:new Date().toISOString(),prospects:manifest.prospects.map(row=>({
      place_id:row.place_id,company_name:row.company_name,contact_tag:row.contact_tag,address:row.address,
      outcome:row.outcome,report_key:row.outcome==="deliverable"?row.report_key:null,
    }))} as NonNullable<SabRunState["latest_manifest"]>;
    const next=recordSabManifest(state,latest);await repo.saveRunState(next,state.version,actorEmail);
    return {...built,manifest_expectation_pinned:true};
  }));
  add("reconcile_sab_import_batch","Read-only post-import reconciliation for the latest hash-pinned manifest. Verifies exact Place IDs, batch identity, canonical report keys, Service Area Business addresses, contact-routing tags, prior report-email sends, and workflow imported status in one call. Returns aggregate counts and exceptions only.",{
    ...run,manifest_sha256:z.string().regex(/^[a-f0-9]{64}$/i),
  },async args=>{
    const repo=factory(args.workflow_sheet,args.sheet_name),state=await requireRun(repo,args.run_id),latest=state.latest_manifest;
    if(!latest || latest.sha256!==args.manifest_sha256) throw new Error("Manifest hash does not match the latest validated run artifact");
    const crm=await reconcileSabImportBatch(latest.batch_id,latest.prospects);
    const ids=new Set(latest.prospects.map(row=>row.place_id));
    const workflow=(await repo.getRunCompletionRows()).filter(row=>ids.has(row.place_id));
    const workflow_exceptions=workflow.filter(row=>row.status!=="imported").map(row=>({place_id:row.place_id,company:row.company,issues:["workflow_status_not_imported"]}));
    const missingWorkflow=latest.prospects.filter(item=>!workflow.some(row=>row.place_id===item.place_id)).map(item=>({place_id:item.place_id,company:item.company_name,issues:["workflow_row_missing"]}));
    const exceptions=[...crm.exceptions,...workflow_exceptions,...missingWorkflow];
    return {manifest_sha256:latest.sha256,batch_id:latest.batch_id,counts:{...crm.counts,workflow_imported:workflow.filter(row=>row.status==="imported").length,total_exceptions:exceptions.length},
      exceptions,full_records_returned:false,import_verified:exceptions.length===0};
  });
}

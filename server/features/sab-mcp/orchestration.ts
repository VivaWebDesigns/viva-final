import { createHash } from "node:crypto";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SabSheetsRepository, SabSheetsRepositoryFactory } from "./sheets";
import { SCALE_FIRST_WORKFLOW, SAB_ADDRESS_LABEL, sabBusinessProfileSchema, sabBusinessProfileIssues } from "@shared/sabCrm";
import { getSabRankedCells } from "./localFalconRankedCells";
import { analyzeSabScanPolicy, selectSabCanonicalScan } from "./scanPolicy";
import { reverseGeocodeSabCenters } from "./reverseGeocode";
import { buildSabRunManifest } from "./exportManifest";
import { createSabRunState, authorizeSabScanBatch, completeSabRunReports, endSabTestingMode, inSabRunStateQueue, reconcileSabAmbiguousSubmission, sabScanPlanFingerprint, type SabRunState, type SabScanPlan } from "./runState";
import { SAB_CENTER_TYPES, runSabScanOnceInputSchema, type SabCompanyUpdates, type SabScanResult } from "./schema";
import { corroborationAllowsAuxiliary, sabAddressCorroborationSchema, type SabAddressCorroboration } from "./addressCorroboration";
import { evaluateSabAddressCandidate, evaluateSabCoordinatesAgainstCells } from "./addressCandidate";

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
const centerText = (center: { latitude: number; longitude: number }) => `${center.latitude},${center.longitude}`;
function sameCenter(value: unknown, center: { latitude: number; longitude: number }) {
  if (typeof value !== "string") return false;
  const coordinates = value.split(",").map(Number);
  return coordinates.length === 2 && coordinates[0] === center.latitude && coordinates[1] === center.longitude;
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
function assertPaidEligibility(row: Company) {
  if(row.business_profile) {
    const profile=sabBusinessProfileSchema.safeParse(row.business_profile);
    if(!profile.success || sabBusinessProfileIssues(profile.data,row.place_id,typeof row.phone==="string"?row.phone:null).length) throw new Error("Resolve the structured enrichment identity or phone conflict before paid scans");
  }
  const eligibility = (row as Company & { eligibility_state?: Record<string, unknown> }).eligibility_state;
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
  if (!eligibility || ["sab_confirmed", "trade_match", "franchise_excluded", "crm_dedup_checked", "contact_verified"].some(key => eligibility[key] !== true) ||
      !Array.isArray(eligibility.evidence_references) || !eligibility.evidence_references.length ||
      eligibility.evidence_references.some(reference => typeof reference !== "string" || !reference.trim())) throw new Error("Structured SAB, trade, franchise, exact CRM deduplication and contact evidence must be verified before spending");
  if (!((row.contact_tag === "Email Ready" && typeof row.email === "string" && row.email.includes("@")) ||
        (row.contact_tag === "Needs Email" && !row.email && typeof row.phone === "string" && row.phone.trim()))) throw new Error("Verified contact and matching contact tag are required before spending");
}
function assertDecisionPlan(row: Company, scan: SabScanPlan, hasException: boolean) {
  assertPaidEligibility(row);
  const decision = decisionState(row), evidence = decision?.evidence;
  if (!decision || !sameCenter(decision.proposed_center, scan.center) || !["planned", "validated"].includes(decision.centering_status)) throw new Error("Scan center must match persisted structured decision evidence");
  const action = evidence?.next_action;
  const correction = evidence?.corroboration_correction as Record<string, unknown> | undefined;
  const correctedAuxiliary = correction?.status === "corrected_rejected" && correction.source_report_key === decision.source_report_key &&
    correction.evidence_hash === decision.evidence_hash && correction.classification === "agent_error" &&
    typeof correction.invalidated_deliverable_report_key === "string" && Number(correction.nearest_ranked_cell_miles) > 3;
  if (scan.scan_role === "auxiliary" && !corroborationAllowsAuxiliary(decision.address_corroboration,decision.source_report_key,decision.evidence_hash) && !correctedAuxiliary) {
    throw new Error("Complete structured address corroboration before an unresolved auxiliary; incomplete evaluation or a technical failure cannot authorize paid fallback");
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
  // Matt approved these definitions for testing only. Structured run state,
  // never a caller flag or research note, controls their scope.
  const hash = evidenceHash(report);
  const activeCorroboration = previous?.address_corroboration?.source_report_key === report.report_key && previous.address_corroboration.evidence_hash === hash
    ? previous.address_corroboration : undefined;
  const policyCorroboration = corroborationCorrection ? ({status:"rejected"} as SabAddressCorroboration) : activeCorroboration;
  const decision = analyzeSabScanPolicy({stage: input.stage, cells: report.businesses[0].all_point_rank_cells ?? report.businesses[0].ranked_cells, grid: report.grid,
    rawArp: report.arp, atrp: report.atrp, solv: report.solv, routineRecenterCount: recenters, testingPolicyActive: state.testing_mode,addressCorroboration:policyCorroboration});
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
  else if (isFiveMile && ["evidence_review_required","policy_review_required"].includes(decision.action)) Object.assign(updates,{status:"blocked",blocker:"five_mile_comparison_review_required"});
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
  add("initialize_sab_run","Initialize persistent single-orchestrator state with testing mode ON, an explicit authorized credit ceiling, and optional grouped authorization for exact-phone searches using verified publicly listed business numbers only. Absence holds that research fallback without blocking other free paths. Never launches scans.",{
    ...run,orchestrator_id:z.string().min(1),authorization_reference:z.string().min(1),credit_limit:z.number().int().positive(),
    public_business_phone_search_authorization:matt.optional(),
  },async args=>inSabRunStateQueue(async()=>{
    const repo=factory(args.workflow_sheet,args.sheet_name);if(await repo.getRunState(args.run_id)) throw new Error("Run already exists; read it instead of resetting approvals");
    await repo.assertOneActiveRun(args.run_id);
    const state=createSabRunState(args);await repo.saveRunState(state,null,actorEmail);return state;
  }));
  add("get_sab_run_state","Read authoritative run stages, exact authorizations, committed credits and testing review status. Notes are supporting history.",run,async args=>requireRun(factory(args.workflow_sheet,args.sheet_name),args.run_id));
  add("reconcile_sab_ambiguous_submission","Recover one existing ambiguous paid submission without resubmitting or resetting the run. Verify a supplied provider report against the stored exact Place ID, center, keyword, platform and scan specification, bind it to the original durable claim, and preserve committed credits. Performs no paid call.",{
    ...run,orchestrator_id:z.string().min(1),authorization_id:z.string().uuid(),place_id:z.string().min(1),report_key:z.string().regex(/^[a-f0-9]{12,64}$/i),
  },async args=>inSabRunStateQueue(async()=>{
    const repo=factory(args.workflow_sheet,args.sheet_name),state=await requireRun(repo,args.run_id);
    if(args.orchestrator_id!==state.orchestrator_id) throw new Error("Only this run's orchestrator may reconcile an ambiguous submission");
    const batch=state.batches.find(candidate=>candidate.authorization_id===args.authorization_id);
    const scan=batch?.scans.find(candidate=>candidate.plan.place_id===args.place_id);
    if(!scan || scan.submission_status!=="ambiguous_response" || !scan.idempotency_key) throw new Error("No matching ambiguous durable claim exists");
    const report=await getSabRankedCells(args.report_key,[args.place_id]);
    assertExactReport(report,args.report_key,args.place_id,scan.plan.scan_role);
    assertReportPlan(report,scan.plan);
    await repo.updateScanSubmission(args.place_id,scan.idempotency_key,{submission_status:"submitted",report_key:args.report_key,
      recovery:"verified_existing_report",reconciled_at:new Date().toISOString()},actorEmail);
    const next=reconcileSabAmbiguousSubmission(state,args);
    await repo.saveRunState(next,state.version,actorEmail);
    return {run_id:args.run_id,authorization_id:args.authorization_id,place_id:args.place_id,report_key:args.report_key,
      submission_status:"submitted",recovered_existing_claim:true,scans_submitted:0,credits_added:0,next_batch_status:next.batches.find(candidate=>candidate.authorization_id===args.authorization_id)?.status};
  }));
  add("authorize_sab_scan_batch","Record the orchestrator's exact SOP-compliant batch plan. Testing requires Matt's initial approval or review of the completed previous batch, bound to this plan. Preserve exception and credit limits. This does not submit scans.",{
    ...run,orchestrator_id:z.string().min(1),authorization_id:z.string().uuid(),authorization_reference:z.string().min(1),scans:z.array(plan).min(1).max(100),
    matt_initial_approval:matt.optional(),matt_review:matt.extend({reviewed_batch_id:z.string().uuid()}).optional(),exception:matt.extend({reason:z.string().min(1)}).optional(),
    duplicate_report_checks:z.array(z.object({scan:plan,result:z.literal("none"),evidence_reference:z.string().trim().min(1).max(2000),checked_at:z.string().datetime()}).strict()).min(1).max(100)
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
      const correctedLatest=latest && correction?.status==="corrected_rejected" && correction.classification==="agent_error" &&
        correction.invalidated_deliverable_report_key===latest.report_key && correction.source_report_key===currentDecision?.source_report_key &&
        correction.evidence_hash===currentDecision?.evidence_hash;
      if (latest && currentDecision?.source_report_key !== latest.report_key && !correctedLatest) throw new Error("A paid plan cannot use a stale source decision after newer scan evidence exists");
      if (scan.scan_role === "deliverable" && scan.grid_size === 7 && scan.radius === 5 && scan.measurement === "mi") {
        if (scan.scan_type !== "standard") throw new Error("A five-mile variation is a comparison, never a recenter");
        const prior = state.batches.flatMap(batch=>batch.scans).filter(candidate=>candidate.plan.place_id===scan.place_id);
        if (prior.some(candidate=>candidate.plan.scan_role==="deliverable" && candidate.plan.radius===5 && candidate.plan.measurement==="mi")) throw new Error("Only one five-mile comparison is permitted per company; never widen or repeat it automatically");
        const validation = validatedThreeMileCenter(state,row);
        const three = scanForReport(state,validation.report_key,scan.place_id)!;
        if (!sameCenter(validation.proposed_center,scan.center) || three.plan.keyword!==scan.keyword || three.plan.platform!==scan.platform) throw new Error("Five-mile comparison must preserve the validated three-mile center, keyword and platform");
      }
      assertDecisionPlan(row, scan, Boolean(args.exception));
    }
    const next=authorizeSabScanBatch(state,args);next.batches[next.batches.length-1].duplicate_report_checks=checks;
    await repo.saveRunState(next,state.version,actorEmail);return {state:next,scan_approved:true,paid_scans_submitted:0};
  }));
  add("analyze_sab_scan","Read exact completed report cells server-side, apply SOP decision precedence and persist structured decision evidence. Returns compact evidence only, not raw cells. Does not authorize or launch scans.",{
    ...run,report_key:z.string().regex(/^[a-f0-9]{12,64}$/i),place_id:z.string().min(1),stage:z.enum(["master","auxiliary","deliverable"]),
  },async args=>inSabRunStateQueue(async()=>analyzeAndRecordSabReport(factory(args.workflow_sheet,args.sheet_name),args,actorEmail)));
  add("record_sab_address_corroboration","Record required address corroboration before an unresolved master-center auxiliary. A temporary candidate is geocoded privately against the exact completed report; persist only identity/fit evidence and coordinates, never the address. No-candidate requires completed genuine research with sources. Incomplete geocoding or technical failure holds this company and never becomes paid auxiliary permission. An accepted complete-distribution fit may establish the deliverable center. Does not submit scans.",{
    ...run,orchestrator_id:z.string().min(1),place_id:z.string().min(1),report_key:z.string().regex(/^[a-f0-9]{12,64}$/i),
    research_complete:z.boolean(),evidence_references:z.array(z.string().trim().min(1).max(2000)).min(1).max(20),
    source_type:z.string().trim().min(1).max(200),identity_method:z.string().trim().min(1).max(500),fit_rationale:z.string().trim().min(1).max(2000),
    result:z.enum(["no_candidate","candidate"]),candidate_address:z.string().trim().min(1).max(2000).optional(),fit_decision:z.enum(["accepted","rejected"]).optional(),
  },async args=>inSabRunStateQueue(async()=>{
    const repo=factory(args.workflow_sheet,args.sheet_name),state=await requireRun(repo,args.run_id),row=await repo.getCompany(args.place_id),previous=decisionState(row);
    if(args.orchestrator_id!==state.orchestrator_id) throw new Error("Only the run's orchestrator may record a corroboration disposition");
    if(!previous || previous.source_report_key!==args.report_key || previous.exclusion_review) throw new Error("Corroboration must reference the current reconciled master decision without an exclusion hold");
    if(state.batches.some(batch=>batch.scans.some(scan=>scan.plan.place_id===args.place_id))) throw new Error("Address corroboration cannot replace an already authorized or submitted scan plan");
    if(args.result==="no_candidate" && (!args.research_complete || args.candidate_address || args.fit_decision)) throw new Error("No-candidate disposition requires completed research and no unevaluated candidate");
    if(args.result==="candidate" && (!args.candidate_address || !args.fit_decision)) throw new Error("A candidate requires an ephemeral address and the orchestrator's complete-distribution fit decision");
    if(args.candidate_address && JSON.stringify([args.evidence_references,args.source_type,args.identity_method,args.fit_rationale]).includes(args.candidate_address)) throw new Error("Keep the temporary hidden address out of persistent source and fit descriptions");
    if(args.result==="no_candidate" && previous.address_corroboration?.status === "incomplete") throw new Error("Resolve the incomplete candidate evaluation; a known partial candidate cannot be relabelled as no candidate");
    const base={source_report_key:args.report_key,evidence_hash:previous.evidence_hash,evidence_references:args.evidence_references,
      source_type:args.source_type,identity_method:args.identity_method,fit_rationale:args.fit_rationale,research_complete:args.research_complete};
    let evidence:SabAddressCorroboration,report:RankedReport|undefined;
    try {
      report=await getSabRankedCells(args.report_key,[args.place_id]);assertExactReport(report,args.report_key,args.place_id,"master");
      if(evidenceHash(report)!==previous.evidence_hash) throw new Error("Changed evidence");
      if(args.result==="no_candidate") evidence={...base,status:"no_candidate"};
      else {
        const evaluated=await evaluateSabAddressCandidate(args.report_key,args.place_id,args.candidate_address,{rankedCells:async()=>report!});
        const complete=evaluated.status==="complete" && !evaluated.geocoder.partial_match;
        const unmistakableContradiction=args.fit_decision==="accepted" && complete &&
          Math.min(evaluated.distances_miles.weighted_centroid,evaluated.distances_miles.nearest_ranked_cell,evaluated.distances_miles.best_rank_cluster_centroid)>3;
        // Preserve orchestrator judgment near the approximate threshold, but
        // never accept a candidate beyond every complete-distribution
        // reference. That is an objective contradiction, not a shape tie.
        evidence={...base,...(unmistakableContradiction?{fit_rationale:"Server rejected the proposed acceptance because every complete-distribution reference exceeded the established three-mile fit limit."}:{}),
          status:!complete?"incomplete":unmistakableContradiction?"rejected":args.fit_decision,
          candidate_coordinates:evaluated.candidate_coordinates,geocoder:{location_type:evaluated.geocoder.location_type,partial_match:evaluated.geocoder.partial_match},
          distances_miles:evaluated.distances_miles};
      }
    } catch {
      // Do not include provider errors, request URLs or the temporary address.
      evidence={...base,status:"technical_failure",fit_rationale:"Address or ranked-evidence evaluation could not be completed. Resolve the technical issue; no paid fallback is authorized."};
      report=undefined;
    }
    evidence=sabAddressCorroborationSchema.parse(evidence);
    const incomplete=["incomplete","technical_failure"].includes(evidence.status);
    await repo.saveCompany(args.place_id,{decision_state:{...previous,address_corroboration:evidence,
      ...(incomplete?{centering_status:"failed" as const,evidence:{...previous.evidence,next_action:"address_corroboration_incomplete"}}:{})},
      ...(incomplete?{status:"blocked" as const,blocker:"address_corroboration_incomplete"}:{})},actorEmail,{corroborationRecorded:true});
    if(!report) return {place_id:args.place_id,address_corroboration:evidence,action:"address_corroboration_incomplete",paid_scans_submitted:0};
    const decision=await analyzeAndRecordSabReport(repo,{run_id:args.run_id,report_key:args.report_key,place_id:args.place_id,stage:"master"},actorEmail,{report,state});
    return {...decision,address_corroboration:evidence,paid_scans_submitted:0};
  }));
  add("review_sab_completed_batch","Verify every submitted report and return the required testing-review table. Show report URLs, measured values, classifications and next steps. STOP until Matt approves further scans or each proposed exclusion. This is a human review handoff, not a separate supervisor.",run,async args=>inSabRunStateQueue(async()=>{
    const repo=factory(args.workflow_sheet,args.sheet_name),state=await requireRun(repo,args.run_id),batch=state.batches.at(-1);
    if(!batch) throw new Error("No submitted scan batch");
    const table=[];
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
    return {table,testing_mode:next.testing_mode,stop_before_further_scans:next.testing_mode,matt_review_required:next.testing_mode,
      exclusion_approval_required:table.some(row=>row.result.classification === "high_visibility_exclusion_pending_review"),
      review_instruction:"Wait for Matt before further scans or finalizing exclusions. If Matt disagrees, distinguish an agent execution error from a flawed general SOP rule. Never promote a case-specific ruling into policy."};
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
    return {place_id:args.place_id,report_key:args.report_key,exclusion_finalized:true,paid_scans_submitted:0,next_batch_still_requires_approval:state.testing_mode};
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
    return {place_id:args.place_id,report_key:args.report_key,exclusion_declined:true,resumed_action:resumed.evidence?.next_action,paid_scans_submitted:0,next_batch_still_requires_approval:state.testing_mode};
  }));
  add("end_sab_testing_mode","End testing review pauses only on Matt's explicit instruction. Run budgets, exact plans, exceptions and final CRM confirmation remain mandatory.",{
    ...run,approval:matt,
  },async args=>inSabRunStateQueue(async()=>{
    const repo=factory(args.workflow_sheet,args.sheet_name),state=await requireRun(repo,args.run_id),next=endSabTestingMode(state,args.approval);
    await repo.saveRunState(next,state.version,actorEmail);return next;
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
  add("build_sab_run_manifest","Build exactly one validated batch.json from every qualified complete AND qa_ready row across the run. Fails closed unless each prospect has structured verified-email evidence or complete contact-path exhaustion; Needs Email also requires the run-wide public-business-phone search authorization. Includes CRM-only no-visibility leads, excludes competitors, and does not import or send outreach.",{
    ...run,batch:z.object({batch_id:z.string().min(1),market:z.object({city:z.string().min(1),state:z.string().regex(/^[A-Za-z]{2}$/)}),trade:z.string().min(1),keyword:z.string().min(1),export_date:z.string().min(1),scan_spec:z.object({grid_size:z.literal("7x7"),radius_miles:z.literal(3)})}),
  },async args=>buildSabRunManifest(factory(args.workflow_sheet,args.sheet_name),args.batch,args.run_id));
}

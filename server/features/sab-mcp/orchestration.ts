import { createHash } from "node:crypto";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SabSheetsRepository, SabSheetsRepositoryFactory } from "./sheets";
import { SCALE_FIRST_WORKFLOW, SAB_ADDRESS_LABEL } from "@shared/sabCrm";
import { getSabRankedCells } from "./localFalconRankedCells";
import { analyzeSabScanPolicy, selectSabCanonicalScan } from "./scanPolicy";
import { reverseGeocodeSabCenters } from "./reverseGeocode";
import { buildSabRunManifest } from "./exportManifest";
import { createSabRunState, authorizeSabScanBatch, completeSabRunReports, endSabTestingMode, inSabRunStateQueue, type SabRunState, type SabScanPlan } from "./runState";
import { SAB_CENTER_TYPES, runSabScanOnceInputSchema, type SabCompanyUpdates, type SabScanResult } from "./schema";

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
  return createHash("sha256").update(JSON.stringify({report_key: report.report_key, grid: report.grid, cells: report.businesses[0].ranked_cells, arp: report.arp, atrp: report.atrp, solv: report.solv})).digest("hex");
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
function isDeliverableCenter(value: unknown): value is typeof SAB_CENTER_TYPES[number] {
  return typeof value === "string" && SAB_CENTER_TYPES.includes(value as never) && value !== "master_edge_offset";
}
function assertExactReport(report: RankedReport, key: string, placeId: string, stage: string) {
  if (report.completion_verified !== true || report.completion_status !== "complete") throw new Error("Report completion has not been verified from provider evidence");
  if (report.report_key !== key || report.missing_place_id_count || report.found_place_id_count !== 1 || report.businesses[0]?.place_id !== placeId) {
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
function assertPaidEligibility(row: Company) {
  const eligibility = (row as Company & { eligibility_state?: Record<string, unknown> }).eligibility_state;
  if (row.workflow !== SCALE_FIRST_WORKFLOW || row.address !== SAB_ADDRESS_LABEL || row.qualification_status !== "qualified" ||
      typeof row.rating !== "number" || !Number.isFinite(row.rating) || row.rating < 4.5 || row.rating > 5 ||
      typeof row.review_count !== "number" || !Number.isSafeInteger(row.review_count) || row.review_count < 1 ||
      row.outcome === "no_visibility_core_found") throw new Error("Paid scans require an eligible qualified SAB with rating >=4.5 and at least one review");
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
  const miles = scan.measurement === "mi";
  const selectedAuxiliary = evidence?.auxiliary_scan_spec as { scan_type?: string; grid_size?: number; radius?: number; measurement?: string } | undefined;
  const selectedFine = selectedAuxiliary?.scan_type === "fine" && selectedAuxiliary.grid_size === 7 && selectedAuxiliary.radius === 1.5 && selectedAuxiliary.measurement === "mi" && scan.scan_type === "fine" && scan.grid_size === 7 && scan.radius === 1.5;
  const matches = action === "plan_auxiliary" ? scan.scan_role === "auxiliary" && miles && (selectedFine || (!selectedAuxiliary && scan.scan_type === "scout" && scan.grid_size === 9 && scan.radius === 6)) :
    action === "plan_deliverable" ? scan.scan_role === "deliverable" && scan.scan_type === "standard" && scan.grid_size === 7 && scan.radius === 3 && miles :
    action === "same_center_five_mile_comparison" ? scan.scan_role === "deliverable" && scan.scan_type === "standard" && scan.grid_size === 7 && scan.radius === 5 && miles && decision.centering_status === "validated" :
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
  if (input.stage === "master") {
    if (submitted.length) throw new Error("Master analysis cannot overwrite newer submitted scan evidence");
  } else {
    if (!ownedScan || ownedScan.plan.scan_role !== input.stage || submitted.at(-1)?.report_key !== input.report_key) throw new Error("Analyze the latest submitted report from this exact run; stale or unrelated reports cannot replace its state");
    assertReportPlan(report, ownedScan.plan);
  }
  const row = await repository.getCompany(input.place_id);
  const previous = decisionState(row);
  const recenters = submitted.filter(scan => scan.plan.scan_type === "recenter").length;
  // Numeric saturation policy is still pending approval. No caller boolean or
  // research-note language can turn a proposed general rule into live policy.
  const decision = analyzeSabScanPolicy({stage: input.stage, cells: report.businesses[0].ranked_cells, grid: report.grid,
    rawArp: report.arp, solv: report.solv, routineRecenterCount: recenters, saturationPolicyApproved: false});
  const hash = evidenceHash(report);
  const noVisibility = decision.action === "no_visibility_core_found";
  const validated = ["center_validated", "same_center_five_mile_comparison"].includes(decision.action);
  let centerType: typeof SAB_CENTER_TYPES[number] | undefined;
  if (validated) {
    // Validation confirms the existing derivation; it does not invent a recenter.
    if (sameCenter(previous?.proposed_center, report.grid.center) && isDeliverableCenter(previous?.center_type)) centerType = previous.center_type;
    else if (sameCenter(row.scan_center, report.grid.center) && isDeliverableCenter(row.center_type)) centerType = row.center_type;
    else throw new Error("Validated report has no matching structured center derivation; reconcile instead of inventing one");
  } else if (decision.center_source === "master_edge_offset") centerType = "master_edge_offset";
  else if (decision.center_source === "ranked_peak_recentered") centerType = "ranked_peak_recentered";
  else if (decision.center_source === "master_centroid") centerType = "weighted_cell_centroid";
  else if (decision.center_source === "auxiliary_centroid") centerType = report.grid.size === 9 ? "scout_recentered" : "fine_scan_recentered";
  const center = decision.proposed_center ? centerText(decision.proposed_center) : undefined;
  const updates: SabCompanyUpdates = {decision_state: {
    source_report_key: report.report_key, rule_id: decision.rule_ids.join(","), evidence_hash: hash,
    centering_status: noVisibility ? "market_reference_only" : validated ? "validated" : center ? "planned" : "failed",
    routine_recenter_count: recenters, ...(center && centerType ? { proposed_center: center, center_type: centerType } : {}),
    ...(noVisibility ? { outcome: "no_visibility_core_found" as const } : validated ? { outcome: "deliverable" as const } : {}),
    evidence: {...decision.evidence, next_action: decision.action, reason: decision.reason, grid: report.grid},
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
  if (decision.action === "high_visibility_excluded") Object.assign(updates, {qualification_status: "disqualified", qualification_reason: "existing_visibility_too_strong", status: "complete"});
  // An additional recenter is an exception hold, not a change to eligibility.
  if (decision.action === "additional_recenter_exception_required") Object.assign(updates, {blocker: "additional_recenter_requires_explicit_exception"});
  if (ownedScan) {
    const canonicalThree = validated && report.grid.size === 7 && report.grid.radius === 3 && report.grid.measurement === "mi";
    await repository.saveScanResult(input.place_id, reportResult(report, ownedScan.plan.scan_role, ownedScan.plan.scan_type, validated ? centerType : undefined), actorEmail, {historyOnly: !canonicalThree});
  }
  await repository.saveCompany(input.place_id, updates, actorEmail);
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
  add("initialize_sab_run","Initialize persistent single-orchestrator state with testing mode ON and an explicit authorized credit ceiling. Never launches scans.",{
    ...run,orchestrator_id:z.string().min(1),authorization_reference:z.string().min(1),credit_limit:z.number().int().positive(),
  },async args=>inSabRunStateQueue(async()=>{
    const repo=factory(args.workflow_sheet,args.sheet_name);if(await repo.getRunState(args.run_id)) throw new Error("Run already exists; read it instead of resetting approvals");
    await repo.assertOneActiveRun(args.run_id);
    const state=createSabRunState(args);await repo.saveRunState(state,null,actorEmail);return state;
  }));
  add("get_sab_run_state","Read authoritative run stages, exact authorizations, committed credits and testing review status. Notes are supporting history.",run,async args=>requireRun(factory(args.workflow_sheet,args.sheet_name),args.run_id));
  add("authorize_sab_scan_batch","Record the orchestrator's exact SOP-compliant batch plan. Testing requires Matt's initial approval or review of the completed previous batch, bound to this plan. Preserve exception and credit limits. This does not submit scans.",{
    ...run,orchestrator_id:z.string().min(1),authorization_id:z.string().uuid(),authorization_reference:z.string().min(1),scans:z.array(plan).min(1).max(100),
    matt_initial_approval:matt.optional(),matt_review:matt.extend({reviewed_batch_id:z.string().uuid()}).optional(),exception:matt.extend({reason:z.string().min(1)}).optional(),
  },async args=>inSabRunStateQueue(async()=>{
    const repo=factory(args.workflow_sheet,args.sheet_name),state=await requireRun(repo,args.run_id);
    for (const scan of args.scans as SabScanPlan[]) {
      const row = await repo.getCompany(scan.place_id);
      const latest = state.batches.flatMap(batch => batch.scans).filter(candidate => candidate.plan.place_id === scan.place_id && candidate.submission_status === "submitted").at(-1);
      if (latest && decisionState(row)?.source_report_key !== latest.report_key) throw new Error("A paid plan cannot use a stale source decision after newer scan evidence exists");
      assertDecisionPlan(row, scan, Boolean(args.exception));
    }
    const next=authorizeSabScanBatch(state,args);await repo.saveRunState(next,state.version,actorEmail);return {state:next,scan_approved:true,paid_scans_submitted:0};
  }));
  add("analyze_sab_scan","Read exact completed report cells server-side, apply SOP decision precedence and persist structured decision evidence. Returns compact evidence only, not raw cells. Does not authorize or launch scans.",{
    ...run,report_key:z.string().regex(/^[a-f0-9]{12,64}$/i),place_id:z.string().min(1),stage:z.enum(["master","auxiliary","deliverable"]),
  },async args=>inSabRunStateQueue(async()=>analyzeAndRecordSabReport(factory(args.workflow_sheet,args.sheet_name),args,actorEmail)));
  add("review_sab_completed_batch","Verify every submitted report and return the required testing-review table. When complete, STOP: no next scan batch until Matt explicitly approves it. This is a human review handoff, not a separate supervisor.",run,async args=>inSabRunStateQueue(async()=>{
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
        result:decision.action,proposed_next_step_and_reason:decision.reason,sop_rule:decision.rule_ids.join(", ")});
    }
    const next=completeSabRunReports(state,batch.scans.map(s=>s.report_key!));await repo.saveRunState(next,state.version,actorEmail);
    return {table,testing_mode:next.testing_mode,stop_before_further_scans:next.testing_mode,matt_review_required:next.testing_mode,
      review_instruction:"If Matt disagrees, distinguish an agent execution error from a flawed general SOP rule. Never promote a case-specific ruling into policy."};
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
    const row=await repo.getCompany(args.place_id),decision=decisionState(row);
    if (decision?.centering_status !== "validated" || !sameCenter(decision.proposed_center,three.grid.center) || !isDeliverableCenter(decision.center_type)) throw new Error("Canonical selection requires the existing validated center and its actual derivation");
    const selection=selectSabCanonicalScan({threeMile:{rawArp:three.arp!,solv:three.solv!},fiveMile:{rawArp:five.arp!,solv:five.solv!}});
    const selected=selection.selected_radius_miles===5?five:three;
    for (const report of reports) {
      const scan=scanForReport(state,report.report_key,args.place_id)!;
      await repo.saveScanResult(args.place_id,reportResult(report,"deliverable",scan.plan.scan_type,decision.center_type),actorEmail,{historyOnly:true});
    }
    await repo.saveScanResult(args.place_id,reportResult(selected,"deliverable",scanForReport(state,selected.report_key,args.place_id)!.plan.scan_type,decision.center_type),actorEmail);
    await repo.saveCompany(args.place_id,{decision_state:{...decision,source_report_key:selected.report_key,evidence_hash:evidenceHash(selected),rule_id:"S08",outcome:"deliverable",evidence:{
      next_action:"center_validated",grid:selected.grid,raw_arp:selected.arp,all_point_atrp:selected.atrp,solv:selected.solv,
      center_validation_source_report_key:decision.source_report_key,
      canonical_selection:{...selection,three_mile_report_key:three.report_key,five_mile_report_key:five.report_key,selected_report_key:selected.report_key,
        three_mile:{raw_arp:three.arp,solv:three.solv,all_point_atrp:three.atrp},five_mile:{raw_arp:five.arp,solv:five.solv,all_point_atrp:five.atrp}},
    }}},actorEmail);
    const verified=await repo.getCompany(args.place_id);
    if (verified.report_key!==selected.report_key || !sameCenter(verified.scan_center,selected.grid.center) || (verified.scan_spec as {radius_miles?:number}|null)?.radius_miles!==selection.selected_radius_miles) throw new Error("Canonical stage readback failed; stop and reconcile before export");
    return {...selection,selected_report_key:selected.report_key,selected_report_url:reportUrl(selected),all_point_atrp:selected.atrp,raw_arp:selected.arp,three_mile_report_key:three.report_key,five_mile_report_key:five.report_key,preserve_both_reports:true,canonical_persisted:true};
  }));
  add("build_sab_run_manifest","Build exactly one validated batch.json from every qualified complete AND qa_ready row across the run. Includes CRM-only no-visibility leads, excludes competitors, and does not import or send outreach.",{
    ...common,batch:z.object({batch_id:z.string().min(1),market:z.object({city:z.string().min(1),state:z.string().regex(/^[A-Za-z]{2}$/)}),trade:z.string().min(1),keyword:z.string().min(1),export_date:z.string().min(1),scan_spec:z.object({grid_size:z.literal("7x7"),radius_miles:z.literal(3)})}),
  },async args=>buildSabRunManifest(factory(args.workflow_sheet,args.sheet_name),args.batch));
}

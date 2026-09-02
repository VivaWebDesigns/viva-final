import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { analyzeAndRecordSabReport, registerSabOrchestrationTools } from "../../server/features/sab-mcp/orchestration";
import { getSabRankedCells } from "../../server/features/sab-mcp/localFalconRankedCells";
import { reverseGeocodeSabCenters } from "../../server/features/sab-mcp/reverseGeocode";
import { buildSabRunManifest } from "../../server/features/sab-mcp/exportManifest";
import { evaluateSabAddressCandidate } from "../../server/features/sab-mcp/addressCandidate";
import { authorizeSabScanBatch, claimSabRunScan, completeSabRunReports, createSabRunState, recordSabRunSubmission, type SabRunState, type SabScanPlan } from "../../server/features/sab-mcp/runState";
import { z } from "zod";

vi.mock("../../server/features/sab-mcp/localFalconRankedCells", () => ({getSabRankedCells: vi.fn()}));
vi.mock("../../server/features/sab-mcp/reverseGeocode", () => ({reverseGeocodeSabCenters: vi.fn()}));
vi.mock("../../server/features/sab-mcp/addressCandidate", async importOriginal => ({...(await importOriginal<typeof import("../../server/features/sab-mcp/addressCandidate")>()),evaluateSabAddressCandidate: vi.fn()}));
const approved = {approved_by: "Matt" as const, approval_reference: "explicit-plan-approval"};
const plan: SabScanPlan = {
  place_id: "place", scan_role: "deliverable", scan_type: "standard", center: {latitude:35,longitude:-80},
  grid_size:7,radius:3,measurement:"mi",keyword:"service",platform:"google",estimated_credits:49,save_location_required:false,
};
const key3="aaaaaaaaaaaa",key5="bbbbbbbbbbbb";
const researchedNoCandidate={source_report_key:"cccccccccccc",evidence_hash:"a".repeat(64),status:"no_candidate" as const,research_complete:true,evidence_references:["completed-business-source-search"],source_type:"official website and attributable listing",identity_method:"exact business phone",fit_rationale:"Completed corroboration research produced no address candidate"};
const verifiedContactResearch={
  exact_name_search:{status:"completed" as const,sources_inspected:["https://example.test/contact"]},
  exact_phone_fallback:{status:"not_required_verified_earlier" as const,sources_inspected:[]},
  company_controlled_inspection:{status:"not_required_verified_earlier" as const,sources_inspected:[]},
  accepted_evidence:[{email:"verified@example.test",verification_gate:"official website domain",sources:["https://example.test/contact"]}],
  rejected_candidates:[],result:"verified_email" as const,completed_at:"2026-09-02T20:00:00.000Z",exhaustion_completed_at:null,
  no_unverified_email_retained:true as const,orchestrator_reconciled:true as const,
};
const currentContactResearch={
  evidence_version:3 as const,
  exact_name_search:{status:"completed" as const,query:"Test lead email",rendered_results_inspected:true,ai_overview_status:"absent" as const,
    first_page_snippets_inspected:true,result_source_urls:["https://facebook.com/testlead"],surfaced_official_website_urls:[],
    surfaced_controlled_profile_urls:["https://facebook.com/testlead"],inspected_at:"2026-09-02T20:00:00.000Z"},
  exact_phone_fallback:{status:"not_required_verified_earlier" as const,query:null,rendered_results_inspected:false,ai_overview_status:null,
    first_page_snippets_inspected:false,result_source_urls:[],surfaced_official_website_urls:[],surfaced_controlled_profile_urls:[],inspected_at:null},
  official_website_inspection:{status:"not_available" as const,website_url:null,pages_inspected:[],result:"not_available" as const,
    company_identity_match:null,phone_match:null,material_to_contact_resolution:false,inspected_at:null},
  controlled_profile_inspections:[{source_type:"Facebook",url:"https://facebook.com/testlead",result:"email_found" as const,
    company_identity_match:true,phone_match:"not_present" as const,material_to_contact_resolution:true,inspected_at:"2026-09-02T20:00:05.000Z"}],
  independent_source_inspections:[],accepted_evidence:[{email:"verified@example.test",verification_gate:"company_controlled_source" as const,
    sources:["https://facebook.com/testlead"],source_type:"Facebook",company_identity_match:true as const,corroborating_phone:null,
    inspected_at:"2026-09-02T20:00:05.000Z"}],rejected_candidates:[],result:"verified_email" as const,
  completed_at:"2026-09-02T20:00:06.000Z",exhaustion_completed_at:null,no_unverified_email_retained:true as const,orchestrator_reconciled:true as const,
};
function initialize() {
  return createSabRunState({run_id:"run",orchestrator_id:"owner",authorization_reference:"run-approval",credit_limit:500});
}
function submitted(scan=plan,key=key3,state=initialize(),authorizationId="11111111-1111-4111-8111-111111111111") {
  const next=authorizeSabScanBatch(state,{authorization_id:authorizationId,orchestrator_id:"owner",authorization_reference:"plan",scans:[scan]});
  return recordSabRunSubmission(claimSabRunScan(next,authorizationId,scan,`${key}-idempotency`),`${key}-idempotency`,{submission_status:"submitted",report_key:key});
}
function report(key=key3,scan=plan,overrides:Record<string,unknown>={}) {
  return {
    report_key:key,public_url:`https://example.test/public/${key}`,completion_status:"complete",completion_verified:true,report_subject_place_id:scan.place_id,
    keyword:scan.keyword,platform:scan.platform,scan_date:"2026-08-31",arp:5,atrp:19,solv:10,found_in:1,
    missing_place_id_count:0,found_place_id_count:1,grid:{size:scan.grid_size,point_count:scan.grid_size**2,radius:scan.radius,measurement:scan.measurement,center:scan.center},
    businesses:[{place_id:scan.place_id,evidence_source:"competitor_roster",ranked_cell_count:1,imprecise_or_unranked_cell_count:48,ranked_cells:[{row:4,column:4,latitude:35,longitude:-80,rank:5}],all_point_rank_cells:[{row:4,column:4,latitude:35,longitude:-80,rank:5}]}],...overrides,
  };
}
function currentEvidenceHash(value:ReturnType<typeof report>) {
  return createHash("sha256").update(JSON.stringify({report_key:value.report_key,grid:value.grid,cells:value.businesses[0].all_point_rank_cells ?? value.businesses[0].ranked_cells,arp:value.arp,atrp:value.atrp,solv:value.solv})).digest("hex");
}
function legacyEvidenceHash(value:ReturnType<typeof report>) {
  return createHash("sha256").update(value.businesses[0].ranked_cells
    .filter(cell=>Number.isInteger(cell.rank) && cell.rank>=1 && cell.rank<=20)
    .map(cell=>[cell.row,cell.column,cell.rank,cell.latitude,cell.longitude].join(","))
    .sort().join("\n"))
    .digest("hex");
}
function repository(state=submitted(),overrides:Record<string,unknown>={}) {
  let storedState=structuredClone(state);
  let row:Record<string,any>={company:"Test lead",place_id:"place",workflow:"scale_first_v2",address:"Service Area Business",qualification_status:null,rating:4.8,review_count:1,
    email:"verified@example.test",phone:null,contact_tag:"Email Ready",outcome:null,report_key:null,scan_center:"35,-80",center_type:"weighted_cell_centroid",
    eligibility_state:{sab_confirmed:true,trade_match:true,franchise_excluded:true,crm_dedup_checked:true,contact_verified:true,evidence_references:["verified-evidence"],contact_research:verifiedContactResearch},
    decision_state:{source_report_key:"cccccccccccc",evidence_hash:"a".repeat(64),rule_id:"S01",centering_status:"planned",proposed_center:"35,-80",center_type:"weighted_cell_centroid",routine_recenter_count:0,evidence:{next_action:"plan_deliverable",grid:{radius:3}}},...overrides};
  return {
    assertOneActiveRun:vi.fn(async()=>{}),
    getRunState:vi.fn(async()=>structuredClone(storedState)),
    getRunCompletionRows:vi.fn(async()=>[structuredClone(row)]),
    getExportCandidates:vi.fn(async()=>row.qualification_status==="qualified"?[structuredClone(row)]:[]),
    getCompany:vi.fn(async()=>structuredClone(row)),
    getScanSubmission:vi.fn(async()=>null),
    saveRunState:vi.fn(async(next:SabRunState,version:number)=>{expect(version).toBe(storedState.version);storedState=structuredClone(next);}),
    updateScanSubmission:vi.fn(async(_place:string,_key:string,updates:Record<string,unknown>)=>structuredClone(updates)),
    saveCompany:vi.fn(async(_place:string,updates:Record<string,unknown>,_actor?:string,_options?:{exclusionReviewApproved?:boolean;exclusionReviewDeclined?:boolean;exclusionDecisionContinued?:boolean;corroborationRecorded?:boolean;corroborationAnalysisVerified?:boolean})=>{row={...row,...structuredClone(updates)};return {writes_performed:true};}),
    saveScanResult:vi.fn(async(_place:string,value:Record<string,unknown>,_actor:string,options?:{historyOnly?:boolean})=>{
      if(!options?.historyOnly && value.scan_role==="deliverable") row={...row,...structuredClone(value)};
      return {report_key:value.report_key,current_scan_updated:!options?.historyOnly};
    }),
  };
}
function tools(repo:ReturnType<typeof repository>) {
  const handlers:Record<string,{schema:Record<string,z.ZodTypeAny>;handler:(args:any)=>Promise<any>}>={};
  const server={registerTool:(name:string,definition:any,handler:any)=>{handlers[name]={schema:definition.inputSchema,handler};}};
  registerSabOrchestrationTools(server as never,(()=>repo) as never,"actor");
  return {invoke:async(name:string,args:Record<string,unknown>)=>{
    const checks=name==="authorize_sab_scan_batch" && !Object.hasOwn(args,"duplicate_report_checks") ? {duplicate_report_checks:(args.scans as SabScanPlan[]).map(scan=>({scan,result:"none",evidence_reference:"verified-report-inventory",checked_at:"2026-08-31T14:00:00.000Z"}))} : {};
    const value=await handlers[name].handler(z.object(handlers[name].schema).parse({...checks,workflow_sheet:"sheet",sheet_name:"SAB Workflow",run_id:"run",...args}));
    return JSON.parse(value.content[0].text);
  },handlers};
}
beforeEach(()=>vi.clearAllMocks());

describe("SAB orchestration integration",()=>{
  it("preserves an existing center derivation when validation confirms it",async()=>{
    const repo=repository();
    vi.mocked(getSabRankedCells).mockResolvedValue(report() as never);
    const result=await analyzeAndRecordSabReport(repo as never,{run_id:"run",report_key:key3,place_id:"place",stage:"deliverable"},"actor");
    expect(result.action).toBe("center_validated");
    expect((await repo.getCompany()).decision_state.center_type).toBe("weighted_cell_centroid");
    expect(repo.saveScanResult).toHaveBeenCalledWith("place",expect.objectContaining({center_type:"weighted_cell_centroid",scan_spec:{grid_size:"7x7",radius_miles:3},arp:5,atrp:19}),"actor",{historyOnly:false});
    expect(repo.saveScanResult.mock.calls[0][1].report_url).toBe(`https://example.test/public/${key3}`);
  });

  it("requires a provider public URL and verified completion before persisting deliverables",async()=>{
    for(const overrides of [{public_url:null},{completion_verified:false}]) {
      const repo=repository();
      vi.mocked(getSabRankedCells).mockResolvedValue(report(key3,plan,overrides) as never);
      await expect(analyzeAndRecordSabReport(repo as never,{run_id:"run",report_key:key3,place_id:"place",stage:"deliverable"},"actor")).rejects.toThrow(/public report URL|completion/);
      expect(repo.saveScanResult).not.toHaveBeenCalled();
      expect(repo.saveCompany).not.toHaveBeenCalled();
    }
  });

  it("routes an exact completed deliverable subject absent from the competitor roster to S05 evidence review",async()=>{
    const repo=repository();
    const allPointRankCells=Array.from({length:49},(_,i)=>({row:Math.floor(i/7)+1,column:i%7+1,latitude:35+(3-Math.floor(i/7))*.01,longitude:-80+((i%7)-3)*.01,rank:21}));
    vi.mocked(getSabRankedCells).mockResolvedValue(report(key3,plan,{
      arp:null,atrp:null,solv:0,found_in:0,found_place_id_count:0,missing_place_id_count:1,missing_place_ids:["place"],
      businesses:[{place_id:"place",name:null,evidence_source:"report_subject_absent_from_competitor_roster",ranked_cell_count:0,imprecise_or_unranked_cell_count:49,ranked_cells:[],all_point_rank_cells:allPointRankCells}],
    }) as never);
    const result=await analyzeAndRecordSabReport(repo as never,{run_id:"run",report_key:key3,place_id:"place",stage:"deliverable"},"actor");
    expect(result).toMatchObject({action:"evidence_review_required",rule_ids:["S05"]});
    expect(result.evidence).toMatchObject({exact_top20_count:0,point_count:49});
    expect(repo.saveScanResult).toHaveBeenCalledTimes(1);
  });

  it("derives recenter counts and active saturation policy from authoritative evidence",async()=>{
    const recenter={...plan,scan_type:"recenter" as const};
    const repo=repository(submitted(recenter));
    const cells=Array.from({length:49},(_,i)=>({row:Math.floor(i/7)+1,column:i%7+1,latitude:35+(3-Math.floor(i/7))*.01,longitude:-80+((i%7)-3)*.01,rank:1}));
    vi.mocked(getSabRankedCells).mockResolvedValue(report(key3,recenter,{businesses:[{place_id:"place",ranked_cells:cells}]}) as never);
    const result=await analyzeAndRecordSabReport(repo as never,{run_id:"run",report_key:key3,place_id:"place",stage:"deliverable",routine_recenter_count:0,saturation_policy_approved:true} as never,"actor");
    expect(result.action).toBe("same_center_five_mile_comparison");
    expect((await repo.getCompany()).decision_state.routine_recenter_count).toBe(1);
    expect(repo.saveScanResult.mock.calls[0][3]).toEqual({historyOnly:false});
    expect(tools(repo).handlers.analyze_sab_scan.schema).not.toHaveProperty("saturation_policy_approved");
  });

  it("reuses one provider read, persists the decision, verifies readback and continues autonomously",async()=>{
    const repo=repository();vi.mocked(getSabRankedCells).mockResolvedValue(report() as never);
    const result=await tools(repo).invoke("review_sab_completed_batch",{});
    expect(getSabRankedCells).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({stop_before_further_scans:false,matt_review_required:false});
    expect(result.scan_results[0]).toMatchObject({company:"Test lead",result:{classification:"center_validated",measured_values:{exact_top20_count:1,point_count:49,raw_arp:5,all_point_atrp:19,solv:10}},sop_rule:"S05, S09"});
    expect((await repo.getRunState()).batches[0].status).toBe("completed");
    expect(repo.saveCompany.mock.invocationCallOrder[0]).toBeLessThan(repo.saveRunState.mock.invocationCallOrder[0]);
  });

  it("returns concise scan results and genuine exceptions without a routine pause",async()=>{
    const repo=repository(submitted());vi.mocked(getSabRankedCells).mockResolvedValue(report() as never);
    const response=await tools(repo).invoke("review_sab_completed_batch",{});
    expect(response).toMatchObject({stop_before_further_scans:false,matt_review_required:false,
      batch_summary:{report_count:1,classification_counts:{center_validated:1},exception_count:0},exceptions:[],
      scan_results:[{company:"Test lead",report_url:`https://example.test/public/${key3}`,scan_specification:"7×7/3 mi",
        result:{classification:"center_validated"},proposed_next_step_and_reason:expect.any(String),sop_rule:"S05, S09"}],
      routine_results_persisted:1,full_histories_returned:false,continue_unaffected_work:true,next_action:"continue_autonomously"});
    expect(response).not.toHaveProperty("table");
    expect((await repo.getRunState()).batches[0].status).toBe("completed");
  });

  it("never completes a batch with a wrong provider envelope or failed structured readback",async()=>{
    const repo=repository();vi.mocked(getSabRankedCells).mockResolvedValue(report(key3,{...plan,radius:5}) as never);
    await expect(tools(repo).invoke("review_sab_completed_batch",{})).rejects.toThrow(/envelope/);
    expect(repo.saveRunState).not.toHaveBeenCalled();expect(repo.saveCompany).not.toHaveBeenCalled();
    vi.mocked(getSabRankedCells).mockResolvedValue(report() as never);
    repo.saveCompany.mockImplementationOnce(async()=>({writes_performed:true}));
    await expect(tools(repo).invoke("review_sab_completed_batch",{})).rejects.toThrow(/readback/);
    expect(repo.saveRunState).not.toHaveBeenCalled();
  });

  it("rejects mismatched next actions and unverified eligibility even for the same coordinates",async()=>{
    const args={orchestrator_id:"owner",authorization_id:"22222222-2222-4222-8222-222222222222",authorization_reference:"plan",scans:[{...plan,scan_role:"auxiliary",scan_type:"scout",grid_size:9,radius:6,estimated_credits:81}],matt_initial_approval:approved};
    const repo=repository(initialize());
    await expect(tools(repo).invoke("authorize_sab_scan_batch",args)).rejects.toThrow(/next action|corroboration/);
    expect(repo.saveRunState).not.toHaveBeenCalled();
    const missing=repository(initialize(),{eligibility_state:{sab_confirmed:true}});
    await expect(tools(missing).invoke("authorize_sab_scan_batch",{...args,scans:[plan]})).rejects.toThrow(/Structured SAB/);
    const valid=repository(initialize());
    await expect(tools(valid).invoke("authorize_sab_scan_batch",{...args,scans:[plan]})).resolves.toMatchObject({scan_approved:true,paid_scans_submitted:0});
    expect((await valid.getCompany()).qualification_status).toBeNull();
    const premature=repository(initialize(),{qualification_status:"qualified"});
    await expect(tools(premature).invoke("authorize_sab_scan_batch",{...args,scans:[plan]})).rejects.toThrow(/qualification_status cannot authorize spending/);
  });

  it("allows only the exact structured routine fine specification and retains OAuth metadata",async()=>{
    const row=repository(initialize());
    const initial=await row.getCompany();
    const repo=repository(initialize(),{decision_state:{...initial.decision_state,address_corroboration:researchedNoCandidate,evidence:{next_action:"plan_auxiliary",auxiliary_scan_spec:{scan_type:"fine",grid_size:7,radius:1.5,measurement:"mi"}}}});
    const fine={...plan,scan_role:"auxiliary",scan_type:"fine",radius:1.5};
    const args={orchestrator_id:"owner",authorization_id:"22222222-2222-4222-8222-222222222222",authorization_reference:"plan",scans:[fine],matt_initial_approval:approved};
    await expect(tools(repo).invoke("authorize_sab_scan_batch",args)).resolves.toMatchObject({scan_approved:true});
    const wrong=repository(initialize(),{decision_state:{...initial.decision_state,address_corroboration:researchedNoCandidate,evidence:{next_action:"plan_auxiliary"}}});
    await expect(tools(wrong).invoke("authorize_sab_scan_batch",args)).rejects.toThrow(/next action/);
    const registration=vi.fn();
    registerSabOrchestrationTools({registerTool:registration} as never,(()=>repo) as never,"actor");
    expect(registration.mock.calls[0][1]).toMatchObject({securitySchemes:[{type:"oauth2",scopes:["sab:read","sab:write"]}],_meta:{securitySchemes:[{type:"oauth2"}]}});
  });

  it("rejects a Needs Email paid plan that still carries an email and checks one-run-per-sheet on initialization",async()=>{
    const invalid=repository(initialize(),{contact_tag:"Needs Email",email:"existing@example.test",phone:"5555550100"});
    await expect(tools(invalid).invoke("authorize_sab_scan_batch",{orchestrator_id:"owner",authorization_id:"22222222-2222-4222-8222-222222222222",authorization_reference:"plan",scans:[plan],matt_initial_approval:approved})).rejects.toThrow(/matching contact research/);
    const repo=repository();
    repo.getRunState.mockResolvedValue(null as never);
    repo.assertOneActiveRun.mockRejectedValue(new Error("Another run already exists"));
    await expect(tools(repo).invoke("initialize_sab_run",{orchestrator_id:"owner",authorization_reference:"run",credit_limit:500,
      sop_revision:{document_id:"doc",revision_id:"rev",title:"SOP"}})).rejects.toThrow(/Another run/);
    expect(repo.saveRunState).not.toHaveBeenCalled();
  });

  it("records current contact evidence only through the dedicated exact-company transition",async()=>{
    const repo=repository(initialize());
    const result=await tools(repo).invoke("record_sab_contact_research",{orchestrator_id:"owner",place_id:"place",
      contact_tag:"Email Ready",email:"verified@example.test",contact_research:currentContactResearch});
    expect(result).toMatchObject({place_id:"place",contact_tag:"Email Ready",email:"verified@example.test",evidence_version:3,
      paid_scans_submitted:0,outreach_sent:false});
    expect((await repo.getCompany()).eligibility_state.contact_research).toMatchObject({evidence_version:3,result:"verified_email"});
  });

  it("requires Matt and the run orchestrator for a named terminal deferral",async()=>{
    const repo=repository(initialize(),{status:"blocked",blocker:"centering_recovery",qualification_status:null});
    const args={orchestrator_id:"owner",place_id:"place",reason:"Matt explicitly ended recovery for this company",approval:approved};
    await expect(tools(repo).invoke("approve_sab_terminal_deferral",{...args,orchestrator_id:"worker"})).rejects.toThrow(/orchestrator/);
    await expect(tools(repo).invoke("approve_sab_terminal_deferral",{...args,approval:{approved_by:"Worker",approval_reference:"no"}})).rejects.toThrow();
    await expect(tools(repo).invoke("approve_sab_terminal_deferral",args)).resolves.toMatchObject({terminal_deferral:true,approved_by:"Matt",paid_scans_submitted:0});
    expect(await repo.getCompany()).toMatchObject({qualification_status:"deferred",status:"complete",blocker:null});
    expect((await repo.getRunState()).terminal_deferrals.place).toMatchObject({approved_by:"Matt",reason:args.reason});
  });

  it("applies only an exact named canonical exception while preserving failed S05 evidence",async()=>{
    const special=new Map([["4:4",1],["5:4",1],["6:3",1],["7:2",1],["3:4",1],["2:5",1],["1:6",1]]);
    const cells=Array.from({length:49},(_,index)=>{const row=Math.floor(index/7)+1,column=index%7+1;return {
      row,column,latitude:35+(4-row)*.01,longitude:-80+(column-4)*.01,rank:special.get(`${row}:${column}`)??10,
    }});
    const completed=completeSabRunReports(submitted(),[key3]);
    const value=report(key3,plan,{arp:8,atrp:8,solv:20,found_in:49,businesses:[{place_id:"place",evidence_source:"competitor_roster",
      ranked_cell_count:49,imprecise_or_unranked_cell_count:0,ranked_cells:cells,all_point_rank_cells:cells}]});
    const hash=currentEvidenceHash(value);
    const failed={source_report_key:key3,evidence_hash:hash,rule_id:"S04,S05",centering_status:"failed",routine_recenter_count:0,
      evidence:{next_action:"evidence_review_required",reason:"The failed margin has no verified movement toward the selected peak; do not resubmit an identical center.",
        margin:{failed:true,reason:"global_best_on_boundary"}}};
    const repo=repository(completed,{decision_state:failed,scan_center:"35,-80",center_type:"corroborated_address",status:"blocked",blocker:"evidence_review_required"});
    vi.mocked(getSabRankedCells).mockResolvedValue(value as never);
    const result=await tools(repo).invoke("approve_sab_canonical_evidence_exception",{orchestrator_id:"owner",place_id:"place",report_key:key3,evidence_hash:hash,
      reason:"Named run-specific acceptance because the selected peak is already at the current center.",approval:approved});
    expect(result).toMatchObject({canonical_persisted:true,center_validated_by_named_exception:true,preserved_s05_evidence:true,creates_general_policy:false});
    const saved=await repo.getCompany();
    expect(saved).toMatchObject({report_key:key3,outcome:"deliverable",status:"in_progress",blocker:null,
      decision_state:{centering_status:"validated",proposed_center:"35,-80",center_type:"corroborated_address",evidence:{next_action:"center_validated",
        margin:{failed:true},run_specific_exception:{kind:"canonical_centered_peak_no_movement",evidence_hash:hash,creates_general_policy:false}}}});
    expect(repo.saveCompany.mock.calls.at(-1)?.[3]).toEqual({runSpecificCanonicalExceptionVerified:true});
  });

  it("plans only the exact approved dominant-cluster centroid for a named S01 singleton exception",async()=>{
    const cluster=Array.from({length:25},(_,index)=>({row:10+Math.floor(index/5),column:10+index%5})).slice(0,23)
      .map((cell,index)=>({...cell,latitude:35+(12-cell.row)*.01,longitude:-80+(cell.column-12)*.01,rank:index%7+1}));
    const outlier={row:2,column:2,latitude:35.1,longitude:-80.1,rank:13};
    const cells=[...cluster,outlier];
    const masterPlan={...plan,grid_size:21 as const,radius:12,estimated_credits:441};
    const value=report("cccccccccccc",masterPlan,{report_subject_place_id:"anchor",grid:{size:21,point_count:441,radius:12,measurement:"mi",center:{latitude:35,longitude:-80}},
      businesses:[{place_id:"place",evidence_source:"competitor_roster",ranked_cell_count:24,imprecise_or_unranked_cell_count:417,ranked_cells:cells,all_point_rank_cells:cells}]});
    const hash=currentEvidenceHash(value),weight=cluster.reduce((sum,cell)=>sum+1/cell.rank,0);
    const center={latitude:cluster.reduce((sum,cell)=>sum+cell.latitude/cell.rank,0)/weight,longitude:cluster.reduce((sum,cell)=>sum+cell.longitude/cell.rank,0)/weight};
    const corroboration={...researchedNoCandidate,source_report_key:"cccccccccccc",evidence_hash:hash};
    const repo=repository(initialize(),{decision_state:{source_report_key:"cccccccccccc",evidence_hash:hash,rule_id:"S01",centering_status:"failed",routine_recenter_count:0,
      address_corroboration:corroboration,evidence:{next_action:"evidence_review_required",reason:"Disconnected master clusters require evidence review."}},
      scan_center:null,center_type:null,status:"blocked",blocker:"disconnected_master_clusters_evidence_review_required"});
    vi.mocked(getSabRankedCells).mockResolvedValue(value as never);
    const result=await tools(repo).invoke("approve_sab_master_cluster_exception",{orchestrator_id:"owner",place_id:"place",report_key:"cccccccccccc",evidence_hash:hash,
      center,dominant_cluster_size:23,outlier_cluster_size:1,outlier_rank:13,reason:"Treat the isolated rank-13 cell as an outlier for this company only.",approval:approved});
    expect(result).toMatchObject({action:"plan_deliverable",proposed_center:center,dominant_cluster_size:23,outlier_cluster_size:1,outlier_rank:13,creates_general_policy:false});
    const saved=await repo.getCompany();
    expect(saved).toMatchObject({status:"in_progress",blocker:null,center_type:"weighted_cell_centroid",
      decision_state:{centering_status:"planned",evidence:{next_action:"plan_deliverable",run_specific_exception:{kind:"master_singleton_outlier",creates_general_policy:false}}}});
    expect(repo.saveCompany.mock.calls.at(-1)?.[3]).toEqual({runSpecificMasterClusterExceptionVerified:true});
  });

  it("records no-visibility market context and keyword without inventing a validated center or canonical report",async()=>{
    const scout={...plan,scan_role:"auxiliary" as const,scan_type:"scout" as const,grid_size:9 as const,radius:6,estimated_credits:81};
    const repo=repository(submitted(scout));
    vi.mocked(getSabRankedCells).mockResolvedValue(report(key3,scout,{businesses:[{place_id:"place",ranked_cells:[]}],arp:null,atrp:21,solv:0}) as never);
    vi.mocked(reverseGeocodeSabCenters).mockResolvedValue({results:[{status:"complete",city:"Reference Market",state:"NC",zip:"28000"}]} as never);
    const result=await analyzeAndRecordSabReport(repo as never,{run_id:"run",report_key:key3,place_id:"place",stage:"auxiliary"},"actor");
    const row=await repo.getCompany();
    expect(result.action).toBe("no_visibility_core_found");
    expect(row).toMatchObject({outcome:"no_visibility_core_found",scan_center:null,center_type:null,report_key:null,scan_spec:null,scan_keyword:"service",market_reference:{kind:"market_reference_only",auxiliary_report_key:key3}});
    expect(repo.saveScanResult.mock.calls[0][3]).toEqual({historyOnly:true});
  });

  it.each([{fiveArp:6,fiveSolv:5,selected:5},{fiveArp:5,fiveSolv:5,selected:3}])("persists canonical $selected-mile selection with both actual report specifications",async({fiveArp,fiveSolv,selected})=>{
    const threeState=completeSabRunReports(submitted(),[key3]);
    const fivePlan={...plan,radius:5};
    const state=completeSabRunReports(submitted(fivePlan,key5,threeState,"22222222-2222-4222-8222-222222222222"),[key5]);
    const repo=repository(state,{report_key:key3,decision_state:{source_report_key:key5,evidence_hash:"a".repeat(64),rule_id:"S08",centering_status:"validated",proposed_center:"35,-80",center_type:"weighted_cell_centroid",routine_recenter_count:0,evidence:{next_action:"comparison_ready",center_validation:{report_key:key3,evidence_hash:"c".repeat(64),proposed_center:"35,-80",center_type:"weighted_cell_centroid"}}}});
    vi.mocked(getSabRankedCells).mockImplementation(async key=>(key===key3?report():report(key5,fivePlan,{arp:fiveArp,solv:fiveSolv,atrp:20})) as never);
    const result=await tools(repo).invoke("select_sab_canonical_report",{place_id:"place",three_mile_report_key:key3,five_mile_report_key:key5});
    expect(result).toMatchObject({selected_radius_miles:selected,canonical_persisted:true});
    expect(repo.saveScanResult).toHaveBeenCalledTimes(3);
    expect(repo.saveScanResult.mock.calls.slice(0,2).map(call=>call[3])).toEqual([{historyOnly:true},{historyOnly:true}]);
    expect(repo.saveScanResult.mock.calls[2][1]).toMatchObject({report_key:selected===5?key5:key3,scan_spec:{grid_size:"7x7",radius_miles:selected},center_type:"weighted_cell_centroid",arp:selected===5?fiveArp:5,atrp:selected===5?20:19});
    expect((await repo.getCompany()).report_key).toBe(selected===5?key5:key3);
  });

  it("rejects unrelated or stale scan evidence instead of overwriting current decisions",async()=>{
    const repo=repository();vi.mocked(getSabRankedCells).mockResolvedValue(report(key5) as never);
    await expect(analyzeAndRecordSabReport(repo as never,{run_id:"run",report_key:key5,place_id:"place",stage:"deliverable"},"actor")).rejects.toThrow(/latest submitted/);
    expect(repo.saveCompany).not.toHaveBeenCalled();
  });
  it("applies the permanent saturation definition without caller flags",async()=>{
    const repo=repository(submitted());
    const cells=Array.from({length:49},(_,i)=>({row:Math.floor(i/7)+1,column:i%7+1,latitude:35+(3-Math.floor(i/7))*.01,longitude:-80+((i%7)-3)*.01,rank:2}));
    vi.mocked(getSabRankedCells).mockResolvedValue(report(key3,plan,{businesses:[{place_id:"place",ranked_cells:cells}]}) as never);
    const result=await analyzeAndRecordSabReport(repo as never,{run_id:"run",report_key:key3,place_id:"place",stage:"deliverable"},"actor");
    expect(result.action).toBe("same_center_five_mile_comparison");
    expect(repo.saveScanResult.mock.calls[0][3]).toEqual({historyOnly:false});
  });

  it("shows 45/49 saturation and all-point medians in the batch summary, keeping ARP and ATRP distinct",async()=>{
    const repo=repository();
    const all=Array.from({length:49},(_,i)=>({row:Math.floor(i/7)+1,column:i%7+1,latitude:35+(3-Math.floor(i/7))*.01,longitude:-80+((i%7)-3)*.01,rank:i<4?21:2}));
    vi.mocked(getSabRankedCells).mockResolvedValue(report(key3,plan,{arp:2,atrp:3.55,solv:80,businesses:[{place_id:"place",ranked_cells:all.filter(c=>c.rank<=20),all_point_rank_cells:all}]}) as never);
    const result=await tools(repo).invoke("review_sab_completed_batch",{});
    expect(result.scan_results[0]).toMatchObject({report_url:`https://example.test/public/${key3}`,scan_specification:"7×7/3 mi",
      result:{classification:"same_center_five_mile_comparison",measured_values:{exact_top20_count:45,point_count:49,raw_arp:2,all_point_atrp:3.55,solv:80}}});
    expect(result.scan_results[0].result.measured_values.saturation).toMatchObject({all_point_median:2,outer_median:2,central_median:2});
    expect(result.stop_before_further_scans).toBe(false);
    await expect(tools(repo).invoke("authorize_sab_scan_batch",{orchestrator_id:"owner",authorization_id:"22222222-2222-4222-8222-222222222222",authorization_reference:"next",scans:[{...plan,radius:5}]})).resolves.toMatchObject({scan_approved:true});
  });

  it("permits one optional nonsaturated comparison with exact report-check evidence",async()=>{
    const repo=repository();vi.mocked(getSabRankedCells).mockResolvedValue(report() as never);
    await tools(repo).invoke("review_sab_completed_batch",{});
    const args={orchestrator_id:"owner",authorization_id:"22222222-2222-4222-8222-222222222222",authorization_reference:"comparison-plan",scans:[{...plan,radius:5}]};
    await expect(tools(repo).invoke("authorize_sab_scan_batch",args)).resolves.toMatchObject({scan_approved:true});
    expect((await repo.getRunState()).batches.at(-1)?.duplicate_report_checks?.[0]).toMatchObject({scan:{radius:5,center:plan.center},result:"none",evidence_reference:"verified-report-inventory"});
  });

  it("does not accept missing or differently centered duplicate-report checks",async()=>{
    const repo=repository(initialize()),api=tools(repo);
    const args={orchestrator_id:"owner",authorization_id:"22222222-2222-4222-8222-222222222222",authorization_reference:"plan",scans:[plan],matt_initial_approval:approved};
    await expect(api.invoke("authorize_sab_scan_batch",{...args,duplicate_report_checks:undefined})).rejects.toThrow();
    await expect(api.invoke("authorize_sab_scan_batch",{...args,duplicate_report_checks:[{scan:{...plan,center:{latitude:35.01,longitude:-80}},result:"none",evidence_reference:"old-check",checked_at:"2026-08-31T14:00:00.000Z"}]})).rejects.toThrow(/exact proposed scan envelope/);
    expect(repo.saveRunState).not.toHaveBeenCalled();
  });

  it("recovers an exact ambiguous provider report without another paid submission or run reset",async()=>{
    const authorized=authorizeSabScanBatch(initialize(),{authorization_id:"11111111-1111-4111-8111-111111111111",orchestrator_id:"owner",authorization_reference:"plan",scans:[plan],matt_initial_approval:approved});
    const claimed=claimSabRunScan(authorized,"11111111-1111-4111-8111-111111111111",plan,"ambiguous-idempotency");
    const ambiguous=recordSabRunSubmission(claimed,"ambiguous-idempotency",{submission_status:"ambiguous_response"});
    const repo=repository(ambiguous),api=tools(repo);
    vi.mocked(getSabRankedCells).mockResolvedValue(report() as never);
    const recovered=await api.invoke("reconcile_sab_ambiguous_submission",{orchestrator_id:"owner",authorization_id:"11111111-1111-4111-8111-111111111111",place_id:"place",report_key:key3});
    expect(recovered).toMatchObject({submission_status:"submitted",recovered_existing_claim:true,scans_submitted:0,credits_added:0,next_batch_status:"awaiting_completion"});
    expect(repo.saveScanResult).not.toHaveBeenCalled();
    expect((await repo.getRunState()).committed_credits).toBe(49);
    vi.mocked(getSabRankedCells).mockResolvedValue(report(key5,{...plan,center:{latitude:35.1,longitude:-80}}) as never);
    await expect(api.invoke("reconcile_sab_ambiguous_submission",{orchestrator_id:"owner",authorization_id:"11111111-1111-4111-8111-111111111111",place_id:"place",report_key:key5})).rejects.toThrow(/ambiguous durable claim/);
  });

  it("recovers an exact report from a post-provider reserved claim without another paid submission",async()=>{
    const authorized=authorizeSabScanBatch(initialize(),{authorization_id:"11111111-1111-4111-8111-111111111111",orchestrator_id:"owner",authorization_reference:"plan",scans:[plan],matt_initial_approval:approved});
    const reserved=claimSabRunScan(authorized,"11111111-1111-4111-8111-111111111111",plan,"stuck-idempotency");
    const repo=repository(reserved),api=tools(repo);
    repo.getScanSubmission.mockResolvedValue({submission_status:"submitting",submit_started_at:"2026-09-01T21:54:00.000Z"});
    vi.mocked(getSabRankedCells).mockResolvedValue(report() as never);
    const recovered=await api.invoke("reconcile_sab_ambiguous_submission",{orchestrator_id:"owner",authorization_id:"11111111-1111-4111-8111-111111111111",place_id:"place",report_key:key3});
    expect(recovered).toMatchObject({submission_status:"submitted",recovered_existing_claim:true,recovery_source:"verified_post_provider_reserved_claim",scans_submitted:0,credits_added:0,next_batch_status:"awaiting_completion"});
    expect(repo.updateScanSubmission).toHaveBeenCalledWith("place","stuck-idempotency",expect.objectContaining({submission_status:"submitted",report_key:key3,recovery:"verified_existing_report"}),"actor");
    expect((await repo.getRunState()).committed_credits).toBe(49);
  });

  it("does not spend while a returned provider phone conflicts with the selected verified contact",async()=>{
    const repo=repository(initialize(),{phone:"5555550101",business_profile:{source:"dataforseo_my_business_info_live",place_id:"place",phone:"5555550102"}});
    await expect(tools(repo).invoke("authorize_sab_scan_batch",{orchestrator_id:"owner",authorization_id:"11111111-1111-4111-8111-111111111111",authorization_reference:"plan",scans:[plan],matt_initial_approval:approved})).rejects.toThrow(/phone conflict/);
    expect(repo.saveRunState).not.toHaveBeenCalled();
  });

  it.each([{cells:[]},{cells:[{row:1,column:4,latitude:35.05,longitude:-80,rank:1},{row:4,column:4,latitude:35,longitude:-80,rank:9}]}])("never recenters or invalidates a three-mile center from a five-mile comparison's footprint",async({cells})=>{
    const initial=repository();vi.mocked(getSabRankedCells).mockResolvedValue(report() as never);
    await tools(initial).invoke("review_sab_completed_batch",{});
    const threeState=await initial.getRunState(),threeRow=await initial.getCompany(),fivePlan={...plan,radius:5};
    const repo=repository(submitted(fivePlan,key5,threeState,"22222222-2222-4222-8222-222222222222"),threeRow);
    const five=report(key5,fivePlan,{arp:6,atrp:20,solv:5,businesses:[{place_id:"place",ranked_cells:cells}]});
    vi.mocked(getSabRankedCells).mockResolvedValue(five as never);
    const checkpoint=await tools(repo).invoke("review_sab_completed_batch",{});
    expect(checkpoint.scan_results[0].result.classification).toBe("comparison_ready");
    const row=await repo.getCompany();
    expect(row.report_key).toBe(key3);
    expect(row.decision_state).toMatchObject({centering_status:"validated",routine_recenter_count:0,proposed_center:"35,-80",evidence:{centering_evaluated:false,center_validation:{report_key:key3}}});
    vi.mocked(getSabRankedCells).mockImplementation(async key=>(key===key3?report():five) as never);
    await expect(tools(repo).invoke("select_sab_canonical_report",{place_id:"place",three_mile_report_key:key3,five_mile_report_key:key5})).resolves.toMatchObject({selected_radius_miles:5,raw_arp_increased:true,solv_decreased:true});
    expect((await repo.getCompany()).decision_state.evidence.center_validation.report_key).toBe(key3);
  });

  it("blocks a repeated comparison even with an exception and never accepts a five-mile recenter",async()=>{
    const initial=repository();vi.mocked(getSabRankedCells).mockResolvedValue(report() as never);
    await tools(initial).invoke("review_sab_completed_batch",{});
    const fivePlan={...plan,radius:5},state=completeSabRunReports(submitted(fivePlan,key5,await initial.getRunState(),"22222222-2222-4222-8222-222222222222"),[key5]);
    const row=await initial.getCompany();row.decision_state.source_report_key=key5;
    const repo=repository(state,row),args={orchestrator_id:"owner",authorization_id:"33333333-3333-4333-8333-333333333333",authorization_reference:"again",scans:[fivePlan],matt_review:{...approved,reviewed_batch_id:"22222222-2222-4222-8222-222222222222"},exception:{...approved,reason:"try again"}};
    await expect(tools(repo).invoke("authorize_sab_scan_batch",args)).rejects.toThrow(/Only one five-mile/);
    await expect(tools(repo).invoke("authorize_sab_scan_batch",{...args,scans:[{...fivePlan,scan_type:"recenter"}]})).rejects.toThrow(/never a recenter/);
    expect(repo.saveRunState).not.toHaveBeenCalled();
  });

  it("preserves accepted three-mile centering while missing five-mile exclusion metrics require evidence review",async()=>{
    const initial=repository();vi.mocked(getSabRankedCells).mockResolvedValue(report() as never);
    await tools(initial).invoke("review_sab_completed_batch",{});
    const fivePlan={...plan,radius:5},repo=repository(submitted(fivePlan,key5,await initial.getRunState(),"22222222-2222-4222-8222-222222222222"),await initial.getCompany());
    const cells=Array.from({length:49},(_,i)=>({row:Math.floor(i/7)+1,column:i%7+1,latitude:35+(3-Math.floor(i/7))*.01,longitude:-80+((i%7)-3)*.01,rank:2}));
    vi.mocked(getSabRankedCells).mockResolvedValue(report(key5,fivePlan,{arp:null,solv:80,businesses:[{place_id:"place",ranked_cells:cells}]}) as never);
    const result=await tools(repo).invoke("review_sab_completed_batch",{});
    expect(result.scan_results[0].result.classification).toBe("evidence_review_required");
    expect(await repo.getCompany()).toMatchObject({status:"blocked",blocker:"five_mile_comparison_review_required",report_key:key3,decision_state:{centering_status:"validated",proposed_center:"35,-80",center_type:"weighted_cell_centroid",evidence:{centering_evaluated:false,center_validation:{report_key:key3}}}});
    const writes=repo.saveScanResult.mock.calls.length;
    await expect(tools(repo).invoke("select_sab_canonical_report",{place_id:"place",three_mile_report_key:key3,five_mile_report_key:key5})).rejects.toThrow(/exclusion or evidence/);
    expect(repo.saveScanResult.mock.calls).toHaveLength(writes);
  });

  it("requires corroboration for unresolved master evidence and records completed no-candidate research before an auxiliary",async()=>{
    const repo=repository(initialize());
    const master=report("cccccccccccc",plan,{businesses:[{place_id:"place",ranked_cells:[{row:1,column:4,latitude:35.05,longitude:-80,rank:5}]}]});
    vi.mocked(getSabRankedCells).mockResolvedValue(master as never);
    const api=tools(repo),source={run_id:"run",report_key:"cccccccccccc",place_id:"place",stage:"master"};
    expect(await api.invoke("analyze_sab_scan",source)).toMatchObject({action:"address_corroboration_required"});
    expect(await repo.getCompany()).toMatchObject({status:"blocked",blocker:"address_corroboration_required"});
    const args={orchestrator_id:"owner",place_id:"place",report_key:"cccccccccccc",result:"no_candidate",research_complete:true,evidence_references:["official-website-contact-search"],source_type:"company-controlled source",identity_method:"exact business phone",fit_rationale:"Completed research found no independently identified address candidate"};
    await expect(api.invoke("record_sab_address_corroboration",{...args,research_complete:false})).rejects.toThrow(/completed research/);
    const result=await api.invoke("record_sab_address_corroboration",args);
    expect(result).toMatchObject({action:"plan_auxiliary",address_corroboration:{status:"no_candidate"}});
    expect(await repo.getCompany()).toMatchObject({status:"in_progress",blocker:null});
    expect(repo.saveCompany.mock.calls.some(call=>call[3]?.corroborationRecorded===true)).toBe(true);
    expect(repo.saveCompany.mock.calls.at(-1)?.[3]).toEqual({corroborationAnalysisVerified:true});
    const scout={...plan,center:result.proposed_center,scan_role:"auxiliary",scan_type:"scout",grid_size:9,radius:6,estimated_credits:81};
    await expect(api.invoke("authorize_sab_scan_batch",{orchestrator_id:"owner",authorization_id:"11111111-1111-4111-8111-111111111111",authorization_reference:"scout",scans:[scout],matt_initial_approval:approved})).resolves.toMatchObject({scan_approved:true});
  });

  it.each(["incomplete","technical_failure"])("holds %s address evaluation without leaking the candidate and recovers only a technical writer failure",async(status)=>{
    const repo=repository(initialize());
    vi.mocked(getSabRankedCells).mockResolvedValue(report("cccccccccccc",plan,{businesses:[{place_id:"place",ranked_cells:[{row:1,column:4,latitude:35.05,longitude:-80,rank:5}]}]}) as never);
    const api=tools(repo);await api.invoke("analyze_sab_scan",{report_key:"cccccccccccc",place_id:"place",stage:"master"});
    const args={orchestrator_id:"owner",place_id:"place",report_key:"cccccccccccc",result:"candidate",candidate_address:"PRIVATE-CANDIDATE-DO-NOT-PERSIST",fit_decision:"accepted",research_complete:true,evidence_references:["verified-company-source"],source_type:"official source",identity_method:"exact phone",fit_rationale:"Evaluate complete distribution"};
    if(status==="technical_failure") vi.mocked(evaluateSabAddressCandidate).mockRejectedValueOnce(new Error("PRIVATE-CANDIDATE-DO-NOT-PERSIST provider timeout"));
    else vi.mocked(evaluateSabAddressCandidate).mockResolvedValueOnce({status:"incomplete",candidate_coordinates:{latitude:35,longitude:-80},geocoder:{location_type:"APPROXIMATE",partial_match:true},distances_miles:{weighted_centroid:1,nearest_ranked_cell:1,best_rank_cluster_centroid:1}} as never);
    const result=await api.invoke("record_sab_address_corroboration",args);
    expect(result).toMatchObject({action:"address_corroboration_incomplete",address_corroboration:{status}});
    expect(JSON.stringify(repo.saveCompany.mock.calls)+JSON.stringify(result)).not.toContain(args.candidate_address);
    const {candidate_address,fit_decision,...noCandidate}=args;
    if(status==="technical_failure") {
      await expect(api.invoke("record_sab_address_corroboration",{...noCandidate,result:"no_candidate"})).resolves.toMatchObject({
        action:"plan_auxiliary",address_corroboration:{status:"no_candidate"},paid_scans_submitted:0,
      });
      expect(await repo.getCompany()).toMatchObject({status:"in_progress",blocker:null});
      return;
    }
    await expect(api.invoke("record_sab_address_corroboration",{...noCandidate,result:"no_candidate"})).rejects.toThrow(/incomplete candidate/);
    const row=await repo.getCompany();
    row.decision_state={...row.decision_state,centering_status:"planned",proposed_center:"35,-80",evidence:{next_action:"plan_auxiliary"}};
    const blocked=repository(initialize(),row);
    await expect(tools(blocked).invoke("authorize_sab_scan_batch",{orchestrator_id:"owner",authorization_id:"11111111-1111-4111-8111-111111111111",authorization_reference:"bad-fallback",scans:[{...plan,scan_role:"auxiliary",scan_type:"scout",grid_size:9,radius:6,estimated_credits:81}],matt_initial_approval:approved,exception:{...approved,reason:"cannot bypass failure"}})).rejects.toThrow(/technical failure/);
  });

  it.each(["accepted","rejected","no_candidate"] as const)("recovers %s corroboration from an exactly verified legacy ranked-cell hash",async(status)=>{
    const master=report("cccccccccccc",plan,{businesses:[{place_id:"place",evidence_source:"competitor_roster",ranked_cell_count:1,imprecise_or_unranked_cell_count:48,ranked_cells:[{row:1,column:4,latitude:35.05,longitude:-80,rank:5}],all_point_rank_cells:Array.from({length:49},(_,index)=>({row:Math.floor(index/7)+1,column:index%7+1,latitude:35.05-Math.floor(index/7)*.01,longitude:-80+(index%7)*.01,rank:index===3?5:21}))}]});
    const legacyHash=legacyEvidenceHash(master),currentHash=currentEvidenceHash(master);
    expect(legacyHash).not.toBe(currentHash);
    const technicalFailure={source_report_key:master.report_key,evidence_hash:legacyHash,status:"technical_failure" as const,research_complete:true,evidence_references:["verified-company-source"],source_type:"official source",identity_method:"exact phone",fit_rationale:"Prior writer failure"};
    const repo=repository(initialize(),{status:"blocked",blocker:"address_corroboration_incomplete",decision_state:{source_report_key:master.report_key,evidence_hash:legacyHash,rule_id:"S01",centering_status:"failed",routine_recenter_count:0,evidence:{next_action:"address_corroboration_incomplete"},address_corroboration:technicalFailure}});
    vi.mocked(getSabRankedCells).mockResolvedValue(master as never);
    if(status!=="no_candidate") vi.mocked(evaluateSabAddressCandidate).mockResolvedValueOnce({status:"complete",candidate_coordinates:{latitude:35.02,longitude:-80},geocoder:{location_type:"ROOFTOP",partial_match:false},distances_miles:{weighted_centroid:1,nearest_ranked_cell:.5,best_rank_cluster_centroid:1}} as never);
    const common={orchestrator_id:"owner",place_id:"place",report_key:master.report_key,research_complete:true,evidence_references:["verified-company-source"],source_type:"official source",identity_method:"exact phone",fit_rationale:"Freshly verified recovery"};
    const input=status==="no_candidate"?{...common,result:"no_candidate"}:{...common,result:"candidate",candidate_address:"PRIVATE-CANDIDATE",fit_decision:status};
    const result=await tools(repo).invoke("record_sab_address_corroboration",input);
    expect(result.address_corroboration).toMatchObject({status,evidence_hash:currentHash});
    expect(await repo.getCompany()).toMatchObject({status:"in_progress",blocker:null,decision_state:{evidence_hash:currentHash,address_corroboration:{status,evidence_hash:currentHash}}});
  });

  it("recovers accepted corroboration from a verified legacy master hash without prior corroboration state",async()=>{
    const master=report("cccccccccccc",plan,{businesses:[{place_id:"place",evidence_source:"competitor_roster",ranked_cell_count:3,imprecise_or_unranked_cell_count:46,
      ranked_cells:[{row:3,column:3,latitude:35.03,longitude:-80.03,rank:7},{row:3,column:4,latitude:35.03,longitude:-80.02,rank:5},{row:4,column:4,latitude:35.02,longitude:-80.02,rank:6}],
      all_point_rank_cells:Array.from({length:49},(_,index)=>({row:Math.floor(index/7)+1,column:index%7+1,latitude:35.05-Math.floor(index/7)*.01,longitude:-80.05+(index%7)*.01,rank:[16,17,24].includes(index)?[7,5,6][[16,17,24].indexOf(index)]:21}))}]});
    const legacyHash=legacyEvidenceHash(master),currentHash=currentEvidenceHash(master);
    const repo=repository(initialize(),{status:"in_progress",blocker:"",decision_state:{source_report_key:master.report_key,evidence_hash:legacyHash,
      rule_id:"S01",centering_status:"failed",routine_recenter_count:0,evidence:{next_action:"address_corroboration_required"}}});
    vi.mocked(getSabRankedCells).mockResolvedValue(master as never);
    vi.mocked(evaluateSabAddressCandidate).mockResolvedValueOnce({status:"complete",candidate_coordinates:{latitude:35.02,longitude:-80.02},
      geocoder:{location_type:"ROOFTOP",partial_match:false},distances_miles:{weighted_centroid:1.36,nearest_ranked_cell:1.36,best_rank_cluster_centroid:1.36}} as never);
    const result=await tools(repo).invoke("record_sab_address_corroboration",{orchestrator_id:"owner",place_id:"place",report_key:master.report_key,
      result:"candidate",candidate_address:"PRIVATE-CANDIDATE",fit_decision:"accepted",research_complete:true,evidence_references:["verified-company-source"],
      source_type:"independent sources",identity_method:"exact current profile and owner activity",fit_rationale:"Complete non-phone identity and distribution fit"});
    expect(result).toMatchObject({action:"plan_deliverable",address_corroboration:{status:"accepted",evidence_hash:currentHash}});
    expect(await repo.getCompany()).toMatchObject({status:"in_progress",blocker:"",center_type:"corroborated_address",
      decision_state:{evidence_hash:currentHash,address_corroboration:{status:"accepted",evidence_hash:currentHash}}});
  });

  it("rejects an unverified corroboration hash mismatch without converting it to a technical failure",async()=>{
    const master=report("cccccccccccc",plan,{businesses:[{place_id:"place",evidence_source:"competitor_roster",ranked_cell_count:1,imprecise_or_unranked_cell_count:48,ranked_cells:[{row:1,column:4,latitude:35.05,longitude:-80,rank:5}],all_point_rank_cells:[{row:1,column:4,latitude:35.05,longitude:-80,rank:5}]}]});
    const mismatch="f".repeat(64),technicalFailure={source_report_key:master.report_key,evidence_hash:mismatch,status:"technical_failure" as const,research_complete:true,evidence_references:["verified-company-source"],source_type:"official source",identity_method:"exact phone",fit_rationale:"Prior writer failure"};
    const repo=repository(initialize(),{status:"blocked",blocker:"address_corroboration_incomplete",decision_state:{source_report_key:master.report_key,evidence_hash:mismatch,rule_id:"S01",centering_status:"failed",routine_recenter_count:0,evidence:{next_action:"address_corroboration_incomplete"},address_corroboration:technicalFailure}});
    vi.mocked(getSabRankedCells).mockResolvedValue(master as never);
    await expect(tools(repo).invoke("record_sab_address_corroboration",{orchestrator_id:"owner",place_id:"place",report_key:master.report_key,result:"no_candidate",research_complete:true,evidence_references:["verified-company-source"],source_type:"official source",identity_method:"exact phone",fit_rationale:"Freshly verified recovery"})).rejects.toThrow(/hash compatibility verification failed/);
    expect(repo.saveCompany).not.toHaveBeenCalled();
  });

  it("preserves the orchestrator complete-distribution fit judgment without adding strict distance gates",async()=>{
    for(const fits of [true,false]) {
      const repo=repository(initialize());
      vi.mocked(getSabRankedCells).mockResolvedValue(report("cccccccccccc",plan,{businesses:[{place_id:"place",ranked_cells:[{row:1,column:4,latitude:35.05,longitude:-80,rank:5}]}]}) as never);
      const api=tools(repo);await api.invoke("analyze_sab_scan",{report_key:"cccccccccccc",place_id:"place",stage:"master"});
      vi.mocked(evaluateSabAddressCandidate).mockResolvedValueOnce({status:"complete",candidate_coordinates:{latitude:35.02,longitude:-80},geocoder:{location_type:"ROOFTOP",partial_match:false},distances_miles:{weighted_centroid:fits?3.01:5,nearest_ranked_cell:0.1,best_rank_cluster_centroid:fits?2.9:6}} as never);
      const result=await api.invoke("record_sab_address_corroboration",{orchestrator_id:"owner",place_id:"place",report_key:"cccccccccccc",result:"candidate",candidate_address:"PRIVATE-CANDIDATE",fit_decision:fits?"accepted":"rejected",research_complete:true,evidence_references:["verified-company-source"],source_type:"official source",identity_method:"exact phone",fit_rationale:fits?"Complete distribution and shape agree with the approximate three-mile guidance":"An isolated pin agrees but the full distribution contradicts this candidate"});
      expect(result).toMatchObject({action:fits?"plan_deliverable":"plan_auxiliary",address_corroboration:{status:fits?"accepted":"rejected"}});
      if(fits) {
        expect(await repo.getCompany()).toMatchObject({center_type:"corroborated_address",scan_center:"35.02,-80"});
        await expect(api.invoke("authorize_sab_scan_batch",{orchestrator_id:"owner",authorization_id:"11111111-1111-4111-8111-111111111111",authorization_reference:"accepted-center",scans:[{...plan,center:result.proposed_center}],matt_initial_approval:approved})).resolves.toMatchObject({scan_approved:true});
      }
    }
  });

  it("server-rejects an accepted address that exceeds the established fit limit from every distribution reference",async()=>{
    const repo=repository(initialize());
    vi.mocked(getSabRankedCells).mockResolvedValue(report("cccccccccccc",plan,{businesses:[{place_id:"place",evidence_source:"competitor_roster",ranked_cell_count:1,imprecise_or_unranked_cell_count:48,ranked_cells:[{row:1,column:4,latitude:35.05,longitude:-80,rank:5}],all_point_rank_cells:[{row:1,column:4,latitude:35.05,longitude:-80,rank:5}]}]}) as never);
    const api=tools(repo);await api.invoke("analyze_sab_scan",{report_key:"cccccccccccc",place_id:"place",stage:"master"});
    vi.mocked(evaluateSabAddressCandidate).mockResolvedValueOnce({status:"complete",candidate_coordinates:{latitude:36,longitude:-79},geocoder:{location_type:"ROOFTOP",partial_match:false},distances_miles:{weighted_centroid:12,nearest_ranked_cell:11,best_rank_cluster_centroid:13}} as never);
    const result=await api.invoke("record_sab_address_corroboration",{orchestrator_id:"owner",place_id:"place",report_key:"cccccccccccc",result:"candidate",candidate_address:"PRIVATE-CANDIDATE",fit_decision:"accepted",research_complete:true,evidence_references:["verified-company-source"],source_type:"official source",identity_method:"exact phone",fit_rationale:"Proposed accepted fit"});
    expect(result).toMatchObject({action:"plan_auxiliary",address_corroboration:{status:"rejected"}});
    expect(result.address_corroboration.fit_rationale).toMatch(/every complete-distribution reference/);
  });

  it("recovers a zero-visibility wrong-center deliverable through the deterministic master-edge route",async()=>{
    const state=completeSabRunReports(submitted(),[key3]);
    const repo=repository(state,{center_type:"corroborated_address",scan_center:"35,-80",report_key:null,
      eligibility_state:{sab_confirmed:true,trade_match:true,franchise_excluded:true,crm_dedup_checked:true,contact_verified:true,evidence_references:["https://www.localfalcon.com/reports/view/cccccccccccc"],contact_research:verifiedContactResearch},
      decision_state:{source_report_key:key3,rule_id:"S05",evidence_hash:"b".repeat(64),centering_status:"failed",routine_recenter_count:0,evidence:{next_action:"evidence_review_required",exact_top20_count:0}}});
    const master={...report("cccccccccccc",plan),grid:{size:21,point_count:441,radius:12,measurement:"mi",center:{latitude:34,longitude:-81}},
      businesses:[{place_id:"place",evidence_source:"competitor_roster",ranked_cell_count:3,imprecise_or_unranked_cell_count:438,
        ranked_cells:[{row:10,column:1,latitude:34,longitude:-81.2,rank:10},{row:11,column:1,latitude:33.99,longitude:-81.2,rank:11},{row:11,column:2,latitude:33.99,longitude:-81.18,rank:12}],
        all_point_rank_cells:[{row:10,column:1,latitude:34,longitude:-81.2,rank:10},{row:11,column:1,latitude:33.99,longitude:-81.2,rank:11},{row:11,column:2,latitude:33.99,longitude:-81.18,rank:12}]}]};
    const failed=report(key3,plan,{arp:21,atrp:21,solv:0,found_in:0,businesses:[{place_id:"place",evidence_source:"competitor_roster",ranked_cell_count:0,imprecise_or_unranked_cell_count:49,ranked_cells:[],all_point_rank_cells:Array.from({length:49},(_,i)=>({row:Math.floor(i/7)+1,column:i%7+1,latitude:35,longitude:-80,rank:21}))}]});
    vi.mocked(getSabRankedCells).mockResolvedValueOnce(master as never).mockResolvedValueOnce(failed as never);
    const result=await tools(repo).invoke("analyze_sab_scan",{report_key:"cccccccccccc",place_id:"place",stage:"master"});
    expect(result).toMatchObject({action:"plan_auxiliary",center_source:"master_edge_offset"});
    const saved=(await repo.getCompany()).decision_state;
    expect(saved).toMatchObject({source_report_key:"cccccccccccc",centering_status:"planned",center_type:"master_edge_offset",evidence:{next_action:"plan_auxiliary",corroboration_correction:{status:"corrected_rejected",classification:"agent_error",invalidated_deliverable_report_key:key3}}});
    const nextPlan={...plan,scan_role:"auxiliary" as const,scan_type:"scout" as const,grid_size:9 as const,radius:6,estimated_credits:81,center:result.proposed_center};
    await expect(tools(repo).invoke("authorize_sab_scan_batch",{orchestrator_id:"owner",authorization_id:"22222222-2222-4222-8222-222222222222",authorization_reference:"recovered-route",scans:[nextPlan],matt_review:{...approved,reviewed_batch_id:state.batches[0].authorization_id}})).resolves.toMatchObject({scan_approved:true});
  });

  it("records completed no-candidate research and restores only a verified post-deliverable S01 master-centroid plan",async()=>{
    const state=completeSabRunReports(submitted(),[key3]);
    const failed=report(key3,plan,{arp:21,atrp:21,solv:0,found_in:0,
      businesses:[{place_id:"place",evidence_source:"competitor_roster",ranked_cell_count:0,imprecise_or_unranked_cell_count:49,ranked_cells:[],
        all_point_rank_cells:Array.from({length:49},(_,i)=>({row:Math.floor(i/7)+1,column:i%7+1,latitude:35,longitude:-80,rank:21}))}]});
    const master={...report("cccccccccccc",plan),grid:{size:21,point_count:441,radius:12,measurement:"mi",center:{latitude:35.1,longitude:-80.75}},
      businesses:[{place_id:"place",evidence_source:"competitor_roster",ranked_cell_count:1,imprecise_or_unranked_cell_count:440,
        ranked_cells:[{row:8,column:11,latitude:35.15,longitude:-80.75,rank:20}],
        all_point_rank_cells:[{row:8,column:11,latitude:35.15,longitude:-80.75,rank:20}]}]};
    const repo=repository(state,{report_key:key3,status:"blocked",blocker:"evidence_review_required",
      decision_state:{source_report_key:key3,rule_id:"S05",evidence_hash:currentEvidenceHash(failed),centering_status:"failed",routine_recenter_count:0,
        evidence:{next_action:"evidence_review_required",exact_top20_count:0}}});
    vi.mocked(getSabRankedCells).mockResolvedValueOnce(master as never).mockResolvedValueOnce(failed as never);
    const api=tools(repo),result=await api.invoke("record_sab_address_corroboration",{orchestrator_id:"owner",place_id:"place",report_key:"cccccccccccc",
      intervening_deliverable_report_key:key3,result:"no_candidate",research_complete:true,evidence_references:["completed-authorized-search"],
      source_type:"company-controlled and authorized public sources",identity_method:"exact name and exact verified business phone",fit_rationale:"Search exhausted; no valid candidate remains"});
    expect(result).toMatchObject({action:"plan_deliverable",center_source:"master_centroid",paid_scans_submitted:0,
      address_corroboration:{status:"no_candidate"},post_deliverable_s01_recovery:{status:"verified",intervening_deliverable_report_key:key3,
        deliverable_exact_top20_count:0,master_centroid_trustworthy:true,completed_corroboration:"no_candidate"}});
    expect(await repo.getCompany()).toMatchObject({status:"in_progress",blocker:null,report_key:key3,
      decision_state:{source_report_key:"cccccccccccc",centering_status:"planned",proposed_center:`${result.proposed_center.latitude},${result.proposed_center.longitude}`,center_type:"weighted_cell_centroid",
        address_corroboration:{status:"no_candidate"},evidence:{next_action:"plan_deliverable",post_deliverable_s01_recovery:{status:"verified"}}}});
    expect(repo.saveCompany.mock.calls.at(-1)?.[3]).toEqual({postDeliverableS01RecoveryVerified:true});
    const nextPlan={...plan,center:result.proposed_center};
    await expect(api.invoke("authorize_sab_scan_batch",{orchestrator_id:"owner",authorization_id:"33333333-3333-4333-8333-333333333333",
      authorization_reference:"verified-post-deliverable-s01",scans:[nextPlan],matt_review:{...approved,reviewed_batch_id:state.batches[0].authorization_id}}))
      .rejects.toThrow(/Explicit Matt approval/);
  });

  it("reuses an accepted corroborated candidate for one wide auxiliary after an exact zero-visibility deliverable",async()=>{
    const state=completeSabRunReports(submitted(),[key3]);
    const master={...report("cccccccccccc",plan),grid:{size:21,point_count:441,radius:12,measurement:"mi",center:{latitude:35.1,longitude:-80.75}},
      businesses:[{place_id:"place",evidence_source:"competitor_roster",ranked_cell_count:2,imprecise_or_unranked_cell_count:439,
        ranked_cells:[{row:10,column:11,latitude:35.01,longitude:-80.01,rank:18},{row:11,column:11,latitude:35,longitude:-80,rank:20}],
        all_point_rank_cells:[{row:10,column:11,latitude:35.01,longitude:-80.01,rank:18},{row:11,column:11,latitude:35,longitude:-80,rank:20}]}]};
    const failed=report(key3,plan,{arp:21,atrp:21,solv:0,found_in:0,
      businesses:[{place_id:"place",evidence_source:"competitor_roster",ranked_cell_count:0,imprecise_or_unranked_cell_count:49,ranked_cells:[],
        all_point_rank_cells:Array.from({length:49},(_,i)=>({row:Math.floor(i/7)+1,column:i%7+1,latitude:35,longitude:-80,rank:21}))}]});
    const masterHash=currentEvidenceHash(master as ReturnType<typeof report>),deliverableHash=currentEvidenceHash(failed as ReturnType<typeof report>);
    const accepted={source_report_key:"cccccccccccc",evidence_hash:masterHash,status:"accepted" as const,research_complete:true,
      evidence_references:["verified-company-source"],source_type:"company-controlled website",identity_method:"exact phone",
      fit_rationale:"Complete distribution fit accepted",candidate_coordinates:{latitude:35,longitude:-80},
      geocoder:{location_type:"ROOFTOP",partial_match:false},distances_miles:{weighted_centroid:1,nearest_ranked_cell:0,best_rank_cluster_centroid:1}};
    const repo=repository(state,{report_key:null,center_type:"corroborated_address",scan_center:"35,-80",status:"blocked",blocker:"evidence_review_required",
      decision_state:{source_report_key:key3,rule_id:"S05",evidence_hash:deliverableHash,centering_status:"failed",routine_recenter_count:0,
        address_corroboration:accepted,evidence:{next_action:"evidence_review_required",exact_top20_count:0}}});
    vi.mocked(getSabRankedCells).mockResolvedValueOnce(master as never).mockResolvedValueOnce(failed as never);
    const api=tools(repo),result=await api.invoke("record_sab_address_corroboration",{orchestrator_id:"owner",place_id:"place",report_key:"cccccccccccc",
      intervening_deliverable_report_key:key3,result:"candidate",fit_decision:"accepted",research_complete:true,
      evidence_references:accepted.evidence_references,source_type:accepted.source_type,identity_method:accepted.identity_method,fit_rationale:accepted.fit_rationale});
    expect(result).toMatchObject({action:"plan_auxiliary",center_source:"corroborated_address",proposed_center:{latitude:35,longitude:-80},paid_scans_submitted:0,
      address_corroboration:{status:"accepted"},post_deliverable_accepted_corroboration_recovery:{status:"verified",accepted_candidate_reused:true,deliverable_exact_top20_count:0}});
    expect(await repo.getCompany()).toMatchObject({status:"in_progress",blocker:null,decision_state:{source_report_key:"cccccccccccc",centering_status:"planned",
      center_type:"corroborated_address",proposed_center:"35,-80",address_corroboration:{status:"accepted"},evidence:{next_action:"plan_auxiliary"}}});
    const nextPlan={...plan,scan_role:"auxiliary" as const,scan_type:"scout" as const,grid_size:9 as const,radius:6,estimated_credits:81};
    await expect(api.invoke("authorize_sab_scan_batch",{orchestrator_id:"owner",authorization_id:"44444444-4444-4444-8444-444444444444",
      authorization_reference:"accepted-candidate-scout",scans:[nextPlan],matt_review:{...approved,reviewed_batch_id:state.batches[0].authorization_id}}))
      .resolves.toMatchObject({scan_approved:true});
  });

  it("fails closed when any post-deliverable S01 recovery invariant is missing",async()=>{
    const baseState=completeSabRunReports(submitted(),[key3]);
    const zero=report(key3,plan,{arp:21,atrp:21,solv:0,found_in:0,
      businesses:[{place_id:"place",evidence_source:"competitor_roster",ranked_cell_count:0,imprecise_or_unranked_cell_count:49,ranked_cells:[],
        all_point_rank_cells:Array.from({length:49},(_,i)=>({row:Math.floor(i/7)+1,column:i%7+1,latitude:35,longitude:-80,rank:21}))}]});
    const trustworthy={...report("cccccccccccc",plan),grid:{size:21,point_count:441,radius:12,measurement:"mi",center:{latitude:35.1,longitude:-80.75}},
      businesses:[{place_id:"place",evidence_source:"competitor_roster",ranked_cell_count:1,imprecise_or_unranked_cell_count:440,
        ranked_cells:[{row:8,column:11,latitude:35.15,longitude:-80.75,rank:20}],all_point_rank_cells:[{row:8,column:11,latitude:35.15,longitude:-80.75,rank:20}]}]};
    const cases=[
      {name:"nonzero visibility",master:trustworthy,deliverable:{...zero,businesses:[{...zero.businesses[0],ranked_cells:[{row:4,column:4,latitude:35,longitude:-80,rank:20}],all_point_rank_cells:[{row:4,column:4,latitude:35,longitude:-80,rank:20},...zero.businesses[0].all_point_rank_cells.slice(1)]}]},later:false,hash:"current"},
      {name:"untrustworthy master",master:{...trustworthy,businesses:[{...trustworthy.businesses[0],ranked_cells:[{row:1,column:11,latitude:35.3,longitude:-80.75,rank:20}],all_point_rank_cells:[{row:1,column:11,latitude:35.3,longitude:-80.75,rank:20}]}]},deliverable:zero,later:false,hash:"current"},
      {name:"later scan",master:trustworthy,deliverable:zero,later:true,hash:"current"},
      {name:"superseding evidence",master:trustworthy,deliverable:zero,later:false,hash:"mismatch"},
    ];
    for(const value of cases) {
      const state=structuredClone(baseState);
      if(value.later) state.batches[0].scans.push({...state.batches[0].scans[0],report_key:key5,idempotency_key:"later",completion_verified:true});
      const repo=repository(state,{report_key:key3,status:"blocked",decision_state:{source_report_key:key3,rule_id:"S05",
        evidence_hash:value.hash==="current"?currentEvidenceHash(value.deliverable as ReturnType<typeof report>):"f".repeat(64),centering_status:"failed",routine_recenter_count:0,
        evidence:{next_action:"evidence_review_required",exact_top20_count:0}}});
      vi.mocked(getSabRankedCells).mockResolvedValueOnce(value.master as never).mockResolvedValueOnce(value.deliverable as never);
      await expect(tools(repo).invoke("record_sab_address_corroboration",{orchestrator_id:"owner",place_id:"place",report_key:"cccccccccccc",
        intervening_deliverable_report_key:key3,result:"no_candidate",research_complete:true,evidence_references:["completed-authorized-search"],
        source_type:"verified sources",identity_method:"exact identity",fit_rationale:"No candidate"}),value.name).rejects.toThrow();
      expect(repo.saveCompany,value.name).not.toHaveBeenCalled();
      vi.mocked(getSabRankedCells).mockReset();
    }
  });

  it("rejects a temporary address copied into persisted corroboration descriptions",async()=>{
    const repo=repository(initialize());
    const args={orchestrator_id:"owner",place_id:"place",report_key:"cccccccccccc",result:"candidate",candidate_address:"PRIVATE-CANDIDATE",fit_decision:"accepted",research_complete:true,evidence_references:["verified-source"],source_type:"official source",identity_method:"exact phone",fit_rationale:"PRIVATE-CANDIDATE is the address"};
    await expect(tools(repo).invoke("record_sab_address_corroboration",args)).rejects.toThrow(/temporary hidden address/);
    expect(evaluateSabAddressCandidate).not.toHaveBeenCalled();expect(repo.saveCompany).not.toHaveBeenCalled();
  });

  it.each([5,6])("holds a qualifying %s-mile exclusion until exact evidence receives Matt approval",async(radius)=>{
    const scan:SabScanPlan=radius===5?{...plan,radius:5}:{...plan,scan_role:"auxiliary",scan_type:"scout",grid_size:9,radius:6,estimated_credits:81};
    const scanKey=radius===5?key5:key3;
    let repo:ReturnType<typeof repository>;
    if(radius===5) {
      const prior=repository();vi.mocked(getSabRankedCells).mockResolvedValue(report() as never);
      await tools(prior).invoke("review_sab_completed_batch",{});
      repo=repository(submitted(scan,key5,await prior.getRunState(),"22222222-2222-4222-8222-222222222222"),await prior.getCompany());
    } else repo=repository(submitted(scan));
    const cells=Array.from({length:scan.grid_size**2},(_,i)=>({row:Math.floor(i/scan.grid_size)+1,column:i%scan.grid_size+1,latitude:35+((scan.grid_size-1)/2-Math.floor(i/scan.grid_size))*.01,longitude:-80+((i%scan.grid_size)-(scan.grid_size-1)/2)*.01,rank:2}));
    vi.mocked(getSabRankedCells).mockResolvedValue(report(scanKey,scan,{arp:3,atrp:7,solv:75,businesses:[{place_id:"place",ranked_cells:cells}]}) as never);
    const api=tools(repo);
    const analyzed=await api.invoke("analyze_sab_scan",{report_key:scanKey,place_id:"place",stage:scan.scan_role});
    expect(analyzed.action).toBe("high_visibility_exclusion_pending_review");
    expect(await repo.getCompany()).toMatchObject({qualification_status:null,status:"blocked",decision_state:{exclusion_review:{status:"pending",report_key:scanKey}}});
    const args={orchestrator_id:"owner",place_id:"place",report_key:scanKey,evidence_hash:analyzed.evidence_hash,approval:approved};
    await expect(api.invoke("approve_sab_exclusion",args)).rejects.toThrow(/batch checkpoint/);
    const checkpoint=await api.invoke("review_sab_completed_batch",{});
    expect(checkpoint.exceptions).toHaveLength(1);
    expect(checkpoint.scan_results[0].result).toMatchObject({classification:"high_visibility_exclusion_pending_review",measured_values:{raw_arp:3,all_point_atrp:7,solv:75}});
    if(radius===5) {
      const held=await repo.getCompany();
      expect(held).toMatchObject({report_key:key3,scan_center:"35,-80",center_type:"weighted_cell_centroid",decision_state:{centering_status:"validated",proposed_center:"35,-80",center_type:"weighted_cell_centroid",evidence:{centering_evaluated:false,center_validation:{report_key:key3}}}});
      const writes=repo.saveScanResult.mock.calls.length;
      await expect(api.invoke("select_sab_canonical_report",{place_id:"place",three_mile_report_key:key3,five_mile_report_key:key5})).rejects.toThrow(/exclusion or evidence/);
      expect(repo.saveScanResult.mock.calls).toHaveLength(writes);
      await expect(buildSabRunManifest({getExportCandidates:async()=>[{...held,status:"complete"}],getRunCompletionRows:async()=>[{...held,status:"complete"}],getRunState:async()=>await repo.getRunState()} as never,{batch_id:"test",market:{city:"Test Market",state:"NC"},trade:"service",keyword:"service",export_date:"2026-08-31",scan_spec:{grid_size:"7x7",radius_miles:3}},"run")).rejects.toThrow(/completion gate|No eligible qualified/);
    }
    await expect(api.invoke("approve_sab_exclusion",{...args,evidence_hash:"f".repeat(64)})).rejects.toThrow(/evidence hash/);
    await expect(api.invoke("approve_sab_exclusion",{...args,orchestrator_id:"worker"})).rejects.toThrow(/orchestrator/);
    await expect(api.invoke("approve_sab_exclusion",{...args,approval:{approved_by:"Worker",approval_reference:"not Matt"}})).rejects.toThrow();
    expect(await api.invoke("approve_sab_exclusion",args)).toMatchObject({exclusion_finalized:true,paid_scans_submitted:0,continue_unaffected_work:true});
    expect(await repo.getCompany()).toMatchObject({qualification_status:"disqualified",status:"complete",qualification_reason:"existing_visibility_too_strong",decision_state:{exclusion_review:{status:"approved",approved_by:"Matt"}}});
    expect(repo.saveCompany.mock.calls.at(-1)?.[3]).toEqual({exclusionReviewApproved:true});
    expect((await repo.getRunState()).batches.at(-1)?.status).toBe("completed");
    const writes=repo.saveCompany.mock.calls.length;
    await expect(api.invoke("approve_sab_exclusion",args)).resolves.toMatchObject({already_approved:true});
    expect(repo.saveCompany.mock.calls).toHaveLength(writes);
  });

  it.each([5,6])("declines an exact %s-mile exclusion proposal and resumes only its deterministic path",async(radius)=>{
    const scan:SabScanPlan=radius===5?{...plan,radius:5}:{...plan,scan_role:"auxiliary",scan_type:"scout",grid_size:9,radius:6,estimated_credits:81};
    const scanKey=radius===5?key5:key3;
    let repo:ReturnType<typeof repository>;
    if(radius===5) {
      const prior=repository();vi.mocked(getSabRankedCells).mockResolvedValue(report() as never);
      await tools(prior).invoke("review_sab_completed_batch",{});
      repo=repository(submitted(scan,key5,await prior.getRunState(),"22222222-2222-4222-8222-222222222222"),await prior.getCompany());
    } else repo=repository(submitted(scan));
    const cells=Array.from({length:scan.grid_size**2},(_,i)=>({row:Math.floor(i/scan.grid_size)+1,column:i%scan.grid_size+1,latitude:35+((scan.grid_size-1)/2-Math.floor(i/scan.grid_size))*.01,longitude:-80+((i%scan.grid_size)-(scan.grid_size-1)/2)*.01,rank:2}));
    const scanned=report(scanKey,scan,{arp:3,atrp:7,solv:75,businesses:[{place_id:"place",ranked_cells:cells}]});
    vi.mocked(getSabRankedCells).mockResolvedValue(scanned as never);
    const api=tools(repo),checkpoint=await api.invoke("review_sab_completed_batch",{}),evidenceHash=checkpoint.scan_results[0]&&((await repo.getCompany()).decision_state.evidence_hash);
    const declined=await api.invoke("decline_sab_exclusion",{orchestrator_id:"owner",place_id:"place",report_key:scanKey,evidence_hash:evidenceHash,decision:approved});
    expect(declined).toMatchObject({exclusion_declined:true,paid_scans_submitted:0,continue_unaffected_work:true,resumed_action:radius===5?"comparison_ready":"plan_deliverable"});
    const row=await repo.getCompany();
    expect(row).toMatchObject({qualification_status:null,status:"in_progress",blocker:null,decision_state:{exclusion_review:{status:"declined",declined_by:"Matt"},centering_status:radius===5?"validated":"planned",evidence:{next_action:radius===5?"comparison_ready":"plan_deliverable"}}});
    expect(repo.saveCompany.mock.calls.at(-1)?.[3]).toEqual({exclusionReviewDeclined:true});
    if(radius===5) {
      expect(row).toMatchObject({report_key:key3,scan_center:"35,-80",decision_state:{proposed_center:"35,-80",evidence:{center_validation:{report_key:key3},centering_evaluated:false}}});
      vi.mocked(getSabRankedCells).mockImplementation(async key=>(key===key3?report():scanned) as never);
      await expect(api.invoke("select_sab_canonical_report",{place_id:"place",three_mile_report_key:key3,five_mile_report_key:key5})).resolves.toMatchObject({canonical_persisted:true});
      expect(repo.saveCompany.mock.calls.at(-1)?.[3]).toEqual({exclusionDecisionContinued:true});
      expect((await repo.getCompany()).decision_state.evidence.exclusion_decision_history).toContainEqual(expect.objectContaining({status:"declined",report_key:key5}));
    }
  });

});

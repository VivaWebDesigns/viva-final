import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeAndRecordSabReport, registerSabOrchestrationTools } from "../../server/features/sab-mcp/orchestration";
import { getSabRankedCells } from "../../server/features/sab-mcp/localFalconRankedCells";
import { reverseGeocodeSabCenters } from "../../server/features/sab-mcp/reverseGeocode";
import { authorizeSabScanBatch, claimSabRunScan, completeSabRunReports, createSabRunState, recordSabRunSubmission, type SabRunState, type SabScanPlan } from "../../server/features/sab-mcp/runState";
import { z } from "zod";

vi.mock("../../server/features/sab-mcp/localFalconRankedCells", () => ({getSabRankedCells: vi.fn()}));
vi.mock("../../server/features/sab-mcp/reverseGeocode", () => ({reverseGeocodeSabCenters: vi.fn()}));
const approved = {approved_by: "Matt" as const, approval_reference: "explicit-plan-approval"};
const plan: SabScanPlan = {
  place_id: "place", scan_role: "deliverable", scan_type: "standard", center: {latitude:35,longitude:-80},
  grid_size:7,radius:3,measurement:"mi",keyword:"service",platform:"google",estimated_credits:49,save_location_required:false,
};
const key3="aaaaaaaaaaaa",key5="bbbbbbbbbbbb";
function initialize() {
  return createSabRunState({run_id:"run",orchestrator_id:"owner",authorization_reference:"run-approval",credit_limit:500});
}
function submitted(scan=plan,key=key3,state=initialize(),authorizationId="11111111-1111-4111-8111-111111111111") {
  const previous=state.batches.at(-1);
  const next=authorizeSabScanBatch(state,{authorization_id:authorizationId,orchestrator_id:"owner",authorization_reference:"plan",scans:[scan],
    matt_initial_approval:approved,...(previous?{matt_review:{...approved,reviewed_batch_id:previous.authorization_id}}:{})});
  return recordSabRunSubmission(claimSabRunScan(next,authorizationId,scan,`${key}-idempotency`),`${key}-idempotency`,{submission_status:"submitted",report_key:key});
}
function report(key=key3,scan=plan,overrides:Record<string,unknown>={}) {
  return {
    report_key:key,public_url:`https://example.test/public/${key}`,completion_status:"complete",completion_verified:true,report_subject_place_id:scan.place_id,
    keyword:scan.keyword,platform:scan.platform,scan_date:"2026-08-31",arp:5,atrp:19,solv:10,found_in:1,
    missing_place_id_count:0,found_place_id_count:1,grid:{size:scan.grid_size,point_count:scan.grid_size**2,radius:scan.radius,measurement:scan.measurement,center:scan.center},
    businesses:[{place_id:scan.place_id,ranked_cells:[{row:4,column:4,latitude:35,longitude:-80,rank:5}]}],...overrides,
  };
}
function repository(state=submitted(),overrides:Record<string,unknown>={}) {
  let storedState=structuredClone(state);
  let row:Record<string,any>={company:"Test lead",place_id:"place",workflow:"scale_first_v2",address:"Service Area Business",qualification_status:"qualified",rating:4.8,review_count:1,
    email:"verified@example.test",phone:null,contact_tag:"Email Ready",outcome:null,report_key:null,scan_center:"35,-80",center_type:"weighted_cell_centroid",
    eligibility_state:{sab_confirmed:true,trade_match:true,franchise_excluded:true,crm_dedup_checked:true,contact_verified:true,evidence_references:["verified-evidence"]},
    decision_state:{source_report_key:"cccccccccccc",evidence_hash:"a".repeat(64),rule_id:"S01",centering_status:"planned",proposed_center:"35,-80",center_type:"weighted_cell_centroid",routine_recenter_count:0,evidence:{next_action:"plan_deliverable",grid:{radius:3}}},...overrides};
  return {
    assertOneActiveRun:vi.fn(async()=>{}),
    getRunState:vi.fn(async()=>structuredClone(storedState)),
    getCompany:vi.fn(async()=>structuredClone(row)),
    saveRunState:vi.fn(async(next:SabRunState,version:number)=>{expect(version).toBe(storedState.version);storedState=structuredClone(next);}),
    saveCompany:vi.fn(async(_place:string,updates:Record<string,unknown>,_actor?:string,_options?:{exclusionReviewApproved?:boolean})=>{row={...row,...structuredClone(updates)};return {writes_performed:true};}),
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
    const value=await handlers[name].handler(z.object(handlers[name].schema).parse({workflow_sheet:"sheet",sheet_name:"SAB Workflow",run_id:"run",...args}));
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

  it("derives recenter counts and approved testing scope from the run, never caller flags",async()=>{
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

  it("reuses one provider read, persists the decision, verifies readback and then pauses for Matt",async()=>{
    const repo=repository();vi.mocked(getSabRankedCells).mockResolvedValue(report() as never);
    const result=await tools(repo).invoke("review_sab_completed_batch",{});
    expect(getSabRankedCells).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({testing_mode:true,stop_before_further_scans:true,matt_review_required:true});
    expect(result.table[0]).toMatchObject({company:"Test lead",result:{classification:"center_validated",measured_values:{exact_top20_count:1,point_count:49,raw_arp:5,all_point_atrp:19,solv:10}},sop_rule:"S05, S09"});
    expect((await repo.getRunState()).batches[0].status).toBe("awaiting_review");
    expect(repo.saveCompany.mock.invocationCallOrder[0]).toBeLessThan(repo.saveRunState.mock.invocationCallOrder[0]);
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
    await expect(tools(repo).invoke("authorize_sab_scan_batch",args)).rejects.toThrow(/next action/);
    expect(repo.saveRunState).not.toHaveBeenCalled();
    const missing=repository(initialize(),{eligibility_state:{sab_confirmed:true}});
    await expect(tools(missing).invoke("authorize_sab_scan_batch",{...args,scans:[plan]})).rejects.toThrow(/Structured SAB/);
    const valid=repository(initialize());
    await expect(tools(valid).invoke("authorize_sab_scan_batch",{...args,scans:[plan]})).resolves.toMatchObject({scan_approved:true,paid_scans_submitted:0});
  });

  it("allows only the exact structured routine fine specification and retains OAuth metadata",async()=>{
    const row=repository(initialize());
    const initial=await row.getCompany();
    const repo=repository(initialize(),{decision_state:{...initial.decision_state,evidence:{next_action:"plan_auxiliary",auxiliary_scan_spec:{scan_type:"fine",grid_size:7,radius:1.5,measurement:"mi"}}}});
    const fine={...plan,scan_role:"auxiliary",scan_type:"fine",radius:1.5};
    const args={orchestrator_id:"owner",authorization_id:"22222222-2222-4222-8222-222222222222",authorization_reference:"plan",scans:[fine],matt_initial_approval:approved};
    await expect(tools(repo).invoke("authorize_sab_scan_batch",args)).resolves.toMatchObject({scan_approved:true});
    const wrong=repository(initialize(),{decision_state:{...initial.decision_state,evidence:{next_action:"plan_auxiliary"}}});
    await expect(tools(wrong).invoke("authorize_sab_scan_batch",args)).rejects.toThrow(/next action/);
    const registration=vi.fn();
    registerSabOrchestrationTools({registerTool:registration} as never,(()=>repo) as never,"actor");
    expect(registration.mock.calls[0][1]).toMatchObject({securitySchemes:[{type:"oauth2",scopes:["sab:read","sab:write"]}],_meta:{securitySchemes:[{type:"oauth2"}]}});
  });

  it("rejects a Needs Email paid plan that still carries an email and checks one-run-per-sheet on initialization",async()=>{
    const invalid=repository(initialize(),{contact_tag:"Needs Email",email:"existing@example.test",phone:"5555550100"});
    await expect(tools(invalid).invoke("authorize_sab_scan_batch",{orchestrator_id:"owner",authorization_id:"22222222-2222-4222-8222-222222222222",authorization_reference:"plan",scans:[plan],matt_initial_approval:approved})).rejects.toThrow(/contact tag/);
    const repo=repository();
    repo.getRunState.mockResolvedValue(null as never);
    repo.assertOneActiveRun.mockRejectedValue(new Error("Another run already exists"));
    await expect(tools(repo).invoke("initialize_sab_run",{orchestrator_id:"owner",authorization_reference:"run",credit_limit:500})).rejects.toThrow(/Another run/);
    expect(repo.saveRunState).not.toHaveBeenCalled();
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
    const repo=repository(state,{report_key:key3,decision_state:{source_report_key:key5,evidence_hash:"a".repeat(64),rule_id:"S05",centering_status:"validated",proposed_center:"35,-80",center_type:"weighted_cell_centroid",routine_recenter_count:0,evidence:{next_action:"center_validated"}}});
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
  it("does not promote testing definitions to permanent policy through caller flags",async()=>{
    const state=submitted();state.testing_mode=false;
    const repo=repository(state);
    const cells=Array.from({length:49},(_,i)=>({row:Math.floor(i/7)+1,column:i%7+1,latitude:35+(3-Math.floor(i/7))*.01,longitude:-80+((i%7)-3)*.01,rank:2}));
    vi.mocked(getSabRankedCells).mockResolvedValue(report(key3,plan,{businesses:[{place_id:"place",ranked_cells:cells}]}) as never);
    const result=await analyzeAndRecordSabReport(repo as never,{run_id:"run",report_key:key3,place_id:"place",stage:"deliverable",testingPolicyActive:true} as never,"actor");
    expect(result.action).toBe("policy_review_required");
    expect(repo.saveScanResult.mock.calls[0][3]).toEqual({historyOnly:true});
  });

  it("shows 45/49 saturation and all-point medians in the checkpoint, keeping ARP and ATRP distinct",async()=>{
    const repo=repository();
    const all=Array.from({length:49},(_,i)=>({row:Math.floor(i/7)+1,column:i%7+1,latitude:35+(3-Math.floor(i/7))*.01,longitude:-80+((i%7)-3)*.01,rank:i<4?21:2}));
    vi.mocked(getSabRankedCells).mockResolvedValue(report(key3,plan,{arp:2,atrp:3.55,solv:80,businesses:[{place_id:"place",ranked_cells:all.filter(c=>c.rank<=20),all_point_rank_cells:all}]}) as never);
    const result=await tools(repo).invoke("review_sab_completed_batch",{});
    expect(result.table[0]).toMatchObject({report_url:`https://example.test/public/${key3}`,scan_specification:"7×7/3 mi",
      result:{classification:"same_center_five_mile_comparison",measured_values:{exact_top20_count:45,point_count:49,raw_arp:2,all_point_atrp:3.55,solv:80}}});
    expect(result.table[0].result.measured_values.saturation).toMatchObject({all_point_median:2,outer_median:2,central_median:2});
    expect(result.stop_before_further_scans).toBe(true);
    await expect(tools(repo).invoke("authorize_sab_scan_batch",{orchestrator_id:"owner",authorization_id:"22222222-2222-4222-8222-222222222222",authorization_reference:"next",scans:[{...plan,radius:5}]})).rejects.toThrow(/Matt approval/);
  });

  it.each([5,6])("holds a qualifying %s-mile exclusion until exact evidence receives Matt approval",async(radius)=>{
    const scan:SabScanPlan=radius===5?{...plan,radius:5}:{...plan,scan_role:"auxiliary",scan_type:"scout",grid_size:9,radius:6,estimated_credits:81};
    const repo=repository(submitted(scan));
    const cells=Array.from({length:scan.grid_size**2},(_,i)=>({row:Math.floor(i/scan.grid_size)+1,column:i%scan.grid_size+1,latitude:35+((scan.grid_size-1)/2-Math.floor(i/scan.grid_size))*.01,longitude:-80+((i%scan.grid_size)-(scan.grid_size-1)/2)*.01,rank:2}));
    vi.mocked(getSabRankedCells).mockResolvedValue(report(key3,scan,{arp:3,atrp:7,solv:75,businesses:[{place_id:"place",ranked_cells:cells}]}) as never);
    const api=tools(repo);
    const analyzed=await api.invoke("analyze_sab_scan",{report_key:key3,place_id:"place",stage:scan.scan_role});
    expect(analyzed.action).toBe("high_visibility_exclusion_pending_review");
    expect(await repo.getCompany()).toMatchObject({qualification_status:"qualified",status:"blocked",decision_state:{exclusion_review:{status:"pending",report_key:key3}}});
    const args={orchestrator_id:"owner",place_id:"place",report_key:key3,evidence_hash:analyzed.evidence_hash,approval:approved};
    await expect(api.invoke("approve_sab_exclusion",args)).rejects.toThrow(/batch checkpoint/);
    const checkpoint=await api.invoke("review_sab_completed_batch",{});
    expect(checkpoint.exclusion_approval_required).toBe(true);
    expect(checkpoint.table[0].result).toMatchObject({classification:"high_visibility_exclusion_pending_review",measured_values:{raw_arp:3,all_point_atrp:7,solv:75}});
    await expect(api.invoke("approve_sab_exclusion",{...args,evidence_hash:"f".repeat(64)})).rejects.toThrow(/evidence hash/);
    await expect(api.invoke("approve_sab_exclusion",{...args,orchestrator_id:"worker"})).rejects.toThrow(/orchestrator/);
    await expect(api.invoke("approve_sab_exclusion",{...args,approval:{approved_by:"Worker",approval_reference:"not Matt"}})).rejects.toThrow();
    expect(await api.invoke("approve_sab_exclusion",args)).toMatchObject({exclusion_finalized:true,paid_scans_submitted:0,next_batch_still_requires_approval:true});
    expect(await repo.getCompany()).toMatchObject({qualification_status:"disqualified",status:"complete",qualification_reason:"existing_visibility_too_strong",decision_state:{exclusion_review:{status:"approved",approved_by:"Matt"}}});
    expect(repo.saveCompany.mock.calls.at(-1)?.[3]).toEqual({exclusionReviewApproved:true});
    expect((await repo.getRunState()).batches[0].status).toBe("awaiting_review");
    const writes=repo.saveCompany.mock.calls.length;
    await expect(api.invoke("approve_sab_exclusion",args)).resolves.toMatchObject({already_approved:true});
    expect(repo.saveCompany.mock.calls).toHaveLength(writes);
  });

});

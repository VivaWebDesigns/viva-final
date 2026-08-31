import { describe, expect, it, vi } from "vitest";
import { SAB_HEADERS, sabDecisionStateSchema, type SabCompanyUpdates } from "../../server/features/sab-mcp/schema";
import { SabSheetsRepository } from "../../server/features/sab-mcp/sheets";

const reportKey="aaaaaaaaaaaa",hash="a".repeat(64);
const pending={source_report_key:reportKey,evidence_hash:hash,rule_id:"S02",centering_status:"failed" as const,routine_recenter_count:0,
  exclusion_review:{status:"pending" as const,report_key:reportKey,evidence_hash:hash},evidence:{next_action:"high_visibility_exclusion_pending_review"}};
const approved={...pending,outcome:"existing_visibility_too_strong" as const,
  exclusion_review:{...pending.exclusion_review,status:"approved" as const,approved_by:"Matt" as const,approval_reference:"explicit-checkpoint-review"},evidence:{next_action:"high_visibility_excluded"}};
const finalUpdate={decision_state:approved,qualification_status:"disqualified" as const,qualification_reason:"existing_visibility_too_strong",status:"complete" as const};
const declined={...pending,centering_status:"planned" as const,proposed_center:"35,-80",center_type:"ranked_peak_recentered" as const,
  exclusion_review:{...pending.exclusion_review,status:"declined" as const,declined_by:"Matt" as const,decline_reference:"explicit-checkpoint-decline"},evidence:{next_action:"plan_deliverable"}};
function fixture(overrides:Record<string,string>={}) {
  const values=[Array.from(SAB_HEADERS),SAB_HEADERS.map(header=>({
    place_id:"test-place",company:"Test lead",workflow:"scale_first_v2",status:"blocked",qualification_status:"",decision_state:JSON.stringify(pending),
    ...overrides,
  } as Record<string,string>)[header]??"")];
  const client={getValues:vi.fn(async()=>values.map(row=>[...row])),updateValues:vi.fn(async(_sheet:string,updates:Array<{range:string;value:unknown}>)=>{
    for(const update of updates) {
      const match=update.range.match(/!([A-Z]+)(\d+)$/)!;
      const column=[...match[1]].reduce((value,char)=>value*26+char.charCodeAt(0)-64,0)-1;
      values[Number(match[2])-1][column]=String(update.value);
    }
  })};
  return {repo:new SabSheetsRepository(client as never,"sheet","SAB Workflow"),client};
}

describe("Matt checkpoint exclusion approval",()=>{
  it("requires an explicit Matt reference bound to the enclosing report and evidence",()=>{
    expect(sabDecisionStateSchema.safeParse(pending).success).toBe(true);
    expect(sabDecisionStateSchema.safeParse(approved).success).toBe(true);
    for(const review of [
      {...approved.exclusion_review,approval_reference:""},
      {...approved.exclusion_review,approved_by:undefined},
      {...approved.exclusion_review,approved_by:"worker"},
      {...approved.exclusion_review,report_key:"bbbbbbbbbbbb"},
      {...approved.exclusion_review,evidence_hash:"b".repeat(64)},
    ]) expect(sabDecisionStateSchema.safeParse({...approved,exclusion_review:review}).success).toBe(false);
    expect(sabDecisionStateSchema.safeParse({...pending,exclusion_review:undefined}).success).toBe(false);
    expect(sabDecisionStateSchema.safeParse({...pending,exclusion_review:{...pending.exclusion_review,approval_reference:"not yet approved"}}).success).toBe(false);
  });

  it("blocks generic approval, clearing evidence, alternate reasons, completion and releasing the hold",async()=>{
    const bypasses=[
      finalUpdate,
      {decision_state:null},
      {decision_state:{...pending,evidence:{next_action:"center_validated"},exclusion_review:undefined}},
      {status:"complete"},
      {status:"in_progress"},
      {qualification_status:"disqualified",qualification_reason:"another reason",status:"complete"},
      {qualification_status:"deferred",qualification_reason:"other"},
      {outcome:"no_visibility_core_found"},
    ];
    for(const updates of bypasses) {
      const {repo,client}=fixture();
      await expect(repo.saveCompany("test-place",updates as SabCompanyUpdates,"actor")).rejects.toThrow(/review|exclusion|decision/);
      expect(client.updateValues).not.toHaveBeenCalled();
    }
  });

  it("permits supporting contact/history writes without changing the pending decision or disposition",async()=>{
    const {repo}=fixture();
    await repo.saveCompany("test-place",{phone:"5555550100",research_notes:"Supporting contact verification only"},"actor");
    const row=await repo.getCompany("test-place");
    expect(row).toMatchObject({phone:"5555550100",status:"blocked",qualification_status:"",decision_state:pending});
  });

  it("rejects stale or mismatched explicit approval even with the privileged transition option",async()=>{
    for(const decision of [
      {...approved,source_report_key:"bbbbbbbbbbbb",exclusion_review:{...approved.exclusion_review,report_key:"bbbbbbbbbbbb"}},
      {...approved,evidence_hash:"b".repeat(64),exclusion_review:{...approved.exclusion_review,evidence_hash:"b".repeat(64)}},
      {...approved,exclusion_review:{...approved.exclusion_review,approval_reference:""}},
    ]) {
      const {repo,client}=fixture();
      await expect(repo.saveCompany("test-place",{...finalUpdate,decision_state:decision},"actor",{exclusionReviewApproved:true})).rejects.toThrow(/existing pending report/);
      expect(client.updateValues).not.toHaveBeenCalled();
    }
  });

  it("finalizes only the exact pending exclusion through the explicit approval transition",async()=>{
    const {repo}=fixture();
    await repo.saveCompany("test-place",finalUpdate,"actor",{exclusionReviewApproved:true});
    expect(await repo.getCompany("test-place")).toMatchObject({...finalUpdate});
    await repo.saveCompany("test-place",{phone:"5555550100"},"actor");
    await expect(repo.saveCompany("test-place",{decision_state:pending},"actor")).rejects.toThrow(/approved exclusion|pending high-visibility/);
    await expect(repo.saveCompany("test-place",{decision_state:{...approved,exclusion_review:{...approved.exclusion_review,approval_reference:"rewritten"}}},"actor")).rejects.toThrow(/explicit Matt/);
  });

  it("resumes only the exact pending evidence through the explicit decline transition",async()=>{
    expect(sabDecisionStateSchema.safeParse(declined).success).toBe(true);
    const {repo}=fixture();
    await repo.saveCompany("test-place",{decision_state:declined,status:"in_progress",blocker:null},"actor",{exclusionReviewDeclined:true});
    expect(await repo.getCompany("test-place")).toMatchObject({status:"in_progress",qualification_status:"",decision_state:declined});
    await expect(repo.saveCompany("test-place",{decision_state:{...declined,exclusion_review:{...declined.exclusion_review,decline_reference:"rewritten"}}},"actor")).rejects.toThrow(/explicit Matt|decided exclusion/);
    const continued={...declined,source_report_key:"bbbbbbbbbbbb",evidence_hash:"b".repeat(64),exclusion_review:undefined,
      evidence:{next_action:"center_validated",exclusion_decision_history:[declined.exclusion_review]}};
    await repo.saveCompany("test-place",{decision_state:continued},"actor",{exclusionDecisionContinued:true});
    expect((await repo.getCompany("test-place")).decision_state.evidence.exclusion_decision_history).toEqual([declined.exclusion_review]);
    const stale=fixture();
    await expect(stale.repo.saveCompany("test-place",{decision_state:{...declined,evidence_hash:"b".repeat(64),exclusion_review:{...declined.exclusion_review,evidence_hash:"b".repeat(64)}},status:"in_progress",blocker:null},"actor",{exclusionReviewDeclined:true})).rejects.toThrow(/matching pending|explicit exclusion decline/i);
  });

  it("prevents new final high-visibility disqualification without a checkpoint even without a prior pending state",async()=>{
    const {repo,client}=fixture({status:"in_progress",decision_state:""});
    await expect(repo.saveCompany("test-place",{qualification_status:"disqualified",qualification_reason:"existing_visibility_too_strong",status:"complete"},"actor")).rejects.toThrow(/explicit approval/);
    expect(client.updateValues).not.toHaveBeenCalled();
  });

  it.each(["complete","qa_ready"])("excludes hand-edited qualified %s pending rows from export",async(status)=>{
    const {repo}=fixture({status,qualification_status:"qualified"});
    expect(await repo.getExportCandidates()).toEqual([]);
    const malformed=fixture({status,qualification_status:"qualified",decision_state:JSON.stringify({evidence:{next_action:"high_visibility_exclusion_pending_review"}})});
    expect(await malformed.repo.getExportCandidates()).toEqual([]);
  });
});

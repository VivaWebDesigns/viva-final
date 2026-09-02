import { describe, expect, it } from "vitest";
import { auditSabContactRows, projectSabCompany } from "../../server/features/sab-mcp/usageOptimization";
import { createSabRunState } from "../../server/features/sab-mcp/runState";

const research={evidence_version:2 as const,exact_name_search:{status:"completed" as const,sources_inspected:["google"]},
  exact_phone_fallback:{status:"not_required_verified_earlier" as const,sources_inspected:[]},company_controlled_inspection:{status:"not_required_verified_earlier" as const,sources_inspected:[]},
  accepted_evidence:[{email:"owner@example.com",verification_gate:"verified domain",sources:["https://example.com/contact"],source_type:"company website",company_identity_match:true as const,corroborating_phone:null,inspected_at:"2026-09-01T20:00:00.000Z"}],
  rejected_candidates:[],result:"verified_email" as const,completed_at:"2026-09-01T20:00:00.000Z",exhaustion_completed_at:null,no_unverified_email_retained:true as const,orchestrator_reconciled:true as const};
const row={place_id:"place",company:"Example",batch_id:"B01",status:"qa_ready",qualification_status:"qualified",qualification_reason:"deliverable",blocker:null,outcome:"deliverable",
  updated_at:"2026-09-01",email:"owner@example.com",phone:"7045551212",contact_tag:"Email Ready",website:"https://example.com",research_notes:"very long history",scan_history:[{large:"payload"}],
  eligibility_state:{sab_confirmed:true,trade_match:true,franchise_excluded:true,crm_dedup_checked:true,contact_verified:true,evidence_references:["receipt"],contact_research:research},
  decision_state:{source_report_key:"report",evidence_hash:"a".repeat(64),rule_id:"S05",centering_status:"validated",proposed_center:"35,-80",center_type:"weighted_cell_centroid",outcome:"deliverable",evidence:{next_action:"center_validated",huge:{payload:true}}}};

describe("SAB usage-optimized views",()=>{
  it("omits histories and large evidence from compact stage reads",()=>{
    const compact=projectSabCompany(row,"scan") as Record<string,unknown>;
    expect(compact).not.toHaveProperty("research_notes");expect(compact).not.toHaveProperty("scan_history");
    expect(compact.decision_state).toMatchObject({source_report_key:"report",next_action:"center_validated"});
    expect(JSON.stringify(compact)).not.toContain("huge");
  });

  it("returns aggregate contact counts and only conflicting rows",()=>{
    const state=createSabRunState({run_id:"run",orchestrator_id:"owner",authorization_reference:"run",credit_limit:100});
    const bad={...row,place_id:"bad",company:"Bad",email:"other@example.com"};
    expect(auditSabContactRows([row,bad],state)).toMatchObject({counts:{total:2,email_ready:2,valid:1,exceptions:1},
      exceptions:[{place_id:"bad",issues:["verified_email_evidence_mismatch"]}],full_histories_returned:false});
  });
});

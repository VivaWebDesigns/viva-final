import { describe, expect, it } from "vitest";
import { validateSabContactResearchV3 } from "../../server/features/sab-mcp/contactResearch";

const search=(query:string)=>({status:"completed" as const,query,rendered_results_inspected:true,ai_overview_status:"absent" as const,
  first_page_snippets_inspected:true,result_source_urls:["https://acme.test/contact"],surfaced_official_website_urls:["https://acme.test"],
  surfaced_controlled_profile_urls:[],inspected_at:"2026-09-02T20:00:00.000Z"});
const stopped=()=>({status:"not_required_verified_earlier" as const,query:null,rendered_results_inspected:false,ai_overview_status:null,
  first_page_snippets_inspected:false,result_source_urls:[],surfaced_official_website_urls:[],surfaced_controlled_profile_urls:[],inspected_at:null});
const website=()=>({status:"inspected" as const,website_url:"https://acme.test",pages_inspected:["https://acme.test/contact"],result:"email_found" as const,
  company_identity_match:true,phone_match:"matched" as const,material_to_contact_resolution:true,inspected_at:"2026-09-02T20:00:03.000Z"});
const verified=()=>({evidence_version:3 as const,exact_name_search:search("Acme Landscapes LLC email"),exact_phone_fallback:stopped(),official_website_inspection:website(),
  controlled_profile_inspections:[],independent_source_inspections:[],accepted_evidence:[{email:"hello@acme.test",verification_gate:"official_website_domain" as const,
    sources:["https://acme.test/contact"],source_type:"official website",company_identity_match:true as const,corroborating_phone:null,inspected_at:"2026-09-02T20:00:03.000Z"}],
  rejected_candidates:[],result:"verified_email" as const,completed_at:"2026-09-02T20:00:05.000Z",exhaustion_completed_at:null,no_unverified_email_retained:true as const,orchestrator_reconciled:true as const});

describe("SAB contact research v3",()=>{
  it("accepts one compact per-company record after a valid early-stop website email",()=>{
    const result=validateSabContactResearchV3({row:{company:"Acme Landscapes LLC",phone:"704-555-0100",website:"https://acme.test"},research:verified(),
      contact_tag:"Email Ready",email:"hello@acme.test",public_phone_search_authorized:false,completed_at:"2026-09-02T20:01:00.000Z"});
    expect(result).toMatchObject({evidence_version:3,result:"verified_email",completed_at:"2026-09-02T20:01:00.000Z",exhaustion_completed_at:null});
  });

  it("rejects quoted or augmented search queries and Google URLs masquerading as controlled sources",()=>{
    const quoted=verified();quoted.exact_name_search={...quoted.exact_name_search,query:'"Acme Landscapes LLC" email'};
    expect(()=>validateSabContactResearchV3({row:{company:"Acme Landscapes LLC",website:"https://acme.test"},research:quoted,contact_tag:"Email Ready",email:"hello@acme.test",public_phone_search_authorized:false})).toThrow(/complete GBP name/);
    const google=verified();google.exact_name_search={...google.exact_name_search,surfaced_controlled_profile_urls:["https://www.google.com/search?q=acme"]};
    google.controlled_profile_inspections=[{source_type:"Facebook",url:"https://www.google.com/search?q=acme",result:"no_email_found",company_identity_match:true,
      phone_match:"matched",material_to_contact_resolution:false,inspected_at:"2026-09-02T20:00:04.000Z"}];
    expect(()=>validateSabContactResearchV3({row:{company:"Acme Landscapes LLC",website:"https://acme.test"},research:google,contact_tag:"Email Ready",email:"hello@acme.test",public_phone_search_authorized:false})).toThrow(/Google results page/);
    const conflict=verified();conflict.official_website_inspection={...conflict.official_website_inspection,phone_match:"conflicting"};
    expect(()=>validateSabContactResearchV3({row:{company:"Acme Landscapes LLC",website:"https://acme.test"},research:conflict,
      contact_tag:"Email Ready",email:"hello@acme.test",public_phone_search_authorized:false})).toThrow(/contradiction/);
  });

  it("requires every surfaced controlled profile and blocks only material technical failures for Needs Email",()=>{
    const exhausted={...verified(),exact_phone_fallback:{...search("704-555-0100"),result_source_urls:[],surfaced_official_website_urls:[],surfaced_controlled_profile_urls:["https://facebook.com/acme"]},
      official_website_inspection:{...website(),result:"no_email_found" as const},accepted_evidence:[],result:"exhausted" as const,
      exhaustion_completed_at:"2026-09-02T20:00:05.000Z"};
    expect(()=>validateSabContactResearchV3({row:{company:"Acme Landscapes LLC",phone:"704-555-0100",website:"https://acme.test"},research:exhausted,
      contact_tag:"Needs Email",email:null,public_phone_search_authorized:true})).toThrow(/surfaced relevant company-controlled profile/);
    exhausted.controlled_profile_inspections=[{source_type:"Facebook",url:"https://facebook.com/acme",result:"technical_failure",company_identity_match:true,
      phone_match:"matched",material_to_contact_resolution:true,inspected_at:"2026-09-02T20:00:04.000Z"}];
    expect(()=>validateSabContactResearchV3({row:{company:"Acme Landscapes LLC",phone:"704-555-0100",website:"https://acme.test"},research:exhausted,
      contact_tag:"Needs Email",email:null,public_phone_search_authorized:true})).toThrow(/material controlled-profile/);
    exhausted.controlled_profile_inspections[0].material_to_contact_resolution=false;
    expect(validateSabContactResearchV3({row:{company:"Acme Landscapes LLC",phone:"704-555-0100",website:"https://acme.test"},research:exhausted,
      contact_tag:"Needs Email",email:null,public_phone_search_authorized:true}).result).toBe("exhausted");
  });
});

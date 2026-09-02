import { z } from "zod";
import { sabContactResearchV3Schema } from "./schema";

export type ContactResearchV3 = z.infer<typeof sabContactResearchV3Schema>;
type ContactRow = { company: string; phone?: string | null; website?: string | null };

const compact = (value: string) => value.trim().replace(/\s+/g, " ");
const phoneDigits = (value: string) => {
  const digits=value.replace(/\D/g, "");
  return digits.length===11 && digits.startsWith("1") ? digits.slice(1) : digits;
};
const urlKey = (value: string) => {
  const url=new URL(value);url.hash="";url.search="";
  return `${url.protocol}//${url.hostname.toLowerCase()}${url.pathname.replace(/\/$/, "")}`;
};
const hostname = (value: string) => new URL(value).hostname.toLowerCase().replace(/^www\./, "");
const isGoogleSearchUrl = (value: string) => {
  const host=hostname(value);
  return (host==="google.com" || host.endsWith(".google.com")) && new URL(value).pathname.startsWith("/search");
};
const sameSite = (left: string, right: string) => {
  const a=hostname(left),b=hostname(right);return a===b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
};

export function validateSabContactResearchV3(input: {
  row: ContactRow;
  research: unknown;
  contact_tag: "Email Ready" | "Needs Email";
  email: string | null;
  public_phone_search_authorized: boolean;
  completed_at?: string;
}) {
  const research=sabContactResearchV3Schema.parse(input.research);
  const expectedNameQuery=compact(`${input.row.company} email`).toLowerCase();
  if (/["“”]/.test(research.exact_name_search.query ?? "") || compact(research.exact_name_search.query ?? "").toLowerCase()!==expectedNameQuery) {
    throw new Error(`Exact-name query must be the complete GBP name followed only by email: ${input.row.company} email`);
  }
  if (research.exact_phone_fallback.status==="completed") {
    if(!input.public_phone_search_authorized) throw new Error("Exact-phone fallback requires the run-wide verified public-business-phone authorization");
    const query=research.exact_phone_fallback.query ?? "";
    if(!/^[\d\s()+.-]+$/.test(query) || !input.row.phone || phoneDigits(query)!==phoneDigits(input.row.phone)) {
      throw new Error("Exact-phone fallback must contain the verified public business phone alone, without added words");
    }
  }

  const sourceInspections=[...research.controlled_profile_inspections,...research.independent_source_inspections];
  const classifiedUrls=new Set(sourceInspections.map(source=>urlKey(source.url)));
  for(const source of sourceInspections) {
    if(isGoogleSearchUrl(source.url)) throw new Error("A Google results page cannot be classified as a controlled profile or independent source");
  }
  const surfacedProfiles=[...research.exact_name_search.surfaced_controlled_profile_urls,...research.exact_phone_fallback.surfaced_controlled_profile_urls];
  for(const url of research.result==="exhausted" ? surfacedProfiles : []) if(!classifiedUrls.has(urlKey(url))) {
    throw new Error(`Every surfaced relevant company-controlled profile requires an inspection disposition: ${url}`);
  }
  const surfacedWebsites=[...research.exact_name_search.surfaced_official_website_urls,...research.exact_phone_fallback.surfaced_official_website_urls];
  if(surfacedWebsites.some(isGoogleSearchUrl)) throw new Error("A Google results page cannot be classified as an official company website");
  const website=research.official_website_inspection;
  if(website.website_url && isGoogleSearchUrl(website.website_url)) throw new Error("A Google results page cannot be classified as an official company website");
  if(website.status==="inspected") {
    if(!website.website_url || !website.pages_inspected.length || website.company_identity_match!==true || !website.phone_match || !website.inspected_at) {
      throw new Error("An inspected official website requires its verified URL, inspected contact-bearing pages, identity match, and inspection time");
    }
    if(website.pages_inspected.some(isGoogleSearchUrl) || website.pages_inspected.some(page=>!sameSite(page,website.website_url!))) {
      throw new Error("Official website pages must belong to the verified company website, not Google results or another site");
    }
  }
  if(input.row.website && website.status==="not_available") throw new Error("A stored verified company website cannot be recorded as unavailable");
  if(research.result==="exhausted" && surfacedWebsites.length && (!website.website_url || !surfacedWebsites.some(url=>sameSite(url,website.website_url!)))) {
    throw new Error("A surfaced official website requires an inspection disposition for that site");
  }
  if ((website.company_identity_match===true && website.phone_match==="conflicting" && website.material_to_contact_resolution) ||
      sourceInspections.some(source=>source.company_identity_match && source.phone_match==="conflicting" && source.material_to_contact_resolution)) {
    throw new Error("A material exact-company phone or identity contradiction must be resolved before contact completion");
  }

  const now=input.completed_at ?? new Date().toISOString();
  const finalized={...research,completed_at:now,exhaustion_completed_at:research.result==="exhausted"?now:null};
  if(input.contact_tag==="Email Ready") {
    const email=input.email?.trim().toLowerCase();
    if(!email || research.result!=="verified_email" || !research.accepted_evidence.some(evidence=>evidence.email.toLowerCase()===email)) {
      throw new Error("Email Ready requires a retained email with matching accepted evidence");
    }
    const inspectedUrls=new Set([
      ...research.exact_name_search.result_source_urls,...research.exact_phone_fallback.result_source_urls,
      ...website.pages_inspected,...sourceInspections.map(source=>source.url),
    ].map(urlKey));
    for(const evidence of research.accepted_evidence.filter(candidate=>candidate.email.toLowerCase()===email)) {
      if(evidence.sources.some(isGoogleSearchUrl) || evidence.sources.some(source=>!inspectedUrls.has(urlKey(source)))) {
        throw new Error("Accepted email evidence must cite an actually inspected non-Google source URL");
      }
      if(evidence.verification_gate==="official_website_domain") {
        const domain=email.split("@")[1];
        if(!website.website_url || !sameSite(`https://${domain}`,website.website_url)) throw new Error("Official-website-domain verification requires the email domain to match the verified company website");
      }
      if(evidence.verification_gate==="exact_phone_match" && (!evidence.corroborating_phone || !input.row.phone || phoneDigits(evidence.corroborating_phone)!==phoneDigits(input.row.phone))) {
        throw new Error("Exact-phone verification requires the stored verified business phone");
      }
      if(evidence.verification_gate==="company_controlled_source" && !evidence.sources.some(source=>
        research.controlled_profile_inspections.some(item=>urlKey(item.url)===urlKey(source) && item.company_identity_match && item.result==="email_found") ||
        (website.result==="email_found" && website.pages_inspected.some(page=>urlKey(page)===urlKey(source))))) {
        throw new Error("Company-controlled verification requires an inspected official website or controlled profile source");
      }
      if(evidence.verification_gate==="multiple_independent_sources") {
        const matching=new Set(evidence.sources.filter(source=>research.independent_source_inspections.some(item=>
          urlKey(item.url)===urlKey(source) && item.company_identity_match && item.phone_match==="matched" && item.result!=="technical_failure")).map(urlKey));
        if(matching.size<2) throw new Error("Multiple-independent-source verification requires two inspected sources connecting the email, exact company, and verified phone");
      }
    }
  } else {
    if(input.email || research.result!=="exhausted" || !input.row.phone) throw new Error("Needs Email requires null email, an exhausted result, and a verified public business phone");
    if(website.status==="technical_failure" && website.material_to_contact_resolution) throw new Error("A material official-website access failure keeps contact research incomplete");
    if(sourceInspections.some(source=>source.result==="technical_failure" && source.material_to_contact_resolution)) {
      throw new Error("A material controlled-profile or independent-source access failure keeps contact research incomplete");
    }
  }
  return finalized;
}

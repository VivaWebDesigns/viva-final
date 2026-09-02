import { sabEligibilityStateSchema } from "./schema";
import type { SabRunState } from "./runState";

export type SabCompactView = "compact" | "contact" | "scan" | "import" | "full";

type PublicSabRow = Record<string, any>;

function compactDecision(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const decision = value as Record<string, any>;
  return {
    source_report_key: decision.source_report_key ?? null,
    evidence_hash: decision.evidence_hash ?? null,
    rule_id: decision.rule_id ?? null,
    centering_status: decision.centering_status ?? null,
    proposed_center: decision.proposed_center ?? null,
    center_type: decision.center_type ?? null,
    outcome: decision.outcome ?? null,
    next_action: decision.evidence?.next_action ?? null,
    exclusion_status: decision.exclusion_review?.status ?? null,
  };
}

const base = (row: PublicSabRow) => ({
  place_id: row.place_id,
  company: row.company,
  batch_id: row.batch_id,
  status: row.status,
  qualification_status: row.qualification_status,
  qualification_reason: row.qualification_reason,
  blocker: row.blocker,
  outcome: row.outcome,
  updated_at: row.updated_at,
});

export function projectSabCompany(row: PublicSabRow, view: SabCompactView) {
  if (view === "full") return row;
  if (view === "contact") return {
    ...base(row), phone: row.phone, email: row.email, contact_tag: row.contact_tag,
    website: row.website, eligibility_state: row.eligibility_state ? {
      contact_verified: row.eligibility_state.contact_verified,
      contact_research: row.eligibility_state.contact_research ?? null,
    } : null,
  };
  if (view === "scan") return {
    ...base(row), report_key: row.report_key, report_url: row.report_url,
    scan_center: row.scan_center, center_type: row.center_type, scan_spec: row.scan_spec,
    scan_date: row.scan_date, scan_keyword: row.scan_keyword, arp: row.arp, solv: row.solv,
    found_in: row.found_in, decision_state: compactDecision(row.decision_state),
  };
  if (view === "import") return {
    ...base(row), address: row.address, city: row.city, state: row.state, zip: row.zip,
    phone: row.phone, email: row.email, contact_tag: row.contact_tag, owner_name: row.owner_name,
    website: row.website, has_website: row.has_website, website_platform: row.website_platform,
    report_key: row.report_key, report_url: row.report_url, scan_center: row.scan_center,
    scan_spec: row.scan_spec, market_reference: row.market_reference,
  };
  return {
    ...base(row), contact_tag: row.contact_tag, report_key: row.report_key,
    scan_center: row.scan_center, decision_state: compactDecision(row.decision_state),
  };
}

type ContactException = { place_id: string; company: string; issues: string[] };

export function auditSabContactRows(rows: PublicSabRow[], runState: SabRunState) {
  const counts = { total: rows.length, email_ready: 0, needs_email: 0, valid: 0, legacy_evidence: 0, exceptions: 0 };
  const exceptions: ContactException[] = [];
  for (const row of rows) {
    const issues: string[] = [];
    if (row.contact_tag === "Email Ready") counts.email_ready++;
    else if (row.contact_tag === "Needs Email") counts.needs_email++;
    else issues.push("contact_tag_missing_or_invalid");
    const eligibility = sabEligibilityStateSchema.safeParse(row.eligibility_state);
    const research = eligibility.success ? eligibility.data.contact_research : null;
    if (!eligibility.success) issues.push("eligibility_state_invalid");
    else if (!research) issues.push("contact_research_missing");
    else {
      if (research.evidence_version !== 2) counts.legacy_evidence++;
      if (research.exact_phone_fallback.status === "completed" && !runState.public_business_phone_search_authorization) {
        issues.push("exact_phone_search_authorization_missing");
      }
      if (row.contact_tag === "Email Ready") {
        const email = typeof row.email === "string" ? row.email.trim().toLowerCase() : "";
        if (research.result !== "verified_email" || !email || !research.accepted_evidence.some(evidence => evidence.email.toLowerCase() === email)) {
          issues.push("verified_email_evidence_mismatch");
        }
      } else if (row.contact_tag === "Needs Email") {
        if (row.email) issues.push("needs_email_must_not_retain_email");
        if (!row.phone) issues.push("needs_email_requires_phone");
        if (research.result !== "exhausted" || research.exact_phone_fallback.status !== "completed" ||
            research.company_controlled_inspection.status !== "completed") issues.push("contact_paths_not_exhausted");
      }
    }
    if (issues.length) exceptions.push({ place_id: row.place_id, company: row.company, issues });
    else counts.valid++;
  }
  counts.exceptions = exceptions.length;
  return { counts, exceptions, full_histories_returned: false };
}

export function isNormalModeException(action: unknown) {
  return typeof action === "string" && (
    action.includes("required") || action.includes("pending_review") ||
    action === "evidence_review_required" || action === "policy_review_required"
  );
}

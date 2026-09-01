import { createHash } from "node:crypto";
import { SAB_ADDRESS_LABEL, SCALE_FIRST_WORKFLOW, NO_VISIBILITY_OUTCOME, sabBusinessProfileSchema, sabBusinessProfileIssues } from "@shared/sabCrm";
import { parseLocalFalconPayload, sabMarketReferenceSchema } from "../crm/localFalconImport";
import { sabDecisionStateSchema, sabEffectiveScanSpecSchema, sabEligibilityStateSchema, hasSabExclusionReviewHold } from "./schema";
import type { SabSheetsRepository } from "./sheets";
import type { SabRunState } from "./runState";

export type SabExportBatch = {
  batch_id: string;
  market: { city: string; state: string };
  trade: string;
  keyword: string;
  export_date: string;
  scan_spec: { grid_size: "7x7"; radius_miles: 3 };
};

type ExportCandidate = Awaited<ReturnType<SabSheetsRepository["getExportCandidates"]>>[number];
const present = (value: unknown) => value !== null && value !== undefined && (typeof value !== "string" || value.trim() !== "");

function requiredMetric(value: unknown, field: string, placeId: string): number {
  if (!present(value) || (typeof value !== "string" && typeof value !== "number") || !Number.isFinite(Number(value))) {
    throw new Error(`Missing or invalid ${field} for ${placeId}; never substitute zero or another ranking metric`);
  }
  return Number(value);
}

function assertContactResearch(row: ExportCandidate, runState: SabRunState) {
  const eligibility = sabEligibilityStateSchema.parse(row.eligibility_state);
  const research = eligibility.contact_research;
  if (!research) throw new Error(`Contact research is incomplete for ${row.place_id}; structured path evidence is required before manifest construction`);
  if (research.exact_phone_fallback.status === "completed" && !runState.public_business_phone_search_authorization) {
    throw new Error(`Exact-phone contact research for ${row.place_id} requires the run-wide verified public-business-phone search authorization`);
  }
  if (row.contact_tag === "Email Ready") {
    const email = typeof row.email === "string" ? row.email.trim().toLowerCase() : "";
    if (research.result !== "verified_email" || !email || !research.accepted_evidence.some(evidence => evidence.email.toLowerCase() === email)) {
      throw new Error(`Email Ready requires matching accepted structured verification evidence for ${row.place_id}`);
    }
  } else if (row.contact_tag === "Needs Email") {
    if (research.result !== "exhausted" || research.exact_phone_fallback.status !== "completed") {
      throw new Error(`Needs Email requires documented exhaustion of exact-name, authorized exact-phone, and company-controlled research for ${row.place_id}`);
    }
  }
}

function exportProspect(row: ExportCandidate, runState: SabRunState) {
  if (hasSabExclusionReviewHold(row.decision_state)) throw new Error(`Pending high-visibility exclusion review cannot be exported: ${row.place_id}`);
  if (row.workflow !== SCALE_FIRST_WORKFLOW || row.qualification_status !== "qualified" || !["complete", "qa_ready"].includes(row.status)) {
    throw new Error(`Ineligible row returned in qualified export population: ${row.place_id}`);
  }
  if (!sabEligibilityStateSchema.safeParse(row.eligibility_state).success) throw new Error(`Record verified eligibility_state and contact evidence for ${row.place_id} before export`);
  assertContactResearch(row, runState);
  if (row.address !== SAB_ADDRESS_LABEL) throw new Error(`SAB address privacy must be verified before export: ${row.place_id}`);
  if (typeof row.has_website !== "boolean") throw new Error(`Record verified has_website for ${row.place_id} before export`);
  const profile = present(row.business_profile) ? sabBusinessProfileSchema.parse(row.business_profile) : undefined;
  if (profile) {
    const issues = sabBusinessProfileIssues(profile, row.place_id, row.phone);
    if (issues.length) throw new Error(issues.join("; "));
  }
  const common = {
    place_id: row.place_id,
    company_name: row.company,
    address: SAB_ADDRESS_LABEL,
    city: row.city,
    state: row.state,
    zip: row.zip,
    phone: row.phone || null,
    owner_name: row.owner_name || null,
    email: row.email || null,
    contact_tag: row.contact_tag,
    has_website: row.has_website,
    website_url: row.website || null,
    website_platform: row.website_platform || null,
    ...(row.google_maps_url ? { google_maps_url: row.google_maps_url } : {}),
    scan_keyword: row.scan_keyword,
    rating: row.rating,
    review_count: row.review_count,
    qualification_status: "qualified",
    ...(profile ? { business_profile: profile } : {}),
  };
  const state = sabDecisionStateSchema.safeParse(row.decision_state);
  if (!state.success) throw new Error(`Record valid structured decision_state for ${row.place_id} before export`);
  if (row.outcome === NO_VISIBILITY_OUTCOME) {
    const market = sabMarketReferenceSchema.parse(row.market_reference);
    if (state.data.outcome !== NO_VISIBILITY_OUTCOME || state.data.centering_status !== "market_reference_only"
      || state.data.source_report_key !== market.auxiliary_report_key || state.data.evidence?.exact_top20_count !== 0) {
      throw new Error(`CRM-only state must establish zero exact top-20 pins in the referenced auxiliary for ${row.place_id}`);
    }
    for (const field of ["report_key", "report_url", "scan_date", "arp", "solv", "scan_center", "center_type", "scan_spec"] as const) {
      if (present(row[field])) throw new Error(`Remove stale ${field} from CRM-only record ${row.place_id} before export`);
    }
    return { ...common, outcome: NO_VISIBILITY_OUTCOME, market_reference: market };
  }
  if (row.outcome !== "deliverable") throw new Error(`Record explicit deliverable or CRM-only outcome for ${row.place_id} before export`);
  if (present(row.market_reference)) throw new Error(`Remove stale market_reference from deliverable ${row.place_id}; retain history separately`);
  const spec = sabEffectiveScanSpecSchema.safeParse(row.scan_spec);
  if (!spec.success) throw new Error(`Record the verified effective scan_spec for ${row.place_id} before export; never assume a radius`);
  const match = row.scan_center.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) throw new Error(`Missing or malformed validated scan center for ${row.place_id}`);
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (state.data.centering_status !== "validated" || state.data.outcome !== "deliverable"
    || state.data.source_report_key !== row.report_key || state.data.proposed_center !== row.scan_center || row.center_type === "master_edge_offset"
    || !state.data.center_type || state.data.center_type !== row.center_type) {
    throw new Error(`Unvalidated or conflicting deliverable decision_state for ${row.place_id}`);
  }
  const canonicalHistory = row.scan_history.find((entry: unknown) => typeof entry === "object" && entry !== null
    && !("record_type" in entry) && "report_key" in entry && entry.report_key === row.report_key) as { atrp?: unknown } | undefined;
  const atrp = present(canonicalHistory?.atrp) ? requiredMetric(canonicalHistory?.atrp, "atrp", row.place_id) : undefined;
  return {
    ...common,
    outcome: "deliverable",
    report_key: row.report_key,
    report_url: row.report_url,
    scan_date: row.scan_date,
    arp: requiredMetric(row.arp, "arp", row.place_id),
    ...(atrp !== undefined ? { atrp } : {}),
    solv: requiredMetric(row.solv, "solv", row.place_id),
    scan_spec: spec.data,
    scan_center: { lat, lng, city: row.city, state: row.state, zip: row.zip },
  };
}

/** One complete manifest across execution batches, never a qa_ready-only slice. */
export async function buildSabRunManifest(
  repository: Pick<SabSheetsRepository, "getExportCandidates" | "getRunCompletionRows" | "getRunState">,
  batch: SabExportBatch,
  runId: string,
) {
  const runState = await repository.getRunState(runId);
  if (!runState) throw new Error("Read the authoritative initialized run before manifest construction");
  const completionRows = await repository.getRunCompletionRows();
  const terminalDeferrals = runState.terminal_deferrals ?? {};
  const unresolved = completionRows.filter((row) => {
    if (hasSabExclusionReviewHold(row.decision_state)) return true;
    if (row.qualification_status === "disqualified" && ["complete", "imported"].includes(row.status)) return false;
    if (row.qualification_status === "qualified" && ["complete", "qa_ready", "imported"].includes(row.status)) return false;
    if (row.qualification_status === "deferred" && row.status === "complete" && terminalDeferrals[row.place_id]) return false;
    return true;
  });
  if (unresolved.length) {
    const details = unresolved.map((row) =>
      `${row.company || row.place_id} (${row.place_id}; status=${row.status || "blank"}; qualification=${row.qualification_status || "blank"}; blocker=${row.blocker || "none"})`,
    );
    throw new Error(`Run completion gate blocked: ${unresolved.length} survivor(s) remain unresolved. Deferred is a recovery queue unless Matt explicitly approves a named terminal deferral. ${details.join(" | ")}`);
  }
  // Defense in depth: a hand-edited disposition or alternate repository must
  // not turn an unresolved exclusion into an outreach-ready prospect.
  const rows = (await repository.getExportCandidates()).filter(row => !hasSabExclusionReviewHold(row.decision_state));
  if (!rows.length) throw new Error("No eligible qualified complete or qa_ready leads to export");
  const manifest = parseLocalFalconPayload(JSON.stringify({
    workflow: SCALE_FIRST_WORKFLOW,
    batch,
    prospects: rows.map(row => exportProspect(row, runState)),
  }));
  const manifestJson = JSON.stringify(manifest, null, 2);
  return {
    artifact_name: "batch.json",
    manifest_json: manifestJson,
    sha256: createHash("sha256").update(manifestJson).digest("hex"),
    eligible_count: rows.length,
    exported_count: manifest.prospects.length,
    from_complete: rows.filter((row) => row.status === "complete").length,
    from_qa_ready: rows.filter((row) => row.status === "qa_ready").length,
    crm_only_count: rows.filter((row) => row.outcome === NO_VISIBILITY_OUTCOME).length,
    competitor_sidecar: false,
    import_performed: false,
    final_import_confirmation_required: true,
  };
}

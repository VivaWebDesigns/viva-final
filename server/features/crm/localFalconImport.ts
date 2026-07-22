import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { parseCSV } from "../../lib/csv";
import { normalizePhoneDigits } from "@shared/phone";
import {
  crmCompanies,
  crmContacts,
  crmLeads,
  crmLeadStatuses,
  localFalconImportBatches,
  localFalconProspectProfiles,
  pipelineOpportunities,
  pipelineStages,
} from "@shared/schema";

export const LOCAL_FALCON_PITCH_TYPES = [
  "momentum-ceiling",
  "defend-the-legacy",
  "engaged-owner",
] as const;

const WEBSITE_CONDITIONS = ["missing", "broken", "outdated", "weak", "acceptable"] as const;
const EMAIL_DOMAIN_TYPES = ["free", "branded"] as const;

const batchSchema = z.object({
  batch_id: z.string().trim().min(1),
  market_city: z.string().trim().min(1),
  market_state: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((v) => v.toUpperCase()),
  trade: z.string().trim().min(1),
  keyword: z.string().trim().min(1),
  import_date: z.string().trim().min(1),
  scan_date_start: z.string().trim().optional().default(""),
  scan_date_end: z.string().trim().optional().default(""),
});

const optionalUrl = z.string().trim().optional().default("").refine(
  (value) => !value || z.string().url().safeParse(value).success,
  "Must be a valid URL",
);

const prospectSchema = z.object({
  place_id: z.string().trim().min(1),
  company_name: z.string().trim().min(1),
  address: z.string().trim().optional().default(""),
  city: z.string().trim().min(1),
  state: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((v) => v.toUpperCase()),
  zip: z.string().trim().optional().default(""),
  phone: z.string().trim().optional().default(""),
  email: z.string().trim().optional().default("").refine((v) => !v || z.string().email().safeParse(v).success, "Invalid email"),
  email_domain_type: z.union([z.enum(EMAIL_DOMAIN_TYPES), z.literal("")]).default(""),
  website_url: optionalUrl,
  google_maps_url: z.string().trim().url(),
  owner_name: z.string().trim().optional().default(""),
  report_key: z.string().trim().min(1),
  scan_date: z.string().trim().min(1),
  scan_keyword: z.string().trim().min(1),
  solv: z.coerce.number().finite().min(0),
  arp: z.coerce.number().finite().min(0),
  atrp: z.coerce.number().finite().min(0),
  rating: z.coerce.number().finite().min(0).max(5),
  review_count: z.coerce.number().int().min(0),
  footprint_note: z.string().trim().optional().default(""),
  website_condition: z.enum(WEBSITE_CONDITIONS),
  tier: z.enum(["A", "B", "C"]),
  pitch_type: z.enum(LOCAL_FALCON_PITCH_TYPES),
  pitch_summary: z.string().trim().min(1),
  sos_lookup_done: z.boolean(),
  sos_entity_found: z.boolean(),
  license_record_found: z.boolean(),
}).superRefine((value, ctx) => {
  if (value.email && !value.email_domain_type) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["email_domain_type"],
      message: "Required when email is present",
    });
  }
});

export type LocalFalconBatchInput = z.infer<typeof batchSchema>;
export type LocalFalconProspectInput = z.infer<typeof prospectSchema>;

export interface LocalFalconPayload {
  batch: LocalFalconBatchInput;
  prospects: LocalFalconProspectInput[];
}

export interface FallbackMatch {
  leadId: string | null;
  companyId: string;
  companyName: string;
  reasons: string[];
}

export interface ProspectPreview {
  row: number;
  placeId: string;
  companyName: string;
  outcome: "new" | "existing" | "flagged" | "error";
  reason?: string;
  matches?: FallbackMatch[];
}

export interface LocalFalconPreviewResult {
  batchId: string;
  batchAlreadyImported: boolean;
  newCount: number;
  existingCount: number;
  flaggedCount: number;
  errorCount: number;
  rows: ProspectPreview[];
}

function parseBoolean(value: unknown, field: string): boolean {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "yes", "y", "1"].includes(normalized)) return true;
  if (["false", "no", "n", "0"].includes(normalized)) return false;
  throw new Error(`${field} must be true/false or yes/no`);
}

function assertDate(value: string, field: string): string {
  if (Number.isNaN(new Date(value).getTime())) throw new Error(`${field} must be a valid date`);
  return value;
}

function rowFromJson(raw: Record<string, unknown>): Record<string, unknown> {
  const enrichment = (raw.enrichment_status ?? {}) as Record<string, unknown>;
  return {
    ...raw,
    sos_lookup_done: raw.sos_lookup_done ?? enrichment.sos_lookup_done,
    sos_entity_found: raw.sos_entity_found ?? enrichment.sos_entity_found,
    license_record_found: raw.license_record_found ?? enrichment.license_record_found,
  };
}

export function parseLocalFalconPayload(text: string): LocalFalconPayload {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Import file is empty");

  let rawBatch: Record<string, unknown>;
  let rawProspects: Record<string, unknown>[];

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) throw new Error("JSON must contain { batch, prospects }");
    rawBatch = parsed.batch ?? {};
    rawProspects = Array.isArray(parsed.prospects) ? parsed.prospects : [];
  } else {
    const { rows } = parseCSV(trimmed);
    if (rows.length === 0) throw new Error("CSV has no prospect rows");
    rawBatch = rows[0];
    rawProspects = rows;
    const batchKeys = ["batch_id", "market_city", "market_state", "trade", "keyword", "import_date"];
    for (const [index, row] of rows.entries()) {
      for (const key of batchKeys) {
        if ((row[key] ?? "").trim() !== String(rawBatch[key] ?? "").trim()) {
          throw new Error(`Row ${index + 2}: batch field ${key} must match every row in the file`);
        }
      }
    }
  }

  const batch = batchSchema.parse(rawBatch);
  assertDate(batch.import_date, "import_date");
  if (batch.scan_date_start) assertDate(batch.scan_date_start, "scan_date_start");
  if (batch.scan_date_end) assertDate(batch.scan_date_end, "scan_date_end");
  if (rawProspects.length === 0) throw new Error("Import must contain at least one prospect");
  if (rawProspects.length > 200) throw new Error("A Local Falcon import is limited to 200 prospects");

  const seen = new Set<string>();
  const prospects = rawProspects.map((raw, index) => {
    try {
      const normalized = rowFromJson(raw);
      normalized.sos_lookup_done = parseBoolean(normalized.sos_lookup_done, "sos_lookup_done");
      normalized.sos_entity_found = parseBoolean(normalized.sos_entity_found, "sos_entity_found");
      normalized.license_record_found = parseBoolean(normalized.license_record_found, "license_record_found");
      const prospect = prospectSchema.parse(normalized);
      assertDate(prospect.scan_date, "scan_date");
      if (seen.has(prospect.place_id)) throw new Error(`duplicate place_id ${prospect.place_id} inside the file`);
      seen.add(prospect.place_id);
      return prospect;
    } catch (error) {
      const message = error instanceof z.ZodError
        ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")
        : error instanceof Error ? error.message : String(error);
      throw new Error(`Row ${index + 2}: ${message}`);
    }
  });

  return { batch, prospects };
}

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function domain(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function businessTokens(value: string): Set<string> {
  const stop = new Set(["llc", "inc", "co", "company", "corp", "corporation", "the"]);
  return new Set(normalized(value).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((part) => part && !stop.has(part)));
}

function similarBusinessName(left: string, right: string): boolean {
  const a = businessTokens(left);
  const b = businessTokens(right);
  if (a.size === 0 || b.size === 0) return false;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / Math.max(a.size, b.size) >= 0.8;
}

async function existingCompanyMatches(prospect: LocalFalconProspectInput): Promise<FallbackMatch[]> {
  const companies = await db.select().from(crmCompanies);
  const leadRows = await db.select({ id: crmLeads.id, companyId: crmLeads.companyId }).from(crmLeads);
  const leadByCompany = new Map(leadRows.filter((row) => row.companyId).map((row) => [row.companyId!, row.id]));
  const phone = normalizePhoneDigits(prospect.phone);
  const websiteDomain = domain(prospect.website_url);

  return companies.flatMap((company) => {
    const reasons: string[] = [];
    if (phone && normalizePhoneDigits(company.phone ?? "") === phone) reasons.push("normalized phone");
    if (websiteDomain && domain(company.website) === websiteDomain) reasons.push("website domain");
    if (prospect.address && normalized(company.address) === normalized(prospect.address)) reasons.push("exact address");
    if (
      normalized(company.city) === normalized(prospect.city) &&
      normalized(company.state) === normalized(prospect.state) &&
      similarBusinessName(company.name, prospect.company_name)
    ) reasons.push("similar company name in the same city/state");
    return reasons.length ? [{ leadId: leadByCompany.get(company.id) ?? null, companyId: company.id, companyName: company.name, reasons }] : [];
  });
}

export async function previewLocalFalconImport(payload: LocalFalconPayload): Promise<LocalFalconPreviewResult> {
  const [existingBatch] = await db.select({ id: localFalconImportBatches.id })
    .from(localFalconImportBatches).where(eq(localFalconImportBatches.batchId, payload.batch.batch_id)).limit(1);
  const placeIds = payload.prospects.map((prospect) => prospect.place_id);
  const existingProfiles = placeIds.length
    ? await db.select({ placeId: localFalconProspectProfiles.placeId, leadId: localFalconProspectProfiles.leadId })
        .from(localFalconProspectProfiles).where(inArray(localFalconProspectProfiles.placeId, placeIds))
    : [];
  const existingByPlace = new Map(existingProfiles.map((row) => [row.placeId, row.leadId]));

  const rows: ProspectPreview[] = [];
  for (const [index, prospect] of payload.prospects.entries()) {
    const existingLeadId = existingByPlace.get(prospect.place_id);
    if (existingLeadId || existingBatch) {
      rows.push({
        row: index + 2,
        placeId: prospect.place_id,
        companyName: prospect.company_name,
        outcome: "existing",
        reason: existingBatch ? `Batch ${payload.batch.batch_id} was already imported` : `Place ID already belongs to lead ${existingLeadId}`,
      });
      continue;
    }
    const matches = await existingCompanyMatches(prospect);
    rows.push({
      row: index + 2,
      placeId: prospect.place_id,
      companyName: prospect.company_name,
      outcome: matches.length ? "flagged" : "new",
      matches: matches.length ? matches : undefined,
    });
  }

  return {
    batchId: payload.batch.batch_id,
    batchAlreadyImported: Boolean(existingBatch),
    newCount: rows.filter((row) => row.outcome === "new").length,
    existingCount: rows.filter((row) => row.outcome === "existing").length,
    flaggedCount: rows.filter((row) => row.outcome === "flagged").length,
    errorCount: rows.filter((row) => row.outcome === "error").length,
    rows,
  };
}

export interface LocalFalconImportResult extends LocalFalconPreviewResult {
  imported: number;
  importedLeads: Array<{ leadId: string; opportunityId: string; contactId: string | null; companyId: string }>;
}

export async function importLocalFalconPayload(payload: LocalFalconPayload, importedBy: string): Promise<LocalFalconImportResult> {
  const preview = await previewLocalFalconImport(payload);
  if (preview.batchAlreadyImported) return { ...preview, imported: 0, importedLeads: [] };

  const importablePlaceIds = new Set(preview.rows.filter((row) => row.outcome !== "existing").map((row) => row.placeId));
  const importedLeads = await db.transaction(async (tx) => {
    const [batch] = await tx.insert(localFalconImportBatches).values({
      batchId: payload.batch.batch_id,
      marketCity: payload.batch.market_city,
      marketState: payload.batch.market_state,
      trade: payload.batch.trade,
      keyword: payload.batch.keyword,
      scanDateStart: payload.batch.scan_date_start ? new Date(payload.batch.scan_date_start) : null,
      scanDateEnd: payload.batch.scan_date_end ? new Date(payload.batch.scan_date_end) : null,
      importDate: new Date(payload.batch.import_date),
      importedBy,
    }).returning();

    const [status] = await tx.select().from(crmLeadStatuses)
      .where(eq(crmLeadStatuses.slug, "new")).limit(1);
    const [stage] = await tx.select().from(pipelineStages)
      .where(eq(pipelineStages.slug, "new-lead")).limit(1);
    if (!status) throw new Error("CRM status 'new' is not configured");
    if (!stage) throw new Error("Pipeline stage 'new-lead' is not configured");

    const results: Array<{ leadId: string; opportunityId: string; contactId: string | null; companyId: string }> = [];
    for (const prospect of payload.prospects) {
      if (!importablePlaceIds.has(prospect.place_id)) continue;
      const [raceDuplicate] = await tx.select({ id: localFalconProspectProfiles.id })
        .from(localFalconProspectProfiles).where(eq(localFalconProspectProfiles.placeId, prospect.place_id)).limit(1);
      if (raceDuplicate) continue;

      const [company] = await tx.insert(crmCompanies).values({
        name: prospect.company_name,
        website: prospect.website_url || null,
        phone: prospect.phone ? normalizePhoneDigits(prospect.phone) : null,
        email: prospect.email ? prospect.email.toLowerCase() : null,
        address: prospect.address || null,
        city: prospect.city,
        state: prospect.state,
        zip: prospect.zip || null,
        country: "US",
        industry: payload.batch.trade,
        clientStatus: "prospect",
        preferredLanguage: null,
      }).returning();

      let contactId: string | null = null;
      if (prospect.owner_name) {
        const parts = prospect.owner_name.trim().split(/\s+/);
        const [contact] = await tx.insert(crmContacts).values({
          companyId: company.id,
          firstName: parts[0],
          lastName: parts.slice(1).join(" ") || null,
          email: prospect.email ? prospect.email.toLowerCase() : null,
          phone: prospect.phone ? normalizePhoneDigits(prospect.phone) : null,
          title: "Owner",
          isPrimary: true,
          preferredLanguage: null,
        }).returning();
        contactId = contact.id;
      }

      const [lead] = await tx.insert(crmLeads).values({
        companyId: company.id,
        contactId,
        statusId: status.id,
        title: prospect.company_name,
        source: "local_falcon",
        sourceLabel: "Local Falcon / Claude",
        city: prospect.city,
        state: prospect.state,
        trade: payload.batch.trade,
        notes: prospect.pitch_summary,
        assignedTo: null,
      }).returning();

      const [opportunity] = await tx.insert(pipelineOpportunities).values({
        title: prospect.company_name,
        leadId: lead.id,
        companyId: company.id,
        contactId,
        stageId: stage.id,
        status: "open",
        sourceLeadTitle: prospect.company_name,
        notes: prospect.pitch_summary,
        assignedTo: null,
      }).returning();

      await tx.insert(localFalconProspectProfiles).values({
        batchRecordId: batch.id,
        leadId: lead.id,
        placeId: prospect.place_id,
        ownerName: prospect.owner_name || null,
        emailDomainType: prospect.email_domain_type || null,
        googleMapsUrl: prospect.google_maps_url,
        reportKey: prospect.report_key,
        scanDate: new Date(prospect.scan_date),
        scanKeyword: prospect.scan_keyword,
        solv: String(prospect.solv),
        arp: String(prospect.arp),
        atrp: String(prospect.atrp),
        rating: String(prospect.rating),
        reviewCount: prospect.review_count,
        footprintNote: prospect.footprint_note || null,
        websiteCondition: prospect.website_condition,
        tier: prospect.tier,
        pitchType: prospect.pitch_type,
        pitchSummary: prospect.pitch_summary,
        sosLookupDone: prospect.sos_lookup_done,
        sosEntityFound: prospect.sos_entity_found,
        licenseRecordFound: prospect.license_record_found,
      });
      results.push({ leadId: lead.id, opportunityId: opportunity.id, contactId, companyId: company.id });
    }
    return results;
  });

  return { ...preview, imported: importedLeads.length, importedLeads };
}

export async function getLocalFalconProfileForLead(leadId: string) {
  const [result] = await db.select({
    profile: localFalconProspectProfiles,
    batch: localFalconImportBatches,
  }).from(localFalconProspectProfiles)
    .innerJoin(localFalconImportBatches, eq(localFalconProspectProfiles.batchRecordId, localFalconImportBatches.id))
    .where(eq(localFalconProspectProfiles.leadId, leadId)).limit(1);
  return result ?? null;
}

import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../db";
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

const nullableText = z.string().trim().min(1).nullable();
const nullableUrl = z.string().trim().url().nullable();

const batchSchema = z.object({
  batch_id: z.string().trim().min(1),
  market: z.object({
    city: z.string().trim().min(1),
    state: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((value) => value.toUpperCase()),
  }),
  trade: z.string().trim().min(1),
  keyword: z.string().trim().min(1),
  export_date: z.string().trim().min(1),
  scan_spec: z.object({
    grid_size: z.string().trim().regex(/^\d+\s*[x×]\s*\d+$/i, "Use a grid size such as 7x7"),
    radius_miles: z.coerce.number().finite().positive(),
  }),
}).strict();

const prospectSchema = z.object({
  place_id: z.string().trim().min(1),
  company_name: z.string().trim().min(1),
  address: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((value) => value.toUpperCase()),
  zip: z.string().trim().min(1),
  phone: nullableText,
  owner_name: nullableText,
  google_maps_url: z.string().trim().url(),
  has_website: z.boolean(),
  website_url: nullableUrl,
  service_page_count: z.number().int().min(0),
  report_key: z.string().trim().min(1),
  report_url: z.string().trim().url(),
  scan_date: z.string().trim().min(1),
  scan_keyword: z.string().trim().min(1),
  arp: z.coerce.number().finite().min(0),
  rating: z.coerce.number().finite().min(0).max(5),
  review_count: z.coerce.number().int().min(0),
  heatmap_file: z.string().trim().min(1),
  qualification_status: z.literal("qualified"),
}).strict().superRefine((value, ctx) => {
  if (value.has_website && !value.website_url) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["website_url"], message: "Required when has_website is true" });
  }
  if (!value.has_website && value.website_url) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["website_url"], message: "Must be null when has_website is false" });
  }
  const normalizedPath = value.heatmap_file.replace(/\\/g, "/");
  if (!/^heatmaps\/[A-Za-z0-9._-]+\.(png|jpe?g|webp)$/i.test(normalizedPath) || normalizedPath.includes("..")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["heatmap_file"],
      message: "Must reference a PNG, JPG, or WebP file directly inside heatmaps/",
    });
  }
});

const payloadSchema = z.object({
  batch: batchSchema,
  prospects: z.array(prospectSchema).min(1).max(200),
}).strict();

export type LocalFalconBatchInput = z.infer<typeof batchSchema>;
export type LocalFalconProspectInput = z.infer<typeof prospectSchema>;
export type LocalFalconPayload = z.infer<typeof payloadSchema>;

export interface LocalFalconUploadedAsset {
  key: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  manifestPath: string;
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
  address: string;
  heatmapFile: string;
  outcome: "new" | "existing" | "flagged";
  reason?: string;
  matches?: FallbackMatch[];
}

export interface LocalFalconPreviewResult {
  batchId: string;
  market: LocalFalconBatchInput["market"];
  trade: string;
  keyword: string;
  scanSpec: LocalFalconBatchInput["scan_spec"];
  batchAlreadyImported: boolean;
  newCount: number;
  existingCount: number;
  flaggedCount: number;
  rows: ProspectPreview[];
}

function assertDate(value: string, field: string): void {
  if (Number.isNaN(new Date(value).getTime())) throw new Error(`${field} must be a valid date`);
}

function zodMessage(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`).join("; ");
}

export function parseLocalFalconPayload(text: string): LocalFalconPayload {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("batch.json is empty");

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    throw new Error("batch.json must contain valid JSON");
  }

  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) throw new Error(zodMessage(parsed.error));
  assertDate(parsed.data.batch.export_date, "batch.export_date");

  const placeIds = new Set<string>();
  const heatmapFiles = new Set<string>();
  for (const [index, prospect] of parsed.data.prospects.entries()) {
    assertDate(prospect.scan_date, `prospects.${index}.scan_date`);
    if (prospect.scan_keyword !== parsed.data.batch.keyword) {
      throw new Error(`prospects.${index}.scan_keyword must match batch.keyword`);
    }
    if (placeIds.has(prospect.place_id)) throw new Error(`prospects.${index}.place_id is duplicated inside the batch`);
    if (heatmapFiles.has(prospect.heatmap_file)) throw new Error(`prospects.${index}.heatmap_file is referenced more than once`);
    placeIds.add(prospect.place_id);
    heatmapFiles.add(prospect.heatmap_file);
  }

  return parsed.data;
}

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function domain(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
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
  const phone = normalizePhoneDigits(prospect.phone ?? "");
  const websiteDomain = domain(prospect.website_url);

  return companies.flatMap((company) => {
    const reasons: string[] = [];
    if (phone && normalizePhoneDigits(company.phone ?? "") === phone) reasons.push("normalized phone");
    if (websiteDomain && domain(company.website) === websiteDomain) reasons.push("website domain");
    if (normalized(company.address) === normalized(prospect.address)) reasons.push("exact address");
    if (
      normalized(company.city) === normalized(prospect.city) &&
      normalized(company.state) === normalized(prospect.state) &&
      similarBusinessName(company.name, prospect.company_name)
    ) reasons.push("similar company name in the same city/state");
    return reasons.length
      ? [{ leadId: leadByCompany.get(company.id) ?? null, companyId: company.id, companyName: company.name, reasons }]
      : [];
  });
}

export async function previewLocalFalconImport(payload: LocalFalconPayload): Promise<LocalFalconPreviewResult> {
  const [existingBatch] = await db.select({ id: localFalconImportBatches.id })
    .from(localFalconImportBatches).where(eq(localFalconImportBatches.batchId, payload.batch.batch_id)).limit(1);
  const placeIds = payload.prospects.map((prospect) => prospect.place_id);
  const existingProfiles = await db.select({ placeId: localFalconProspectProfiles.placeId, leadId: localFalconProspectProfiles.leadId })
    .from(localFalconProspectProfiles).where(inArray(localFalconProspectProfiles.placeId, placeIds));
  const existingByPlace = new Map(existingProfiles.map((row) => [row.placeId, row.leadId]));

  const rows: ProspectPreview[] = [];
  for (const [index, prospect] of payload.prospects.entries()) {
    const base = {
      row: index + 1,
      placeId: prospect.place_id,
      companyName: prospect.company_name,
      address: prospect.address,
      heatmapFile: prospect.heatmap_file,
    };
    const existingLeadId = existingByPlace.get(prospect.place_id);
    if (existingLeadId || existingBatch) {
      rows.push({
        ...base,
        outcome: "existing",
        reason: existingBatch
          ? `Batch ${payload.batch.batch_id} was already imported`
          : `Place ID already belongs to lead ${existingLeadId}`,
      });
      continue;
    }
    const matches = await existingCompanyMatches(prospect);
    rows.push({ ...base, outcome: matches.length ? "flagged" : "new", matches: matches.length ? matches : undefined });
  }

  return {
    batchId: payload.batch.batch_id,
    market: payload.batch.market,
    trade: payload.batch.trade,
    keyword: payload.batch.keyword,
    scanSpec: payload.batch.scan_spec,
    batchAlreadyImported: Boolean(existingBatch),
    newCount: rows.filter((row) => row.outcome === "new").length,
    existingCount: rows.filter((row) => row.outcome === "existing").length,
    flaggedCount: rows.filter((row) => row.outcome === "flagged").length,
    rows,
  };
}

export interface LocalFalconImportResult extends LocalFalconPreviewResult {
  imported: number;
  importedLeads: Array<{ leadId: string; opportunityId: string; contactId: string | null; companyId: string; placeId: string }>;
}

export async function importLocalFalconPayload(
  payload: LocalFalconPayload,
  importedBy: string,
  assignedTo: string,
  selectedPlaceIds: Set<string>,
  assetsByPlaceId: Map<string, LocalFalconUploadedAsset>,
): Promise<LocalFalconImportResult> {
  const preview = await previewLocalFalconImport(payload);
  if (preview.batchAlreadyImported) return { ...preview, imported: 0, importedLeads: [] };

  const allowedPlaceIds = new Set(
    preview.rows.filter((row) => row.outcome === "new" || (row.outcome === "flagged" && selectedPlaceIds.has(row.placeId)))
      .map((row) => row.placeId),
  );
  if (allowedPlaceIds.size === 0) throw new Error("No new prospects were selected for import");
  for (const placeId of allowedPlaceIds) {
    if (!assetsByPlaceId.has(placeId)) throw new Error(`Heatmap upload is missing for Place ID ${placeId}`);
  }

  const importedLeads = await db.transaction(async (tx) => {
    const [batch] = await tx.insert(localFalconImportBatches).values({
      batchId: payload.batch.batch_id,
      marketCity: payload.batch.market.city,
      marketState: payload.batch.market.state,
      trade: payload.batch.trade,
      keyword: payload.batch.keyword,
      exportDate: new Date(payload.batch.export_date),
      gridSize: payload.batch.scan_spec.grid_size,
      radiusMiles: String(payload.batch.scan_spec.radius_miles),
      importDate: new Date(),
      importedBy,
    }).returning();

    const [status] = await tx.select().from(crmLeadStatuses).where(eq(crmLeadStatuses.slug, "new")).limit(1);
    const [stage] = await tx.select().from(pipelineStages).where(eq(pipelineStages.slug, "new-lead")).limit(1);
    if (!status) throw new Error("CRM status 'new' is not configured");
    if (!stage) throw new Error("Pipeline stage 'new-lead' is not configured");

    const results: LocalFalconImportResult["importedLeads"] = [];
    for (const prospect of payload.prospects) {
      if (!allowedPlaceIds.has(prospect.place_id)) continue;
      const [duplicate] = await tx.select({ id: localFalconProspectProfiles.id })
        .from(localFalconProspectProfiles).where(eq(localFalconProspectProfiles.placeId, prospect.place_id)).limit(1);
      if (duplicate) continue;
      const asset = assetsByPlaceId.get(prospect.place_id)!;

      const [company] = await tx.insert(crmCompanies).values({
        name: prospect.company_name,
        website: prospect.website_url,
        phone: prospect.phone ? normalizePhoneDigits(prospect.phone) : null,
        address: prospect.address,
        city: prospect.city,
        state: prospect.state,
        zip: prospect.zip,
        country: "US",
        industry: payload.batch.trade,
        clientStatus: "prospect",
      }).returning();

      let contactId: string | null = null;
      if (prospect.owner_name) {
        const parts = prospect.owner_name.split(/\s+/);
        const [contact] = await tx.insert(crmContacts).values({
          companyId: company.id,
          firstName: parts[0],
          lastName: parts.slice(1).join(" ") || null,
          phone: prospect.phone ? normalizePhoneDigits(prospect.phone) : null,
          title: "Owner",
          isPrimary: true,
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
        notes: `Qualified Local Falcon prospect · ARP ${prospect.arp}`,
        assignedTo,
      }).returning();

      const [opportunity] = await tx.insert(pipelineOpportunities).values({
        title: prospect.company_name,
        leadId: lead.id,
        companyId: company.id,
        contactId,
        stageId: stage.id,
        status: "open",
        sourceLeadTitle: prospect.company_name,
        notes: `Local Falcon report ${prospect.report_key}`,
        assignedTo,
      }).returning();

      await tx.insert(localFalconProspectProfiles).values({
        batchRecordId: batch.id,
        leadId: lead.id,
        placeId: prospect.place_id,
        companyName: prospect.company_name,
        address: prospect.address,
        city: prospect.city,
        state: prospect.state,
        zip: prospect.zip,
        phone: prospect.phone ? normalizePhoneDigits(prospect.phone) : null,
        ownerName: prospect.owner_name,
        googleMapsUrl: prospect.google_maps_url,
        hasWebsite: prospect.has_website,
        websiteUrl: prospect.website_url,
        servicePageCount: prospect.service_page_count,
        reportKey: prospect.report_key,
        reportUrl: prospect.report_url,
        scanDate: new Date(prospect.scan_date),
        scanKeyword: prospect.scan_keyword,
        qualificationStatus: prospect.qualification_status,
        heatmapFile: prospect.heatmap_file,
        heatmapStorageKey: asset.key,
        heatmapOriginalName: asset.originalName,
        heatmapMimeType: asset.mimeType,
        heatmapSizeBytes: asset.sizeBytes,
        heatmapSha256: asset.sha256,
        arp: String(prospect.arp),
        rating: String(prospect.rating),
        reviewCount: prospect.review_count,
      });

      results.push({ leadId: lead.id, opportunityId: opportunity.id, contactId, companyId: company.id, placeId: prospect.place_id });
    }
    return results;
  });

  return { ...preview, imported: importedLeads.length, importedLeads };
}

export async function getLocalFalconProfileForLead(leadId: string) {
  const [result] = await db.select({ profile: localFalconProspectProfiles, batch: localFalconImportBatches })
    .from(localFalconProspectProfiles)
    .innerJoin(localFalconImportBatches, eq(localFalconProspectProfiles.batchRecordId, localFalconImportBatches.id))
    .where(eq(localFalconProspectProfiles.leadId, leadId)).limit(1);
  return result ?? null;
}

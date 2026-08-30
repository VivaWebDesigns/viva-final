import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db";
import { normalizePhoneDigits } from "@shared/phone";
import {
  crmCompanies,
  crmContacts,
  crmLeadTags,
  crmLeads,
  crmLeadStatuses,
  crmTags,
  localFalconImportBatches,
  localFalconProspectProfiles,
  pipelineOpportunities,
  pipelineStages,
} from "@shared/schema";
import {
  LOCAL_FALCON_LEAD_CLASSIFICATIONS,
  getLocalFalconLeadClassification,
  type LocalFalconLeadClassification,
} from "@shared/leadClassification";
import {
  SAB_ADDRESS_LABEL,
  SCALE_FIRST_CONTACT_TAGS,
  SCALE_FIRST_WORKFLOW,
  type ScaleFirstContactTag,
} from "@shared/sabCrm";

const nullableText = z.string().trim().min(1).nullable();
const nullableUrl = z.string().trim().url().nullable();
const nullableAnalysis = z.array(z.string()).min(3).max(6).nullable().optional().default(null);
const scanCenterSchema = z.object({
  lat: z.coerce.number().finite().min(-90).max(90),
  lng: z.coerce.number().finite().min(-180).max(180),
  city: z.string().trim().min(1),
  state: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((value) => value.toUpperCase()),
  zip: z.string().trim().min(1),
}).strict();

const scanSpecSchema = z.object({
  grid_size: z.string().trim().regex(/^\d+\s*[x×]\s*\d+$/i, "Use a grid size such as 7x7"),
  radius_miles: z.coerce.number().finite().positive(),
}).strict();

const batchSchema = z.object({
  batch_id: z.string().trim().min(1),
  market: z.object({
    city: z.string().trim().min(1),
    state: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((value) => value.toUpperCase()),
  }),
  trade: z.string().trim().min(1),
  keyword: z.string().trim().min(1),
  export_date: z.string().trim().min(1),
  scan_spec: scanSpecSchema,
}).strict();

const auditFirstProspectSchema = z.object({
  place_id: z.string().trim().min(1),
  company_name: z.string().trim().min(1),
  address: z.literal(SAB_ADDRESS_LABEL),
  city: z.string().trim().min(1),
  state: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((value) => value.toUpperCase()),
  zip: z.string().trim().min(1),
  phone: nullableText,
  owner_name: nullableText,
  email: nullableText,
  google_maps_url: z.string().trim().url(),
  has_website: z.boolean(),
  website_url: nullableUrl,
  website_platform: z.string().nullable().optional().default(null),
  service_page_count: z.number().int().min(0),
  website_analysis: nullableAnalysis,
  reviews_analysis: nullableAnalysis,
  report_key: z.string().trim().regex(/^[a-f0-9]{12,64}$/i, "Must be a Local Falcon report key"),
  report_url: z.string().trim().url(),
  scan_date: z.string().trim().min(1),
  scan_keyword: z.string().trim().min(1),
  arp: z.coerce.number().finite().min(0),
  atrp: z.number().finite().min(1).nullable().optional(),
  solv: z.coerce.number().finite().min(0).max(100),
  rating: z.coerce.number().finite().min(0).max(5),
  review_count: z.coerce.number().int().min(0),
  sales_priority: z.coerce.number().int().min(1).max(3),
  sales_priority_reason: z.string().trim().min(1).max(500),
  scan_center: scanCenterSchema.optional(),
  heatmap_file: z.string().trim().min(1).optional(),
  qualification_status: z.literal("qualified"),
}).strict().superRefine((value, ctx) => {
  if (value.has_website && !value.website_url) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["website_url"], message: "Required when has_website is true" });
  }
  if (!value.has_website && value.website_url) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["website_url"], message: "Must be null when has_website is false" });
  }
  const normalizedPath = value.heatmap_file?.replace(/\\/g, "/");
  if (normalizedPath && (!/^heatmaps\/[A-Za-z0-9._-]+\.(png|jpe?g|webp)$/i.test(normalizedPath) || normalizedPath.includes(".."))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["heatmap_file"],
      message: "Must reference a PNG, JPG, or WebP file directly inside heatmaps/",
    });
  }
});

const auditFirstPayloadSchema = z.object({
  batch: batchSchema,
  prospects: z.array(auditFirstProspectSchema).min(1).max(200),
}).strict();

export function googleMapsUrlFromPlaceId(placeId: string): string {
  const encodedPlaceId = encodeURIComponent(placeId);
  return `https://www.google.com/maps/search/?api=1&query=${encodedPlaceId}&query_place_id=${encodedPlaceId}`;
}

const scaleFirstProspectSchema = z.object({
  place_id: z.string().trim().min(1),
  company_name: z.string().trim().min(1),
  address: z.literal(SAB_ADDRESS_LABEL),
  city: z.string().trim().min(1),
  state: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((value) => value.toUpperCase()),
  zip: z.string().trim().min(1),
  phone: nullableText,
  owner_name: nullableText,
  email: nullableText,
  contact_tag: z.enum(SCALE_FIRST_CONTACT_TAGS),
  google_maps_url: z.string().trim().url().optional(),
  has_website: z.boolean(),
  website_url: nullableUrl,
  website_platform: z.string().nullable().optional().default(null),
  report_key: z.string().trim().regex(/^[a-f0-9]{12,64}$/i, "Must be a Local Falcon report key"),
  report_url: z.string().trim().url(),
  scan_date: z.string().trim().min(1),
  scan_keyword: z.string().trim().min(1),
  scan_spec: scanSpecSchema.optional(),
  arp: z.coerce.number().finite().min(0),
  atrp: z.number().finite().min(1).nullable().optional(),
  solv: z.coerce.number().finite().min(0).max(100),
  rating: z.coerce.number().finite().min(0).max(5),
  review_count: z.coerce.number().int().min(0),
  scan_center: scanCenterSchema.optional(),
  heatmap_file: z.string().trim().min(1).optional(),
  qualification_status: z.literal("qualified"),
}).strict().superRefine((value, ctx) => {
  if (value.has_website && !value.website_url) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["website_url"], message: "Required when has_website is true" });
  }
  if (!value.has_website && value.website_url) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["website_url"], message: "Must be null when has_website is false" });
  }
  if (value.contact_tag === "Email Ready" && !value.email) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "Required when contact_tag is Email Ready" });
  }
  const normalizedPath = value.heatmap_file?.replace(/\\/g, "/");
  if (normalizedPath && (!/^heatmaps\/[A-Za-z0-9._-]+\.(png|jpe?g|webp)$/i.test(normalizedPath) || normalizedPath.includes(".."))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["heatmap_file"],
      message: "Must reference a PNG, JPG, or WebP file directly inside heatmaps/",
    });
  }
}).transform((value) => ({
  ...value,
  google_maps_url: value.google_maps_url ?? googleMapsUrlFromPlaceId(value.place_id),
}));

const scaleFirstPayloadSchema = z.object({
  workflow: z.literal(SCALE_FIRST_WORKFLOW),
  batch: batchSchema,
  prospects: z.array(scaleFirstProspectSchema).min(1).max(200),
}).strict();

export type LocalFalconBatchInput = z.infer<typeof batchSchema>;
export type LocalFalconScanSpec = z.infer<typeof scanSpecSchema>;
export type AuditFirstProspectInput = z.infer<typeof auditFirstProspectSchema>;
export type ScaleFirstProspectInput = z.infer<typeof scaleFirstProspectSchema>;
export type LocalFalconProspectInput = AuditFirstProspectInput | ScaleFirstProspectInput;
export type LocalFalconPayload = z.infer<typeof auditFirstPayloadSchema> | z.infer<typeof scaleFirstPayloadSchema>;

export function getProspectScanSpec(
  payload: LocalFalconPayload,
  prospect: LocalFalconProspectInput,
): LocalFalconScanSpec {
  return "scan_spec" in prospect && prospect.scan_spec
    ? prospect.scan_spec
    : payload.batch.scan_spec;
}

export interface ScaleFirstContactRouting {
  contactTag: ScaleFirstContactTag | null;
  automatedEmailEligible: boolean;
}

export function getScaleFirstContactRouting(
  prospect: LocalFalconProspectInput,
): ScaleFirstContactRouting {
  if (!("contact_tag" in prospect)) {
    return { contactTag: null, automatedEmailEligible: false };
  }
  return {
    contactTag: prospect.contact_tag,
    automatedEmailEligible: prospect.contact_tag === "Email Ready",
  };
}

function crmLocation(prospect: LocalFalconProspectInput) {
  return prospect.scan_center ?? {
    city: prospect.city,
    state: prospect.state,
    zip: prospect.zip,
  };
}

export interface LocalFalconUploadedAsset {
  key: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  manifestPath: string;
  sourceUrl?: string;
  snapshot: {
    key: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
  };
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
  scanSpec: LocalFalconScanSpec;
  outcome: "new" | "variation" | "existing" | "flagged";
  reason?: string;
  matches?: FallbackMatch[];
}

export interface LocalFalconPreviewResult {
  batchId: string;
  market: LocalFalconBatchInput["market"];
  trade: string;
  keyword: string;
  scanSpec: LocalFalconBatchInput["scan_spec"];
  scanSpecs: LocalFalconScanSpec[];
  batchAlreadyImported: boolean;
  newCount: number;
  variationCount: number;
  existingCount: number;
  flaggedCount: number;
  rows: ProspectPreview[];
}

export function isLocalFalconBatchFullyImported(
  existingBatchId: string | undefined,
  rows: ProspectPreview[],
): boolean {
  return Boolean(existingBatchId) && rows.length > 0 && rows.every((row) => row.outcome === "existing");
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

  const isScaleFirst = typeof raw === "object"
    && raw !== null
    && "workflow" in raw
    && (raw as { workflow?: unknown }).workflow === SCALE_FIRST_WORKFLOW;
  const hasUnknownWorkflow = typeof raw === "object"
    && raw !== null
    && "workflow" in raw
    && (raw as { workflow?: unknown }).workflow !== SCALE_FIRST_WORKFLOW;
  if (hasUnknownWorkflow) {
    throw new Error(`workflow: Invalid discriminator; expected ${SCALE_FIRST_WORKFLOW}`);
  }

  const parsed = (isScaleFirst ? scaleFirstPayloadSchema : auditFirstPayloadSchema).safeParse(raw);
  if (!parsed.success) throw new Error(zodMessage(parsed.error));
  assertDate(parsed.data.batch.export_date, "batch.export_date");

  const placeIds = new Set<string>();
  const reportKeys = new Set<string>();
  const heatmapFiles = new Set<string>();
  for (const [index, prospect] of parsed.data.prospects.entries()) {
    assertDate(prospect.scan_date, `prospects.${index}.scan_date`);
    if (prospect.scan_keyword !== parsed.data.batch.keyword) {
      throw new Error(`prospects.${index}.scan_keyword must match batch.keyword`);
    }
    if (placeIds.has(prospect.place_id)) throw new Error(`prospects.${index}.place_id is duplicated inside the batch`);
    if (reportKeys.has(prospect.report_key)) throw new Error(`prospects.${index}.report_key is duplicated inside the batch`);
    if (prospect.heatmap_file && heatmapFiles.has(prospect.heatmap_file)) {
      throw new Error(`prospects.${index}.heatmap_file is referenced more than once`);
    }
    placeIds.add(prospect.place_id);
    reportKeys.add(prospect.report_key);
    if (prospect.heatmap_file) heatmapFiles.add(prospect.heatmap_file);
  }

  return parsed.data;
}

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function isExactStreetAddressMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const normalizedLeft = normalized(left);
  const normalizedRight = normalized(right);

  // SAB imports use labels such as "Service Area Business" in the address
  // field. Requiring a street number prevents those labels, blank values, and
  // city-only placeholders from flagging every SAB in the same market.
  return Boolean(
    normalizedLeft &&
    normalizedRight &&
    /\d/.test(normalizedLeft) &&
    /\d/.test(normalizedRight) &&
    normalizedLeft === normalizedRight
  );
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
    if (isExactStreetAddressMatch(company.address, prospect.address)) reasons.push("exact address");
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

export async function previewLocalFalconImport(
  payload: LocalFalconPayload,
): Promise<LocalFalconPreviewResult> {
  const [existingBatch] = await db.select({ id: localFalconImportBatches.id })
    .from(localFalconImportBatches).where(eq(localFalconImportBatches.batchId, payload.batch.batch_id)).limit(1);
  const placeIds = payload.prospects.map((prospect) => prospect.place_id);
  const reportKeys = payload.prospects.map((prospect) => prospect.report_key);
  const [existingPlaceProfiles, existingReportProfiles] = await Promise.all([
    db.select({
      placeId: localFalconProspectProfiles.placeId,
      leadId: localFalconProspectProfiles.leadId,
      companyName: localFalconProspectProfiles.companyName,
    }).from(localFalconProspectProfiles)
      .where(inArray(localFalconProspectProfiles.placeId, placeIds))
      .orderBy(desc(localFalconProspectProfiles.createdAt)),
    db.select({
      reportKey: localFalconProspectProfiles.reportKey,
      leadId: localFalconProspectProfiles.leadId,
    }).from(localFalconProspectProfiles)
      .where(inArray(localFalconProspectProfiles.reportKey, reportKeys)),
  ]);
  const existingByPlace = new Map<string, { leadId: string; companyName: string | null }>();
  for (const row of existingPlaceProfiles) {
    if (!existingByPlace.has(row.placeId)) {
      existingByPlace.set(row.placeId, { leadId: row.leadId, companyName: row.companyName });
    }
  }
  const existingByReport = new Map(existingReportProfiles.map((row) => [row.reportKey, row.leadId]));

  const rows: ProspectPreview[] = [];
  for (const [index, prospect] of payload.prospects.entries()) {
    const base = {
      row: index + 1,
      placeId: prospect.place_id,
      companyName: prospect.company_name,
      address: prospect.address,
      heatmapFile: prospect.heatmap_file ?? "Official Local Falcon image",
      scanSpec: getProspectScanSpec(payload, prospect),
    };
    const duplicateLeadId = existingByReport.get(prospect.report_key);
    if (duplicateLeadId) {
      rows.push({
        ...base,
        outcome: "existing",
        reason: `This Local Falcon report is already attached to lead ${duplicateLeadId}`,
      });
      continue;
    }
    const existingBusiness = existingByPlace.get(prospect.place_id);
    if (existingBusiness) {
      rows.push({
        ...base,
        outcome: "variation",
        reason: `New scan variation for ${existingBusiness.companyName ?? prospect.company_name}; the existing CRM record will be reused`,
      });
      continue;
    }
    const matches = await existingCompanyMatches(prospect);
    rows.push({ ...base, outcome: matches.length ? "flagged" : "new", matches: matches.length ? matches : undefined });
  }

  const scanSpecs = [...new Map(payload.prospects.map((prospect) => {
    const spec = getProspectScanSpec(payload, prospect);
    return [`${spec.grid_size.toLowerCase().replace("×", "x")}:${spec.radius_miles}`, spec] as const;
  })).values()];

  return {
    batchId: payload.batch.batch_id,
    market: payload.batch.market,
    trade: payload.batch.trade,
    keyword: payload.batch.keyword,
    scanSpec: payload.batch.scan_spec,
    scanSpecs,
    batchAlreadyImported: isLocalFalconBatchFullyImported(existingBatch?.id, rows),
    newCount: rows.filter((row) => row.outcome === "new").length,
    variationCount: rows.filter((row) => row.outcome === "variation").length,
    existingCount: rows.filter((row) => row.outcome === "existing").length,
    flaggedCount: rows.filter((row) => row.outcome === "flagged").length,
    rows,
  };
}

export interface LocalFalconImportResult extends LocalFalconPreviewResult {
  imported: number;
  leadsCreated: number;
  importedLeads: Array<{
    leadId: string;
    opportunityId: string;
    contactId: string | null;
    companyId: string;
    placeId: string;
    createdNewLead: boolean;
    contactTag?: ScaleFirstContactTag;
    automatedEmailEligible?: boolean;
  }>;
}

export async function importLocalFalconPayload(
  payload: LocalFalconPayload,
  importedBy: string,
  assignedTo: string,
  leadClassification: LocalFalconLeadClassification,
  selectedPlaceIds: Set<string>,
  assetsByPlaceId: Map<string, LocalFalconUploadedAsset>,
): Promise<LocalFalconImportResult> {
  const preview = await previewLocalFalconImport(payload);

  const allowedPlaceIds = new Set(
    preview.rows.filter((row) =>
      row.outcome === "new"
      || row.outcome === "variation"
      || (row.outcome === "flagged" && selectedPlaceIds.has(row.placeId)),
    )
      .map((row) => row.placeId),
  );
  if (allowedPlaceIds.size === 0) {
    throw new Error("No new reports were selected for import");
  }
  for (const placeId of allowedPlaceIds) {
    if (!assetsByPlaceId.has(placeId)) throw new Error(`Heatmap upload is missing for Place ID ${placeId}`);
  }

  const transactionResult = await db.transaction(async (tx) => {
    const [existingBatch] = await tx.select().from(localFalconImportBatches)
      .where(eq(localFalconImportBatches.batchId, payload.batch.batch_id)).limit(1);
    let batch = existingBatch;
    if (!batch) {
      [batch] = await tx.insert(localFalconImportBatches).values({
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
    }

    const [status] = await tx.select().from(crmLeadStatuses).where(eq(crmLeadStatuses.slug, "new")).limit(1);
    const [stage] = await tx.select().from(pipelineStages).where(eq(pipelineStages.slug, "new-lead")).limit(1);
    if (!status) throw new Error("CRM status 'new' is not configured");
    if (!stage) throw new Error("Pipeline stage 'new-lead' is not configured");

    const classificationTags = [];
    for (const classification of LOCAL_FALCON_LEAD_CLASSIFICATIONS) {
      const [tag] = await tx.insert(crmTags).values({
        name: classification.label,
        slug: classification.tagSlug,
        color: classification.tagColor,
      }).onConflictDoUpdate({
        target: crmTags.slug,
        set: { name: classification.label, color: classification.tagColor },
      }).returning();
      classificationTags.push(tag);
    }
    const selectedClassification = getLocalFalconLeadClassification(leadClassification);
    const selectedTag = classificationTags.find((tag) => tag.slug === selectedClassification.tagSlug);
    if (!selectedTag) throw new Error(`CRM tag '${selectedClassification.label}' is not configured`);
    const classificationTagIds = classificationTags.map((tag) => tag.id);
    const contactRoutingTags: Array<typeof crmTags.$inferSelect> = [];
    if ("workflow" in payload) {
      for (const contactTag of SCALE_FIRST_CONTACT_TAGS) {
        const [tag] = await tx.insert(crmTags).values({
          name: contactTag,
          slug: contactTag.toLowerCase().replace(/\s+/g, "-"),
          color: contactTag === "Email Ready" ? "#16A34A" : "#D97706",
        }).onConflictDoUpdate({
          target: crmTags.slug,
          set: { name: contactTag },
        }).returning();
        contactRoutingTags.push(tag);
      }
    }
    const contactRoutingTagIds = contactRoutingTags.map((tag) => tag.id);

    const results: LocalFalconImportResult["importedLeads"] = [];
    for (const prospect of payload.prospects) {
      if (!allowedPlaceIds.has(prospect.place_id)) continue;
      const location = crmLocation(prospect);
      const [duplicate] = await tx.select({ id: localFalconProspectProfiles.id })
        .from(localFalconProspectProfiles).where(eq(localFalconProspectProfiles.reportKey, prospect.report_key)).limit(1);
      if (duplicate) continue;
      const asset = assetsByPlaceId.get(prospect.place_id)!;

      const [existingScan] = await tx.select({
        lead: crmLeads,
      }).from(localFalconProspectProfiles)
        .innerJoin(crmLeads, eq(localFalconProspectProfiles.leadId, crmLeads.id))
        .where(eq(localFalconProspectProfiles.placeId, prospect.place_id))
        .orderBy(desc(localFalconProspectProfiles.createdAt))
        .limit(1);

      let company: typeof crmCompanies.$inferSelect;
      let lead: typeof crmLeads.$inferSelect;
      let opportunity: typeof pipelineOpportunities.$inferSelect;
      let contactId: string | null;
      let createdNewLead = false;

      if (existingScan?.lead.companyId) {
        const [existingCompany] = await tx.select().from(crmCompanies)
          .where(eq(crmCompanies.id, existingScan.lead.companyId))
          .limit(1);
        if (!existingCompany) throw new Error(`Existing company was not found for ${prospect.company_name}`);
        [company] = await tx.update(crmCompanies).set({
          address: SAB_ADDRESS_LABEL,
          ...(prospect.scan_center ? {
            city: location.city,
            state: location.state,
            zip: location.zip,
          } : {}),
          updatedAt: new Date(),
        }).where(eq(crmCompanies.id, existingCompany.id)).returning();
        if (prospect.scan_center) {
          [lead] = await tx.update(crmLeads).set({
            city: location.city,
            state: location.state,
            updatedAt: new Date(),
          }).where(eq(crmLeads.id, existingScan.lead.id)).returning();
        } else {
          lead = existingScan.lead;
        }
        contactId = lead.contactId;
        const [existingOpportunity] = await tx.select().from(pipelineOpportunities)
          .where(eq(pipelineOpportunities.leadId, lead.id))
          .limit(1);
        if (existingOpportunity) {
          opportunity = existingOpportunity;
        } else {
          [opportunity] = await tx.insert(pipelineOpportunities).values({
            title: prospect.company_name,
            leadId: lead.id,
            companyId: company.id,
            contactId,
            stageId: stage.id,
            status: "open",
            sourceLeadTitle: prospect.company_name,
            notes: `Local Falcon report ${prospect.report_key}`,
            assignedTo: lead.assignedTo ?? assignedTo,
          }).returning();
        }
      } else {
        [company] = await tx.insert(crmCompanies).values({
          name: prospect.company_name,
          website: prospect.website_url,
          phone: prospect.phone ? normalizePhoneDigits(prospect.phone) : null,
          email: prospect.email,
          address: SAB_ADDRESS_LABEL,
          city: location.city,
          state: location.state,
          zip: location.zip,
          country: "US",
          industry: payload.batch.trade,
          preferredLanguage: "en",
          clientStatus: "prospect",
        }).returning();

        contactId = null;
        if (prospect.owner_name) {
          const parts = prospect.owner_name.split(/\s+/);
          const [contact] = await tx.insert(crmContacts).values({
            companyId: company.id,
            firstName: parts[0],
            lastName: parts.slice(1).join(" ") || null,
            email: prospect.email,
            phone: prospect.phone ? normalizePhoneDigits(prospect.phone) : null,
            title: "Owner",
            preferredLanguage: "en",
            isPrimary: true,
          }).returning();
          contactId = contact.id;
        }

        [lead] = await tx.insert(crmLeads).values({
          companyId: company.id,
          contactId,
          statusId: status.id,
          title: prospect.company_name,
          source: "local_falcon",
          sourceLabel: "Local Falcon / Claude",
          city: location.city,
          state: location.state,
          trade: payload.batch.trade,
          notes: `Qualified Local Falcon prospect · ARP ${prospect.arp}`,
          assignedTo,
        }).returning();

        [opportunity] = await tx.insert(pipelineOpportunities).values({
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
        createdNewLead = true;
      }

      await tx.delete(crmLeadTags).where(and(
        eq(crmLeadTags.leadId, lead.id),
        inArray(crmLeadTags.tagId, classificationTagIds),
      ));
      await tx.insert(crmLeadTags).values({ leadId: lead.id, tagId: selectedTag.id });

      const contactRouting = getScaleFirstContactRouting(prospect);
      if (contactRouting.contactTag) {
        const contactRoutingTag = contactRoutingTags.find((tag) => tag.name === contactRouting.contactTag);
        if (!contactRoutingTag) throw new Error(`CRM tag '${contactRouting.contactTag}' is not configured`);
        await tx.delete(crmLeadTags).where(and(
          eq(crmLeadTags.leadId, lead.id),
          inArray(crmLeadTags.tagId, contactRoutingTagIds),
        ));
        await tx.insert(crmLeadTags).values({ leadId: lead.id, tagId: contactRoutingTag.id });
      }

      await tx.insert(localFalconProspectProfiles).values({
        batchRecordId: batch.id,
        leadId: lead.id,
        placeId: prospect.place_id,
        companyName: prospect.company_name,
        address: SAB_ADDRESS_LABEL,
        city: prospect.city,
        state: prospect.state,
        zip: prospect.zip,
        scanCenterLat: prospect.scan_center ? String(prospect.scan_center.lat) : null,
        scanCenterLng: prospect.scan_center ? String(prospect.scan_center.lng) : null,
        scanCity: prospect.scan_center?.city ?? null,
        scanState: prospect.scan_center?.state ?? null,
        scanZip: prospect.scan_center?.zip ?? null,
        phone: prospect.phone ? normalizePhoneDigits(prospect.phone) : null,
        ownerName: prospect.owner_name,
        googleMapsUrl: prospect.google_maps_url,
        hasWebsite: prospect.has_website,
        websiteUrl: prospect.website_url,
        websitePlatform: prospect.website_platform,
        servicePageCount: "service_page_count" in prospect ? prospect.service_page_count : null,
        websiteAnalysis: "website_analysis" in prospect ? prospect.website_analysis : null,
        reviewsAnalysis: "reviews_analysis" in prospect ? prospect.reviews_analysis : null,
        reportKey: prospect.report_key,
        reportUrl: prospect.report_url,
        scanDate: new Date(prospect.scan_date),
        scanKeyword: prospect.scan_keyword,
        scanGridSize: getProspectScanSpec(payload, prospect).grid_size,
        scanRadiusMiles: String(getProspectScanSpec(payload, prospect).radius_miles),
        qualificationStatus: prospect.qualification_status,
        heatmapFile: prospect.heatmap_file ?? null,
        heatmapSourceUrl: asset.sourceUrl ?? null,
        heatmapStorageKey: asset.key,
        heatmapOriginalName: asset.originalName,
        heatmapMimeType: asset.mimeType,
        heatmapSizeBytes: asset.sizeBytes,
        heatmapSha256: asset.sha256,
        snapshotStorageKey: asset.snapshot.key,
        snapshotOriginalName: asset.snapshot.originalName,
        snapshotMimeType: asset.snapshot.mimeType,
        snapshotSizeBytes: asset.snapshot.sizeBytes,
        snapshotSha256: asset.snapshot.sha256,
        snapshotGeneratedAt: new Date(),
        arp: String(prospect.arp),
        atrp: prospect.atrp == null ? null : String(prospect.atrp),
        solv: String(prospect.solv),
        rating: String(prospect.rating),
        reviewCount: prospect.review_count,
        tier: "sales_priority" in prospect ? String(prospect.sales_priority) : null,
        pitchType: "sales_priority" in prospect ? "website" : null,
        pitchSummary: "sales_priority_reason" in prospect ? prospect.sales_priority_reason : null,
      });

      results.push({
        leadId: lead.id,
        opportunityId: opportunity.id,
        contactId,
        companyId: company.id,
        placeId: prospect.place_id,
        createdNewLead,
        ...(contactRouting.contactTag ? {
          contactTag: contactRouting.contactTag,
          automatedEmailEligible: contactRouting.automatedEmailEligible,
        } : {}),
      });
    }
    return { importedLeads: results };
  });

  const { importedLeads } = transactionResult;
  return {
    ...preview,
    imported: importedLeads.length,
    leadsCreated: importedLeads.filter((row) => row.createdNewLead).length,
    importedLeads,
  };
}

export async function getLocalFalconProfileForLead(leadId: string) {
  const [result] = await db.select({
    profile: localFalconProspectProfiles,
    batch: localFalconImportBatches,
  })
    .from(localFalconProspectProfiles)
    .innerJoin(localFalconImportBatches, eq(localFalconProspectProfiles.batchRecordId, localFalconImportBatches.id))
    .where(eq(localFalconProspectProfiles.leadId, leadId))
    .orderBy(desc(localFalconProspectProfiles.scanDate))
    .limit(1);
  return result ?? null;
}

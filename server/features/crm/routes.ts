import express, { Router } from "express";
import multer from "multer";
import crypto from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { REPORT_OUTREACH_TASKS, reportSendBlockedReason } from "@shared/reportOutreach";
import { REPORT_OUTREACH_FILTERS } from "@shared/reportOutreach";
import { getReportOutreachState, getReportOutreachStates } from "./reportOutreach";
import { requireRole } from "../auth/middleware";
import { logAudit } from "../audit/service";
import { notifyLeadAssignment } from "../notifications/triggers";
import { appendHistorySafe } from "../history/service";
import * as crmStorage from "./storage";
import * as pipelineStorage from "../pipeline/storage";
import * as taskStorage from "../tasks/storage";
import { normalizePhoneDigits, isValidUSPhone } from "@shared/phone";
import {
  exportLeadsToCSV, exportContactsToCSV,
  importLeadsFromCSV, importContactsFromCSV,
} from "./csvImportExport";
import {
  getProspectScanSpec,
  isDeliverableProspect,
  isNoVisibilityProspect,
  getLocalFalconProfileForLead,
  getLocalFalconCrmOnlyForLead,
  importLocalFalconPayload,
  previewLocalFalconImport,
  type DeliverableProspectInput,
  type LocalFalconPayload,
  type LocalFalconUploadedAsset,
} from "./localFalconImport";
import {
  LocalFalconImageFetchError,
  LOCAL_FALCON_PACKAGE_MAX_BYTES,
  cacheVerifiedHeatmap,
  localFalconManifestSha256,
  parseLocalFalconManifest,
  parseLocalFalconPackage,
  parseSingleLocalFalconHeatmap,
  resolveVerifiedHeatmap,
  type IncomingPackageFile,
  type VerifiedHeatmapAssetRef,
} from "./localFalconPackage";
import {
  formatLocalVisibilityAveragePosition,
  formatLocalVisibilityReportAddress,
  getLocalFalconMapPresentation,
  resolveLocalVisibilityMarket,
} from "@shared/localVisibility";
import { hydrateReportAtrp } from "../local-visibility/metrics";
import {
  LOCAL_FALCON_LEAD_CLASSIFICATION_VALUES,
  type LocalFalconLeadClassification,
} from "@shared/leadClassification";
import {
  insertCrmCompanySchema, insertCrmContactSchema, insertCrmLeadSchema,
  insertCrmLeadNoteSchema, insertCrmTagSchema, crmCompanies, crmContacts, crmLeads,
  localFalconProspectProfiles, pipelineOpportunities, followupTasks, scanReportDeliveries,
} from "@shared/schema";
import { db } from "../../db";
import { executeStageAutomations } from "../automations/trigger";
import * as storageService from "../../services/storage";
import {
  DEFAULT_SCAN_REPORT_PREHEADER,
  DEFAULT_SCAN_REPORT_TEMPLATE_KEY,
  confirmManualScanReportEmail,
  getScanReportEmailPreview,
  prepareManualScanReportEmail,
  prepareScanReportShare,
} from "./scanReportEmail";

async function cascadeCompanyNameToTitles(companyId: string, oldName: string, newName: string) {
  const leads = await db.select({ id: crmLeads.id, title: crmLeads.title })
    .from(crmLeads).where(eq(crmLeads.companyId, companyId));
  for (const lead of leads) {
    if (lead.title && lead.title.includes(oldName)) {
      await db.update(crmLeads).set({ title: lead.title.replace(oldName, newName) }).where(eq(crmLeads.id, lead.id));
    }
  }
  const opps = await db.select({ id: pipelineOpportunities.id, title: pipelineOpportunities.title, sourceLeadTitle: pipelineOpportunities.sourceLeadTitle })
    .from(pipelineOpportunities).where(eq(pipelineOpportunities.companyId, companyId));
  for (const opp of opps) {
    const updates: Record<string, string> = {};
    if (opp.title.includes(oldName)) updates.title = opp.title.replace(oldName, newName);
    if (opp.sourceLeadTitle?.includes(oldName)) updates.sourceLeadTitle = opp.sourceLeadTitle.replace(oldName, newName);
    if (Object.keys(updates).length > 0) {
      await db.update(pipelineOpportunities).set(updates).where(eq(pipelineOpportunities.id, opp.id));
    }
  }
}

async function cascadeContactNameToTitles(contactId: string, oldFullName: string, newFullName: string) {
  if (oldFullName === newFullName) return;
  const leads = await db.select({ id: crmLeads.id, title: crmLeads.title })
    .from(crmLeads).where(eq(crmLeads.contactId, contactId));
  for (const lead of leads) {
    if (lead.title && lead.title.includes(oldFullName)) {
      await db.update(crmLeads).set({ title: lead.title.replace(oldFullName, newFullName) }).where(eq(crmLeads.id, lead.id));
    }
  }
  const opps = await db.select({ id: pipelineOpportunities.id, title: pipelineOpportunities.title, sourceLeadTitle: pipelineOpportunities.sourceLeadTitle })
    .from(pipelineOpportunities).where(eq(pipelineOpportunities.contactId, contactId));
  for (const opp of opps) {
    const updates: Record<string, string> = {};
    if (opp.title.includes(oldFullName)) updates.title = opp.title.replace(oldFullName, newFullName);
    if (opp.sourceLeadTitle?.includes(oldFullName)) updates.sourceLeadTitle = opp.sourceLeadTitle.replace(oldFullName, newFullName);
    if (Object.keys(updates).length > 0) {
      await db.update(pipelineOpportunities).set(updates).where(eq(pipelineOpportunities.id, opp.id));
    }
  }
}

const updateCrmLeadSchema = z.object({
  title: z.string().min(1).optional(),
  companyId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
  statusId: z.string().nullable().optional(),
  value: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  sourceLabel: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().regex(/^[A-Z]{2}$/).nullable().optional(),
  timezone: z.string().nullable().optional(),
  sellerProfileUrl: z.string().url().nullable().optional(),
  adUrl: z.string().url().nullable().optional(),
}).strict();

const updateCrmCompanySchema = z.object({
  name: z.string().min(1).optional(),
  dba: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zip: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  preferredLanguage: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
}).strict();

const updateCrmContactSchema = z.object({
  companyId: z.string().nullable().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  altPhone: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  preferredLanguage: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
}).strict();

const tagIdsSchema = z.object({
  tagIds: z.array(z.string()).optional().default([]),
});

const bulkIdsSchema = z.object({
  ids: z.array(z.string()).min(1, "At least one lead required").max(200, "Maximum 200 leads at once"),
});

const bulkAssignSchema = bulkIdsSchema.extend({
  assignedTo: z.string().nullable(),
});

const bulkStatusSchema = bulkIdsSchema.extend({
  statusId: z.string().nullable(),
});

const bulkTagsSchema = bulkIdsSchema.extend({
  tagIds: z.array(z.string()).min(1, "At least one tag required"),
});

const scanReportEmailSchema = z.object({
  reportId: z.string().min(1),
  recipient: z.string().trim().email(),
  subject: z.string().trim().min(1).max(200),
  preheader: z.string().trim().min(1).max(200).default(DEFAULT_SCAN_REPORT_PREHEADER),
  message: z.string().trim().min(1).max(5_000),
  templateKey: z.string().trim().regex(/^[A-Z]$/).default(DEFAULT_SCAN_REPORT_TEMPLATE_KEY),
  imagePlacement: z.enum(["after_intro", "after_message"]).default("after_intro"),
  requestId: z.string().uuid(),
}).strict();
const confirmManualScanReportEmailSchema = scanReportEmailSchema.extend({
  confirmed: z.literal(true),
});

const router = Router();

// ── Ownership helpers ────────────────────────────────────────────────────────
// Roles that are restricted to their own assigned records.
function isRestricted(req: express.Request): boolean {
  const role = req.authUser?.role;
  return role === "sales_rep" || role === "lead_gen";
}

function stripSensitiveLeadFields<T extends { sellerProfileUrl?: string | null; adUrl?: string | null }>(lead: T, req: express.Request): T {
  if (req.authUser?.role === "sales_rep") {
    return { ...lead, sellerProfileUrl: null, adUrl: null };
  }
  return lead;
}

// Returns true if access is allowed, false (+ sends 403) if not.
async function assertLeadAccess(
  req: express.Request,
  res: express.Response,
  leadId: string,
): Promise<boolean> {
  if (!isRestricted(req)) return true;
  const lead = await crmStorage.getLeadById(leadId);
  if (!lead || lead.assignedTo !== req.authUser!.id) {
    res.status(403).json({ message: "Access denied" });
    return false;
  }
  return true;
}
// ─────────────────────────────────────────────────────────────────────────────

router.get("/leads", requireRole("admin", "developer", "sales_rep", "lead_gen"), async (req, res) => {
  try {
    const { search, statusId, source, assignedTo, tagId, tagIds, fromWebsiteForm, reportOutreach, page, limit } = req.query;
    const parsedTags = z.object({
      tagId: z.string().min(1).optional(),
      tagIds: z.union([z.string().min(1), z.array(z.string().min(1)).max(100)]).optional(),
    }).safeParse({ tagId, tagIds });
    if (!parsedTags.success) return res.status(400).json({ message: "Invalid tag filters" });
    const parsedOutreach = z.enum(REPORT_OUTREACH_FILTERS).optional().safeParse(reportOutreach);
    if (!parsedOutreach.success) return res.status(400).json({ message: "Invalid report outreach filter" });
    // Restricted roles can only see their own leads — ignore any client-supplied filter.
    const resolvedAssignedTo = isRestricted(req)
      ? req.authUser!.id
      : (assignedTo as string | undefined);
    const result = await crmStorage.getLeads({
      search: search as string | undefined,
      statusId: statusId as string | undefined,
      source: source as string | undefined,
      assignedTo: resolvedAssignedTo,
      tagId: parsedTags.data.tagId,
      tagIds: typeof parsedTags.data.tagIds === "string" ? [parsedTags.data.tagIds] : parsedTags.data.tagIds,
      fromWebsiteForm: fromWebsiteForm === "true" ? true : fromWebsiteForm === "false" ? false : undefined,
      reportOutreach: parsedOutreach.data,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    const [outreach, enriched] = await Promise.all([
      getReportOutreachStates(result.items.map(lead => lead.id), db, true), crmStorage.enrichLeads(result.items),
    ]);
    const leads = enriched.map(l => ({
      ...stripSensitiveLeadFields(l, req), ...outreach.get(l.id),
    }));
    res.json({ leads, total: result.total, page: result.page, pageSize: result.limit });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/leads/:id/navigation", requireRole("admin", "developer", "sales_rep", "lead_gen"), async (req, res) => {
  try {
    const { search, statusId, source, assignedTo, tagId, tagIds, fromWebsiteForm, reportOutreach } = req.query;
    const parsedTags = z.object({
      tagId: z.string().min(1).optional(),
      tagIds: z.union([z.string().min(1), z.array(z.string().min(1)).max(100)]).optional(),
    }).safeParse({ tagId, tagIds });
    if (!parsedTags.success) return res.status(400).json({ message: "Invalid tag filters" });
    const parsedOutreach = z.enum(REPORT_OUTREACH_FILTERS).optional().safeParse(reportOutreach);
    if (!parsedOutreach.success) return res.status(400).json({ message: "Invalid report outreach filter" });

    const navigation = await crmStorage.getLeadNavigation(
      req.params.id as string,
      {
        search: search as string | undefined,
        statusId: statusId as string | undefined,
        source: source as string | undefined,
        assignedTo: isRestricted(req) ? req.authUser!.id : assignedTo as string | undefined,
        tagId: parsedTags.data.tagId,
        tagIds: typeof parsedTags.data.tagIds === "string" ? [parsedTags.data.tagIds] : parsedTags.data.tagIds,
        fromWebsiteForm: fromWebsiteForm === "true" ? true : fromWebsiteForm === "false" ? false : undefined,
        reportOutreach: parsedOutreach.data,
      },
    );
    if (!navigation) return res.status(404).json({ message: "Lead not found" });
    res.json(navigation);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/leads", requireRole("admin", "developer", "lead_gen"), async (req, res) => {
  try {
    const data = insertCrmLeadSchema.parse(req.body);
    const lead = await crmStorage.createLead(data);
    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "crm_lead",
      entityId: lead.id,
      metadata: { title: lead.title },
      ipAddress: req.ip,
    });
    res.status(201).json(lead);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/leads/assignable-users", requireRole("admin", "developer", "sales_rep", "lead_gen"), async (_req, res) => {
  try {
    const users = await crmStorage.getAssignableUsers();
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/leads/bulk/assign", requireRole("admin", "developer"), async (req, res) => {
  try {
    const { ids, assignedTo } = bulkAssignSchema.parse(req.body);
    const count = await crmStorage.bulkAssignLeads(ids, assignedTo);
    await pipelineStorage.bulkAssignOpportunitiesByLeadIds(ids, assignedTo);
    await taskStorage.syncOpenTaskOwnershipForLeadIds(ids, assignedTo);
    await logAudit({
      userId: req.authUser?.id,
      action: "bulk_assign",
      entity: "crm_lead",
      entityId: "bulk",
      metadata: { leadIds: ids, assignedTo, count },
      ipAddress: req.ip,
    });
    res.json({ updated: count });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/leads/bulk/status", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const { ids, statusId } = bulkStatusSchema.parse(req.body);
    const count = await crmStorage.bulkUpdateLeadStatus(ids, statusId);
    await logAudit({
      userId: req.authUser?.id,
      action: "bulk_status",
      entity: "crm_lead",
      entityId: "bulk",
      metadata: { leadIds: ids, statusId, count },
      ipAddress: req.ip,
    });
    res.json({ updated: count });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/leads/bulk/tags/add", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const { ids, tagIds } = bulkTagsSchema.parse(req.body);
    await crmStorage.bulkAddTagsToLeads(ids, tagIds);
    await logAudit({
      userId: req.authUser?.id,
      action: "bulk_tags_add",
      entity: "crm_lead",
      entityId: "bulk",
      metadata: { leadIds: ids, tagIds, count: ids.length },
      ipAddress: req.ip,
    });
    res.json({ updated: ids.length });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/leads/bulk/tags/remove", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const { ids, tagIds } = bulkTagsSchema.parse(req.body);
    await crmStorage.bulkRemoveTagsFromLeads(ids, tagIds);
    await logAudit({
      userId: req.authUser?.id,
      action: "bulk_tags_remove",
      entity: "crm_lead",
      entityId: "bulk",
      metadata: { leadIds: ids, tagIds, count: ids.length },
      ipAddress: req.ip,
    });
    res.json({ updated: ids.length });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/leads/bulk/delete", requireRole("admin"), async (req, res) => {
  try {
    const { ids } = bulkIdsSchema.parse(req.body);
    const count = await crmStorage.bulkDeleteLeads(ids);
    await logAudit({
      userId: req.authUser?.id,
      action: "bulk_delete",
      entity: "crm_lead",
      entityId: "bulk",
      metadata: { leadIds: ids, count },
      ipAddress: req.ip,
    });
    res.json({ deleted: count });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/leads/export-csv", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const csv = await exportLeadsToCSV(req.authUser?.role === "sales_rep");
    const date = new Date().toISOString().split("T")[0];
    await logAudit({
      userId: req.authUser?.id,
      action: "export",
      entity: "crm_lead",
      entityId: "csv",
      metadata: { date },
      ipAddress: req.ip,
    });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="leads-${date}.csv"`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post(
  "/leads/import-csv",
  requireRole("admin", "developer", "sales_rep"),
  express.text({ limit: "5mb" }),
  async (req, res) => {
    try {
      const csvText = req.body as string;
      if (!csvText || typeof csvText !== "string" || csvText.trim().length === 0) {
        return res.status(400).json({ message: "Request body must be a non-empty CSV text" });
      }
      const result = await importLeadsFromCSV(csvText);
      await logAudit({
        userId: req.authUser?.id,
        action: "import",
        entity: "crm_lead",
        entityId: "csv",
        metadata: {
          imported: result.imported,
          skipped: result.skipped,
          errors: result.errors,
        },
        ipAddress: req.ip,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
);

const localFalconPackageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LOCAL_FALCON_PACKAGE_MAX_BYTES, files: 4001 },
});

const localFalconPackageFields = localFalconPackageUpload.fields([
  { name: "package", maxCount: 1 },
  { name: "heatmaps", maxCount: 2000 },
  { name: "snapshots", maxCount: 2000 },
]);

function packageFiles(req: express.Request): {
  primary: IncomingPackageFile;
  supplemental: IncomingPackageFile[];
} {
  const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
  const primaryFile = files.package?.[0];
  if (!primaryFile) throw new Error("Upload one ZIP package or JSON manifest");
  return {
    primary: { buffer: primaryFile.buffer, originalName: primaryFile.originalname, mimeType: primaryFile.mimetype },
    supplemental: (files.heatmaps ?? []).map((file) => ({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    })),
  };
}

function sendLocalFalconImportError(res: express.Response, error: any) {
  if (error instanceof LocalFalconImageFetchError) {
    return res.status(422).json({
      code: error.code,
      message: error.message,
      failures: error.failures,
    });
  }
  return res.status(error?.code === "LIMIT_FILE_SIZE" ? 413 : error?.statusCode ?? 400)
    .json({ message: error.message });
}

function localFalconReportData(
  payload: LocalFalconPayload,
  prospect: DeliverableProspectInput,
  heatmapImageUrl: string,
) {
  return {
    businessName: prospect.company_name,
    address: formatLocalVisibilityReportAddress({
      address: prospect.address,
      city: prospect.city,
      state: prospect.state,
      zip: prospect.zip,
    }),
    rating: String(prospect.rating),
    reviewCount: String(prospect.review_count),
    searchPhrase: prospect.scan_keyword,
    market: resolveLocalVisibilityMarket({
      scanCity: prospect.scan_center?.city,
      scanState: prospect.scan_center?.state,
      prospectCity: prospect.city,
      prospectState: prospect.state,
      batchCity: payload.batch.market.city,
      batchState: payload.batch.market.state,
    }).label,
    averagePosition: formatLocalVisibilityAveragePosition(prospect.atrp),
    gridSize: getProspectScanSpec(payload, prospect).grid_size,
    radius: String(getProspectScanSpec(payload, prospect).radius_miles),
    heatmapImageUrl,
  };
}

router.post(
  "/leads/import-local-falcon/preview",
  requireRole("admin", "developer"),
  localFalconPackageFields,
  async (req, res) => {
    try {
      const { primary, supplemental } = packageFiles(req);
      if (primary.originalName.toLowerCase().endsWith(".json")) {
        const payload = parseLocalFalconManifest(primary);
        const manifestSha256 = localFalconManifestSha256(primary);
        const preview = await previewLocalFalconImport(payload);
        return res.json({
          ...preview,
          manifestSha256,
          sourceMode: supplemental.length ? "fallback" : "local_falcon",
          rows: preview.rows.map((row) => {
            const prospect = payload.prospects.find((candidate) => candidate.place_id === row.placeId)!;
            if (isNoVisibilityProspect(prospect)) return {
              ...row, heatmapPreviewDataUrl: null, heatmapSha256: null, heatmapSourceUrl: null,
              mapPresentation: null, reportData: null,
            };
            return {
              ...row, heatmapPreviewDataUrl: null, heatmapSha256: null, heatmapSourceUrl: null,
              mapPresentation: null, reportData: localFalconReportData(payload, prospect, ""),
            };
          }),
        });
      }
      const parsedPackage = await parseLocalFalconPackage(primary, supplemental, fetch);
      const manifestSha256 = localFalconManifestSha256(primary);
      await hydrateReportAtrp(parsedPackage.payload.prospects.filter(isDeliverableProspect));
      const preview = await previewLocalFalconImport(parsedPackage.payload);
      res.json({
        ...preview,
        manifestSha256,
        sourceMode: parsedPackage.sourceMode,
        rows: preview.rows.map((row) => {
          const prospect = parsedPackage.payload.prospects.find((candidate) => candidate.place_id === row.placeId)!;
          if (isNoVisibilityProspect(prospect)) return {
            ...row, heatmapPreviewDataUrl: null, heatmapSha256: null, heatmapSourceUrl: null,
            mapPresentation: null, reportData: null,
          };
          const heatmap = parsedPackage.heatmapsByPlaceId.get(row.placeId)!;
          const verifiedAsset = cacheVerifiedHeatmap(manifestSha256, prospect, heatmap);
          return {
            ...row,
            heatmapPreviewDataUrl: heatmap.previewDataUrl,
            heatmapSha256: heatmap.sha256,
            heatmapSourceUrl: heatmap.sourceUrl ?? null,
            mapSourceType: heatmap.sourceUrl ? "official" : "fallback",
            verifiedAsset,
            mapPresentation: getLocalFalconMapPresentation(
              !!heatmap.sourceUrl,
              getProspectScanSpec(parsedPackage.payload, prospect).radius_miles,
            ),
            reportData: localFalconReportData(parsedPackage.payload, prospect, heatmap.previewDataUrl),
          };
        }),
      });
    } catch (error: any) {
      sendLocalFalconImportError(res, error);
    }
  },
);

router.post(
  "/leads/import-local-falcon/preview-map",
  requireRole("admin", "developer"),
  localFalconPackageFields,
  async (req, res) => {
    try {
      const { primary, supplemental } = packageFiles(req);
      const placeId = z.string().trim().min(1).parse(req.body.placeId);
      const { payload, heatmap } = await parseSingleLocalFalconHeatmap(
        primary,
        supplemental,
        placeId,
        fetch,
      );
      const prospect = payload.prospects.find((candidate) => candidate.place_id === placeId);
      if (!prospect || !isDeliverableProspect(prospect)) throw new Error(`Place ID ${placeId} has no deliverable map`);
      await hydrateReportAtrp([prospect]);
      const manifestSha256 = localFalconManifestSha256(primary);
      const verifiedAsset = cacheVerifiedHeatmap(manifestSha256, prospect, heatmap);
      return res.json({
        placeId,
        heatmapPreviewDataUrl: heatmap.previewDataUrl,
        heatmapSha256: heatmap.sha256,
        heatmapSourceUrl: heatmap.sourceUrl ?? null,
        mapSourceType: heatmap.sourceUrl ? "official" : "fallback",
        verifiedAsset,
        averagePosition: formatLocalVisibilityAveragePosition(prospect.atrp),
        mapPresentation: getLocalFalconMapPresentation(
          !!heatmap.sourceUrl,
          getProspectScanSpec(payload, prospect).radius_miles,
        ),
      });
    } catch (error: any) {
      return sendLocalFalconImportError(res, error);
    }
  },
);

router.post(
  "/leads/import-local-falcon/confirm",
  requireRole("admin", "developer"),
  localFalconPackageFields,
  async (req, res) => {
    const uploadedKeys: string[] = [];
    try {
      if (req.body.reportMetric !== "ATRP") {
        return res.status(409).json({ message: "Reload and review the import using the all-point ATRP report before confirming." });
      }
      const assignedTo = z.string().optional().default("").parse(req.body.assignedTo);
      const leadClassification = z.enum(LOCAL_FALCON_LEAD_CLASSIFICATION_VALUES).parse(
        req.body.leadClassification,
      ) as LocalFalconLeadClassification;
      const approvedFlagged = z.array(z.string()).parse(JSON.parse(req.body.approvedFlaggedPlaceIds || "[]"));
      const previewHeatmapChecksums = z.record(
        z.string(),
        z.string().regex(/^[a-f0-9]{64}$/),
      ).parse(JSON.parse(req.body.previewHeatmapChecksums || "{}"));
      const verifiedMapAssets = z.record(
        z.string(),
        z.object({
          manifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
          reportKey: z.string().trim().min(1),
          heatmapSha256: z.string().regex(/^[a-f0-9]{64}$/),
        }).strict(),
      ).parse(JSON.parse(req.body.verifiedMapAssets || "{}")) as Record<string, VerifiedHeatmapAssetRef>;

      const { primary } = packageFiles(req);
      const payload = parseLocalFalconManifest(primary);
      const manifestSha256 = localFalconManifestSha256(primary);
      await hydrateReportAtrp(payload.prospects.filter(isDeliverableProspect));
      const preview = await previewLocalFalconImport(payload);
      const heatmapsByPlaceId = new Map();
      for (const row of preview.rows.filter((candidate) => candidate.prospectOutcome !== "no_visibility_core_found")) {
        const prospect = payload.prospects.find((candidate) => candidate.place_id === row.placeId);
        const reference = verifiedMapAssets[row.placeId];
        if (!prospect || !isDeliverableProspect(prospect) || !reference) {
          throw new Error(`The verified map for ${row.companyName} is missing or expired. Review the preview again.`);
        }
        heatmapsByPlaceId.set(row.placeId, resolveVerifiedHeatmap(reference, {
          manifestSha256,
          reportKey: prospect.report_key,
          placeId: row.placeId,
        }));
      }
      const approvedFlaggedSet = new Set(approvedFlagged);
      const confirmedCrmOnly = new Set(z.array(z.string()).parse(JSON.parse(req.body.confirmedCrmOnlyPlaceIds || "[]")));
      const selectedRows = preview.rows.filter(
        (row) =>
          row.outcome === "new"
          || row.outcome === "variation"
          || (row.outcome === "flagged" && approvedFlaggedSet.has(row.placeId)),
      );
      if (selectedRows.length === 0) {
        throw new Error("No new leads or scan reports were selected for import");
      }
      for (const row of selectedRows.filter((row) => row.prospectOutcome === "no_visibility_core_found")) {
        if (!confirmedCrmOnly.has(row.placeId)) throw new Error(`Review and confirm the CRM-only market reference for ${row.companyName} before importing.`);
      }
      if (selectedRows.length > 0) {
        const assignableUsers = await crmStorage.getAssignableUsers();
        const setter = assignableUsers.find((candidate) => candidate.id === assignedTo && candidate.role === "sales_rep");
        if (!setter) return res.status(400).json({ message: "Select an active appointment setter before importing" });
      }
      const requestFiles = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
      const snapshotsByPlaceId = new Map(
        (requestFiles.snapshots ?? []).map((snapshot) => [
          snapshot.originalname.replace(/\.png$/i, ""),
          snapshot,
        ]),
      );
      for (const row of selectedRows.filter((row) => row.prospectOutcome !== "no_visibility_core_found")) {
        const confirmedChecksum = previewHeatmapChecksums[row.placeId];
        const currentChecksum = heatmapsByPlaceId.get(row.placeId)?.sha256;
        if (!confirmedChecksum || confirmedChecksum !== currentChecksum) {
          throw new Error(`The Local Falcon image changed for ${row.companyName}. Review the framed preview again before importing.`);
        }
        const snapshot = snapshotsByPlaceId.get(row.placeId);
        if (!snapshot || snapshot.mimetype !== "image/png") {
          throw new Error(`The finished snapshot is missing for ${row.companyName}. Review the preview and try again.`);
        }
        const metadata = await sharp(snapshot.buffer).metadata();
        if (metadata.width !== 1080 || metadata.height !== 1920) {
          throw new Error(`The finished snapshot for ${row.companyName} must be 1080 × 1920.`);
        }
      }

      const assetsByPlaceId = new Map<string, LocalFalconUploadedAsset>();
      for (const row of selectedRows.filter((row) => row.prospectOutcome !== "no_visibility_core_found")) {
        const heatmap = heatmapsByPlaceId.get(row.placeId);
        if (!heatmap) throw new Error(`Heatmap missing for ${row.companyName}`);
        const upload = await storageService.uploadFile(
          heatmap.buffer,
          heatmap.originalName,
          heatmap.mimeType,
          "local-falcon",
        );
        uploadedKeys.push(upload.key);
        const snapshotFile = snapshotsByPlaceId.get(row.placeId)!;
        const snapshotUpload = await storageService.uploadFile(
          snapshotFile.buffer,
          `${row.placeId}-local-visibility-snapshot.png`,
          "image/png",
          "local-visibility-snapshots",
        );
        uploadedKeys.push(snapshotUpload.key);
        assetsByPlaceId.set(row.placeId, {
          key: upload.key,
          originalName: upload.originalName,
          mimeType: upload.mimeType,
          sizeBytes: upload.sizeBytes,
          sha256: heatmap.sha256,
          manifestPath: heatmap.manifestPath,
          sourceUrl: heatmap.sourceUrl,
          snapshot: {
            key: snapshotUpload.key,
            originalName: snapshotUpload.originalName,
            mimeType: snapshotUpload.mimeType,
            sizeBytes: snapshotUpload.sizeBytes,
            sha256: crypto.createHash("sha256").update(snapshotFile.buffer).digest("hex"),
          },
        });
      }

      const selectedPlaceIds = new Set(selectedRows.map((row) => row.placeId));
      const result = await importLocalFalconPayload(
        payload,
        req.authUser!.id,
        assignedTo,
        leadClassification,
        selectedPlaceIds,
        assetsByPlaceId,
      );

      const importedPlaceIds = new Set(result.importedLeads.map((lead) => lead.placeId));
      for (const [placeId, asset] of assetsByPlaceId) {
        if (!importedPlaceIds.has(placeId)) {
          await storageService.deleteFile(asset.key).catch(() => undefined);
          await storageService.deleteFile(asset.snapshot.key).catch(() => undefined);
          const index = uploadedKeys.indexOf(asset.key);
          if (index >= 0) uploadedKeys.splice(index, 1);
          const snapshotIndex = uploadedKeys.indexOf(asset.snapshot.key);
          if (snapshotIndex >= 0) uploadedKeys.splice(snapshotIndex, 1);
        }
      }

      let tasksCreated = 0;
      let automationErrors = 0;
      for (const imported of result.importedLeads) {
        // CRM-only leads retain manual follow-up but never trigger automatic scan outreach.
        if (!imported.createdNewLead || imported.prospectOutcome === "no_visibility_core_found") continue;
        const automation = await executeStageAutomations({
          opportunityId: imported.opportunityId,
          leadId: imported.leadId,
          contactId: imported.contactId,
          companyId: imported.companyId,
          assignedTo,
          stageSlug: "new-lead",
          actorId: req.authUser!.id,
        });
        tasksCreated += automation.tasksCreated;
        automationErrors += automation.errors;
        try { notifyLeadAssignment({ id: imported.leadId, title: payload.prospects.find((p) => p.place_id === imported.placeId)?.company_name ?? "Local Falcon lead" }, assignedTo); } catch (_) {}
      }

      await logAudit({
        userId: req.authUser?.id,
        action: "import",
        entity: "local_falcon_batch",
        entityId: result.batchId,
        metadata: {
          imported: result.imported,
          existing: result.existingCount,
          flagged: result.flaggedCount,
          assignedTo,
          leadClassification,
          tasksCreated,
          automationErrors,
        },
        ipAddress: req.ip,
      });
      uploadedKeys.length = 0;
      res.json({ ...result, tasksCreated, automationErrors });
    } catch (error: any) {
      await Promise.all(uploadedKeys.map((key) => storageService.deleteFile(key).catch(() => undefined)));
      sendLocalFalconImportError(res, error);
    }
  },
);

// ── Manual Lead Creation ─────────────────────────────────────────────

const US_STATE_TIMEZONES: Record<string, string> = {
  AL: "America/Chicago",    AK: "America/Anchorage",  AZ: "America/Phoenix",
  AR: "America/Chicago",    CA: "America/Los_Angeles", CO: "America/Denver",
  CT: "America/New_York",   DE: "America/New_York",   FL: "America/New_York",
  GA: "America/New_York",   HI: "Pacific/Honolulu",   ID: "America/Denver",
  IL: "America/Chicago",    IN: "America/Indiana/Indianapolis", IA: "America/Chicago",
  KS: "America/Chicago",    KY: "America/New_York",   LA: "America/Chicago",
  ME: "America/New_York",   MD: "America/New_York",   MA: "America/New_York",
  MI: "America/New_York",   MN: "America/Chicago",    MS: "America/Chicago",
  MO: "America/Chicago",    MT: "America/Denver",     NE: "America/Chicago",
  NV: "America/Los_Angeles",NH: "America/New_York",   NJ: "America/New_York",
  NM: "America/Denver",     NY: "America/New_York",   NC: "America/New_York",
  ND: "America/Chicago",    OH: "America/New_York",   OK: "America/Chicago",
  OR: "America/Los_Angeles",PA: "America/New_York",   RI: "America/New_York",
  SC: "America/New_York",   SD: "America/Chicago",    TN: "America/Chicago",
  TX: "America/Chicago",    UT: "America/Denver",     VT: "America/New_York",
  VA: "America/New_York",   WA: "America/Los_Angeles",WV: "America/New_York",
  WI: "America/Chicago",    WY: "America/Denver",
};

const manualLeadSchema = z.object({
  firstName:         z.string().min(1, "First name is required"),
  lastName:          z.string().min(1, "Last name is required"),
  businessName:      z.string().optional(),
  businessTrade:     z.string().min(1, "Business trade is required"),
  phone:             z.string().min(1, "Phone is required"),
  email:             z.string().email("Invalid email").optional().or(z.literal("")),
  website:           z.string().optional(),
  source:            z.enum(["website", "outreach"]),
  sellerProfileUrl:  z.string().url().optional().or(z.literal("")),
  adUrl:             z.string().url().optional().or(z.literal("")),
  preferredLanguage: z.enum(["es", "en"]).default("en"),
  notes:             z.string().optional(),
  city:              z.string().min(1, "City is required"),
  state:             z.string().length(2, "State is required"),
  assignedTo:        z.string().optional(),
});

router.post("/leads/manual", requireRole("admin", "developer", "lead_gen"), async (req, res) => {
  try {
    const data = manualLeadSchema.parse(req.body);

    // 1. Find or create contact
    // Normalize phone — required field, so reject if not a valid US number
    const normalizedPhone = data.phone ? normalizePhoneDigits(data.phone) : "";
    if (!isValidUSPhone(normalizedPhone)) {
      return res.status(400).json({ message: "Invalid phone number. Please enter a 10-digit US number." });
    }

    // Outreach leads require both Seller Profile URL and Ad URL
    if (data.source === "outreach" && !data.sellerProfileUrl?.trim()) {
      return res.status(400).json({ message: "Seller Profile URL is required for Outreach leads." });
    }
    if (data.source === "outreach" && !data.adUrl?.trim()) {
      return res.status(400).json({ message: "Ad URL is required for Outreach leads." });
    }

    const normalizedFirstName = crmStorage.normalizePersonName(data.firstName);
    const normalizedLastName = crmStorage.normalizePersonName(data.lastName);

    // Duplicate check — must run before any record is created
    const dupCheck = await crmStorage.checkManualLeadDuplicate({
      normalizedPhone,
      firstName: normalizedFirstName,
      lastName:  normalizedLastName,
      businessName: data.businessName,
      state: data.state,
      source: data.source,
      sellerProfileUrl: data.sellerProfileUrl,
    });
    if (dupCheck.isDuplicate) {
      return res.status(409).json({ code: "DUPLICATE_LEAD", match: dupCheck.match });
    }

    let contact = null;
    let contactWasCreated = false;
    if (data.email) contact = await crmStorage.findContactByEmail(data.email);
    if (!contact) contact = await crmStorage.findContactByPhone(normalizedPhone);
    if (!contact) {
      contact = await crmStorage.createContact({
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        phone: normalizedPhone,
        email: data.email || null,
        notes: null,
        isPrimary: true,
        preferredLanguage: data.preferredLanguage,
      });
      contactWasCreated = true;
    }

    // 2. Find or create company — fallback to "First Last" if no business name provided
    const fullName = `${normalizedFirstName} ${normalizedLastName}`.trim();
    const companyName = data.businessName?.trim()
      ? crmStorage.normalizeCompanyName(data.businessName)
      : fullName;
    let companyId: string | null = null;
    {
      let company = await crmStorage.findCompanyByName(companyName);
      if (!company) {
        company = await crmStorage.createCompany({
          name: companyName,
          industry: data.businessTrade,
          website: data.website || null,
          phone: normalizedPhone,
          email: data.email || null,
        });
      }
      companyId = company.id;
      if (!contact.companyId) {
        await crmStorage.updateContact(contact.id, { companyId: company.id });
      }
    }

    // 3a. Preferred language guardrail — for existing contacts, only write if currently empty
    if (!contactWasCreated && !contact.preferredLanguage) {
      await crmStorage.updateContact(contact.id, { preferredLanguage: data.preferredLanguage });
    }

    // 3. Resolve default CRM status
    const defaultStatus =
      (await crmStorage.getDefaultLeadStatus()) ??
      (await crmStorage.getLeadStatusBySlug("new"));

    // 4. Build lead title
    const leadTitle = data.businessName?.trim()
      ? `${crmStorage.normalizeCompanyName(data.businessName)} – ${fullName}`
      : fullName;

    // 5. Create CRM lead — assign to chosen user or fall back to creator
    const creatorId = req.authUser!.id;
    const resolvedAssignee = data.assignedTo || creatorId;
    const lead = await crmStorage.createLead({
      title: leadTitle,
      companyId,
      contactId: contact.id,
      statusId: defaultStatus?.id ?? null,
      source: data.source,
      sourceLabel: data.source === "website" ? "Website" : "Outreach",
      notes: data.notes || null,
      fromWebsiteForm: false,
      city: data.city,
      state: data.state,
      timezone: US_STATE_TIMEZONES[data.state] ?? null,
      assignedTo: resolvedAssignee,
      sellerProfileUrl: data.source === "outreach" ? (data.sellerProfileUrl?.trim() || null) : null,
      adUrl: data.source === "outreach" ? (data.adUrl?.trim() || null) : null,
    });

    // 6. Create pipeline opportunity in the "new-lead" stage — inherit owner from lead
    const newLeadStage = await pipelineStorage.getStageBySlug("new-lead");
    if (newLeadStage) {
      const opp = await pipelineStorage.createOpportunity({
        title: leadTitle,
        leadId: lead.id,
        companyId,
        contactId: contact.id,
        stageId: newLeadStage.id,
        status: "open",
        sourceLeadTitle: leadTitle,
        notes: data.notes || null,
        assignedTo: resolvedAssignee,
      });
      executeStageAutomations({
        opportunityId: opp.id,
        leadId: lead.id,
        contactId: contact.id,
        companyId,
        assignedTo: resolvedAssignee,
        stageSlug: "new-lead",
        actorId: creatorId,
      }).catch((err: unknown) => {
        console.error("[crm/manual-lead] executeStageAutomations failed:", err);
      });
    }

    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "crm_lead",
      entityId: lead.id,
      metadata: { title: lead.title, source: "manual" },
      ipAddress: req.ip,
    });

    res.status(201).json(lead);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/leads/:id", requireRole("admin", "developer", "sales_rep", "lead_gen"), async (req, res) => {
  const id = req.params.id as string;
  const lead = await crmStorage.getLeadById(id);
  if (!lead) return res.status(404).json({ message: "Lead not found" });
  if (isRestricted(req) && lead.assignedTo !== req.authUser!.id) {
    return res.status(403).json({ message: "Access denied" });
  }
  const [enriched] = await crmStorage.enrichLeads([lead]);
  const localFalcon = await getLocalFalconProfileForLead(id);
  const localFalconCrmOnly = await getLocalFalconCrmOnlyForLead(id);
  res.json({ ...stripSensitiveLeadFields(enriched, req), localFalcon, localFalconCrmOnly });
});

router.get("/leads/:id/report-outreach", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const leadId = req.params.id as string;
    if (!(await assertLeadAccess(req, res, leadId))) return;
    const state = (await getReportOutreachStates([leadId], db, true)).get(leadId)!;
    const tasks = await db.select().from(followupTasks).where(and(eq(followupTasks.leadId, leadId),
      inArray(followupTasks.taskType, [...REPORT_OUTREACH_TASKS]))).orderBy(desc(followupTasks.createdAt));
    const pending = await db.select({ id: scanReportDeliveries.id }).from(scanReportDeliveries)
      .where(and(eq(scanReportDeliveries.leadId, leadId), inArray(scanReportDeliveries.status, ["queued", "retrying"])));
    res.json({ sentCount: state.reportEmailCount, lastSentAt: state.lastReportEmailedAt,
      disposition: state.reportOutreachDisposition,
      viewCount: state.reportViewCount, ctaClickCount: state.reportCtaClickCount,
      lastEngagedAt: state.reportLastEngagedAt, segment: state.reportOutreachSegment,
      needsAttention: state.reportNeedsAttention,
      task: tasks.find(task => !task.completed) ?? (state.reportOutreachDisposition === "no_response" ? tasks[0] : null) ?? null,
      pending: pending.length > 0,
      blockedReason: reportSendBlockedReason(state.reportEmailCount, state.reportOutreachDisposition) });
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});

router.get("/leads/:id/scan-report-email-preview", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const leadId = req.params.id as string;
    if (!(await assertLeadAccess(req, res, leadId))) return;
    const reportId = z.string().min(1).parse(req.query.reportId);
    res.json(await getScanReportEmailPreview(leadId, reportId, req.authUser!.email));
  } catch (error: any) {
    res.status(error?.statusCode ?? 400).json({ message: error.message });
  }
});

router.post("/leads/:id/scan-report-share", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const leadId = req.params.id as string;
    if (!(await assertLeadAccess(req, res, leadId))) return;
    const { reportId } = z.object({ reportId: z.string().min(1) }).parse(req.body);
    const result = await prepareScanReportShare(leadId, reportId);
    await logAudit({
      userId: req.authUser!.id,
      action: "scan_report_link_prepared",
      entity: "crm_lead",
      entityId: leadId,
      metadata: { reportId },
      ipAddress: req.ip,
    });
    res.json(result);
  } catch (error: any) {
    res.status(error?.statusCode ?? 400).json({ message: error.message });
  }
});

router.post("/leads/:id/prepare-scan-report-email", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const leadId = req.params.id as string;
    if (!(await assertLeadAccess(req, res, leadId))) return;
    const input = scanReportEmailSchema.parse(req.body);
    const result = await prepareManualScanReportEmail({
      leadId,
      ...input,
      actorEmail: req.authUser!.email,
    });
    await logAudit({
      userId: req.authUser!.id,
      action: "scan_report_email_prepared_for_gmail",
      entity: "crm_lead",
      entityId: leadId,
      metadata: { reportId: input.reportId, recipient: input.recipient },
      ipAddress: req.ip,
    });
    res.json(result);
  } catch (error: any) {
    res.status(error?.statusCode ?? 400).json({ message: error.message });
  }
});

router.post("/leads/:id/confirm-scan-report-email", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const leadId = req.params.id as string;
    if (!(await assertLeadAccess(req, res, leadId))) return;
    const { confirmed: _confirmed, ...input } = confirmManualScanReportEmailSchema.parse(req.body);
    const result = await confirmManualScanReportEmail({
      leadId,
      ...input,
      actorId: req.authUser!.id,
      actorEmail: req.authUser!.email,
    });
    await logAudit({
      userId: req.authUser!.id,
      action: result.duplicate ? "scan_report_manual_send_duplicate_ignored" : "scan_report_manual_send_confirmed",
      entity: "crm_lead",
      entityId: leadId,
      metadata: { reportId: input.reportId, recipient: input.recipient, deliveryId: result.deliveryId },
      ipAddress: req.ip,
    });
    res.json({
      message: result.duplicate ? "This Gmail send was already recorded" : "Gmail send recorded",
      ...result,
    });
  } catch (error: any) {
    res.status(error?.statusCode ?? 400).json({ message: error.message });
  }
});

router.post("/leads/:id/email-scan-report", requireRole("admin", "developer", "sales_rep"), (_req, res) => {
  res.status(410).json({ message: "Automated prospect delivery is disabled. Prepare the email for Gmail instead." });
});

const EMAIL_TEST_SOURCE_LEAD_ID = "73eec4df-4ae9-4357-8842-2c0125c76e54";
const EMAIL_TEST_SOURCE_REPORT_ID = "11e4499a-4e1a-4926-a612-5dc0547c99a2";
const EMAIL_TEST_COMPANIES = [
  "Piedmont Smart Systems",
  "Queen City Automation Group",
  "Blue Ridge Control Solutions",
] as const;

router.post("/leads/:id/create-email-test-clones", requireRole("admin"), async (req, res) => {
  try {
    const sourceLeadId = req.params.id as string;
    if (sourceLeadId !== EMAIL_TEST_SOURCE_LEAD_ID) {
      return res.status(404).json({ message: "Email test cloning is not available for this lead" });
    }

    const created = await db.transaction(async (tx) => {
      const [sourceLead] = await tx.select().from(crmLeads)
        .where(eq(crmLeads.id, EMAIL_TEST_SOURCE_LEAD_ID)).limit(1);
      const [sourceReport] = await tx.select().from(localFalconProspectProfiles)
        .where(eq(localFalconProspectProfiles.id, EMAIL_TEST_SOURCE_REPORT_ID)).limit(1);
      if (!sourceLead || !sourceReport) {
        throw Object.assign(new Error("Carolina Custom Automation source data was not found"), { statusCode: 404 });
      }

      const results: Array<{ leadId: string; reportId: string; companyName: string }> = [];
      for (const [index, companyName] of EMAIL_TEST_COMPANIES.entries()) {
        const title = `${companyName} – Email Test`;
        const [existing] = await tx.select({ id: crmLeads.id }).from(crmLeads)
          .where(and(eq(crmLeads.title, title), eq(crmLeads.sourceLabel, "Email Template Test"))).limit(1);
        if (existing) {
          const [existingReport] = await tx.select({ id: localFalconProspectProfiles.id })
            .from(localFalconProspectProfiles)
            .where(eq(localFalconProspectProfiles.leadId, existing.id)).limit(1);
          if (existingReport) results.push({ leadId: existing.id, reportId: existingReport.id, companyName });
          continue;
        }

        const [company] = await tx.insert(crmCompanies).values({
          name: companyName,
          phone: "9804754924",
          email: "m.carney.og@gmail.com",
          address: "2012 SC-160 STE. 106",
          city: "Fort Mill",
          state: "SC",
          zip: "29708",
          country: "US",
          industry: "electrical",
          preferredLanguage: "en",
          notes: "Email deliverability test record.",
        }).returning();
        const [contact] = await tx.insert(crmContacts).values({
          companyId: company.id,
          firstName: "Matt",
          lastName: `Test ${index + 1}`,
          email: "m.carney.og@gmail.com",
          phone: "9804754924",
          preferredLanguage: "en",
          notes: "Email deliverability test contact.",
          isPrimary: true,
        }).returning();
        const [lead] = await tx.insert(crmLeads).values({
          companyId: company.id,
          contactId: contact.id,
          statusId: sourceLead.statusId,
          title,
          source: "manual",
          sourceLabel: "Email Template Test",
          assignedTo: sourceLead.assignedTo,
          notes: "Test lead cloned from Carolina Custom Automation for email deliverability testing.",
          city: "Fort Mill",
          state: "SC",
          timezone: "America/New_York",
          trade: sourceLead.trade || "electrical",
        }).returning();

        const {
          id: _sourceReportId,
          leadId: _sourceReportLeadId,
          reportKey: sourceReportKey,
          companyName: _sourceCompanyName,
          ownerName: _sourceOwnerName,
          phone: _sourcePhone,
          createdAt: _sourceCreatedAt,
          ...reportData
        } = sourceReport;
        const [report] = await tx.insert(localFalconProspectProfiles).values({
          ...reportData,
          leadId: lead.id,
          reportKey: `${sourceReportKey}-email-test-${index + 1}`,
          companyName,
          ownerName: `Email Test ${index + 1}`,
          phone: "9804754924",
        }).returning();
        results.push({ leadId: lead.id, reportId: report.id, companyName });
      }
      return results;
    });

    await logAudit({
      userId: req.authUser!.id,
      action: "create_email_test_leads",
      entity: "crm_lead",
      entityId: sourceLeadId,
      metadata: { created },
      ipAddress: req.ip,
    });
    res.status(201).json({ leads: created });
  } catch (error: any) {
    res.status(error?.statusCode ?? 400).json({ message: error.message });
  }
});

router.put("/leads/:id", requireRole("admin", "developer", "sales_rep", "lead_gen"), async (req, res) => {
  try {
    const id = req.params.id as string;
    const existing = await crmStorage.getLeadById(id);
    if (!existing) return res.status(404).json({ message: "Lead not found" });
    if (isRestricted(req) && existing.assignedTo !== req.authUser!.id) {
      return res.status(403).json({ message: "Access denied" });
    }
    // Restricted roles cannot reassign ownership — strip assignedTo before validation.
    const { assignedTo: _stripAssigned, ...restBody } = req.body;
    const bodyToParse = isRestricted(req) ? restBody : req.body;
    const validated = updateCrmLeadSchema.parse(bodyToParse);
    if (validated.state !== undefined) {
      validated.timezone = US_STATE_TIMEZONES[validated.state ?? ""] ?? validated.timezone ?? null;
    }
    const lead = await crmStorage.updateLead(id, validated);
    await logAudit({
      userId: req.authUser?.id,
      action: "update",
      entity: "crm_lead",
      entityId: lead.id,
      metadata: { title: lead.title },
      ipAddress: req.ip,
    });
    const actor = req.authUser ? { actorId: req.authUser.id, actorName: req.authUser.name } : {};
    if (validated.statusId !== undefined && validated.statusId !== existing.statusId) {
      appendHistorySafe({ entityType: "lead", entityId: id, event: "status_changed", fieldName: "statusId", fromValue: existing.statusId ?? null, toValue: validated.statusId ?? null, ...actor });
    }
    if (validated.assignedTo !== undefined && validated.assignedTo !== existing.assignedTo) {
      appendHistorySafe({ entityType: "lead", entityId: id, event: "assigned", fieldName: "assignedTo", fromValue: existing.assignedTo ?? null, toValue: validated.assignedTo ?? null, ...actor });
      if (validated.assignedTo) {
        try { notifyLeadAssignment({ id: lead.id, title: lead.title }, validated.assignedTo); } catch (_) {}
      }
      try {
        const linkedOpp = await pipelineStorage.getOpportunityByLeadId(id);
        if (linkedOpp) {
          await pipelineStorage.updateOpportunity(linkedOpp.id, { assignedTo: validated.assignedTo ?? null });
        }
        await taskStorage.syncOpenTaskOwnershipForLeadIds([id], validated.assignedTo ?? null);
      } catch (err) {
        console.error("[crm/leads] Failed to sync linked ownership:", err);
      }
    }
    if (validated.adUrl !== undefined && validated.adUrl !== existing.adUrl) {
      appendHistorySafe({ entityType: "lead", entityId: id, event: "field_changed", fieldName: "adUrl", fromValue: existing.adUrl ?? null, toValue: validated.adUrl ?? null, ...actor });
    }
    res.json(stripSensitiveLeadFields(lead, req));
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/leads/:id/notes", requireRole("admin", "developer", "sales_rep", "lead_gen"), async (req, res) => {
  const id = req.params.id as string;
  if (!await assertLeadAccess(req, res, id)) return;
  const notes = await crmStorage.getLeadNotes(id);
  res.json(notes);
});

router.post("/leads/:id/notes", requireRole("admin", "developer", "sales_rep", "lead_gen"), async (req, res) => {
  try {
    const id = req.params.id as string;
    if (!await assertLeadAccess(req, res, id)) return;
    const data = insertCrmLeadNoteSchema.parse({
      ...req.body,
      leadId: id,
      userId: req.authUser?.id || null,
    });
    const note = await crmStorage.addLeadNote(data);
    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "crm_lead_note",
      entityId: note.id,
      metadata: { leadId: id, type: note.type },
      ipAddress: req.ip,
    });
    res.status(201).json(note);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/leads/:id/tags", requireRole("admin", "developer", "sales_rep", "lead_gen"), async (req, res) => {
  const id = req.params.id as string;
  if (!await assertLeadAccess(req, res, id)) return;
  const tags = await crmStorage.getLeadTags(id);
  res.json(tags);
});

router.put("/leads/:id/tags", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id as string;
    if (!await assertLeadAccess(req, res, id)) return;
    const { tagIds } = tagIdsSchema.parse(req.body);
    await crmStorage.setLeadTags(id, tagIds);
    await logAudit({
      userId: req.authUser?.id,
      action: "update",
      entity: "crm_lead_tags",
      entityId: id,
      metadata: { tagIds },
      ipAddress: req.ip,
    });
    res.json({ message: "Tags updated" });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/companies", requireRole("admin", "developer", "sales_rep", "lead_gen"), async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const result = await crmStorage.getCompanies({
      search: search as string | undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/companies", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const data = insertCrmCompanySchema.parse(req.body);
    const company = await crmStorage.createCompany(data);
    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "crm_company",
      entityId: company.id,
      metadata: { name: company.name },
      ipAddress: req.ip,
    });
    res.status(201).json(company);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/companies/:id", requireRole("admin", "developer", "sales_rep", "lead_gen"), async (req, res) => {
  const id = req.params.id as string;
  const company = await crmStorage.getCompanyById(id);
  if (!company) return res.status(404).json({ message: "Company not found" });
  res.json(company);
});

router.put("/companies/:id", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id as string;
    const existing = await crmStorage.getCompanyById(id);
    if (!existing) return res.status(404).json({ message: "Company not found" });
    const validated = updateCrmCompanySchema.parse(req.body);
    if (validated.website && !/^https?:\/\//i.test(validated.website)) {
      validated.website = `https://${validated.website}`;
    }
    if (validated.phone !== undefined) {
      const digits = normalizePhoneDigits(validated.phone ?? "");
      validated.phone = isValidUSPhone(digits) ? digits : null;
    }
    const company = await crmStorage.updateCompany(id, validated);

    if (validated.name && validated.name !== existing.name) {
      await cascadeCompanyNameToTitles(id, existing.name, validated.name);
    }

    await logAudit({
      userId: req.authUser?.id,
      action: "update",
      entity: "crm_company",
      entityId: company.id,
      metadata: { name: company.name },
      ipAddress: req.ip,
    });
    res.json(company);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/contacts", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const result = await crmStorage.getContacts({
      search: search as string | undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/contacts", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const data = insertCrmContactSchema.parse(req.body);
    const contact = await crmStorage.createContact(data);
    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "crm_contact",
      entityId: contact.id,
      metadata: { name: `${contact.firstName} ${contact.lastName || ""}`.trim() },
      ipAddress: req.ip,
    });
    res.status(201).json(contact);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/contacts/export-csv", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const csv = await exportContactsToCSV();
    const date = new Date().toISOString().split("T")[0];
    await logAudit({
      userId: req.authUser?.id,
      action: "export",
      entity: "crm_contact",
      entityId: "csv",
      metadata: { date },
      ipAddress: req.ip,
    });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="contacts-${date}.csv"`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post(
  "/contacts/import-csv",
  requireRole("admin", "developer", "sales_rep"),
  express.text({ limit: "5mb" }),
  async (req, res) => {
    try {
      const csvText = req.body as string;
      if (!csvText || typeof csvText !== "string" || csvText.trim().length === 0) {
        return res.status(400).json({ message: "Request body must be a non-empty CSV text" });
      }
      const result = await importContactsFromCSV(csvText);
      await logAudit({
        userId: req.authUser?.id,
        action: "import",
        entity: "crm_contact",
        entityId: "csv",
        metadata: {
          imported: result.imported,
          skipped: result.skipped,
          errors: result.errors,
        },
        ipAddress: req.ip,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.get("/contacts/:id", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  const id = req.params.id as string;
  const contact = await crmStorage.getContactById(id);
  if (!contact) return res.status(404).json({ message: "Contact not found" });
  res.json(contact);
});

router.put("/contacts/:id", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const id = req.params.id as string;
    const existing = await crmStorage.getContactById(id);
    if (!existing) return res.status(404).json({ message: "Contact not found" });
    const validated = updateCrmContactSchema.parse(req.body);
    if (validated.phone !== undefined) {
      const digits = normalizePhoneDigits(validated.phone ?? "");
      validated.phone = isValidUSPhone(digits) ? digits : null;
    }
    if (validated.altPhone !== undefined) {
      const digits = normalizePhoneDigits(validated.altPhone ?? "");
      validated.altPhone = isValidUSPhone(digits) ? digits : null;
    }
    const oldFullName = `${existing.firstName}${existing.lastName ? " " + existing.lastName : ""}`;
    const contact = await crmStorage.updateContact(id, validated);
    const newFullName = `${contact.firstName}${contact.lastName ? " " + contact.lastName : ""}`;
    if (oldFullName !== newFullName) {
      await cascadeContactNameToTitles(id, oldFullName, newFullName);
    }
    await logAudit({
      userId: req.authUser?.id,
      action: "update",
      entity: "crm_contact",
      entityId: contact.id,
      metadata: { name: newFullName },
      ipAddress: req.ip,
    });
    res.json(contact);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/statuses", requireRole("admin", "developer", "sales_rep", "lead_gen"), async (_req, res) => {
  const statuses = await crmStorage.getLeadStatuses();
  res.json(statuses);
});

router.get("/tags", requireRole("admin", "developer", "sales_rep", "lead_gen"), async (_req, res) => {
  const tags = await crmStorage.getTags();
  res.json(tags);
});

router.post("/tags", requireRole("admin", "developer", "sales_rep"), async (req, res) => {
  try {
    const data = insertCrmTagSchema.parse(req.body);
    const tag = await crmStorage.createTag(data);
    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "crm_tag",
      entityId: tag.id,
      metadata: { name: tag.name },
      ipAddress: req.ip,
    });
    res.status(201).json(tag);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

export default router;

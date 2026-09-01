import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  crmLeads,
  localFalconImportBatches,
  localFalconCrmOnlyProspects,
  localFalconProspectProfiles,
  pipelineOpportunities,
} from "@shared/schema";
import type {
  LocalVisibilityReportLibrary,
  LocalVisibilityReportSummary,
} from "@shared/localVisibility";
import { CRM_ONLY_LOCAL_FALCON_SOURCE } from "@shared/sabCrm";
import { formatLocalVisibilityAveragePosition } from "@shared/localVisibility";

export type ReportViewer = {
  id: string;
  role: string;
};

export async function canViewCompanyReports(viewer: ReportViewer, companyId: string): Promise<boolean> {
  if (viewer.role === "admin" || viewer.role === "developer") return true;
  if (viewer.role !== "sales_rep") return false;

  const [leadRows, opportunityRows] = await Promise.all([
    db.select({ id: crmLeads.id }).from(crmLeads)
      .where(and(eq(crmLeads.companyId, companyId), eq(crmLeads.assignedTo, viewer.id)))
      .limit(1),
    db.select({ id: pipelineOpportunities.id }).from(pipelineOpportunities)
      .where(and(
        eq(pipelineOpportunities.companyId, companyId),
        eq(pipelineOpportunities.assignedTo, viewer.id),
      ))
      .limit(1),
  ]);

  return leadRows.length > 0 || opportunityRows.length > 0;
}

type ReportRow = {
  id: string;
  leadId: string;
  companyId: string | null;
  batchRecordId: string;
  batchId: string;
  placeId: string;
  businessName: string | null;
  keyword: string;
  marketCity: string;
  marketState: string;
  radius: string | null;
  gridSize: string | null;
  scanDate: Date;
  averagePosition: string | null;
  reportUrl: string | null;
  snapshotStorageKey: string | null;
};

function summarizeReport(row: ReportRow): LocalVisibilityReportSummary {
  return {
    id: row.id,
    leadId: row.leadId,
    companyId: row.companyId ?? "",
    batchId: row.batchId,
    businessName: row.businessName ?? "Unnamed company",
    keyword: row.keyword,
    market: `${row.marketCity}, ${row.marketState}`,
    radius: row.radius ?? "",
    gridSize: row.gridSize ?? "",
    scanDate: row.scanDate.toISOString(),
    averagePosition: formatLocalVisibilityAveragePosition(row.averagePosition),
    reportUrl: row.reportUrl,
    hasSnapshot: Boolean(row.snapshotStorageKey),
  };
}

const reportSelection = {
  id: localFalconProspectProfiles.id,
  leadId: localFalconProspectProfiles.leadId,
  companyId: crmLeads.companyId,
  batchRecordId: localFalconProspectProfiles.batchRecordId,
  batchId: localFalconImportBatches.batchId,
  placeId: localFalconProspectProfiles.placeId,
  businessName: localFalconProspectProfiles.companyName,
  keyword: localFalconProspectProfiles.scanKeyword,
  marketCity: sql<string>`coalesce(${localFalconProspectProfiles.scanCity}, ${localFalconProspectProfiles.city}, ${localFalconImportBatches.marketCity})`,
  marketState: sql<string>`coalesce(${localFalconProspectProfiles.scanState}, ${localFalconProspectProfiles.state}, ${localFalconImportBatches.marketState})`,
  radius: sql<string>`coalesce(${localFalconProspectProfiles.scanRadiusMiles}, ${localFalconImportBatches.radiusMiles})`,
  gridSize: sql<string>`coalesce(${localFalconProspectProfiles.scanGridSize}, ${localFalconImportBatches.gridSize})`,
  scanDate: localFalconProspectProfiles.scanDate,
  averagePosition: localFalconProspectProfiles.atrp,
  reportUrl: localFalconProspectProfiles.reportUrl,
  snapshotStorageKey: localFalconProspectProfiles.snapshotStorageKey,
};

export async function getCompanyReportLibrary(companyId: string): Promise<LocalVisibilityReportLibrary> {
  const ownRows = await db.select(reportSelection)
    .from(localFalconProspectProfiles)
    .innerJoin(crmLeads, eq(localFalconProspectProfiles.leadId, crmLeads.id))
    .innerJoin(
      localFalconImportBatches,
      eq(localFalconProspectProfiles.batchRecordId, localFalconImportBatches.id),
    )
    .where(eq(crmLeads.companyId, companyId))
    .orderBy(
      desc(localFalconProspectProfiles.scanDate),
      asc(sql`coalesce(${localFalconProspectProfiles.scanRadiusMiles}, ${localFalconImportBatches.radiusMiles})`),
    );

  const crmOnlyRows = await db.select({
    leadId: localFalconCrmOnlyProspects.leadId,
    placeId: localFalconCrmOnlyProspects.placeId,
    contactTag: localFalconCrmOnlyProspects.contactTag,
    scanKeyword: localFalconCrmOnlyProspects.scanKeyword,
    marketReference: localFalconCrmOnlyProspects.marketReference,
  }).from(localFalconCrmOnlyProspects)
    .innerJoin(crmLeads, eq(localFalconCrmOnlyProspects.leadId, crmLeads.id))
    .where(and(eq(crmLeads.companyId, companyId), eq(crmLeads.source, CRM_ONLY_LOCAL_FALCON_SOURCE)));
  const leadsWithReports = new Set(ownRows.map((row) => row.leadId));
  return {
    ownReports: ownRows.map(summarizeReport),
    crmOnlyProspects: crmOnlyRows.filter((row) => !leadsWithReports.has(row.leadId)),
  };
}

export async function getReportAccessRecord(reportId: string) {
  const [record] = await db.select({
    id: localFalconProspectProfiles.id,
    batchRecordId: localFalconProspectProfiles.batchRecordId,
    placeId: localFalconProspectProfiles.placeId,
    subjectCompanyId: crmLeads.companyId,
    assignedTo: crmLeads.assignedTo,
  }).from(localFalconProspectProfiles)
    .innerJoin(crmLeads, eq(localFalconProspectProfiles.leadId, crmLeads.id))
    .where(eq(localFalconProspectProfiles.id, reportId))
    .limit(1);
  return record ?? null;
}

export async function canViewReport(
  viewer: ReportViewer,
  report: NonNullable<Awaited<ReturnType<typeof getReportAccessRecord>>>,
  contextCompanyId?: string,
): Promise<boolean> {
  if (viewer.role === "admin" || viewer.role === "developer") return true;
  if (viewer.role !== "sales_rep") return false;
  if (report.assignedTo === viewer.id) return true;
  if (!contextCompanyId || !(await canViewCompanyReports(viewer, contextCompanyId))) return false;

  const [matchingContextReport] = await db.select({ id: localFalconProspectProfiles.id })
    .from(localFalconProspectProfiles)
    .innerJoin(crmLeads, eq(localFalconProspectProfiles.leadId, crmLeads.id))
    .where(and(
      eq(crmLeads.companyId, contextCompanyId),
      eq(localFalconProspectProfiles.batchRecordId, report.batchRecordId),
    ))
    .limit(1);
  if (matchingContextReport) return true;

  return false;
}

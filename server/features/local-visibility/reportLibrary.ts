import { and, asc, desc, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { db } from "../../db";
import {
  crmLeads,
  localFalconImportBatches,
  localFalconProspectProfiles,
  pipelineOpportunities,
} from "@shared/schema";
import type {
  LocalVisibilityReportLibrary,
  LocalVisibilityReportSummary,
} from "@shared/localVisibility";

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
  businessName: string | null;
  keyword: string;
  marketCity: string;
  marketState: string;
  radius: string | null;
  gridSize: string | null;
  scanDate: Date;
  averagePosition: string;
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
    averagePosition: row.averagePosition,
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
  businessName: localFalconProspectProfiles.companyName,
  keyword: localFalconProspectProfiles.scanKeyword,
  marketCity: localFalconImportBatches.marketCity,
  marketState: localFalconImportBatches.marketState,
  radius: localFalconImportBatches.radiusMiles,
  gridSize: localFalconImportBatches.gridSize,
  scanDate: localFalconProspectProfiles.scanDate,
  averagePosition: localFalconProspectProfiles.arp,
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
      asc(localFalconImportBatches.radiusMiles),
    );

  if (ownRows.length === 0) return { ownReports: [], competitorGroups: [] };

  const batchRecordIds = [...new Set(ownRows.map((row) => row.batchRecordId))];
  const competitorRows = await db.select(reportSelection)
    .from(localFalconProspectProfiles)
    .innerJoin(crmLeads, eq(localFalconProspectProfiles.leadId, crmLeads.id))
    .innerJoin(
      localFalconImportBatches,
      eq(localFalconProspectProfiles.batchRecordId, localFalconImportBatches.id),
    )
    .where(and(
      inArray(localFalconProspectProfiles.batchRecordId, batchRecordIds),
      ne(crmLeads.companyId, companyId),
      isNotNull(localFalconProspectProfiles.snapshotStorageKey),
    ))
    .orderBy(asc(localFalconProspectProfiles.arp));

  const competitorsByBatch = new Map<string, LocalVisibilityReportSummary[]>();
  for (const batchRecordId of batchRecordIds) {
    const seenCompanies = new Set<string>();
    const reports: LocalVisibilityReportSummary[] = [];
    for (const row of competitorRows) {
      if (row.batchRecordId !== batchRecordId || !row.companyId || seenCompanies.has(row.companyId)) continue;
      seenCompanies.add(row.companyId);
      reports.push(summarizeReport(row));
    }
    reports.sort((left, right) => Number(left.averagePosition) - Number(right.averagePosition));
    competitorsByBatch.set(batchRecordId, reports);
  }

  return {
    ownReports: ownRows.map(summarizeReport),
    competitorGroups: ownRows.map((row) => ({
      sourceReportId: row.id,
      competitors: competitorsByBatch.get(row.batchRecordId) ?? [],
    })),
  };
}

export async function getReportAccessRecord(reportId: string) {
  const [record] = await db.select({
    id: localFalconProspectProfiles.id,
    batchRecordId: localFalconProspectProfiles.batchRecordId,
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
  return Boolean(matchingContextReport);
}

import { and, asc, desc, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { db } from "../../db";
import {
  crmLeads,
  localFalconCompetitorStandings,
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
  placeId: string;
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
  placeId: localFalconProspectProfiles.placeId,
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

  const standings = await db.select({
    reportId: localFalconCompetitorStandings.reportId,
    subjectRank: localFalconCompetitorStandings.subjectRank,
    totalBusinesses: localFalconCompetitorStandings.totalBusinesses,
    businessesAheadCount: localFalconCompetitorStandings.businessesAheadCount,
    warnings: localFalconCompetitorStandings.warnings,
    businesses: localFalconCompetitorStandings.businesses,
  }).from(localFalconCompetitorStandings)
    .where(inArray(localFalconCompetitorStandings.reportId, ownRows.map((row) => row.id)));
  const standingByReportId = new Map(standings.map((standing) => [standing.reportId, standing]));

  const competitorPlaceIds = [...new Set(
    standings.flatMap((standing) => standing.businesses.map((business) => business.place_id)),
  )];
  const competitorRows = competitorPlaceIds.length > 0
    ? await db.select(reportSelection)
      .from(localFalconProspectProfiles)
      .innerJoin(crmLeads, eq(localFalconProspectProfiles.leadId, crmLeads.id))
      .innerJoin(
        localFalconImportBatches,
        eq(localFalconProspectProfiles.batchRecordId, localFalconImportBatches.id),
      )
      .where(and(
        inArray(localFalconProspectProfiles.placeId, competitorPlaceIds),
        ne(crmLeads.companyId, companyId),
        isNotNull(localFalconProspectProfiles.snapshotStorageKey),
      ))
      .orderBy(desc(localFalconProspectProfiles.scanDate))
    : [];
  const sendableByPlace = new Map<string, ReportRow[]>();
  for (const row of competitorRows) {
    const candidates = sendableByPlace.get(row.placeId) ?? [];
    candidates.push(row);
    sendableByPlace.set(row.placeId, candidates);
  }

  return {
    ownReports: ownRows.map(summarizeReport),
    competitorGroups: ownRows.map((row) => {
      const standing = standingByReportId.get(row.id);
      if (!standing) {
        return {
          sourceReportId: row.id,
          subjectRank: null,
          totalBusinesses: null,
          businessesAheadCount: null,
          warnings: [],
          dataSource: "unavailable" as const,
          competitors: [],
        };
      }

      const businessesAhead = standing.subjectRank === null
        ? standing.businesses.filter((business) => !business.is_subject)
        : standing.businesses.filter((business) => business.rank < standing.subjectRank!);
      return {
        sourceReportId: row.id,
        subjectRank: standing.subjectRank,
        totalBusinesses: standing.totalBusinesses,
        businessesAheadCount: standing.businessesAheadCount,
        warnings: standing.warnings,
        dataSource: "local_falcon" as const,
        competitors: businessesAhead.map((business) => {
          const candidates = sendableByPlace.get(business.place_id) ?? [];
          const bestMatch = candidates.find((candidate) => candidate.batchRecordId === row.batchRecordId)
            ?? candidates.find((candidate) =>
              candidate.keyword === row.keyword
              && Number(candidate.radius) === Number(row.radius))
            ?? candidates.find((candidate) => candidate.keyword === row.keyword)
            ?? candidates[0];
          return {
            ...business,
            sendableReport: bestMatch ? summarizeReport(bestMatch) : null,
          };
        }),
      };
    }),
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

  const contextStandings = await db.select({
    businesses: localFalconCompetitorStandings.businesses,
  }).from(localFalconCompetitorStandings)
    .innerJoin(
      localFalconProspectProfiles,
      eq(localFalconCompetitorStandings.reportId, localFalconProspectProfiles.id),
    )
    .innerJoin(crmLeads, eq(localFalconProspectProfiles.leadId, crmLeads.id))
    .where(eq(crmLeads.companyId, contextCompanyId));
  return contextStandings.some((standing) =>
    standing.businesses.some((business) => business.place_id === report.placeId));
}

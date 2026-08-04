import { desc, eq, inArray } from "drizzle-orm";
import {
  localFalconImportBatches,
  localFalconProspectProfiles,
} from "@shared/schema";
import { db } from "../../db";

export type CrmPlaceIdMatch = {
  place_id: string;
  lead_id: string;
  company_name: string | null;
  batch_id: string;
  report_key: string;
  report_url: string | null;
  scan_date: string;
};

export type CrmPlaceIdCheckResult = {
  criterion: "exact_place_id_equals";
  source: "local_falcon_prospect_profiles.place_id";
  requested_count: number;
  unique_place_id_count: number;
  matched_place_id_count: number;
  unmatched_place_id_count: number;
  matched_place_ids: string[];
  unmatched_place_ids: string[];
  matches: CrmPlaceIdMatch[];
};

type CrmPlaceIdMatchRow = Omit<CrmPlaceIdMatch, "scan_date"> & {
  scan_date: Date;
};

export function buildCrmPlaceIdCheckResult(
  requestedPlaceIds: string[],
  rows: CrmPlaceIdMatchRow[],
): CrmPlaceIdCheckResult {
  const uniquePlaceIds = [...new Set(requestedPlaceIds)];
  const requestedSet = new Set(uniquePlaceIds);
  const matches = rows
    .filter((row) => requestedSet.has(row.place_id))
    .map((row) => ({
      ...row,
      scan_date: row.scan_date.toISOString(),
    }));
  const matchedPlaceIdSet = new Set(matches.map((row) => row.place_id));
  const matchedPlaceIds = uniquePlaceIds.filter((placeId) => matchedPlaceIdSet.has(placeId));
  const unmatchedPlaceIds = uniquePlaceIds.filter((placeId) => !matchedPlaceIdSet.has(placeId));

  return {
    criterion: "exact_place_id_equals",
    source: "local_falcon_prospect_profiles.place_id",
    requested_count: requestedPlaceIds.length,
    unique_place_id_count: uniquePlaceIds.length,
    matched_place_id_count: matchedPlaceIds.length,
    unmatched_place_id_count: unmatchedPlaceIds.length,
    matched_place_ids: matchedPlaceIds,
    unmatched_place_ids: unmatchedPlaceIds,
    matches,
  };
}

export async function checkCrmPlaceIds(
  requestedPlaceIds: string[],
): Promise<CrmPlaceIdCheckResult> {
  const uniquePlaceIds = [...new Set(requestedPlaceIds)];
  const rows = await db
    .select({
      place_id: localFalconProspectProfiles.placeId,
      lead_id: localFalconProspectProfiles.leadId,
      company_name: localFalconProspectProfiles.companyName,
      batch_id: localFalconImportBatches.batchId,
      report_key: localFalconProspectProfiles.reportKey,
      report_url: localFalconProspectProfiles.reportUrl,
      scan_date: localFalconProspectProfiles.scanDate,
    })
    .from(localFalconProspectProfiles)
    .innerJoin(
      localFalconImportBatches,
      eq(localFalconProspectProfiles.batchRecordId, localFalconImportBatches.id),
    )
    .where(inArray(localFalconProspectProfiles.placeId, uniquePlaceIds))
    .orderBy(desc(localFalconProspectProfiles.createdAt));

  return buildCrmPlaceIdCheckResult(requestedPlaceIds, rows);
}

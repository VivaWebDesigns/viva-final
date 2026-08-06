import { createHash } from "node:crypto";
import {
  checkCrmPlaceIds,
  type CrmPlaceIdCheckResult,
} from "./crmDedup";

const LOCAL_FALCON_API_BASE = "https://api.localfalcon.com/v1";
const LOCAL_FALCON_TIMEOUT_MS = 30_000;
const PLACE_ID_FIELDMASK = "report_key,businesses.*.place_id";

type FetchLike = typeof fetch;
type CheckPlaceIds = (placeIds: string[]) => Promise<CrmPlaceIdCheckResult>;

type LocalFalconCompetitorBusiness = {
  place_id?: unknown;
};

type LocalFalconCompetitorResponse = {
  code?: unknown;
  success?: unknown;
  message?: unknown;
  data?: {
    report_key?: unknown;
    businesses?: unknown;
  };
};

export type LocalFalconReportCrmCheckResult = {
  report_key: string;
  source: "local_falcon_competitor_report";
  criterion: "exact_place_id_equals";
  source_business_count: number;
  businesses_with_place_id_count: number;
  businesses_missing_place_id_count: number;
  unique_place_id_count: number;
  duplicate_place_id_count: number;
  place_id_sha256: string;
  matched_place_id_count: number;
  unmatched_place_id_count: number;
  matched_place_ids: string[];
  matches: CrmPlaceIdCheckResult["matches"];
  unmatched_place_ids_omitted: true;
};

function localFalconApiKey() {
  const apiKey = process.env.LOCAL_FALCON_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "LOCAL_FALCON_API_KEY is not configured for the Viva SAB Workflow connector.",
    );
  }
  return apiKey;
}

function responseMessage(payload: LocalFalconCompetitorResponse) {
  return typeof payload.message === "string" && payload.message.trim()
    ? payload.message.trim()
    : "Local Falcon did not return the requested competitor report.";
}

export function extractLocalFalconPlaceIds(
  payload: LocalFalconCompetitorResponse,
  requestedReportKey: string,
) {
  if (payload.success !== true || !payload.data) {
    throw new Error(responseMessage(payload));
  }

  const businesses = payload.data.businesses;
  if (!Array.isArray(businesses)) {
    throw new Error("Local Falcon competitor report did not include a businesses array.");
  }

  const placeIds = businesses
    .map((business: LocalFalconCompetitorBusiness) =>
      typeof business?.place_id === "string" ? business.place_id.trim() : ""
    )
    .filter(Boolean);
  const uniquePlaceIds = [...new Set(placeIds)];
  const reportKey = typeof payload.data.report_key === "string"
    ? payload.data.report_key.trim()
    : requestedReportKey;

  if (!uniquePlaceIds.length) {
    throw new Error("Local Falcon competitor report did not include any Google Place IDs.");
  }

  return {
    reportKey,
    sourceBusinessCount: businesses.length,
    businessesWithPlaceIdCount: placeIds.length,
    businessesMissingPlaceIdCount: businesses.length - placeIds.length,
    duplicatePlaceIdCount: placeIds.length - uniquePlaceIds.length,
    uniquePlaceIds,
  };
}

export async function checkCrmPlaceIdsFromLocalFalconReport(
  reportKey: string,
  options: {
    apiKey?: string;
    fetchImpl?: FetchLike;
    checkPlaceIds?: CheckPlaceIds;
  } = {},
): Promise<LocalFalconReportCrmCheckResult> {
  const apiKey = options.apiKey?.trim() || localFalconApiKey();
  const fetchImpl = options.fetchImpl ?? fetch;
  const checkPlaceIds = options.checkPlaceIds ?? checkCrmPlaceIds;
  const cleanReportKey = reportKey.trim();
  const url = new URL(
    `${LOCAL_FALCON_API_BASE}/competitor-reports/${encodeURIComponent(cleanReportKey)}`,
  );
  url.searchParams.set("fieldmask", PLACE_ID_FIELDMASK);

  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ report_key: cleanReportKey }),
    signal: AbortSignal.timeout(LOCAL_FALCON_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `Local Falcon competitor report request failed with HTTP ${response.status}.`,
    );
  }

  const payload = await response.json() as LocalFalconCompetitorResponse;
  const extracted = extractLocalFalconPlaceIds(payload, cleanReportKey);
  const crmResult = await checkPlaceIds(extracted.uniquePlaceIds);
  const placeIdSha256 = createHash("sha256")
    .update(extracted.uniquePlaceIds.join("\n"))
    .digest("hex");

  return {
    report_key: extracted.reportKey,
    source: "local_falcon_competitor_report",
    criterion: crmResult.criterion,
    source_business_count: extracted.sourceBusinessCount,
    businesses_with_place_id_count: extracted.businessesWithPlaceIdCount,
    businesses_missing_place_id_count: extracted.businessesMissingPlaceIdCount,
    unique_place_id_count: extracted.uniquePlaceIds.length,
    duplicate_place_id_count: extracted.duplicatePlaceIdCount,
    place_id_sha256: placeIdSha256,
    matched_place_id_count: crmResult.matched_place_id_count,
    unmatched_place_id_count: crmResult.unmatched_place_id_count,
    matched_place_ids: crmResult.matched_place_ids,
    matches: crmResult.matches,
    unmatched_place_ids_omitted: true,
  };
}

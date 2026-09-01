import { createHash } from "node:crypto";
import { localFalconApiKey, type LocalFalconFetch } from "./localFalconRankedCells";

const LOCAL_FALCON_API_BASE = "https://api.localfalcon.com";
const LOCAL_FALCON_TIMEOUT_MS = 90_000;
const CENTER_TOLERANCE = 0.000_001;
const PAGE_LIMIT = 100;
const MAX_PAGES = 100;

type JsonRecord = Record<string, unknown>;

export type SabLocalFalconPreflightScan = {
  place_id: string;
  scan_role: "deliverable" | "auxiliary";
  scan_type: "standard" | "scout" | "fine" | "recenter";
  center: { latitude: number; longitude: number };
  grid_size: 7 | 9;
  radius: number;
  measurement: "mi" | "km";
  keyword: string;
  platform: "google";
  estimated_credits: number;
};

type LocalFalconReport = {
  report_key?: unknown;
  status?: unknown;
  date?: unknown;
  public_url?: unknown;
  place_id?: unknown;
  keyword?: unknown;
  platform?: unknown;
  lat?: unknown;
  lng?: unknown;
  grid_size?: unknown;
  radius?: unknown;
  measurement?: unknown;
};

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finiteNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function responseData(payload: JsonRecord) {
  return payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
    ? payload.data as JsonRecord
    : null;
}

function publicReportUrl(value: unknown) {
  const text = cleanString(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

async function postLocalFalcon(
  path: string,
  body: URLSearchParams,
  apiKey: string,
  fetchImpl: LocalFalconFetch,
) {
  const response = await fetchImpl(`${LOCAL_FALCON_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(LOCAL_FALCON_TIMEOUT_MS),
  });
  const payload = await response.json().catch(() => ({})) as JsonRecord;
  if (!response.ok || payload.success !== true) {
    const message = cleanString(payload.message);
    throw new Error(
      `Local Falcon ${path} preflight failed with HTTP ${response.status}${message ? `: ${message}` : ""}.`,
    );
  }
  return payload;
}

async function allPages(
  path: "/v1/reports/" | "/v1/locations/",
  collection: "reports" | "locations",
  parameters: Record<string, string>,
  apiKey: string,
  fetchImpl: LocalFalconFetch,
) {
  const rows: JsonRecord[] = [];
  const seenTokens = new Set<string>();
  let nextToken: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const body = new URLSearchParams({
      api_key: apiKey,
      limit: String(PAGE_LIMIT),
      ...parameters,
      ...(nextToken ? { next_token: nextToken } : {}),
    });
    const payload = await postLocalFalcon(path, body, apiKey, fetchImpl);
    const data = responseData(payload);
    const pageRows = data?.[collection];
    if (!data || !Array.isArray(pageRows)) {
      throw new Error(`Local Falcon ${collection} preflight returned an incomplete page.`);
    }
    rows.push(...pageRows.filter((row): row is JsonRecord => Boolean(row) && typeof row === "object" && !Array.isArray(row)));
    nextToken = cleanString(data.next_token);
    if (!nextToken) return rows;
    if (seenTokens.has(nextToken)) {
      throw new Error(`Local Falcon ${collection} pagination repeated a token.`);
    }
    seenTokens.add(nextToken);
  }
  throw new Error(`Local Falcon ${collection} preflight exceeded ${MAX_PAGES} pages.`);
}

function exactEnvelope(report: LocalFalconReport, scan: SabLocalFalconPreflightScan) {
  const latitude = finiteNumber(report.lat);
  const longitude = finiteNumber(report.lng);
  return cleanString(report.place_id) === scan.place_id &&
    cleanString(report.keyword) === scan.keyword &&
    cleanString(report.platform)?.toLowerCase() === scan.platform &&
    finiteNumber(report.grid_size) === scan.grid_size &&
    finiteNumber(report.radius) === scan.radius &&
    cleanString(report.measurement)?.toLowerCase() === scan.measurement &&
    latitude !== null && longitude !== null &&
    Math.abs(latitude - scan.center.latitude) <= CENTER_TOLERANCE &&
    Math.abs(longitude - scan.center.longitude) <= CENTER_TOLERANCE;
}

function reportStatus(report: LocalFalconReport) {
  return cleanString(report.status)?.toLowerCase() ?? "complete";
}

export async function preflightSabLocalFalconBatch(
  scans: SabLocalFalconPreflightScan[],
  options: { apiKey?: string; fetchImpl?: LocalFalconFetch } = {},
) {
  const apiKey = options.apiKey?.trim() || localFalconApiKey();
  const fetchImpl = options.fetchImpl ?? fetch;
  const placeIds = [...new Set(scans.map((scan) => scan.place_id))];

  const accountPayload = await postLocalFalcon(
    "/v2/account",
    new URLSearchParams({ api_key: apiKey }),
    apiKey,
    fetchImpl,
  );
  const usableCredits = finiteNumber(
    (responseData(accountPayload)?.credits as JsonRecord | undefined)?.total_usable_credits,
  );
  if (usableCredits === null || usableCredits < 0 || !Number.isInteger(usableCredits)) {
    throw new Error("Local Falcon account preflight did not return a valid usable credit balance.");
  }

  const reports = await allPages(
    "/v1/reports/",
    "reports",
    {
      fields: "report_key,status,date,public_url,place_id,keyword,platform,lat,lng,grid_size,radius,measurement",
    },
    apiKey,
    fetchImpl,
  ) as LocalFalconReport[];
  const locations = await allPages(
    "/v1/locations/",
    "locations",
    {},
    apiKey,
    fetchImpl,
  );
  const savedPlaceIds = new Set(
    locations.map((location) => cleanString(location.place_id)).filter((value): value is string => Boolean(value)),
  );
  const checkedAt = new Date().toISOString();

  const results = scans.map((scan) => {
    const matchingReports = reports
      .filter((report) => exactEnvelope(report, scan))
      .map((report) => ({
        report_key: cleanString(report.report_key),
        status: reportStatus(report),
        date: cleanString(report.date),
        public_url: publicReportUrl(report.public_url),
      }))
      .filter((report): report is typeof report & { report_key: string } => Boolean(report.report_key));
    const savedLocation = savedPlaceIds.has(scan.place_id);
    const authorizationScan = {
      ...scan,
      save_location_required: !savedLocation,
    };
    return {
      scan: authorizationScan,
      saved_location: savedLocation,
      duplicate_report_result: matchingReports.length ? "equivalent_report_exists" as const : "none" as const,
      matching_reports: matchingReports,
    };
  });
  const plannedCredits = scans.reduce((sum, scan) => sum + scan.estimated_credits, 0);
  const evidenceHash = createHash("sha256").update(JSON.stringify({
    checked_at: checkedAt,
    usable_credits: usableCredits,
    results,
  })).digest("hex");
  const evidenceReference = `viva-local-falcon-preflight:${evidenceHash}`;
  const exactDuplicateCount = results.reduce(
    (sum, result) => sum + result.matching_reports.length,
    0,
  );
  const readyForAuthorization = exactDuplicateCount === 0 && usableCredits >= plannedCredits;
  const duplicateChecks = readyForAuthorization
    ? results.map((result) => ({
        scan: result.scan,
        result: "none" as const,
        evidence_reference: evidenceReference,
        checked_at: checkedAt,
      }))
    : [];

  return {
    source: "local_falcon_api" as const,
    read_only: true as const,
    scans_submitted: 0 as const,
    writes_performed: false as const,
    checked_at: checkedAt,
    evidence_reference: evidenceReference,
    account: {
      total_usable_credits: usableCredits,
      planned_credits: plannedCredits,
      sufficient_credits: usableCredits >= plannedCredits,
    },
    exact_envelope_count: scans.length,
    provider_report_count: reports.length,
    provider_saved_location_count: locations.length,
    requested_place_id_count: placeIds.length,
    exact_duplicate_count: exactDuplicateCount,
    ready_for_authorization: readyForAuthorization,
    results,
    authorization_duplicate_report_checks: duplicateChecks,
  };
}

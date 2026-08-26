import { SCALE_FIRST_WORKFLOW } from "@shared/sabCrm";
import {
  isoDate,
  normalizedGridSize,
  parseLocalFalconCompetitorSidecar,
  validateLocalFalconCompetitorReportV2,
  type LocalFalconCompetitorReport,
} from "../crm/localFalconCompetitors";
import {
  getProspectScanSpec,
  parseLocalFalconPayload,
  type ScaleFirstProspectInput,
} from "../crm/localFalconImport";
import {
  fetchLocalFalconReport,
  localFalconApiKey,
  normalizedLocalFalconRank,
  type LocalFalconFetch,
  type LocalFalconResponse,
} from "./localFalconRankedCells";

const REPORT_CONCURRENCY = 4;
const COMPETITOR_FIELDMASK = [
  "report_key",
  "date",
  "looker_date",
  "keyword",
  "grid_size",
  "radius",
  "measurement",
  "businesses.*.place_id",
  "businesses.*.name",
  "businesses.*.solv",
  "businesses.*.reviews",
  "businesses.*.rating",
  "businesses.*.data_points.*.rank",
].join(",");
const SCAN_FIELDMASK = [
  "report_key",
  "date",
  "looker_date",
  "place_id",
  "keyword",
  "grid_size",
  "radius",
  "measurement",
].join(",");

type LocalFalconBusiness = {
  place_id?: unknown;
  name?: unknown;
  solv?: unknown;
  reviews?: unknown;
  rating?: unknown;
  data_points?: unknown;
};

type ReportData = NonNullable<LocalFalconResponse["data"]> & {
  date?: unknown;
  looker_date?: unknown;
  place_id?: unknown;
};

export type SabCompetitorSidecarReportError = {
  report_key: string;
  subject_place_id: string;
  errors: string[];
};

export type SabCompetitorSidecarResult = {
  competitors_json: string | null;
  reconciliation: {
    complete: boolean;
    batch_id: string;
    requested_report_count: number;
    reconciled_report_count: number;
    failed_report_count: number;
    report_concurrency: number;
    errors: SabCompetitorSidecarReportError[];
    scans_executed: false;
    writes_performed: false;
  };
};

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredString(value: unknown, label: string): string {
  const result = cleanString(value);
  if (!result) throw new Error(`Local Falcon report did not include ${label}.`);
  return result;
}

function requiredNumber(value: unknown, label: string): number {
  const result = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim()
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(result)) throw new Error(`Local Falcon report did not include a valid ${label}.`);
  return result;
}

function requiredInteger(value: unknown, label: string): number {
  const result = requiredNumber(value, label);
  if (!Number.isInteger(result) || result < 0) {
    throw new Error(`Local Falcon report did not include a valid ${label}.`);
  }
  return result;
}

function reportDate(data: ReportData): string {
  const lookerDate = cleanString(data.looker_date);
  if (lookerDate && /^\d{8}$/.test(lookerDate)) {
    return `${lookerDate.slice(0, 4)}-${lookerDate.slice(4, 6)}-${lookerDate.slice(6, 8)}`;
  }
  const date = requiredString(data.date, "a scan date");
  const usDate = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/);
  if (usDate) {
    return `${usDate[3]}-${usDate[1].padStart(2, "0")}-${usDate[2].padStart(2, "0")}`;
  }
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) throw new Error("Local Falcon report did not include a valid scan date.");
  return parsed.toISOString().slice(0, 10);
}

function responseData(payload: LocalFalconResponse, label: string): ReportData {
  if (payload.success !== true || !payload.data) {
    const message = cleanString(payload.message) ?? `Local Falcon did not return the requested ${label}.`;
    throw new Error(message);
  }
  return payload.data as ReportData;
}

function mismatch(errors: string[], label: string, actual: unknown, expected: unknown) {
  if (actual !== expected) errors.push(`${label} mismatch (official ${String(actual)}, manifest ${String(expected)})`);
}

function extractReport(
  prospect: ScaleFirstProspectInput,
  gridSize: number,
  radiusMiles: number,
  competitorPayload: LocalFalconResponse,
  scanPayload: LocalFalconResponse,
): LocalFalconCompetitorReport {
  const competitor = responseData(competitorPayload, "competitor report");
  const scan = responseData(scanPayload, "completed scan report");
  const errors: string[] = [];
  const competitorReportKey = requiredString(competitor.report_key, "a competitor report key");
  const scanReportKey = requiredString(scan.report_key, "a scan report key");
  const subjectPlaceId = requiredString(scan.place_id, "a subject Place ID");
  const keyword = requiredString(competitor.keyword, "a keyword");
  const officialGridSize = requiredInteger(competitor.grid_size, "grid size");
  const officialRadius = requiredNumber(competitor.radius, "radius");
  const scanDate = reportDate(competitor);

  mismatch(errors, "report key", competitorReportKey, prospect.report_key);
  mismatch(errors, "scan report key", scanReportKey, prospect.report_key);
  mismatch(errors, "subject Place ID", subjectPlaceId, prospect.place_id);
  mismatch(errors, "keyword", keyword, prospect.scan_keyword);
  mismatch(errors, "grid size", officialGridSize, gridSize);
  if (Math.abs(officialRadius - radiusMiles) > 0.0001) {
    errors.push(`radius mismatch (official ${officialRadius}, manifest ${radiusMiles})`);
  }
  const measurement = requiredString(competitor.measurement, "a radius measurement").toLowerCase();
  if (measurement !== "mi" && measurement !== "mile" && measurement !== "miles") {
    errors.push(`radius measurement mismatch (official ${measurement}, manifest miles)`);
  }
  mismatch(errors, "scan date", scanDate, isoDate(prospect.scan_date));

  for (const [label, field] of [
    ["keyword", "keyword"],
    ["grid size", "grid_size"],
    ["radius", "radius"],
  ] as const) {
    const left = cleanString(competitor[field]);
    const right = cleanString(scan[field]);
    if (left !== right) errors.push(`${label} is inconsistent between official competitor and scan reports`);
  }
  if (reportDate(scan) !== scanDate) errors.push("scan date is inconsistent between official competitor and scan reports");

  const businesses = competitor.businesses;
  if (!Array.isArray(businesses)) throw new Error("Local Falcon competitor report did not include a businesses array.");
  const subjectIndexes = businesses.flatMap((business: LocalFalconBusiness, index) =>
    cleanString(business?.place_id) === prospect.place_id ? [index] : []
  );
  if (subjectIndexes.length === 0) errors.push("subject Place ID is missing from the official businesses array");
  if (subjectIndexes.length > 1) errors.push("subject Place ID is ambiguous in the official businesses array");
  if (errors.length) throw new Error(errors.join("; "));

  const subjectIndex = subjectIndexes[0];
  const selectedIndexes = [subjectIndex - 1, subjectIndex, subjectIndex + 1]
    .filter((index) => index >= 0 && index < businesses.length);
  const selected = selectedIndexes.map((index) => {
    const business = businesses[index] as LocalFalconBusiness;
    if (!Array.isArray(business.data_points)) {
      throw new Error(`Local Falcon competitor report did not include data points for ordinal rank ${index + 1}.`);
    }
    const foundPoints = business.data_points.reduce((count, point: { rank?: unknown }) =>
      typeof normalizedLocalFalconRank(point?.rank) === "number" ? count + 1 : count, 0);
    return {
      rank: index + 1,
      place_id: requiredString(business.place_id, `a Place ID for ordinal rank ${index + 1}`),
      name: requiredString(business.name, `a business name for ordinal rank ${index + 1}`),
      solv: requiredNumber(business.solv, `SoLV for ordinal rank ${index + 1}`),
      found_points: foundPoints,
      reviews: requiredInteger(business.reviews, `review count for ordinal rank ${index + 1}`),
      rating: requiredNumber(business.rating, `rating for ordinal rank ${index + 1}`),
      is_subject: index === subjectIndex,
    };
  });

  return {
    competitor_report_key: competitorReportKey,
    subject_place_id: prospect.place_id,
    subject_name: selected.find((business) => business.is_subject)!.name,
    keyword,
    grid_size: officialGridSize,
    radius_miles: officialRadius,
    scan_date: scanDate,
    subject_rank: subjectIndex + 1,
    total_businesses: businesses.length,
    businesses_ahead_count: subjectIndex,
    warnings: [],
    businesses: selected,
  };
}

async function mapBounded<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await worker(items[index]);
    }
  }));
  return results;
}

export async function buildSabCompetitorSidecar(
  manifestJson: string,
  options: { apiKey?: string; fetchImpl?: LocalFalconFetch } = {},
): Promise<SabCompetitorSidecarResult> {
  const payload = parseLocalFalconPayload(manifestJson);
  if (!("workflow" in payload) || payload.workflow !== SCALE_FIRST_WORKFLOW) {
    throw new Error(`manifest_json must declare workflow = ${SCALE_FIRST_WORKFLOW}`);
  }
  const apiKey = options.apiKey?.trim() || localFalconApiKey();
  const fetchImpl = options.fetchImpl ?? fetch;

  const reconciled = await mapBounded(payload.prospects, REPORT_CONCURRENCY, async (prospect) => {
    try {
      const scanSpec = getProspectScanSpec(payload, prospect);
      const gridSize = normalizedGridSize(scanSpec.grid_size);
      if (gridSize === null) throw new Error("manifest_json effective scan_spec.grid_size must be a square grid");
      const competitorPayload = await fetchLocalFalconReport(
        "competitor-reports",
        prospect.report_key,
        COMPETITOR_FIELDMASK,
        apiKey,
        fetchImpl,
      );
      const scanPayload = await fetchLocalFalconReport(
        "reports",
        prospect.report_key,
        SCAN_FIELDMASK,
        apiKey,
        fetchImpl,
      );
      const report = extractReport(
        prospect,
        gridSize,
        scanSpec.radius_miles,
        competitorPayload,
        scanPayload,
      );
      return { prospect, report: validateLocalFalconCompetitorReportV2(report) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { prospect, errors: message.split("; ").filter(Boolean) };
    }
  });

  const errors: SabCompetitorSidecarReportError[] = reconciled.flatMap((item) => item.errors !== undefined ? [{
    report_key: item.prospect.report_key,
    subject_place_id: item.prospect.place_id,
    errors: item.errors,
  }] : []);
  const reports = Object.fromEntries(reconciled.flatMap((item) => "report" in item
    ? [[item.prospect.report_key, item.report] as const]
    : []));
  const complete = errors.length === 0;
  let competitorsJson: string | null = null;
  if (complete) {
    const candidate = {
      version: 2 as const,
      batch_id: payload.batch.batch_id,
      generated_at: new Date().toISOString(),
      ranking_source: "local_falcon" as const,
      reports,
    };
    const validated = parseLocalFalconCompetitorSidecar(JSON.stringify(candidate), payload);
    competitorsJson = JSON.stringify(validated);
  }

  return {
    competitors_json: competitorsJson,
    reconciliation: {
      complete,
      batch_id: payload.batch.batch_id,
      requested_report_count: payload.prospects.length,
      reconciled_report_count: Object.keys(reports).length,
      failed_report_count: errors.length,
      report_concurrency: REPORT_CONCURRENCY,
      errors,
      scans_executed: false,
      writes_performed: false,
    },
  };
}

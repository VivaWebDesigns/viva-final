const LOCAL_FALCON_API_BASE = "https://api.localfalcon.com/v1";
const LOCAL_FALCON_TIMEOUT_MS = 90_000;
const COMPETITOR_FIELDMASK = [
  "report_key",
  "keyword",
  "lat",
  "lng",
  "grid_size",
  "radius",
  "measurement",
  "points",
  "businesses.*.place_id",
  "businesses.*.name",
  "businesses.*.data_points",
].join(",");
const GRID_FIELDMASK = [
  "report_key",
  "keyword",
  "lat",
  "lng",
  "grid_size",
  "radius",
  "measurement",
  "points",
  "data_points.*.lat",
  "data_points.*.lng",
].join(",");

export type LocalFalconFetch = typeof fetch;

type LocalFalconDataPoint = {
  lat?: unknown;
  lng?: unknown;
  rank?: unknown;
};

type LocalFalconBusiness = {
  place_id?: unknown;
  name?: unknown;
  data_points?: unknown;
};

type LocalFalconReportData = {
  report_key?: unknown;
  keyword?: unknown;
  lat?: unknown;
  lng?: unknown;
  grid_size?: unknown;
  radius?: unknown;
  measurement?: unknown;
  points?: unknown;
  businesses?: unknown;
  data_points?: unknown;
};

export type LocalFalconResponse = {
  success?: unknown;
  message?: unknown;
  data?: LocalFalconReportData;
};

export type SabRankedCell = {
  row: number;
  column: number;
  latitude: number;
  longitude: number;
  rank: number;
};

export type SabRankedCellsResult = {
  report_key: string;
  source: "local_falcon_completed_master_report";
  scan_executed: false;
  keyword: string | null;
  grid: {
    size: number;
    point_count: number;
    center: {
      latitude: number;
      longitude: number;
    };
    radius: number;
    measurement: string;
    row_orientation: "north_to_south";
    column_orientation: "west_to_east";
  };
  requested_place_id_count: number;
  found_place_id_count: number;
  missing_place_id_count: number;
  missing_place_ids: string[];
  businesses: Array<{
    place_id: string;
    name: string | null;
    ranked_cell_count: number;
    imprecise_or_unranked_cell_count: number;
    ranked_cells: SabRankedCell[];
  }>;
};

export function localFalconApiKey() {
  const apiKey = process.env.LOCAL_FALCON_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "LOCAL_FALCON_API_KEY is not configured for the Viva SAB Workflow connector.",
    );
  }
  return apiKey;
}

function responseMessage(payload: LocalFalconResponse) {
  return typeof payload.message === "string" && payload.message.trim()
    ? payload.message.trim()
    : "Local Falcon did not return the requested completed report.";
}

function requiredNumber(value: unknown, label: string) {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim()
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(parsed)) {
    throw new Error(`Local Falcon report did not include a valid ${label}.`);
  }
  return parsed;
}

function requiredInteger(value: unknown, label: string) {
  const parsed = requiredNumber(value, label);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Local Falcon report did not include a valid ${label}.`);
  }
  return parsed;
}

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numericAxes(
  dataPoints: unknown,
  gridSize: number,
) {
  if (!Array.isArray(dataPoints)) {
    throw new Error("Local Falcon scan report did not include grid data points.");
  }

  const coordinates = dataPoints.map((point: LocalFalconDataPoint) => ({
    latitude: requiredNumber(point?.lat, "grid-point latitude"),
    longitude: requiredNumber(point?.lng, "grid-point longitude"),
  }));
  const latitudes = [...new Set(coordinates.map(({ latitude }) => latitude))]
    .sort((a, b) => b - a);
  const longitudes = [...new Set(coordinates.map(({ longitude }) => longitude))]
    .sort((a, b) => a - b);

  if (latitudes.length !== gridSize || longitudes.length !== gridSize) {
    throw new Error(
      `Local Falcon grid geometry is not an exact ${gridSize}x${gridSize} coordinate matrix.`,
    );
  }

  return { latitudes, longitudes, pointCount: coordinates.length };
}

function nearestAxisIndex(value: number, axis: number[]) {
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  axis.forEach((candidate, index) => {
    const distance = Math.abs(value - candidate);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  return nearestIndex;
}

export function normalizedLocalFalconRank(value: unknown): number | string | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const clean = value.trim();
    const numeric = Number(clean);
    return Number.isFinite(numeric) ? numeric : clean;
  }
  return null;
}

export function extractSabRankedCells(
  competitorPayload: LocalFalconResponse,
  gridPayload: LocalFalconResponse,
  requestedReportKey: string,
  requestedPlaceIds: string[],
): SabRankedCellsResult {
  if (competitorPayload.success !== true || !competitorPayload.data) {
    throw new Error(responseMessage(competitorPayload));
  }
  if (gridPayload.success !== true || !gridPayload.data) {
    throw new Error(responseMessage(gridPayload));
  }

  const businesses = competitorPayload.data.businesses;
  if (!Array.isArray(businesses)) {
    throw new Error("Local Falcon competitor report did not include a businesses array.");
  }

  const gridSize = requiredInteger(
    gridPayload.data.grid_size ?? competitorPayload.data.grid_size,
    "grid size",
  );
  const axes = numericAxes(gridPayload.data.data_points, gridSize);
  const requested = [...new Set(requestedPlaceIds.map((value) => value.trim()).filter(Boolean))];
  const requestedSet = new Set(requested);
  const businessByPlaceId = new Map<string, LocalFalconBusiness>();

  for (const business of businesses as LocalFalconBusiness[]) {
    const placeId = cleanString(business?.place_id);
    if (placeId && requestedSet.has(placeId) && !businessByPlaceId.has(placeId)) {
      businessByPlaceId.set(placeId, business);
    }
  }

  const selectedBusinesses = requested.flatMap((placeId) => {
    const business = businessByPlaceId.get(placeId);
    if (!business) return [];
    if (!Array.isArray(business.data_points)) {
      throw new Error(
        `Local Falcon competitor report did not include data points for Place ID ${placeId}.`,
      );
    }

    let impreciseOrUnrankedCellCount = 0;
    const rankedCells = business.data_points.flatMap((point: LocalFalconDataPoint) => {
      const rank = normalizedLocalFalconRank(point?.rank);
      if (typeof rank !== "number") {
        impreciseOrUnrankedCellCount += 1;
        return [];
      }
      const latitude = requiredNumber(point?.lat, `ranked-cell latitude for ${placeId}`);
      const longitude = requiredNumber(point?.lng, `ranked-cell longitude for ${placeId}`);
      return [{
        row: nearestAxisIndex(latitude, axes.latitudes) + 1,
        column: nearestAxisIndex(longitude, axes.longitudes) + 1,
        latitude,
        longitude,
        rank,
      }];
    });

    return [{
      place_id: placeId,
      name: cleanString(business.name),
      ranked_cell_count: rankedCells.length,
      imprecise_or_unranked_cell_count: impreciseOrUnrankedCellCount,
      ranked_cells: rankedCells,
    }];
  });

  const foundPlaceIds = new Set(selectedBusinesses.map(({ place_id }) => place_id));
  const missingPlaceIds = requested.filter((placeId) => !foundPlaceIds.has(placeId));
  const reportKey = cleanString(competitorPayload.data.report_key)
    ?? cleanString(gridPayload.data.report_key)
    ?? requestedReportKey;

  return {
    report_key: reportKey,
    source: "local_falcon_completed_master_report",
    scan_executed: false,
    keyword: cleanString(
      competitorPayload.data.keyword ?? gridPayload.data.keyword,
    ),
    grid: {
      size: gridSize,
      point_count: axes.pointCount,
      center: {
        latitude: requiredNumber(
          gridPayload.data.lat ?? competitorPayload.data.lat,
          "grid-center latitude",
        ),
        longitude: requiredNumber(
          gridPayload.data.lng ?? competitorPayload.data.lng,
          "grid-center longitude",
        ),
      },
      radius: requiredNumber(
        gridPayload.data.radius ?? competitorPayload.data.radius,
        "grid radius",
      ),
      measurement: cleanString(
        gridPayload.data.measurement ?? competitorPayload.data.measurement,
      ) ?? "mi",
      row_orientation: "north_to_south",
      column_orientation: "west_to_east",
    },
    requested_place_id_count: requested.length,
    found_place_id_count: selectedBusinesses.length,
    missing_place_id_count: missingPlaceIds.length,
    missing_place_ids: missingPlaceIds,
    businesses: selectedBusinesses,
  };
}

export async function fetchLocalFalconReport(
  endpoint: string,
  reportKey: string,
  fieldmask: string,
  apiKey: string,
  fetchImpl: LocalFalconFetch,
) {
  const url = new URL(
    `${LOCAL_FALCON_API_BASE}/${endpoint}/${encodeURIComponent(reportKey)}${endpoint === "reports" ? "/" : ""}`,
  );
  url.searchParams.set("fieldmask", fieldmask);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ report_key: reportKey }),
    signal: AbortSignal.timeout(LOCAL_FALCON_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `Local Falcon ${endpoint} request failed with HTTP ${response.status}.`,
    );
  }
  return await response.json() as LocalFalconResponse;
}

export async function getSabRankedCells(
  reportKey: string,
  placeIds: string[],
  options: {
    apiKey?: string;
    fetchImpl?: LocalFalconFetch;
  } = {},
): Promise<SabRankedCellsResult> {
  const apiKey = options.apiKey?.trim() || localFalconApiKey();
  const fetchImpl = options.fetchImpl ?? fetch;
  const cleanReportKey = reportKey.trim();

  const [competitorPayload, gridPayload] = await Promise.all([
    fetchLocalFalconReport(
      "competitor-reports",
      cleanReportKey,
      COMPETITOR_FIELDMASK,
      apiKey,
      fetchImpl,
    ),
    fetchLocalFalconReport(
      "reports",
      cleanReportKey,
      GRID_FIELDMASK,
      apiKey,
      fetchImpl,
    ),
  ]);

  return extractSabRankedCells(
    competitorPayload,
    gridPayload,
    cleanReportKey,
    placeIds,
  );
}

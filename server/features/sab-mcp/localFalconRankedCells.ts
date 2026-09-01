const LOCAL_FALCON_API_BASE = "https://api.localfalcon.com/v1";
const LOCAL_FALCON_TIMEOUT_MS = 90_000;
const COMPETITOR_FIELDMASK = [
  "report_key",
  "status",
  "keyword",
  "lat",
  "lng",
  "grid_size",
  "radius",
  "measurement",
  "platform",
  "points",
  "businesses.*.place_id",
  "businesses.*.name",
  "businesses.*.data_points",
].join(",");
const GRID_FIELDMASK = [
  "report_key",
  "status",
  "date",
  "public_url",
  "keyword",
  "place_id",
  "lat",
  "lng",
  "grid_size",
  "radius",
  "measurement",
  "platform",
  "arp",
  "atrp",
  "solv",
  "found_in",
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
  status?: unknown;
  report_key?: unknown;
  date?: unknown;
  public_url?: unknown;
  keyword?: unknown;
  place_id?: unknown;
  lat?: unknown;
  lng?: unknown;
  grid_size?: unknown;
  radius?: unknown;
  measurement?: unknown;
  platform?: unknown;
  arp?: unknown;
  atrp?: unknown;
  solv?: unknown;
  found_in?: unknown;
  points?: unknown;
  businesses?: unknown;
  data_points?: unknown;
};

export type LocalFalconResponse = {
  code?: unknown;
  http_status?: number;
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
  report_subject_place_id: string | null;
  scan_date: string | null;
  public_url: string | null;
  source: "local_falcon_completed_master_report";
  scan_executed: false;
  completion_verified: true;
  completion_status: "complete";
  keyword: string | null;
  platform: string | null;
  arp: number | null;
  atrp: number | null;
  solv: number | null;
  found_in: number | null;
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
    evidence_source: "competitor_roster" | "report_subject_absent_from_competitor_roster";
    ranked_cell_count: number;
    imprecise_or_unranked_cell_count: number;
    ranked_cells: SabRankedCell[];
    all_point_rank_cells: SabRankedCell[];
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
  const parsed =
    typeof value === "number"
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

function publicReportUrl(value: unknown) {
  const text = cleanString(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === false || value === "")
    return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numericAxes(dataPoints: unknown, gridSize: number) {
  if (!Array.isArray(dataPoints)) {
    throw new Error(
      "Local Falcon scan report did not include grid data points.",
    );
  }

  const coordinates = dataPoints.map((point: LocalFalconDataPoint) => ({
    latitude: requiredNumber(point?.lat, "grid-point latitude"),
    longitude: requiredNumber(point?.lng, "grid-point longitude"),
  }));
  const latitudes = [
    ...new Set(coordinates.map(({ latitude }) => latitude)),
  ].sort((a, b) => b - a);
  const longitudes = [
    ...new Set(coordinates.map(({ longitude }) => longitude)),
  ].sort((a, b) => a - b);

  const uniquePairs = new Set(coordinates.map(point => `${point.latitude}:${point.longitude}`));
  if (latitudes.length !== gridSize || longitudes.length !== gridSize || coordinates.length !== gridSize ** 2 || uniquePairs.size !== gridSize ** 2) {
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
  if (nearestDistance > 0.000001) throw new Error("Local Falcon ranked coordinate is outside the exact scan grid.");
  return nearestIndex;
}

export function normalizedLocalFalconRank(
  value: unknown,
): number | string | null {
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

  for (const payload of [competitorPayload, gridPayload]) {
    // The provider defines HTTP 200 as a completed report and HTTP/code 202
    // with status=processing as incomplete; completed reports omit status.
    // https://docs.localfalcon.com/openapi.yaml /v1/reports/{report_key}/
    const code = optionalNumber(payload.code);
    const status = cleanString(payload.data?.status);
    if ((payload.http_status ?? code) !== 200 || (code !== null && code !== 200) || status) {
      throw new Error("Local Falcon report completion is not verified; processing or unknown report status cannot advance the run.");
    }
  }
  const competitorKey = cleanString(competitorPayload.data.report_key);
  const gridKey = cleanString(gridPayload.data.report_key);
  if (competitorKey !== requestedReportKey || gridKey !== requestedReportKey) throw new Error("Local Falcon report identities do not match the exact requested report key.");

  const businesses = competitorPayload.data.businesses;
  if (!Array.isArray(businesses)) {
    throw new Error(
      "Local Falcon competitor report did not include a businesses array.",
    );
  }

  const gridSize = requiredInteger(
    gridPayload.data.grid_size ?? competitorPayload.data.grid_size,
    "grid size",
  );
  const axes = numericAxes(gridPayload.data.data_points, gridSize);
  const requested = [
    ...new Set(requestedPlaceIds.map((value) => value.trim()).filter(Boolean)),
  ];
  const requestedSet = new Set(requested);
  const businessByPlaceId = new Map<string, LocalFalconBusiness>();

  for (const business of businesses as LocalFalconBusiness[]) {
    const placeId = cleanString(business?.place_id);
    if (
      placeId &&
      requestedSet.has(placeId) &&
      !businessByPlaceId.has(placeId)
    ) {
      businessByPlaceId.set(placeId, business);
    }
  }

  const reportSubjectPlaceId = cleanString(gridPayload.data.place_id);
  const selectedBusinesses = requested.flatMap<SabRankedCellsResult["businesses"][number]>((placeId): SabRankedCellsResult["businesses"] => {
    const business = businessByPlaceId.get(placeId);
    if (!business) {
      // A completed scan can identify its exact subject in the grid response
      // while omitting that subject from the competitor roster when it has no
      // ranked positions. Preserve the omission as evidence and represent the
      // subject as unranked at every point so policy can evaluate the existing
      // report without inventing visibility or resubmitting the scan.
      if (placeId !== reportSubjectPlaceId) return [];
      const allPointRankCells = axes.latitudes.flatMap((latitude, rowIndex) => axes.longitudes.map((longitude, columnIndex) => ({
        row: rowIndex + 1, column: columnIndex + 1, latitude, longitude, rank: 21,
      })));
      return [{
        place_id: placeId,
        name: null,
        evidence_source: "report_subject_absent_from_competitor_roster" as const,
        ranked_cell_count: 0,
        imprecise_or_unranked_cell_count: axes.pointCount,
        ranked_cells: [],
        all_point_rank_cells: allPointRankCells,
      }];
    }
    if (!Array.isArray(business.data_points)) {
      throw new Error(
        `Local Falcon competitor report did not include data points for Place ID ${placeId}.`,
      );
    }

    let impreciseOrUnrankedCellCount = 0;
    const observations = new Map<string, SabRankedCell>();
    for (const point of business.data_points as LocalFalconDataPoint[]) {
      const value = normalizedLocalFalconRank(point?.rank);
      const exactTop20 = typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 20;
      if (!exactTop20) impreciseOrUnrankedCellCount += 1;
      const latitude = requiredNumber(point?.lat, `ranked-cell latitude for ${placeId}`);
      const longitude = requiredNumber(point?.lng, `ranked-cell longitude for ${placeId}`);
      const row = nearestAxisIndex(latitude, axes.latitudes) + 1;
      const column = nearestAxisIndex(longitude, axes.longitudes) + 1;
      const position = `${row}:${column}`;
      if (observations.has(position)) throw new Error(`Duplicate ranked scan position for ${placeId}.`);
      // Preserve numeric ranks >20 for all-point medians, but never centering.
      const rank = exactTop20 || (typeof value === "number" && Number.isFinite(value) && value > 20) ? value as number : 21;
      observations.set(position, { row, column, latitude, longitude, rank });
    }
    const allPointRankCells = axes.latitudes.flatMap((latitude, rowIndex) => axes.longitudes.map((longitude, columnIndex) =>
      observations.get(`${rowIndex + 1}:${columnIndex + 1}`) ?? { row: rowIndex + 1, column: columnIndex + 1, latitude, longitude, rank: 21 }));
    const rankedCells = allPointRankCells.filter(cell => Number.isInteger(cell.rank) && cell.rank >= 1 && cell.rank <= 20);

    return [
      {
        place_id: placeId,
        name: cleanString(business.name),
        evidence_source: "competitor_roster" as const,
        ranked_cell_count: rankedCells.length,
        imprecise_or_unranked_cell_count: impreciseOrUnrankedCellCount,
        ranked_cells: rankedCells,
        all_point_rank_cells: allPointRankCells,
      },
    ];
  });

  const foundPlaceIds = new Set(
    selectedBusinesses.filter(({ evidence_source }) => evidence_source === "competitor_roster").map(({ place_id }) => place_id),
  );
  const missingPlaceIds = requested.filter(
    (placeId) => !foundPlaceIds.has(placeId),
  );
  const reportKey =
    cleanString(competitorPayload.data.report_key) ??
    cleanString(gridPayload.data.report_key) ??
    requestedReportKey;

  return {
    report_key: reportKey,
    report_subject_place_id: reportSubjectPlaceId,
    scan_date: cleanString(gridPayload.data.date),
    public_url: publicReportUrl(gridPayload.data.public_url),
    source: "local_falcon_completed_master_report",
    scan_executed: false,
    completion_verified: true,
    completion_status: "complete",
    keyword: cleanString(
      competitorPayload.data.keyword ?? gridPayload.data.keyword,
    ),
    platform: cleanString(
      competitorPayload.data.platform ?? gridPayload.data.platform,
    ),
    arp: optionalNumber(gridPayload.data.arp),
    atrp: optionalNumber(gridPayload.data.atrp),
    solv: optionalNumber(gridPayload.data.solv),
    found_in: optionalNumber(gridPayload.data.found_in),
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
      measurement:
        cleanString(
          gridPayload.data.measurement ?? competitorPayload.data.measurement,
        ) ?? "mi",
      row_orientation: "north_to_south",
      column_orientation: "west_to_east",
    },
    requested_place_id_count: requested.length,
    found_place_id_count: foundPlaceIds.size,
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
  if (response.status !== 200) throw new Error(`Local Falcon ${endpoint} report is not complete (HTTP ${response.status}).`);
  return { ...(await response.json() as LocalFalconResponse), http_status: response.status };
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

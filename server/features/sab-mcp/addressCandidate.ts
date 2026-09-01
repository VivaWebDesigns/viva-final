import type { SabRankedCell } from "./localFalconRankedCells";
import { getSabRankedCells } from "./localFalconRankedCells";
import { summarizeSabCenter } from "./localFalconMaster";

const GOOGLE_GEOCODING_API_URL =
  "https://maps.googleapis.com/maps/api/geocode/json";
const GOOGLE_GEOCODING_TIMEOUT_MS = 15_000;
const METERS_PER_MILE = 1_609.344;

type FetchLike = typeof fetch;

type GoogleGeocodingResult = {
  geometry?: {
    location?: { lat?: unknown; lng?: unknown };
    location_type?: unknown;
  };
  partial_match?: unknown;
  place_id?: unknown;
  types?: unknown;
};

type GoogleGeocodingResponse = {
  error_message?: unknown;
  results?: unknown;
  status?: unknown;
};

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cleanTypes(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is string =>
          typeof entry === "string" && Boolean(entry.trim()),
      )
    : [];
}

function googleMapsGeocodingApiKey() {
  const apiKey = process.env.GOOGLE_MAPS_GEOCODING_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GOOGLE_MAPS_GEOCODING_API_KEY is not configured for the Viva SAB Workflow connector.",
    );
  }
  return apiKey;
}

function resultScore(result: GoogleGeocodingResult) {
  const locationType = cleanString(result.geometry?.location_type);
  const locationTypeScore =
    locationType === "ROOFTOP"
      ? 4
      : locationType === "RANGE_INTERPOLATED"
        ? 3
        : locationType === "GEOMETRIC_CENTER"
          ? 2
          : 1;
  return locationTypeScore + (result.partial_match === true ? 0 : 10);
}

function selectBestResult(results: GoogleGeocodingResult[]) {
  return results.reduce<GoogleGeocodingResult | null>((best, result) => {
    if (!best || resultScore(result) > resultScore(best)) return result;
    return best;
  }, null);
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMiles(
  firstLatitude: number,
  firstLongitude: number,
  secondLatitude: number,
  secondLongitude: number,
) {
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = toRadians(secondLatitude - firstLatitude);
  const longitudeDelta = toRadians(secondLongitude - firstLongitude);
  const firstLatitudeRadians = toRadians(firstLatitude);
  const secondLatitudeRadians = toRadians(secondLatitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitudeRadians) *
      Math.cos(secondLatitudeRadians) *
      Math.sin(longitudeDelta / 2) ** 2;
  const meters =
    earthRadiusMeters *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return Number((meters / METERS_PER_MILE).toFixed(6));
}

function connectedComponents(cells: SabRankedCell[]) {
  const remaining = new Map(
    cells.map((cell) => [`${cell.row}:${cell.column}`, cell]),
  );
  const components: SabRankedCell[][] = [];
  while (remaining.size) {
    const [firstKey, firstCell] = remaining.entries().next().value as [
      string,
      SabRankedCell,
    ];
    remaining.delete(firstKey);
    const queue = [firstCell];
    const component: SabRankedCell[] = [];
    while (queue.length) {
      const cell = queue.shift()!;
      component.push(cell);
      for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
        for (let columnDelta = -1; columnDelta <= 1; columnDelta += 1) {
          if (rowDelta === 0 && columnDelta === 0) continue;
          const neighborKey = `${cell.row + rowDelta}:${cell.column + columnDelta}`;
          const neighbor = remaining.get(neighborKey);
          if (!neighbor) continue;
          remaining.delete(neighborKey);
          queue.push(neighbor);
        }
      }
    }
    components.push(component);
  }
  return components;
}

function weightedCentroid(cells: SabRankedCell[]) {
  const totalWeight = cells.reduce((sum, cell) => sum + 1 / cell.rank, 0);
  return {
    latitude:
      cells.reduce((sum, cell) => sum + cell.latitude / cell.rank, 0) /
      totalWeight,
    longitude:
      cells.reduce((sum, cell) => sum + cell.longitude / cell.rank, 0) /
      totalWeight,
  };
}

function bestRankCluster(cells: SabRankedCell[]) {
  const bestRank = Math.min(...cells.map((cell) => cell.rank));
  const candidates = connectedComponents(cells).filter((component) =>
    component.some((cell) => cell.rank === bestRank),
  );
  const ordered = candidates.sort((first, second) => {
    const firstWeight = first.reduce((sum, cell) => sum + 1 / cell.rank, 0);
    const secondWeight = second.reduce((sum, cell) => sum + 1 / cell.rank, 0);
    return secondWeight - firstWeight || second.length - first.length;
  });
  return {
    bestRank,
    candidateCount: ordered.length,
    cells: ordered[0],
    centroid: weightedCentroid(ordered[0]),
  };
}

export function evaluateSabCoordinatesAgainstCells(
  cells: SabRankedCell[],
  gridSize: number,
  coordinates: { latitude: number; longitude: number },
) {
  if (!cells.length) throw new Error("Exact ranked cells are required for geographic-fit evaluation.");
  const summary = summarizeSabCenter(cells, gridSize)!;
  const bestCluster = bestRankCluster(cells);
  return {
    weighted_centroid: distanceMiles(coordinates.latitude, coordinates.longitude, summary.centroid.latitude, summary.centroid.longitude),
    nearest_ranked_cell: Math.min(...cells.map(cell => distanceMiles(coordinates.latitude, coordinates.longitude, cell.latitude, cell.longitude))),
    best_rank_cluster_centroid: distanceMiles(coordinates.latitude, coordinates.longitude, bestCluster.centroid.latitude, bestCluster.centroid.longitude),
  };
}

async function forwardGeocode(
  addressCandidate: string,
  apiKey: string,
  fetchImpl: FetchLike,
) {
  const url = new URL(GOOGLE_GEOCODING_API_URL);
  url.searchParams.set("address", addressCandidate);
  url.searchParams.set("language", "en");
  url.searchParams.set("region", "us");
  url.searchParams.set("key", apiKey);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(GOOGLE_GEOCODING_TIMEOUT_MS),
    });
  } catch {
    throw new Error("Google address-geocoding request could not be completed.");
  }
  if (!response.ok) {
    throw new Error(
      `Google address-geocoding request failed with HTTP ${response.status}.`,
    );
  }

  const payload = (await response.json()) as GoogleGeocodingResponse;
  const googleStatus = cleanString(payload.status) ?? "UNKNOWN";
  const results = Array.isArray(payload.results)
    ? (payload.results as GoogleGeocodingResult[])
    : [];
  const bestResult = selectBestResult(results);
  if (googleStatus !== "OK" || !bestResult) {
    throw new Error(
      `Google did not return a usable geocoding result for the temporary address candidate (status ${googleStatus}).`,
    );
  }
  const latitude = cleanNumber(bestResult.geometry?.location?.lat);
  const longitude = cleanNumber(bestResult.geometry?.location?.lng);
  if (latitude === null || longitude === null) {
    throw new Error(
      "Google did not return valid coordinates for the temporary address candidate.",
    );
  }
  return {
    latitude,
    longitude,
    locationType: cleanString(bestResult.geometry?.location_type),
    partialMatch: bestResult.partial_match === true,
    geocoderPlaceId: cleanString(bestResult.place_id),
    resultTypes: cleanTypes(bestResult.types),
    googleStatus,
  };
}

export async function evaluateSabAddressCandidate(
  reportKey: string,
  placeId: string,
  addressCandidate: string,
  options: {
    apiKey?: string;
    fetchImpl?: FetchLike;
    rankedCells?: typeof getSabRankedCells;
  } = {},
) {
  const ranked = await (options.rankedCells ?? getSabRankedCells)(reportKey, [
    placeId,
  ]);
  const business = ranked.businesses.find(
    (candidate) => candidate.place_id === placeId,
  );
  if (!business) {
    throw new Error(
      "The exact Place ID was not found in the requested completed Local Falcon report.",
    );
  }
  if (!business.ranked_cells.length) {
    throw new Error(
      "The exact Place ID has no numeric ranked cells in the requested Local Falcon report.",
    );
  }
  const geocode = await forwardGeocode(
    addressCandidate,
    options.apiKey?.trim() || googleMapsGeocodingApiKey(),
    options.fetchImpl ?? fetch,
  );
  const summary = summarizeSabCenter(business.ranked_cells, ranked.grid.size)!;
  const bestCluster = bestRankCluster(business.ranked_cells);
  const distances = evaluateSabCoordinatesAgainstCells(business.ranked_cells, ranked.grid.size, geocode);
  const defaultThresholdMiles = 3;

  return {
    report_key: ranked.report_key,
    place_id: placeId,
    source: "google_maps_geocoding_and_local_falcon_completed_report" as const,
    lookup_type: "temporary_address_geographic_fit" as const,
    status: geocode.partialMatch
      ? ("incomplete" as const)
      : ("complete" as const),
    candidate_coordinates: {
      latitude: geocode.latitude,
      longitude: geocode.longitude,
    },
    geocoder: {
      source: "google_maps_geocoding_api" as const,
      status: geocode.googleStatus,
      location_type: geocode.locationType,
      partial_match: geocode.partialMatch,
      place_id: geocode.geocoderPlaceId,
      result_types: geocode.resultTypes,
    },
    ranked_evidence: {
      ranked_cell_count: business.ranked_cell_count,
      imprecise_or_unranked_cell_count:
        business.imprecise_or_unranked_cell_count,
      ranked_cells_sha256: summary.ranked_cells_sha256,
      weighted_centroid: summary.centroid,
      best_rank: bestCluster.bestRank,
      best_rank_cluster_cell_count: bestCluster.cells.length,
      best_rank_cluster_candidate_count: bestCluster.candidateCount,
      best_rank_cluster_centroid: bestCluster.centroid,
      raw_ranked_cells_returned: false,
    },
    distances_miles: distances,
    default_consistency_threshold_miles: defaultThresholdMiles,
    within_default_threshold: {
      weighted_centroid: distances.weighted_centroid <= defaultThresholdMiles,
      nearest_ranked_cell:
        distances.nearest_ranked_cell <= defaultThresholdMiles,
      best_rank_cluster_centroid:
        distances.best_rank_cluster_centroid <= defaultThresholdMiles,
    },
    final_fit_decision_returned: false,
    raw_address_returned: false,
    raw_address_persisted: false,
    writes_performed: false,
    scan_executed: false,
  };
}

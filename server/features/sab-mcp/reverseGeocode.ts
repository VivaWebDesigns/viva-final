const GOOGLE_GEOCODING_API_URL =
  "https://maps.googleapis.com/maps/api/geocode/json";
const GOOGLE_GEOCODING_TIMEOUT_MS = 15_000;
const GOOGLE_GEOCODING_STATUSES = new Set([
  "OK", "ZERO_RESULTS", "OVER_DAILY_LIMIT", "OVER_QUERY_LIMIT",
  "REQUEST_DENIED", "INVALID_REQUEST", "UNKNOWN_ERROR",
]);

type FetchLike = typeof fetch;

type GoogleAddressComponent = {
  long_name?: unknown;
  short_name?: unknown;
  types?: unknown;
};

type GoogleGeocodingResult = {
  address_components?: unknown;
  formatted_address?: unknown;
  geometry?: {
    location?: {
      lat?: unknown;
      lng?: unknown;
    };
    location_type?: unknown;
  };
  partial_match?: unknown;
  place_id?: unknown;
  types?: unknown;
};

type GoogleGeocodingResponse = {
  results?: unknown;
  status?: unknown;
};

export type SabScanCenter = {
  place_id: string;
  company?: string;
  latitude: number;
  longitude: number;
};

export type SabReverseGeocodeResult = {
  place_id: string;
  company: string | null;
  latitude: number;
  longitude: number;
  status: "complete" | "incomplete" | "error";
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  // Retained for response compatibility; street-level address text is private.
  formatted_address: null;
  geocoder_place_id: string | null;
  geocoder_latitude: number | null;
  geocoder_longitude: number | null;
  geocoder_distance_meters: number | null;
  location_type: string | null;
  result_types: string[];
  partial_match: boolean;
  google_status: string;
  error: string | null;
};

export type SabReverseGeocodeBatchResult = {
  source: "google_maps_geocoding_api";
  lookup_type: "exact_coordinate_reverse_geocode";
  requested_count: number;
  complete_count: number;
  incomplete_count: number;
  error_count: number;
  results: SabReverseGeocodeResult[];
};

function googleMapsGeocodingApiKey() {
  const apiKey = process.env.GOOGLE_MAPS_GEOCODING_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GOOGLE_MAPS_GEOCODING_API_KEY is not configured for the Viva SAB Workflow connector.",
    );
  }
  return apiKey;
}

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cleanTypes(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string =>
      typeof entry === "string" && Boolean(entry.trim())
    )
    : [];
}

function addressComponents(result: GoogleGeocodingResult) {
  return Array.isArray(result.address_components)
    ? result.address_components.filter((entry) =>
      entry !== null && typeof entry === "object" && !Array.isArray(entry)
    ) as GoogleAddressComponent[]
    : [];
}

function addressComponent(
  result: GoogleGeocodingResult,
  type: string,
  field: "long_name" | "short_name" = "long_name",
) {
  const component = addressComponents(result).find((entry) =>
    cleanTypes(entry.types).includes(type)
  );
  return component ? cleanString(component[field]) : null;
}

function resolvedCity(result: GoogleGeocodingResult) {
  return addressComponent(result, "locality") ??
    addressComponent(result, "postal_town") ??
    addressComponent(result, "sublocality_level_1") ??
    addressComponent(result, "administrative_area_level_3");
}

function resultScore(result: GoogleGeocodingResult) {
  let score = 0;
  if (addressComponent(result, "postal_code")) score += 8;
  if (addressComponent(result, "administrative_area_level_1", "short_name")) {
    score += 4;
  }
  if (resolvedCity(result)) score += 4;
  if (addressComponent(result, "locality")) score += 2;
  if (cleanString(result.geometry?.location_type) === "ROOFTOP") score += 1;
  return score;
}

function selectBestResult(results: GoogleGeocodingResult[]) {
  return results.reduce<GoogleGeocodingResult | null>((best, result) => {
    if (!best || resultScore(result) > resultScore(best)) return result;
    return best;
  }, null);
}

function toRadians(value: number) {
  return value * Math.PI / 180;
}

function distanceMeters(
  latitude: number,
  longitude: number,
  resultLatitude: number | null,
  resultLongitude: number | null,
) {
  if (resultLatitude === null || resultLongitude === null) return null;
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = toRadians(resultLatitude - latitude);
  const longitudeDelta = toRadians(resultLongitude - longitude);
  const firstLatitude = toRadians(latitude);
  const secondLatitude = toRadians(resultLatitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(
    earthRadiusMeters * 2 *
      Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)),
  );
}

function errorResult(
  center: SabScanCenter,
  googleStatus: string,
  error: string,
): SabReverseGeocodeResult {
  return {
    place_id: center.place_id,
    company: center.company?.trim() || null,
    latitude: center.latitude,
    longitude: center.longitude,
    status: "error",
    city: null,
    state: null,
    zip: null,
    county: null,
    formatted_address: null,
    geocoder_place_id: null,
    geocoder_latitude: null,
    geocoder_longitude: null,
    geocoder_distance_meters: null,
    location_type: null,
    result_types: [],
    partial_match: false,
    google_status: googleStatus,
    error,
  };
}

async function reverseGeocodeOne(
  center: SabScanCenter,
  apiKey: string,
  fetchImpl: FetchLike,
): Promise<SabReverseGeocodeResult> {
  const url = new URL(GOOGLE_GEOCODING_API_URL);
  url.searchParams.set("latlng", `${center.latitude},${center.longitude}`);
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
    return errorResult(
      center,
      "NETWORK_ERROR",
      "Google reverse-geocoding request could not be completed.",
    );
  }

  if (!response.ok) {
    return errorResult(
      center,
      `HTTP_${response.status}`,
      `Google reverse-geocoding request failed with HTTP ${response.status}.`,
    );
  }

  let payload: GoogleGeocodingResponse;
  try {
    const parsed: unknown = await response.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Invalid geocoder response");
    }
    payload = parsed as GoogleGeocodingResponse;
  } catch {
    return errorResult(
      center,
      "INVALID_RESPONSE",
      "Google reverse-geocoding returned an unreadable response.",
    );
  }
  // Provider diagnostics can echo request data. Return only known status codes
  // and connector-owned messages, never provider bodies or exception text.
  const rawStatus = cleanString(payload.status);
  const googleStatus = rawStatus && GOOGLE_GEOCODING_STATUSES.has(rawStatus)
    ? rawStatus
    : "UNKNOWN";
  const results = Array.isArray(payload.results)
    ? payload.results.filter((entry) =>
      entry !== null && typeof entry === "object" && !Array.isArray(entry)
    ) as GoogleGeocodingResult[]
    : [];
  const bestResult = selectBestResult(results);

  if (googleStatus !== "OK" || !bestResult) {
    return errorResult(
      center,
      googleStatus,
      "Google did not return a usable reverse-geocoding result for this coordinate.",
    );
  }

  const city = resolvedCity(bestResult);
  const state = addressComponent(
    bestResult,
    "administrative_area_level_1",
    "short_name",
  );
  const zip = addressComponent(bestResult, "postal_code");
  const resultLatitude = cleanNumber(bestResult.geometry?.location?.lat);
  const resultLongitude = cleanNumber(bestResult.geometry?.location?.lng);
  const complete = Boolean(city && state && zip);

  return {
    place_id: center.place_id,
    company: center.company?.trim() || null,
    latitude: center.latitude,
    longitude: center.longitude,
    status: complete ? "complete" : "incomplete",
    city,
    state,
    zip,
    county: addressComponent(bestResult, "administrative_area_level_2"),
    formatted_address: null,
    geocoder_place_id: cleanString(bestResult.place_id),
    geocoder_latitude: resultLatitude,
    geocoder_longitude: resultLongitude,
    geocoder_distance_meters: distanceMeters(
      center.latitude,
      center.longitude,
      resultLatitude,
      resultLongitude,
    ),
    location_type: cleanString(bestResult.geometry?.location_type),
    result_types: cleanTypes(bestResult.types),
    partial_match: bestResult.partial_match === true,
    google_status: googleStatus,
    error: complete
      ? null
      : "Google returned a result but did not resolve city, state, and ZIP.",
  };
}

export async function reverseGeocodeSabCenters(
  centers: SabScanCenter[],
  options: {
    apiKey?: string;
    fetchImpl?: FetchLike;
  } = {},
): Promise<SabReverseGeocodeBatchResult> {
  const apiKey = options.apiKey?.trim() || googleMapsGeocodingApiKey();
  const fetchImpl = options.fetchImpl ?? fetch;
  const results = await Promise.all(
    centers.map((center) => reverseGeocodeOne(center, apiKey, fetchImpl)),
  );

  return {
    source: "google_maps_geocoding_api",
    lookup_type: "exact_coordinate_reverse_geocode",
    requested_count: centers.length,
    complete_count: results.filter((result) => result.status === "complete").length,
    incomplete_count: results.filter((result) =>
      result.status === "incomplete"
    ).length,
    error_count: results.filter((result) => result.status === "error").length,
    results,
  };
}

import { describe, expect, it, vi } from "vitest";
import { reverseGeocodeSabCentersInputSchema } from "../../server/features/sab-mcp/schema";
import { reverseGeocodeSabCenters } from "../../server/features/sab-mcp/reverseGeocode";

function googleResult(overrides: Record<string, unknown> = {}) {
  return {
    address_components: [
      {
        long_name: "Charlotte",
        short_name: "Charlotte",
        types: ["locality", "political"],
      },
      {
        long_name: "North Carolina",
        short_name: "NC",
        types: ["administrative_area_level_1", "political"],
      },
      {
        long_name: "Mecklenburg County",
        short_name: "Mecklenburg County",
        types: ["administrative_area_level_2", "political"],
      },
      {
        long_name: "28277",
        short_name: "28277",
        types: ["postal_code"],
      },
    ],
    formatted_address: "Charlotte, NC 28277, USA",
    geometry: {
      location: { lat: 35.01847, lng: -80.80001 },
      location_type: "GEOMETRIC_CENTER",
    },
    place_id: "geocoder-place",
    types: ["postal_code"],
    ...overrides,
  };
}

describe("SAB exact-coordinate reverse geocoding", () => {
  it("validates exact coordinate inputs", () => {
    const parsed = reverseGeocodeSabCentersInputSchema.centers.parse([{
      place_id: " ChIJ-company ",
      company: " Example HVAC ",
      latitude: 35.018472,
      longitude: -80.8,
    }]);

    expect(parsed).toEqual([{
      place_id: "ChIJ-company",
      company: "Example HVAC",
      latitude: 35.018472,
      longitude: -80.8,
    }]);
    expect(() => reverseGeocodeSabCentersInputSchema.centers.parse([{
      place_id: "ChIJ-company",
      latitude: 91,
      longitude: -80.8,
    }])).toThrow();
  });

  it("returns city, state, and ZIP for the exact coordinate without writing data", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      status: "OK",
      results: [googleResult()],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    const result = await reverseGeocodeSabCenters([{
      place_id: "ChIJ-company",
      company: "Example HVAC",
      latitude: 35.018472,
      longitude: -80.8,
    }], {
      apiKey: "test-key",
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, request] = fetchImpl.mock.calls[0];
    const requestedUrl = new URL(String(url));
    expect(requestedUrl.origin + requestedUrl.pathname).toBe(
      "https://maps.googleapis.com/maps/api/geocode/json",
    );
    expect(requestedUrl.searchParams.get("latlng")).toBe("35.018472,-80.8");
    expect(requestedUrl.searchParams.get("key")).toBe("test-key");
    expect(request?.method).toBe("GET");
    expect(result).toMatchObject({
      source: "google_maps_geocoding_api",
      lookup_type: "exact_coordinate_reverse_geocode",
      requested_count: 1,
      complete_count: 1,
      incomplete_count: 0,
      error_count: 0,
      results: [{
        place_id: "ChIJ-company",
        company: "Example HVAC",
        latitude: 35.018472,
        longitude: -80.8,
        status: "complete",
        city: "Charlotte",
        state: "NC",
        zip: "28277",
        county: "Mecklenburg County",
        formatted_address: "Charlotte, NC 28277, USA",
        google_status: "OK",
        error: null,
      }],
    });
    expect(result.results[0].geocoder_distance_meters).toBeLessThan(5);
  });

  it("prefers a complete market result over the first incomplete result", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      status: "OK",
      results: [
        googleResult({
          address_components: [{
            long_name: "North Carolina",
            short_name: "NC",
            types: ["administrative_area_level_1", "political"],
          }],
          formatted_address: "North Carolina, USA",
        }),
        googleResult(),
      ],
    })));

    const result = await reverseGeocodeSabCenters([{
      place_id: "ChIJ-company",
      latitude: 35.018472,
      longitude: -80.8,
    }], {
      apiKey: "test-key",
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(result.results[0]).toMatchObject({
      status: "complete",
      city: "Charlotte",
      state: "NC",
      zip: "28277",
    });
  });

  it("returns an incomplete result instead of inventing a missing city or ZIP", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      status: "OK",
      results: [googleResult({
        address_components: [{
          long_name: "North Carolina",
          short_name: "NC",
          types: ["administrative_area_level_1", "political"],
        }],
      })],
    })));

    const result = await reverseGeocodeSabCenters([{
      place_id: "ChIJ-company",
      latitude: 35.018472,
      longitude: -80.8,
    }], {
      apiKey: "test-key",
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(result).toMatchObject({
      complete_count: 0,
      incomplete_count: 1,
      error_count: 0,
      results: [{
        status: "incomplete",
        city: null,
        state: "NC",
        zip: null,
      }],
    });
  });

  it("keeps per-coordinate geocoder failures explicit", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      status: "ZERO_RESULTS",
      results: [],
    })));

    const result = await reverseGeocodeSabCenters([{
      place_id: "ChIJ-company",
      latitude: 35.018472,
      longitude: -80.8,
    }], {
      apiKey: "test-key",
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(result).toMatchObject({
      complete_count: 0,
      incomplete_count: 0,
      error_count: 1,
      results: [{
        status: "error",
        google_status: "ZERO_RESULTS",
        city: null,
        state: null,
        zip: null,
      }],
    });
  });

  it("does not expose the API key when a network request fails", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error(
        "Request failed for https://maps.googleapis.com/maps/api/geocode/json?key=secret-key",
      );
    });

    const result = await reverseGeocodeSabCenters([{
      place_id: "ChIJ-company",
      latitude: 35.018472,
      longitude: -80.8,
    }], {
      apiKey: "secret-key",
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(result.results[0]).toMatchObject({
      status: "error",
      google_status: "NETWORK_ERROR",
      error: "Google reverse-geocoding request could not be completed.",
    });
    expect(JSON.stringify(result)).not.toContain("secret-key");
  });
});

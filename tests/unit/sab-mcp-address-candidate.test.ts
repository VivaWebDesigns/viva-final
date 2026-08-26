import { describe, expect, it } from "vitest";
import { evaluateSabAddressCandidate } from "../../server/features/sab-mcp/addressCandidate";

const cells = [
  { row: 3, column: 3, latitude: 35, longitude: -80, rank: 4 },
  { row: 3, column: 4, latitude: 35, longitude: -79.98, rank: 6 },
  { row: 4, column: 3, latitude: 34.98, longitude: -80, rank: 8 },
];

function rankedCells() {
  return Promise.resolve({
    report_key: "report123",
    source: "local_falcon_completed_master_report" as const,
    scan_executed: false as const,
    keyword: "deck builder near me",
    grid: {
      size: 7,
      point_count: 49,
      center: { latitude: 35, longitude: -80 },
      radius: 3,
      measurement: "mi",
      row_orientation: "north_to_south" as const,
      column_orientation: "west_to_east" as const,
    },
    requested_place_id_count: 1,
    found_place_id_count: 1,
    missing_place_id_count: 0,
    missing_place_ids: [],
    businesses: [
      {
        place_id: "place123",
        name: "Neutral Fixture",
        ranked_cell_count: cells.length,
        imprecise_or_unranked_cell_count: 46,
        ranked_cells: cells,
      },
    ],
  });
}

describe("evaluateSabAddressCandidate", () => {
  it("returns compact measured fit evidence without returning the raw address or cells", async () => {
    const rawAddress = "123 Private Test Street, Charlotte, NC";
    const result = await evaluateSabAddressCandidate(
      "report123",
      "place123",
      rawAddress,
      {
        apiKey: "test-key",
        rankedCells,
        fetchImpl: async (input) => {
          const url = new URL(String(input));
          expect(url.searchParams.get("address")).toBe(rawAddress);
          return new Response(
            JSON.stringify({
              status: "OK",
              results: [
                {
                  place_id: "geocoder-place",
                  types: ["street_address"],
                  geometry: {
                    location: { lat: 35.001, lng: -80.001 },
                    location_type: "ROOFTOP",
                  },
                },
              ],
            }),
            { status: 200 },
          );
        },
      },
    );

    expect(result).toMatchObject({
      status: "complete",
      report_key: "report123",
      place_id: "place123",
      raw_address_returned: false,
      raw_address_persisted: false,
      writes_performed: false,
      scan_executed: false,
      final_fit_decision_returned: false,
      ranked_evidence: {
        ranked_cell_count: 3,
        best_rank: 4,
        raw_ranked_cells_returned: false,
      },
    });
    expect(result.distances_miles.weighted_centroid).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(result)).not.toContain(rawAddress);
    expect(JSON.stringify(result)).not.toContain('"ranked_cells"');
  });

  it("marks a partial geocode incomplete while still returning measured evidence", async () => {
    const result = await evaluateSabAddressCandidate(
      "report123",
      "place123",
      "Temporary Candidate",
      {
        apiKey: "test-key",
        rankedCells,
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              status: "OK",
              results: [
                {
                  partial_match: true,
                  geometry: {
                    location: { lat: 35, lng: -80 },
                    location_type: "GEOMETRIC_CENTER",
                  },
                },
              ],
            }),
            { status: 200 },
          ),
      },
    );

    expect(result.status).toBe("incomplete");
    expect(result.geocoder.partial_match).toBe(true);
    expect(result.raw_address_returned).toBe(false);
  });

  it("fails closed when the exact Place ID is absent", async () => {
    await expect(
      evaluateSabAddressCandidate(
        "report123",
        "missing-place",
        "Temporary Candidate",
        {
          apiKey: "test-key",
          rankedCells,
          fetchImpl: async () =>
            new Response(
              JSON.stringify({
                status: "OK",
                results: [
                  {
                    geometry: {
                      location: { lat: 35, lng: -80 },
                      location_type: "ROOFTOP",
                    },
                  },
                ],
              }),
              { status: 200 },
            ),
        },
      ),
    ).rejects.toThrow("exact Place ID was not found");
  });
});

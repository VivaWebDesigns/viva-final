import { describe, expect, it, vi } from "vitest";
import { getSabRankedCellsInputSchema } from "../../server/features/sab-mcp/schema";
import {
  extractSabRankedCells,
  getSabRankedCells,
} from "../../server/features/sab-mcp/localFalconRankedCells";

const gridPoints = [
  { lat: "35.2", lng: "-80.9" },
  { lat: "35.2", lng: "-80.8" },
  { lat: "35.2", lng: "-80.7" },
  { lat: "35.1", lng: "-80.9" },
  { lat: "35.1", lng: "-80.8" },
  { lat: "35.1", lng: "-80.7" },
  { lat: "35.0", lng: "-80.9" },
  { lat: "35.0", lng: "-80.8" },
  { lat: "35.0", lng: "-80.7" },
];

const competitorPayload = {
  success: true,
  data: {
    report_key: "report-123",
    keyword: "roof installation near me",
    lat: "35.1",
    lng: "-80.8",
    grid_size: "3",
    radius: "2",
    measurement: "mi",
    points: "9",
    businesses: [
      {
        place_id: "ChIJ-one",
        name: "One Roofing",
        data_points: [
          { lat: "35.2", lng: "-80.9", rank: 2 },
          { lat: "35.1", lng: "-80.8", rank: "5" },
          { lat: "35.0", lng: "-80.7", rank: "20+" },
        ],
      },
      {
        place_id: "ChIJ-two",
        name: "Two Roofing",
        data_points: [{ lat: "35.1", lng: "-80.9", rank: 7 }],
      },
    ],
  },
};

const gridPayload = {
  success: true,
  data: {
    report_key: "report-123",
    keyword: "roof installation near me",
    lat: "35.1",
    lng: "-80.8",
    grid_size: "3",
    radius: "2",
    measurement: "mi",
    points: "9",
    data_points: gridPoints,
  },
};

describe("SAB Local Falcon ranked-cell extraction", () => {
  it("accepts one completed report key and a bounded selected Place-ID list", () => {
    expect(getSabRankedCellsInputSchema.report_key.parse(" report-123 ")).toBe("report-123");
    expect(getSabRankedCellsInputSchema.place_ids.parse([" ChIJ-one "])).toEqual(["ChIJ-one"]);
  });

  it("maps selected ranked coordinates to exact north/west-oriented cells", () => {
    expect(extractSabRankedCells(
      competitorPayload,
      gridPayload,
      "fallback",
      ["ChIJ-one", "ChIJ-missing"],
    )).toMatchObject({
      report_key: "report-123",
      source: "local_falcon_completed_master_report",
      scan_executed: false,
      keyword: "roof installation near me",
      grid: {
        size: 3,
        point_count: 9,
        center: { latitude: 35.1, longitude: -80.8 },
        radius: 2,
        measurement: "mi",
        row_orientation: "north_to_south",
        column_orientation: "west_to_east",
      },
      requested_place_id_count: 2,
      found_place_id_count: 1,
      missing_place_id_count: 1,
      missing_place_ids: ["ChIJ-missing"],
      businesses: [{
        place_id: "ChIJ-one",
        name: "One Roofing",
        ranked_cell_count: 2,
        imprecise_or_unranked_cell_count: 1,
        ranked_cells: [
          { row: 1, column: 1, latitude: 35.2, longitude: -80.9, rank: 2 },
          { row: 2, column: 2, latitude: 35.1, longitude: -80.8, rank: 5 },
        ],
      }],
    });
  });

  it("fetches the scan grid and full competitor report server-side, then returns only requested companies", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const payload = String(url).includes("/competitor-reports/")
        ? competitorPayload
        : gridPayload;
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const result = await getSabRankedCells(
      "report-123",
      ["ChIJ-two"],
      { apiKey: "secret", fetchImpl: fetchImpl as typeof fetch },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls.some(([url]) =>
      String(url).includes("/competitor-reports/report-123")
    )).toBe(true);
    expect(fetchImpl.mock.calls.some(([url]) =>
      String(url).includes("/reports/report-123/")
    )).toBe(true);
    expect(result.businesses).toEqual([{
      place_id: "ChIJ-two",
      name: "Two Roofing",
      ranked_cell_count: 1,
      imprecise_or_unranked_cell_count: 0,
      ranked_cells: [{
        row: 2,
        column: 1,
        latitude: 35.1,
        longitude: -80.9,
        rank: 7,
      }],
    }]);
  });

  it("rejects incomplete grid geometry instead of assigning proxy cells", () => {
    expect(() => extractSabRankedCells(
      competitorPayload,
      {
        ...gridPayload,
        data: { ...gridPayload.data, data_points: gridPoints.slice(0, 6) },
      },
      "report-123",
      ["ChIJ-one"],
    )).toThrow("not an exact 3x3 coordinate matrix");
  });
});

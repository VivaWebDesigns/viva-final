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
  code: 200,
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
  code: 200,
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
      "report-123",
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
    expect(result.businesses).toMatchObject([{
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


  it("excludes imprecise, nonpositive, noninteger and above20 ranks from centering", () => {
    const ranks = [1, "20", 21, "21", "20+", 0, -1, 4.5];
    const payload = { ...competitorPayload, data: { ...competitorPayload.data, businesses: [{ place_id: "exact", data_points: ranks.map((rank, i) => ({ ...gridPoints[i], rank })) }] } };
    expect(extractSabRankedCells(payload, gridPayload, "report-123", ["exact"]).businesses[0]).toMatchObject({ ranked_cell_count: 2, imprecise_or_unranked_cell_count: 6 });
  });

  it("preserves numeric above20 observations for complete all-point medians without adding them to centering", () => {
    const data_points = [{ ...gridPoints[0], rank: 3 }, { ...gridPoints[1], rank: 47 }, { ...gridPoints[2], rank: "32" }, { ...gridPoints[3], rank: "20+" }, { ...gridPoints[4], rank: false }];
    const payload = { ...competitorPayload, data: { ...competitorPayload.data, businesses: [{ place_id: "exact", data_points }] } };
    const result = extractSabRankedCells(payload, gridPayload, "report-123", ["exact"]).businesses[0];
    expect(result.ranked_cells).toHaveLength(1);
    expect(result.ranked_cells[0].rank).toBe(3);
    expect(result.all_point_rank_cells).toHaveLength(9);
    expect(result.all_point_rank_cells.map(point => point.rank)).toEqual([3, 47, 32, 21, 21, 21, 21, 21, 21]);
  });

  it("returns only a provider-supplied secure public report URL", () => {
    const public_url = "https://localrankingtracker.com/scan-report/report-123/public-token/";
    expect(extractSabRankedCells(competitorPayload, { ...gridPayload, data: { ...gridPayload.data, public_url } }, "report-123", ["ChIJ-one"]).public_url).toBe(public_url);
    expect(extractSabRankedCells(competitorPayload, gridPayload, "report-123", ["ChIJ-one"]).public_url).toBeNull();
    expect(extractSabRankedCells(competitorPayload, { ...gridPayload, data: { ...gridPayload.data, public_url: "javascript:alert(1)" } }, "report-123", ["ChIJ-one"]).public_url).toBeNull();
  });

  it("keeps all-point ATRP distinct from raw ARP", () => {
    const result = extractSabRankedCells(competitorPayload, { ...gridPayload, data: { ...gridPayload.data, arp: 4, atrp: 13, solv: 10 } }, "report-123", ["ChIJ-one"]);
    expect(result).toMatchObject({ arp: 4, atrp: 13, solv: 10 });
  });

  it("rejects a grid with all axes but one duplicate and one missing coordinate", () => {
    const data_points = [...gridPoints.slice(0, 8), gridPoints[0]];
    expect(() => extractSabRankedCells(competitorPayload, { ...gridPayload, data: { ...gridPayload.data, data_points } }, "report-123", ["ChIJ-one"])).toThrow("not an exact");
  });

  it("rejects off-grid ranked coordinates and duplicate ranked positions", () => {
    for (const data_points of [[{ lat: "45", lng: "-80.8", rank: 2 }], [{ ...gridPoints[0], rank: 1 }, { ...gridPoints[0], rank: 2 }]]) {
      const payload = { ...competitorPayload, data: { ...competitorPayload.data, businesses: [{ place_id: "exact", data_points }] } };
      expect(() => extractSabRankedCells(payload, gridPayload, "report-123", ["exact"])).toThrow();
    }
  });

  it("requires exact report identity and authoritative completion before analyzing", () => {
    expect(() => extractSabRankedCells(competitorPayload, gridPayload, "wrong-report", ["ChIJ-one"])).toThrow("exact requested report key");
    for (const payload of [
      { ...gridPayload, code: 202, data: { ...gridPayload.data, status: "processing" } },
      { ...gridPayload, code: 200, data: { ...gridPayload.data, status: "processing" } },
      { ...gridPayload, code: undefined },
    ]) expect(() => extractSabRankedCells(competitorPayload, payload, "report-123", ["ChIJ-one"])).toThrow("completion is not verified");
  });

  it("does not accept HTTP202 as a successful completed report", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ...gridPayload, code: 202 }), { status: 202 }));
    await expect(getSabRankedCells("report-123", ["ChIJ-one"], { apiKey: "secret", fetchImpl })).rejects.toThrow("not complete (HTTP 202)");
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

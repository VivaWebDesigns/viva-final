import { describe, expect, it, vi } from "vitest";
import {
  analyzeSabMasterCenters,
  createSabWorkflowFromMasterReport,
  summarizeSabCenter,
} from "../../server/features/sab-mcp/localFalconMaster";

const gridPoints = [
  { lat: 35.2, lng: -80.9 },
  { lat: 35.2, lng: -80.8 },
  { lat: 35.2, lng: -80.7 },
  { lat: 35.1, lng: -80.9 },
  { lat: 35.1, lng: -80.8 },
  { lat: 35.1, lng: -80.7 },
  { lat: 35.0, lng: -80.9 },
  { lat: 35.0, lng: -80.8 },
  { lat: 35.0, lng: -80.7 },
];

describe("SAB server-side master ledger", () => {
  it("creates a durable ledger without returning the roster or a raw address", async () => {
    const createWorkflow = vi.fn(async (_title, rows) => ({
      workflow_sheet: "https://docs.google.com/spreadsheets/d/sheet-1",
      spreadsheet_id: "sheet-1",
      sheet_name: "SAB Workflow",
      row_count: rows.length,
      progress: {},
    }));
    const payload = {
      success: true,
      data: {
        report_key: "master-1",
        keyword: "deck builder near me",
        businesses: [
          {
            place_id: "ChIJ-pass",
            name: "Pass Decks",
            address: false,
            rating: 4.8,
            reviews: 8,
            category: "Deck builder",
            phone: "+17045550101",
          },
          {
            place_id: "ChIJ-public",
            name: "Public Address Decks",
            address: "123 Private St, Charlotte, NC",
            rating: 4.9,
            reviews: 12,
          },
          {
            place_id: "ChIJ-pass",
            name: "Duplicate row",
          },
        ],
      },
    };
    const result = await createSabWorkflowFromMasterReport(
      "Charlotte Deck Builders",
      "master-1",
      40,
      { createWorkflow },
      "matt@vivawebdesigns.com",
      {
        apiKey: "secret",
        fetchImpl: vi.fn(
          async () =>
            new Response(JSON.stringify(payload), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
        ) as typeof fetch,
        checkPlaceIds: vi.fn(async (placeIds) => ({
          criterion: "exact_place_id_equals" as const,
          source: "local_falcon_prospect_profiles.place_id" as const,
          requested_count: placeIds.length,
          unique_place_id_count: placeIds.length,
          matched_place_id_count: 0,
          unmatched_place_id_count: placeIds.length,
          matched_place_ids: [],
          unmatched_place_ids: placeIds,
          matches: [],
        })),
      },
    );

    expect(createWorkflow).toHaveBeenCalledOnce();
    const rows = createWorkflow.mock.calls[0][1];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      place_id: "ChIJ-pass",
      address: "Service Area Business",
      status: "assigned",
    });
    expect(rows[1]).toMatchObject({
      place_id: "ChIJ-public",
      address: null,
      status: "complete",
      qualification_status: "disqualified",
    });
    expect(JSON.stringify(rows)).not.toContain("123 Private St");
    expect(result).toMatchObject({
      source_business_count: 3,
      unique_place_id_count: 2,
      duplicate_place_id_count: 1,
      roster_returned_inline: false,
      raw_addresses_persisted: false,
      scan_executed: false,
    });
    expect(result).not.toHaveProperty("rows");
  });
});

describe("SAB compact master centering", () => {
  it("computes the SOP centroid, spread, clusters, two-ring edge flag, and hash", () => {
    const analysis = summarizeSabCenter(
      [
        { row: 3, column: 3, latitude: 35.2, longitude: -80.9, rank: 2 },
        { row: 3, column: 4, latitude: 35.2, longitude: -80.8, rank: 4 },
        { row: 4, column: 3, latitude: 35.1, longitude: -80.9, rank: 5 },
        { row: 4, column: 4, latitude: 35.1, longitude: -80.8, rank: 6 },
        { row: 5, column: 4, latitude: 35.0, longitude: -80.8, rank: 8 },
      ],
      9,
    );

    expect(analysis).toMatchObject({
      ranked_cell_count: 5,
      best_rank: 2,
      edge_flagged: false,
      cluster_count: 1,
      spread_in_both_axes: true,
      one_coherent_cluster: true,
      baseline_centroid_trustworthy: true,
      ranked_cells_returned: false,
    });
    expect(analysis?.ranked_cells_sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns compact diagnostics without raw ranked cells", async () => {
    const competitorPayload = {
      success: true,
      data: {
        report_key: "master-1",
        keyword: "deck builder near me",
        lat: 35.1,
        lng: -80.8,
        grid_size: 3,
        radius: 7,
        measurement: "mi",
        businesses: [
          {
            place_id: "ChIJ-one",
            name: "One Decks",
            data_points: [
              { lat: 35.2, lng: -80.9, rank: 3 },
              { lat: 35.1, lng: -80.8, rank: 5 },
            ],
          },
        ],
      },
    };
    const gridPayload = {
      success: true,
      data: {
        report_key: "master-1",
        keyword: "deck builder near me",
        lat: 35.1,
        lng: -80.8,
        grid_size: 3,
        radius: 7,
        measurement: "mi",
        data_points: gridPoints,
      },
    };
    const result = await analyzeSabMasterCenters("master-1", ["ChIJ-one"], {
      apiKey: "secret",
      fetchImpl: vi.fn(
        async (url) =>
          new Response(
            JSON.stringify(
              String(url).includes("competitor-reports")
                ? competitorPayload
                : gridPayload,
            ),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
      ) as typeof fetch,
    });

    expect(result.businesses[0].analysis).toMatchObject({
      ranked_cell_count: 2,
      best_rank: 3,
      baseline_centroid_trustworthy: false,
      ranked_cells_returned: false,
    });
    expect(JSON.stringify(result)).not.toContain('ranked_cells"');
    expect(JSON.stringify(result)).not.toContain('"latitude":35.2');
  });
});

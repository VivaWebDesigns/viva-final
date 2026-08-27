import { describe, expect, it, vi } from "vitest";
import { verifySabScanHistoryRepairs } from "../../server/features/sab-mcp/scanHistoryReconciliation";

const repair = {
  report_key: "4826693261fc566",
  expected_place_id: "kj-place",
  disposition: "attach_verified_auxiliary" as const,
  remove_from_place_ids: ["vivid-place"],
  authorization_id: "e8f20e3a-5422-4fdf-a34b-21860cfbe6df",
  reason: "Repair an ambiguous provider response.",
  expected: {
    scan_role: "auxiliary" as const,
    scan_type: "scout" as const,
    scan_center: "35.1,-80.9",
    grid_size: 9 as const,
    radius: 6,
    measurement: "mi" as const,
    keyword: "deck builder near me",
    platform: "google" as const,
  },
};

function report(subject = "kj-place") {
  return {
    report_key: repair.report_key,
    report_subject_place_id: subject,
    scan_date: "2026-08-26",
    source: "local_falcon_completed_master_report",
    scan_executed: false,
    keyword: "deck builder near me",
    platform: "google",
    arp: 9.1,
    solv: 4.2,
    found_in: 12,
    grid: {
      size: 9,
      point_count: 81,
      radius: 6,
      measurement: "mi",
      center: { latitude: 35.1, longitude: -80.9 },
      row_orientation: "north_to_south",
      column_orientation: "west_to_east",
    },
    requested_place_id_count: 1,
    found_place_id_count: 1,
    missing_place_id_count: 0,
    missing_place_ids: [],
    businesses: [
      {
        place_id: "kj-place",
        name: "KJ",
        ranked_cell_count: 12,
        imprecise_or_unranked_cell_count: 0,
        ranked_cells: [],
      },
    ],
  } as const;
}

describe("SAB scan-history repair verification", () => {
  it("verifies subject identity and the exact scan envelope server-side", async () => {
    const getRankedCells = vi.fn().mockResolvedValue(report());
    const [verified] = await verifySabScanHistoryRepairs([repair], {
      getRankedCells: getRankedCells as never,
    });

    expect(getRankedCells).toHaveBeenCalledWith(
      repair.report_key,
      [repair.expected_place_id],
      expect.any(Object),
    );
    expect(verified.actual).toMatchObject({
      scan_center: "35.1,-80.9",
      grid_size: 9,
      radius: 6,
      found_in: 12,
    });
    expect(verified.reconciliation_id).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects a report whose actual subject Place ID differs", async () => {
    await expect(
      verifySabScanHistoryRepairs([repair], {
        getRankedCells: vi
          .fn()
          .mockResolvedValue(report("vivid-place")) as never,
      }),
    ).rejects.toThrow("report subject Place ID");
  });
});

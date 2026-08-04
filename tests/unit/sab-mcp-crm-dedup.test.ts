import { describe, expect, it } from "vitest";
import { checkCrmPlaceIdsInputSchema } from "../../server/features/sab-mcp/schema";
import { buildCrmPlaceIdCheckResult } from "../../server/features/sab-mcp/crmDedup";

describe("SAB CRM Place ID deduplication", () => {
  it("accepts a bulk list of exact Google Place IDs", () => {
    expect(checkCrmPlaceIdsInputSchema.place_ids.parse([
      "ChIJ-one",
      "ChIJ-two",
    ])).toEqual(["ChIJ-one", "ChIJ-two"]);
  });

  it("reports exact matches, unmatched IDs, and prior import provenance", () => {
    const result = buildCrmPlaceIdCheckResult(
      ["ChIJ-one", "ChIJ-two", "ChIJ-one"],
      [{
        place_id: "ChIJ-one",
        lead_id: "lead-1",
        company_name: "Example Plumbing",
        batch_id: "charlotte-plumbing-2026-08",
        report_key: "report-1",
        report_url: "https://www.localfalcon.com/reports/view/report-1",
        scan_date: new Date("2026-08-01T12:00:00.000Z"),
      }],
    );

    expect(result).toMatchObject({
      criterion: "exact_place_id_equals",
      source: "local_falcon_prospect_profiles.place_id",
      requested_count: 3,
      unique_place_id_count: 2,
      matched_place_id_count: 1,
      unmatched_place_id_count: 1,
      matched_place_ids: ["ChIJ-one"],
      unmatched_place_ids: ["ChIJ-two"],
    });
    expect(result.matches).toEqual([{
      place_id: "ChIJ-one",
      lead_id: "lead-1",
      company_name: "Example Plumbing",
      batch_id: "charlotte-plumbing-2026-08",
      report_key: "report-1",
      report_url: "https://www.localfalcon.com/reports/view/report-1",
      scan_date: "2026-08-01T12:00:00.000Z",
    }]);
  });

  it("ignores rows outside the requested Place ID set", () => {
    const result = buildCrmPlaceIdCheckResult(
      ["ChIJ-requested"],
      [{
        place_id: "ChIJ-other",
        lead_id: "lead-2",
        company_name: "Other Plumbing",
        batch_id: "other-batch",
        report_key: "report-2",
        report_url: null,
        scan_date: new Date("2026-08-02T12:00:00.000Z"),
      }],
    );

    expect(result.matches).toEqual([]);
    expect(result.unmatched_place_ids).toEqual(["ChIJ-requested"]);
  });
});

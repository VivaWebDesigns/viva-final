import { describe, expect, it, vi } from "vitest";
import { checkCrmLocalFalconReportInputSchema } from "../../server/features/sab-mcp/schema";
import {
  checkCrmPlaceIdsFromLocalFalconReport,
  extractLocalFalconPlaceIds,
} from "../../server/features/sab-mcp/localFalconDedup";

describe("SAB Local Falcon report CRM deduplication", () => {
  it("accepts a completed competitor report key", () => {
    expect(
      checkCrmLocalFalconReportInputSchema.report_key.parse(" report-123 "),
    ).toBe("report-123");
  });

  it("extracts unique Place IDs and reports missing and duplicate values", () => {
    expect(extractLocalFalconPlaceIds({
      success: true,
      data: {
        report_key: "report-123",
        businesses: [
          { place_id: "ChIJ-one" },
          { place_id: "ChIJ-two" },
          { place_id: "ChIJ-one" },
          { place_id: null },
        ],
      },
    }, "fallback-key")).toEqual({
      reportKey: "report-123",
      sourceBusinessCount: 4,
      businessesWithPlaceIdCount: 3,
      businessesMissingPlaceIdCount: 1,
      duplicatePlaceIdCount: 1,
      uniquePlaceIds: ["ChIJ-one", "ChIJ-two"],
    });
  });

  it("fetches the report and checks every unique Place ID without returning the full unmatched list", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      data: {
        report_key: "report-123",
        businesses: [
          { place_id: "ChIJ-one" },
          { place_id: "ChIJ-two" },
          { place_id: "ChIJ-one" },
        ],
      },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const checkPlaceIds = vi.fn(async (placeIds: string[]) => ({
      criterion: "exact_place_id_equals" as const,
      source: "local_falcon_prospect_profiles.place_id" as const,
      requested_count: placeIds.length,
      unique_place_id_count: placeIds.length,
      matched_place_id_count: 1,
      unmatched_place_id_count: 1,
      matched_place_ids: ["ChIJ-one"],
      unmatched_place_ids: ["ChIJ-two"],
      matches: [{
        place_id: "ChIJ-one",
        lead_id: "lead-1",
        company_name: "Existing Roofer",
        batch_id: "prior-batch",
        report_key: "prior-report",
        report_url: null,
        scan_date: "2026-08-01T12:00:00.000Z",
      }],
    }));

    const result = await checkCrmPlaceIdsFromLocalFalconReport("report-123", {
      apiKey: "secret-key",
      fetchImpl: fetchImpl as typeof fetch,
      checkPlaceIds,
    });

    expect(checkPlaceIds).toHaveBeenCalledWith(["ChIJ-one", "ChIJ-two"]);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, request] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain("/competitor-reports/report-123");
    expect(String(url)).toContain("fieldmask=");
    expect(request?.headers).toMatchObject({
      Authorization: "Bearer secret-key",
    });
    expect(result).toMatchObject({
      report_key: "report-123",
      source_business_count: 3,
      businesses_with_place_id_count: 3,
      businesses_missing_place_id_count: 0,
      unique_place_id_count: 2,
      duplicate_place_id_count: 1,
      matched_place_id_count: 1,
      unmatched_place_id_count: 1,
      matched_place_ids: ["ChIJ-one"],
      unmatched_place_ids_omitted: true,
    });
    expect(result.place_id_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result).not.toHaveProperty("unmatched_place_ids");
  });

  it("fails clearly when Local Falcon rejects the report request", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 401 }));

    await expect(checkCrmPlaceIdsFromLocalFalconReport("report-123", {
      apiKey: "invalid-key",
      fetchImpl: fetchImpl as typeof fetch,
      checkPlaceIds: vi.fn(),
    })).rejects.toThrow("HTTP 401");
  });
});

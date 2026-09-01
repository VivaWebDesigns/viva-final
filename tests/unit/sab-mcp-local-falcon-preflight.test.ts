import { describe, expect, it, vi } from "vitest";
import {
  preflightSabLocalFalconBatch,
  type SabLocalFalconPreflightScan,
} from "../../server/features/sab-mcp/localFalconPreflight";

const scan: SabLocalFalconPreflightScan = {
  place_id: "ChIJ-exact",
  scan_role: "deliverable",
  scan_type: "standard",
  center: { latitude: 35.123456, longitude: -80.654321 },
  grid_size: 7,
  radius: 3,
  measurement: "mi",
  keyword: "house painter near me",
  platform: "google",
  estimated_credits: 49,
};

function json(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function requestBody(init?: RequestInit) {
  return new URLSearchParams(String(init?.body ?? ""));
}

describe("Local Falcon batch preflight", () => {
  it("returns live credits, saved-location prerequisites, and authorization-ready no-duplicate evidence", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(url)).pathname;
      if (path === "/v2/account") {
        return json({ success: true, data: { credits: { total_usable_credits: 500 } } });
      }
      if (path === "/v1/reports/") {
        expect(requestBody(init).has("place_id")).toBe(false);
        return json({
          success: true,
          data: {
            reports: [
              { ...scan.center, lat: scan.center.latitude, lng: scan.center.longitude, ...scan, radius: 5, report_key: "different-radius" },
            ],
            next_token: null,
          },
        });
      }
      if (path === "/v1/locations/") {
        return json({
          success: true,
          data: { locations: [{ place_id: scan.place_id }], next_token: null },
        });
      }
      throw new Error(`Unexpected Local Falcon path: ${path}`);
    });

    const result = await preflightSabLocalFalconBatch([scan], {
      apiKey: "secret",
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(result).toMatchObject({
      read_only: true,
      scans_submitted: 0,
      writes_performed: false,
      exact_duplicate_count: 0,
      ready_for_authorization: true,
      account: {
        total_usable_credits: 500,
        planned_credits: 49,
        sufficient_credits: true,
      },
      results: [{
        saved_location: true,
        duplicate_report_result: "none",
        scan: { ...scan, save_location_required: false },
      }],
    });
    expect(result.authorization_duplicate_report_checks).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(result.authorization_duplicate_report_checks[0]).toMatchObject({
      scan: { ...scan, save_location_required: false },
      result: "none",
      evidence_reference: result.evidence_reference,
      checked_at: result.checked_at,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("finds an exact report across paginated history and blocks authorization", async () => {
    let reportPage = 0;
    let locationPage = 0;
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(url)).pathname;
      if (path === "/v2/account") {
        return json({ success: true, data: { credits: { total_usable_credits: 40 } } });
      }
      if (path === "/v1/reports/") {
        reportPage += 1;
        if (reportPage === 1) {
          return json({ success: true, data: { reports: [], next_token: "reports-2" } });
        }
        expect(requestBody(init).get("next_token")).toBe("reports-2");
        return json({
          success: true,
          data: {
            reports: [{
              report_key: "abc123abc123",
              status: "processing",
              public_url: "https://localrankingtracker.com/scan-report/abc123abc123/token/",
              place_id: scan.place_id,
              keyword: scan.keyword,
              platform: scan.platform,
              lat: scan.center.latitude + 0.0000004,
              lng: scan.center.longitude - 0.0000004,
              grid_size: scan.grid_size,
              radius: scan.radius,
              measurement: scan.measurement,
            }],
            next_token: null,
          },
        });
      }
      if (path === "/v1/locations/") {
        locationPage += 1;
        if (locationPage === 1) {
          return json({ success: true, data: { locations: [], next_token: "locations-2" } });
        }
        expect(requestBody(init).get("next_token")).toBe("locations-2");
        return json({ success: true, data: { locations: [], next_token: null } });
      }
      throw new Error(`Unexpected Local Falcon path: ${path}`);
    });

    const result = await preflightSabLocalFalconBatch([scan], {
      apiKey: "secret",
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(result.ready_for_authorization).toBe(false);
    expect(result.exact_duplicate_count).toBe(1);
    expect(result.authorization_duplicate_report_checks).toEqual([]);
    expect(result.results[0]).toMatchObject({
      saved_location: false,
      duplicate_report_result: "equivalent_report_exists",
      scan: { save_location_required: true },
      matching_reports: [{
        report_key: "abc123abc123",
        status: "processing",
        public_url: "https://localrankingtracker.com/scan-report/abc123abc123/token/",
      }],
    });
  });

  it("fails closed when provider pagination is incomplete", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const path = new URL(String(url)).pathname;
      if (path === "/v2/account") {
        return json({ success: true, data: { credits: { total_usable_credits: 500 } } });
      }
      return json({ success: true, data: {} });
    });

    await expect(preflightSabLocalFalconBatch([scan], {
      apiKey: "secret",
      fetchImpl: fetchImpl as typeof fetch,
    })).rejects.toThrow("returned an incomplete page");
  });
});

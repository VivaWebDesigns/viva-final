import { describe, expect, it, vi } from "vitest";
import { runSabScanOnce } from "../../server/features/sab-mcp/localFalconScanSubmission";

const input = {
  authorization_id: "e8f20e3a-5422-4fdf-a34b-21860cfbe6df",
  company_name: "KJ Home Improvement",
  place_id: "kj-place",
  scan_role: "auxiliary" as const,
  scan_type: "scout" as const,
  center: { latitude: 35.1, longitude: -80.9 },
  grid_size: 9 as const,
  radius: 6,
  measurement: "mi" as const,
  keyword: "deck builder near me",
  platform: "google" as const,
  estimated_credits: 81,
  save_location_required: false,
  eligibility_gate_result: "passed" as const,
  duplicate_report_result: "none" as const,
  retry_after_ambiguous_submission: false as const,
  center_derivation: "Authorized westward scout.",
  sop_routing_rule: "SOP section 10.5",
};

function exactResponse(placeId = "kj-place") {
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        report_key: "4826693261fc566",
        status: "pending",
        place_id: placeId,
        lat: 35.1,
        lng: -80.9,
        grid_size: 9,
        radius: 6,
        measurement: "mi",
        keyword: "deck builder near me",
        platform: "google",
      },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function repository() {
  let entry: Record<string, unknown> | undefined;
  return {
    reserveScanSubmission: vi.fn(
      async (reservation: Record<string, unknown>) => {
        if (entry) return { created: false, place_id: "kj-place", entry };
        entry = { ...reservation, submission_status: "preparing_location" };
        return { created: true, place_id: "kj-place", entry };
      },
    ),
    updateScanSubmission: vi.fn(
      async (
        _placeId: string,
        _key: string,
        updates: Record<string, unknown>,
      ) => {
        entry = { ...entry, ...updates };
        return entry;
      },
    ),
  };
}

describe("guarded SAB scan submission", () => {
  it("submits once, records the key, and deduplicates the same call", async () => {
    const repo = repository();
    const fetchImpl = vi.fn().mockResolvedValue(exactResponse());
    const first = await runSabScanOnce(input, repo as never, "matt@viva", {
      apiKey: "test-key",
      fetchImpl: fetchImpl as never,
    });
    const second = await runSabScanOnce(input, repo as never, "matt@viva", {
      apiKey: "test-key",
      fetchImpl: fetchImpl as never,
    });

    expect(first).toMatchObject({
      submission_status: "submitted",
      report_key: "4826693261fc566",
      scans_executed: true,
    });
    expect(second).toMatchObject({
      submission_status: "submitted",
      report_key: "4826693261fc566",
      scans_executed: false,
      deduplicated: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("durably stops after a lost response and never retries", async () => {
    const repo = repository();
    const fetchImpl = vi.fn().mockRejectedValue(new Error("connection lost"));
    const first = await runSabScanOnce(input, repo as never, "matt@viva", {
      apiKey: "test-key",
      fetchImpl: fetchImpl as never,
    });
    const second = await runSabScanOnce(input, repo as never, "matt@viva", {
      apiKey: "test-key",
      fetchImpl: fetchImpl as never,
    });

    expect(first).toMatchObject({
      submission_status: "ambiguous_response",
      scans_executed: "unknown",
      retry_permitted: false,
    });
    expect(second).toMatchObject({
      submission_status: "ambiguous_response",
      scans_executed: false,
      stopped_for_manual_reconciliation: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("treats a mismatched echoed Place ID as ambiguous and never retries", async () => {
    const repo = repository();
    const fetchImpl = vi.fn().mockResolvedValue(exactResponse("vivid-place"));
    const result = await runSabScanOnce(input, repo as never, "matt@viva", {
      apiKey: "test-key",
      fetchImpl: fetchImpl as never,
    });

    expect(result).toMatchObject({
      submission_status: "ambiguous_response",
      retry_permitted: false,
    });
    expect(repo.updateScanSubmission).toHaveBeenLastCalledWith(
      "kj-place",
      expect.any(String),
      expect.objectContaining({ submission_status: "ambiguous_response" }),
      "matt@viva",
    );
  });
});

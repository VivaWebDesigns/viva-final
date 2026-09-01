import { describe, expect, it, vi } from "vitest";
import { runSabScanOnce } from "../../server/features/sab-mcp/localFalconScanSubmission";
import { authorizeSabScanBatch, createSabRunState, completeSabRunReports } from "../../server/features/sab-mcp/runState";

const input = {
  run_id: "test-run",
  authorization_id: "e8f20e3a-5422-4fdf-a34b-21860cfbe6df",
  company_name: "Example service provider",
  place_id: "test-place",
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

function exactResponse(placeId = "test-place") {
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

function acceptedResponseWithParameterEnvelope() {
  return new Response(
    JSON.stringify({
      success: true,
      parameters: {
        place_id: "test-place",
        keyword: "deck builder near me",
        lat: "35.1",
        lng: "-80.9",
        grid_size: "9",
        distance: "6",
        measurement: "mi",
        platform: "google",
      },
      data: {
        report_key: "4826693261fc566",
        status: "pending",
      },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function savedLocationResponse(placeId = "test-place", platform = "google") {
  return new Response(
    JSON.stringify({
      code: 200,
      success: true,
      message: "Your location has been successfully added",
      parameters: { platform, place_id: placeId },
      data: [],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function repository(plan = input) {
  let entry: Record<string, unknown> | undefined;
  let state = authorizeSabScanBatch(createSabRunState({
    run_id: input.run_id, orchestrator_id: "orchestrator", authorization_reference: "explicit-run-approval", credit_limit: 162,
  }), { authorization_id: input.authorization_id, orchestrator_id: "orchestrator", authorization_reference: "initial-plan", scans: [plan], matt_initial_approval: { approved_by: "Matt", approval_reference: "initial-exact-plan-approval" } });
  return {
    getScanSubmission: vi.fn(async (_placeId: string, key: string) => entry?.idempotency_key === key ? entry : null),
    getRunState: vi.fn(async () => structuredClone(state)),
    saveRunState: vi.fn(async (next: typeof state, expectedVersion: number) => {
      if (expectedVersion !== state.version) throw new Error("Concurrent run state change.");
      state = structuredClone(next);
    }),
    reserveScanSubmission: vi.fn(
      async (reservation: Record<string, unknown>) => {
        if (entry) return { created: false, place_id: "test-place", entry };
        entry = { ...reservation, submission_status: "preparing_location" };
        return { created: true, place_id: "test-place", entry };
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

  it("accepts an eager pending response whose exact envelope is in parameters", async () => {
    const repo = repository();
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(acceptedResponseWithParameterEnvelope());

    await expect(
      runSabScanOnce(input, repo as never, "matt@viva", {
        apiKey: "test-key",
        fetchImpl: fetchImpl as never,
      }),
    ).resolves.toMatchObject({
      submission_status: "submitted",
      report_key: "4826693261fc566",
      provider_status: "pending",
      scans_executed: true,
    });
    expect(repo.updateScanSubmission).toHaveBeenLastCalledWith(
      "test-place",
      expect.any(String),
      expect.objectContaining({
        submission_status: "submitted",
        report_key: "4826693261fc566",
      }),
      "matt@viva",
    );
  });

  it("saves and verifies the exact location using Local Falcon's documented parameter envelope", async () => {
    const repo = repository({ ...input, save_location_required: true });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(savedLocationResponse())
      .mockResolvedValueOnce(exactResponse());

    const result = await runSabScanOnce(
      { ...input, save_location_required: true },
      repo as never,
      "matt@viva",
      { apiKey: "test-key", fetchImpl: fetchImpl as never },
    );

    expect(result).toMatchObject({
      submission_status: "submitted",
      scans_executed: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const saveRequest = fetchImpl.mock.calls[0];
    expect(saveRequest[0]).toBe("https://api.localfalcon.com/v2/locations/add");
    expect(String(saveRequest[1]?.body)).toContain("platform=google");
    expect(String(saveRequest[1]?.body)).toContain("place_id=test-place");
    expect(repo.updateScanSubmission).toHaveBeenCalledWith(
      "test-place",
      expect.any(String),
      expect.objectContaining({
        location_status: "verified",
        location_place_id: "test-place",
      }),
      "matt@viva",
    );
  });

  it("returns the exact location-verification error and does not launch a scan", async () => {
    const repo = repository({ ...input, save_location_required: true });
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(savedLocationResponse("different-place"));

    const result = await runSabScanOnce(
      { ...input, save_location_required: true },
      repo as never,
      "matt@viva",
      { apiKey: "test-key", fetchImpl: fetchImpl as never },
    );

    expect(result).toMatchObject({
      submission_status: "location_unverified",
      scans_executed: false,
      error: expect.stringContaining('"place_id":"different-place"'),
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
      report_key: "4826693261fc566",
      retry_permitted: false,
    });
    expect(repo.updateScanSubmission).toHaveBeenLastCalledWith(
      "test-place",
      expect.any(String),
      expect.objectContaining({
        submission_status: "ambiguous_response",
        report_key: "4826693261fc566",
      }),
      "matt@viva",
    );
  });

  it("rejects arbitrary authorization UUIDs and changed exact envelopes before reserving or spending", async () => {
    for (const changed of [
      { authorization_id: "another-uuid" },
      { radius: 5 },
      { center: { latitude: 35.11, longitude: -80.9 } },
      { keyword: "another keyword" },
      { save_location_required: true },
    ]) {
      const repo = repository();
      const fetchImpl = vi.fn();
      await expect(runSabScanOnce({ ...input, ...changed }, repo as never, "actor", { apiKey: "test", fetchImpl }))
        .rejects.toThrow(/authorization|envelope/);
      expect(repo.reserveScanSubmission).not.toHaveBeenCalled();
      expect(repo.saveRunState).not.toHaveBeenCalled();
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  it("requires structured run state for new submissions, but still reads legacy receipts", async () => {
    const repo = repository();
    const fetchImpl = vi.fn().mockResolvedValue(exactResponse());
    await expect(runSabScanOnce({ ...input, run_id: undefined }, repo as never, "actor", { apiKey: "test", fetchImpl }))
      .rejects.toThrow(/structured run/);
    await runSabScanOnce(input, repo as never, "actor", { apiKey: "test", fetchImpl });
    await expect(runSabScanOnce({ ...input, run_id: undefined }, repo as never, "actor", { apiKey: "test", fetchImpl }))
      .resolves.toMatchObject({ deduplicated: true, scans_executed: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retains receipt access during the mandatory review pause without submitting again", async () => {
    const repo = repository();
    const fetchImpl = vi.fn().mockResolvedValue(exactResponse());
    await runSabScanOnce(input, repo as never, "actor", { apiKey: "test", fetchImpl });
    const state = await repo.getRunState();
    await repo.saveRunState(completeSabRunReports(state, ["4826693261fc566"]), state.version);
    await expect(runSabScanOnce(input, repo as never, "actor", { apiKey: "test", fetchImpl }))
      .resolves.toMatchObject({ deduplicated: true, scans_executed: false });
    await expect(runSabScanOnce({ ...input, authorization_id: "new-batch" }, repo as never, "actor", { apiKey: "test", fetchImpl }))
      .rejects.toThrow(/review/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("resumes an exact run-state-only claim after the submission reservation write fails", async () => {
    const repo = repository();
    const fetchImpl = vi.fn().mockResolvedValue(exactResponse());
    repo.reserveScanSubmission
      .mockRejectedValueOnce(new Error("reservation failed"))
      .mockResolvedValueOnce({
        created: true,
        place_id: "test-place",
        entry: {},
      });
    await expect(runSabScanOnce(input, repo as never, "actor", { apiKey: "test", fetchImpl }))
      .rejects.toThrow("reservation failed");
    expect((await repo.getRunState()).committed_credits).toBe(81);
    await expect(runSabScanOnce(input, repo as never, "actor", { apiKey: "test", fetchImpl }))
      .resolves.toMatchObject({
        submission_status: "submitted",
        report_key: "4826693261fc566",
        scans_executed: true,
      });
    expect((await repo.getRunState()).committed_credits).toBe(81);
    expect(repo.reserveScanSubmission).toHaveBeenCalledTimes(2);
    expect(repo.updateScanSubmission).toHaveBeenCalledWith(
      "test-place",
      expect.any(String),
      expect.objectContaining({
        recovery: "automatic_run_state_only_pre_provider_resume",
        recovery_basis:
          "exact_active_reserved_claim_with_no_submission_receipt",
      }),
      "actor",
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("automatically resumes an exact pre-provider claim without reserving credits again", async () => {
    const repo = repository();
    const fetchImpl = vi.fn().mockResolvedValue(exactResponse());
    repo.updateScanSubmission.mockRejectedValueOnce(
      new Error("sheet quota after reservation"),
    );

    await expect(
      runSabScanOnce(input, repo as never, "actor", {
        apiKey: "test",
        fetchImpl,
      }),
    ).rejects.toThrow("sheet quota after reservation");
    const reservedState = await repo.getRunState();
    expect(reservedState.committed_credits).toBe(81);
    expect(repo.reserveScanSubmission).toHaveBeenCalledTimes(1);
    expect(fetchImpl).not.toHaveBeenCalled();

    await expect(
      runSabScanOnce(input, repo as never, "actor", {
        apiKey: "test",
        fetchImpl,
      }),
    ).resolves.toMatchObject({
      submission_status: "submitted",
      report_key: "4826693261fc566",
      scans_executed: true,
    });

    expect((await repo.getRunState()).committed_credits).toBe(81);
    expect(repo.reserveScanSubmission).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(repo.updateScanSubmission).toHaveBeenCalledWith(
      "test-place",
      expect.any(String),
      expect.objectContaining({
        recovery: "automatic_pre_provider_resume",
        recovery_basis: "exact_reserved_claim_with_no_submit_started_at",
      }),
      "actor",
    );
  });

  it("rejects recovery when the exact durable pre-provider envelope does not match", async () => {
    const repo = repository();
    const fetchImpl = vi.fn();
    repo.updateScanSubmission.mockRejectedValueOnce(
      new Error("sheet quota after reservation"),
    );
    await expect(
      runSabScanOnce(input, repo as never, "actor", {
        apiKey: "test",
        fetchImpl,
      }),
    ).rejects.toThrow("sheet quota after reservation");

    await expect(
      runSabScanOnce(
        {
          ...input,
          radius: 5,
          estimated_credits: 81,
          pre_provider_recovery: {
            approved_by: "Matt",
            approval_reference: "Approved exact stranded-claim recovery.",
          },
        },
        repo as never,
        "actor",
        { apiKey: "test", fetchImpl },
      ),
    ).rejects.toThrow(/No exact recoverable receipt/);

    expect((await repo.getRunState()).committed_credits).toBe(81);
    expect(repo.reserveScanSubmission).toHaveBeenCalledTimes(1);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reuses an already verified saved-location receipt during pre-provider recovery", async () => {
    const recoveryInput = { ...input, save_location_required: true };
    const repo = repository(recoveryInput);
    const originalUpdate = repo.updateScanSubmission.getMockImplementation()!;
    repo.updateScanSubmission
      .mockImplementationOnce(originalUpdate)
      .mockRejectedValueOnce(new Error("sheet quota before submitting"));
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(savedLocationResponse())
      .mockResolvedValueOnce(exactResponse());

    await expect(
      runSabScanOnce(recoveryInput, repo as never, "actor", {
        apiKey: "test",
        fetchImpl,
      }),
    ).rejects.toThrow("sheet quota before submitting");

    await expect(
      runSabScanOnce(recoveryInput, repo as never, "actor", {
        apiKey: "test",
        fetchImpl,
      }),
    ).resolves.toMatchObject({ submission_status: "submitted" });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      "https://api.localfalcon.com/v2/locations/add",
      "https://api.localfalcon.com/v2/run-scan/",
    ]);
    expect((await repo.getRunState()).committed_credits).toBe(81);
    expect(repo.reserveScanSubmission).toHaveBeenCalledTimes(1);
  });

  it("recovers the same submitting claim after a fresh exact-history no-match check", async () => {
    const repo = repository();
    const originalUpdate = repo.updateScanSubmission.getMockImplementation()!;
    repo.updateScanSubmission
      .mockImplementationOnce(originalUpdate)
      .mockRejectedValueOnce(new Error("transport closed during provider call"));
    const failedFetch = vi.fn().mockRejectedValue(new Error("connection lost"));

    await expect(
      runSabScanOnce(input, repo as never, "actor", {
        apiKey: "test",
        fetchImpl: failedFetch as never,
      }),
    ).rejects.toThrow("transport closed during provider call");

    const fetchImpl = vi.fn().mockResolvedValue(exactResponse());
    await expect(
      runSabScanOnce(
        {
          ...input,
          pre_provider_recovery: {
            approved_by: "Matt",
            approval_reference: "Approved same-claim recovery.",
            exact_history_check: {
              evidence_reference: "viva-local-falcon-preflight:test",
              checked_at: new Date().toISOString(),
              result: "none",
            },
          },
        },
        repo as never,
        "actor",
        { apiKey: "test", fetchImpl: fetchImpl as never },
      ),
    ).resolves.toMatchObject({
      submission_status: "submitted",
      report_key: "4826693261fc566",
      scans_executed: true,
    });

    expect((await repo.getRunState()).committed_credits).toBe(81);
    expect(repo.reserveScanSubmission).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(repo.updateScanSubmission).toHaveBeenCalledWith(
      "test-place",
      expect.any(String),
      expect.objectContaining({
        recovery: "approved_same_claim_resume_after_exact_history_check",
        recovery_history_evidence_reference:
          "viva-local-falcon-preflight:test",
      }),
      "actor",
    );
  });
});

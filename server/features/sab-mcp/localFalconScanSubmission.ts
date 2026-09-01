import { createHash } from "node:crypto";
import { localFalconApiKey } from "./localFalconRankedCells";
import type {
  SabScanSubmissionReservation,
  SabSheetsRepository,
} from "./sheets";
import {
  claimSabRunScan,
  inSabRunStateQueue,
  normalizeSabScanPlan,
  recordSabRunSubmission,
  sabScanPlanFingerprint,
  type SabRunStateRepository,
} from "./runState";

const LOCAL_FALCON_API_BASE = "https://api.localfalcon.com";
const LOCAL_FALCON_TIMEOUT_MS = 45_000;
const CENTER_TOLERANCE = 0.000_001;

type FetchLike = typeof fetch;

export type RunSabScanOnceInput = Omit<
  SabScanSubmissionReservation,
  "idempotency_key" | "scan_center"
> & {
  /** Optional only to retrieve a legacy idempotent receipt; new scans require it. */
  run_id?: string;
  center: { latitude: number; longitude: number };
  save_location_required: boolean;
  eligibility_gate_result: "passed";
  duplicate_report_result: "none";
  retry_after_ambiguous_submission: false;
  pre_provider_recovery?: {
    approved_by: "Matt";
    approval_reference: string;
    exact_history_check?: {
      evidence_reference: string;
      checked_at: string;
      result: "none";
    };
  };
};

type ScanSubmissionRepository = Pick<
  SabSheetsRepository,
  "reserveScanSubmission" | "updateScanSubmission"
> & SabRunStateRepository & {
  getScanSubmission(placeId: string, idempotencyKey: string): Promise<Record<string, unknown> | null>;
};

type JsonRecord = Record<string, unknown>;

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function responseData(payload: JsonRecord) {
  return payload.data &&
    typeof payload.data === "object" &&
    !Array.isArray(payload.data)
    ? (payload.data as JsonRecord)
    : payload;
}

function responseParameters(payload: JsonRecord) {
  return payload.parameters &&
    typeof payload.parameters === "object" &&
    !Array.isArray(payload.parameters)
    ? (payload.parameters as JsonRecord)
    : null;
}

function responseMessage(payload: JsonRecord) {
  return (
    cleanString(payload.message) ?? cleanString(responseData(payload).message)
  );
}

function reportKeyFrom(payload: JsonRecord) {
  const data = responseData(payload);
  return cleanString(data.report_key ?? data.reportKey ?? payload.report_key);
}

function idempotencyKey(input: RunSabScanOnceInput) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        authorization_id: input.authorization_id,
        place_id: input.place_id,
        scan_role: input.scan_role,
        scan_type: input.scan_type,
        center: input.center,
        grid_size: input.grid_size,
        radius: input.radius,
        measurement: input.measurement,
        keyword: input.keyword,
        platform: input.platform,
      }),
    )
    .digest("hex");
}

async function postLocalFalcon(
  path: string,
  body: URLSearchParams,
  apiKey: string,
  fetchImpl: FetchLike,
) {
  const response = await fetchImpl(`${LOCAL_FALCON_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(LOCAL_FALCON_TIMEOUT_MS),
  });
  const payload = (await response.json().catch(() => ({}))) as JsonRecord;
  if (!response.ok) {
    throw new Error(
      `Local Falcon ${path} failed with HTTP ${response.status}${responseMessage(payload) ? `: ${responseMessage(payload)}` : ""}.`,
    );
  }
  return payload;
}

function assertExactEcho(payload: JsonRecord, input: RunSabScanOnceInput) {
  const data = responseData(payload);
  const parameters = responseParameters(payload);
  const echo = (source: JsonRecord | null, parameterEnvelope = false) => ({
    place_id: cleanString(source?.place_id),
    latitude: numberValue(source?.lat ?? source?.latitude),
    longitude: numberValue(source?.lng ?? source?.longitude),
    grid_size: numberValue(source?.grid_size),
    radius: numberValue(
      source?.radius ?? (parameterEnvelope ? source?.distance : undefined),
    ),
    measurement: cleanString(source?.measurement)?.toLowerCase() ?? null,
    keyword: cleanString(source?.keyword),
    platform: cleanString(source?.platform)?.toLowerCase() ?? null,
  });
  const parameterEcho = echo(parameters, true);
  const dataEcho = echo(data);
  const actual = {
    place_id: parameterEcho.place_id ?? dataEcho.place_id,
    latitude: parameterEcho.latitude ?? dataEcho.latitude,
    longitude: parameterEcho.longitude ?? dataEcho.longitude,
    grid_size: parameterEcho.grid_size ?? dataEcho.grid_size,
    radius: parameterEcho.radius ?? dataEcho.radius,
    measurement: parameterEcho.measurement ?? dataEcho.measurement,
    keyword: parameterEcho.keyword ?? dataEcho.keyword,
    platform: parameterEcho.platform ?? dataEcho.platform,
  };
  const mismatched = (candidate: typeof actual, requireComplete: boolean) =>
    (requireComplete &&
      Object.values(candidate).some((value) => value === null)) ||
    (candidate.place_id !== null && candidate.place_id !== input.place_id) ||
    (candidate.latitude !== null &&
      Math.abs(candidate.latitude - input.center.latitude) >
        CENTER_TOLERANCE) ||
    (candidate.longitude !== null &&
      Math.abs(candidate.longitude - input.center.longitude) >
        CENTER_TOLERANCE) ||
    (candidate.grid_size !== null && candidate.grid_size !== input.grid_size) ||
    (candidate.radius !== null && candidate.radius !== input.radius) ||
    (candidate.measurement !== null &&
      candidate.measurement !== input.measurement) ||
    (candidate.keyword !== null && candidate.keyword !== input.keyword) ||
    (candidate.platform !== null && candidate.platform !== input.platform);
  const mismatch =
    mismatched(actual, true) ||
    mismatched(parameterEcho, false) ||
    mismatched(dataEcho, false);
  if (mismatch) {
    throw new Error(
      `Local Falcon scan response did not echo the exact authorized parameters: ${JSON.stringify(actual)}.`,
    );
  }
}

export async function runSabScanOnce(
  input: RunSabScanOnceInput,
  repository: ScanSubmissionRepository,
  actorEmail: string,
  options: { apiKey?: string; fetchImpl?: FetchLike } = {},
) {
  return inSabRunStateQueue(async () => {
    if (input.estimated_credits !== input.grid_size * input.grid_size) {
      throw new Error(
        `Estimated credits must equal grid point count (${input.grid_size * input.grid_size}).`,
      );
    }
    const key = idempotencyKey(input);
    // An existing receipt is always readable, including while a human review is
    // pending. This path must never reserve again or contact the paid endpoint.
    const existing = await repository.getScanSubmission(input.place_id, key);
    const existingReceipt = (entry: Record<string, unknown>) => {
      const status = cleanString(entry.submission_status) ?? "unknown";
      return {
        idempotency_key: key,
        submission_status: status,
        report_key: cleanString(entry.report_key),
        scans_executed: false,
        writes_performed: false,
        deduplicated: status === "submitted",
        stopped_for_manual_reconciliation: status !== "submitted",
      };
    };
    const existingStatus = existing
      ? cleanString(existing.submission_status) ?? "unknown"
      : null;
    const recoveringSubmittingClaim = existingStatus === "submitting";
    const recoverableExistingStatus =
      existingStatus === "preparing_location" || recoveringSubmittingClaim;
    if (existing && !recoverableExistingStatus) {
      if (input.pre_provider_recovery) {
        throw new Error(
          "Same-claim recovery is allowed only for an exact preparing_location or submitting receipt.",
        );
      }
      return existingReceipt(existing);
    }
    if (existing && !input.pre_provider_recovery) {
      return existingReceipt(existing);
    }
    if (!input.run_id?.trim()) throw new Error("New paid scans require an initialized structured run and exact stored batch authorization.");
    if (input.eligibility_gate_result !== "passed" || input.duplicate_report_result !== "none" || input.retry_after_ambiguous_submission !== false) {
      throw new Error("Eligibility and exact duplicate checks must pass; ambiguous paid submissions cannot be retried.");
    }
    if (!existing && input.pre_provider_recovery) {
      throw new Error(
        "No exact recoverable receipt exists for guarded same-claim recovery.",
      );
    }
    if (recoveringSubmittingClaim && input.pre_provider_recovery) {
      const historyCheck = input.pre_provider_recovery.exact_history_check;
      const checkedAt = historyCheck
        ? Date.parse(historyCheck.checked_at)
        : Number.NaN;
      const checkAgeMs = Date.now() - checkedAt;
      if (
        !historyCheck ||
        historyCheck.result !== "none" ||
        !historyCheck.evidence_reference.trim() ||
        !Number.isFinite(checkedAt) ||
        checkAgeMs < -60_000 ||
        checkAgeMs > 10 * 60_000
      ) {
        throw new Error(
          "A fresh exact-envelope provider-history check with no matching report is required to recover a submitting claim.",
        );
      }
    }
    const state = await repository.getRunState(input.run_id);
    if (!state || state.run_id !== input.run_id) throw new Error("No matching authorized structured run exists.");
    const apiKey = options.apiKey?.trim() || localFalconApiKey();
    const fetchImpl = options.fetchImpl ?? fetch;
    // Match and claim the exact plan before any side effect; a caller UUID alone
    // is never spending authorization. Claims are not refunded on ambiguity.
    input = { ...input, ...normalizeSabScanPlan(input) };
    const recoveringPreProviderClaim = Boolean(existing);
    const existingLocationStatus = cleanString(existing?.location_status);
    const existingLocationPlaceId = cleanString(existing?.location_place_id);
    const locationAlreadyVerified =
      recoveringPreProviderClaim &&
      existingLocationStatus === "verified" &&
      existingLocationPlaceId === input.place_id;
    if (recoveringPreProviderClaim) {
      const currentBatch = state.batches.at(-1);
      const fingerprint = sabScanPlanFingerprint(input);
      const claimedScan = currentBatch?.scans.find(
        (candidate) => candidate.fingerprint === fingerprint,
      );
      const exactReservation =
        cleanString(existing?.authorization_id) === input.authorization_id &&
        cleanString(existing?.company_name) === input.company_name &&
        cleanString(existing?.place_id) === input.place_id &&
        cleanString(existing?.scan_role) === input.scan_role &&
        cleanString(existing?.scan_type) === input.scan_type &&
        cleanString(existing?.scan_center) ===
          `${input.center.latitude},${input.center.longitude}` &&
        numberValue(existing?.grid_size) === input.grid_size &&
        numberValue(existing?.radius) === input.radius &&
        cleanString(existing?.measurement) === input.measurement &&
        cleanString(existing?.keyword) === input.keyword &&
        cleanString(existing?.platform)?.toLowerCase() === input.platform &&
        numberValue(existing?.estimated_credits) === input.estimated_credits &&
        cleanString(existing?.center_derivation) === input.center_derivation &&
        cleanString(existing?.sop_routing_rule) === input.sop_routing_rule &&
        !cleanString(existing?.report_key) &&
        (recoveringSubmittingClaim
          ? Boolean(cleanString(existing?.submit_started_at))
          : !cleanString(existing?.submit_started_at)) &&
        (existingLocationStatus !== "verified" || locationAlreadyVerified);
      if (
        currentBatch?.authorization_id !== input.authorization_id ||
        currentBatch.status !== "authorized" ||
        !claimedScan ||
        claimedScan.submission_status !== "reserved" ||
        claimedScan.idempotency_key !== key ||
        !exactReservation
      ) {
        throw new Error(
          "Pre-provider recovery does not match the exact active reserved claim and durable receipt.",
        );
      }
      await repository.updateScanSubmission(
        input.place_id,
        key,
        {
          recovery: recoveringSubmittingClaim
            ? "approved_same_claim_resume_after_exact_history_check"
            : "approved_pre_provider_resume",
          recovery_approved_by: input.pre_provider_recovery!.approved_by,
          recovery_authorization_reference:
            input.pre_provider_recovery!.approval_reference,
          ...(recoveringSubmittingClaim
            ? {
                recovery_history_evidence_reference:
                  input.pre_provider_recovery!.exact_history_check!
                    .evidence_reference,
                recovery_history_checked_at:
                  input.pre_provider_recovery!.exact_history_check!.checked_at,
              }
            : {}),
          recovery_resumed_at: new Date().toISOString(),
        },
        actorEmail,
      );
    } else {
      const claimed = claimSabRunScan(
        state,
        input.authorization_id,
        input,
        key,
      );
      await repository.saveRunState(claimed, state.version, actorEmail);
    }
    const recordRunResult = async (result: Parameters<typeof recordSabRunSubmission>[2]) => {
      const latest = await repository.getRunState(input.run_id!);
      if (!latest) throw new Error("Structured run disappeared after submission; manual reconciliation is required.");
      await repository.saveRunState(recordSabRunSubmission(latest, key, result), latest.version, actorEmail);
    };
    const scanCenter = `${input.center.latitude},${input.center.longitude}`;
    const reservation: SabScanSubmissionReservation = {
      idempotency_key: key,
      authorization_id: input.authorization_id,
      company_name: input.company_name,
      place_id: input.place_id,
      scan_role: input.scan_role,
      scan_type: input.scan_type,
      scan_center: scanCenter,
      grid_size: input.grid_size,
      radius: input.radius,
      measurement: input.measurement,
      keyword: input.keyword,
      platform: input.platform,
      estimated_credits: input.estimated_credits,
      center_derivation: input.center_derivation,
      sop_routing_rule: input.sop_routing_rule,
    };
    if (!recoveringPreProviderClaim) {
      const reserved = await repository.reserveScanSubmission(
        reservation,
        actorEmail,
      );
      if (!reserved.created) {
        return existingReceipt(reserved.entry as Record<string, unknown>);
      }
    }

    if (input.save_location_required && !locationAlreadyVerified) {
      try {
        const location = await postLocalFalcon(
          "/v2/locations/add",
          new URLSearchParams({
            api_key: apiKey,
            platform: input.platform,
            place_id: input.place_id,
          }),
          apiKey,
          fetchImpl,
        );
        const data = responseData(location);
        const parameters = responseParameters(location);
        const echoedPlaceId = cleanString(
          parameters?.place_id ?? data.place_id ?? location.place_id,
        );
        const echoedPlatform = cleanString(
          parameters?.platform ?? data.platform ?? location.platform,
        )?.toLowerCase();
        if (
          location.success !== true ||
          echoedPlaceId !== input.place_id ||
          echoedPlatform !== input.platform
        ) {
          throw new Error(
            `Local Falcon did not confirm the exact saved location: ${JSON.stringify(
              {
                place_id: echoedPlaceId,
                platform: echoedPlatform ?? null,
              },
            )}.`,
          );
        }
        await repository.updateScanSubmission(
          input.place_id,
          key,
          { location_status: "verified", location_place_id: echoedPlaceId },
          actorEmail,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        await repository.updateScanSubmission(
          input.place_id,
          key,
          {
            submission_status: "location_unverified",
            error: errorMessage,
          },
          actorEmail,
        );
        await recordRunResult({ submission_status: "location_unverified" });
        return {
          idempotency_key: key,
          submission_status: "location_unverified",
          error: errorMessage,
          scans_executed: false,
          writes_performed: true,
          stopped_for_manual_reconciliation: true,
        };
      }
    }

    await repository.updateScanSubmission(
      input.place_id,
      key,
      {
        submission_status: "submitting",
        submit_started_at: new Date().toISOString(),
      },
      actorEmail,
    );

    let observedReportKey: string | null = null;
    let observedProviderStatus: string | null = null;
    try {
      const payload = await postLocalFalcon(
        "/v2/run-scan/",
        new URLSearchParams({
          api_key: apiKey,
          place_id: input.place_id,
          keyword: input.keyword,
          lat: String(input.center.latitude),
          lng: String(input.center.longitude),
          grid_size: String(input.grid_size),
          radius: String(input.radius),
          measurement: input.measurement,
          platform: input.platform,
          eager: "true",
        }),
        apiKey,
        fetchImpl,
      );
      const reportKey = reportKeyFrom(payload);
      observedReportKey = reportKey;
      observedProviderStatus = cleanString(responseData(payload).status);
      if (payload.success !== true || !reportKey) {
        throw new Error(
          responseMessage(payload) ??
            "Local Falcon did not return a report key.",
        );
      }
      assertExactEcho(payload, input);
      const entry = await repository.updateScanSubmission(
        input.place_id,
        key,
        {
          submission_status: "submitted",
          report_key: reportKey,
          provider_status: observedProviderStatus,
          submitted_at: new Date().toISOString(),
        },
        actorEmail,
      );
      await recordRunResult({ submission_status: "submitted", report_key: reportKey });
      return {
        idempotency_key: key,
        authorization_id: input.authorization_id,
        place_id: input.place_id,
        report_key: reportKey,
        provider_status: cleanString(entry.provider_status),
        submission_status: "submitted",
        scans_executed: true,
        writes_performed: true,
        deduplicated: false,
        stopped_for_manual_reconciliation: false,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await repository.updateScanSubmission(
        input.place_id,
        key,
        {
          submission_status: "ambiguous_response",
          report_key: observedReportKey,
          provider_status: observedProviderStatus,
          error: errorMessage,
        },
        actorEmail,
      );
      await recordRunResult({ submission_status: "ambiguous_response", report_key: observedReportKey });
      return {
        idempotency_key: key,
        submission_status: "ambiguous_response",
        report_key: observedReportKey,
        provider_status: observedProviderStatus,
        error: errorMessage,
        scans_executed: "unknown",
        writes_performed: true,
        retry_permitted: false,
        stopped_for_manual_reconciliation: true,
      };
    }
  });
}

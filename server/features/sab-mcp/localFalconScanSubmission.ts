import { createHash } from "node:crypto";
import { localFalconApiKey } from "./localFalconRankedCells";
import type {
  SabScanSubmissionReservation,
  SabSheetsRepository,
} from "./sheets";

const LOCAL_FALCON_API_BASE = "https://api.localfalcon.com";
const LOCAL_FALCON_TIMEOUT_MS = 45_000;
const CENTER_TOLERANCE = 0.000_001;

type FetchLike = typeof fetch;

export type RunSabScanOnceInput = Omit<
  SabScanSubmissionReservation,
  "idempotency_key" | "scan_center"
> & {
  center: { latitude: number; longitude: number };
  save_location_required: boolean;
  eligibility_gate_result: "passed";
  duplicate_report_result: "none";
  retry_after_ambiguous_submission: false;
};

type ScanSubmissionRepository = Pick<
  SabSheetsRepository,
  "reserveScanSubmission" | "updateScanSubmission"
>;

type JsonRecord = Record<string, unknown>;

let submissionQueue: Promise<void> = Promise.resolve();

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

async function inSubmissionQueue<T>(work: () => Promise<T>) {
  const prior = submissionQueue;
  let release!: () => void;
  submissionQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prior;
  try {
    return await work();
  } finally {
    release();
  }
}

export async function runSabScanOnce(
  input: RunSabScanOnceInput,
  repository: ScanSubmissionRepository,
  actorEmail: string,
  options: { apiKey?: string; fetchImpl?: FetchLike } = {},
) {
  return inSubmissionQueue(async () => {
    if (input.estimated_credits !== input.grid_size * input.grid_size) {
      throw new Error(
        `Estimated credits must equal grid point count (${input.grid_size * input.grid_size}).`,
      );
    }
    const apiKey = options.apiKey?.trim() || localFalconApiKey();
    const fetchImpl = options.fetchImpl ?? fetch;
    const key = idempotencyKey(input);
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
    const reserved = await repository.reserveScanSubmission(
      reservation,
      actorEmail,
    );
    if (!reserved.created) {
      const existingEntry = reserved.entry as Record<string, unknown>;
      const status = cleanString(existingEntry.submission_status) ?? "unknown";
      return {
        idempotency_key: key,
        submission_status: status,
        report_key: cleanString(existingEntry.report_key),
        scans_executed: false,
        writes_performed: false,
        deduplicated: status === "submitted",
        stopped_for_manual_reconciliation: status !== "submitted",
      };
    }

    if (input.save_location_required) {
      try {
        const location = await postLocalFalcon(
          "/v2/locations/add",
          new URLSearchParams({ api_key: apiKey, place_id: input.place_id }),
          apiKey,
          fetchImpl,
        );
        const data = responseData(location);
        const echoedPlaceId = cleanString(data.place_id ?? location.place_id);
        if (location.success !== true || echoedPlaceId !== input.place_id) {
          throw new Error(
            "Local Falcon did not confirm the exact saved Place ID.",
          );
        }
        await repository.updateScanSubmission(
          input.place_id,
          key,
          { location_status: "verified", location_place_id: echoedPlaceId },
          actorEmail,
        );
      } catch (error) {
        await repository.updateScanSubmission(
          input.place_id,
          key,
          {
            submission_status: "location_unverified",
            error: error instanceof Error ? error.message : String(error),
          },
          actorEmail,
        );
        return {
          idempotency_key: key,
          submission_status: "location_unverified",
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

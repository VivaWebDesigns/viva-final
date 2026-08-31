import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";

/** Exact paid request, independent of prose notes or a caller-created UUID. */
export type SabScanPlan = {
  place_id: string;
  scan_role: "deliverable" | "auxiliary";
  scan_type: "standard" | "scout" | "fine" | "recenter";
  center: { latitude: number; longitude: number };
  grid_size: 7 | 9;
  radius: number;
  measurement: "mi" | "km";
  keyword: string;
  platform: "google";
  estimated_credits: number;
  save_location_required: boolean;
};

export type SabMattApproval = {
  approved_by: "Matt";
  approval_reference: string;
};

export type SabRunScan = {
  fingerprint: string;
  plan: SabScanPlan;
  idempotency_key: string | null;
  submission_status: "planned" | "reserved" | "submitted" | "ambiguous_response" | "location_unverified";
  report_key: string | null;
  completion_verified: boolean;
};

export type SabRunBatch = {
  authorization_id: string;
  plan_digest: string;
  authorization_reference: string;
  status: "authorized" | "awaiting_completion" | "awaiting_review" | "completed" | "blocked";
  scans: SabRunScan[];
  review: (SabMattApproval & { reviewed_batch_id: string; approved_plan_digest: string }) | null;
  initial_approval: (SabMattApproval & { approved_plan_digest: string }) | null;
  exception: (SabMattApproval & { reason: string }) | null;
  /** Required by new guarded authorizations; optional to read legacy receipts. */
  duplicate_report_checks?: Array<{
    scan: SabScanPlan;
    result: "none";
    evidence_reference: string;
    checked_at: string;
  }>;
};

export type SabRunState = {
  schema_version: 1;
  version: number;
  run_id: string;
  orchestrator_id: string;
  authorization_reference: string;
  testing_mode: boolean;
  testing_ended: SabMattApproval | null;
  credit_limit: number;
  committed_credits: number;
  batches: SabRunBatch[];
};

export interface SabRunStateRepository {
  getRunState(runId: string): Promise<SabRunState | null>;
  saveRunState(state: SabRunState, expectedVersion: number | null, actorEmail: string): Promise<void>;
}

let runStateQueue: Promise<void> = Promise.resolve();

/** The process queue plus a production DB advisory lock cover Railway replica
 * overlap. The transaction holds the lock across state reads, durable claims,
 * external submission and receipt persistence; DB failure never falls back to
 * an unlocked paid call. Non-production unit tests do not require a database.
 */
export async function inSabRunStateQueue<T>(work: () => Promise<T>): Promise<T> {
  const prior = runStateQueue;
  let release!: () => void;
  runStateQueue = new Promise<void>((resolve) => { release = resolve; });
  await prior;
  try {
    if (process.env.NODE_ENV === "production") {
      const { db } = await import("../../db");
      return await db.transaction(async (transaction) => {
        await transaction.execute(sql`select pg_advisory_xact_lock(1935761965, 3)`);
        return await work();
      });
    }
    return await work();
  } finally { release(); }
}

function required(value: string, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function approval(value: SabMattApproval | undefined | null): SabMattApproval {
  if (value?.approved_by !== "Matt") throw new Error("Explicit Matt approval is required.");
  return { approved_by: "Matt", approval_reference: required(value.approval_reference, "Matt approval reference") };
}

export function normalizeSabScanPlan(input: SabScanPlan): SabScanPlan {
  if (![7, 9].includes(input.grid_size) || input.estimated_credits !== input.grid_size ** 2) {
    throw new Error("Scan credits must equal the authorized grid point count.");
  }
  if (!Number.isFinite(input.radius) || input.radius <= 0 ||
      !Number.isFinite(input.center.latitude) || Math.abs(input.center.latitude) > 90 ||
      !Number.isFinite(input.center.longitude) || Math.abs(input.center.longitude) > 180) {
    throw new Error("Scan coordinates and radius must be valid finite values.");
  }
  if (!["deliverable", "auxiliary"].includes(input.scan_role) ||
      !["standard", "scout", "fine", "recenter"].includes(input.scan_type) ||
      !["mi", "km"].includes(input.measurement) || input.platform !== "google" || typeof input.save_location_required !== "boolean") {
    throw new Error("Unsupported authorized scan specification.");
  }
  return {
    place_id: required(input.place_id, "Exact Place ID"),
    scan_role: input.scan_role,
    scan_type: input.scan_type,
    center: { latitude: input.center.latitude, longitude: input.center.longitude },
    grid_size: input.grid_size,
    radius: input.radius,
    measurement: input.measurement,
    keyword: required(input.keyword, "Keyword"),
    platform: input.platform,
    estimated_credits: input.estimated_credits,
    save_location_required: input.save_location_required,
  };
}

export function sabScanPlanFingerprint(input: SabScanPlan): string {
  return createHash("sha256").update(JSON.stringify(normalizeSabScanPlan(input))).digest("hex");
}

export function createSabRunState(input: {
  run_id: string;
  orchestrator_id: string;
  authorization_reference: string;
  credit_limit: number;
}): SabRunState {
  if (!Number.isSafeInteger(input.credit_limit) || input.credit_limit <= 0) throw new Error("A positive run credit limit is required.");
  return {
    schema_version: 1, version: 1,
    run_id: required(input.run_id, "Run ID"),
    orchestrator_id: required(input.orchestrator_id, "Codex orchestrator ID"),
    authorization_reference: required(input.authorization_reference, "Run authorization reference"),
    credit_limit: input.credit_limit, committed_credits: 0,
    testing_mode: true, testing_ended: null, batches: [],
  };
}

export function authorizeSabScanBatch(state: SabRunState, input: {
  authorization_id: string;
  orchestrator_id: string;
  authorization_reference: string;
  scans: SabScanPlan[];
  matt_initial_approval?: SabMattApproval;
  matt_review?: SabMattApproval & { reviewed_batch_id: string };
  exception?: SabMattApproval & { reason: string };
}): SabRunState {
  if (input.orchestrator_id !== state.orchestrator_id) throw new Error("Only this run's Codex orchestrator may authorize its scan plan.");
  const authorizationId = required(input.authorization_id, "Batch authorization ID");
  if (state.batches.some((batch) => batch.authorization_id === authorizationId)) throw new Error("Batch authorization IDs cannot be reused or edited.");
  if (!input.scans.length) throw new Error("An exact nonempty scan plan is required.");
  const previous = state.batches.at(-1);
  if (previous && !["awaiting_review", "completed"].includes(previous.status)) {
    throw new Error("The preceding scan batch must finish and be verified before another batch can be authorized.");
  }
  const plans = input.scans.map(normalizeSabScanPlan);
  const fingerprints = plans.map(sabScanPlanFingerprint);
  if (new Set(fingerprints).size !== fingerprints.length || new Set(plans.map((scan) => scan.place_id)).size !== plans.length) {
    throw new Error("Authorize at most one exact scan per Place ID in a batch; no duplicate plans.");
  }
  const planDigest = createHash("sha256").update(JSON.stringify([...fingerprints].sort())).digest("hex");
  let review: SabRunBatch["review"] = null;
  const initialApproval = !previous && state.testing_mode
    ? { ...approval(input.matt_initial_approval), approved_plan_digest: planDigest }
    : null;
  if (previous && state.testing_mode) {
    const approved = approval(input.matt_review);
    if (input.matt_review?.reviewed_batch_id !== previous.authorization_id) throw new Error("Matt's review must identify the immediately completed batch.");
    review = { ...approved, reviewed_batch_id: previous.authorization_id, approved_plan_digest: planDigest };
  }
  const previousPlans = state.batches.flatMap((batch) => batch.scans.map((scan) => scan.plan));
  const requiresException = plans.some((plan) => {
    const priorLeadPlans = previousPlans.filter((prior) => prior.place_id === plan.place_id);
    const standardSpec = plan.measurement === "mi" && (
      (plan.scan_role === "deliverable" && ["standard", "recenter"].includes(plan.scan_type) && plan.grid_size === 7 && [3, 5].includes(plan.radius)) ||
      (plan.scan_role === "auxiliary" && plan.scan_type === "scout" && plan.grid_size === 9 && plan.radius === 6) ||
      (plan.scan_role === "auxiliary" && plan.scan_type === "fine" && plan.grid_size === 7 && plan.radius === 1.5)
    );
    if (!standardSpec) return true;
    if (priorLeadPlans.some((prior) =>
      (plan.scan_type === "recenter" && prior.scan_type === "recenter") ||
      (plan.scan_role === "auxiliary" && prior.scan_role === "auxiliary")
    )) return true;
    // A later standard deliverable is the same-center 3-to-5 comparison,
    // never an unlabelled second recenter or an endlessly repeated comparison.
    const priorDeliverables = priorLeadPlans.filter((prior) => prior.scan_role === "deliverable");
    if (plan.scan_role === "deliverable" && plan.scan_type === "standard" && priorDeliverables.length) {
      const prior = priorDeliverables.at(-1)!;
      return !(plan.radius === 5 && prior.radius === 3 && prior.grid_size === 7 && prior.measurement === "mi" &&
        plan.center.latitude === prior.center.latitude && plan.center.longitude === prior.center.longitude &&
        !priorDeliverables.some((candidate) => candidate.radius === 5 && candidate.center.latitude === plan.center.latitude && candidate.center.longitude === plan.center.longitude));
    }
    return false;
  });
  let exception: SabRunBatch["exception"] = null;
  if (requiresException || input.exception) {
    const approved = approval(input.exception);
    exception = { ...approved, reason: required(input.exception?.reason ?? "", "Scan exception reason") };
  }
  const plannedCredits = plans.reduce((sum, plan) => sum + plan.estimated_credits, 0);
  if (state.committed_credits + plannedCredits > state.credit_limit) throw new Error("The exact batch plan exceeds the remaining authorized run credits.");
  const next = structuredClone(state);
  if (previous) next.batches[next.batches.length - 1].status = "completed";
  next.version++;
  next.batches.push({
    authorization_id: authorizationId, plan_digest: planDigest,
    authorization_reference: required(input.authorization_reference, "Batch authorization reference"),
    status: "authorized", review, initial_approval: initialApproval, exception,
    scans: plans.map((plan, index) => ({
      fingerprint: fingerprints[index], plan, idempotency_key: null,
      submission_status: "planned", report_key: null, completion_verified: false,
    })),
  });
  return next;
}

/** Persist this claim before preparing a location or reserving/submitting a paid request. */
export function claimSabRunScan(state: SabRunState, authorizationId: string, plan: SabScanPlan, key: string): SabRunState {
  const current = state.batches.at(-1);
  if (!current || current.authorization_id !== authorizationId || current.status !== "authorized") {
    throw new Error("No active stored batch authorization; testing review or batch completion may be pending.");
  }
  const fingerprint = sabScanPlanFingerprint(plan);
  const scan = current.scans.find((candidate) => candidate.fingerprint === fingerprint);
  if (!scan) throw new Error("Scan does not match the exact stored authorized envelope.");
  if (scan.submission_status !== "planned") throw new Error("This scan was already claimed; reconcile its durable receipt, never retry it.");
  if (current.scans.some((candidate) => candidate.submission_status === "reserved")) {
    throw new Error("A prior run claim is unresolved; reconcile it before any further paid submission.");
  }
  if (state.committed_credits + scan.plan.estimated_credits > state.credit_limit) throw new Error("Run credit limit would be exceeded.");
  const next = structuredClone(state);
  next.version++;
  next.committed_credits += scan.plan.estimated_credits;
  const claimed = next.batches.at(-1)!.scans.find((candidate) => candidate.fingerprint === fingerprint)!;
  claimed.submission_status = "reserved";
  claimed.idempotency_key = required(key, "Idempotency key");
  return next;
}

export function recordSabRunSubmission(state: SabRunState, key: string, result: {
  submission_status: "submitted" | "ambiguous_response" | "location_unverified";
  report_key?: string | null;
}): SabRunState {
  const next = structuredClone(state);
  const batch = next.batches.find((candidate) => candidate.scans.some((scan) => scan.idempotency_key === key));
  const scan = batch?.scans.find((candidate) => candidate.idempotency_key === key);
  if (!batch || !scan) throw new Error("No durable run claim exists for this submission.");
  if (result.submission_status === "submitted" && !result.report_key?.trim()) throw new Error("Submitted scans must retain their provider report key.");
  next.version++;
  scan.submission_status = result.submission_status;
  scan.report_key = result.report_key?.trim() || null;
  if (result.submission_status !== "submitted") batch.status = "blocked";
  else if (batch.scans.every((candidate) => candidate.submission_status === "submitted")) batch.status = "awaiting_completion";
  return next;
}

/** The caller must verify completion from provider data, never from research notes. */
export function completeSabRunReports(state: SabRunState, completedReportKeys: string[]): SabRunState {
  const next = structuredClone(state);
  const batch = next.batches.at(-1);
  if (!batch || !["authorized", "awaiting_completion", "awaiting_review", "completed"].includes(batch.status)) throw new Error("No unblocked batch is available for completion verification.");
  if (!completedReportKeys.length) throw new Error("Verified completed report keys are required.");
  for (const key of completedReportKeys) {
    const scan = batch.scans.find((candidate) => candidate.report_key === key && candidate.submission_status === "submitted");
    if (!scan) throw new Error("Completion evidence must match a submitted report in the current batch.");
    scan.completion_verified = true;
  }
  next.version++;
  if (batch.scans.every((scan) => scan.completion_verified)) batch.status = state.testing_mode ? "awaiting_review" : "completed";
  return next;
}

export function endSabTestingMode(state: SabRunState, approved: SabMattApproval): SabRunState {
  const next = structuredClone(state);
  next.testing_ended = approval(approved);
  next.testing_mode = false;
  next.version++;
  if (next.batches.at(-1)?.status === "awaiting_review") next.batches.at(-1)!.status = "completed";
  return next;
}

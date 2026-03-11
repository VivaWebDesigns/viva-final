/**
 * Provider Resilience Utilities
 *
 * Shared infrastructure for external provider calls across the platform.
 * Provides:
 *   - withTimeout()        — AbortController-based call timeout
 *   - classifyProviderError() — error taxonomy (permanent / transient / rate_limit / config)
 *   - logProviderEvent()   — structured log with provider, operation, severity, outcome
 *
 * Error taxonomy:
 *   config      — missing/invalid configuration (API key not set, wrong format)
 *   validation  — provider rejected input (bad email, invalid field)
 *   permanent   — provider will never accept this request (4xx, not a key issue)
 *   transient   — temporary failure; retrying may succeed (5xx, network, timeout)
 *   rate_limit  — provider throttled the request (429); backoff required
 */

export type ErrorClass =
  | "config"       // missing/invalid credentials — human must fix
  | "validation"   // provider rejected the request body — input issue
  | "permanent"    // provider refused, won't succeed on retry
  | "transient"    // network/server error — retry eligible
  | "rate_limit";  // 429 — retry after backoff

export type Severity = "debug" | "info" | "warn" | "error" | "critical";

export interface LogContext {
  provider: string;
  operation: string;
  requestId?: string;
  correlationId?: string;
  attempt?: number;
}

// ── Error Classification ──────────────────────────────────────────────

/**
 * Classifies a provider error into a severity-aware error class.
 * Used by callers to decide: log+give-up vs retry vs alert.
 */
export function classifyProviderError(
  httpStatus?: number,
  errorMessage?: string,
): ErrorClass {
  // Network/timeout errors — no HTTP status
  if (!httpStatus) {
    const msg = (errorMessage ?? "").toLowerCase();
    if (msg.includes("config") || msg.includes("api key") || msg.includes("not configured")) {
      return "config";
    }
    // AbortError, ECONNREFUSED, ETIMEDOUT, fetch failed, etc.
    return "transient";
  }

  if (httpStatus === 429) return "rate_limit";
  if (httpStatus === 408) return "transient"; // Request Timeout — transient like server errors

  if (httpStatus === 400) {
    // Bad request: input issue
    const msg = (errorMessage ?? "").toLowerCase();
    if (msg.includes("invalid") || msg.includes("format") || msg.includes("required")) {
      return "validation";
    }
    return "permanent";
  }

  if (httpStatus === 401 || httpStatus === 403) {
    // Auth failures — likely a config problem
    return "config";
  }

  if (httpStatus >= 400 && httpStatus < 500) {
    // Other 4xx — permanent rejections
    return "permanent";
  }

  if (httpStatus === 408 || httpStatus >= 500) {
    // Timeout or server errors — transient
    return "transient";
  }

  return "transient"; // default-safe
}

/**
 * Returns the recommended severity level for a given error class.
 */
export function severityForErrorClass(errorClass: ErrorClass): Severity {
  switch (errorClass) {
    case "config":     return "critical"; // human must intervene
    case "rate_limit": return "warn";
    case "validation": return "warn";
    case "permanent":  return "error";
    case "transient":  return "warn";
  }
}

// ── Structured Logging ────────────────────────────────────────────────

/**
 * Emits a structured provider event log.
 *
 * Format:
 *   [provider:operation] SEVERITY outcome {attempt=N, correlationId=X} — details
 */
export function logProviderEvent(
  ctx: LogContext,
  outcome: "success" | "failure" | "skipped" | "timeout" | "circuit_open",
  details?: {
    errorClass?: ErrorClass;
    severity?: Severity;
    message?: string;
  },
): void {
  const tag = `[${ctx.provider}:${ctx.operation}]`;
  const meta: string[] = [];
  if (ctx.attempt !== undefined) meta.push(`attempt=${ctx.attempt}`);
  if (ctx.correlationId) meta.push(`corr=${ctx.correlationId}`);
  if (ctx.requestId) meta.push(`req=${ctx.requestId}`);
  const metaStr = meta.length > 0 ? ` {${meta.join(", ")}}` : "";
  const severity = details?.severity ?? (outcome === "success" || outcome === "skipped" ? "info" : "warn");
  const msg = details?.message ? ` — ${details.message}` : "";
  const errorClassStr = details?.errorClass ? ` [${details.errorClass}]` : "";

  const line = `${tag} ${severity.toUpperCase()} ${outcome}${errorClassStr}${metaStr}${msg}`;

  if (severity === "error" || severity === "critical") {
    console.error(line);
  } else if (severity === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

// ── Timeout Wrapper ───────────────────────────────────────────────────

/**
 * Wraps a promise-returning function with an AbortController timeout.
 * If the timeout fires first, throws an Error with "PROVIDER_TIMEOUT" in the message.
 *
 * @param fn  — factory that receives the AbortSignal
 * @param timeoutMs  — milliseconds before abort
 * @param ctx  — log context for the timeout event
 */
export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  ctx: LogContext,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await fn(controller.signal);
    clearTimeout(timer);
    return result;
  } catch (err: any) {
    clearTimeout(timer);

    const isAbort = err?.name === "AbortError" || controller.signal.aborted;
    if (isAbort) {
      logProviderEvent(ctx, "timeout", {
        severity: "warn",
        errorClass: "transient",
        message: `timed out after ${timeoutMs}ms`,
      });
      throw new Error(`PROVIDER_TIMEOUT: ${ctx.provider}:${ctx.operation} exceeded ${timeoutMs}ms`);
    }

    throw err;
  }
}

// ── Failure Threshold ─────────────────────────────────────────────────

const FAILURE_THRESHOLD = 3; // warn after this many consecutive failures

/** Emits a structured CRITICAL warning when provider shows repeated failures. */
export function warnIfThresholdReached(
  consecutiveFailures: number,
  ctx: LogContext,
): void {
  if (consecutiveFailures >= FAILURE_THRESHOLD && consecutiveFailures % FAILURE_THRESHOLD === 0) {
    console.error(
      `[${ctx.provider}:${ctx.operation}] CRITICAL circuit_threshold — ` +
      `${consecutiveFailures} consecutive failures. Provider may be degraded.`
    );
  }
}

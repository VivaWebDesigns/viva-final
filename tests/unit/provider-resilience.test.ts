/**
 * Provider Resilience Unit Tests
 *
 * Tests the pure utility functions from the provider resilience library.
 *
 * Covers:
 *  1. classifyProviderError — all error classes across HTTP status codes
 *  2. severityForErrorClass — correct severity for each class
 *  3. withTimeout — resolves before timeout (no throw)
 *  4. withTimeout — throws on timeout (AbortError path)
 *  5. warnIfThresholdReached — fires at threshold, fires again at 2x threshold
 *  6. Provider snapshot — recordSuccess, recordFailure, status derivation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  classifyProviderError,
  severityForErrorClass,
  withTimeout,
  warnIfThresholdReached,
} from "../../server/lib/provider-resilience";
import {
  recordSuccess,
  recordFailure,
  getSnapshot,
  getAllSnapshots,
  resetSnapshots,
} from "../../server/lib/provider-snapshot";

// ── classifyProviderError ─────────────────────────────────────────────

describe("classifyProviderError", () => {
  it("classifies no HTTP status as transient (network error)", () => {
    expect(classifyProviderError(undefined, "ECONNREFUSED")).toBe("transient");
  });

  it("classifies PROVIDER_TIMEOUT message as transient", () => {
    expect(classifyProviderError(undefined, "PROVIDER_TIMEOUT: resend:send_email")).toBe("transient");
  });

  it("classifies 429 as rate_limit", () => {
    expect(classifyProviderError(429)).toBe("rate_limit");
  });

  it("classifies 401 as config (bad API key)", () => {
    expect(classifyProviderError(401)).toBe("config");
  });

  it("classifies 403 as config (unauthorized)", () => {
    expect(classifyProviderError(403)).toBe("config");
  });

  it("classifies 400 with 'invalid' message as validation", () => {
    expect(classifyProviderError(400, "invalid email format")).toBe("validation");
  });

  it("classifies 400 without specific message as permanent", () => {
    expect(classifyProviderError(400, "bad request")).toBe("permanent");
  });

  it("classifies 404 as permanent", () => {
    expect(classifyProviderError(404)).toBe("permanent");
  });

  it("classifies 500 as transient", () => {
    expect(classifyProviderError(500)).toBe("transient");
  });

  it("classifies 502 as transient", () => {
    expect(classifyProviderError(502)).toBe("transient");
  });

  it("classifies 503 as transient", () => {
    expect(classifyProviderError(503)).toBe("transient");
  });

  it("classifies 408 timeout as transient", () => {
    expect(classifyProviderError(408)).toBe("transient");
  });

  it("classifies config-related message without status as config", () => {
    expect(classifyProviderError(undefined, "MAILGUN_API_KEY not configured")).toBe("config");
  });
});

// ── severityForErrorClass ─────────────────────────────────────────────

describe("severityForErrorClass", () => {
  it("config → critical (human must intervene)", () => {
    expect(severityForErrorClass("config")).toBe("critical");
  });

  it("rate_limit → warn", () => {
    expect(severityForErrorClass("rate_limit")).toBe("warn");
  });

  it("validation → warn", () => {
    expect(severityForErrorClass("validation")).toBe("warn");
  });

  it("permanent → error", () => {
    expect(severityForErrorClass("permanent")).toBe("error");
  });

  it("transient → warn (retry eligible, not yet critical)", () => {
    expect(severityForErrorClass("transient")).toBe("warn");
  });
});

// ── withTimeout ────────────────────────────────────────────────────────

describe("withTimeout", () => {
  const ctx = { provider: "test", operation: "op" };

  it("resolves normally when promise completes before timeout", async () => {
    const result = await withTimeout(
      async (_signal) => "ok",
      5000,
      ctx,
    );
    expect(result).toBe("ok");
  });

  it("passes the AbortSignal to the fn", async () => {
    let receivedSignal: AbortSignal | null = null;
    await withTimeout(
      async (signal) => { receivedSignal = signal; return "done"; },
      5000,
      ctx,
    );
    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    expect(receivedSignal?.aborted).toBe(false);
  });

  it("throws PROVIDER_TIMEOUT when the operation takes too long", async () => {
    await expect(
      withTimeout(
        async (_signal) => {
          await new Promise((_, reject) => {
            setTimeout(() => reject(Object.assign(new Error("AbortError"), { name: "AbortError" })), 20);
          });
        },
        10,
        ctx,
      )
    ).rejects.toThrow(/PROVIDER_TIMEOUT/);
  });

  it("propagates non-abort errors unchanged", async () => {
    await expect(
      withTimeout(
        async (_signal) => { throw new Error("specific business error"); },
        5000,
        ctx,
      )
    ).rejects.toThrow("specific business error");
  });
});

// ── warnIfThresholdReached ────────────────────────────────────────────

describe("warnIfThresholdReached", () => {
  const ctx = { provider: "test", operation: "op" };

  it("does not warn below threshold", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnIfThresholdReached(2, ctx);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("warns at exactly the threshold (3)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnIfThresholdReached(3, ctx);
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("does not warn between thresholds (e.g. 4)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnIfThresholdReached(4, ctx);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("warns again at 2x threshold (6)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnIfThresholdReached(6, ctx);
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});

// ── Provider Snapshot ─────────────────────────────────────────────────

describe("provider-snapshot", () => {
  beforeEach(() => {
    resetSnapshots();
  });

  it("returns null for unknown provider", () => {
    expect(getSnapshot("unknown", "op")).toBeNull();
  });

  it("records success and updates totals", () => {
    recordSuccess("resend", "send_email");
    const snap = getSnapshot("resend", "send_email");
    expect(snap).not.toBeNull();
    expect(snap!.totalSuccesses).toBe(1);
    expect(snap!.consecutiveFailures).toBe(0);
    expect(snap!.lastSuccessAt).not.toBeNull();
    expect(snap!.status).toBe("healthy");
  });

  it("records failure and updates totals", () => {
    recordFailure("mailgun", "send_email", "ECONNREFUSED");
    const snap = getSnapshot("mailgun", "send_email");
    expect(snap!.totalFailures).toBe(1);
    expect(snap!.consecutiveFailures).toBe(1);
    expect(snap!.lastFailureMessage).toBe("ECONNREFUSED");
  });

  it("resets consecutiveFailures after a success", () => {
    recordFailure("mailgun", "send_email", "err1");
    recordFailure("mailgun", "send_email", "err2");
    recordSuccess("mailgun", "send_email");
    const snap = getSnapshot("mailgun", "send_email");
    expect(snap!.consecutiveFailures).toBe(0);
    expect(snap!.totalFailures).toBe(2);
    expect(snap!.totalSuccesses).toBe(1);
  });

  it('status is "degraded" after 3 consecutive failures', () => {
    recordFailure("resend", "send_email", "e");
    recordFailure("resend", "send_email", "e");
    recordFailure("resend", "send_email", "e");
    expect(getSnapshot("resend", "send_email")!.status).toBe("degraded");
  });

  it('status is "failing" after 5 consecutive failures', () => {
    for (let i = 0; i < 5; i++) recordFailure("resend", "send_email", "e");
    expect(getSnapshot("resend", "send_email")!.status).toBe("failing");
  });

  it('status is "healthy" after recovering from failures', () => {
    for (let i = 0; i < 5; i++) recordFailure("resend", "send_email", "e");
    recordSuccess("resend", "send_email");
    expect(getSnapshot("resend", "send_email")!.status).toBe("healthy");
  });

  it("getAllSnapshots returns all recorded providers", () => {
    recordSuccess("resend", "send_email");
    recordFailure("mailgun", "send_email", "err");
    const all = getAllSnapshots();
    expect(Object.keys(all)).toContain("resend:send_email");
    expect(Object.keys(all)).toContain("mailgun:send_email");
  });

  it("tracks provider and operation independently", () => {
    recordSuccess("resend", "send_email");
    recordFailure("resend", "verify_domain");
    const emailSnap = getSnapshot("resend", "send_email");
    const verifySnap = getSnapshot("resend", "verify_domain");
    expect(emailSnap!.consecutiveFailures).toBe(0);
    expect(verifySnap!.consecutiveFailures).toBe(1);
  });
});

/**
 * Provider Snapshot — In-Memory State Tracker
 *
 * Records last success, last failure, consecutive failure count, and
 * lifetime totals per provider (optionally per provider:operation).
 *
 * This is a lightweight in-memory store — it resets on server restart.
 * It is designed to support the admin diagnostics surface and failure
 * threshold alerting without requiring a database or external store.
 *
 * Usage:
 *   import { recordSuccess, recordFailure, getAllSnapshots } from "@lib/provider-snapshot";
 *
 *   // In your provider call:
 *   recordSuccess("mailgun", "send_email");
 *   recordFailure("resend", "send_email", "ECONNREFUSED");
 *
 *   // In diagnostics endpoint:
 *   getAllSnapshots();
 */

export interface ProviderSnapshot {
  provider: string;
  operation: string | null;
  lastSuccessAt: string | null;     // ISO 8601
  lastFailureAt: string | null;     // ISO 8601
  lastFailureMessage: string | null;
  consecutiveFailures: number;
  totalSuccesses: number;
  totalFailures: number;
  status: "healthy" | "degraded" | "failing" | "unknown";
}

interface MutableState {
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastFailureMessage: string | null;
  consecutiveFailures: number;
  totalSuccesses: number;
  totalFailures: number;
}

const DEGRADED_THRESHOLD = 3;
const FAILING_THRESHOLD  = 5;

const store = new Map<string, MutableState>();

function storeKey(provider: string, operation?: string): string {
  return operation ? `${provider}:${operation}` : provider;
}

function initState(): MutableState {
  return {
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFailureMessage: null,
    consecutiveFailures: 0,
    totalSuccesses: 0,
    totalFailures: 0,
  };
}

function deriveStatus(state: MutableState): ProviderSnapshot["status"] {
  if (state.totalSuccesses === 0 && state.totalFailures === 0) return "unknown";
  if (state.consecutiveFailures >= FAILING_THRESHOLD)  return "failing";
  if (state.consecutiveFailures >= DEGRADED_THRESHOLD) return "degraded";
  return "healthy";
}

function toSnapshot(key: string, state: MutableState): ProviderSnapshot {
  const parts = key.split(":");
  return {
    provider: parts[0],
    operation: parts.length > 1 ? parts.slice(1).join(":") : null,
    lastSuccessAt: state.lastSuccessAt?.toISOString() ?? null,
    lastFailureAt: state.lastFailureAt?.toISOString() ?? null,
    lastFailureMessage: state.lastFailureMessage,
    consecutiveFailures: state.consecutiveFailures,
    totalSuccesses: state.totalSuccesses,
    totalFailures: state.totalFailures,
    status: deriveStatus(state),
  };
}

// ── Public API ────────────────────────────────────────────────────────

export function recordSuccess(provider: string, operation?: string): void {
  const key = storeKey(provider, operation);
  const state = store.get(key) ?? initState();
  state.lastSuccessAt = new Date();
  state.consecutiveFailures = 0;
  state.totalSuccesses++;
  store.set(key, state);
}

export function recordFailure(
  provider: string,
  operation?: string,
  message?: string,
): void {
  const key = storeKey(provider, operation);
  const state = store.get(key) ?? initState();
  state.lastFailureAt = new Date();
  state.lastFailureMessage = message ?? null;
  state.consecutiveFailures++;
  state.totalFailures++;
  store.set(key, state);
}

export function getSnapshot(
  provider: string,
  operation?: string,
): ProviderSnapshot | null {
  const key = storeKey(provider, operation);
  const state = store.get(key);
  if (!state) return null;
  return toSnapshot(key, state);
}

export function getAllSnapshots(): Record<string, ProviderSnapshot> {
  const result: Record<string, ProviderSnapshot> = {};
  for (const [key, state] of store.entries()) {
    result[key] = toSnapshot(key, state);
  }
  return result;
}

/**
 * Resets all snapshots — useful for testing or after a known provider incident.
 */
export function resetSnapshots(): void {
  store.clear();
}

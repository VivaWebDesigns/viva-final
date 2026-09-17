import { describe, expect, it, vi } from "vitest";
import { presentBacklinkResult } from "../../server/features/backlinks/presentation";
import { backlinkComparisonInput, backlinkReportInput, normalizeBacklinkDomain } from "../../server/features/backlinks/schema";
import { assembleBacklinkReport, backlinkPlan } from "../../server/features/backlinks/report";
import { fetchBacklinkSection, type BacklinkSection } from "../../server/features/backlinks/provider";
import { runBacklinkSnapshot, type BacklinkStore, type Snapshot } from "../../server/features/backlinks/service";

const now = new Date("2026-09-17T12:00:00Z");
const input = backlinkReportInput.parse({ domain: "https://www.ccasecure.com/path" });
const summary = { target: "ccasecure.com", backlinks: 502, referring_domains: 45, rank: 170 };
const section = (result: Record<string, unknown>): BacklinkSection => ({ status: "complete", endpoint: "summary", task_id: "task", cost_usd: 0.024, status_code: 20000, result });
const request = backlinkPlan(input, now).requests[0];
const reply = (task: unknown, status_code = 20000) => new Response(JSON.stringify({ status_code, tasks: [task], cost: 0.024 }));
const provider = (task: unknown) => fetchBacklinkSection(request, { login: "private-login", password: "private-password", fetchImpl: vi.fn(async () => reply(task)) as typeof fetch });

function memoryStore() {
  const snapshots = new Map<string, Snapshot>();
  const store: BacklinkStore = {
    claim: vi.fn(async plan => {
      const existing = snapshots.get(plan.cache_key);
      if (existing) return { created: false, snapshot: existing };
      const snapshot: Snapshot = { id: "snapshot", fingerprint: plan.fingerprint, domain: plan.domain, kind: plan.kind,
        status: "running", createdAt: now, completedAt: null, report: null, sections: {} };
      snapshots.set(plan.cache_key, snapshot);
      return { created: true, snapshot };
    }),
    saveSection: vi.fn(async (_id, key, value) => { for (const saved of snapshots.values()) (saved.sections as Record<string, BacklinkSection>)[key] = value; }),
    finish: vi.fn(async (_id, report) => {
      const snapshot = [...snapshots.values()][0];
      Object.assign(snapshot, { report, status: report.status, completedAt: now });
      return snapshot;
    }),
  };
  return store;
}

describe("backlink inputs and provider contracts", () => {
  it("normalizes domains and rejects private/credential-bearing inputs before paid work", () => {
    expect(input.domain).toBe("ccasecure.com");
    for (const domain of ["localhost", "http://127.0.0.1", "https://user:secret@example.com", "ftp://example.com", "app.railway.internal", "http://[::1]", "example.com:8080"]) {
      expect(() => normalizeBacklinkDomain(domain)).toThrow();
    }
    expect(() => backlinkReportInput.parse({ domain: "example.com", limit: 101 })).toThrow();
    expect(() => backlinkComparisonInput.parse({ domain: "www.example.com", competitors: ["example.com"] })).toThrow();
  });
  it("builds bounded calls with explicit scope and correct sorting/date range", () => {
    const plan = backlinkPlan(input, now);
    expect(plan.requests).toHaveLength(7);
    expect(plan.date_from).toBe("2026-08-19");
    expect(plan.requests.find(r => r.section === "linked_pages")?.body.order_by).toEqual(["page_summary.backlinks,desc"]);
    expect(plan.requests.find(r => r.section === "changes")?.body.group_range).toBe("day");
    expect(plan.requests[0].body).toMatchObject({ rank_scale: "one_thousand", backlinks_status_type: "live", exclude_internal_backlinks: true });
    expect(plan.estimated_cost_usd).toBeLessThan(0.5);
  });
  it("deduplicates competitors and excludes the client from link gaps", () => {
    const plan = backlinkPlan({ ...input, competitors: ["b.com", "a.com", "b.com"] }, now);
    expect(plan.competitors).toEqual(["a.com", "b.com"]);
    expect(plan.requests).toHaveLength(4);
    expect(plan.requests.at(-1)?.body).toMatchObject({ targets: { "1": "a.com", "2": "b.com" }, exclude_targets: ["ccasecure.com"], intersection_mode: "all" });
  });
  it("does not mistake a task failure inside HTTP 200 for success", async () => {
    expect(await provider({ status_code: 40501, id: "failed", result: null, status_message: "secret private-password" })).toMatchObject({ status: "provider_error", cost_usd: 0.024, result: null });
    expect(JSON.stringify(await provider({ status_code: 40501, status_message: "private-password" }))).not.toContain("private-password");
  });
  it("rejects wrong-target, empty, and incomplete success payloads", async () => {
    for (const result of [null, [{}], [{ ...summary, target: "other.com" }], [{ target: "ccasecure.com" }]]) {
      expect((await provider({ status_code: 20000, result })).status).not.toBe("complete");
    }
    expect((await provider({ status_code: 20000, result: [{ ...summary, backlinks: 0, referring_domains: 0 }] })).status).toBe("complete");
  });
  it("preserves unknown cost on timeout and never retries", async () => {
    const fetchImpl = vi.fn(async () => { throw new Error("private-password"); });
    const result = await fetchBacklinkSection(request, { login: "x", password: "y", fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: "unknown", cost_usd: null, result: null });
    expect(JSON.stringify(result)).not.toContain("private-password");
  });
  it("rejects mismatched comparison identity and missing detail rows", async () => {
    const gap = backlinkPlan({ ...input, competitors: ["a.com"] }, now).requests.at(-1)!;
    for (const result of [{ targets: { "1": "wrong.com" }, items_count: 0, items: [] },
      { targets: { "1": "a.com" }, items_count: 2, items: [] }]) {
      const response = await fetchBacklinkSection(gap, { login: "x", password: "y", fetchImpl: vi.fn(async () => reply({ status_code: 20000, result: [result] })) });
      expect(response.status).toBe("provider_error");
      expect(response.result).toBeNull();
    }
  });
  it("keeps unavailable metrics null and derives counts only from measured data", () => {
    const report = assembleBacklinkReport(backlinkPlan(input, now), { summary: section(summary), dofollow: section({ backlinks: 495, referring_domains: 38 }) });
    expect(report.summary).toMatchObject({ backlinks: 502, nofollow_backlinks: 7, dofollow_referring_domains: 38, backlinks_spam_score: null });
    const missing = assembleBacklinkReport(backlinkPlan(input, now), { summary: { ...section({}), status: "unknown", result: null, cost_usd: null } });
    expect(missing.summary.backlinks).toBeNull();
    expect(missing.changes.new_backlinks).toBeNull();
    expect(missing.receipt.cost_complete).toBe(false);
  });
  it("maps gap keys to selected competitors and never marks candidates reviewed", () => {
    const plan = backlinkPlan({ ...input, competitors: ["b.com", "a.com"] }, now);
    const report = assembleBacklinkReport(plan, { opportunities: section({ items: [{ domain_intersection: { "2": { target: "chamber.org", backlinks: 1 } } }] }) });
    expect(report.opportunities[0]).toMatchObject({ domain: "chamber.org", review_status: "unreviewed", linked_competitors: [{ competitor: "b.com", backlinks: 1 }] });
  });
});

describe("paid snapshot idempotency and history receipts", () => {
  const fetchSection = vi.fn(async () => section(summary));
  it("rejects over-budget work before claiming or submitting", async () => {
    const store = memoryStore();
    await expect(runBacklinkSnapshot({ ...input, max_cost_usd: 0 }, "actor", store, { now, configured: true, fetchSection })).rejects.toThrow("exceeds");
    expect(store.claim).not.toHaveBeenCalled();
  });
  it("serves repeated daily reports from saved snapshots without new calls", async () => {
    const store = memoryStore();
    const fetch = vi.fn(async () => section(summary));
    const first = await runBacklinkSnapshot(input, "actor", store, { now, configured: true, fetchSection: fetch });
    const second = await runBacklinkSnapshot(input, "actor", store, { now, configured: true, fetchSection: fetch });
    expect(first.cached).toBe(false);
    expect(second).toMatchObject({ cached: true, snapshot_id: first.snapshot_id, charged_this_call_usd: 0 });
    expect(fetch).toHaveBeenCalledTimes(7);
    expect(store.saveSection).toHaveBeenCalledTimes(7);
  });
  it("claims concurrent identical work once", async () => {
    const store = memoryStore();
    const fetch = vi.fn(async () => section(summary));
    const results = await Promise.all([1, 2].map(() => runBacklinkSnapshot(input, "actor", store, { now, configured: true, fetchSection: fetch })));
    expect(fetch).toHaveBeenCalledTimes(7);
    expect(results.filter(r => r.cached)).toHaveLength(1);
  });
  it("rejects reusing a refresh ID with a different envelope", async () => {
    const store = memoryStore();
    const refresh = { ...input, refresh_id: "d10c4e5a-6c31-4cdf-9803-e7d892c29765" };
    await runBacklinkSnapshot(refresh, "actor", store, { now, configured: true, fetchSection });
    await expect(runBacklinkSnapshot({ ...refresh, domain: "other.com" }, "actor", store, { now, configured: true, fetchSection })).rejects.toThrow("different report");
  });
  it("persists partial failures without inventing zeroes or retrying", async () => {
    const store = memoryStore();
    const result = await runBacklinkSnapshot(input, "actor", store, { now, configured: true, fetchSection: async req => req.section === "summary" ?
      { ...section({}), status: "provider_error", result: null } : section(summary) });
    expect(result.status).toBe("partial");
    expect((result.report as { summary: { backlinks: unknown } }).summary.backlinks).toBeNull();
  });
  it("leaves interrupted work claimed if receipt storage fails", async () => {
    const store = memoryStore();
    store.saveSection = vi.fn(async () => { throw new Error("database unavailable"); });
    const fetch = vi.fn(async () => section(summary));
    await expect(runBacklinkSnapshot(input, "actor", store, { now, configured: true, fetchSection: fetch })).rejects.toThrow("interrupted");
    const retry = await runBacklinkSnapshot(input, "actor", store, { now, configured: true, fetchSection: fetch });
    expect(retry).toMatchObject({ status: "running", cached: true, charged_this_call_usd: 0 });
    expect(fetch).toHaveBeenCalledTimes(4);
  });
});


describe("compact connector evidence", () => {
  it("keeps source URLs, anchors, counts and receipts without mutating stored evidence", () => {
    const value = { report: { provider: "DataForSEO", sections: { backlinks: { task_id: "task", cost_usd: 0.024, result: { target: "ccasecure.com", total_count: 72, items_count: 1, items: [{url_from: "https://source.com/page", url_to: "https://ccasecure.com/", anchor: "security", dofollow: true, page_from: { huge_metadata: "omitted" }}] } } } } };
    const compact = JSON.stringify(presentBacklinkResult(value));
    expect(compact).toContain("https://source.com/page");
    expect(compact).toContain('"total_count":72');
    expect(compact).toContain('"cost_usd":0.024');
    expect(compact).not.toContain("huge_metadata");
    expect(JSON.stringify(value)).toContain("huge_metadata");
  });
});

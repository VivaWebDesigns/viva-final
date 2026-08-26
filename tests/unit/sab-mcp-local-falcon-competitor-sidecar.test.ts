import { describe, expect, it, vi } from "vitest";
import { buildSabCompetitorSidecarInputSchema } from "../../server/features/sab-mcp/schema";
import { buildSabCompetitorSidecar } from "../../server/features/sab-mcp/localFalconCompetitorSidecar";

type Prospect = ReturnType<typeof prospect>;

function prospect(reportKey: string, placeId: string, name: string) {
  return {
    place_id: placeId,
    company_name: name,
    address: "Service Area Business",
    city: "Charlotte",
    state: "NC",
    zip: "28202",
    phone: null,
    owner_name: null,
    email: null,
    contact_tag: "Needs Email",
    has_website: false,
    website_url: null,
    website_platform: null,
    report_key: reportKey,
    report_url: `https://www.localfalcon.com/reports/view/${reportKey}`,
    scan_date: "2026-08-25",
    scan_keyword: "roofer near me",
    arp: 10,
    solv: 20,
    rating: 4.5,
    review_count: 25,
    qualification_status: "qualified",
  } as const;
}

function manifest(prospects: Prospect[]) {
  return JSON.stringify({
    workflow: "scale_first_v2",
    batch: {
      batch_id: "charlotte-roofers-2026-08",
      market: { city: "Charlotte", state: "NC" },
      trade: "Roofing",
      keyword: "roofer near me",
      export_date: "2026-08-25",
      scan_spec: { grid_size: "3x3", radius_miles: 2 },
    },
    prospects,
  });
}

function business(placeId: string, name: string, ranks: unknown[] = [1, "4", "20+", false]) {
  return {
    place_id: placeId,
    name,
    address: "must never escape",
    lat: "35.1",
    lng: "-80.8",
    solv: "25.5",
    reviews: "12",
    rating: "4.7",
    data_points: ranks.map((rank, index) => ({
      rank,
      lat: 35 + index / 10,
      lng: -80 - index / 10,
      raw_result: "must never escape",
    })),
  };
}

function payloads(
  subject: Prospect,
  businesses: ReturnType<typeof business>[],
  scanSpec: { gridSize: string; radius: string } = { gridSize: "3", radius: "2" },
) {
  const common = {
    report_key: subject.report_key,
    date: "8/25/2026 1:15 PM",
    looker_date: "20260825",
    keyword: "roofer near me",
    grid_size: scanSpec.gridSize,
    radius: scanSpec.radius,
    measurement: "mi",
  };
  return {
    competitor: { success: true, data: { ...common, businesses } },
    scan: { success: true, data: { ...common, place_id: subject.place_id } },
  };
}

function fetchFor(reports: Map<string, ReturnType<typeof payloads>>) {
  return vi.fn(async (url: string | URL | Request) => {
    const text = String(url);
    const reportKey = text.match(/\/(?:competitor-reports|reports)\/([^/?]+)/)?.[1] ?? "";
    const report = reports.get(reportKey);
    if (!report) return new Response(JSON.stringify({ success: false, message: "Report missing" }), { status: 200 });
    const body = text.includes("/competitor-reports/") ? report.competitor : report.scan;
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  });
}

function parsedSidecar(result: Awaited<ReturnType<typeof buildSabCompetitorSidecar>>) {
  expect(result.competitors_json).not.toBeNull();
  return JSON.parse(result.competitors_json!);
}

describe("SAB competitor sidecar builder", () => {
  it("accepts only the complete manifest JSON input", () => {
    expect(buildSabCompetitorSidecarInputSchema.manifest_json.parse(" {\"workflow\":\"scale_first_v2\"} "))
      .toBe("{\"workflow\":\"scale_first_v2\"}");
  });

  it("selects the exact Place-ID subject with its adjacent ordinal businesses and numeric found points", async () => {
    const subject = prospect("abcdef123456", "ChIJ-subject", "Same Name");
    const report = payloads(subject, [
      business("ChIJ-above", "Same Name", [1]),
      business("ChIJ-subject", "Same Name", [2, "7", "20+", false, null]),
      business("ChIJ-below", "Below", ["3", "unranked"]),
      business("ChIJ-extra", "Extra", [4]),
    ]);
    const result = await buildSabCompetitorSidecar(manifest([subject]), {
      apiKey: "secret",
      fetchImpl: fetchFor(new Map([[subject.report_key, report]])) as typeof fetch,
    });
    const sidecar = parsedSidecar(result);
    const selected = sidecar.reports[subject.report_key];

    expect(result.reconciliation).toMatchObject({
      complete: true,
      requested_report_count: 1,
      reconciled_report_count: 1,
      failed_report_count: 0,
      scans_executed: false,
      writes_performed: false,
    });
    expect(selected.subject_rank).toBe(2);
    expect(selected.businesses_ahead_count).toBe(1);
    expect(selected.businesses.map((entry: { rank: number }) => entry.rank)).toEqual([1, 2, 3]);
    expect(selected.businesses.map((entry: { place_id: string }) => entry.place_id))
      .toEqual(["ChIJ-above", "ChIJ-subject", "ChIJ-below"]);
    expect(selected.businesses[1].found_points).toBe(2);
    expect(selected.businesses[1].is_subject).toBe(true);
    expect(result.competitors_json).not.toMatch(/address|latitude|longitude|raw_result|ChIJ-extra/);
  });

  it("builds a mixed-spec sidecar from a prospect-level 7x7/5-mile override", async () => {
    const subject = {
      ...prospect("abcdef12345d", "ChIJ-five-mile", "Five Mile"),
      scan_spec: { grid_size: "7x7", radius_miles: 5 },
    };
    const report = payloads(
      subject,
      [business(subject.place_id, subject.company_name)],
      { gridSize: "7", radius: "5" },
    );
    const sidecar = parsedSidecar(await buildSabCompetitorSidecar(manifest([subject] as Prospect[]), {
      apiKey: "secret",
      fetchImpl: fetchFor(new Map([[subject.report_key, report]])) as typeof fetch,
    }));

    expect(sidecar.reports[subject.report_key]).toMatchObject({
      grid_size: 7,
      radius_miles: 5,
      subject_place_id: subject.place_id,
    });
  });

  it("returns only subject and below for first rank, and above and subject for last rank", async () => {
    const first = prospect("abcdef123457", "ChIJ-first", "First");
    const last = prospect("abcdef123458", "ChIJ-last", "Last");
    const reports = new Map([
      [first.report_key, payloads(first, [business(first.place_id, "First"), business("ChIJ-first-below", "Below")])],
      [last.report_key, payloads(last, [business("ChIJ-last-above", "Above"), business(last.place_id, "Last")])],
    ]);
    const sidecar = parsedSidecar(await buildSabCompetitorSidecar(manifest([first, last]), {
      apiKey: "secret",
      fetchImpl: fetchFor(reports) as typeof fetch,
    }));

    expect(sidecar.reports[first.report_key].businesses.map((entry: { rank: number }) => entry.rank)).toEqual([1, 2]);
    expect(sidecar.reports[last.report_key].businesses.map((entry: { rank: number }) => entry.rank)).toEqual([1, 2]);
    expect(sidecar.reports[first.report_key].subject_rank).toBe(1);
    expect(sidecar.reports[last.report_key].subject_rank).toBe(2);
  });

  it("returns per-report reconciliation errors for report, spec, keyword, and date mismatches", async () => {
    const subject = prospect("abcdef123459", "ChIJ-mismatch", "Mismatch");
    const report = payloads(subject, [business(subject.place_id, "Mismatch")]);
    Object.assign(report.competitor.data, {
      report_key: "abcdef999999",
      keyword: "plumber near me",
      grid_size: "5",
      radius: "3",
      looker_date: "20260824",
    });
    const result = await buildSabCompetitorSidecar(manifest([subject]), {
      apiKey: "secret",
      fetchImpl: fetchFor(new Map([[subject.report_key, report]])) as typeof fetch,
    });

    expect(result.competitors_json).toBeNull();
    expect(result.reconciliation).toMatchObject({ complete: false, reconciled_report_count: 0, failed_report_count: 1 });
    expect(result.reconciliation.errors[0].errors.join(" ")).toMatch(/report key mismatch/);
    expect(result.reconciliation.errors[0].errors.join(" ")).toMatch(/keyword mismatch/);
    expect(result.reconciliation.errors[0].errors.join(" ")).toMatch(/grid size mismatch/);
    expect(result.reconciliation.errors[0].errors.join(" ")).toMatch(/radius mismatch/);
    expect(result.reconciliation.errors[0].errors.join(" ")).toMatch(/scan date mismatch/);
  });

  it("does not emit a sidecar when the exact subject Place ID is missing", async () => {
    const subject = prospect("abcdef12345a", "ChIJ-missing", "Missing");
    const result = await buildSabCompetitorSidecar(manifest([subject]), {
      apiKey: "secret",
      fetchImpl: fetchFor(new Map([[
        subject.report_key,
        payloads(subject, [business("ChIJ-other", "Other")]),
      ]])) as typeof fetch,
    });

    expect(result.competitors_json).toBeNull();
    expect(result.reconciliation.complete).toBe(false);
    expect(result.reconciliation.errors[0].errors).toContain(
      "subject Place ID is missing from the official businesses array",
    );
  });

  it("treats duplicate exact subject Place IDs as an ambiguous report", async () => {
    const subject = prospect("abcdef12345c", "ChIJ-duplicate", "Duplicate");
    const result = await buildSabCompetitorSidecar(manifest([subject]), {
      apiKey: "secret",
      fetchImpl: fetchFor(new Map([[
        subject.report_key,
        payloads(subject, [
          business(subject.place_id, "Duplicate One"),
          business(subject.place_id, "Duplicate Two"),
        ]),
      ]])) as typeof fetch,
    });

    expect(result.competitors_json).toBeNull();
    expect(result.reconciliation.errors[0].errors).toContain(
      "subject Place ID is ambiguous in the official businesses array",
    );
  });

  it("returns a per-report error and no sidecar when an official report is missing", async () => {
    const subject = prospect("abcdef12345b", "ChIJ-no-report", "No Report");
    const result = await buildSabCompetitorSidecar(manifest([subject]), {
      apiKey: "secret",
      fetchImpl: fetchFor(new Map()) as typeof fetch,
    });

    expect(result.competitors_json).toBeNull();
    expect(result.reconciliation).toMatchObject({
      complete: false,
      requested_report_count: 1,
      reconciled_report_count: 0,
      failed_report_count: 1,
      errors: [{ report_key: subject.report_key, errors: ["Report missing"] }],
    });
  });

  it("reconciles 30 reports with bounded request concurrency", async () => {
    const prospects = Array.from({ length: 30 }, (_, index) =>
      prospect(index.toString(16).padStart(12, "0"), `ChIJ-${index}`, `Business ${index}`));
    const reports = new Map(prospects.map((entry) => [
      entry.report_key,
      payloads(entry, [business(entry.place_id, entry.company_name)]),
    ]));
    let activeRequests = 0;
    let maxActiveRequests = 0;
    const baseFetch = fetchFor(reports);
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      activeRequests += 1;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
      await new Promise((resolve) => setTimeout(resolve, 2));
      try {
        return await baseFetch(url, init);
      } finally {
        activeRequests -= 1;
      }
    });

    const result = await buildSabCompetitorSidecar(manifest(prospects), {
      apiKey: "secret",
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(result.reconciliation).toMatchObject({
      complete: true,
      requested_report_count: 30,
      reconciled_report_count: 30,
      failed_report_count: 0,
      report_concurrency: 4,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(60);
    expect(maxActiveRequests).toBeGreaterThan(1);
    expect(maxActiveRequests).toBeLessThanOrEqual(4);
    expect(Object.keys(parsedSidecar(result).reports)).toHaveLength(30);
  });
});

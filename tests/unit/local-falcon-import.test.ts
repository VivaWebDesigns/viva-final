import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { strToU8, zipSync } from "fflate";
import sharp from "sharp";
import {
  isLocalFalconBatchFullyImported,
  parseLocalFalconPayload,
} from "../../server/features/crm/localFalconImport";
import {
  LocalFalconImageFetchError,
  parseLocalFalconPackage,
} from "../../server/features/crm/localFalconPackage";
import { parseLocalFalconCompetitorSidecar } from "../../server/features/crm/localFalconCompetitors";
import {
  LOCAL_FALCON_LEAD_CLASSIFICATIONS,
  getLocalFalconLeadClassification,
} from "../../shared/leadClassification";

const heatmapPath = "heatmaps/ChIJ-test-1.png";
const prospect = {
  place_id: "ChIJ-test-1",
  company_name: "Acme Roofing LLC",
  address: "1 Main St",
  city: "Monroe",
  state: "nc",
  zip: "28110",
  phone: "704-555-0111",
  owner_name: "Ana Rivera",
  email: "ana@acmeroofing.com",
  google_maps_url: "https://maps.google.com/example",
  has_website: true,
  website_url: "https://acmeroofing.com",
  service_page_count: 3,
  report_key: "abcdef123456789",
  report_url: "https://www.localfalcon.com/reports/view/abcdef123456789",
  scan_date: "2026-07-20",
  scan_keyword: "roofer",
  arp: 8.2,
  solv: 16.33,
  rating: 4.8,
  review_count: 41,
  sales_priority: 3,
  sales_priority_reason: "Thin website and active paid-lead usage.",
  heatmap_file: heatmapPath,
  qualification_status: "qualified",
};

const payload = {
  batch: {
    batch_id: "monroe-roofing-2026-07",
    market: { city: "Monroe", state: "nc" },
    trade: "roofing",
    keyword: "roofer",
    export_date: "2026-07-22",
    scan_spec: { grid_size: "7x7", radius_miles: 2.5 },
  },
  prospects: [prospect],
};

const competitorSidecar = {
  version: 1,
  batch_id: payload.batch.batch_id,
  generated_at: "2026-07-22T14:30:00-04:00",
  ranking_source: "local_falcon",
  reports: {
    [prospect.report_key]: {
      competitor_report_key: "fedcba987654321",
      subject_place_id: prospect.place_id,
      subject_name: prospect.company_name,
      keyword: prospect.scan_keyword,
      grid_size: 7,
      radius_miles: payload.batch.scan_spec.radius_miles,
      scan_date: prospect.scan_date,
      subject_rank: 2,
      total_businesses: 2,
      businesses_ahead_count: 1,
      warnings: [],
      businesses: [
        {
          rank: 1,
          place_id: "ChIJ-competitor-1",
          name: "Beta Roofing",
          address_raw: "2 Main St, Monroe, NC 28110",
          address: "2 Main St",
          city: "Monroe",
          state: "NC",
          zip: "28110",
          lat: 35.0,
          lng: -80.5,
          arp: 3.1,
          atrp: null,
          atrp_capped: true,
          solv: 51.02,
          reviews: 464,
          rating: 4.7,
          is_subject: false,
        },
        {
          rank: 2,
          place_id: prospect.place_id,
          name: prospect.company_name,
          address_raw: "1 Main St, Monroe, NC 28110",
          address: "1 Main St",
          city: "Monroe",
          state: "NC",
          zip: "28110",
          lat: 35.01,
          lng: -80.51,
          arp: 8.2,
          atrp: 10.27,
          atrp_capped: false,
          solv: 16.33,
          reviews: 41,
          rating: 4.8,
          is_subject: true,
        },
      ],
    },
  },
};

describe("Local Falcon lead classifications", () => {
  it("requires the two supported import classifications", () => {
    expect(LOCAL_FALCON_LEAD_CLASSIFICATIONS.map((item) => item.value)).toEqual([
      "sab",
      "location_based",
    ]);
    expect(getLocalFalconLeadClassification("sab")).toMatchObject({
      label: "SAB",
      tagSlug: "sab",
    });
  });
});

describe("parseLocalFalconPayload", () => {
  it("parses the canonical JSON manifest and normalizes state", () => {
    const result = parseLocalFalconPayload(JSON.stringify(payload));
    expect(result.batch.market.state).toBe("NC");
    expect(result.prospects[0].state).toBe("NC");
    expect(result.prospects[0].qualification_status).toBe("qualified");
    expect(result.prospects[0]).toMatchObject({
      email: "ana@acmeroofing.com",
      solv: 16.33,
      sales_priority: 3,
      sales_priority_reason: "Thin website and active paid-lead usage.",
    });
  });

  it("rejects duplicate Place IDs inside one manifest", () => {
    expect(() => parseLocalFalconPayload(JSON.stringify({ ...payload, prospects: [prospect, prospect] })))
      .toThrow(/place_id is duplicated/i);
  });

  it("rejects duplicate report keys even when the Place IDs differ", () => {
    expect(() => parseLocalFalconPayload(JSON.stringify({
      ...payload,
      prospects: [
        prospect,
        {
          ...prospect,
          place_id: "ChIJ-test-2",
          company_name: "Beta Roofing LLC",
          heatmap_file: "heatmaps/ChIJ-test-2.png",
        },
      ],
    }))).toThrow(/report_key is duplicated/i);
  });

  it("rejects disqualified rows before they can enter the CRM", () => {
    expect(() => parseLocalFalconPayload(JSON.stringify({
      ...payload,
      prospects: [{ ...prospect, qualification_status: "disqualified" }],
    }))).toThrow(/qualification_status/i);
  });

  it("requires each scan keyword to match its batch", () => {
    expect(() => parseLocalFalconPayload(JSON.stringify({
      ...payload,
      prospects: [{ ...prospect, scan_keyword: "roof repair" }],
    }))).toThrow(/scan_keyword must match batch.keyword/i);
  });

  it("accepts nullable platform and 3–6 sentence analysis arrays", () => {
    const result = parseLocalFalconPayload(JSON.stringify({
      ...payload,
      prospects: [{
        ...prospect,
        website_platform: "Lovable",
        website_analysis: ["One.", "Two.", "Three."],
        reviews_analysis: null,
      }],
    }));

    expect(result.prospects[0].website_platform).toBe("Lovable");
    expect(result.prospects[0].website_analysis).toEqual(["One.", "Two.", "Three."]);
    expect(result.prospects[0].reviews_analysis).toBeNull();
  });

  it("rejects analysis arrays outside the 3–6 element limit", () => {
    expect(() => parseLocalFalconPayload(JSON.stringify({
      ...payload,
      prospects: [{
        ...prospect,
        website_analysis: ["One.", "Two."],
        reviews_analysis: null,
      }],
    }))).toThrow(/website_analysis/i);
  });
});

describe("Local Falcon batch idempotency", () => {
  it("allows a deleted prospect to be restored from an existing batch", () => {
    expect(isLocalFalconBatchFullyImported("existing-batch-id", [{
      row: 1,
      placeId: prospect.place_id,
      companyName: prospect.company_name,
      address: prospect.address,
      heatmapFile: heatmapPath,
      outcome: "new",
    }])).toBe(false);
  });

  it("keeps a fully surviving batch protected from duplicate imports", () => {
    expect(isLocalFalconBatchFullyImported("existing-batch-id", [{
      row: 1,
      placeId: prospect.place_id,
      companyName: prospect.company_name,
      address: prospect.address,
      heatmapFile: heatmapPath,
      outcome: "existing",
    }])).toBe(true);
  });

  it("allows a new radius variation to be imported into an existing batch context", () => {
    expect(isLocalFalconBatchFullyImported("existing-batch-id", [{
      row: 1,
      placeId: prospect.place_id,
      companyName: prospect.company_name,
      address: prospect.address,
      heatmapFile: heatmapPath,
      outcome: "variation",
    }])).toBe(false);
  });
});

describe("parseLocalFalconCompetitorSidecar", () => {
  it("accepts the full Local Falcon order and derives subject position from the array", () => {
    const result = parseLocalFalconCompetitorSidecar(
      JSON.stringify(competitorSidecar),
      parseLocalFalconPayload(JSON.stringify(payload)),
    );

    expect(result.reports[prospect.report_key].businesses.map((business) => business.rank)).toEqual([1, 2]);
    expect(result.reports[prospect.report_key].subject_rank).toBe(2);
    expect(result.reports[prospect.report_key].businesses[0].atrp_capped).toBe(true);
  });

  it("rejects a sidecar whose business array has been re-sorted", () => {
    const invalid = structuredClone(competitorSidecar);
    invalid.reports[prospect.report_key].businesses[0].rank = 2;

    expect(() => parseLocalFalconCompetitorSidecar(
      JSON.stringify(invalid),
      parseLocalFalconPayload(JSON.stringify(payload)),
    )).toThrow(/array position/i);
  });

  it("rejects a sidecar from a different batch", () => {
    expect(() => parseLocalFalconCompetitorSidecar(
      JSON.stringify({ ...competitorSidecar, batch_id: "another-batch" }),
      parseLocalFalconPayload(JSON.stringify(payload)),
    )).toThrow(/batch_id must match/i);
  });
});

describe("parseLocalFalconPackage", () => {
  it("loads canonical JSON and its referenced original heatmap from one ZIP", async () => {
    const heatmap = await readFile("tests/fixtures/local-visibility/carolina-custom-automation-heatmap.png");
    const zipped = zipSync({ "batch.json": strToU8(JSON.stringify(payload)), [heatmapPath]: heatmap });
    const result = await parseLocalFalconPackage({
      buffer: Buffer.from(zipped),
      originalName: "monroe-roofing.zip",
      mimeType: "application/zip",
    });
    expect(result.heatmapsByPlaceId.get(prospect.place_id)?.buffer).toEqual(heatmap);
    expect(result.heatmapsByPlaceId.get(prospect.place_id)?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.sourceMode).toBe("zip");
  });

  it("loads competitors.json from the ZIP root alongside the scan manifest", async () => {
    const heatmap = await readFile("tests/fixtures/local-visibility/carolina-custom-automation-heatmap.png");
    const zipped = zipSync({
      "batch.json": strToU8(JSON.stringify(payload)),
      "competitors.json": strToU8(JSON.stringify(competitorSidecar)),
      [heatmapPath]: heatmap,
    });
    const result = await parseLocalFalconPackage({
      buffer: Buffer.from(zipped),
      originalName: "monroe-roofing.zip",
      mimeType: "application/zip",
    });

    expect(result.competitors?.reports[prospect.report_key].subject_rank).toBe(2);
  });

  it("rejects ZIP heatmaps that are not referenced by the manifest", async () => {
    const heatmap = await readFile("tests/fixtures/local-visibility/carolina-custom-automation-heatmap.png");
    const zipped = zipSync({
      "batch.json": strToU8(JSON.stringify(payload)),
      [heatmapPath]: heatmap,
      "heatmaps/orphan.png": heatmap,
    });
    await expect(parseLocalFalconPackage({
      buffer: Buffer.from(zipped),
      originalName: "monroe-roofing.zip",
      mimeType: "application/zip",
    })).rejects.toThrow(/unreferenced heatmap/i);
  });

  it("falls back to official retrieval when a ZIP contains no heatmap", async () => {
    const zipped = zipSync({ "batch.json": strToU8(JSON.stringify(payload)) });
    const fetchMap = vi.fn(async () => new Response("missing", { status: 404 }));
    await expect(parseLocalFalconPackage({
      buffer: Buffer.from(zipped),
      originalName: "monroe-roofing.zip",
      mimeType: "application/zip",
    }, [], fetchMap)).rejects.toBeInstanceOf(LocalFalconImageFetchError);
    expect(fetchMap).toHaveBeenCalledTimes(1);
  });

  it("retrieves the official Local Falcon map for JSON-only imports", async () => {
    const fixture = await readFile("tests/fixtures/local-visibility/carolina-custom-automation-heatmap.png");
    const officialMap = await sharp(fixture).resize(1000, 1000, { fit: "fill" }).png().toBuffer();
    const fetchMap = vi.fn(async () => new Response(new Uint8Array(officialMap), {
      status: 200,
      headers: { "content-type": "image/png", "content-length": String(officialMap.length) },
    }));
    const jsonPayload = {
      ...payload,
      prospects: [{ ...prospect, heatmap_file: undefined }],
    };

    const result = await parseLocalFalconPackage({
      buffer: Buffer.from(JSON.stringify(jsonPayload)),
      originalName: "batch.json",
      mimeType: "application/json",
    }, [], fetchMap);

    expect(fetchMap).toHaveBeenCalledWith(
      "https://lf-static-v2.localfalcon.com/image/abcdef123456789",
      expect.objectContaining({ redirect: "manual" }),
    );
    expect(result.sourceMode).toBe("local_falcon");
    expect(result.heatmapsByPlaceId.get(prospect.place_id)?.buffer).toEqual(officialMap);
    expect(result.heatmapsByPlaceId.get(prospect.place_id)?.sourceUrl).toBe(
      "https://lf-static-v2.localfalcon.com/image/abcdef123456789",
    );
  });

  it("retries transient failures before accepting the official map", async () => {
    const fixture = await readFile("tests/fixtures/local-visibility/carolina-custom-automation-heatmap.png");
    const officialMap = await sharp(fixture).resize(1000, 1000, { fit: "fill" }).png().toBuffer();
    const fetchMap = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response(new Uint8Array(officialMap), {
        status: 200,
        headers: { "content-type": "image/png" },
      }));
    const jsonPayload = {
      ...payload,
      prospects: [{ ...prospect, heatmap_file: undefined }],
    };

    const result = await parseLocalFalconPackage({
      buffer: Buffer.from(JSON.stringify(jsonPayload)),
      originalName: "batch.json",
      mimeType: "application/json",
    }, [], fetchMap);

    expect(fetchMap).toHaveBeenCalledTimes(3);
    expect(result.heatmapsByPlaceId.get(prospect.place_id)?.buffer).toEqual(officialMap);
  });

  it("caps simultaneous Local Falcon image requests at three", async () => {
    const fixture = await readFile("tests/fixtures/local-visibility/carolina-custom-automation-heatmap.png");
    const officialMap = await sharp(fixture).resize(1000, 1000, { fit: "fill" }).png().toBuffer();
    let activeRequests = 0;
    let maxActiveRequests = 0;
    const fetchMap = vi.fn(async () => {
      activeRequests += 1;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activeRequests -= 1;
      return new Response(new Uint8Array(officialMap), {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    });
    const jsonPayload = {
      ...payload,
      prospects: Array.from({ length: 7 }, (_, index) => ({
        ...prospect,
        place_id: `ChIJ-test-${index}`,
        company_name: `Acme Roofing ${index}`,
        report_key: index.toString(16).padStart(15, "0"),
        heatmap_file: undefined,
      })),
    };

    const result = await parseLocalFalconPackage({
      buffer: Buffer.from(JSON.stringify(jsonPayload)),
      originalName: "batch.json",
      mimeType: "application/json",
    }, [], fetchMap);

    expect(fetchMap).toHaveBeenCalledTimes(7);
    expect(maxActiveRequests).toBe(3);
    expect(result.heatmapsByPlaceId.size).toBe(7);
  });

  it("uses a Place ID-named fallback only when an official map cannot be retrieved", async () => {
    const fallback = await readFile("tests/fixtures/local-visibility/carolina-custom-automation-heatmap.png");
    const fetchMap = vi.fn();
    const jsonPayload = {
      ...payload,
      prospects: [{ ...prospect, heatmap_file: undefined }],
    };

    const result = await parseLocalFalconPackage({
      buffer: Buffer.from(JSON.stringify(jsonPayload)),
      originalName: "batch.json",
      mimeType: "application/json",
    }, [{
      buffer: fallback,
      originalName: `${prospect.place_id}.png`,
      mimeType: "image/png",
    }], fetchMap);

    expect(fetchMap).not.toHaveBeenCalled();
    expect(result.sourceMode).toBe("fallback");
    expect(result.heatmapsByPlaceId.get(prospect.place_id)?.buffer).toEqual(fallback);
  });

  it("returns structured failures when official retrieval fails", async () => {
    const jsonPayload = {
      ...payload,
      prospects: [{ ...prospect, heatmap_file: undefined }],
    };
    const fetchMap = vi.fn(async () => new Response("missing", { status: 404 }));

    const promise = parseLocalFalconPackage({
      buffer: Buffer.from(JSON.stringify(jsonPayload)),
      originalName: "batch.json",
      mimeType: "application/json",
    }, [], fetchMap);

    await expect(promise).rejects.toMatchObject({
      name: LocalFalconImageFetchError.name,
      failures: [expect.objectContaining({
        placeId: prospect.place_id,
        reportKey: prospect.report_key,
      })],
    });
    expect(fetchMap).toHaveBeenCalledTimes(1);
  });
});

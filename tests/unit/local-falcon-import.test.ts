import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { strToU8, zipSync } from "fflate";
import sharp from "sharp";
import { parseLocalFalconPayload } from "../../server/features/crm/localFalconImport";
import {
  LocalFalconImageFetchError,
  parseLocalFalconPackage,
} from "../../server/features/crm/localFalconPackage";

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
  google_maps_url: "https://maps.google.com/example",
  has_website: true,
  website_url: "https://acmeroofing.com",
  service_page_count: 3,
  report_key: "abcdef123456789",
  report_url: "https://www.localfalcon.com/reports/view/abcdef123456789",
  scan_date: "2026-07-20",
  scan_keyword: "roofer",
  arp: 8.2,
  rating: 4.8,
  review_count: 41,
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

describe("parseLocalFalconPayload", () => {
  it("parses the canonical JSON manifest and normalizes state", () => {
    const result = parseLocalFalconPayload(JSON.stringify(payload));
    expect(result.batch.market.state).toBe("NC");
    expect(result.prospects[0].state).toBe("NC");
    expect(result.prospects[0].qualification_status).toBe("qualified");
  });

  it("rejects duplicate Place IDs inside one manifest", () => {
    expect(() => parseLocalFalconPayload(JSON.stringify({ ...payload, prospects: [prospect, prospect] })))
      .toThrow(/place_id is duplicated/i);
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

  it("rejects a manifest reference whose image is missing", async () => {
    const zipped = zipSync({ "batch.json": strToU8(JSON.stringify(payload)) });
    await expect(parseLocalFalconPackage({
      buffer: Buffer.from(zipped),
      originalName: "monroe-roofing.zip",
      mimeType: "application/zip",
    })).rejects.toThrow(/missing heatmap/i);
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
  });
});

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { parseLocalFalconPayload } from "../../server/features/crm/localFalconImport";
import { parseLocalFalconPackage } from "../../server/features/crm/localFalconPackage";

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
  report_key: "report-1",
  report_url: "https://www.localfalcon.com/reports/view/report-1",
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
});

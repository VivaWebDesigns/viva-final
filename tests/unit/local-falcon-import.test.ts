import { describe, expect, it } from "vitest";
import { parseLocalFalconPayload } from "../../server/features/crm/localFalconImport";

const prospect = {
  place_id: "ChIJ-test-1",
  company_name: "Acme Roofing LLC",
  address: "1 Main St",
  city: "Monroe",
  state: "nc",
  zip: "28110",
  phone: "704-555-0111",
  email: "owner@acmeroofing.com",
  email_domain_type: "branded",
  website_url: "https://acmeroofing.com",
  google_maps_url: "https://maps.google.com/example",
  owner_name: "Ana Rivera",
  report_key: "report-1",
  scan_date: "2026-07-20",
  scan_keyword: "roofer",
  solv: 12.5,
  arp: 8.2,
  atrp: 10.1,
  rating: 4.8,
  review_count: 41,
  footprint_note: "Strong eastward footprint",
  website_condition: "outdated",
  tier: "A",
  pitch_type: "momentum-ceiling",
  pitch_summary: "Strong review equity but limited map visibility.",
  enrichment_status: {
    sos_lookup_done: true,
    sos_entity_found: true,
    license_record_found: false,
  },
};

describe("parseLocalFalconPayload", () => {
  it("parses the canonical JSON handoff and normalizes state", () => {
    const result = parseLocalFalconPayload(JSON.stringify({
      batch: {
        batch_id: "monroe-roofing-2026-07",
        market_city: "Monroe",
        market_state: "nc",
        trade: "roofing",
        keyword: "roofer",
        import_date: "2026-07-22",
      },
      prospects: [prospect],
    }));

    expect(result.batch.market_state).toBe("NC");
    expect(result.prospects[0].state).toBe("NC");
    expect(result.prospects[0].sos_lookup_done).toBe(true);
    expect(result.prospects[0].pitch_type).toBe("momentum-ceiling");
  });

  it("rejects duplicate Place IDs inside one file", () => {
    expect(() => parseLocalFalconPayload(JSON.stringify({
      batch: {
        batch_id: "duplicate-batch",
        market_city: "Monroe",
        market_state: "NC",
        trade: "roofing",
        keyword: "roofer",
        import_date: "2026-07-22",
      },
      prospects: [prospect, prospect],
    }))).toThrow(/duplicate place_id/i);
  });

  it("rejects pitch types outside the controlled vocabulary", () => {
    expect(() => parseLocalFalconPayload(JSON.stringify({
      batch: {
        batch_id: "bad-pitch",
        market_city: "Monroe",
        market_state: "NC",
        trade: "roofing",
        keyword: "roofer",
        import_date: "2026-07-22",
      },
      prospects: [{ ...prospect, pitch_type: "made-up-score" }],
    }))).toThrow(/pitch_type/i);
  });

  it("parses yes/no enrichment flags from CSV", () => {
    const headers = [
      "batch_id", "market_city", "market_state", "trade", "keyword", "import_date",
      ...Object.keys(prospect).filter((key) => key !== "enrichment_status"),
      "sos_lookup_done", "sos_entity_found", "license_record_found",
    ];
    const flat = {
      batch_id: "csv-batch", market_city: "Monroe", market_state: "NC", trade: "roofing", keyword: "roofer", import_date: "2026-07-22",
      ...prospect,
      sos_lookup_done: "yes", sos_entity_found: "yes", license_record_found: "no",
    } as Record<string, unknown>;
    const csv = `${headers.join(",")}\n${headers.map((key) => String(flat[key] ?? "")).join(",")}`;
    const result = parseLocalFalconPayload(csv);
    expect(result.prospects[0].license_record_found).toBe(false);
  });
});

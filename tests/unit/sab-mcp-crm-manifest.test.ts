import { describe, expect, it } from "vitest";
import {
  SAB_CRM_IMPORT_CONTRACT,
  validateSabCrmManifest,
} from "../../server/features/sab-mcp/crmManifest";
import { validateSabCrmManifestInputSchema } from "../../server/features/sab-mcp/schema";

function validManifest() {
  return {
    batch: {
      batch_id: "charlotte-hvac-sab-2026-08",
      market: { city: "Charlotte", state: "NC" },
      trade: "HVAC",
      keyword: "hvac near me",
      export_date: "2026-08-06",
      scan_spec: { grid_size: "7x7", radius_miles: 3 },
    },
    prospects: [{
      place_id: "ChIJ-example",
      company_name: "Example HVAC",
      address: "Service Area Business",
      city: "Charlotte",
      state: "NC",
      zip: "28202",
      phone: null,
      owner_name: null,
      email: null,
      google_maps_url:
        "https://www.google.com/maps/search/?api=1&query_place_id=ChIJ-example",
      has_website: true,
      website_url: "https://example.com",
      website_platform: "WordPress",
      service_page_count: 3,
      website_analysis: ["Finding one", "Finding two", "Finding three"],
      reviews_analysis: ["Finding one", "Finding two", "Finding three"],
      report_key: "abcdef123456",
      report_url: "https://www.localfalcon.com/reports/view/abcdef123456",
      scan_date: "2026-08-06",
      scan_keyword: "hvac near me",
      arp: 12.5,
      solv: 2.04,
      rating: 4.9,
      review_count: 25,
      sales_priority: 3,
      sales_priority_reason: "Clear website-sale opportunity.",
      scan_center: {
        lat: 35.2271,
        lng: -80.8431,
        city: "Charlotte",
        state: "NC",
        zip: "28202",
      },
      qualification_status: "qualified",
    }],
  };
}

describe("SAB CRM manifest contract", () => {
  it("exposes the strict production field contract without writing data", () => {
    expect(SAB_CRM_IMPORT_CONTRACT).toMatchObject({
      contract_version: "1.1",
      strict: true,
      writes_data: false,
      top_level: {
        allowed_keys: ["batch", "prospects"],
      },
    });
    expect(
      SAB_CRM_IMPORT_CONTRACT.top_level.prospects.item.fields,
    ).toHaveProperty("company_name");
    expect(
      SAB_CRM_IMPORT_CONTRACT.top_level.prospects.item.fields,
    ).not.toHaveProperty("company");
  });

  it("accepts a complete production-compatible manifest without importing it", () => {
    const result = validateSabCrmManifest(JSON.stringify(validManifest()));

    expect(result).toEqual({
      valid: true,
      contract: "viva_local_falcon_crm_batch_json",
      batch_id: "charlotte-hvac-sab-2026-08",
      prospect_count: 1,
      unique_place_id_count: 1,
      unique_report_key_count: 1,
      errors: [],
      writes_performed: false,
    });
  });

  it("returns compact parser errors for invalid or inferred shapes", () => {
    const result = validateSabCrmManifest(JSON.stringify({
      run: { city: "Charlotte" },
      prospects: [{
        company: "Wrong field name",
      }],
    }));

    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("Expected invalid manifest");
    expect(result.writes_performed).toBe(false);
    expect(result.error_count).toBeGreaterThan(0);
    expect(result.errors.join(" ")).toContain("batch: Required");
    expect(result.errors.join(" ")).toContain("company_name");
  });

  it("rejects a hidden operating address in an SAB manifest", () => {
    const manifest = validManifest();
    manifest.prospects[0].address = "6226 Wild Meadow Trl";

    const result = validateSabCrmManifest(JSON.stringify(manifest));

    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("Expected invalid manifest");
    expect(result.errors.join(" ")).toContain("Service Area Business");
    expect(result.writes_performed).toBe(false);
  });

  it("enforces the connector input size without accepting blank manifests", () => {
    expect(
      validateSabCrmManifestInputSchema.manifest_json.parse("{}"),
    ).toBe("{}");
    expect(() =>
      validateSabCrmManifestInputSchema.manifest_json.parse(" "),
    ).toThrow();
  });
});

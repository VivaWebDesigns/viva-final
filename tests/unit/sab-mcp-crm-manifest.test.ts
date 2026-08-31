import { describe, expect, it } from "vitest";
import {
  SAB_CRM_IMPORT_CONTRACT,
  SCALE_FIRST_SAB_CRM_IMPORT_CONTRACT,
  getSabCrmImportContract,
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

function validScaleFirstManifest(contactTag: "Email Ready" | "Needs Email" = "Email Ready") {
  const legacy = validManifest();
  const prospect = legacy.prospects[0];
  return {
    workflow: "scale_first_v2",
    batch: legacy.batch,
    prospects: [{
      place_id: prospect.place_id,
      company_name: prospect.company_name,
      address: prospect.address,
      city: prospect.city,
      state: prospect.state,
      zip: prospect.zip,
      phone: contactTag === "Needs Email" ? "7045550111" : prospect.phone,
      owner_name: prospect.owner_name,
      email: contactTag === "Email Ready" ? "owner@example.com" : null,
      contact_tag: contactTag,
      has_website: prospect.has_website,
      website_url: prospect.website_url,
      website_platform: prospect.website_platform,
      report_key: prospect.report_key,
      report_url: prospect.report_url,
      scan_date: prospect.scan_date,
      scan_keyword: prospect.scan_keyword,
      arp: prospect.arp,
      solv: prospect.solv,
      rating: prospect.rating,
      review_count: prospect.review_count,
      scan_center: prospect.scan_center,
      qualification_status: prospect.qualification_status,
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

  it("preserves the unchanged Audit-First v1.1 parser and default contract", () => {
    expect(getSabCrmImportContract("audit_first_v1_1")).toBe(SAB_CRM_IMPORT_CONTRACT);
    expect(validateSabCrmManifest(JSON.stringify(validManifest())).valid).toBe(true);

    const missingAuditField = validManifest();
    delete (missingAuditField.prospects[0] as Partial<typeof missingAuditField.prospects[0]>).service_page_count;
    const result = validateSabCrmManifest(JSON.stringify(missingAuditField));
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("Expected invalid Audit-First manifest");
    expect(result.errors.join(" ")).toContain("service_page_count");
  });

  it("returns the explicitly requested Scale-First v2 contract", () => {
    expect(getSabCrmImportContract("scale_first_v2")).toBe(SCALE_FIRST_SAB_CRM_IMPORT_CONTRACT);
    expect(SCALE_FIRST_SAB_CRM_IMPORT_CONTRACT).toMatchObject({
      contract_version: "2.3",
      workflow: "scale_first_v2",
      strict: true,
      writes_data: false,
      top_level: { allowed_keys: ["workflow", "batch", "prospects"] },
    });
  });

  it.each(["Email Ready", "Needs Email"] as const)(
    "accepts a valid Scale-First %s prospect without audit fields or writes",
    (contactTag) => {
      const result = validateSabCrmManifest(JSON.stringify(validScaleFirstManifest(contactTag)));
      expect(result).toMatchObject({
        valid: true,
        contract_version: "2.3",
        workflow: "scale_first_v2",
        prospect_count: 1,
        writes_performed: false,
      });
    },
  );

  it("accepts a per-prospect 7x7/5-mile canonical scan override", () => {
    const manifest = validScaleFirstManifest() as ReturnType<typeof validScaleFirstManifest> & {
      prospects: Array<ReturnType<typeof validScaleFirstManifest>["prospects"][number] & {
        scan_spec?: { grid_size: string; radius_miles: number };
      }>;
    };
    manifest.prospects[0].scan_spec = { grid_size: "7x7", radius_miles: 5 };

    expect(validateSabCrmManifest(JSON.stringify(manifest))).toMatchObject({
      valid: true,
      contract_version: "2.3",
      workflow: "scale_first_v2",
      prospect_count: 1,
    });
    expect(SCALE_FIRST_SAB_CRM_IMPORT_CONTRACT.top_level.prospects.item.fields)
      .toHaveProperty("scan_spec");
  });

  it("does not infer Scale-First from missing Audit-First fields", () => {
    const manifest = validScaleFirstManifest();
    delete (manifest as Partial<typeof manifest>).workflow;

    const result = validateSabCrmManifest(JSON.stringify(manifest));
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("Expected invalid manifest");
    expect(result.errors.join(" ")).toContain("service_page_count");
    expect(result.writes_performed).toBe(false);
  });

  it("rejects invalid Scale-First contact tags", () => {
    const manifest = validScaleFirstManifest();
    manifest.prospects[0].contact_tag = "Maybe Ready" as "Email Ready";
    const result = validateSabCrmManifest(JSON.stringify(manifest));
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("Expected invalid manifest");
    expect(result.errors.join(" ")).toContain("contact_tag");
  });

  it("rejects a missing exact Place ID in Scale-First", () => {
    const manifest = validScaleFirstManifest();
    delete (manifest.prospects[0] as Partial<typeof manifest.prospects[0]>).place_id;
    const result = validateSabCrmManifest(JSON.stringify(manifest));
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("Expected invalid manifest");
    expect(result.errors.join(" ")).toContain("place_id");
  });

  it("rejects a hidden street address in Scale-First", () => {
    const manifest = validScaleFirstManifest();
    manifest.prospects[0].address = "6226 Wild Meadow Trl";
    const result = validateSabCrmManifest(JSON.stringify(manifest));
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error("Expected invalid manifest");
    expect(result.errors.join(" ")).toContain("Service Area Business");
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

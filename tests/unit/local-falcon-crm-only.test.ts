import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { crmLeads } from "../../shared/schema";
import { db } from "../../server/db";
import {
  getScaleFirstContactRouting, importLocalFalconPayload, isDeliverableProspect,
  parseLocalFalconPayload, previewLocalFalconImport,
  type LocalFalconUploadedAsset,
} from "../../server/features/crm/localFalconImport";
import { parseLocalFalconPackage } from "../../server/features/crm/localFalconPackage";
import { validateSabCrmManifest } from "../../server/features/sab-mcp/crmManifest";
import { hydrateReportAtrp } from "../../server/features/local-visibility/metrics";
import { checkCrmPlaceIds } from "../../server/features/sab-mcp/crmDedup";

vi.mock("../../server/db", () => ({ db: { select: vi.fn(), transaction: vi.fn() } }));

const marketReference = {
  kind: "market_reference_only", source: "auxiliary_scan_reverse_geocode",
  latitude: 35, longitude: -80, city: "Test Market", state: "NC", zip: "28000",
  auxiliary_report_key: "abcdef123456789", auxiliary_report_url: "https://www.localfalcon.com/reports/view/abcdef123456789",
};
const crmOnly = {
  outcome: "no_visibility_core_found", place_id: "ChIJ-no-visibility", company_name: "Test prospect",
  address: "Service Area Business", city: "Test Market", state: "NC", zip: "28000",
  phone: null, owner_name: null, email: "contact@example.com", contact_tag: "Email Ready",
  has_website: false, website_url: null, scan_keyword: "plumber", rating: 4.5, review_count: 8,
  qualification_status: "qualified", market_reference: marketReference,
};
const deliverable = {
  ...crmOnly, outcome: "deliverable", place_id: "ChIJ-deliverable", market_reference: undefined,
  report_key: "abcdef123456780", report_url: "https://www.localfalcon.com/reports/view/abcdef123456780",
  scan_date: "2026-08-31", arp: 3, atrp: 20.5, solv: 2,
  scan_center: { lat: 36, lng: -81, city: "Verified Market", state: "NC", zip: "28001" },
};
function manifest(prospects: unknown[] = [crmOnly]) {
  return { workflow: "scale_first_v2", batch: {
    batch_id: "test-batch", market: { city: "Test Market", state: "NC" }, trade: "plumbing",
    keyword: "plumber", export_date: "2026-08-31", scan_spec: { grid_size: "7x7", radius_miles: 3 },
  }, prospects };
}
const parse = (prospects?: unknown[]) => parseLocalFalconPayload(JSON.stringify(manifest(prospects)));
const asset: LocalFalconUploadedAsset = {
  key: "map", originalName: "map.png", mimeType: "image/png", sizeBytes: 100, sha256: "a".repeat(64), manifestPath: "map",
  snapshot: { key: "snapshot", originalName: "snapshot.png", mimeType: "image/png", sizeBytes: 100, sha256: "b".repeat(64) },
};

// Exercise the real import transaction with an in-memory DB boundary. Predicates
// are read from Drizzle SQL so Place-ID equality remains part of each test.
let records: Record<string, any[]>;
const dialect = new PgDialect();
const camel = (value: string) => value.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
function filtered(table: string, condition?: any) {
  const rows = records[table] ?? [];
  if (!condition) return rows;
  const { sql, params } = dialect.sqlToQuery(condition);
  const match = sql.match(/"([a-z_]+)"\."([a-z_]+)" (?:=|in) /);
  if (!match) throw new Error(`Unmodeled test query: ${sql}`);
  return rows.filter((row) => params.includes(row[camel(match[2])]));
}
function setupDb() {
  records = { crm_lead_statuses: [{ id: "status", slug: "new" }], pipeline_stages: [{ id: "stage", slug: "new-lead" }] };
  const select = vi.fn((fields?: any) => {
    let table: string; let condition: any; let count = Infinity;
    const builder: any = {
      from(value: any) { table = getTableName(value); return builder; },
      where(value: any) { condition = value; return builder; },
      innerJoin() { return builder; }, orderBy() { return builder; },
      limit(value: number) { count = value; return builder; },
      then(resolve: any, reject: any) {
        const rows = filtered(table, condition).slice(0, count).map((row) => fields
          ? Object.fromEntries(Object.entries(fields).map(([key, column]: any) => [key,
            column === crmLeads ? records.crm_leads.find((lead) => lead.id === row.leadId)
              : column.table && getTableName(column.table) === "local_falcon_import_batches" && table !== "local_falcon_import_batches"
                ? records.local_falcon_import_batches.find((batch) => batch.id === row.batchRecordId)?.[camel(column.name)]
                : row[camel(column.name)],
          ])) : row);
        return Promise.resolve(rows).then(resolve, reject);
      },
    }; return builder;
  });
  const tx: any = {
    select, execute: vi.fn(async () => []),
    insert(table: any) {
      let values: any;
      const name = getTableName(table);
      const builder: any = {
        values(value: any) { values = value; return builder; },
        onConflictDoUpdate() { return builder; },
        returning: async () => {
          const row = { id: `${name}-${(records[name] ?? []).length + 1}`, ...values };
          (records[name] ??= []).push(row); return [row];
        },
        then(resolve: any, reject: any) { return builder.returning().then(resolve, reject); },
      }; return builder;
    },
    update(table: any) {
      let patch: any; let condition: any; const name = getTableName(table);
      const builder: any = { set(value: any) { patch = value; return builder; },
        where(value: any) { condition = value; return builder; },
        returning: async () => filtered(name, condition).map((row) => Object.assign(row, patch)),
      }; return builder;
    },
    delete: () => ({ where: async () => undefined }),
  };
  vi.mocked(db.select).mockImplementation(select);
  vi.mocked(db.transaction).mockImplementation(async (operation: any) => operation(tx));
  return tx;
}

beforeEach(() => { vi.clearAllMocks(); setupDb(); });

describe("CRM-only no-visibility contract and package", () => {
  it("accepts a mixed manifest, counts only real reports, and preserves ATRP separately from raw ARP", async () => {
    const payload = parse([crmOnly, deliverable]);
    expect(validateSabCrmManifest(JSON.stringify(manifest([crmOnly, deliverable])))).toMatchObject({
      valid: true, prospect_count: 2, unique_report_key_count: 1,
    });
    const retrieve = vi.fn(async () => 20.75);
    await hydrateReportAtrp(payload.prospects.filter(isDeliverableProspect), retrieve);
    expect(retrieve).toHaveBeenCalledExactlyOnceWith(deliverable.report_key, deliverable.place_id);
    expect(payload.prospects[0]).not.toHaveProperty("report_key");
    expect(payload.prospects[1]).toMatchObject({ arp: 3, atrp: 20.75 });
    expect(getScaleFirstContactRouting(payload.prospects[0])).toEqual({ contactTag: "Email Ready", automatedEmailEligible: false });
  });

  it("does not retrieve or fabricate any report image for a CRM-only package", async () => {
    const fetchMap = vi.fn();
    const result = await parseLocalFalconPackage({ originalName: "batch.json", mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(manifest())),
    }, [], fetchMap);
    expect(fetchMap).not.toHaveBeenCalled();
    expect(result.heatmapsByPlaceId.size).toBe(0);
    expect(result.heatmapsByPath.size).toBe(0);
  });

  it.each([
    ["report_key", "abcdef123456"], ["report_url", "https://example.com"], ["scan_date", "2026-08-31"],
    ["arp", 21], ["atrp", 21], ["solv", 0], ["scan_center", deliverable.scan_center],
    ["scan_spec", { grid_size: "7x7", radius_miles: 3 }], ["heatmap_file", "heatmaps/test.png"],
  ])("rejects fabricated CRM-only %s", (key, value) => {
    expect(() => parse([{ ...crmOnly, [key]: value }])).toThrow();
  });

  it("requires labelled market provenance, SAB privacy, contact readiness, and exact Place-ID uniqueness", () => {
    expect(() => parse([{ ...crmOnly, market_reference: undefined }])).toThrow(/market_reference/);
    expect(() => parse([{ ...crmOnly, city: "Asserted location" }])).toThrow(/market_reference/);
    expect(() => parse([{ ...crmOnly, address: "123 Hidden Street" }])).toThrow(/Service Area Business/);
    expect(() => parse([{ ...crmOnly, email: null }])).toThrow(/email/);
    expect(() => parse([crmOnly, { ...deliverable, place_id: crmOnly.place_id }])).toThrow(/place_id is duplicated/);
    expect(() => parse([{ ...crmOnly, market_reference: { ...marketReference, street_address: "hidden" } }])).toThrow();
  });

  it("accepts one batch with more than 200 qualified CRM-only leads", () => {
    expect(parse(Array.from({ length: 201 }, (_, index) => ({ ...crmOnly, place_id: `ChIJ-${index}` }))).prospects).toHaveLength(201);
  });
});

describe("CRM-only persistence and exact deduplication", () => {
  it("imports a mixed batch with just one real report and no fabricated business location", async () => {
    const result = await importLocalFalconPayload(parse([crmOnly, deliverable]), "actor", "setter", "sab", new Set(), new Map([[deliverable.place_id, asset]]));
    expect(result).toMatchObject({ imported: 2, leadsCreated: 2 });
    expect(records.local_falcon_prospect_profiles).toHaveLength(1);
    expect(records.local_falcon_prospect_profiles[0]).toMatchObject({ reportKey: deliverable.report_key, arp: "3", atrp: "20.5" });
    expect(records.local_falcon_crm_only_prospects).toHaveLength(1);
    expect(records.local_falcon_crm_only_prospects[0]).toMatchObject({ placeId: crmOnly.place_id, marketReference });
    expect(records.local_falcon_crm_only_prospects[0]).not.toHaveProperty("reportKey");
    expect(records.crm_companies[0]).toMatchObject({ address: "Service Area Business", city: null, state: null, zip: null });
    expect(records.crm_leads[0]).toMatchObject({ source: "local_falcon_crm_only", city: null, state: null });
    expect(result.importedLeads[0]).toMatchObject({ contactTag: "Email Ready", automatedEmailEligible: false, prospectOutcome: "no_visibility_core_found" });
    expect(await previewLocalFalconImport(parse([crmOnly, deliverable]))).toMatchObject({ existingCount: 2, batchAlreadyImported: true });
    expect(await checkCrmPlaceIds([crmOnly.place_id, "ChIJ-no-visibility-extra"])).toMatchObject({
      matched_place_ids: [crmOnly.place_id], unmatched_place_ids: ["ChIJ-no-visibility-extra"],
      matches: [expect.objectContaining({ report_key: null, report_url: null, scan_date: null })],
    });
  });

  it("later authorized deliverables reuse a CRM-only lead and cannot duplicate its exact Place ID", async () => {
    await importLocalFalconPayload(parse(), "actor", "setter", "sab", new Set(), new Map());
    const firstLead = records.crm_leads[0].id;
    const laterPayload = parse([{ ...deliverable, place_id: crmOnly.place_id }]);
    expect(await previewLocalFalconImport(laterPayload)).toMatchObject({ variationCount: 1, newCount: 0 });
    const result = await importLocalFalconPayload(laterPayload, "actor", "setter", "sab", new Set(), new Map([[crmOnly.place_id, asset]]));
    expect(result).toMatchObject({ imported: 1, leadsCreated: 0 });
    expect(result.importedLeads[0].leadId).toBe(firstLead);
    expect(records.crm_leads).toHaveLength(1);
    expect(records.crm_leads[0]).toMatchObject({ source: "local_falcon", city: "Verified Market" });
    expect(records.local_falcon_prospect_profiles).toHaveLength(1);
    expect(await previewLocalFalconImport(parse())).toMatchObject({ existingCount: 1, newCount: 0 });
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  createSabWorkflowInputSchema,
  getSabBatchInputSchema,
  SAB_HEADERS,
  sabScanResultSchema,
} from "../../server/features/sab-mcp/schema";
import {
  GoogleSheetsValuesClient,
  SabSheetsRepository,
  spreadsheetIdFromReference,
  type SheetsValuesClient,
} from "../../server/features/sab-mcp/sheets";
import { z } from "zod";

function columnIndex(name: string) {
  return [...name].reduce((value, character) => value * 26 + character.charCodeAt(0) - 64, 0) - 1;
}

class FakeSheetsClient implements SheetsValuesClient {
  updates: Array<{ range: string; value: string | number | boolean }> = [];

  constructor(public values: string[][]) {}

  async getValues() {
    return this.values.map((row) => [...row]);
  }

  async updateValues(
    _spreadsheetId: string,
    updates: Array<{ range: string; value: string | number | boolean }>,
  ) {
    this.updates.push(...updates);
    for (const update of updates) {
      const match = update.range.match(/!([A-Z]+)(\d+)$/);
      if (!match) throw new Error(`Unexpected range ${update.range}`);
      const column = columnIndex(match[1]);
      const row = Number(match[2]) - 1;
      this.values[row] ??= [];
      this.values[row][column] = String(update.value);
    }
  }
}

function row(overrides: Partial<Record<typeof SAB_HEADERS[number], string>> = {}) {
  const defaults: Record<typeof SAB_HEADERS[number], string> = Object.fromEntries(
    SAB_HEADERS.map((header) => [header, ""]),
  ) as Record<typeof SAB_HEADERS[number], string>;

  return SAB_HEADERS.map((header) => ({
    ...defaults,
    batch_id: "B01",
    batch_position: "1",
    status: "assigned",
    company: "Example Plumbing",
    place_id: "place-1",
    address: "Service Area Business",
    city: "Charlotte",
    state: "NC",
    zip: "28202",
    has_website: "TRUE",
    website: "https://example.com",
    service_page_count: "4",
    website_analysis: JSON.stringify(["Finding 1", "Finding 2", "Finding 3"]),
    reviews_analysis: JSON.stringify(["Trajectory", "Response behavior", "Job mix"]),
    qualification_status: "qualified",
    ...overrides,
  })[header]);
}

function buildRepository(rows: string[][]) {
  const client = new FakeSheetsClient([Array.from(SAB_HEADERS), ...rows]);
  return {
    client,
    repository: new SabSheetsRepository(client, "sheet-id", "SAB Workflow"),
  };
}

describe("SabSheetsRepository", () => {
  it("accepts workflow Sheets by URL or raw spreadsheet ID", () => {
    const spreadsheetId = "1AbCdEfGhIjKlMnOpQrStUvWxYz_1234567890";

    expect(spreadsheetIdFromReference(spreadsheetId)).toBe(spreadsheetId);
    expect(spreadsheetIdFromReference(
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0`,
    )).toBe(spreadsheetId);
    expect(() => spreadsheetIdFromReference(
      `https://docs.google.com/document/d/${spreadsheetId}/edit`,
    )).toThrow(/Google Sheets spreadsheet ID/);
  });

  it("requires only core scan fields and rejects competitors", () => {
    const coreScan = {
      scan_role: "deliverable",
      arp: 14.2,
      solv: 31.5,
      report_key: "qualified-report",
      report_url: "https://example.com/qualified-report",
      scan_date: "2026-08-05",
      scan_keyword: "electrician near me",
    };

    expect(sabScanResultSchema.parse(coreScan)).toEqual(coreScan);
    expect(sabScanResultSchema.safeParse({
      ...coreScan,
      competitors: ["Competitor One"],
    }).success).toBe(false);
  });

  it("validates a complete native-workflow creation roster", () => {
    const parsed = z.object(createSabWorkflowInputSchema).parse({
      title: "Charlotte Electricians SAB Workflow",
      companies: [{
        batch_id: "B01",
        batch_position: 1,
        company: "Example Electric",
        place_id: "place-1",
        arp: 12.5,
        solv: 18.2,
        found_in: 7,
      }],
    });

    expect(parsed.companies).toHaveLength(1);
    expect(parsed.companies[0].status).toBe("assigned");
  });

  it("creates and progress-validates a populated native Workflow Sheet", async () => {
    const client = new GoogleSheetsValuesClient(
      JSON.stringify({
        installed: {
          client_id: "test-client",
          client_secret: "test-secret",
        },
      }),
      "test-refresh-token",
    );
    let createdValues: Array<Array<string | number | boolean>> = [];
    const request = vi.fn(async (options: {
      url: string;
      method: string;
      data?: {
        sheets?: Array<{
          properties?: {
            title?: string;
          };
          data?: Array<{
            rowData?: Array<{
              values?: Array<{
                userEnteredValue?: Record<string, string | number | boolean>;
              }>;
            }>;
          }>;
        }>;
      };
    }) => {
      if (
        options.url === "https://sheets.googleapis.com/v4/spreadsheets"
        && options.method === "POST"
      ) {
        createdValues = options.data?.sheets?.[0]?.data?.[0]?.rowData?.map((rowData) => (
          rowData.values?.map((cell) => (
            Object.values(cell.userEnteredValue ?? {})[0] ?? ""
          )) ?? []
        )) ?? [];
        return {
          data: {
            spreadsheetId: "created-sheet-id",
            spreadsheetUrl: "https://docs.google.com/spreadsheets/d/created-sheet-id/edit",
          },
        };
      }
      if (options.url.includes("/values/") && options.method === "GET") {
        return { data: { values: createdValues } };
      }
      throw new Error(`Unexpected request: ${options.method} ${options.url}`);
    });
    (client as unknown as { auth: { request: typeof request } }).auth = { request };

    const result = await client.createWorkflow(
      "Charlotte Electricians SAB Workflow",
      [{
        batch_id: "B01",
        batch_position: 1,
        status: "assigned",
        company: "Example Electric",
        place_id: "place-1",
        arp: 12.5,
        solv: 18.2,
        found_in: 7,
      }],
      "matt@vivawebdesigns.com",
    );

    expect(result).toEqual({
      workflow_sheet: "https://docs.google.com/spreadsheets/d/created-sheet-id/edit",
      spreadsheet_id: "created-sheet-id",
      sheet_name: "SAB Workflow",
      row_count: 1,
      progress: {
        B01: { total: 1, assigned: 1 },
      },
    });
    const createCall = request.mock.calls.find(([options]) => (
      options.url === "https://sheets.googleapis.com/v4/spreadsheets"
    ))?.[0];
    expect(createCall?.data?.sheets?.[0]).toMatchObject({
      properties: { title: "SAB Workflow" },
    });
    expect(createdValues[0]).toEqual(Array.from(SAB_HEADERS));
    expect(createdValues[1][SAB_HEADERS.indexOf("company")]).toBe("Example Electric");
  });

  it("allows run-specific batch IDs instead of limiting the connector to B01-B04", () => {
    expect(getSabBatchInputSchema.batch_id.parse("Raleigh-Plumbing-B07")).toBe(
      "Raleigh-Plumbing-B07",
    );
  });

  it("returns only unfinished companies for an assigned batch by default", async () => {
    const { repository } = buildRepository([
      row(),
      row({
        place_id: "place-2",
        company: "Finished Plumbing",
        batch_position: "2",
        status: "complete",
      }),
      row({
        place_id: "place-3",
        company: "Other Batch",
        batch_id: "B02",
      }),
    ]);

    const pending = await repository.getBatch("B01");
    expect(pending.map((company) => company.place_id)).toEqual(["place-1"]);

    const all = await repository.getBatch("B01", true);
    expect(all.map((company) => company.place_id)).toEqual(["place-1", "place-2"]);
  });

  it("updates only approved company cells and records the actor", async () => {
    const { client, repository } = buildRepository([row()]);

    const result = await repository.saveCompany(
      "place-1",
      {
        owner_name: "Pat Owner",
        email: "pat@example.com",
        reviews_analysis: ["Reviews are accelerating", "Owner responds consistently", "Residential work dominates"],
      },
      "matt@vivawebdesigns.com",
    );

    expect(result.updated_fields).toEqual(["owner_name", "email", "reviews_analysis"]);
    expect(client.updates).toHaveLength(5);
    expect((await repository.getCompany("place-1")).owner_name).toBe("Pat Owner");
    expect((await repository.getCompany("place-1")).updated_by).toBe("matt@vivawebdesigns.com");
  });

  it("adds scan history to legacy Sheets and updates current deliverable fields", async () => {
    const legacyHeaders = SAB_HEADERS.filter((header) => header !== "scan_history");
    const legacyRow = row({
      arp: "22.4",
      solv: "8.7",
      found_in: "6",
      center_type: "weighted_cell_centroid",
      scan_center: "35.1000,-80.9000",
      report_key: "master-report",
      report_url: "https://example.com/master-report",
      scan_date: "2026-08-01",
      scan_keyword: "electrician near me",
    });
    const legacyValues = legacyHeaders.map((header) => (
      legacyRow[SAB_HEADERS.indexOf(header)]
    ));
    const client = new FakeSheetsClient([Array.from(legacyHeaders), legacyValues]);
    const repository = new SabSheetsRepository(client, "sheet-id", "SAB Workflow");

    const result = await repository.saveScanResult(
      "place-1",
      {
        scan_role: "deliverable",
        arp: 14.2,
        solv: 31.5,
        report_key: "qualified-report",
        report_url: "https://example.com/qualified-report",
        scan_date: "2026-08-05",
        scan_keyword: "electrician near me",
        notes: "Centered on a corroborated company address.",
      },
      "matt@vivawebdesigns.com",
    );

    expect(result).toMatchObject({
      current_scan_updated: true,
      scan_history_count: 2,
    });
    const company = await repository.getCompany("place-1");
    expect(company.report_key).toBe("qualified-report");
    expect(company.arp).toBe("14.2");
    expect(company.found_in).toBe("6");
    expect(company.scan_center).toBe("35.1000,-80.9000");
    expect(company.center_type).toBe("weighted_cell_centroid");
    expect(company.scan_history).toEqual([
      expect.objectContaining({
        scan_type: "master",
        report_key: "master-report",
      }),
      expect.objectContaining({
        report_key: "qualified-report",
      }),
    ]);
    expect(company.scan_history).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ competitors: expect.anything() }),
    ]));
  });

  it("retains auxiliary scans without replacing the current deliverable", async () => {
    const { repository } = buildRepository([
      row({
        report_key: "current-deliverable",
        report_url: "https://example.com/current-deliverable",
      }),
    ]);

    const result = await repository.saveScanResult(
      "place-1",
      {
        scan_role: "auxiliary",
        scan_type: "scout",
        arp: 30,
        solv: 10,
        found_in: 4,
        scan_center: "35.3000,-80.7000",
        report_key: "scout-report",
        report_url: "https://example.com/scout-report",
        center_type: "weighted_cell_centroid",
        scan_date: "2026-08-05",
        scan_keyword: "electrician near me",
      },
      "matt@vivawebdesigns.com",
    );

    expect(result.current_scan_updated).toBe(false);
    const company = await repository.getCompany("place-1");
    expect(company.report_key).toBe("current-deliverable");
    expect(company.scan_history).toEqual([
      expect.objectContaining({
        scan_type: "master",
        report_key: "current-deliverable",
      }),
      expect.objectContaining({
        scan_type: "scout",
        report_key: "scout-report",
      }),
    ]);
  });

  it("allows administrative location filler when marking a company complete", async () => {
    const { repository } = buildRepository([
      row({
        address: "",
        zip: "",
      }),
    ]);

    await expect(repository.saveCompany(
      "place-1",
      {
        address: "Service Area Business",
        zip: "28202",
        status: "complete",
      },
      "matt@vivawebdesigns.com",
    )).resolves.toMatchObject({ status: "complete" });
  });

  it("rejects complete status when required audits are missing", async () => {
    const { repository } = buildRepository([
      row({
        reviews_analysis: "",
      }),
    ]);

    await expect(repository.saveCompany(
      "place-1",
      { status: "complete" },
      "matt@vivawebdesigns.com",
    )).rejects.toThrow(/reviews_analysis/);
  });

  it("rejects complete status until a final qualification disposition is set", async () => {
    const { repository } = buildRepository([
      row({
        qualification_status: "",
      }),
    ]);

    await expect(repository.saveCompany(
      "place-1",
      { status: "complete" },
      "matt@vivawebdesigns.com",
    )).rejects.toThrow(/qualification_status/);
  });

  it("allows a fully audited disqualified company to close without CRM location filler", async () => {
    const { repository } = buildRepository([
      row({
        address: "",
        city: "",
        state: "",
        zip: "",
        qualification_status: "disqualified",
        research_notes: "Review activity is outside the allowed recency window.",
      }),
    ]);

    await expect(repository.saveCompany(
      "place-1",
      { status: "complete" },
      "matt@vivawebdesigns.com",
    )).resolves.toMatchObject({ status: "complete" });
  });

  it("allows a reasoned manual disqualification to close without unfinished audits", async () => {
    const { repository } = buildRepository([
      row({
        has_website: "",
        website: "",
        service_page_count: "",
        website_analysis: "",
        reviews_analysis: "",
        qualification_status: "disqualified",
        research_notes: "Matt manually disqualified the company because its primary category does not match the run trade.",
      }),
    ]);

    await expect(repository.saveCompany(
      "place-1",
      { status: "complete" },
      "matt@vivawebdesigns.com",
    )).resolves.toMatchObject({ status: "complete" });
  });

  it("requires a reason before a manual disqualification can skip unfinished audits", async () => {
    const { repository } = buildRepository([
      row({
        website_analysis: "",
        reviews_analysis: "",
        qualification_status: "disqualified",
        research_notes: "",
      }),
    ]);

    await expect(repository.saveCompany(
      "place-1",
      { status: "complete" },
      "matt@vivawebdesigns.com",
    )).rejects.toThrow(/qualification reason/);
  });

  it("requires a reason when a company is disqualified or deferred", async () => {
    const { repository } = buildRepository([
      row({
        qualification_status: "deferred",
        research_notes: "",
      }),
    ]);

    await expect(repository.saveCompany(
      "place-1",
      { status: "complete" },
      "matt@vivawebdesigns.com",
    )).rejects.toThrow(/qualification reason/);
  });

  it("reports progress by batch and status", async () => {
    const { repository } = buildRepository([
      row(),
      row({ place_id: "place-2", batch_position: "2", status: "complete" }),
      row({ place_id: "place-3", batch_id: "B02", status: "blocked" }),
    ]);

    await expect(repository.getProgress()).resolves.toEqual({
      B01: { total: 2, assigned: 1, complete: 1 },
      B02: { total: 1, blocked: 1 },
    });
  });
});

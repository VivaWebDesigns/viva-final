import { describe, expect, it, vi } from "vitest";
import {
  createSabWorkflowInputSchema,
  getSabBatchInputSchema,
  SAB_HEADERS,
  SAB_SCALE_FIRST_UPGRADEABLE_HEADERS,
  sabCompanyUpdatesSchema,
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
  return (
    [...name].reduce(
      (value, character) => value * 26 + character.charCodeAt(0) - 64,
      0,
    ) - 1
  );
}

class FakeSheetsClient implements SheetsValuesClient {
  updates: Array<{ range: string; value: string | number | boolean }> = [];
  columnAppends: Array<{ sheetId: number; columnCount: number }> = [];
  readonly tabs = new Map([
    ["SAB Workflow", { sheetId: 101, columnCount: 0 }],
    ["Other Tab", { sheetId: 202, columnCount: 17 }],
  ]);

  constructor(
    public values: string[][],
    columnCapacity?: number,
  ) {
    this.tabs.get("SAB Workflow")!.columnCount =
      columnCapacity ??
      values.reduce((maximum, row) => Math.max(maximum, row.length), 0);
  }

  async getValues() {
    return this.values.map((row) => [...row]);
  }

  async getSheetGridProperties(_spreadsheetId: string, sheetName: string) {
    const tab = this.tabs.get(sheetName);
    if (!tab) throw new Error(`Unknown fake tab ${sheetName}`);
    return { ...tab };
  }

  async appendColumns(
    _spreadsheetId: string,
    sheetId: number,
    columnCount: number,
  ) {
    if (columnCount <= 0) return;
    const tab = [...this.tabs.values()].find(
      (candidate) => candidate.sheetId === sheetId,
    );
    if (!tab) throw new Error(`Unknown fake sheetId ${sheetId}`);
    this.columnAppends.push({ sheetId, columnCount });
    tab.columnCount += columnCount;
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
      const selectedTab = this.tabs.get("SAB Workflow")!;
      if (column >= selectedTab.columnCount) {
        throw new Error(
          `Range (${update.range}) exceeds grid limits. Max columns: ${selectedTab.columnCount}`,
        );
      }
      this.values[row] ??= [];
      this.values[row][column] = String(update.value);
    }
  }
}

function row(
  overrides: Partial<Record<(typeof SAB_HEADERS)[number], string>> = {},
) {
  const defaults: Record<(typeof SAB_HEADERS)[number], string> =
    Object.fromEntries(SAB_HEADERS.map((header) => [header, ""])) as Record<
      (typeof SAB_HEADERS)[number],
      string
    >;

  return SAB_HEADERS.map(
    (header) =>
      ({
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
        website_analysis: JSON.stringify([
          "Finding 1",
          "Finding 2",
          "Finding 3",
        ]),
        reviews_analysis: JSON.stringify([
          "Trajectory",
          "Response behavior",
          "Job mix",
        ]),
        qualification_status: "qualified",
        ...overrides,
      })[header],
  );
}

function buildRepository(rows: string[][]) {
  const client = new FakeSheetsClient([Array.from(SAB_HEADERS), ...rows]);
  return {
    client,
    repository: new SabSheetsRepository(client, "sheet-id", "SAB Workflow"),
  };
}

function valuesForHeaders(headers: readonly string[], rows: string[][]) {
  return [
    Array.from(headers),
    ...rows.map((sourceRow) =>
      headers.map(
        (header) =>
          sourceRow[
            SAB_HEADERS.indexOf(header as (typeof SAB_HEADERS)[number])
          ] ?? "",
      ),
    ),
  ];
}

describe("SabSheetsRepository", () => {
  it("accepts an explicit null qualification status for clearing a premature disposition", () => {
    expect(
      sabCompanyUpdatesSchema.parse({ qualification_status: null }),
    ).toEqual({
      qualification_status: null,
    });
  });

  it("accepts workflow Sheets by URL or raw spreadsheet ID", () => {
    const spreadsheetId = "1AbCdEfGhIjKlMnOpQrStUvWxYz_1234567890";

    expect(spreadsheetIdFromReference(spreadsheetId)).toBe(spreadsheetId);
    expect(
      spreadsheetIdFromReference(
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0`,
      ),
    ).toBe(spreadsheetId);
    expect(() =>
      spreadsheetIdFromReference(
        `https://docs.google.com/document/d/${spreadsheetId}/edit`,
      ),
    ).toThrow(/Google Sheets spreadsheet ID/);
  });

  it("reads exact tab grid properties and appends columns through authenticated Sheets API calls", async () => {
    const client = new GoogleSheetsValuesClient(
      JSON.stringify({
        installed: {
          client_id: "test-client",
          client_secret: "test-secret",
        },
      }),
      "test-refresh-token",
    );
    const request = vi.fn(
      async (options: {
        url: string;
        method: string;
        params?: Record<string, unknown>;
        data?: Record<string, unknown>;
      }) => {
        if (options.method === "GET") {
          return {
            data: {
              sheets: [
                {
                  properties: {
                    sheetId: 202,
                    title: "Other Tab",
                    gridProperties: { columnCount: 17 },
                  },
                },
                {
                  properties: {
                    sheetId: 101,
                    title: "SAB Workflow",
                    gridProperties: { columnCount: 39 },
                  },
                },
              ],
            },
          };
        }
        return { data: {} };
      },
    );
    (client as unknown as { auth: { request: typeof request } }).auth = {
      request,
    };

    await expect(
      client.getSheetGridProperties("sheet-id", "SAB Workflow"),
    ).resolves.toEqual({
      sheetId: 101,
      columnCount: 39,
    });
    await client.appendColumns("sheet-id", 101, 2);

    expect(request).toHaveBeenNthCalledWith(1, {
      url: "https://sheets.googleapis.com/v4/spreadsheets/sheet-id",
      method: "GET",
      params: {
        includeGridData: false,
        fields: "sheets.properties(sheetId,title,gridProperties)",
      },
    });
    expect(request).toHaveBeenNthCalledWith(2, {
      url: "https://sheets.googleapis.com/v4/spreadsheets/sheet-id:batchUpdate",
      method: "POST",
      data: {
        requests: [
          {
            appendDimension: {
              sheetId: 101,
              dimension: "COLUMNS",
              length: 2,
            },
          },
        ],
      },
    });
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
    expect(
      sabScanResultSchema.safeParse({
        ...coreScan,
        competitors: ["Competitor One"],
      }).success,
    ).toBe(false);
  });

  it("validates a complete native-workflow creation roster", () => {
    const parsed = z.object(createSabWorkflowInputSchema).parse({
      title: "Charlotte Electricians SAB Workflow",
      companies: [
        {
          batch_id: "B01",
          batch_position: 1,
          company: "Example Electric",
          place_id: "place-1",
          arp: 12.5,
          solv: 18.2,
          found_in: 7,
        },
      ],
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
    const request = vi.fn(
      async (options: {
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
          options.url === "https://sheets.googleapis.com/v4/spreadsheets" &&
          options.method === "POST"
        ) {
          createdValues =
            options.data?.sheets?.[0]?.data?.[0]?.rowData?.map(
              (rowData) =>
                rowData.values?.map(
                  (cell) => Object.values(cell.userEnteredValue ?? {})[0] ?? "",
                ) ?? [],
            ) ?? [];
          return {
            data: {
              spreadsheetId: "created-sheet-id",
              spreadsheetUrl:
                "https://docs.google.com/spreadsheets/d/created-sheet-id/edit",
            },
          };
        }
        if (options.url.includes("/values/") && options.method === "GET") {
          return { data: { values: createdValues } };
        }
        throw new Error(`Unexpected request: ${options.method} ${options.url}`);
      },
    );
    (client as unknown as { auth: { request: typeof request } }).auth = {
      request,
    };

    const result = await client.createWorkflow(
      "Charlotte Electricians SAB Workflow",
      [
        {
          batch_id: "B01",
          batch_position: 1,
          status: "assigned",
          company: "Example Electric",
          place_id: "place-1",
          arp: 12.5,
          solv: 18.2,
          found_in: 7,
        },
      ],
      "matt@vivawebdesigns.com",
    );

    expect(result).toEqual({
      workflow_sheet:
        "https://docs.google.com/spreadsheets/d/created-sheet-id/edit",
      spreadsheet_id: "created-sheet-id",
      sheet_name: "SAB Workflow",
      row_count: 1,
      progress: {
        B01: { total: 1, assigned: 1 },
      },
    });
    const createCall = request.mock.calls.find(
      ([options]) =>
        options.url === "https://sheets.googleapis.com/v4/spreadsheets",
    )?.[0];
    expect(createCall?.data?.sheets?.[0]).toMatchObject({
      properties: { title: "SAB Workflow" },
    });
    expect(createdValues[0]).toEqual(Array.from(SAB_HEADERS));
    expect(createdValues[1][SAB_HEADERS.indexOf("company")]).toBe(
      "Example Electric",
    );
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
    expect(all.map((company) => company.place_id)).toEqual([
      "place-1",
      "place-2",
    ]);
  });

  it("updates only approved company cells and records the actor", async () => {
    const { client, repository } = buildRepository([row()]);

    const result = await repository.saveCompany(
      "place-1",
      {
        owner_name: "Pat Owner",
        email: "pat@example.com",
        reviews_analysis: [
          "Reviews are accelerating",
          "Owner responds consistently",
          "Residential work dominates",
        ],
      },
      "matt@vivawebdesigns.com",
    );

    expect(result.updated_fields).toEqual([
      "owner_name",
      "email",
      "reviews_analysis",
    ]);
    expect(client.updates).toHaveLength(5);
    expect((await repository.getCompany("place-1")).owner_name).toBe(
      "Pat Owner",
    );
    expect((await repository.getCompany("place-1")).updated_by).toBe(
      "matt@vivawebdesigns.com",
    );
  });

  it("expands a 39-column legacy Sheet to 41 and adds both headers without changing rows or Place IDs", async () => {
    const legacyHeaders = SAB_HEADERS.filter(
      (header) =>
        !SAB_SCALE_FIRST_UPGRADEABLE_HEADERS.includes(
          header as (typeof SAB_SCALE_FIRST_UPGRADEABLE_HEADERS)[number],
        ),
    );
    const client = new FakeSheetsClient(
      valuesForHeaders(legacyHeaders, [
        row({ research_notes: '=CONCAT("kept", " formula")' }),
        row({
          place_id: "place-2",
          company: "Second Plumbing",
          batch_position: "2",
        }),
      ]),
    );
    const originalRows = client.values
      .slice(1)
      .map((sourceRow) => [...sourceRow]);
    const repository = new SabSheetsRepository(
      client,
      "sheet-id",
      "SAB Workflow",
    );

    const result = await repository.upgradeWorkflowSchema();

    expect(result).toMatchObject({
      added_headers: ["workflow", "contact_tag"],
      already_present_headers: [],
      changed: true,
      before_row_count: 2,
      after_row_count: 2,
      before_place_id_count: 2,
      after_place_id_count: 2,
      before_column_capacity: 39,
      after_column_capacity: 41,
      columns_added: 2,
      final_header_positions: {
        workflow: { column_number: legacyHeaders.length + 1 },
        contact_tag: { column_number: legacyHeaders.length + 2 },
      },
    });
    expect(result.before_place_id_checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(result.after_place_id_checksum).toBe(
      result.before_place_id_checksum,
    );
    expect(client.columnAppends).toEqual([{ sheetId: 101, columnCount: 2 }]);
    expect(client.updates.map(({ value }) => value)).toEqual([
      "workflow",
      "contact_tag",
    ]);
    expect(client.values.slice(1)).toEqual(originalRows);
  });

  it("expands only as needed and adds the missing header to a partially upgraded Sheet", async () => {
    const partialHeaders = SAB_HEADERS.filter(
      (header) => header !== "contact_tag",
    );
    const client = new FakeSheetsClient(
      valuesForHeaders(partialHeaders, [row()]),
    );
    const repository = new SabSheetsRepository(
      client,
      "sheet-id",
      "SAB Workflow",
    );

    await expect(repository.upgradeWorkflowSchema()).resolves.toMatchObject({
      added_headers: ["contact_tag"],
      already_present_headers: ["workflow"],
      changed: true,
      before_column_capacity: 40,
      after_column_capacity: 41,
      columns_added: 1,
    });
    expect(client.columnAppends).toEqual([{ sheetId: 101, columnCount: 1 }]);
    expect(client.updates.map(({ value }) => value)).toEqual(["contact_tag"]);
  });

  it("uses spare blank columns without resizing", async () => {
    const legacyHeaders = SAB_HEADERS.filter(
      (header) => header !== "workflow" && header !== "contact_tag",
    );
    const client = new FakeSheetsClient(
      valuesForHeaders(legacyHeaders, [row()]),
      50,
    );
    const repository = new SabSheetsRepository(
      client,
      "sheet-id",
      "SAB Workflow",
    );

    await expect(repository.upgradeWorkflowSchema()).resolves.toMatchObject({
      added_headers: ["workflow", "contact_tag"],
      changed: true,
      before_column_capacity: 50,
      after_column_capacity: 50,
      columns_added: 0,
    });
    expect(client.columnAppends).toEqual([]);
    expect(client.updates.map(({ value }) => value)).toEqual([
      "workflow",
      "contact_tag",
    ]);
  });

  it("returns a verified no-op for a current Sheet", async () => {
    const client = new FakeSheetsClient([Array.from(SAB_HEADERS), row()]);
    const repository = new SabSheetsRepository(
      client,
      "sheet-id",
      "SAB Workflow",
    );

    await expect(repository.upgradeWorkflowSchema()).resolves.toMatchObject({
      added_headers: [],
      already_present_headers: ["workflow", "contact_tag"],
      changed: false,
      before_row_count: 1,
      after_row_count: 1,
      before_place_id_count: 1,
      after_place_id_count: 1,
      before_column_capacity: 41,
      after_column_capacity: 41,
      columns_added: 0,
    });
    expect(client.columnAppends).toEqual([]);
    expect(client.updates).toEqual([]);
  });

  it("is safe and idempotent when retrying after capacity was already expanded", async () => {
    const legacyHeaders = SAB_HEADERS.filter(
      (header) => header !== "workflow" && header !== "contact_tag",
    );
    const client = new FakeSheetsClient(
      valuesForHeaders(legacyHeaders, [row()]),
      41,
    );
    const repository = new SabSheetsRepository(
      client,
      "sheet-id",
      "SAB Workflow",
    );

    await expect(repository.upgradeWorkflowSchema()).resolves.toMatchObject({
      changed: true,
      before_column_capacity: 41,
      after_column_capacity: 41,
      columns_added: 0,
    });
    const updatesAfterFirstRun = [...client.updates];
    await expect(repository.upgradeWorkflowSchema()).resolves.toMatchObject({
      added_headers: [],
      already_present_headers: ["workflow", "contact_tag"],
      changed: false,
    });
    expect(client.columnAppends).toEqual([]);
    expect(client.updates).toEqual(updatesAfterFirstRun);
  });

  it("rejects duplicate, ambiguous, or missing base headers before resizing or writing", async () => {
    const duplicateClient = new FakeSheetsClient([
      [...SAB_HEADERS, "workflow"],
      row(),
    ]);
    const duplicateRepository = new SabSheetsRepository(
      duplicateClient,
      "sheet-id",
      "SAB Workflow",
    );
    await expect(duplicateRepository.upgradeWorkflowSchema()).rejects.toThrow(
      /duplicate headers.*workflow/i,
    );
    expect(duplicateClient.columnAppends).toEqual([]);
    expect(duplicateClient.updates).toEqual([]);

    const ambiguousHeaders = SAB_HEADERS.map((header) =>
      header === "workflow" ? " Workflow " : header,
    );
    const ambiguousClient = new FakeSheetsClient(
      valuesForHeaders(ambiguousHeaders, [row()]),
    );
    const ambiguousRepository = new SabSheetsRepository(
      ambiguousClient,
      "sheet-id",
      "SAB Workflow",
    );
    await expect(ambiguousRepository.upgradeWorkflowSchema()).rejects.toThrow(
      /ambiguous canonical headers/i,
    );
    expect(ambiguousClient.columnAppends).toEqual([]);
    expect(ambiguousClient.updates).toEqual([]);

    const missingBaseHeaders = SAB_HEADERS.filter(
      (header) =>
        header !== "company" &&
        header !== "workflow" &&
        header !== "contact_tag",
    );
    const missingBaseClient = new FakeSheetsClient(
      valuesForHeaders(missingBaseHeaders, [row()]),
    );
    const missingBaseRepository = new SabSheetsRepository(
      missingBaseClient,
      "sheet-id",
      "SAB Workflow",
    );
    await expect(missingBaseRepository.upgradeWorkflowSchema()).rejects.toThrow(
      /legacy\/base required headers.*company/i,
    );
    expect(missingBaseClient.columnAppends).toEqual([]);
    expect(missingBaseClient.updates).toEqual([]);
  });

  it("expands only the selected tab", async () => {
    const legacyHeaders = SAB_HEADERS.filter(
      (header) => header !== "workflow" && header !== "contact_tag",
    );
    const client = new FakeSheetsClient(
      valuesForHeaders(legacyHeaders, [row()]),
    );
    const otherTabBefore = { ...client.tabs.get("Other Tab")! };
    const repository = new SabSheetsRepository(
      client,
      "sheet-id",
      "SAB Workflow",
    );

    await repository.upgradeWorkflowSchema();

    expect(client.columnAppends).toEqual([{ sheetId: 101, columnCount: 2 }]);
    expect(client.tabs.get("SAB Workflow")?.columnCount).toBe(41);
    expect(client.tabs.get("Other Tab")).toEqual(otherTabBefore);
  });

  it("rejects a missing writable header with upgrade instructions and no malformed range", async () => {
    const legacyHeaders = SAB_HEADERS.filter((header) => header !== "workflow");
    const client = new FakeSheetsClient(
      valuesForHeaders(legacyHeaders, [row()]),
    );
    const repository = new SabSheetsRepository(
      client,
      "sheet-id",
      "SAB Workflow",
    );

    await expect(
      repository.saveCompany(
        "place-1",
        { workflow: "scale_first_v2" },
        "matt@vivawebdesigns.com",
      ),
    ).rejects.toThrow(
      /missing writable header "workflow".*upgrade_sab_workflow_schema/i,
    );
    expect(client.updates).toEqual([]);
  });

  it("adds scan history to legacy Sheets and updates current deliverable fields", async () => {
    const legacyHeaders = SAB_HEADERS.filter(
      (header) => header !== "scan_history",
    );
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
    const legacyValues = legacyHeaders.map(
      (header) => legacyRow[SAB_HEADERS.indexOf(header)],
    );
    const client = new FakeSheetsClient(
      [Array.from(legacyHeaders), legacyValues],
      SAB_HEADERS.length,
    );
    const repository = new SabSheetsRepository(
      client,
      "sheet-id",
      "SAB Workflow",
    );

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
    expect(company.scan_history).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ competitors: expect.anything() }),
      ]),
    );
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

    await expect(
      repository.saveCompany(
        "place-1",
        {
          address: "Service Area Business",
          zip: "28202",
          status: "complete",
        },
        "matt@vivawebdesigns.com",
      ),
    ).resolves.toMatchObject({ status: "complete" });
  });

  it("rejects complete status when required audits are missing", async () => {
    const { repository } = buildRepository([
      row({
        reviews_analysis: "",
      }),
    ]);

    await expect(
      repository.saveCompany(
        "place-1",
        { status: "complete" },
        "matt@vivawebdesigns.com",
      ),
    ).rejects.toThrow(/reviews_analysis/);
  });

  it("allows Scale-First qa_ready without Audit-First audit fields", async () => {
    const { repository } = buildRepository([
      row({
        workflow: "scale_first_v2",
        contact_tag: "Email Ready",
        email: "owner@example.com",
        arp: "12.5",
        solv: "18.2",
        report_key: "abcdef123456",
        report_url: "https://localrankingtracker.com/report/public-id",
        scan_date: "2026-08-25",
        scan_keyword: "plumber near me",
        rating: "4.8",
        review_count: "42",
        service_page_count: "",
        website_analysis: "",
        reviews_analysis: "",
        sales_priority: "",
        sales_priority_reason: "",
      }),
    ]);

    await expect(
      repository.saveCompany(
        "place-1",
        { status: "qa_ready" },
        "matt@vivawebdesigns.com",
      ),
    ).resolves.toMatchObject({ status: "qa_ready" });
  });

  it("enforces Scale-First contact, scan, and address privacy at qa_ready", async () => {
    const { repository } = buildRepository([
      row({
        workflow: "scale_first_v2",
        contact_tag: "Email Ready",
        email: "",
        address: "6226 Wild Meadow Trl",
        arp: "12.5",
        solv: "18.2",
        report_key: "",
        report_url: "https://localrankingtracker.com/report/public-id",
        scan_date: "2026-08-25",
        scan_keyword: "plumber near me",
        rating: "4.8",
        review_count: "42",
      }),
    ]);

    await expect(
      repository.saveCompany(
        "place-1",
        { status: "qa_ready" },
        "matt@vivawebdesigns.com",
      ),
    ).rejects.toThrow(
      /address.*Service Area Business|email.*Email Ready|report_key/i,
    );
  });

  it("rejects complete status until a final qualification disposition is set", async () => {
    const { repository } = buildRepository([
      row({
        qualification_status: "",
      }),
    ]);

    await expect(
      repository.saveCompany(
        "place-1",
        { status: "complete" },
        "matt@vivawebdesigns.com",
      ),
    ).rejects.toThrow(/qualification_status/);
  });

  it("clears a premature qualification disposition without changing in-progress status", async () => {
    const { client, repository } = buildRepository([
      row({
        status: "in_progress",
        qualification_status: "qualified",
      }),
    ]);

    await expect(
      repository.saveCompany(
        "place-1",
        { qualification_status: null },
        "matt@vivawebdesigns.com",
      ),
    ).resolves.toMatchObject({
      status: "in_progress",
      updated_fields: ["qualification_status"],
    });

    expect(client.values[1][SAB_HEADERS.indexOf("qualification_status")]).toBe(
      "",
    );
    expect(client.updates).toContainEqual(
      expect.objectContaining({
        range: expect.stringMatching(/![A-Z]+2$/),
        value: "",
      }),
    );
  });

  it("allows a fully audited disqualified company to close without CRM location filler", async () => {
    const { repository } = buildRepository([
      row({
        address: "",
        city: "",
        state: "",
        zip: "",
        qualification_status: "disqualified",
        research_notes:
          "Review activity is outside the allowed recency window.",
      }),
    ]);

    await expect(
      repository.saveCompany(
        "place-1",
        { status: "complete" },
        "matt@vivawebdesigns.com",
      ),
    ).resolves.toMatchObject({ status: "complete" });
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
        research_notes:
          "Matt manually disqualified the company because its primary category does not match the run trade.",
      }),
    ]);

    await expect(
      repository.saveCompany(
        "place-1",
        { status: "complete" },
        "matt@vivawebdesigns.com",
      ),
    ).resolves.toMatchObject({ status: "complete" });
  });

  it("allows a reasoned Scale-First disqualification to close without qa_ready fields", async () => {
    const { repository } = buildRepository([
      row({
        workflow: "scale_first_v2",
        city: "",
        state: "",
        zip: "",
        report_key: "",
        report_url: "",
        scan_date: "",
        scan_keyword: "",
        arp: "",
        solv: "",
        contact_tag: "",
        qualification_status: "disqualified",
        research_notes:
          "Matt manually disqualified the company because its primary category does not match the run trade.",
      }),
    ]);

    await expect(
      repository.saveCompany(
        "place-1",
        { status: "complete" },
        "matt@vivawebdesigns.com",
      ),
    ).resolves.toMatchObject({ status: "complete" });
  });

  it("does not allow a Scale-First disqualification to enter qa_ready", async () => {
    const { repository } = buildRepository([
      row({
        workflow: "scale_first_v2",
        qualification_status: "disqualified",
        research_notes:
          "Matt manually disqualified the company because its primary category does not match the run trade.",
      }),
    ]);

    await expect(
      repository.saveCompany(
        "place-1",
        { status: "qa_ready" },
        "matt@vivawebdesigns.com",
      ),
    ).rejects.toThrow(/qualification_status \(must be qualified\)/);
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

    await expect(
      repository.saveCompany(
        "place-1",
        { status: "complete" },
        "matt@vivawebdesigns.com",
      ),
    ).rejects.toThrow(/qualification reason/);
  });

  it("requires a reason when a company is disqualified or deferred", async () => {
    const { repository } = buildRepository([
      row({
        qualification_status: "deferred",
        research_notes: "",
      }),
    ]);

    await expect(
      repository.saveCompany(
        "place-1",
        { status: "complete" },
        "matt@vivawebdesigns.com",
      ),
    ).rejects.toThrow(/qualification reason/);
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

import { GoogleAuth, OAuth2Client } from "google-auth-library";
import { createHash } from "node:crypto";
import {
  SAB_HEADERS,
  SAB_REQUIRED_HEADERS,
  SAB_SCALE_FIRST_UPGRADEABLE_HEADERS,
  sabDecisionStateSchema,
  sabEligibilityStateSchema,
  sabEffectiveScanSpecSchema,
  sabMarketReferenceSchema,
  hasSabExclusionReviewHold,
  type SabCompanyUpdates,
  type SabHeader,
  type SabRow,
  type SabScanResult,
  type SabWorkflowRowInput,
} from "./schema";
import {
  SAB_ADDRESS_LABEL,
  SCALE_FIRST_CONTACT_TAGS,
  SCALE_FIRST_WORKFLOW,
  sabBusinessProfileSchema,
  sabBusinessProfileIssues,
} from "@shared/sabCrm";
import type { VerifiedSabScanHistoryRepair } from "./scanHistoryReconciliation";
import type { SabRunState } from "./runState";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const DEFAULT_SHEET_NAME = "SAB Workflow";
const COMPLETE_STATUSES = new Set(["complete", "qa_ready", "imported"]);
const FINAL_QUALIFICATION_STATUSES = new Set([
  "qualified",
  "disqualified",
  "deferred",
]);
const NULLABLE_JSON_HEADERS = new Set<SabHeader>(["website_analysis"]);
const JSON_HEADERS = new Set<SabHeader>([
  "competitors",
  "scan_history",
  "website_analysis",
  "reviews_analysis",
  "market_reference",
  "decision_state",
  "eligibility_state",
  "scan_spec",
  "business_profile",
]);
const BOOLEAN_HEADERS = new Set<SabHeader>(["has_website"]);

export interface SheetsValuesClient {
  ensureStateSheet?(spreadsheetId: string, sheetName: string): Promise<void>;
  getValues(spreadsheetId: string, range: string): Promise<string[][]>;
  getSheetGridProperties(
    spreadsheetId: string,
    sheetName: string,
  ): Promise<{ sheetId: number; columnCount: number }>;
  appendColumns(
    spreadsheetId: string,
    sheetId: number,
    columnCount: number,
  ): Promise<void>;
  updateValues(
    spreadsheetId: string,
    updates: Array<{ range: string; value: string | number | boolean }>,
  ): Promise<void>;
}

export interface SabWorkflowCreator {
  createWorkflow(
    title: string,
    rows: SabWorkflowRowInput[],
    actorEmail: string,
  ): Promise<{
    workflow_sheet: string;
    spreadsheet_id: string;
    sheet_name: string;
    row_count: number;
    progress: Record<string, Record<string, number>>;
  }>;
}

export type SabScanSubmissionReservation = {
  idempotency_key: string;
  authorization_id: string;
  company_name: string;
  place_id: string;
  scan_role: "deliverable" | "auxiliary";
  scan_type: "standard" | "scout" | "fine" | "recenter";
  scan_center: string;
  grid_size: 7 | 9;
  radius: number;
  measurement: "mi" | "km";
  keyword: string;
  platform: "google";
  estimated_credits: number;
  center_derivation: string;
  sop_routing_rule: string;
};

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

type OAuthClientCredentials = {
  client_id: string;
  client_secret: string;
};

function decodeCredentialsJson(raw: string) {
  const trimmed = raw.trim();
  return trimmed.startsWith("{")
    ? trimmed
    : Buffer.from(trimmed, "base64").toString("utf8");
}

function parseServiceAccountCredentials(
  raw: string,
): ServiceAccountCredentials {
  const credentials = JSON.parse(
    decodeCredentialsJson(raw),
  ) as Partial<ServiceAccountCredentials>;

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email or private_key",
    );
  }

  return credentials as ServiceAccountCredentials;
}

function parseOAuthClientCredentials(raw: string): OAuthClientCredentials {
  const parsed = JSON.parse(decodeCredentialsJson(raw)) as {
    installed?: Partial<OAuthClientCredentials>;
    web?: Partial<OAuthClientCredentials>;
  };
  const credentials = parsed.installed || parsed.web;

  if (!credentials?.client_id || !credentials.client_secret) {
    throw new Error(
      "GOOGLE_OAUTH_CLIENT_JSON is missing client_id or client_secret",
    );
  }

  return credentials as OAuthClientCredentials;
}

function quoteSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

function sameScanCenter(left: string, right: string) {
  const parse = (value: string) =>
    value.split(",").map((part) => Number(part.trim()));
  const [leftLatitude, leftLongitude] = parse(left);
  const [rightLatitude, rightLongitude] = parse(right);
  return leftLatitude === rightLatitude && leftLongitude === rightLongitude;
}

function placeIdSnapshot(values: string[][], placeIdColumn: number) {
  const placeIds = values
    .slice(1)
    .map((row) => row[placeIdColumn] ?? "")
    .filter((placeId) => placeId.length > 0);
  return {
    rowCount: Math.max(0, values.length - 1),
    placeIdCount: placeIds.length,
    placeIdChecksum: createHash("sha256")
      .update(placeIds.join("\n"))
      .digest("hex"),
  };
}

function validateUpgradeableSheetHeaders(headers: string[]) {
  const positions = new Map<string, number[]>();
  headers.forEach((header, index) => {
    if (!header) return;
    const indexes = positions.get(header) ?? [];
    indexes.push(index);
    positions.set(header, indexes);
  });

  const duplicates = [...positions.entries()]
    .filter(([, indexes]) => indexes.length > 1)
    .map(([header]) => header);
  if (duplicates.length > 0) {
    throw new Error(
      `SAB sheet has duplicate headers: ${duplicates.join(", ")}`,
    );
  }

  const canonicalByNormalizedName = new Map(
    SAB_HEADERS.map((header) => [header.toLowerCase(), header]),
  );
  const ambiguous = headers.filter((header) => {
    if (!header) return false;
    const canonical = canonicalByNormalizedName.get(
      header.trim().toLowerCase(),
    );
    return canonical !== undefined && header !== canonical;
  });
  if (ambiguous.length > 0) {
    throw new Error(
      `SAB sheet has ambiguous canonical headers: ${ambiguous.map((header) => JSON.stringify(header)).join(", ")}`,
    );
  }

  const missing = SAB_REQUIRED_HEADERS.filter(
    (header) => !positions.has(header),
  );
  if (missing.length > 0) {
    throw new Error(
      `SAB sheet is missing legacy/base required headers: ${missing.join(", ")}`,
    );
  }

  return positions;
}

export class GoogleSheetsValuesClient
  implements SheetsValuesClient, SabWorkflowCreator
{
  private readonly auth: GoogleAuth | OAuth2Client;

  constructor(credentialsJson: string, refreshToken?: string) {
    if (refreshToken) {
      const credentials = parseOAuthClientCredentials(credentialsJson);
      const oauth = new OAuth2Client(
        credentials.client_id,
        credentials.client_secret,
      );
      oauth.setCredentials({ refresh_token: refreshToken });
      this.auth = oauth;
    } else {
      this.auth = new GoogleAuth({
        credentials: parseServiceAccountCredentials(credentialsJson),
        scopes: [SHEETS_SCOPE],
      });
    }
  }

  private async getClient() {
    return this.auth instanceof GoogleAuth ? this.auth.getClient() : this.auth;
  }

  async ensureStateSheet(spreadsheetId: string, sheetName: string) {
    const client = await this.getClient();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`;
    const response = await client.request<{sheets?: Array<{properties?: {title?: string}}>}>(
      {url, method: "GET", params: {fields: "sheets.properties.title"}},
    );
    if (response.data.sheets?.some(sheet => sheet.properties?.title === sheetName)) return;
    await client.request({url: `${url}:batchUpdate`, method: "POST", data: {
      requests: [{addSheet: {properties: {title: sheetName, gridProperties: {rowCount: 2000, columnCount: 5}}}}],
    }});
  }

  async getValues(spreadsheetId: string, range: string): Promise<string[][]> {
    const client = await this.getClient();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
    const response = await client.request<{
      values?: Array<Array<string | number | boolean>>;
    }>({
      url,
      method: "GET",
      params: { valueRenderOption: "FORMATTED_VALUE" },
    });

    return (response.data.values ?? []).map((row) =>
      row.map((value) => String(value)),
    );
  }

  async getSheetGridProperties(spreadsheetId: string, sheetName: string) {
    const client = await this.getClient();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`;
    const response = await client.request<{
      sheets?: Array<{
        properties?: {
          sheetId?: number;
          title?: string;
          gridProperties?: { columnCount?: number };
        };
      }>;
    }>({
      url,
      method: "GET",
      params: {
        includeGridData: false,
        fields: "sheets.properties(sheetId,title,gridProperties)",
      },
    });
    const properties = response.data.sheets
      ?.map((sheet) => sheet.properties)
      .find((sheet) => sheet?.title === sheetName);
    const columnCount = properties?.gridProperties?.columnCount;
    if (properties?.sheetId === undefined || columnCount === undefined) {
      throw new Error(
        `Google Sheets did not return grid properties for tab ${JSON.stringify(sheetName)}`,
      );
    }
    return { sheetId: properties.sheetId, columnCount };
  }

  async appendColumns(
    spreadsheetId: string,
    sheetId: number,
    columnCount: number,
  ) {
    if (columnCount <= 0) return;
    const client = await this.getClient();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`;
    await client.request({
      url,
      method: "POST",
      data: {
        requests: [
          {
            appendDimension: {
              sheetId,
              dimension: "COLUMNS",
              length: columnCount,
            },
          },
        ],
      },
    });
  }

  async updateValues(
    spreadsheetId: string,
    updates: Array<{ range: string; value: string | number | boolean }>,
  ): Promise<void> {
    if (updates.length === 0) return;

    const client = await this.getClient();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`;
    await client.request({
      url,
      method: "POST",
      data: {
        valueInputOption: "RAW",
        data: updates.map(({ range, value }) => ({
          range,
          majorDimension: "ROWS",
          values: [[value]],
        })),
      },
    });
  }

  async createWorkflow(
    title: string,
    rows: SabWorkflowRowInput[],
    actorEmail: string,
  ) {
    validateWorkflowRows(rows);
    const client = await this.getClient();
    const timestamp = new Date().toISOString();
    const completeRows = rows.map((row) => ({
      ...row,
      status: row.status || "assigned",
      scan_history: [],
      updated_at: timestamp,
      updated_by: actorEmail,
    }));
    const tableValues = [
      Array.from(SAB_HEADERS),
      ...completeRows.map((row) =>
        SAB_HEADERS.map((header) =>
          serializeValue(header, row[header as keyof typeof row]),
        ),
      ),
    ];

    const createResponse = await client.request<{
      spreadsheetId: string;
      spreadsheetUrl?: string;
    }>({
      url: "https://sheets.googleapis.com/v4/spreadsheets",
      method: "POST",
      params: {
        fields: "spreadsheetId,spreadsheetUrl",
      },
      data: {
        properties: { title },
        sheets: [
          {
            properties: {
              title: DEFAULT_SHEET_NAME,
              gridProperties: {
                rowCount: Math.max(1_000, tableValues.length),
                columnCount: SAB_HEADERS.length,
              },
            },
            data: [
              {
                startRow: 0,
                startColumn: 0,
                rowData: tableValues.map((values) => ({
                  values: values.map((value) => ({
                    userEnteredValue: sheetsCellValue(value),
                  })),
                })),
              },
            ],
          },
        ],
      },
    });

    const spreadsheetId = createResponse.data.spreadsheetId;
    if (!spreadsheetId)
      throw new Error("Google Sheets did not return a spreadsheet ID");

    const expectedLastColumn = columnName(SAB_HEADERS.length - 1);
    const readback = await this.getValues(
      spreadsheetId,
      `${quoteSheetName(DEFAULT_SHEET_NAME)}!A1:${expectedLastColumn}${rows.length + 1}`,
    );
    const actualHeaders = readback[0] ?? [];
    if (
      actualHeaders.length !== SAB_HEADERS.length ||
      SAB_HEADERS.some((header, index) => actualHeaders[index] !== header)
    ) {
      throw new Error("Created Workflow Sheet failed exact header validation");
    }
    if (readback.length - 1 !== rows.length) {
      throw new Error(
        `Created Workflow Sheet failed roster validation: expected ${rows.length}, read ${readback.length - 1}`,
      );
    }

    const repository = new SabSheetsRepository(
      this,
      spreadsheetId,
      DEFAULT_SHEET_NAME,
    );
    const progress = await repository.getProgress();
    const confirmedCount = Object.values(progress).reduce(
      (sum, batch) => sum + (batch.total ?? 0),
      0,
    );
    if (confirmedCount !== rows.length) {
      throw new Error(
        `Created Workflow Sheet failed progress validation: expected ${rows.length}, confirmed ${confirmedCount}`,
      );
    }

    return {
      workflow_sheet:
        createResponse.data.spreadsheetUrl ||
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      spreadsheet_id: spreadsheetId,
      sheet_name: DEFAULT_SHEET_NAME,
      row_count: rows.length,
      progress,
    };
  }
}

function columnName(index: number): string {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function sheetsCellValue(value: string | number | boolean) {
  if (typeof value === "number") return { numberValue: value };
  if (typeof value === "boolean") return { boolValue: value };
  return { stringValue: value };
}

function validateWorkflowRows(rows: SabWorkflowRowInput[]) {
  const placeIds = new Set<string>();
  const batchPositions = new Set<string>();

  for (const row of rows) {
    if (placeIds.has(row.place_id)) {
      throw new Error(
        `Duplicate place_id in Workflow Sheet roster: ${row.place_id}`,
      );
    }
    placeIds.add(row.place_id);

    const positionKey = `${row.batch_id}:${row.batch_position}`;
    if (batchPositions.has(positionKey)) {
      throw new Error(
        `Duplicate batch position in Workflow Sheet roster: ${positionKey}`,
      );
    }
    batchPositions.add(positionKey);
  }
}

function serializeValue(
  header: SabHeader,
  value: unknown,
): string | number | boolean {
  if (value === null || value === undefined) {
    return NULLABLE_JSON_HEADERS.has(header) ? "null" : "";
  }
  if (JSON_HEADERS.has(header)) return JSON.stringify(value);
  if (BOOLEAN_HEADERS.has(header)) return value ? "TRUE" : "FALSE";
  return value as string | number | boolean;
}

function parseJsonValue(value: string): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseJsonArray(value: string): string[] | null {
  const parsed = parseJsonValue(value);
  return Array.isArray(parsed) ? parsed.map(String) : null;
}

function publicRow(row: SabRow) {
  const competitors = parseJsonValue(row.competitors);
  const scanHistory = parseJsonValue(row.scan_history);
  return {
    ...row,
    competitors: Array.isArray(competitors)
      ? competitors.map(String)
      : row.competitors,
    scan_history: Array.isArray(scanHistory) ? scanHistory : [],
    decision_state: parseJsonValue(row.decision_state),
    eligibility_state: parseJsonValue(row.eligibility_state),
    market_reference: parseJsonValue(row.market_reference),
    scan_spec: parseJsonValue(row.scan_spec),
    business_profile: parseJsonValue(row.business_profile),
    has_website: row.has_website
      ? row.has_website.trim().toLowerCase() === "true"
      : null,
    service_page_count: row.service_page_count
      ? Number(row.service_page_count)
      : null,
    website_analysis: parseJsonArray(row.website_analysis),
    reviews_analysis: parseJsonArray(row.reviews_analysis),
    rating: row.rating ? Number(row.rating) : null,
    review_count: row.review_count ? Number(row.review_count) : null,
    sales_priority: row.sales_priority ? Number(row.sales_priority) : null,
  };
}

export class SabSheetsRepository {
  constructor(
    private readonly client: SheetsValuesClient,
    private readonly spreadsheetId: string,
    private readonly sheetName: string,
  ) {}

  private get runStateTab() { return `${this.sheetName} Run State`; }

  async assertOneActiveRun(runId: string) {
    let values: string[][];
    try { values = await this.client.getValues(this.spreadsheetId, `${quoteSheetName(this.runStateTab)}!A:E`); }
    catch (error) {
      if (/Unable to parse range|not found|Unknown fake tab/i.test(String(error))) return;
      throw error;
    }
    if (values.some(row => row[0] && row[0] !== runId)) throw new Error("This Workflow Sheet already belongs to another run. Use its authoritative run state; a new run requires a new sheet, never an approval reset.");
  }

  async getRunState(runId: string): Promise<SabRunState | null> {
    // Reading an uninitialized run must not create a tab or silently assume approval.
    let values: string[][];
    try { values = await this.client.getValues(this.spreadsheetId, `${quoteSheetName(this.runStateTab)}!A:E`); }
    catch (error) {
      if (/Unable to parse range|not found|Unknown fake tab/i.test(String(error))) return null;
      throw error;
    }
    const rows = values.filter(row => row[0] === runId);
    if (!rows.length) return null;
    const version = Math.max(...rows.map(row => Number(row[1])));
    const chunks = rows.filter(row => Number(row[1]) === version).sort((a,b) => Number(a[2])-Number(b[2]));
    if (chunks.some((row,index) => Number(row[2]) !== index)) throw new Error("Run-state chunks are incomplete; no paid submission permitted");
    const state = JSON.parse(chunks.map(row => row[3]).join("")) as SabRunState;
    if (state.run_id !== runId || state.version !== version || state.schema_version !== 1) throw new Error("Run-state identity/version mismatch");
    return state;
  }

  async saveRunState(state: SabRunState, expectedVersion: number | null, actorEmail: string) {
    if (!this.client.ensureStateSheet) throw new Error("Durable run-state storage is unavailable; paid submission disabled");
    await this.assertOneActiveRun(state.run_id);
    await this.client.ensureStateSheet(this.spreadsheetId, this.runStateTab);
    const previous = await this.getRunState(state.run_id);
    if ((previous?.version ?? null) !== expectedVersion) throw new Error("Run state changed; reconcile before retrying transition");
    const values = await this.client.getValues(this.spreadsheetId, `${quoteSheetName(this.runStateTab)}!A:E`);
    const json = JSON.stringify(state);
    const chunks = json.match(/[\s\S]{1,40000}/g) ?? [];
    const existingIndexes = values.flatMap((row,index) => row[0] === state.run_id ? [index] : []);
    const start = values.length;
    const updates = chunks.flatMap((chunk,index) => {
      const rowNumber = (existingIndexes[index] ?? start + Math.max(0,index-existingIndexes.length)) + 1;
      return [state.run_id,state.version,index,chunk,actorEmail].map((value,column) => ({range:`${quoteSheetName(this.runStateTab)}!${columnName(column)}${rowNumber}`,value}));
    });
    for (const index of existingIndexes.slice(chunks.length)) {
      for (let column=0;column<5;column++) updates.push({range:`${quoteSheetName(this.runStateTab)}!${columnName(column)}${index+1}`,value:""});
    }
    await this.client.updateValues(this.spreadsheetId, updates);
  }

  async getScanSubmission(placeId: string, key: string) {
    const {rows} = await this.readTable();
    const row = rows.find(item => item.row.place_id === placeId)?.row;
    return row ? this.parsedScanHistory(row).find(entry => entry.record_type === "scan_submission" && entry.idempotency_key === key) ?? null : null;
  }

  private async readTable(): Promise<{
    headers: string[];
    headerIndex: Map<SabHeader, number>;
    rows: Array<{ rowNumber: number; row: SabRow }>;
  }> {
    const values = await this.client.getValues(
      this.spreadsheetId,
      `${quoteSheetName(this.sheetName)}!A:AZ`,
    );
    const headers = values[0] ?? [];
    const missing = SAB_REQUIRED_HEADERS.filter(
      (header) => !headers.includes(header),
    );
    if (missing.length > 0) {
      throw new Error(
        `SAB sheet is missing required headers: ${missing.join(", ")}`,
      );
    }

    const headerIndex = new Map(
      SAB_HEADERS.map((header) => [header, headers.indexOf(header)]),
    );
    const rows = values
      .slice(1)
      .map((valuesRow, offset) => {
        const row = Object.fromEntries(
          SAB_HEADERS.map((header) => {
            const index = headerIndex.get(header) ?? -1;
            return [header, index >= 0 ? (valuesRow[index] ?? "") : ""];
          }),
        ) as SabRow;
        return { rowNumber: offset + 2, row };
      })
      .filter(({ row }) => row.place_id || row.company);

    return { headers, headerIndex, rows };
  }

  private parsedScanHistory(row: SabRow): Array<Record<string, unknown>> {
    const parsed = parseJsonValue(row.scan_history);
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry) &&
            typeof entry === "object" &&
            !Array.isArray(entry),
        )
      : [];
  }

  private async ensureScanHistoryColumn(
    headers: string[],
    headerIndex: Map<SabHeader, number>,
  ) {
    const existing = headerIndex.get("scan_history") ?? -1;
    if (existing >= 0) return existing;
    const appended = headers.length;
    await this.client.updateValues(this.spreadsheetId, [
      {
        range: `${quoteSheetName(this.sheetName)}!${columnName(appended)}1`,
        value: "scan_history",
      },
    ]);
    return appended;
  }

  private async writeScanHistories(
    histories: Map<number, Array<Record<string, unknown>>>,
    scanHistoryColumn: number,
    headerIndex: Map<SabHeader, number>,
    actorEmail: string,
    timestamp: string,
  ) {
    const updatedAtColumn = headerIndex.get("updated_at") ?? -1;
    const updatedByColumn = headerIndex.get("updated_by") ?? -1;
    if (updatedAtColumn < 0 || updatedByColumn < 0) {
      throw new Error("SAB sheet cannot store scan-history audit metadata.");
    }
    const updates = [...histories.entries()].flatMap(([rowNumber, history]) => [
      {
        range: `${quoteSheetName(this.sheetName)}!${columnName(scanHistoryColumn)}${rowNumber}`,
        value: JSON.stringify(history),
      },
      {
        range: `${quoteSheetName(this.sheetName)}!${columnName(updatedAtColumn)}${rowNumber}`,
        value: timestamp,
      },
      {
        range: `${quoteSheetName(this.sheetName)}!${columnName(updatedByColumn)}${rowNumber}`,
        value: actorEmail,
      },
    ]);
    if (updates.length > 0) {
      await this.client.updateValues(this.spreadsheetId, updates);
    }
  }

  async upgradeWorkflowSchema() {
    const readValues = () =>
      this.client.getValues(this.spreadsheetId, quoteSheetName(this.sheetName));
    const beforeValues = await readValues();
    const beforeHeaders = beforeValues[0] ?? [];
    const beforePositions = validateUpgradeableSheetHeaders(beforeHeaders);
    const placeIdColumn = beforePositions.get("place_id")?.[0];
    if (placeIdColumn === undefined) {
      throw new Error(
        "SAB sheet is missing legacy/base required header: place_id",
      );
    }
    const before = placeIdSnapshot(beforeValues, placeIdColumn);
    const alreadyPresentHeaders = SAB_SCALE_FIRST_UPGRADEABLE_HEADERS.filter(
      (header) => beforePositions.has(header),
    );
    const addedHeaders = SAB_SCALE_FIRST_UPGRADEABLE_HEADERS.filter(
      (header) => !beforePositions.has(header),
    );
    const firstUnusedColumn = beforeValues.reduce(
      (maximum, row) => Math.max(maximum, row.length),
      0,
    );
    const requiredColumnCapacity = firstUnusedColumn + addedHeaders.length;
    const beforeGrid = await this.client.getSheetGridProperties(
      this.spreadsheetId,
      this.sheetName,
    );
    const columnsAdded = Math.max(
      0,
      requiredColumnCapacity - beforeGrid.columnCount,
    );

    if (addedHeaders.length > 0) {
      await this.client.appendColumns(
        this.spreadsheetId,
        beforeGrid.sheetId,
        columnsAdded,
      );
      await this.client.updateValues(
        this.spreadsheetId,
        addedHeaders.map((header, offset) => ({
          range: `${quoteSheetName(this.sheetName)}!${columnName(firstUnusedColumn + offset)}1`,
          value: header,
        })),
      );
    }

    const afterValues = await readValues();
    const afterGrid = await this.client.getSheetGridProperties(
      this.spreadsheetId,
      this.sheetName,
    );
    const afterHeaders = afterValues[0] ?? [];
    const afterPositions = validateUpgradeableSheetHeaders(afterHeaders);
    const expectedHeaderPositions = new Map(
      SAB_SCALE_FIRST_UPGRADEABLE_HEADERS.map((header) => {
        const existingPosition = beforePositions.get(header)?.[0];
        const addedOffset = addedHeaders.indexOf(header);
        return [header, existingPosition ?? firstUnusedColumn + addedOffset];
      }),
    );
    for (const header of SAB_SCALE_FIRST_UPGRADEABLE_HEADERS) {
      const positions = afterPositions.get(header) ?? [];
      if (
        positions.length !== 1 ||
        positions[0] !== expectedHeaderPositions.get(header)
      ) {
        throw new Error(
          `SAB Workflow schema upgrade verification failed for header: ${header}`,
        );
      }
    }
    const afterPlaceIdColumn = afterPositions.get("place_id")?.[0];
    if (afterPlaceIdColumn === undefined) {
      throw new Error(
        "SAB Workflow schema upgrade verification lost the place_id header",
      );
    }
    const after = placeIdSnapshot(afterValues, afterPlaceIdColumn);
    if (
      before.rowCount !== after.rowCount ||
      before.placeIdCount !== after.placeIdCount ||
      before.placeIdChecksum !== after.placeIdChecksum
    ) {
      throw new Error(
        "SAB Workflow schema upgrade verification detected changed rows or Place IDs",
      );
    }
    if (afterGrid.sheetId !== beforeGrid.sheetId) {
      throw new Error(
        "SAB Workflow schema upgrade verification detected a changed tab sheetId",
      );
    }
    const expectedColumnCapacity = beforeGrid.columnCount + columnsAdded;
    if (afterGrid.columnCount !== expectedColumnCapacity) {
      throw new Error(
        `SAB Workflow schema upgrade verification found unexpected column capacity: ${afterGrid.columnCount} !== ${expectedColumnCapacity}`,
      );
    }
    if (afterGrid.columnCount < requiredColumnCapacity) {
      throw new Error(
        `SAB Workflow schema upgrade verification found insufficient column capacity: ${afterGrid.columnCount} < ${requiredColumnCapacity}`,
      );
    }

    return {
      added_headers: Array.from(addedHeaders),
      already_present_headers: Array.from(alreadyPresentHeaders),
      changed: addedHeaders.length > 0,
      before_row_count: before.rowCount,
      after_row_count: after.rowCount,
      before_place_id_count: before.placeIdCount,
      after_place_id_count: after.placeIdCount,
      before_place_id_checksum: before.placeIdChecksum,
      after_place_id_checksum: after.placeIdChecksum,
      before_column_capacity: beforeGrid.columnCount,
      after_column_capacity: afterGrid.columnCount,
      columns_added: columnsAdded,
      final_header_positions: Object.fromEntries(
        SAB_SCALE_FIRST_UPGRADEABLE_HEADERS.map((header) => {
          const zeroBasedIndex = afterPositions.get(header)?.[0];
          if (zeroBasedIndex === undefined) {
            throw new Error(
              `SAB Workflow schema upgrade verification lost header: ${header}`,
            );
          }
          return [
            header,
            {
              column_number: zeroBasedIndex + 1,
              column_letter: columnName(zeroBasedIndex),
            },
          ];
        }),
      ),
    };
  }

  async getBatch(batchId: string, includeCompleted = false) {
    const { rows } = await this.readTable();
    return rows
      .filter(({ row }) => row.batch_id === batchId)
      .filter(
        ({ row }) => includeCompleted || !COMPLETE_STATUSES.has(row.status),
      )
      .sort(
        (a, b) => Number(a.row.batch_position) - Number(b.row.batch_position),
      )
      .map(({ row }) => publicRow(row));
  }

  async getCompany(placeId: string) {
    const { rows } = await this.readTable();
    const match = rows.find(({ row }) => row.place_id === placeId);
    if (!match) throw new Error(`No SAB company found for place_id ${placeId}`);
    return publicRow(match.row);
  }

  async getExportCandidates() {
    const {rows} = await this.readTable();
    const eligible = rows.filter(({row}) => row.workflow === SCALE_FIRST_WORKFLOW &&
      row.qualification_status === "qualified" && ["complete", "qa_ready"].includes(row.status) &&
      !hasSabExclusionReviewHold(parseJsonValue(row.decision_state)));
    const ids = new Set<string>();
    for (const {row} of eligible) {
      if (ids.has(row.place_id)) throw new Error("Duplicate Place ID in qualified export population");
      ids.add(row.place_id);
      this.validateScaleFirstQaReadyRow(row);
    }
    return eligible.map(({row}) => publicRow(row));
  }

  async saveCompany(
    placeId: string,
    updates: SabCompanyUpdates,
    actorEmail: string,
    options: {exclusionReviewApproved?: boolean; exclusionReviewDeclined?: boolean; exclusionDecisionContinued?: boolean; corroborationRecorded?: boolean; corroborationAnalysisVerified?: boolean} = {},
  ) {
    const { headerIndex, rows } = await this.readTable();
    const match = rows.find(({ row }) => row.place_id === placeId);
    if (!match) throw new Error(`No SAB company found for place_id ${placeId}`);

    const merged = {
      ...match.row,
      ...Object.fromEntries(
        Object.entries(updates).map(([key, value]) => [
          key,
          String(serializeValue(key as SabHeader, value)),
        ]),
      ),
    } as SabRow;

    const priorDecision = parseJsonValue(match.row.decision_state);
    const profile = merged.business_profile.trim() ? sabBusinessProfileSchema.parse(parseJsonValue(merged.business_profile)) : null;
    if (profile && profile.place_id !== placeId) throw new Error("business_profile Place ID must exactly match the workflow row");
    const nextDecision = parseJsonValue(merged.decision_state);
    const previousState = priorDecision as Record<string, any> | null;
    const nextState = nextDecision as Record<string, any> | null;
    const priorCorroboration = previousState?.address_corroboration ?? null;
    const nextCorroboration = nextState?.address_corroboration ?? null;
    const corroborationChanged = JSON.stringify(priorCorroboration) !== JSON.stringify(nextCorroboration);
    const technicalHold = ["incomplete", "technical_failure"].includes(priorCorroboration?.status);
    const corroborationHold = technicalHold || ["address_corroboration_required", "address_corroboration_incomplete"].includes(match.row.blocker) ||
      ["address_corroboration_required", "address_corroboration_incomplete"].includes(previousState?.evidence?.next_action);
    if (options.corroborationRecorded) {
      const recorded = sabDecisionStateSchema.safeParse(nextDecision);
      if (!recorded.success || !recorded.data.address_corroboration ||
          recorded.data.source_report_key !== previousState?.source_report_key || recorded.data.evidence_hash !== previousState?.evidence_hash ||
          recorded.data.address_corroboration.source_report_key !== recorded.data.source_report_key ||
          recorded.data.address_corroboration.evidence_hash !== recorded.data.evidence_hash ||
          (technicalHold && recorded.data.address_corroboration.status === "no_candidate")) {
        throw new Error("Recorded corroboration must match the current exact evidence; a technical failure cannot be relabelled as no candidate");
      }
    } else if (options.corroborationAnalysisVerified) {
      // Verified analysis can drop stale evidence, but cannot fabricate or
      // relabel a geographic-fit result in place of the private evaluator.
      const sourceChanged = previousState?.source_report_key !== nextState?.source_report_key || previousState?.evidence_hash !== nextState?.evidence_hash;
      if (corroborationChanged && !(priorCorroboration && !nextCorroboration && sourceChanged)) {
        throw new Error("Verified analysis may only preserve corroboration or invalidate it after changed source evidence");
      }
      if (technicalHold && !sourceChanged && nextState?.evidence?.next_action === "plan_auxiliary") {
        throw new Error("Incomplete address evaluation cannot become paid auxiliary permission");
      }
    } else {
      if (corroborationChanged) throw new Error("Only the dedicated corroboration tool may create, replace or remove address corroboration evidence");
      if (corroborationHold && (JSON.stringify(priorDecision) !== JSON.stringify(nextDecision) ||
          merged.status !== match.row.status || merged.blocker !== match.row.blocker)) {
        throw new Error("Address corroboration hold requires verified evaluation or source analysis; generic writes cannot release its status, blocker or decision");
      }
    }
    const priorReview = (priorDecision as {exclusion_review?: unknown} | null)?.exclusion_review;
    const nextReview = (nextDecision as {exclusion_review?: {status?: unknown}} | null)?.exclusion_review;
    const priorPending = hasSabExclusionReviewHold(priorDecision);
    const nextPending = hasSabExclusionReviewHold(nextDecision);
    if (options.exclusionReviewApproved) {
      const previous = sabDecisionStateSchema.safeParse(priorDecision);
      const approved = sabDecisionStateSchema.safeParse(nextDecision);
      if (!previous.success || previous.data.exclusion_review?.status !== "pending" || !approved.success ||
          approved.data.exclusion_review?.status !== "approved" ||
          approved.data.source_report_key !== previous.data.source_report_key || approved.data.evidence_hash !== previous.data.evidence_hash ||
          merged.qualification_status !== "disqualified" || merged.qualification_reason !== "existing_visibility_too_strong" || merged.status !== "complete" ||
          approved.data.evidence?.next_action !== "high_visibility_excluded") {
        throw new Error("Explicit exclusion approval must finalize the existing pending report and evidence with Matt's reference; stale or unrelated approval is not valid");
      }
    } else if (options.exclusionReviewDeclined) {
      const previous = sabDecisionStateSchema.safeParse(priorDecision);
      const declined = sabDecisionStateSchema.safeParse(nextDecision);
      const nextAction = declined.success ? declined.data.evidence?.next_action : null;
      if (!previous.success || previous.data.exclusion_review?.status !== "pending" || !declined.success ||
          declined.data.exclusion_review?.status !== "declined" ||
          declined.data.source_report_key !== previous.data.source_report_key || declined.data.evidence_hash !== previous.data.evidence_hash ||
          !["plan_deliverable", "comparison_ready"].includes(String(nextAction)) || merged.status !== "in_progress" || merged.blocker ||
          merged.qualification_status !== match.row.qualification_status || merged.qualification_reason !== match.row.qualification_reason ||
          (nextAction === "plan_deliverable" && (declined.data.centering_status !== "planned" || !declined.data.proposed_center || !declined.data.center_type)) ||
          (nextAction === "comparison_ready" && declined.data.centering_status !== "validated")) {
        throw new Error("Explicit exclusion decline must resume the matching pending S02 or S09 evidence with Matt's exact reference");
      }
    } else if (options.exclusionDecisionContinued) {
      const previous=sabDecisionStateSchema.safeParse(priorDecision),continued=sabDecisionStateSchema.safeParse(nextDecision);
      const history=continued.success && Array.isArray(continued.data.evidence?.exclusion_decision_history)
        ? continued.data.evidence.exclusion_decision_history : [];
      const review=previous.success?previous.data.exclusion_review:undefined;
      const preserved=review && history.some(entry=>entry && typeof entry==="object" &&
        (entry as Record<string,unknown>).status===review.status && (entry as Record<string,unknown>).report_key===review.report_key &&
        (entry as Record<string,unknown>).evidence_hash===review.evidence_hash && (entry as Record<string,unknown>).declined_by===review.declined_by &&
        (entry as Record<string,unknown>).decline_reference===review.decline_reference);
      if(!previous.success || previous.data.exclusion_review?.status!=="declined" || !continued.success || continued.data.exclusion_review || !preserved) {
        throw new Error("A supported post-decline transition must preserve the exact declined exclusion as structured history");
      }
    } else {
      if (["approved", "declined"].includes(String(nextReview?.status)) && JSON.stringify(nextReview) !== JSON.stringify(priorReview)) {
        throw new Error("Only the explicit Matt exclusion-review tools may record an exclusion decision");
      }
      if (priorPending) {
        if (JSON.stringify(priorDecision) !== JSON.stringify(nextDecision) || merged.status !== "blocked" ||
            merged.qualification_status !== match.row.qualification_status || merged.qualification_reason !== match.row.qualification_reason ||
            merged.outcome !== match.row.outcome) {
          throw new Error("Pending high-visibility exclusion requires Matt review; generic writes cannot replace the decision, change disposition, or release its blocked status");
        }
      }
      if (nextPending) {
        const pending = sabDecisionStateSchema.safeParse(nextDecision);
        if (!pending.success || pending.data.exclusion_review?.status !== "pending" || merged.status !== "blocked" || merged.qualification_status === "disqualified") {
          throw new Error("A pending high-visibility exclusion must retain matching structured evidence and blocked status without final disqualification");
        }
      }
      if (priorReview && ["approved", "declined"].includes(String((priorReview as {status?:unknown}).status)) && JSON.stringify(priorDecision) !== JSON.stringify(nextDecision)) {
        throw new Error("Generic writes cannot replace decided exclusion evidence or its review reference");
      }
    }
    const finalHighVisibility = merged.qualification_reason === "existing_visibility_too_strong" &&
      (merged.qualification_status === "disqualified" || COMPLETE_STATUSES.has(merged.status));
    if (finalHighVisibility) {
      const approved = sabDecisionStateSchema.safeParse(nextDecision);
      if (!approved.success || approved.data.exclusion_review?.status !== "approved") {
        throw new Error("Final high-visibility disqualification requires Matt's explicit approval bound to the current report and evidence");
      }
    }

    if (updates.qualification_status === "qualified" && match.row.qualification_status !== "qualified") {
      this.validateScaleFirstQaReadyRow(merged);
    }

    if (updates.scan_center && updates.center_type) {
      const state = sabDecisionStateSchema.safeParse(parseJsonValue(merged.decision_state));
      if (!state.success || state.data.center_type !== updates.center_type ||
          !state.data.proposed_center || !sameScanCenter(state.data.proposed_center, updates.scan_center) ||
          !["planned", "validated"].includes(state.data.centering_status)) {
        throw new Error("Cannot save center without matching structured decision_state evidence; research_notes do not authorize a center");
      }
      if (updates.center_type === "master_edge_offset" && state.data.centering_status === "validated") {
        throw new Error("master_edge_offset is an auxiliary launch point, never a validated deliverable center");
      }
    }

    if (updates.status && COMPLETE_STATUSES.has(updates.status)) {
      const isScaleFirstDisqualificationClosure =
        merged.workflow === SCALE_FIRST_WORKFLOW &&
        updates.status === "complete" &&
        ["disqualified", "deferred"].includes(merged.qualification_status);
      if (isScaleFirstDisqualificationClosure && !merged.qualification_reason.trim()) {
        throw new Error("Structured qualification_reason is required for disqualified or deferred closure");
      }
      if (
        merged.workflow === SCALE_FIRST_WORKFLOW &&
        !isScaleFirstDisqualificationClosure
      ) {
        this.validateScaleFirstQaReadyRow(merged);
      } else if (!isScaleFirstDisqualificationClosure) {
        this.validateCompleteRow(merged);
      }
    }

    const timestamp = new Date().toISOString();
    const valuesToWrite: Record<string, unknown> = {
      ...updates,
      updated_at: timestamp,
      updated_by: actorEmail,
    };

    const cellUpdates = Object.entries(valuesToWrite).map(([key, value]) => {
      const header = key as SabHeader;
      const index = headerIndex.get(header);
      if (index === undefined || index < 0) {
        throw new Error(
          `SAB sheet is missing writable header "${key}". Run upgrade_sab_workflow_schema for this Workflow Sheet before saving.`,
        );
      }
      return {
        range: `${quoteSheetName(this.sheetName)}!${columnName(index)}${match.rowNumber}`,
        value: serializeValue(header, value),
      };
    });

    await this.client.updateValues(this.spreadsheetId, cellUpdates);

    return {
      place_id: placeId,
      company: match.row.company,
      status: updates.status ?? match.row.status,
      updated_at: timestamp,
      updated_fields: Object.keys(updates),
      ...(profile ? { business_profile_review_required: sabBusinessProfileIssues(profile, placeId, merged.phone) } : {}),
    };
  }

  async reconcileScanHistory(
    repairs: VerifiedSabScanHistoryRepair[],
    actorEmail: string,
  ) {
    const { headers, headerIndex, rows } = await this.readTable();
    const rowByPlaceId = new Map(rows.map((item) => [item.row.place_id, item]));
    const histories = new Map(
      rows.map((item) => [item.row.place_id, this.parsedScanHistory(item.row)]),
    );
    const changedPlaceIds = new Set<string>();
    const timestamp = new Date().toISOString();

    const appendAudit = (
      placeId: string,
      repair: VerifiedSabScanHistoryRepair,
      action: string,
    ) => {
      const history = histories.get(placeId)!;
      const exists = history.some(
        (entry) =>
          entry.record_type === "scan_reconciliation" &&
          entry.reconciliation_id === repair.reconciliation_id &&
          entry.action === action,
      );
      if (exists) return;
      history.push({
        record_type: "scan_reconciliation",
        reconciliation_id: repair.reconciliation_id,
        action,
        disposition: repair.disposition,
        verified_report_key: repair.report_key,
        expected_place_id: repair.expected_place_id,
        authorization_id: repair.authorization_id,
        reason: repair.reason,
        verified_scan_center: repair.actual.scan_center,
        verified_grid_size: repair.actual.grid_size,
        verified_radius: repair.actual.radius,
        verified_measurement: repair.actual.measurement,
        verified_keyword: repair.actual.keyword,
        verified_at: timestamp,
        verified_by: actorEmail,
      });
      changedPlaceIds.add(placeId);
    };

    for (const repair of repairs) {
      const target = rowByPlaceId.get(repair.expected_place_id);
      if (!target) {
        throw new Error(
          `No SAB company found for repair target place_id ${repair.expected_place_id}`,
        );
      }
      for (const sourcePlaceId of repair.remove_from_place_ids) {
        const source = rowByPlaceId.get(sourcePlaceId);
        if (!source) {
          throw new Error(
            `No SAB company found for repair source place_id ${sourcePlaceId}`,
          );
        }
        if (source.row.report_key === repair.report_key) {
          throw new Error(
            `Cannot detach canonical report_key ${repair.report_key}; this tool repairs noncanonical scan history only.`,
          );
        }
        const history = histories.get(sourcePlaceId)!;
        const filtered = history.filter(
          (entry) => entry.report_key !== repair.report_key,
        );
        if (filtered.length !== history.length) {
          histories.set(sourcePlaceId, filtered);
          changedPlaceIds.add(sourcePlaceId);
        }
        appendAudit(sourcePlaceId, repair, "removed_false_association");
      }

      const associations = [...histories.entries()].flatMap(
        ([placeId, history]) =>
          history.some((entry) => entry.report_key === repair.report_key)
            ? [placeId]
            : [],
      );
      if (repair.disposition === "void_excess_duplicate") {
        if (associations.length > 0) {
          throw new Error(
            `Cannot void report ${repair.report_key}; it remains associated with ${associations.join(", ")}.`,
          );
        }
        const targetHistory = histories.get(repair.expected_place_id)!;
        const alreadyVoided = targetHistory.some(
          (entry) =>
            entry.record_type === "scan_reconciliation" &&
            entry.disposition === "void_excess_duplicate" &&
            entry.voided_report_key === repair.report_key,
        );
        if (!alreadyVoided) {
          targetHistory.push({
            record_type: "scan_reconciliation",
            reconciliation_id: repair.reconciliation_id,
            action: "voided_excess_duplicate",
            disposition: "void_excess_duplicate",
            voided_report_key: repair.report_key,
            expected_place_id: repair.expected_place_id,
            authorization_id: repair.authorization_id,
            reason: repair.reason,
            verified_scan_center: repair.actual.scan_center,
            verified_grid_size: repair.actual.grid_size,
            verified_radius: repair.actual.radius,
            verified_measurement: repair.actual.measurement,
            verified_keyword: repair.actual.keyword,
            verified_at: timestamp,
            verified_by: actorEmail,
          });
          changedPlaceIds.add(repair.expected_place_id);
        }
        continue;
      }

      const unexpectedAssociations = associations.filter(
        (placeId) => placeId !== repair.expected_place_id,
      );
      if (unexpectedAssociations.length > 0) {
        throw new Error(
          `Report ${repair.report_key} remains associated with the wrong row(s): ${unexpectedAssociations.join(", ")}.`,
        );
      }
      if (associations.length === 0) {
        histories.get(repair.expected_place_id)!.push({
          scan_role: repair.expected.scan_role,
          scan_type: repair.expected.scan_type,
          arp: repair.actual.arp,
          solv: repair.actual.solv,
          found_in: repair.actual.found_in,
          scan_center: repair.actual.scan_center,
          report_key: repair.report_key,
          report_url: repair.actual.report_url,
          center_type: null,
          scan_date: repair.actual.scan_date,
          scan_keyword: repair.actual.keyword,
          notes: `Server-verified auxiliary association repaired under authorization ${repair.authorization_id}.`,
          saved_at: timestamp,
          saved_by: actorEmail,
        });
        changedPlaceIds.add(repair.expected_place_id);
      }
      appendAudit(
        repair.expected_place_id,
        repair,
        "attached_verified_auxiliary",
      );
    }

    const scanHistoryColumn = await this.ensureScanHistoryColumn(
      headers,
      headerIndex,
    );
    const rowUpdates = new Map<number, Array<Record<string, unknown>>>();
    for (const placeId of changedPlaceIds) {
      rowUpdates.set(
        rowByPlaceId.get(placeId)!.rowNumber,
        histories.get(placeId)!,
      );
    }
    await this.writeScanHistories(
      rowUpdates,
      scanHistoryColumn,
      headerIndex,
      actorEmail,
      timestamp,
    );

    const after = await this.readTable();
    const beforePlaceIds = rows.map(({ row }) => row.place_id).join("\n");
    const afterPlaceIds = after.rows.map(({ row }) => row.place_id).join("\n");
    const beforeChecksum = createHash("sha256")
      .update(beforePlaceIds)
      .digest("hex");
    const afterChecksum = createHash("sha256")
      .update(afterPlaceIds)
      .digest("hex");
    if (rows.length !== after.rows.length || beforeChecksum !== afterChecksum) {
      throw new Error("Scan-history repair preservation verification failed.");
    }

    return {
      changed: changedPlaceIds.size > 0,
      repaired_report_count: repairs.length,
      changed_place_ids: [...changedPlaceIds],
      row_count_before: rows.length,
      row_count_after: after.rows.length,
      place_id_checksum_before: beforeChecksum,
      place_id_checksum_after: afterChecksum,
      writes_performed: changedPlaceIds.size > 0,
    };
  }

  async reserveScanSubmission(
    reservation: SabScanSubmissionReservation,
    actorEmail: string,
  ) {
    const { headers, headerIndex, rows } = await this.readTable();
    const target = rows.find(
      ({ row }) => row.place_id === reservation.place_id,
    );
    if (!target) {
      throw new Error(
        `No SAB company found for place_id ${reservation.place_id}`,
      );
    }
    const histories = rows.map((item) => ({
      ...item,
      history: this.parsedScanHistory(item.row),
    }));
    const existing = histories.flatMap(({ row, history }) =>
      history.flatMap((entry) =>
        entry.record_type === "scan_submission" &&
        entry.idempotency_key === reservation.idempotency_key
          ? [{ place_id: row.place_id, entry }]
          : [],
      ),
    )[0];
    if (existing) {
      return {
        created: false,
        place_id: existing.place_id,
        entry: existing.entry,
      };
    }
    const changedEnvelope = histories.flatMap(({ row, history }) =>
      history.flatMap((entry) =>
        entry.record_type === "scan_submission" &&
        entry.authorization_id === reservation.authorization_id &&
        entry.place_id === reservation.place_id &&
        entry.idempotency_key !== reservation.idempotency_key
          ? [{ place_id: row.place_id, entry }]
          : [],
      ),
    )[0];
    if (changedEnvelope) {
      throw new Error(
        `Authorization ${reservation.authorization_id} already has a different durable scan envelope for ${reservation.place_id}; changed parameters require a new orchestrator batch authorization.`,
      );
    }
    const active = histories.flatMap(({ row, history }) =>
      history.flatMap((entry) =>
        entry.record_type === "scan_submission" &&
        ["preparing_location", "submitting"].includes(
          String(entry.submission_status),
        )
          ? [{ place_id: row.place_id, entry }]
          : [],
      ),
    );
    if (active.length > 0) {
      throw new Error(
        `Another SAB scan submission is unresolved for ${active[0].place_id}; no concurrent paid scan is permitted.`,
      );
    }

    const timestamp = new Date().toISOString();
    const history = this.parsedScanHistory(target.row);
    const entry = {
      record_type: "scan_submission",
      submission_status: "preparing_location",
      ...reservation,
      created_at: timestamp,
      created_by: actorEmail,
    };
    history.push(entry);
    const scanHistoryColumn = await this.ensureScanHistoryColumn(
      headers,
      headerIndex,
    );
    await this.writeScanHistories(
      new Map([[target.rowNumber, history]]),
      scanHistoryColumn,
      headerIndex,
      actorEmail,
      timestamp,
    );
    return { created: true, place_id: reservation.place_id, entry };
  }

  async updateScanSubmission(
    placeId: string,
    idempotencyKey: string,
    updates: Record<string, unknown>,
    actorEmail: string,
  ) {
    const { headers, headerIndex, rows } = await this.readTable();
    const target = rows.find(({ row }) => row.place_id === placeId);
    if (!target)
      throw new Error(`No SAB company found for place_id ${placeId}`);
    const history = this.parsedScanHistory(target.row);
    const index = history.findIndex(
      (entry) =>
        entry.record_type === "scan_submission" &&
        entry.idempotency_key === idempotencyKey,
    );
    if (index < 0)
      throw new Error(
        "No matching durable scan-submission reservation exists.",
      );
    const timestamp = new Date().toISOString();
    history[index] = {
      ...history[index],
      ...updates,
      updated_at: timestamp,
      updated_by: actorEmail,
    };
    const scanHistoryColumn = await this.ensureScanHistoryColumn(
      headers,
      headerIndex,
    );
    await this.writeScanHistories(
      new Map([[target.rowNumber, history]]),
      scanHistoryColumn,
      headerIndex,
      actorEmail,
      timestamp,
    );
    return history[index];
  }

  async saveScanResult(
    placeId: string,
    scanResult: SabScanResult,
    actorEmail: string,
    options: { historyOnly?: boolean } = {},
  ) {
    const { headers, headerIndex, rows } = await this.readTable();
    const match = rows.find(({ row }) => row.place_id === placeId);
    if (!match) throw new Error(`No SAB company found for place_id ${placeId}`);

    let scanHistoryColumn = headerIndex.get("scan_history") ?? -1;
    if (scanHistoryColumn < 0) {
      scanHistoryColumn = headers.length;
      await this.client.updateValues(this.spreadsheetId, [
        {
          range: `${quoteSheetName(this.sheetName)}!${columnName(scanHistoryColumn)}1`,
          value: "scan_history",
        },
      ]);
    }

    const timestamp = new Date().toISOString();
    const parsedHistory = parseJsonValue(match.row.scan_history);
    const history = Array.isArray(parsedHistory)
      ? parsedHistory.filter((entry) => entry && typeof entry === "object")
      : [];

    const isVoided = history.some((entry) => {
      const candidate = entry as Record<string, unknown>;
      return (
        candidate.record_type === "scan_reconciliation" &&
        candidate.disposition === "void_excess_duplicate" &&
        candidate.voided_report_key === scanResult.report_key
      );
    });
    if (isVoided) {
      throw new Error(
        `Report ${scanResult.report_key} is recorded as an excess duplicate and cannot be saved as a scan result.`,
      );
    }

    if (
      scanResult.scan_role === "deliverable" &&
      !match.row.report_key &&
      match.row.scan_center &&
      match.row.center_type &&
      scanResult.scan_center &&
      scanResult.center_type
    ) {
      const plannedCenterAlreadyArchived = history.some((entry) => {
        const candidate = entry as Record<string, unknown>;
        return (
          candidate.record_type === "center_plan" &&
          candidate.scan_center === match.row.scan_center &&
          candidate.center_type === match.row.center_type &&
          candidate.resolved_by_report_key === scanResult.report_key
        );
      });
      if (!plannedCenterAlreadyArchived) {
        history.push({
          record_type: "center_plan",
          scan_center: match.row.scan_center,
          center_type: match.row.center_type,
          disposition:
            sameScanCenter(scanResult.scan_center, match.row.scan_center) &&
            scanResult.center_type === match.row.center_type
              ? "confirmed_by_scan"
              : "superseded_by_scan",
          resolved_by_report_key: scanResult.report_key,
          saved_at: match.row.updated_at || null,
          saved_by: match.row.updated_by || null,
        });
      }
    }

    if (
      history.length === 0 &&
      match.row.report_key &&
      match.row.report_key !== scanResult.report_key
    ) {
      history.push({
        scan_role: "source",
        scan_type: "master",
        arp: match.row.arp || null,
        solv: match.row.solv || null,
        found_in: match.row.found_in || null,
        scan_center: match.row.scan_center || null,
        report_key: match.row.report_key,
        report_url: match.row.report_url || null,
        center_type: match.row.center_type || null,
        scan_date: match.row.scan_date || null,
        scan_keyword: match.row.scan_keyword || null,
        saved_at: match.row.updated_at || null,
        saved_by: match.row.updated_by || null,
      });
    }

    const historyEntry = {
      ...scanResult,
      saved_at: timestamp,
      saved_by: actorEmail,
    };
    const existingHistoryIndex = history.findIndex(
      (entry) =>
        !(entry as { record_type?: unknown }).record_type &&
        (entry as { report_key?: unknown }).report_key === scanResult.report_key,
    );
    if (existingHistoryIndex >= 0) {
      history[existingHistoryIndex] = {
        ...historyEntry,
        saved_at:
          (history[existingHistoryIndex] as { saved_at?: unknown }).saved_at ||
          timestamp,
      };
    } else {
      history.push(historyEntry);
    }

    const valuesToWrite: Partial<Record<SabHeader, unknown>> = {
      scan_history: history,
      updated_at: timestamp,
      updated_by: actorEmail,
    };
    if (scanResult.scan_role === "deliverable" && !options.historyOnly) {
      if (scanResult.center_type === "master_edge_offset") throw new Error("An auxiliary offset cannot be a deliverable center");
      Object.assign(valuesToWrite, {
        arp: scanResult.arp,
        solv: scanResult.solv,
        report_key: scanResult.report_key,
        report_url: scanResult.report_url,
        scan_date: scanResult.scan_date,
        scan_keyword: scanResult.scan_keyword,
      });
      if (scanResult.found_in !== undefined)
        valuesToWrite.found_in = scanResult.found_in;
      if (scanResult.scan_center !== undefined)
        valuesToWrite.scan_center = scanResult.scan_center;
      if (scanResult.center_type !== undefined)
        valuesToWrite.center_type = scanResult.center_type;
      if (scanResult.scan_spec !== undefined) valuesToWrite.scan_spec = scanResult.scan_spec;
      if ((headerIndex.get("outcome") ?? -1) >= 0) valuesToWrite.outcome = "deliverable";
    }

    const cellUpdates = Object.entries(valuesToWrite).map(([key, value]) => {
      const header = key as SabHeader;
      const index =
        header === "scan_history" ? scanHistoryColumn : headerIndex.get(header);
      if (index === undefined || index < 0) {
        throw new Error(`SAB sheet cannot store scan field: ${key}`);
      }
      return {
        range: `${quoteSheetName(this.sheetName)}!${columnName(index)}${match.rowNumber}`,
        value: serializeValue(header, value),
      };
    });

    await this.client.updateValues(this.spreadsheetId, cellUpdates);

    return {
      place_id: placeId,
      company: match.row.company,
      scan_role: scanResult.scan_role,
      scan_type: scanResult.scan_type,
      report_key: scanResult.report_key,
      current_scan_updated: scanResult.scan_role === "deliverable" && !options.historyOnly,
      scan_history_count: history.length,
      updated_at: timestamp,
    };
  }

  async markBlocked(placeId: string, reason: string, actorEmail: string) {
    return this.saveCompany(
      placeId,
      { status: "blocked", blocker: reason },
      actorEmail,
    );
  }

  async getProgress(batchId?: string) {
    const { rows } = await this.readTable();
    const selected = rows.filter(
      ({ row }) => !batchId || row.batch_id === batchId,
    );
    const grouped = new Map<string, Record<string, number>>();

    for (const { row } of selected) {
      const batch = row.batch_id || "unassigned";
      const current = grouped.get(batch) ?? { total: 0 };
      current.total += 1;
      current[row.status || "blank"] =
        (current[row.status || "blank"] ?? 0) + 1;
      grouped.set(batch, current);
    }

    return Object.fromEntries(
      [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)),
    );
  }

  private validateCompleteRow(row: SabRow) {
    const missing: string[] = [];

    if (!FINAL_QUALIFICATION_STATUSES.has(row.qualification_status)) {
      missing.push(
        "qualification_status (must be qualified, disqualified, or deferred)",
      );
    }

    const isReasonedDisqualification =
      row.qualification_status === "disqualified" &&
      row.research_notes.trim().length > 0;

    if (isReasonedDisqualification) {
      return;
    }

    if (row.qualification_status === "qualified") {
      missing.push(
        ...["address", "city", "state", "zip"].filter(
          (header) => !row[header as SabHeader],
        ),
      );
    } else if (
      FINAL_QUALIFICATION_STATUSES.has(row.qualification_status) &&
      !row.research_notes.trim()
    ) {
      missing.push("research_notes (qualification reason required)");
    }

    const reviews = parseJsonArray(row.reviews_analysis);
    if (!reviews || reviews.length < 3 || reviews.length > 6) {
      missing.push("reviews_analysis (3–6 findings)");
    }

    const hasWebsite = row.has_website.trim().toLowerCase() === "true";
    if (hasWebsite) {
      const website = parseJsonArray(row.website_analysis);
      if (!row.website) missing.push("website");
      if (row.service_page_count === "") missing.push("service_page_count");
      if (!website || website.length < 3 || website.length > 6) {
        missing.push("website_analysis (3–6 findings)");
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Cannot mark company complete; missing or invalid: ${[...new Set(missing)].join(", ")}`,
      );
    }
  }

  private validateScaleFirstQaReadyRow(row: SabRow) {
    const missing: string[] = [];
    const requireValue = (header: SabHeader) => {
      if (!row[header].trim()) missing.push(header);
    };

    const crmOnly = row.outcome === "no_visibility_core_found";
    for (const header of [
      "batch_id",
      "company",
      "place_id",
      "city",
      "state",
      "zip",
      "scan_keyword",
      "rating",
      "review_count",
      "contact_tag",
    ] as const) {
      requireValue(header);
    }

    if (crmOnly) {
      const market = sabMarketReferenceSchema.safeParse(parseJsonValue(row.market_reference));
      const decision = sabDecisionStateSchema.safeParse(parseJsonValue(row.decision_state));
      if (!market.success) missing.push("market_reference (verified auxiliary market reference required)");
      else if (["city", "state", "zip"].some(key => row[key as SabHeader] !== market.data[key as "city"|"state"|"zip"])) {
        missing.push("city/state/zip must match labelled market_reference");
      }
      if (!decision.success || decision.data.outcome !== "no_visibility_core_found" ||
          decision.data.centering_status !== "market_reference_only" || decision.data.evidence?.exact_top20_count !== 0 ||
          (market.success && decision.data.source_report_key !== market.data.auxiliary_report_key)) {
        missing.push("decision_state (completed no-visibility auxiliary evidence required)");
      }
      for (const header of ["report_key", "report_url", "scan_date", "arp", "solv", "scan_center", "center_type", "scan_spec"] as const) {
        if (row[header].trim()) missing.push(`${header} (must be empty for CRM-only no-visibility lead)`);
      }
    } else {
      for (const header of ["report_key", "report_url", "scan_date", "arp", "solv", "scan_center", "center_type"] as const) requireValue(header);
      const state = sabDecisionStateSchema.safeParse(parseJsonValue(row.decision_state));
      if (row.outcome !== "deliverable" || !state.success || state.data.centering_status !== "validated" || state.data.outcome !== "deliverable" || row.market_reference.trim() || state.data.source_report_key !== row.report_key || state.data.proposed_center !== row.scan_center || state.data.center_type !== row.center_type) missing.push("decision_state (validated canonical report and center required)");
      if (!sabEffectiveScanSpecSchema.safeParse(parseJsonValue(row.scan_spec)).success) missing.push("scan_spec (actual canonical radius required)");
    }

    const eligibility = sabEligibilityStateSchema.safeParse(parseJsonValue(row.eligibility_state));
    if (!eligibility.success) missing.push("eligibility_state (verified general eligibility and contacts required)");
    else {
      const research = eligibility.data.contact_research;
      if (!research) missing.push("contact_research (structured verified-email or exhaustion evidence required)");
      else if (row.contact_tag === "Email Ready" && (research.result !== "verified_email" ||
        !research.accepted_evidence.some(evidence => evidence.email.toLowerCase() === row.email.trim().toLowerCase()))) {
        missing.push("contact_research (accepted evidence must match Email Ready address)");
      } else if (row.contact_tag === "Needs Email" && research.result !== "exhausted") {
        missing.push("contact_research (Needs Email requires completed path exhaustion)");
      }
    }
    if (row.business_profile.trim()) {
      const profile = sabBusinessProfileSchema.safeParse(parseJsonValue(row.business_profile));
      if (!profile.success) missing.push("business_profile (invalid compact enrichment)");
      else missing.push(...sabBusinessProfileIssues(profile.data, row.place_id, row.phone));
    }
    if (row.qualification_status !== "qualified") {
      missing.push("qualification_status (must be qualified)");
    }
    if (row.address !== SAB_ADDRESS_LABEL) {
      missing.push(`address (must be exactly ${SAB_ADDRESS_LABEL})`);
    }
    if (
      !SCALE_FIRST_CONTACT_TAGS.includes(
        row.contact_tag as (typeof SCALE_FIRST_CONTACT_TAGS)[number],
      )
    ) {
      missing.push("contact_tag (must be Email Ready or Needs Email)");
    }
    if (row.contact_tag === "Email Ready" && !row.email.trim()) {
      missing.push("email (required for Email Ready)");
    }
    if (row.contact_tag === "Needs Email" && (!row.phone.trim() || row.email.trim())) {
      missing.push("Needs Email requires a verified phone and no email");
    }
    if (!row.phone.trim() && !row.email.trim()) missing.push("at least one verified contact method");
    if (row.state && !/^[A-Za-z]{2}$/.test(row.state)) {
      missing.push("state (must be a two-letter state code)");
    }
    for (const [header, minimum, maximum] of [
      ["arp", 0, Number.POSITIVE_INFINITY],
      ["solv", 0, 100],
      ["rating", 4.5, 5],
      ["review_count", 1, Number.POSITIVE_INFINITY],
    ] as const) {
      if (!row[header]) continue;
      const value = Number(row[header]);
      if (!Number.isFinite(value) || value < minimum || value > maximum) {
        missing.push(`${header} (invalid value)`);
      }
      if (header === "review_count" && !Number.isInteger(value)) {
        missing.push("review_count (must be an integer)");
      }
    }
    for (const header of ["report_url", "google_maps_url"] as const) {
      if (!row[header]) continue;
      try {
        new URL(row[header]);
      } catch {
        missing.push(`${header} (must be a valid URL)`);
      }
    }
    if (row.scan_date && Number.isNaN(new Date(row.scan_date).getTime())) {
      missing.push("scan_date (must be a valid date)");
    }

    if (missing.length > 0) {
      throw new Error(
        `Cannot mark Scale-First company qa_ready; missing or invalid: ${[...new Set(missing)].join(", ")}`,
      );
    }
  }
}

export function spreadsheetIdFromReference(reference: string) {
  const trimmed = reference.trim();
  const rawIdPattern = /^[A-Za-z0-9_-]{10,}$/;
  if (rawIdPattern.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(
      "workflow_sheet must be a Google Sheets URL or spreadsheet ID",
    );
  }

  if (url.hostname !== "docs.google.com") {
    throw new Error(
      "workflow_sheet must use a docs.google.com Google Sheets URL",
    );
  }

  const match = url.pathname.match(
    /^\/spreadsheets\/d\/([A-Za-z0-9_-]{10,})(?:\/|$)/,
  );
  if (!match) {
    throw new Error(
      "workflow_sheet URL does not contain a valid Google Sheets spreadsheet ID",
    );
  }

  return match[1];
}

export type SabSheetsRepositoryFactory = (
  workflowSheet: string,
  sheetName: string,
) => SabSheetsRepository;

function createGoogleSheetsValuesClientFromEnv() {
  const oauthClient = process.env.GOOGLE_OAUTH_CLIENT_JSON;
  const oauthRefreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  const serviceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (oauthClient && oauthRefreshToken) {
    return new GoogleSheetsValuesClient(oauthClient, oauthRefreshToken);
  }
  if (serviceAccount) {
    return new GoogleSheetsValuesClient(serviceAccount, undefined);
  }
  throw new Error(
    "Google Sheets credentials are not configured; set OAuth client credentials and refresh token",
  );
}

export function createSabSheetsRepositoryFactoryFromEnv(): SabSheetsRepositoryFactory {
  const sheetsClient = createGoogleSheetsValuesClientFromEnv();

  return (workflowSheet, sheetName) =>
    new SabSheetsRepository(
      sheetsClient,
      spreadsheetIdFromReference(workflowSheet),
      sheetName,
    );
}

export function createSabWorkflowCreatorFromEnv(): SabWorkflowCreator {
  return createGoogleSheetsValuesClientFromEnv();
}

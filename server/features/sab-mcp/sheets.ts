import { GoogleAuth, OAuth2Client } from "google-auth-library";
import {
  SAB_HEADERS,
  SAB_REQUIRED_HEADERS,
  type SabCompanyUpdates,
  type SabHeader,
  type SabRow,
  type SabScanResult,
  type SabWorkflowRowInput,
} from "./schema";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const DEFAULT_SHEET_NAME = "SAB Workflow";
const COMPLETE_STATUSES = new Set(["complete", "qa_ready", "imported"]);
const FINAL_QUALIFICATION_STATUSES = new Set(["qualified", "disqualified", "deferred"]);
const NULLABLE_JSON_HEADERS = new Set<SabHeader>(["website_analysis"]);
const JSON_HEADERS = new Set<SabHeader>([
  "competitors",
  "scan_history",
  "website_analysis",
  "reviews_analysis",
]);
const BOOLEAN_HEADERS = new Set<SabHeader>(["has_website"]);

export interface SheetsValuesClient {
  getValues(spreadsheetId: string, range: string): Promise<string[][]>;
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

function parseServiceAccountCredentials(raw: string): ServiceAccountCredentials {
  const credentials = JSON.parse(
    decodeCredentialsJson(raw),
  ) as Partial<ServiceAccountCredentials>;

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email or private_key");
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
    throw new Error("GOOGLE_OAUTH_CLIENT_JSON is missing client_id or client_secret");
  }

  return credentials as OAuthClientCredentials;
}

function quoteSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

export class GoogleSheetsValuesClient implements SheetsValuesClient, SabWorkflowCreator {
  private readonly auth: GoogleAuth | OAuth2Client;

  constructor(
    credentialsJson: string,
    refreshToken?: string,
  ) {
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
    return this.auth instanceof GoogleAuth
      ? this.auth.getClient()
      : this.auth;
  }

  async getValues(spreadsheetId: string, range: string): Promise<string[][]> {
    const client = await this.getClient();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
    const response = await client.request<{ values?: Array<Array<string | number | boolean>> }>({
      url,
      method: "GET",
      params: { valueRenderOption: "FORMATTED_VALUE" },
    });

    return (response.data.values ?? []).map((row) => row.map((value) => String(value)));
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
      ...completeRows.map((row) => SAB_HEADERS.map((header) => (
        serializeValue(header, row[header as keyof typeof row])
      ))),
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
        sheets: [{
          properties: {
            title: DEFAULT_SHEET_NAME,
            gridProperties: {
              rowCount: Math.max(1_000, tableValues.length),
              columnCount: SAB_HEADERS.length,
            },
          },
          data: [{
            startRow: 0,
            startColumn: 0,
            rowData: tableValues.map((values) => ({
              values: values.map((value) => ({
                userEnteredValue: sheetsCellValue(value),
              })),
            })),
          }],
        }],
      },
    });

    const spreadsheetId = createResponse.data.spreadsheetId;
    if (!spreadsheetId) throw new Error("Google Sheets did not return a spreadsheet ID");

    const expectedLastColumn = columnName(SAB_HEADERS.length - 1);
    const readback = await this.getValues(
      spreadsheetId,
      `${quoteSheetName(DEFAULT_SHEET_NAME)}!A1:${expectedLastColumn}${rows.length + 1}`,
    );
    const actualHeaders = readback[0] ?? [];
    if (
      actualHeaders.length !== SAB_HEADERS.length
      || SAB_HEADERS.some((header, index) => actualHeaders[index] !== header)
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
    const confirmedCount = Object.values(progress)
      .reduce((sum, batch) => sum + (batch.total ?? 0), 0);
    if (confirmedCount !== rows.length) {
      throw new Error(
        `Created Workflow Sheet failed progress validation: expected ${rows.length}, confirmed ${confirmedCount}`,
      );
    }

    return {
      workflow_sheet: createResponse.data.spreadsheetUrl
        || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
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
      throw new Error(`Duplicate place_id in Workflow Sheet roster: ${row.place_id}`);
    }
    placeIds.add(row.place_id);

    const positionKey = `${row.batch_id}:${row.batch_position}`;
    if (batchPositions.has(positionKey)) {
      throw new Error(`Duplicate batch position in Workflow Sheet roster: ${positionKey}`);
    }
    batchPositions.add(positionKey);
  }
}

function serializeValue(header: SabHeader, value: unknown): string | number | boolean {
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
    competitors: Array.isArray(competitors) ? competitors.map(String) : row.competitors,
    scan_history: Array.isArray(scanHistory) ? scanHistory : [],
    has_website: row.has_website
      ? row.has_website.trim().toLowerCase() === "true"
      : null,
    service_page_count: row.service_page_count ? Number(row.service_page_count) : null,
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
    const missing = SAB_REQUIRED_HEADERS.filter((header) => !headers.includes(header));
    if (missing.length > 0) {
      throw new Error(`SAB sheet is missing required headers: ${missing.join(", ")}`);
    }

    const headerIndex = new Map(
      SAB_HEADERS.map((header) => [header, headers.indexOf(header)]),
    );
    const rows = values.slice(1)
      .map((valuesRow, offset) => {
        const row = Object.fromEntries(
          SAB_HEADERS.map((header) => {
            const index = headerIndex.get(header) ?? -1;
            return [header, index >= 0 ? valuesRow[index] ?? "" : ""];
          }),
        ) as SabRow;
        return { rowNumber: offset + 2, row };
      })
      .filter(({ row }) => row.place_id || row.company);

    return { headers, headerIndex, rows };
  }

  async getBatch(batchId: string, includeCompleted = false) {
    const { rows } = await this.readTable();
    return rows
      .filter(({ row }) => row.batch_id === batchId)
      .filter(({ row }) => includeCompleted || !COMPLETE_STATUSES.has(row.status))
      .sort((a, b) => Number(a.row.batch_position) - Number(b.row.batch_position))
      .map(({ row }) => publicRow(row));
  }

  async getCompany(placeId: string) {
    const { rows } = await this.readTable();
    const match = rows.find(({ row }) => row.place_id === placeId);
    if (!match) throw new Error(`No SAB company found for place_id ${placeId}`);
    return publicRow(match.row);
  }

  async saveCompany(placeId: string, updates: SabCompanyUpdates, actorEmail: string) {
    const { headers, headerIndex, rows } = await this.readTable();
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

    if (updates.status && COMPLETE_STATUSES.has(updates.status)) {
      this.validateCompleteRow(merged);
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
      if (index === undefined) throw new Error(`Unsupported SAB field: ${key}`);
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
    };
  }

  async saveScanResult(
    placeId: string,
    scanResult: SabScanResult,
    actorEmail: string,
  ) {
    const { headers, headerIndex, rows } = await this.readTable();
    const match = rows.find(({ row }) => row.place_id === placeId);
    if (!match) throw new Error(`No SAB company found for place_id ${placeId}`);

    let scanHistoryColumn = headerIndex.get("scan_history") ?? -1;
    if (scanHistoryColumn < 0) {
      scanHistoryColumn = headers.length;
      await this.client.updateValues(this.spreadsheetId, [{
        range: `${quoteSheetName(this.sheetName)}!${columnName(scanHistoryColumn)}1`,
        value: "scan_history",
      }]);
    }

    const timestamp = new Date().toISOString();
    const parsedHistory = parseJsonValue(match.row.scan_history);
    const history = Array.isArray(parsedHistory)
      ? parsedHistory.filter((entry) => entry && typeof entry === "object")
      : [];

    if (
      history.length === 0
      && match.row.report_key
      && match.row.report_key !== scanResult.report_key
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
        competitors: parseJsonValue(match.row.competitors) || match.row.competitors || [],
        saved_at: match.row.updated_at || null,
        saved_by: match.row.updated_by || null,
      });
    }

    const historyEntry = {
      ...scanResult,
      saved_at: timestamp,
      saved_by: actorEmail,
    };
    const existingHistoryIndex = history.findIndex((entry) => (
      (entry as { report_key?: unknown }).report_key === scanResult.report_key
    ));
    if (existingHistoryIndex >= 0) {
      history[existingHistoryIndex] = {
        ...historyEntry,
        saved_at: (history[existingHistoryIndex] as { saved_at?: unknown }).saved_at || timestamp,
      };
    } else {
      history.push(historyEntry);
    }

    const valuesToWrite: Partial<Record<SabHeader, unknown>> = {
      scan_history: history,
      updated_at: timestamp,
      updated_by: actorEmail,
    };
    if (scanResult.scan_role === "deliverable") {
      Object.assign(valuesToWrite, {
        arp: scanResult.arp,
        solv: scanResult.solv,
        found_in: scanResult.found_in,
        scan_center: scanResult.scan_center,
        report_key: scanResult.report_key,
        report_url: scanResult.report_url,
        center_type: scanResult.center_type,
        scan_date: scanResult.scan_date,
        scan_keyword: scanResult.scan_keyword,
        competitors: scanResult.competitors,
      });
    }

    const cellUpdates = Object.entries(valuesToWrite).map(([key, value]) => {
      const header = key as SabHeader;
      const index = header === "scan_history"
        ? scanHistoryColumn
        : headerIndex.get(header);
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
      current_scan_updated: scanResult.scan_role === "deliverable",
      scan_history_count: history.length,
      updated_at: timestamp,
    };
  }

  async markBlocked(placeId: string, reason: string, actorEmail: string) {
    return this.saveCompany(placeId, { status: "blocked", blocker: reason }, actorEmail);
  }

  async getProgress(batchId?: string) {
    const { rows } = await this.readTable();
    const selected = rows.filter(({ row }) => !batchId || row.batch_id === batchId);
    const grouped = new Map<string, Record<string, number>>();

    for (const { row } of selected) {
      const batch = row.batch_id || "unassigned";
      const current = grouped.get(batch) ?? { total: 0 };
      current.total += 1;
      current[row.status || "blank"] = (current[row.status || "blank"] ?? 0) + 1;
      grouped.set(batch, current);
    }

    return Object.fromEntries([...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }

  private validateCompleteRow(row: SabRow) {
    const missing = ["reviews_analysis"]
      .filter((header) => !row[header as SabHeader]);

    if (!FINAL_QUALIFICATION_STATUSES.has(row.qualification_status)) {
      missing.push("qualification_status (must be qualified, disqualified, or deferred)");
    }

    if (row.qualification_status === "qualified") {
      missing.push(
        ...["address", "city", "state", "zip"]
          .filter((header) => !row[header as SabHeader]),
      );
    } else if (
      FINAL_QUALIFICATION_STATUSES.has(row.qualification_status)
      && !row.research_notes.trim()
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
      throw new Error(`Cannot mark company complete; missing or invalid: ${[...new Set(missing)].join(", ")}`);
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
    throw new Error("workflow_sheet must be a Google Sheets URL or spreadsheet ID");
  }

  if (url.hostname !== "docs.google.com") {
    throw new Error("workflow_sheet must use a docs.google.com Google Sheets URL");
  }

  const match = url.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]{10,})(?:\/|$)/);
  if (!match) {
    throw new Error("workflow_sheet URL does not contain a valid Google Sheets spreadsheet ID");
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
    return new GoogleSheetsValuesClient(
      oauthClient,
      oauthRefreshToken,
    );
  }
  if (serviceAccount) {
    return new GoogleSheetsValuesClient(
      serviceAccount,
      undefined,
    );
  }
  throw new Error(
    "Google Sheets credentials are not configured; set OAuth client credentials and refresh token",
  );
}

export function createSabSheetsRepositoryFactoryFromEnv(): SabSheetsRepositoryFactory {
  const sheetsClient = createGoogleSheetsValuesClientFromEnv();

  return (workflowSheet, sheetName) => new SabSheetsRepository(
    sheetsClient,
    spreadsheetIdFromReference(workflowSheet),
    sheetName,
  );
}

export function createSabWorkflowCreatorFromEnv(): SabWorkflowCreator {
  return createGoogleSheetsValuesClientFromEnv();
}

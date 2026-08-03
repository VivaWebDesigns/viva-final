import { GoogleAuth } from "google-auth-library";
import {
  SAB_HEADERS,
  type SabCompanyUpdates,
  type SabHeader,
  type SabRow,
} from "./schema";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const COMPLETE_STATUSES = new Set(["complete", "qa_ready", "imported"]);
const NULLABLE_JSON_HEADERS = new Set<SabHeader>(["website_analysis"]);
const JSON_HEADERS = new Set<SabHeader>(["website_analysis", "reviews_analysis"]);
const BOOLEAN_HEADERS = new Set<SabHeader>(["has_website"]);

export interface SheetsValuesClient {
  getValues(spreadsheetId: string, range: string): Promise<string[][]>;
  updateValues(
    spreadsheetId: string,
    updates: Array<{ range: string; value: string | number | boolean }>,
  ): Promise<void>;
}

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

function parseServiceAccountCredentials(raw: string): ServiceAccountCredentials {
  const trimmed = raw.trim();
  const decoded = trimmed.startsWith("{")
    ? trimmed
    : Buffer.from(trimmed, "base64").toString("utf8");
  const credentials = JSON.parse(decoded) as Partial<ServiceAccountCredentials>;

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email or private_key");
  }

  return credentials as ServiceAccountCredentials;
}

function quoteSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

export class GoogleSheetsValuesClient implements SheetsValuesClient {
  private readonly auth: GoogleAuth;

  constructor(credentialsJson: string) {
    this.auth = new GoogleAuth({
      credentials: parseServiceAccountCredentials(credentialsJson),
      scopes: [SHEETS_SCOPE],
    });
  }

  async getValues(spreadsheetId: string, range: string): Promise<string[][]> {
    const client = await this.auth.getClient();
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

    const client = await this.auth.getClient();
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

function serializeValue(header: SabHeader, value: unknown): string | number | boolean {
  if (value === null || value === undefined) {
    return NULLABLE_JSON_HEADERS.has(header) ? "null" : "";
  }
  if (JSON_HEADERS.has(header)) return JSON.stringify(value);
  if (BOOLEAN_HEADERS.has(header)) return value ? "TRUE" : "FALSE";
  return value as string | number | boolean;
}

function parseJsonArray(value: string): string[] | null {
  if (!value || value === "null") return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}

function publicRow(row: SabRow) {
  return {
    ...row,
    has_website: row.has_website
      ? row.has_website.trim().toLowerCase() === "true"
      : null,
    service_page_count: row.service_page_count ? Number(row.service_page_count) : null,
    website_analysis: parseJsonArray(row.website_analysis),
    reviews_analysis: parseJsonArray(row.reviews_analysis),
    rating: row.rating ? Number(row.rating) : null,
    review_count: row.review_count ? Number(row.review_count) : null,
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
    const missing = SAB_HEADERS.filter((header) => !headers.includes(header));
    if (missing.length > 0) {
      throw new Error(`SAB sheet is missing required headers: ${missing.join(", ")}`);
    }

    const headerIndex = new Map(
      SAB_HEADERS.map((header) => [header, headers.indexOf(header)]),
    );
    const rows = values.slice(1)
      .map((valuesRow, offset) => {
        const row = Object.fromEntries(
          SAB_HEADERS.map((header) => [header, valuesRow[headerIndex.get(header)!] ?? ""]),
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
    const missing = ["address", "city", "state", "zip", "reviews_analysis"]
      .filter((header) => !row[header as SabHeader]);

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

export function createSabSheetsRepositoryFromEnv() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const spreadsheetId = process.env.SAB_SHEET_ID;
  const sheetName = process.env.SAB_SHEET_TAB || "SAB Workflow";

  if (!credentials) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured");
  if (!spreadsheetId) throw new Error("SAB_SHEET_ID is not configured");

  return new SabSheetsRepository(
    new GoogleSheetsValuesClient(credentials),
    spreadsheetId,
    sheetName,
  );
}

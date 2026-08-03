import { describe, expect, it } from "vitest";
import { SAB_HEADERS } from "../../server/features/sab-mcp/schema";
import {
  SabSheetsRepository,
  type SheetsValuesClient,
} from "../../server/features/sab-mcp/sheets";

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

  it("rejects complete status until the CRM qualification gate is set", async () => {
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

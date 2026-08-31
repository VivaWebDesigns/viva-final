import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { localFalconCrmOnlyProspects } from "../../shared/schema";

const migration = readFileSync("script/sql/local-falcon-crm-only-additive.sql", "utf8");
const verification = readFileSync("script/sql/local-falcon-crm-only-verify.sql", "utf8");

describe("explicit CRM-only additive deployment SQL", () => {
  it("creates only the new table and its indexes, with columns matching the checked-in schema", () => {
    const schema = getTableConfig(localFalconCrmOnlyProspects);
    expect(migration).not.toMatch(/\b(?:DROP|DELETE|UPDATE|TRUNCATE|ALTER)\s+(?:TABLE|FROM|public\.)/i);
    expect([...migration.matchAll(/CREATE TABLE IF NOT EXISTS public\.([a-z_]+)/g)].map((match) => match[1]))
      .toEqual([schema.name]);
    for (const column of schema.columns) {
      expect(migration).toMatch(new RegExp(`\\b${column.name}\\s+${column.getSQLType()}(?:\\s|,)`));
      expect(verification).toContain(`'${column.name}'`);
    }
    for (const foreignKey of schema.foreignKeys) expect(migration).toContain(foreignKey.getName());
    for (const index of schema.indexes) expect(migration).toContain(index.config.name);
    expect(migration).toContain("UNIQUE (place_id)");
    expect(migration).toContain("ON DELETE CASCADE");
    expect(migration).not.toMatch(/^\s+(?:report_key|arp|scan_center_lat)\s/m);
  });

  it("keeps verification read-only and checks identity, provenance, defaults, foreign keys and indexes", () => {
    const statements = verification.replace(/--[^\n]*/g, "");
    expect(statements.trim()).toMatch(/^BEGIN READ ONLY;/);
    expect(statements.replace(/'(?:[^']|'')*'/g, "")).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i);
    for (const check of ["unique:place_id", "foreign_key:lead_id", "foreign_key:batch_record_id", "no_extra_columns", "default:", "index:"]) {
      expect(verification).toContain(check);
    }
  });
});

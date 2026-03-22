#!/usr/bin/env tsx
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function backfillTaskCompanyIds() {
  console.log("[backfill] Starting companyId backfill for followup_tasks...");

  const updated1 = await db.execute(sql`
    UPDATE followup_tasks ft
    SET company_id = l.company_id
    FROM crm_leads l
    WHERE ft.lead_id = l.id
      AND ft.company_id IS NULL
      AND l.company_id IS NOT NULL
  `);
  console.log(`[backfill] Updated tasks from leads: ${updated1.rowCount ?? 0} rows`);

  const updated2 = await db.execute(sql`
    UPDATE followup_tasks ft
    SET company_id = o.company_id
    FROM pipeline_opportunities o
    WHERE ft.opportunity_id = o.id
      AND ft.company_id IS NULL
      AND o.company_id IS NOT NULL
  `);
  console.log(`[backfill] Updated tasks from opportunities: ${updated2.rowCount ?? 0} rows`);

  console.log("[backfill] Done.");
}

backfillTaskCompanyIds()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill] Failed:", err);
    process.exit(1);
  });

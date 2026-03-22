import { db } from "../../db";
import { sql } from "drizzle-orm";

const TAG = "[backfill:task-company-id]";

export async function backfillTaskCompanyIds(): Promise<void> {
  const updated1 = await db.execute(sql`
    UPDATE followup_tasks ft
    SET company_id = l.company_id
    FROM crm_leads l
    WHERE ft.lead_id = l.id
      AND ft.company_id IS NULL
      AND l.company_id IS NOT NULL
  `);
  const count1 = updated1.rowCount ?? 0;
  if (count1 > 0) console.log(`${TAG} backfilled ${count1} tasks from leads`);

  const updated2 = await db.execute(sql`
    UPDATE followup_tasks ft
    SET company_id = o.company_id
    FROM pipeline_opportunities o
    WHERE ft.opportunity_id = o.id
      AND ft.company_id IS NULL
      AND o.company_id IS NOT NULL
  `);
  const count2 = updated2.rowCount ?? 0;
  if (count2 > 0) console.log(`${TAG} backfilled ${count2} tasks from opportunities`);

  if (count1 === 0 && count2 === 0) {
    console.log(`${TAG} no tasks needed backfill`);
  }
}

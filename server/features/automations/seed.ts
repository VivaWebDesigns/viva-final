import { db } from "../../db";
import { stageAutomationTemplates } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { CALL_TASK_TITLE, CALL_TASK_TYPE } from "@shared/callPipeline";

const DEFAULT_TEMPLATES = [
  {
    triggerStageSlug: "new-lead",
    title: CALL_TASK_TITLE,
    description: "Call the lead and record what happened.",
    dueOffsetDays: 0,
    priority: "high" as const,
    taskType: CALL_TASK_TYPE,
    sortOrder: 0,
  },
];

export async function seedAutomationTemplates(): Promise<Record<string, unknown>> {
  let created = 0;
  let skipped = 0;

  for (const tpl of DEFAULT_TEMPLATES) {
    const [existing] = await db
      .select({ id: stageAutomationTemplates.id })
      .from(stageAutomationTemplates)
      .where(
        and(
          eq(stageAutomationTemplates.triggerStageSlug, tpl.triggerStageSlug),
          eq(stageAutomationTemplates.title, tpl.title),
        )
      )
      .limit(1);

    if (existing) {
      skipped++;
      continue;
    }

    await db.insert(stageAutomationTemplates).values({
      ...tpl,
      isActive: true,
    });
    created++;
  }

  return { created, skipped };
}

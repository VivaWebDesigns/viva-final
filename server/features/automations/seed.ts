import { db } from "../../db";
import { stageAutomationTemplates } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const DEFAULT_TEMPLATES = [
  {
    triggerStageSlug: "new-lead",
    title: "Contact lead",
    description: "Reach out to the lead for the first time to introduce Viva Web Designs and qualify their interest.",
    dueOffsetDays: 0,
    priority: "high" as const,
    taskType: "call",
    sortOrder: 0,
  },
  {
    triggerStageSlug: "contacted",
    title: "Schedule demo",
    description: "Follow up with contacted lead to schedule a demo of Viva Web Designs services.",
    dueOffsetDays: 1,
    priority: "medium" as const,
    taskType: "follow_up",
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

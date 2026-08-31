import { and, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { crmLeadNotes, crmLeadTags, followupTasks, scanReportDeliveries } from "@shared/schema";
import type { ReportOutreachFilter } from "@shared/reportOutreach";

export interface SharedLeadFilters {
  tagIds?: string[];
  reportOutreach?: ReportOutreachFilter;
}

/** Shared database-wide lead filters used by CRM, Pipeline, and Tasks. */
export function buildSharedLeadFilterCondition(
  leadId: AnyColumn,
  { tagIds = [], reportOutreach }: SharedLeadFilters,
): SQL | undefined {
  const conditions: SQL[] = [];

  // Match the CRM Leads behavior: every selected tag is required (AND).
  for (const tagId of new Set(tagIds)) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${crmLeadTags} lt
      WHERE lt.lead_id = ${leadId} AND lt.tag_id = ${tagId}
    )`);
  }

  if (!reportOutreach) return conditions.length ? and(...conditions) : undefined;

  const sentCount = sql`(SELECT count(*) FROM ${scanReportDeliveries} d WHERE d.lead_id = ${leadId} AND d.sent_at IS NOT NULL)`;
  const engaged = sql`EXISTS (SELECT 1 FROM ${scanReportDeliveries} d WHERE d.lead_id = ${leadId} AND d.sent_at IS NOT NULL AND (d.view_count > 0 OR d.cta_click_count > 0))`;
  const disposition = sql`coalesce((SELECT n.metadata->>'reportOutreachDisposition' FROM ${crmLeadNotes} n WHERE n.lead_id = ${leadId} AND n.metadata->>'reportOutreachDisposition' IS NOT NULL ORDER BY n.created_at DESC, n.id DESC LIMIT 1), 'active')`;
  const easternToday = sql`(CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date`;
  const followupDue = sql`EXISTS (SELECT 1 FROM ${followupTasks} t WHERE t.lead_id = ${leadId} AND t.completed = false AND t.task_type = 'report_email_followup' AND t.due_date <= ${easternToday})`;
  const openReview = sql`EXISTS (SELECT 1 FROM ${followupTasks} t WHERE t.lead_id = ${leadId} AND t.completed = false AND t.task_type = 'report_email_review')`;
  const reviewDue = sql`EXISTS (SELECT 1 FROM ${followupTasks} t WHERE t.lead_id = ${leadId} AND t.completed = false AND t.task_type = 'report_email_review' AND t.due_date <= ${easternToday})`;

  if (reportOutreach === "report_any") conditions.push(sql`${sentCount} > 0`);
  if (reportOutreach === "one_sent") conditions.push(sql`${sentCount} = 1`);
  if (reportOutreach === "two_sent") conditions.push(sql`${sentCount} >= 2`);
  if (reportOutreach === "engaged") conditions.push(sql`${disposition} = 'active' AND ${engaged}`);
  if (reportOutreach === "needs_attention") conditions.push(sql`${disposition} = 'active' AND (${engaged} OR (${sentCount} = 1 AND ${followupDue}))`);
  if (reportOutreach === "awaiting_response") conditions.push(sql`${disposition} = 'active' AND ${sentCount} >= 2 AND NOT ${engaged} AND ${openReview} AND NOT ${reviewDue}`);
  if (reportOutreach === "no_engagement") conditions.push(sql`(${disposition} = 'no_response') OR (${disposition} = 'active' AND ${sentCount} >= 2 AND NOT ${engaged} AND (${reviewDue} OR NOT ${openReview}))`);
  if (reportOutreach === "stopped") conditions.push(sql`${disposition} IN ('opted_out', 'bounced', 'not_interested')`);

  return and(...conditions);
}

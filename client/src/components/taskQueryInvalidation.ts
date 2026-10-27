import { queryClient } from "@/lib/queryClient";

interface TaskQueryContext {
  opportunityId: string | null;
  leadId: string | null;
  contactId: string | null;
  companyId: string | null;
  isReportTask?: boolean;
}

/** Refreshes every task, lead and pipeline view a completed task can affect. */
export function invalidateTaskQueriesFor({ opportunityId, leadId, contactId, companyId, isReportTask }: TaskQueryContext) {
  queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
  queryClient.invalidateQueries({ queryKey: ["/api/tasks/due-today"] });
  queryClient.invalidateQueries({ queryKey: ["/api/tasks/completed-history"] });
  if (isReportTask) {
    queryClient.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("/api/profiles") || String(q.queryKey[0]).endsWith("/report-outreach") });
  }
  queryClient.invalidateQueries({
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey[0] === "/api/clients" &&
      query.queryKey[2] === "tasks",
  });
  if (opportunityId) {
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/for-opportunity", opportunityId] });
    queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities", opportunityId] });
  }
  queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
  queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities/board"] });
  if (leadId) {
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/for-lead", leadId] });
    queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", leadId] });
  }
  if (contactId) queryClient.invalidateQueries({ queryKey: ["/api/tasks/for-contact", contactId] });
  if (companyId) {
    queryClient.invalidateQueries({ queryKey: ["/api/profiles/company", companyId, "notes"] });
    queryClient.invalidateQueries({ queryKey: ["/api/history/client", companyId] });
  }
}

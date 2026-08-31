import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import CompleteTaskModal from "@/components/CompleteTaskModal";
import { REPORT_DISPOSITION_LABELS } from "@shared/reportOutreach";
import type { FollowupTask } from "@shared/schema";

export function ReportOutreachPanel({ leadId }: { leadId: string }) {
  const [completing, setCompleting] = useState(false);
  const { data, error } = useQuery<{
    sentCount: number; lastSentAt: string | null; disposition: string | null;
    pending: boolean; task: FollowupTask | null; blockedReason: string | null;
  }>({ queryKey: [`/api/crm/leads/${leadId}/report-outreach`], refetchInterval: query => query.state.data?.pending ? 2000 : 30000 });
  const previous = useRef<string>();
  useEffect(() => {
    if (!data) return;
    const key = `${data.sentCount}:${data.disposition}:${data.pending}`;
    if (previous.current && previous.current !== key) {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/due-today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities/board"] });
      queryClient.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("/api/profiles") });
    }
    previous.current = key;
  }, [data]);
  if (error) return <p className="text-sm text-red-600">Could not load report outreach status. Refresh before sending.</p>;
  if (!data) return null;
  return <div className="mb-4 rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm" data-testid="report-outreach-panel">
    <p className="font-semibold">Report outreach · {data.sentCount > 2 ? `${data.sentCount} historical sends (limit: 2)` : `${data.sentCount} of 2 sent`}{data.pending ? " · Email queued" : ""}</p>
    {data.lastSentAt && <p>Last sent: {new Date(data.lastSentAt).toLocaleString()}</p>}
    <p>{data.disposition ? REPORT_DISPOSITION_LABELS[data.disposition] ?? data.disposition : "Send the first report to start outreach."}</p>
    {data.task && !data.task.completed && <p className="mt-1">Next: {data.task.title} · Due {new Date(data.task.dueDate).toLocaleDateString("en-US", { timeZone: "UTC" })}</p>}
    <p className="mt-1 text-slate-600">Check your inbox before following up. Replies and opt-outs must be recorded here; inbox replies are not detected automatically.</p>
    {data.task && <Button className="mt-2" size="sm" variant="outline" onClick={() => setCompleting(true)}>Record reply / outreach outcome</Button>}
    <CompleteTaskModal open={completing} onClose={() => setCompleting(false)} task={data.task}
      onSuccess={() => queryClient.invalidateQueries({ queryKey: [`/api/crm/leads/${leadId}/report-outreach`] })} />
  </div>;
}

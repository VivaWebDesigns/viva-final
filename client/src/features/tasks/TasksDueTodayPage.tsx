import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient, STALE } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Phone, Building2, AlertTriangle, CalendarClock, ExternalLink, Plus } from "lucide-react";
import QuickTaskModal, { formatTaskTimeDisplay } from "@/components/QuickTaskModal";
import type { FollowupTask } from "@shared/schema";
import { useAdminLang } from "@/i18n/LanguageContext";

interface TaskWithContact extends FollowupTask {
  contact: { firstName: string; lastName: string | null; phone: string | null } | null;
  company: { name: string } | null;
}

interface DueTodayData {
  dueToday: TaskWithContact[];
  overdue: TaskWithContact[];
}

function TaskRow({
  task,
  onComplete,
  onReschedule,
  isCompleting,
  tTasks,
}: {
  task: TaskWithContact;
  onComplete: (id: string) => void;
  onReschedule: (task: TaskWithContact) => void;
  isCompleting: boolean;
  tTasks: { markComplete: string; reschedule: string; viewOpportunity: string; viewLead: string };
}) {
  const contactName = task.contact
    ? `${task.contact.firstName}${task.contact.lastName ? " " + task.contact.lastName : ""}`
    : null;

  return (
    <div
      className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0"
      data-testid={`row-task-${task.id}`}
    >
      <button
        className="mt-0.5 flex-shrink-0 text-gray-300 hover:text-[#0D9488] transition-colors disabled:opacity-50"
        onClick={() => onComplete(task.id)}
        disabled={isCompleting}
        data-testid={`button-complete-task-${task.id}`}
        title={tTasks.markComplete}
      >
        <CheckCircle2 className="w-5 h-5" />
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 leading-tight" data-testid={`text-task-title-${task.id}`}>
          {task.title}
        </p>

        {task.notes && (
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{task.notes}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5">
          {contactName && (
            <span className="flex items-center gap-1 text-xs text-gray-500" data-testid={`text-contact-name-${task.id}`}>
              <span className="font-medium">{contactName}</span>
            </span>
          )}
          {task.company && (
            <span className="flex items-center gap-1 text-xs text-gray-500" data-testid={`text-company-name-${task.id}`}>
              <Building2 className="w-3 h-3 flex-shrink-0" />
              {task.company.name}
            </span>
          )}
          {task.contact?.phone && (
            <a
              href={`tel:${task.contact.phone}`}
              className="flex items-center gap-1 text-xs text-[#0D9488] hover:underline"
              data-testid={`link-phone-${task.id}`}
            >
              <Phone className="w-3 h-3 flex-shrink-0" />
              {task.contact.phone}
            </a>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          {task.opportunityId && (
            <Link href={`/admin/pipeline/opportunities/${task.opportunityId}`}>
              <span className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#0D9488] transition-colors">
                <ExternalLink className="w-3 h-3" /> {tTasks.viewOpportunity}
              </span>
            </Link>
          )}
          {task.leadId && (
            <Link href={`/admin/crm/leads/${task.leadId}`}>
              <span className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#0D9488] transition-colors">
                <ExternalLink className="w-3 h-3" /> {tTasks.viewLead}
              </span>
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <span className="text-xs text-gray-400 whitespace-nowrap" data-testid={`text-due-date-${task.id}`}>
          {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}{task.followUpTime ? ` at ${formatTaskTimeDisplay(task.dueDate, task.followUpTime, task.followUpTimezone)}` : ""}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-xs px-2"
          onClick={() => onReschedule(task)}
          data-testid={`button-reschedule-task-${task.id}`}
        >
          <CalendarClock className="w-3 h-3 mr-1" />
          {tTasks.reschedule}
        </Button>
      </div>
    </div>
  );
}

export default function TasksDueTodayPage() {
  const { toast } = useToast();
  const { t } = useAdminLang();
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [rescheduleTask, setRescheduleTask] = useState<TaskWithContact | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);

  const { data, isLoading } = useQuery<DueTodayData>({
    queryKey: ["/api/tasks/due-today"],
    staleTime: STALE.FAST,
    refetchOnWindowFocus: true,
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      setCompletingId(id);
      const res = await apiRequest("PUT", `/api/tasks/${id}/complete`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/due-today"] });
      toast({ title: t.tasks.taskCompleted });
    },
    onError: (err: Error) => {
      toast({ title: t.common.error, description: err.message, variant: "destructive" });
    },
    onSettled: () => setCompletingId(null),
  });

  const dueToday = data?.dueToday ?? [];
  const overdue = data?.overdue ?? [];
  const totalCount = dueToday.length + overdue.length;

  const tTasks = {
    markComplete: t.tasks.markComplete,
    reschedule: t.tasks.reschedule,
    viewOpportunity: t.tasks.viewOpportunity,
    viewLead: t.tasks.viewLead,
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-3xl" data-testid="page-tasks-due-today">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-tasks-title">
            {t.tasks.title}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t.tasks.dueToday}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowNewTask(true)}
          data-testid="button-new-task"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          {t.tasks.scheduleFollowUp}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : totalCount === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="w-12 h-12 text-[#0D9488] mx-auto mb-3 opacity-50" />
            <p className="text-gray-500 font-medium">{t.tasks.allCaughtUp}</p>
            <p className="text-sm text-gray-400 mt-1">{t.tasks.allCaughtUpDesc}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {overdue.length > 0 && (
            <Card className="border-red-200">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold text-red-600 flex items-center gap-2" data-testid="section-overdue">
                  <AlertTriangle className="w-4 h-4" />
                  {t.tasks.overdue}
                  <Badge variant="destructive" className="text-xs">{overdue.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {overdue.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onComplete={(id) => completeMutation.mutate(id)}
                    onReschedule={(tsk) => setRescheduleTask(tsk)}
                    isCompleting={completingId === task.id && completeMutation.isPending}
                    tTasks={tTasks}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {dueToday.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2" data-testid="section-due-today">
                  <Clock className="w-4 h-4 text-[#0D9488]" />
                  {t.tasks.dueToday}
                  <Badge variant="secondary" className="text-xs">{dueToday.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {dueToday.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onComplete={(id) => completeMutation.mutate(id)}
                    onReschedule={(tsk) => setRescheduleTask(tsk)}
                    isCompleting={completingId === task.id && completeMutation.isPending}
                    tTasks={tTasks}
                  />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <QuickTaskModal
        open={!!rescheduleTask}
        onClose={() => setRescheduleTask(null)}
        editTask={rescheduleTask ? {
          id: rescheduleTask.id,
          title: rescheduleTask.title,
          notes: rescheduleTask.notes,
          dueDate: typeof rescheduleTask.dueDate === "string" ? rescheduleTask.dueDate : rescheduleTask.dueDate.toISOString(),
          followUpTime: rescheduleTask.followUpTime ?? null,
          followUpTimezone: rescheduleTask.followUpTimezone ?? null,
        } : null}
        opportunityId={rescheduleTask?.opportunityId}
        leadId={rescheduleTask?.leadId}
        contactId={rescheduleTask?.contactId}
        onSuccess={() => setRescheduleTask(null)}
      />
      <QuickTaskModal
        open={showNewTask}
        onClose={() => setShowNewTask(false)}
        onSuccess={() => setShowNewTask(false)}
      />
    </div>
  );
}

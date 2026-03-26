import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { STALE, apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Clock, Phone, Building2, AlertTriangle, CalendarClock, ExternalLink, Plus, Zap, History, FileText, Trash2 } from "lucide-react";
import { sanitizeHtml } from "@/features/chat/RichTextEditor";
import QuickTaskModal, { formatTaskTimeDisplay } from "@/components/QuickTaskModal";
import CompleteTaskModal from "@/components/CompleteTaskModal";
import DemoCompletedModal from "@/components/DemoCompletedModal";
import PaymentSentModal from "@/components/PaymentSentModal";
import PaymentFollowupModal from "@/components/PaymentFollowupModal";
import type { FollowupTask } from "@shared/schema";
import { useAdminLang } from "@/i18n/LanguageContext";
import { renderTaskTitle } from "@/lib/activityI18n";
import { useAuth } from "@features/auth/useAuth";
import { useToast } from "@/hooks/use-toast";

interface AutomationMeta {
  triggerStageSlug: string;
  templateId: string;
  executedAt: string;
}

interface TaskWithContact extends FollowupTask {
  contact: { firstName: string; lastName: string | null; phone: string | null } | null;
  company: { name: string } | null;
  automationMeta: AutomationMeta | null;
  opportunityStageSlug: string | null;
}

interface DueTodayData {
  dueToday: TaskWithContact[];
  overdue: TaskWithContact[];
  upcoming: TaskWithContact[];
}

function TaskRow({
  task,
  onComplete,
  onReschedule,
  onDelete,
  isCompleting,
  tTasks,
  renderTitle,
}: {
  task: TaskWithContact;
  onComplete: (id: string) => void;
  onReschedule: (task: TaskWithContact) => void;
  onDelete?: () => void;
  isCompleting: boolean;
  tTasks: { markComplete: string; reschedule: string; viewOpportunity: string; viewLead: string; automationBadge: string; automationStageLabel: string };
  renderTitle: (task: { title: string }) => string;
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
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-900 leading-tight" data-testid={`text-task-title-${task.id}`}>
            {renderTitle(task)}
          </p>
          <span className="flex items-center gap-1 text-xs font-medium text-amber-500 whitespace-nowrap" data-testid={`text-due-date-${task.id}`}>
            <CalendarClock className="w-3 h-3" />
            {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}{task.followUpTime ? ` at ${formatTaskTimeDisplay(task.dueDate, task.followUpTime, task.followUpTimezone)}` : ""}
          </span>
        </div>

        {task.notes && (
          <div className="text-xs text-gray-400 mt-0.5 line-clamp-1 chat-message-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(task.notes) }} />
        )}

        {task.automationMeta && (
          <div className="flex items-center gap-1.5 mt-1" data-testid={`badge-automation-${task.id}`}>
            <Badge variant="outline" className="text-xs py-0 px-1.5 bg-violet-50 text-violet-700 border-violet-200 gap-1">
              <Zap className="w-3 h-3" />
              {tTasks.automationBadge}
            </Badge>
            <span className="text-xs text-gray-400">
              {tTasks.automationStageLabel.replace("{stage}", task.automationMeta.triggerStageSlug.replace(/-/g, " "))}
            </span>
          </div>
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
        <div className="flex items-center gap-1">
          {onDelete && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-gray-300 hover:text-red-500 hover:bg-red-50"
              onClick={onDelete}
              data-testid={`button-delete-task-${task.id}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function getProfileLink(task: TaskWithContact): string | null {
  if (task.companyId) return `/admin/clients/${task.companyId}?tab=tasks`;
  if (task.opportunityId) return `/admin/pipeline/opportunities/${task.opportunityId}?tab=tasks`;
  if (task.leadId) return `/admin/crm/leads/${task.leadId}?tab=tasks`;
  return null;
}

function CompletedTaskCard({
  task,
  tTasks,
  outcomeLabels,
  renderTitle,
  onDelete,
}: {
  task: TaskWithContact;
  tTasks: { completedOn: string; outcome: string; viewProfile: string };
  outcomeLabels: Record<string, string>;
  renderTitle: (task: { title: string }) => string;
  onDelete?: () => void;
}) {
  const contactName = task.contact
    ? `${task.contact.firstName}${task.contact.lastName ? " " + task.contact.lastName : ""}`
    : null;

  const profileLink = getProfileLink(task);
  const completedDate = task.completedAt
    ? new Date(task.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;
  const completedTime = task.completedAt
    ? new Date(task.completedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;

  const outcomeKey = task.outcome as keyof typeof outcomeLabels | null;
  const outcomeLabel = outcomeKey ? (outcomeLabels[outcomeKey] || task.outcome) : null;

  const cardContent = (
    <Card
      className={`p-3 mb-2.5 transition-all group ${profileLink ? "hover:border-[#0D9488]/40 hover:shadow-sm cursor-pointer" : ""}`}
      data-testid={`completed-task-card-${task.id}`}
    >
      <div className="flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 text-[#0D9488] mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-700 leading-tight line-clamp-2">
            {renderTitle(task)}
          </p>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5">
            {contactName && (
              <span className="text-xs font-medium text-gray-600" data-testid={`completed-contact-${task.id}`}>
                {contactName}
              </span>
            )}
            {task.company && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Building2 className="w-3 h-3" />
                {task.company.name}
              </span>
            )}
          </div>

          {outcomeLabel && (
            <div className="mt-1.5">
              <Badge variant="secondary" className="text-xs py-0 px-1.5" data-testid={`completed-outcome-${task.id}`}>
                {outcomeLabel}
              </Badge>
            </div>
          )}

          {task.completionNote && (
            <div className="flex items-start gap-1 mt-1.5">
              <FileText className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-gray-400 line-clamp-2 chat-message-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(task.completionNote) }} />
            </div>
          )}

          <div className="flex items-center gap-2 mt-2">
            {completedDate && (
              <span className="text-xs text-gray-400" data-testid={`completed-date-${task.id}`}>
                {tTasks.completedOn}: {completedDate} {completedTime && `· ${completedTime}`}
              </span>
            )}
          </div>

          {profileLink && (
            <span className="flex items-center gap-1 text-xs text-[#0D9488] mt-1.5">
              <ExternalLink className="w-3 h-3" />
              {tTasks.viewProfile}
            </span>
          )}
        </div>
        {onDelete && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 flex-shrink-0 self-start text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
            data-testid={`button-delete-completed-task-${task.id}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </Card>
  );

  if (profileLink) {
    return (
      <Link href={profileLink} data-testid={`link-completed-task-${task.id}`}>
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}

export default function TasksDueTodayPage() {
  const { t } = useAdminLang();
  const { toast } = useToast();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [completingTask, setCompletingTask] = useState<TaskWithContact | null>(null);
  const [rescheduleTask, setRescheduleTask] = useState<TaskWithContact | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [contactedPendingOppId, setContactedPendingOppId] = useState<string | null>(null);
  const spokeWithLeadTaskRef = useRef<string | null>(null);
  const spokeWithLeadNoteRef = useRef<string | undefined>(undefined);
  const [demoOutcomeTask, setDemoOutcomeTask] = useState<TaskWithContact | null>(null);
  const [demoCompletedPendingStageId, setDemoCompletedPendingStageId] = useState<string | null>(null);
  const [paymentSentPendingOppId, setPaymentSentPendingOppId] = useState<string | null>(null);
  const [paymentSentPendingStageId, setPaymentSentPendingStageId] = useState<string | null>(null);
  const afterDemoCompletedCallbackRef = useRef<(() => void) | null>(null);
  const [paymentFollowupTask, setPaymentFollowupTask] = useState<TaskWithContact | null>(null);

  const invalidateTaskCaches = useCallback((task?: TaskWithContact | null) => {
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/due-today"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/completed-history"] });
    if (task?.opportunityId) {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles", "opportunity", task.opportunityId] });
    }
    if (task?.companyId) {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/company", task.companyId, "tasks"] });
    }
  }, []);

  const { data: stages } = useQuery<Array<{ id: string; slug: string }>>({
    queryKey: ["/api/pipeline/stages"],
    staleTime: STALE.SLOW,
  });
  const contactedStageId = stages?.find(s => s.slug === "contacted")?.id ?? null;

  const stageMutation = useMutation({
    mutationFn: async ({ oppId, stageId }: { oppId: string; stageId: string }) => {
      await apiRequest("PUT", `/api/pipeline/opportunities/${oppId}/stage`, { stageId });
    },
    onSuccess: (_data, { oppId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/due-today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/completed-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles", "opportunity", oppId] });
      if (afterDemoCompletedCallbackRef.current) {
        const cb = afterDemoCompletedCallbackRef.current;
        afterDemoCompletedCallbackRef.current = null;
        cb();
      }
    },
  });

  const handleSpokeWithLead = useCallback((completionNote?: string) => {
    const task = completingTask;
    if (!task) return;
    spokeWithLeadTaskRef.current = task.id;
    spokeWithLeadNoteRef.current = completionNote;
    setCompletingTask(null);
    if (task.opportunityId) setContactedPendingOppId(task.opportunityId);
  }, [completingTask]);

  const deleteMutation = useMutation({
    mutationFn: async ({ taskId }: { taskId: string; opportunityId?: string | null; companyId?: string | null }) => {
      await apiRequest("DELETE", `/api/tasks/${taskId}`);
    },
    onSuccess: (_data, vars) => {
      invalidateTaskCaches(vars as unknown as TaskWithContact);
      toast({ title: (t.tasks as Record<string, unknown>).taskDeleted as string ?? "Task deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const { data, isLoading } = useQuery<DueTodayData>({
    queryKey: ["/api/tasks/due-today"],
    staleTime: STALE.FAST,
    refetchOnWindowFocus: true,
  });

  const { data: completedTasks, isLoading: isLoadingHistory } = useQuery<TaskWithContact[]>({
    queryKey: ["/api/tasks/completed-history"],
    staleTime: STALE.FAST,
    refetchOnWindowFocus: true,
  });

  const dueToday = data?.dueToday ?? [];
  const overdue = data?.overdue ?? [];
  const upcoming = data?.upcoming ?? [];
  const totalCount = dueToday.length + overdue.length + upcoming.length;
  const history = completedTasks ?? [];

  const tTasks = {
    markComplete: t.tasks.markComplete,
    reschedule: t.tasks.reschedule,
    viewOpportunity: t.tasks.viewOpportunity,
    viewLead: t.tasks.viewLead,
    automationBadge: t.tasks.automationBadge,
    automationStageLabel: t.tasks.automationStageLabel,
  };

  const tCompleted = {
    completedOn: t.tasks.completedOn,
    outcome: t.tasks.outcome,
    viewProfile: t.tasks.viewProfile,
  };

  const outcomeLabels: Record<string, string> = {
    noAnswer: t.tasks.outcomes.noAnswer,
    leftVoicemail: t.tasks.outcomes.leftVoicemail,
    spokeWithLead: t.tasks.outcomes.spokeWithLead,
    interested: t.tasks.outcomes.interested,
    uncertain: t.tasks.outcomes.uncertain,
    notInterested: t.tasks.outcomes.notInterested,
    badNumber: t.tasks.outcomes.badNumber,
    appointmentSet: t.tasks.outcomes.appointmentSet,
  };

  return (
    <div data-testid="page-tasks-due-today">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-tasks-title">
            {t.tasks.title}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t.tasks.allActiveTasks}
          </p>
        </div>
      </div>

      <Tabs defaultValue="open" className="w-full">
        <TabsList className="mb-4" data-testid="tabs-tasks">
          <TabsTrigger value="open" data-testid="tab-open-tasks">
            {t.tasks.tabOpenTasks}
            {totalCount > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">{totalCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed-tasks">
            {t.tasks.tabCompleted}
            {history.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">{history.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="space-y-4">
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
                        onComplete={(id) => {
                          const found = overdue.find(t2 => t2.id === id);
                          if (!found) return;
                          if (found.taskType === "payment_followup" || found.title === "Follow up on payment") {
                            setPaymentFollowupTask(found);
                          } else if (found.taskType === "demo_outcome" || found.taskType === "demo_followup" || found.opportunityStageSlug === "demo-completed") {
                            setDemoOutcomeTask(found);
                            const demoCompletedStage = stages?.find(s => s.slug === "demo-completed");
                            if (demoCompletedStage) setDemoCompletedPendingStageId(demoCompletedStage.id);
                          } else {
                            setCompletingTask(found);
                          }
                        }}
                        onReschedule={(tsk) => setRescheduleTask(tsk)}
                        onDelete={isAdmin ? () => deleteMutation.mutate({ taskId: task.id, opportunityId: task.opportunityId, companyId: task.companyId }) : undefined}
                        isCompleting={false}
                        tTasks={tTasks}
                        renderTitle={(task) => renderTaskTitle(task, t)}
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
                        onComplete={(id) => {
                          const found = dueToday.find(t2 => t2.id === id);
                          if (!found) return;
                          if (found.taskType === "payment_followup" || found.title === "Follow up on payment") {
                            setPaymentFollowupTask(found);
                          } else if (found.taskType === "demo_outcome" || found.taskType === "demo_followup" || found.opportunityStageSlug === "demo-completed") {
                            setDemoOutcomeTask(found);
                            const demoCompletedStage = stages?.find(s => s.slug === "demo-completed");
                            if (demoCompletedStage) setDemoCompletedPendingStageId(demoCompletedStage.id);
                          } else {
                            setCompletingTask(found);
                          }
                        }}
                        onReschedule={(tsk) => setRescheduleTask(tsk)}
                        onDelete={isAdmin ? () => deleteMutation.mutate({ taskId: task.id, opportunityId: task.opportunityId, companyId: task.companyId }) : undefined}
                        isCompleting={false}
                        tTasks={tTasks}
                        renderTitle={(task) => renderTaskTitle(task, t)}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}

              {upcoming.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2" data-testid="section-upcoming">
                      <CalendarClock className="w-4 h-4 text-blue-500" />
                      {t.tasks.upcoming}
                      <Badge variant="secondary" className="text-xs">{upcoming.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    {upcoming.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onComplete={(id) => {
                          const found = upcoming.find(t2 => t2.id === id);
                          if (!found) return;
                          if (found.taskType === "payment_followup" || found.title === "Follow up on payment") {
                            setPaymentFollowupTask(found);
                          } else if (found.taskType === "demo_outcome" || found.taskType === "demo_followup" || found.opportunityStageSlug === "demo-completed") {
                            setDemoOutcomeTask(found);
                            const demoCompletedStage = stages?.find(s => s.slug === "demo-completed");
                            if (demoCompletedStage) setDemoCompletedPendingStageId(demoCompletedStage.id);
                          } else {
                            setCompletingTask(found);
                          }
                        }}
                        onReschedule={(tsk) => setRescheduleTask(tsk)}
                        onDelete={isAdmin ? () => deleteMutation.mutate({ taskId: task.id, opportunityId: task.opportunityId, companyId: task.companyId }) : undefined}
                        isCompleting={false}
                        tTasks={tTasks}
                        renderTitle={(task) => renderTaskTitle(task, t)}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" data-testid="section-completed-history">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <CheckCircle2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 font-medium text-sm">{t.tasks.noCompletedTasks}</p>
                <p className="text-xs text-gray-400 mt-1">{t.tasks.noCompletedTasksDesc}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {history.map((task) => (
                <CompletedTaskCard
                  key={task.id}
                  task={task}
                  tTasks={tCompleted}
                  outcomeLabels={outcomeLabels}
                  renderTitle={(task) => renderTaskTitle(task, t)}
                  onDelete={isAdmin ? () => deleteMutation.mutate({ taskId: task.id, opportunityId: task.opportunityId, companyId: task.companyId }) : undefined}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

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
      <CompleteTaskModal
        open={!!completingTask}
        onClose={() => setCompletingTask(null)}
        task={completingTask}
        leadTimezone={null}
        outcomeMode={completingTask?.opportunityStageSlug === "new-lead" ? "new-lead" : "general"}
        onSpokeWithLead={completingTask?.opportunityStageSlug === "new-lead" ? handleSpokeWithLead : undefined}
        onSuccess={() => {
          invalidateTaskCaches(completingTask);
          setCompletingTask(null);
        }}
      />
      <CompleteTaskModal
        open={contactedPendingOppId !== null}
        onClose={() => {
          spokeWithLeadTaskRef.current = null;
          spokeWithLeadNoteRef.current = undefined;
          setContactedPendingOppId(null);
        }}
        task={null}
        opportunityId={contactedPendingOppId ?? undefined}
        hideFollowUp={true}
        onSuccess={(outcome) => {
          const taskId = spokeWithLeadTaskRef.current;
          const note = spokeWithLeadNoteRef.current;
          spokeWithLeadTaskRef.current = null;
          spokeWithLeadNoteRef.current = undefined;
          if (taskId) {
            apiRequest("PUT", `/api/tasks/${taskId}/complete`, {
              outcome: "Spoke with lead",
              ...(note ? { completionNote: note } : {}),
            }).then(() => {
              queryClient.invalidateQueries({ queryKey: ["/api/tasks/due-today"] });
              queryClient.invalidateQueries({ queryKey: ["/api/tasks/completed-history"] });
            }).catch(() => {});
          }
          const hasOwnStageMove = outcome === "Appointment set" || outcome === "Not interested";
          if (contactedPendingOppId && contactedStageId && !hasOwnStageMove) {
            stageMutation.mutate({ oppId: contactedPendingOppId, stageId: contactedStageId });
          }
          setContactedPendingOppId(null);
        }}
        preventClose={true}
      />
      {demoOutcomeTask?.opportunityId && (
        <DemoCompletedModal
          open={demoCompletedPendingStageId !== null}
          onClose={() => {
            setDemoCompletedPendingStageId(null);
            setDemoOutcomeTask(null);
          }}
          opportunityId={demoOutcomeTask.opportunityId}
          contactName={
            demoOutcomeTask.contact
              ? `${demoOutcomeTask.contact.firstName} ${demoOutcomeTask.contact.lastName ?? ""}`.trim()
              : "there"
          }
          contactPhone={demoOutcomeTask.contact?.phone ?? null}
          onReadyForPayment={() => {
            const paymentSentStage = stages?.find(s => s.slug === "payment-sent");
            const task = demoOutcomeTask;
            if (paymentSentStage && task.opportunityId) {
              afterDemoCompletedCallbackRef.current = () => {
                setPaymentSentPendingOppId(task.opportunityId!);
                setPaymentSentPendingStageId(paymentSentStage.id);
              };
            }
            apiRequest("PUT", `/api/tasks/${task.id}/complete`, {}).then(() => {
              invalidateTaskCaches(task);
            }).catch(() => {});
            setDemoOutcomeTask(null);
            if (demoCompletedPendingStageId && task.opportunityId) {
              stageMutation.mutate({ oppId: task.opportunityId, stageId: demoCompletedPendingStageId });
            }
            setDemoCompletedPendingStageId(null);
          }}
          onDemoCompleted={() => {
            const task = demoOutcomeTask;
            apiRequest("PUT", `/api/tasks/${task.id}/complete`, {}).then(() => {
              invalidateTaskCaches(task);
            }).catch(() => {});
            setDemoOutcomeTask(null);
            if (demoCompletedPendingStageId && task.opportunityId) {
              stageMutation.mutate({ oppId: task.opportunityId, stageId: demoCompletedPendingStageId });
            }
            setDemoCompletedPendingStageId(null);
          }}
          onClosedLost={() => {
            const task = demoOutcomeTask;
            const closedLostStage = stages?.find(s => s.slug === "closed-lost");
            apiRequest("PUT", `/api/tasks/${task.id}/complete`, {}).then(() => {
              invalidateTaskCaches(task);
            }).catch(() => {});
            setDemoOutcomeTask(null);
            if (closedLostStage && task.opportunityId) {
              stageMutation.mutate({ oppId: task.opportunityId, stageId: closedLostStage.id });
            }
            setDemoCompletedPendingStageId(null);
          }}
        />
      )}

      {paymentSentPendingOppId && paymentSentPendingStageId && (
        <PaymentSentModal
          open={true}
          onClose={() => {
            setPaymentSentPendingOppId(null);
            setPaymentSentPendingStageId(null);
          }}
          opportunityId={paymentSentPendingOppId}
          onSuccess={() => {
            if (paymentSentPendingOppId && paymentSentPendingStageId) {
              stageMutation.mutate({ oppId: paymentSentPendingOppId, stageId: paymentSentPendingStageId });
            }
          }}
        />
      )}

      {paymentFollowupTask && paymentFollowupTask.opportunityId && (
        <PaymentFollowupModal
          open={true}
          onClose={() => setPaymentFollowupTask(null)}
          opportunityId={paymentFollowupTask.opportunityId}
          taskId={paymentFollowupTask.id}
          contactName={paymentFollowupTask.contact?.firstName ?? null}
          onPaymentReceived={() => {
            const closedWonStage = stages?.find(s => s.slug === "closed-won");
            if (closedWonStage && paymentFollowupTask.opportunityId) {
              stageMutation.mutate({ oppId: paymentFollowupTask.opportunityId!, stageId: closedWonStage.id });
            }
            setPaymentFollowupTask(null);
          }}
          onWontPay={() => {
            const closedLostStage = stages?.find(s => s.slug === "closed-lost");
            if (closedLostStage && paymentFollowupTask.opportunityId) {
              stageMutation.mutate({ oppId: paymentFollowupTask.opportunityId!, stageId: closedLostStage.id });
            }
            setPaymentFollowupTask(null);
          }}
        />
      )}
    </div>
  );
}

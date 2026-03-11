import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import RichTextEditorField from "@/features/chat/RichTextEditorField";
import { sanitizeHtml } from "@/features/chat/RichTextEditor";
import { useAdminLang } from "@/i18n/LanguageContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Building2, User as UserIcon,
  MessageSquare, Phone, Mail, FileText, CheckCircle, XCircle,
  Clock, Zap, ArrowRightLeft, UserPlus, ClipboardList, Plus,
  AlertCircle, CheckCheck, Package, Pencil,
} from "lucide-react";

import type { PipelineStage, PipelineOpportunity, PipelineActivity, CrmCompany, CrmContact, CrmLead, FollowupTask } from "@shared/schema";
import QuickTaskModal from "@/components/QuickTaskModal";
import { RecordTimeline } from "@/components/RecordTimeline";
import EditRecordModal from "@/components/EditRecordModal";

const PKG_COLORS: Record<string, string> = {
  empieza: "bg-blue-100 text-blue-700",
  crece:   "bg-violet-100 text-violet-700",
  domina:  "bg-amber-100 text-amber-700",
};

type TaskWithContact = FollowupTask & {
  contact: { firstName: string; lastName: string | null; phone: string | null } | null;
  company: { name: string } | null;
};

const ACTIVITY_ICONS: Record<string, typeof MessageSquare> = {
  note: MessageSquare,
  call: Phone,
  email: Mail,
  task: FileText,
  stage_change: ArrowRightLeft,
  system: Zap,
};

export default function OpportunityDetailPage({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useAdminLang();
  const [noteContent, setNoteContent] = useState("");
  const [noteType, setNoteType] = useState("note");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [rescheduleTask, setRescheduleTask] = useState<TaskWithContact | null>(null);

  const { data: opp, isLoading } = useQuery<PipelineOpportunity>({
    queryKey: ["/api/pipeline/opportunities", id],
  });

  const { data: stages } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline/stages"],
  });

  const { data: activities } = useQuery<PipelineActivity[]>({
    queryKey: ["/api/pipeline/opportunities", id, "activities"],
  });

  const { data: company } = useQuery<CrmCompany>({
    queryKey: ["/api/crm/companies", opp?.companyId || ""],
    enabled: !!opp?.companyId,
  });

  const { data: contact } = useQuery<CrmContact>({
    queryKey: ["/api/crm/contacts", opp?.contactId || ""],
    enabled: !!opp?.contactId,
  });

  const { data: sourceLead } = useQuery<CrmLead>({
    queryKey: ["/api/crm/leads", opp?.leadId || ""],
    enabled: !!opp?.leadId,
  });

  const { data: tasks } = useQuery<TaskWithContact[]>({
    queryKey: ["/api/tasks/for-opportunity", id],
  });

  const completeMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiRequest("PUT", `/api/tasks/${taskId}/complete`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/for-opportunity", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/due-today"] });
      toast({ title: t.tasks.taskCompleted });
    },
  });

  const stageMutation = useMutation({
    mutationFn: async (stageId: string) => {
      const res = await apiRequest("PUT", `/api/pipeline/opportunities/${id}/stage`, { stageId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities", id, "activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities/board"] });
      toast({ title: t.pipeline.stageUpdated });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("PUT", `/api/pipeline/opportunities/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities/board"] });
      toast({ title: t.pipeline.statusUpdated });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const noteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/pipeline/opportunities/${id}/activities`, {
        type: noteType,
        content: noteContent,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities", id, "activities"] });
      setNoteContent("");
      toast({ title: t.pipeline.activityAdded });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const onboardingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/onboarding/convert-opportunity/${id}`, {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: t.pipeline.onboardingCreated });
      navigate(`/admin/onboarding/${data.id}`);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!opp) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Opportunity not found</p>
        <Link href="/admin/pipeline">
          <Button variant="ghost" className="mt-2">Back to Pipeline</Button>
        </Link>
      </div>
    );
  }

  const currentStage = stages?.find(s => s.id === opp.stageId);
  const nextTask = tasks
    ?.filter(task => !task.completed)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0] ?? null;

  return (
    <div className="max-w-4xl mx-auto" data-testid="page-opportunity-detail">
      <button
        onClick={() => navigate("/admin/pipeline")}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        data-testid="button-back-pipeline"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Pipeline
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-opportunity-title">{opp.title}</h1>
          <div className="flex items-center gap-3 mt-2">
            {currentStage && (
              <Badge style={{ backgroundColor: currentStage.color, color: "white" }} data-testid="badge-current-stage">
                {currentStage.name}
              </Badge>
            )}
            {opp.status !== "open" && (
              <Badge variant={opp.status === "won" ? "default" : "destructive"} data-testid="badge-status">
                {opp.status === "won" ? t.pipeline.closeWon.split("—")[1]?.trim() || "Won" : t.pipeline.closeLost.split("—")[1]?.trim() || "Lost"}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowEdit(true)}
            data-testid="button-edit-opportunity"
          >
            <Pencil className="w-3.5 h-3.5" />
            {t.crm.editDetails}
          </Button>
          {opp.status === "open" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-green-600 border-green-200 hover:bg-green-50"
                onClick={() => {
                  const wonStage = stages?.find(s => s.slug === "closed-won");
                  if (wonStage) stageMutation.mutate(wonStage.id);
                  else statusMutation.mutate("won");
                }}
                data-testid="button-mark-won"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                {t.pipeline.closeWon}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => {
                  const lostStage = stages?.find(s => s.slug === "closed-lost");
                  if (lostStage) stageMutation.mutate(lostStage.id);
                  else statusMutation.mutate("lost");
                }}
                data-testid="button-mark-lost"
              >
                <XCircle className="w-4 h-4 mr-1" />
                {t.pipeline.closeLost}
              </Button>
            </>
          )}
          {opp.status !== "open" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const defaultStage = stages?.find(s => s.isDefault) || stages?.[0];
                if (defaultStage) {
                  stageMutation.mutate(defaultStage.id);
                  statusMutation.mutate("open");
                }
              }}
              data-testid="button-reopen"
            >
              {t.pipeline.reopen}
            </Button>
          )}
          {opp.status === "won" && (
            <Button
              size="sm"
              onClick={() => onboardingMutation.mutate()}
              disabled={onboardingMutation.isPending}
              data-testid="button-start-onboarding"
            >
              <UserPlus className="w-4 h-4 mr-1" />
              Start Onboarding
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-xs text-gray-400 mb-1.5 flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    {t.pipeline.package}
                  </p>
                  {opp.websitePackage ? (
                    <span
                      className={`inline-block text-xs font-semibold rounded px-2 py-0.5 uppercase tracking-wide ${PKG_COLORS[opp.websitePackage] ?? "bg-gray-100 text-gray-600"}`}
                      data-testid="badge-website-package"
                    >
                      {opp.websitePackage}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">{t.pipeline.stageEntered}</p>
                  <p className="text-sm font-medium" data-testid="text-stage-entered">
                    {opp.stageEnteredAt
                      ? new Date(opp.stageEnteredAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {t.pipeline.nextFollowUp}
                  </p>
                  <p className="text-sm font-medium flex items-center gap-1" data-testid="text-next-followup">
                    {nextTask ? (
                      <span className={new Date(nextTask.dueDate) < new Date() ? "text-red-500" : "text-gray-800"}>
                        {new Date(nextTask.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    ) : (
                      <span className="text-gray-400">{t.pipeline.noTaskScheduled}</span>
                    )}
                  </p>
                </div>
              </div>

              {stages && opp.status === "open" && (
                <div className="pt-3 border-t">
                  <p className="text-xs text-gray-400 mb-2">Move to Stage</p>
                  <div className="flex flex-wrap gap-1.5">
                    {stages.map(stage => (
                      <Button
                        key={stage.id}
                        size="sm"
                        variant={stage.id === opp.stageId ? "default" : "outline"}
                        className="text-xs h-7"
                        style={stage.id === opp.stageId ? { backgroundColor: stage.color } : { borderColor: stage.color, color: stage.color }}
                        onClick={() => stage.id !== opp.stageId && stageMutation.mutate(stage.id)}
                        disabled={stageMutation.isPending}
                        data-testid={`button-stage-${stage.slug}`}
                      >
                        {(t.pipeline.stageNames as Record<string, string>)[stage.slug] || stage.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {opp.notes && (
                <div className="pt-3 border-t">
                  <p className="text-xs text-gray-400 mb-1">Notes</p>
                  <div className="text-sm text-gray-700 chat-message-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(opp.notes ?? "") }} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Select value={noteType} onValueChange={setNoteType}>
                  <SelectTrigger className="w-[120px]" data-testid="select-activity-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="note">Note</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                  </SelectContent>
                </Select>
                <RichTextEditorField
                  value={noteContent}
                  onChange={(html) => setNoteContent(html)}
                  placeholder="Add activity..."
                  minHeight="60px"
                  data-testid="textarea-activity"
                />
                <Button
                  size="sm"
                  onClick={() => noteMutation.mutate()}
                  disabled={!noteContent.replace(/<[^>]*>/g, "").trim() || noteMutation.isPending}
                  className="self-end"
                  data-testid="button-add-activity"
                >
                  Add
                </Button>
              </div>

              <div className="space-y-3">
                {(activities || []).map(act => {
                  const Icon = ACTIVITY_ICONS[act.type] || MessageSquare;
                  return (
                    <motion.div
                      key={act.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex gap-3 py-2 border-b border-gray-100 last:border-0"
                      data-testid={`activity-${act.id}`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        act.type === "stage_change" ? "bg-blue-100 text-blue-600" :
                        act.type === "system" ? "bg-gray-100 text-gray-500" :
                        act.type === "call" ? "bg-green-100 text-green-600" :
                        act.type === "email" ? "bg-purple-100 text-purple-600" :
                        "bg-amber-100 text-amber-600"
                      }`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700">{act.content}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(act.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
                {(!activities || activities.length === 0) && (
                  <p className="text-sm text-gray-400 text-center py-4">No activity yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {company && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  Company
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/admin/crm/companies/${company.id}`}>
                  <p className="text-sm font-medium text-[#0D9488] hover:underline" data-testid="link-company">
                    {company.name}
                  </p>
                </Link>
                {company.phone && <p className="text-xs text-gray-500 mt-1">{company.phone}</p>}
                {company.email && <p className="text-xs text-gray-500">{company.email}</p>}
              </CardContent>
            </Card>
          )}

          {contact && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <UserIcon className="w-4 h-4 text-gray-400" />
                  Contact
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/admin/crm/contacts/${contact.id}`}>
                  <p className="text-sm font-medium text-[#0D9488] hover:underline" data-testid="link-contact">
                    {contact.firstName} {contact.lastName || ""}
                  </p>
                </Link>
                {contact.phone && <p className="text-xs text-gray-500 mt-1">{contact.phone}</p>}
                {contact.email && <p className="text-xs text-gray-500">{contact.email}</p>}
              </CardContent>
            </Card>
          )}

          {sourceLead && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-gray-400" />
                  Source Lead
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/admin/crm/leads/${sourceLead.id}`}>
                  <p className="text-sm font-medium text-[#0D9488] hover:underline" data-testid="link-source-lead">
                    {sourceLead.title}
                  </p>
                </Link>
                {sourceLead.source && (
                  <p className="text-xs text-gray-500 mt-1">Source: {sourceLead.source}</p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Created</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600" data-testid="text-created-date">
                {new Date(opp.createdAt).toLocaleDateString("en-US", {
                  weekday: "short", year: "numeric", month: "short", day: "numeric",
                })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-gray-400" />
                  Follow-up Tasks
                  {tasks && tasks.filter(t => !t.completed).length > 0 && (
                    <Badge variant="secondary" className="text-xs ml-1" data-testid="badge-pending-tasks">
                      {tasks.filter(t => !t.completed).length}
                    </Badge>
                  )}
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-[#0D9488] hover:bg-[#0D9488]/10"
                  onClick={() => { setRescheduleTask(null); setTaskModalOpen(true); }}
                  data-testid="button-add-task"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {(!tasks || tasks.length === 0) ? (
                <p className="text-xs text-gray-400 text-center py-2">No tasks yet</p>
              ) : (
                tasks.map(task => {
                  const isOverdue = !task.completed && new Date(task.dueDate) < new Date();
                  return (
                    <div
                      key={task.id}
                      className={`flex items-start gap-2 p-2 rounded-md border text-xs ${
                        task.completed ? "bg-gray-50 border-gray-100 opacity-60" :
                        isOverdue ? "bg-red-50 border-red-100" : "bg-white border-gray-100"
                      }`}
                      data-testid={`task-row-${task.id}`}
                    >
                      <button
                        onClick={() => !task.completed && completeMutation.mutate(task.id)}
                        disabled={task.completed || completeMutation.isPending}
                        className="flex-shrink-0 mt-0.5"
                        data-testid={`button-complete-task-${task.id}`}
                      >
                        {task.completed
                          ? <CheckCheck className="w-4 h-4 text-emerald-500" />
                          : <CheckCircle className={`w-4 h-4 ${isOverdue ? "text-red-400" : "text-gray-300"} hover:text-emerald-500 transition-colors`} />
                        }
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium leading-tight truncate ${task.completed ? "line-through text-gray-400" : "text-gray-800"}`}>
                          {task.title}
                        </p>
                        <div className={`flex items-center gap-1 mt-0.5 ${isOverdue ? "text-red-500" : "text-gray-400"}`}>
                          {isOverdue && <AlertCircle className="w-3 h-3 flex-shrink-0" />}
                          <span>{new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        </div>
                      </div>
                      {!task.completed && (
                        <button
                          onClick={() => { setRescheduleTask(task); setTaskModalOpen(true); }}
                          className="flex-shrink-0 text-gray-300 hover:text-[#0D9488] transition-colors"
                          title="Reschedule"
                          data-testid={`button-reschedule-task-${task.id}`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-gray-400" />
                History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RecordTimeline entityType="opportunity" entityId={id} limit={10} />
            </CardContent>
          </Card>
        </div>
      </div>

      <EditRecordModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        contact={contact ?? null}
        company={company ?? null}
        opportunityId={id}
        currentPackage={opp.websitePackage ?? null}
        invalidateKeys={[["/api/pipeline/opportunities", id], ["/api/pipeline/opportunities"]]}
        onSaved={() => setShowEdit(false)}
      />

      <QuickTaskModal
        open={taskModalOpen}
        onClose={() => { setTaskModalOpen(false); setRescheduleTask(null); }}
        opportunityId={id}
        contactId={opp.contactId ?? null}
        editTask={rescheduleTask ? {
          id: rescheduleTask.id,
          title: rescheduleTask.title,
          notes: rescheduleTask.notes,
          dueDate: rescheduleTask.dueDate.toString(),
        } : null}
      />
    </div>
  );
}

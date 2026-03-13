import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/features/auth/useAuth";
import { apiRequest, queryClient, STALE } from "@/lib/queryClient";
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
  AlertCircle, CheckCheck, Package, Pencil, Trash2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { PipelineStage, PipelineOpportunity, PipelineActivity, CrmCompany, CrmContact, CrmLead, FollowupTask } from "@shared/schema";
import { WEBSITE_PACKAGES } from "@shared/schema";
import QuickTaskModal from "@/components/QuickTaskModal";
import { RecordTimeline } from "@/components/RecordTimeline";

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

type ActivityWithAuthor = { id: string; opportunityId: string; userId: string | null; type: string; content: string; metadata: unknown; createdAt: string; authorName: string | null; isFromCrm?: boolean };

export default function OpportunityDetailPage({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useAdminLang();
  const { role: authRole, user: authUser } = useAuth();
  const [noteContent, setNoteContent] = useState("");
  const [noteType, setNoteType] = useState("note");
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editingActivityContent, setEditingActivityContent] = useState("");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [rescheduleTask, setRescheduleTask] = useState<TaskWithContact | null>(null);

  const { data: opp, isLoading } = useQuery<PipelineOpportunity>({
    queryKey: ["/api/pipeline/opportunities", id],
    staleTime: STALE.FAST,
  });

  const { data: stages } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline/stages"],
    staleTime: STALE.NEVER,
  });

  const { data: activities } = useQuery<ActivityWithAuthor[]>({
    queryKey: ["/api/pipeline/opportunities", id, "activities"],
    staleTime: STALE.FAST,
  });

  const { data: company } = useQuery<CrmCompany>({
    queryKey: ["/api/crm/companies", opp?.companyId || ""],
    enabled: !!opp?.companyId,
    staleTime: STALE.MEDIUM,
  });

  const { data: contact } = useQuery<CrmContact>({
    queryKey: ["/api/crm/contacts", opp?.contactId || ""],
    enabled: !!opp?.contactId,
    staleTime: STALE.MEDIUM,
  });

  const { data: sourceLead } = useQuery<CrmLead>({
    queryKey: ["/api/crm/leads", opp?.leadId || ""],
    enabled: !!opp?.leadId,
    staleTime: STALE.MEDIUM,
  });

  const { data: tasks } = useQuery<TaskWithContact[]>({
    queryKey: ["/api/tasks/for-opportunity", id],
    staleTime: STALE.FAST,
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

  const updateActivityMutation = useMutation({
    mutationFn: async ({ activityId, content }: { activityId: string; content: string }) => {
      const res = await apiRequest("PUT", `/api/pipeline/opportunities/${id}/activities/${activityId}`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities", id, "activities"] });
      setEditingActivityId(null);
      setEditingActivityContent("");
      toast({ title: "Activity updated" });
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

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/pipeline/opportunities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities"] });
      toast({ title: "Opportunity deleted" });
      navigate("/admin/pipeline");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  type EditSection = "details" | "contact" | "company" | "lead" | null;
  const [editSection, setEditSection] = useState<EditSection>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPkg, setEditPkg] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editCompanyPhone, setEditCompanyPhone] = useState("");
  const [editCompanyEmail, setEditCompanyEmail] = useState("");
  const [editCompanyWebsite, setEditCompanyWebsite] = useState("");
  const [editCompanyIndustry, setEditCompanyIndustry] = useState("");
  const [editLeadTitle, setEditLeadTitle] = useState("");
  const [editLeadSource, setEditLeadSource] = useState("");

  const openEdit = (section: EditSection) => {
    if (!opp) return;
    if (section === "details") {
      setEditTitle(opp.title);
      setEditPkg(opp.websitePackage ?? "");
      setEditNotes(opp.notes ?? "");
    } else if (section === "contact" && contact) {
      setEditFirstName(contact.firstName);
      setEditLastName(contact.lastName ?? "");
      setEditPhone(contact.phone ?? "");
      setEditEmail(contact.email ?? "");
    } else if (section === "company" && company) {
      setEditCompanyName(company.name);
      setEditCompanyPhone(company.phone ?? "");
      setEditCompanyEmail(company.email ?? "");
      setEditCompanyWebsite((company as any).website ?? "");
      setEditCompanyIndustry(company.industry ?? "");
    } else if (section === "lead" && sourceLead) {
      setEditLeadTitle(sourceLead.title);
      setEditLeadSource(sourceLead.source ?? "");
    }
    setEditSection(section);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editSection === "details") {
        const res = await apiRequest("PUT", `/api/pipeline/opportunities/${id}`, {
          title: editTitle,
          websitePackage: (editPkg && editPkg !== "none" ? editPkg : null) as any,
          notes: editNotes || null,
        });
        return res.json();
      } else if (editSection === "contact" && contact) {
        const res = await apiRequest("PUT", `/api/crm/contacts/${contact.id}`, {
          firstName: editFirstName,
          lastName: editLastName || null,
          phone: editPhone || null,
          email: editEmail || null,
        });
        return res.json();
      } else if (editSection === "company" && company) {
        const res = await apiRequest("PUT", `/api/crm/companies/${company.id}`, {
          name: editCompanyName,
          phone: editCompanyPhone || null,
          email: editCompanyEmail || null,
          website: editCompanyWebsite || null,
          industry: editCompanyIndustry || null,
        });
        return res.json();
      } else if (editSection === "lead" && sourceLead) {
        const res = await apiRequest("PUT", `/api/crm/leads/${sourceLead.id}`, {
          title: editLeadTitle,
          source: editLeadSource || null,
        });
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities", id] });
      if (editSection === "contact") queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts", opp?.contactId ?? ""] });
      if (editSection === "company") queryClient.invalidateQueries({ queryKey: ["/api/crm/companies", opp?.companyId ?? ""] });
      if (editSection === "lead") queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", opp?.leadId ?? ""] });
      setEditSection(null);
      toast({ title: "Saved" });
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

      <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900" data-testid="text-opportunity-title">{opp.title}</h1>
            <button
              onClick={() => openEdit("details")}
              className="text-gray-300 hover:text-[#0D9488] transition-colors"
              title="Edit opportunity"
              data-testid="button-edit-opportunity-title"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
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

        <div className="flex items-center gap-2 flex-wrap">
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
          {authRole === "admin" && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={() => setDeleteConfirmOpen(true)}
              title="Delete Opportunity"
              data-testid="button-delete-opportunity"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Details</CardTitle>
              <button
                onClick={() => openEdit("details")}
                className="text-gray-300 hover:text-[#0D9488] transition-colors"
                data-testid="button-edit-details"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
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
                        {new Date(nextTask.dueDate).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })}
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
              <div className="space-y-2 mb-5">
                <Select value={noteType} onValueChange={setNoteType}>
                  <SelectTrigger className="w-[130px]" data-testid="select-activity-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="note">Note</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
                <RichTextEditorField
                  value={noteContent}
                  onChange={(html) => setNoteContent(html)}
                  placeholder="Add activity..."
                  minHeight="80px"
                  className="w-full"
                  data-testid="textarea-activity"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => noteMutation.mutate()}
                    disabled={!noteContent.replace(/<[^>]*>/g, "").trim() || noteMutation.isPending}
                    className="bg-[#0D9488] hover:bg-[#0b7a70] text-white"
                    data-testid="button-add-activity"
                  >
                    {noteMutation.isPending ? "Adding…" : "Add"}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {(activities || []).map(act => {
                  const Icon = ACTIVITY_ICONS[act.type] || MessageSquare;
                  const isEditable = !act.isFromCrm && act.type !== "stage_change" && act.type !== "system" && (authRole === "admin" || authRole === "developer" || act.userId === (authUser as any)?.id);
                  const isEditingThis = editingActivityId === act.id;
                  return (
                    <motion.div
                      key={act.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex gap-3 py-3 border-b border-gray-100 last:border-0"
                      data-testid={`activity-${act.id}`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        act.type === "stage_change" ? "bg-blue-100 text-blue-600" :
                        act.type === "system" ? "bg-gray-100 text-gray-500" :
                        act.type === "call" ? "bg-green-100 text-green-600" :
                        act.type === "email" ? "bg-purple-100 text-purple-600" :
                        "bg-amber-100 text-amber-600"
                      }`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {act.authorName && (
                              <span className="text-xs font-medium text-gray-700">{act.authorName}</span>
                            )}
                            <span className="text-xs text-gray-400 capitalize">{act.type.replace("_", " ")}</span>
                            {act.isFromCrm && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-600 border border-teal-200 font-medium leading-none">CRM</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-gray-400">
                              {new Date(act.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                            </span>
                            {isEditable && !isEditingThis && (
                              <button
                                onClick={() => { setEditingActivityId(act.id); setEditingActivityContent(act.content); }}
                                className="text-gray-300 hover:text-[#0D9488] transition-colors"
                                data-testid={`button-edit-activity-${act.id}`}
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        {isEditingThis ? (
                          <div className="mt-2 space-y-2">
                            <RichTextEditorField
                              value={editingActivityContent}
                              onChange={(html) => setEditingActivityContent(html)}
                              minHeight="60px"
                              className="w-full"
                              data-testid={`textarea-edit-activity-${act.id}`}
                            />
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setEditingActivityId(null); setEditingActivityContent(""); }}
                                data-testid={`button-cancel-edit-activity-${act.id}`}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                className="bg-[#0D9488] hover:bg-[#0b7a70] text-white"
                                disabled={!editingActivityContent.replace(/<[^>]*>/g, "").trim() || updateActivityMutation.isPending}
                                onClick={() => updateActivityMutation.mutate({ activityId: act.id, content: editingActivityContent })}
                                data-testid={`button-save-edit-activity-${act.id}`}
                              >
                                {updateActivityMutation.isPending ? "Saving…" : "Save"}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="text-sm text-gray-700 mt-1 prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(act.content) }}
                          />
                        )}
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
                          <span>{new Date(task.dueDate).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })}</span>
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

          {company && (
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  Company
                </CardTitle>
                <button onClick={() => openEdit("company")} className="text-gray-300 hover:text-[#0D9488] transition-colors" data-testid="button-edit-company">
                  <Pencil className="w-3 h-3" />
                </button>
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
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <UserIcon className="w-4 h-4 text-gray-400" />
                  Contact
                </CardTitle>
                <button onClick={() => openEdit("contact")} className="text-gray-300 hover:text-[#0D9488] transition-colors" data-testid="button-edit-contact">
                  <Pencil className="w-3 h-3" />
                </button>
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
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-gray-400" />
                  Source Lead
                </CardTitle>
                <button onClick={() => openEdit("lead")} className="text-gray-300 hover:text-[#0D9488] transition-colors" data-testid="button-edit-source-lead">
                  <Pencil className="w-3 h-3" />
                </button>
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

      <QuickTaskModal
        open={taskModalOpen}
        onClose={() => { setTaskModalOpen(false); setRescheduleTask(null); }}
        opportunityId={id}
        contactId={opp.contactId ?? null}
        defaultTitle={`Follow up with ${contact?.firstName ?? ""} ${contact?.lastName ?? ""}`.trim()}
        editTask={rescheduleTask ? {
          id: rescheduleTask.id,
          title: rescheduleTask.title,
          notes: rescheduleTask.notes,
          dueDate: rescheduleTask.dueDate.toString(),
        } : null}
      />

      <Dialog open={editSection !== null} onOpenChange={(open) => { if (!open) setEditSection(null); }}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editSection === "details" && "Edit Opportunity Details"}
              {editSection === "contact" && "Edit Contact"}
              {editSection === "company" && "Edit Company"}
              {editSection === "lead" && "Edit Source Lead"}
            </DialogTitle>
          </DialogHeader>

          {editSection === "details" && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-title">Title</Label>
                <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} data-testid="input-edit-title" />
              </div>
              <div>
                <Label htmlFor="edit-pkg">Website Package</Label>
                <Select value={editPkg} onValueChange={setEditPkg}>
                  <SelectTrigger id="edit-pkg" data-testid="select-edit-package">
                    <SelectValue placeholder="Select package" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {WEBSITE_PACKAGES.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea id="edit-notes" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={4} data-testid="textarea-edit-notes" />
              </div>
            </div>
          )}

          {editSection === "contact" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-first-name">First Name</Label>
                  <Input id="edit-first-name" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} data-testid="input-edit-first-name" />
                </div>
                <div>
                  <Label htmlFor="edit-last-name">Last Name</Label>
                  <Input id="edit-last-name" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} data-testid="input-edit-last-name" />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-contact-phone">Phone</Label>
                <Input id="edit-contact-phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} data-testid="input-edit-contact-phone" />
              </div>
              <div>
                <Label htmlFor="edit-contact-email">Email</Label>
                <Input id="edit-contact-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} data-testid="input-edit-contact-email" />
              </div>
            </div>
          )}

          {editSection === "company" && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-company-name">Company Name</Label>
                <Input id="edit-company-name" value={editCompanyName} onChange={(e) => setEditCompanyName(e.target.value)} data-testid="input-edit-company-name" />
              </div>
              <div>
                <Label htmlFor="edit-company-phone">Phone</Label>
                <Input id="edit-company-phone" value={editCompanyPhone} onChange={(e) => setEditCompanyPhone(e.target.value)} data-testid="input-edit-company-phone" />
              </div>
              <div>
                <Label htmlFor="edit-company-email">Email</Label>
                <Input id="edit-company-email" type="email" value={editCompanyEmail} onChange={(e) => setEditCompanyEmail(e.target.value)} data-testid="input-edit-company-email" />
              </div>
              <div>
                <Label htmlFor="edit-company-website">Website</Label>
                <Input id="edit-company-website" value={editCompanyWebsite} onChange={(e) => setEditCompanyWebsite(e.target.value)} data-testid="input-edit-company-website" />
              </div>
              <div>
                <Label htmlFor="edit-company-industry">Industry</Label>
                <Input id="edit-company-industry" value={editCompanyIndustry} onChange={(e) => setEditCompanyIndustry(e.target.value)} data-testid="input-edit-company-industry" />
              </div>
            </div>
          )}

          {editSection === "lead" && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-lead-title">Lead Title</Label>
                <Input id="edit-lead-title" value={editLeadTitle} onChange={(e) => setEditLeadTitle(e.target.value)} data-testid="input-edit-lead-title" />
              </div>
              <div>
                <Label htmlFor="edit-lead-source">Source</Label>
                <Input id="edit-lead-source" value={editLeadSource} onChange={(e) => setEditLeadSource(e.target.value)} placeholder="e.g. referral, website, cold call" data-testid="input-edit-lead-source" />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSection(null)} data-testid="button-cancel-edit">Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="bg-[#0D9488] hover:bg-[#0b7a70] text-white"
              data-testid="button-save-edit"
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto" data-testid="dialog-delete-opportunity">
          <DialogHeader>
            <DialogTitle>Delete Opportunity</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete this opportunity? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} data-testid="button-cancel-delete">Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => { deleteMutation.mutate(); setDeleteConfirmOpen(false); }}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

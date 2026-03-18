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
  X, MapPin, Globe, ExternalLink,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { PipelineStage, PipelineOpportunity, PipelineActivity, CrmCompany, CrmContact, CrmLead, FollowupTask } from "@shared/schema";
import { WEBSITE_PACKAGES } from "@shared/schema";
import { BUSINESS_TRADES } from "@/features/crm/CreateLeadModal";
import { US_STATES } from "@/lib/usStates";
import { renderActivityContent, getActivityTypeLabel, renderTaskTitle } from "@/lib/activityI18n";
import QuickTaskModal, { formatTaskTimeDisplay } from "@/components/QuickTaskModal";
import CompleteTaskModal from "@/components/CompleteTaskModal";
import PaymentSentModal from "@/components/PaymentSentModal";
import { RecordTimeline } from "@/components/RecordTimeline";

const PKG_COLORS: Record<string, string> = {
  empieza: "bg-blue-100 text-blue-700",
  crece:   "bg-violet-100 text-violet-700",
  domina:  "bg-amber-100 text-amber-700",
};

function humanizeSlug(slug: string): string {
  return slug.replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

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
  const [contactedPendingStageId, setContactedPendingStageId] = useState<string | null>(null);
  const [paymentSentPendingStageId, setPaymentSentPendingStageId] = useState<string | null>(null);

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

  const [completingTask, setCompletingTask] = useState<FollowupTask | null>(null);

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

  const [editingOppTitle, setEditingOppTitle] = useState(false);
  const [editOppTitleValue, setEditOppTitleValue] = useState("");
  const [editingOppPkg, setEditingOppPkg] = useState(false);
  const [editOppPkgValue, setEditOppPkgValue] = useState("");
  const [editingOppNotes, setEditingOppNotes] = useState(false);
  const [editOppNotesValue, setEditOppNotesValue] = useState("");
  const [editingOppFirstName, setEditingOppFirstName] = useState(false);
  const [editOppFirstName, setEditOppFirstName] = useState("");
  const [editingOppLastName, setEditingOppLastName] = useState(false);
  const [editOppLastName, setEditOppLastName] = useState("");
  const [editingOppPhone, setEditingOppPhone] = useState(false);
  const [editOppPhone, setEditOppPhone] = useState("");
  const [editingOppEmail, setEditingOppEmail] = useState(false);
  const [editOppEmail, setEditOppEmail] = useState("");
  const [editingOppLang, setEditingOppLang] = useState(false);
  const [editOppLang, setEditOppLang] = useState("");
  const [editingOppContactTitle, setEditingOppContactTitle] = useState(false);
  const [editOppContactTitle, setEditOppContactTitle] = useState("");
  const [editingOppBizName, setEditingOppBizName] = useState(false);
  const [editOppBizName, setEditOppBizName] = useState("");
  const [editingOppIndustry, setEditingOppIndustry] = useState(false);
  const [editOppIndustry, setEditOppIndustry] = useState("");
  const [editingOppWebsite, setEditingOppWebsite] = useState(false);
  const [editOppWebsite, setEditOppWebsite] = useState("");
  const [editingOppDba, setEditingOppDba] = useState(false);
  const [editOppDba, setEditOppDba] = useState("");
  const [editingOppCity, setEditingOppCity] = useState(false);
  const [editOppCityValue, setEditOppCityValue] = useState("");
  const [editingOppState, setEditingOppState] = useState(false);
  const [editOppStateValue, setEditOppStateValue] = useState("");

  const updateOppContactMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const res = await apiRequest("PUT", `/api/crm/contacts/${opp?.contactId}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts", opp?.contactId ?? ""] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities", id] });
      toast({ title: "Saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateOppCompanyMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const res = await apiRequest("PUT", `/api/crm/companies/${opp?.companyId}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/companies", opp?.companyId ?? ""] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities", id] });
      toast({ title: "Saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateOppLeadMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const res = await apiRequest("PUT", `/api/crm/leads/${opp?.leadId}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", opp?.leadId ?? ""] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities", id] });
      toast({ title: "Saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateOppMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const res = await apiRequest("PUT", `/api/pipeline/opportunities/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities/board"] });
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
          <Button variant="ghost" className="mt-2">{t.pipeline.backToPipeline}</Button>
        </Link>
      </div>
    );
  }

  const currentStage = stages?.find(s => s.id === opp.stageId);

  const resolvedPhone   = contact?.phone   ?? null;
  const resolvedEmail   = contact?.email   ?? null;
  const resolvedLang    = contact?.preferredLanguage ?? null;
  const SOURCE_LABELS: Record<string, string> = {
    website:  t.crm.sourceWebsite,
    outreach: t.crm.sourceOutreach,
  };
  const resolvedIndustry = company?.industry
    ? ((t.crm.trades as Record<string, string>)[company.industry] ?? humanizeSlug(company.industry))
    : null;
  const resolvedSource = (sourceLead?.source ? SOURCE_LABELS[sourceLead.source] : undefined)
    ?? sourceLead?.sourceLabel
    ?? (sourceLead?.source ? humanizeSlug(sourceLead.source) : null);

  const nextTask = tasks
    ?.filter(task => !task.completed)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0] ?? null;

  const sortedTasks = tasks ? [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (!a.completed) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    const aTime = a.completedAt ? new Date(a.completedAt).getTime() : new Date(a.dueDate).getTime();
    const bTime = b.completedAt ? new Date(b.completedAt).getTime() : new Date(b.dueDate).getTime();
    return bTime - aTime;
  }) : [];

  return (
    <div className="max-w-4xl mx-auto" data-testid="page-opportunity-detail">
      <button
        onClick={() => navigate("/admin/pipeline")}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
        data-testid="button-back-pipeline"
      >
        <ArrowLeft className="w-4 h-4" />
        {t.pipeline.backToPipeline}
      </button>

      <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            {editingOppTitle ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editOppTitleValue}
                  onChange={(e) => setEditOppTitleValue(e.target.value)}
                  className="text-lg font-bold h-9"
                  data-testid="input-opp-title"
                  autoFocus
                />
                <Button size="sm" className="h-9 px-3 bg-[#0D9488] hover:bg-[#0b7a70] text-white"
                  disabled={updateOppMutation.isPending || !editOppTitleValue.trim()}
                  onClick={() => updateOppMutation.mutate({ title: editOppTitleValue.trim() }, { onSuccess: () => setEditingOppTitle(false) })}
                  data-testid="button-save-opp-title">
                  {updateOppMutation.isPending ? "…" : t.common.save}
                </Button>
                <button onClick={() => setEditingOppTitle(false)} className="text-gray-400 hover:text-gray-600" data-testid="button-cancel-opp-title">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900" data-testid="text-opportunity-title">{opp.title}</h1>
                <button
                  onClick={() => { setEditOppTitleValue(opp.title); setEditingOppTitle(true); }}
                  className="text-gray-300 hover:text-[#0D9488] transition-colors"
                  title="Edit title"
                  data-testid="button-edit-opportunity-title"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2">
            {currentStage && (
              <Badge style={{ backgroundColor: currentStage.color, color: "white" }} data-testid="badge-current-stage">
                {(t.pipeline.stageNames as Record<string, string>)[currentStage.slug] || currentStage.name}
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
              <CardTitle className="text-base">{t.pipeline.details}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-xs text-gray-400 mb-1.5 flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    {t.pipeline.package}
                  </p>
                  {editingOppPkg ? (
                    <div className="flex items-center gap-1">
                      <Select value={editOppPkgValue} onValueChange={setEditOppPkgValue}>
                        <SelectTrigger className="h-7 text-xs flex-1" data-testid="select-opp-pkg">
                          <SelectValue placeholder={t.pipeline.selectPackage} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t.common.none}</SelectItem>
                          {WEBSITE_PACKAGES.map((p) => (
                            <SelectItem key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" className="h-7 px-2 text-xs bg-[#0D9488] hover:bg-[#0b7a70] text-white"
                        disabled={updateOppMutation.isPending}
                        onClick={() => updateOppMutation.mutate({ websitePackage: editOppPkgValue && editOppPkgValue !== "none" ? editOppPkgValue : null }, { onSuccess: () => setEditingOppPkg(false) })}
                        data-testid="button-save-opp-pkg">
                        {updateOppMutation.isPending ? "…" : t.common.save}
                      </Button>
                      <button onClick={() => setEditingOppPkg(false)} className="text-gray-400 hover:text-gray-600" data-testid="button-cancel-opp-pkg"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
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
                      <button onClick={() => { setEditOppPkgValue(opp.websitePackage ?? "none"); setEditingOppPkg(true); }} className="ml-1 text-gray-300 hover:text-[#0D9488] transition-colors" data-testid="button-edit-opp-pkg"><Pencil className="w-3 h-3" /></button>
                    </div>
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
                        {new Date(nextTask.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}{nextTask.followUpTime ? ` at ${formatTaskTimeDisplay(nextTask.dueDate, nextTask.followUpTime, nextTask.followUpTimezone)}` : ""}
                      </span>
                    ) : (
                      <span className="text-gray-400">{t.pipeline.noTaskScheduled}</span>
                    )}
                  </p>
                </div>
              </div>

              {/* CONTACT GROUP */}
              <div className="pt-3 border-t text-sm">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Contact</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">

                  {/* First Name */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">{t.crm.firstName}</p>
                    <div className="flex items-center gap-1">
                      {editingOppFirstName ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Input value={editOppFirstName} onChange={(e) => setEditOppFirstName(e.target.value)}
                            className="h-7 text-xs flex-1" data-testid="input-opp-first-name" />
                          <Button size="sm" className="h-7 px-2 text-xs bg-[#0D9488] hover:bg-[#0b7a70] text-white"
                            disabled={updateOppContactMutation.isPending || !editOppFirstName.trim()}
                            onClick={() => updateOppContactMutation.mutate({ firstName: editOppFirstName.trim() }, { onSuccess: () => setEditingOppFirstName(false) })}
                            data-testid="button-save-opp-first-name">
                            {updateOppContactMutation.isPending ? "…" : t.common.save}
                          </Button>
                          <button onClick={() => setEditingOppFirstName(false)} className="text-gray-400 hover:text-gray-600" data-testid="button-cancel-opp-first-name"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium text-gray-800" data-testid="text-opp-first-name">{contact?.firstName || "—"}</span>
                          {contact && <button onClick={() => { setEditOppFirstName(contact.firstName); setEditingOppFirstName(true); }} className="ml-1 text-gray-300 hover:text-[#0D9488] transition-colors" data-testid="button-edit-opp-first-name"><Pencil className="w-3 h-3" /></button>}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Last Name */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">{t.crm.lastName}</p>
                    <div className="flex items-center gap-1">
                      {editingOppLastName ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Input value={editOppLastName} onChange={(e) => setEditOppLastName(e.target.value)}
                            className="h-7 text-xs flex-1" data-testid="input-opp-last-name" />
                          <Button size="sm" className="h-7 px-2 text-xs bg-[#0D9488] hover:bg-[#0b7a70] text-white"
                            disabled={updateOppContactMutation.isPending}
                            onClick={() => updateOppContactMutation.mutate({ lastName: editOppLastName.trim() || null }, { onSuccess: () => setEditingOppLastName(false) })}
                            data-testid="button-save-opp-last-name">
                            {updateOppContactMutation.isPending ? "…" : t.common.save}
                          </Button>
                          <button onClick={() => setEditingOppLastName(false)} className="text-gray-400 hover:text-gray-600" data-testid="button-cancel-opp-last-name"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium text-gray-800" data-testid="text-opp-last-name">{contact?.lastName || "—"}</span>
                          {contact && <button onClick={() => { setEditOppLastName(contact.lastName ?? ""); setEditingOppLastName(true); }} className="ml-1 text-gray-300 hover:text-[#0D9488] transition-colors" data-testid="button-edit-opp-last-name"><Pencil className="w-3 h-3" /></button>}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Phone className="w-3 h-3" />{t.pipeline.phone}</p>
                    <div className="flex items-center gap-1">
                      {editingOppPhone ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Input value={editOppPhone} onChange={(e) => setEditOppPhone(e.target.value)}
                            className="h-7 text-xs flex-1" data-testid="input-opp-phone" type="tel" />
                          <Button size="sm" className="h-7 px-2 text-xs bg-[#0D9488] hover:bg-[#0b7a70] text-white"
                            disabled={updateOppContactMutation.isPending}
                            onClick={() => updateOppContactMutation.mutate({ phone: editOppPhone.trim() || null }, { onSuccess: () => setEditingOppPhone(false) })}
                            data-testid="button-save-opp-phone">
                            {updateOppContactMutation.isPending ? "…" : t.common.save}
                          </Button>
                          <button onClick={() => setEditingOppPhone(false)} className="text-gray-400 hover:text-gray-600" data-testid="button-cancel-opp-phone"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <>
                          {resolvedPhone ? <a href={`tel:${resolvedPhone}`} data-testid="link-phone" className="font-medium text-gray-800 hover:text-[#0D9488]">{resolvedPhone}</a> : <span className="text-gray-400">—</span>}
                          {contact && <button onClick={() => { setEditOppPhone(contact.phone ?? ""); setEditingOppPhone(true); }} className="ml-1 text-gray-300 hover:text-[#0D9488] transition-colors" data-testid="button-edit-opp-phone"><Pencil className="w-3 h-3" /></button>}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Mail className="w-3 h-3" />{t.pipeline.email}</p>
                    <div className="flex items-center gap-1">
                      {editingOppEmail ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Input value={editOppEmail} onChange={(e) => setEditOppEmail(e.target.value)}
                            className="h-7 text-xs flex-1" data-testid="input-opp-email" type="email" />
                          <Button size="sm" className="h-7 px-2 text-xs bg-[#0D9488] hover:bg-[#0b7a70] text-white"
                            disabled={updateOppContactMutation.isPending}
                            onClick={() => updateOppContactMutation.mutate({ email: editOppEmail.trim() || null }, { onSuccess: () => setEditingOppEmail(false) })}
                            data-testid="button-save-opp-email">
                            {updateOppContactMutation.isPending ? "…" : t.common.save}
                          </Button>
                          <button onClick={() => setEditingOppEmail(false)} className="text-gray-400 hover:text-gray-600" data-testid="button-cancel-opp-email"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <>
                          {resolvedEmail ? <a href={`mailto:${resolvedEmail}`} data-testid="link-email" className="font-medium text-gray-800 hover:text-[#0D9488] truncate block">{resolvedEmail}</a> : <span className="text-gray-400">—</span>}
                          {contact && <button onClick={() => { setEditOppEmail(contact.email ?? ""); setEditingOppEmail(true); }} className="ml-1 text-gray-300 hover:text-[#0D9488] transition-colors flex-shrink-0" data-testid="button-edit-opp-email"><Pencil className="w-3 h-3" /></button>}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Preferred Language */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">{t.pipeline.preferredLanguage}</p>
                    <div className="flex items-center gap-1">
                      {editingOppLang ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Select value={editOppLang} onValueChange={setEditOppLang}>
                            <SelectTrigger className="h-7 text-xs flex-1" data-testid="select-opp-lang">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="es">{t.pipeline.langEs}</SelectItem>
                              <SelectItem value="en">{t.pipeline.langEn}</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button size="sm" className="h-7 px-2 text-xs bg-[#0D9488] hover:bg-[#0b7a70] text-white"
                            disabled={updateOppContactMutation.isPending}
                            onClick={() => updateOppContactMutation.mutate({ preferredLanguage: editOppLang }, { onSuccess: () => setEditingOppLang(false) })}
                            data-testid="button-save-opp-lang">
                            {updateOppContactMutation.isPending ? "…" : t.common.save}
                          </Button>
                          <button onClick={() => setEditingOppLang(false)} className="text-gray-400 hover:text-gray-600" data-testid="button-cancel-opp-lang"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium text-gray-800" data-testid="text-preferred-language">
                            {resolvedLang === "en" ? t.pipeline.langEn : resolvedLang === "es" ? t.pipeline.langEs : resolvedLang || "—"}
                          </span>
                          {contact && <button onClick={() => { setEditOppLang(resolvedLang ?? "es"); setEditingOppLang(true); }} className="ml-1 text-gray-300 hover:text-[#0D9488] transition-colors" data-testid="button-edit-opp-lang"><Pencil className="w-3 h-3" /></button>}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Contact Title */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Title</p>
                    <div className="flex items-center gap-1">
                      {editingOppContactTitle ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Input value={editOppContactTitle} onChange={(e) => setEditOppContactTitle(e.target.value)}
                            className="h-7 text-xs flex-1" placeholder="e.g. Owner" data-testid="input-opp-contact-title" />
                          <Button size="sm" className="h-7 px-2 text-xs bg-[#0D9488] hover:bg-[#0b7a70] text-white"
                            disabled={updateOppContactMutation.isPending}
                            onClick={() => updateOppContactMutation.mutate({ title: editOppContactTitle.trim() || null }, { onSuccess: () => setEditingOppContactTitle(false) })}
                            data-testid="button-save-opp-contact-title">
                            {updateOppContactMutation.isPending ? "…" : t.common.save}
                          </Button>
                          <button onClick={() => setEditingOppContactTitle(false)} className="text-gray-400 hover:text-gray-600" data-testid="button-cancel-opp-contact-title"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium text-gray-800" data-testid="text-opp-contact-title">{contact?.title || "—"}</span>
                          {contact && <button onClick={() => { setEditOppContactTitle(contact.title ?? ""); setEditingOppContactTitle(true); }} className="ml-1 text-gray-300 hover:text-[#0D9488] transition-colors" data-testid="button-edit-opp-contact-title"><Pencil className="w-3 h-3" /></button>}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* BUSINESS GROUP */}
              <div className="pt-3 border-t text-sm">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Business</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">

                  {/* Business Name */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Building2 className="w-3 h-3" />{t.pipeline.company}</p>
                    <div className="flex items-center gap-1">
                      {editingOppBizName ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Input value={editOppBizName} onChange={(e) => setEditOppBizName(e.target.value)}
                            className="h-7 text-xs flex-1" data-testid="input-opp-biz-name" />
                          <Button size="sm" className="h-7 px-2 text-xs bg-[#0D9488] hover:bg-[#0b7a70] text-white"
                            disabled={updateOppCompanyMutation.isPending || !editOppBizName.trim()}
                            onClick={() => updateOppCompanyMutation.mutate({ name: editOppBizName.trim() }, { onSuccess: () => setEditingOppBizName(false) })}
                            data-testid="button-save-opp-biz-name">
                            {updateOppCompanyMutation.isPending ? "…" : t.common.save}
                          </Button>
                          <button onClick={() => setEditingOppBizName(false)} className="text-gray-400 hover:text-gray-600" data-testid="button-cancel-opp-biz-name"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium text-gray-800" data-testid="text-opp-biz-name">{company?.name || "—"}</span>
                          {company && <button onClick={() => { setEditOppBizName(company.name); setEditingOppBizName(true); }} className="ml-1 text-gray-300 hover:text-[#0D9488] transition-colors" data-testid="button-edit-opp-biz-name"><Pencil className="w-3 h-3" /></button>}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Industry */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">{t.pipeline.industry}</p>
                    <div className="flex items-center gap-1">
                      {editingOppIndustry ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Select value={editOppIndustry} onValueChange={setEditOppIndustry}>
                            <SelectTrigger className="h-7 text-xs flex-1" data-testid="select-opp-industry">
                              <SelectValue placeholder={t.crm.selectBusinessTrade} />
                            </SelectTrigger>
                            <SelectContent>
                              {BUSINESS_TRADES.map((trade) => (
                                <SelectItem key={trade} value={trade}>
                                  {(t.crm.trades as Record<string, string>)[trade] ?? trade}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button size="sm" className="h-7 px-2 text-xs bg-[#0D9488] hover:bg-[#0b7a70] text-white"
                            disabled={updateOppCompanyMutation.isPending || !editOppIndustry}
                            onClick={() => updateOppCompanyMutation.mutate({ industry: editOppIndustry }, { onSuccess: () => setEditingOppIndustry(false) })}
                            data-testid="button-save-opp-industry">
                            {updateOppCompanyMutation.isPending ? "…" : t.common.save}
                          </Button>
                          <button onClick={() => setEditingOppIndustry(false)} className="text-gray-400 hover:text-gray-600" data-testid="button-cancel-opp-industry"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium text-gray-800" data-testid="text-industry">{resolvedIndustry || "—"}</span>
                          {company && <button onClick={() => { setEditOppIndustry(company.industry ?? ""); setEditingOppIndustry(true); }} className="ml-1 text-gray-300 hover:text-[#0D9488] transition-colors" data-testid="button-edit-opp-industry"><Pencil className="w-3 h-3" /></button>}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Website */}
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 mb-1">{t.common.website}</p>
                    <div className="flex items-center gap-1">
                      {editingOppWebsite ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Input value={editOppWebsite} onChange={(e) => setEditOppWebsite(e.target.value)}
                            className="h-7 text-xs flex-1" data-testid="input-opp-website" placeholder="https://" />
                          <Button size="sm" className="h-7 px-2 text-xs bg-[#0D9488] hover:bg-[#0b7a70] text-white"
                            disabled={updateOppCompanyMutation.isPending}
                            onClick={() => updateOppCompanyMutation.mutate({ website: editOppWebsite.trim() || null }, { onSuccess: () => setEditingOppWebsite(false) })}
                            data-testid="button-save-opp-website">
                            {updateOppCompanyMutation.isPending ? "…" : t.common.save}
                          </Button>
                          <button onClick={() => setEditingOppWebsite(false)} className="text-gray-400 hover:text-gray-600" data-testid="button-cancel-opp-website"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <>
                          {company?.website ? (
                            <a href={company.website} target="_blank" rel="noopener noreferrer" className="font-medium text-[#0D9488] hover:underline truncate" data-testid="text-opp-website">{company.website}</a>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                          {company && <button onClick={() => { setEditOppWebsite(company.website ?? ""); setEditingOppWebsite(true); }} className="ml-1 text-gray-300 hover:text-[#0D9488] transition-colors flex-shrink-0" data-testid="button-edit-opp-website"><Pencil className="w-3 h-3" /></button>}
                        </>
                      )}
                    </div>
                  </div>

                  {/* DBA */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">DBA</p>
                    <div className="flex items-center gap-1">
                      {editingOppDba ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Input value={editOppDba} onChange={(e) => setEditOppDba(e.target.value)}
                            className="h-7 text-xs flex-1" placeholder="Doing business as" data-testid="input-opp-dba" />
                          <Button size="sm" className="h-7 px-2 text-xs bg-[#0D9488] hover:bg-[#0b7a70] text-white"
                            disabled={updateOppCompanyMutation.isPending}
                            onClick={() => updateOppCompanyMutation.mutate({ dba: editOppDba.trim() || null }, { onSuccess: () => setEditingOppDba(false) })}
                            data-testid="button-save-opp-dba">
                            {updateOppCompanyMutation.isPending ? "…" : t.common.save}
                          </Button>
                          <button onClick={() => setEditingOppDba(false)} className="text-gray-400 hover:text-gray-600" data-testid="button-cancel-opp-dba"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium text-gray-800" data-testid="text-opp-dba">{company?.dba || "—"}</span>
                          {company && <button onClick={() => { setEditOppDba(company.dba ?? ""); setEditingOppDba(true); }} className="ml-1 text-gray-300 hover:text-[#0D9488] transition-colors" data-testid="button-edit-opp-dba"><Pencil className="w-3 h-3" /></button>}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* LOCATION GROUP */}
              <div className="pt-3 border-t text-sm">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Location</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">

                  {/* City */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{t.common.city}</p>
                    <div className="flex items-center gap-1">
                      {editingOppCity ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Input value={editOppCityValue} onChange={(e) => setEditOppCityValue(e.target.value)}
                            placeholder="City" className="h-7 text-xs flex-1" data-testid="input-opp-city" />
                          <Button size="sm" className="h-7 px-2 text-xs bg-[#0D9488] hover:bg-[#0b7a70] text-white"
                            disabled={updateOppLeadMutation.isPending}
                            onClick={() => updateOppLeadMutation.mutate({ city: editOppCityValue.trim() || null }, { onSuccess: () => setEditingOppCity(false) })}
                            data-testid="button-save-opp-city">
                            {updateOppLeadMutation.isPending ? "…" : t.common.save}
                          </Button>
                          <button onClick={() => setEditingOppCity(false)} className="text-gray-400 hover:text-gray-600" data-testid="button-cancel-opp-city"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium text-gray-800" data-testid="text-opp-city">{sourceLead?.city || "—"}</span>
                          {sourceLead && <button onClick={() => { setEditOppCityValue(sourceLead.city ?? ""); setEditingOppCity(true); }} className="ml-1 text-gray-300 hover:text-[#0D9488] transition-colors" data-testid="button-edit-opp-city"><Pencil className="w-3 h-3" /></button>}
                        </>
                      )}
                    </div>
                  </div>

                  {/* State */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">{t.common.state}</p>
                    <div className="flex items-center gap-1">
                      {editingOppState ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Select value={editOppStateValue} onValueChange={setEditOppStateValue}>
                            <SelectTrigger className="h-7 text-xs flex-1" data-testid="select-opp-state">
                              <SelectValue placeholder="State" />
                            </SelectTrigger>
                            <SelectContent>
                              {US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button size="sm" className="h-7 px-2 text-xs bg-[#0D9488] hover:bg-[#0b7a70] text-white"
                            disabled={updateOppLeadMutation.isPending}
                            onClick={() => updateOppLeadMutation.mutate({ state: editOppStateValue || null }, { onSuccess: () => setEditingOppState(false) })}
                            data-testid="button-save-opp-state">
                            {updateOppLeadMutation.isPending ? "…" : t.common.save}
                          </Button>
                          <button onClick={() => setEditingOppState(false)} className="text-gray-400 hover:text-gray-600" data-testid="button-cancel-opp-state"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium text-gray-800" data-testid="text-opp-state">{sourceLead?.state || "—"}</span>
                          {sourceLead && <button onClick={() => { setEditOppStateValue(sourceLead.state ?? ""); setEditingOppState(true); }} className="ml-1 text-gray-300 hover:text-[#0D9488] transition-colors" data-testid="button-edit-opp-state"><Pencil className="w-3 h-3" /></button>}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* LEAD GROUP */}
              <div className="pt-3 border-t text-sm">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Lead</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {/* Source — display only */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">{t.pipeline.source}</p>
                    <span className="font-medium text-gray-800" data-testid="text-source">{resolvedSource || "—"}</span>
                  </div>

                  {/* Lead title link */}
                  {sourceLead?.title && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">CRM Lead</p>
                      <a href={`/admin/crm/leads/${sourceLead.id}`} className="font-medium text-[#0D9488] hover:underline" data-testid="link-source-lead">
                        {sourceLead.title}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {stages && opp.status === "open" && (
                <div className="pt-3 border-t">
                  <p className="text-xs text-gray-400 mb-2">{t.pipeline.moveToStage}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {stages.map(stage => (
                      <Button
                        key={stage.id}
                        size="sm"
                        variant={stage.id === opp.stageId ? "default" : "outline"}
                        className="text-xs h-7"
                        style={stage.id === opp.stageId ? { backgroundColor: stage.color } : { borderColor: stage.color, color: stage.color }}
                        onClick={() => {
                          if (stage.id === opp.stageId) return;
                          if (stage.slug === "contacted") {
                            setContactedPendingStageId(stage.id);
                          } else if (stage.slug === "payment-sent") {
                            setPaymentSentPendingStageId(stage.id);
                          } else {
                            stageMutation.mutate(stage.id);
                          }
                        }}
                        disabled={stageMutation.isPending}
                        data-testid={`button-stage-${stage.slug}`}
                      >
                        {(t.pipeline.stageNames as Record<string, string>)[stage.slug] || stage.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t">
                <div className="flex items-center gap-1 mb-1">
                  <p className="text-xs text-gray-400">Notes</p>
                  {!editingOppNotes && (
                    <button onClick={() => { setEditOppNotesValue(opp.notes ?? ""); setEditingOppNotes(true); }} className="text-gray-300 hover:text-[#0D9488] transition-colors" data-testid="button-edit-opp-notes"><Pencil className="w-3 h-3" /></button>
                  )}
                </div>
                {editingOppNotes ? (
                  <div className="space-y-2">
                    <Textarea value={editOppNotesValue} onChange={(e) => setEditOppNotesValue(e.target.value)} rows={4} className="text-sm" data-testid="textarea-opp-notes" />
                    <div className="flex gap-1">
                      <Button size="sm" className="h-7 px-2 text-xs bg-[#0D9488] hover:bg-[#0b7a70] text-white"
                        disabled={updateOppMutation.isPending}
                        onClick={() => updateOppMutation.mutate({ notes: editOppNotesValue.trim() || null }, { onSuccess: () => setEditingOppNotes(false) })}
                        data-testid="button-save-opp-notes">
                        {updateOppMutation.isPending ? "…" : t.common.save}
                      </Button>
                      <button onClick={() => setEditingOppNotes(false)} className="text-gray-400 hover:text-gray-600 flex items-center" data-testid="button-cancel-opp-notes"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ) : (
                  opp.notes ? (
                    <div className="text-sm text-gray-700 chat-message-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(opp.notes) }} />
                  ) : (
                    <span className="text-gray-400 text-sm">—</span>
                  )
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.pipeline.activityTimeline}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-5">
                <Select value={noteType} onValueChange={setNoteType}>
                  <SelectTrigger className="w-[130px]" data-testid="select-activity-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="note">{t.pipeline.activity.note}</SelectItem>
                    <SelectItem value="call">{t.pipeline.activity.call}</SelectItem>
                    <SelectItem value="email">{t.pipeline.activity.email}</SelectItem>
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
                            <span className="text-xs text-gray-400 capitalize">{getActivityTypeLabel(act.type, t)}</span>
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
                        ) : (act.metadata as any)?.event ? (
                          <p className="text-sm text-gray-700 mt-1">
                            {renderActivityContent(act, t)}
                          </p>
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
                  <p className="text-sm text-gray-400 text-center py-4">{t.pipeline.noActivity}</p>
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
                  {t.pipeline.tasks}
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
                  {t.common.add}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {(!tasks || tasks.length === 0) ? (
                <p className="text-xs text-gray-400 text-center py-2">{t.pipeline.noTasksYet}</p>
              ) : (
                sortedTasks.map(task => {
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
                        onClick={() => !task.completed && setCompletingTask(task)}
                        disabled={task.completed}
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
                          {renderTaskTitle(task, t)}
                        </p>
                        <div className={`flex items-center gap-1 mt-0.5 ${isOverdue ? "text-red-500" : "text-gray-400"}`}>
                          {isOverdue && <AlertCircle className="w-3 h-3 flex-shrink-0" />}
                          <span>{new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}{task.followUpTime ? ` at ${formatTaskTimeDisplay(task.dueDate, task.followUpTime, task.followUpTimezone)}` : ""}</span>
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
              <CardTitle className="text-sm">{t.common.created}</CardTitle>
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
                {t.pipeline.history}
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
        leadTimezone={sourceLead?.timezone ?? null}
        defaultTitle={`Follow up with ${contact?.firstName ?? ""} ${contact?.lastName ?? ""}`.trim()}
        editTask={rescheduleTask ? {
          id: rescheduleTask.id,
          title: rescheduleTask.title,
          notes: rescheduleTask.notes,
          dueDate: rescheduleTask.dueDate.toString(),
          followUpTime: rescheduleTask.followUpTime ?? null,
          followUpTimezone: rescheduleTask.followUpTimezone ?? null,
        } : null}
      />
      <CompleteTaskModal
        open={contactedPendingStageId !== null}
        onClose={() => setContactedPendingStageId(null)}
        task={null}
        opportunityId={id}
        contactId={opp.contactId ?? null}
        leadTimezone={sourceLead?.timezone ?? null}
        defaultTaskTitle={`Follow up with ${contact?.firstName ?? ""} ${contact?.lastName ?? ""}`.trim()}
        onSuccess={() => {
          if (contactedPendingStageId) stageMutation.mutate(contactedPendingStageId);
        }}
      />
      <PaymentSentModal
        open={paymentSentPendingStageId !== null}
        onClose={() => setPaymentSentPendingStageId(null)}
        opportunityId={id}
        onSuccess={() => {
          if (paymentSentPendingStageId) stageMutation.mutate(paymentSentPendingStageId);
        }}
      />
      <CompleteTaskModal
        open={!!completingTask}
        onClose={() => setCompletingTask(null)}
        task={completingTask}
        leadTimezone={sourceLead?.timezone ?? null}
      />

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto" data-testid="dialog-delete-opportunity">
          <DialogHeader>
            <DialogTitle>{t.pipeline.deleteOpportunity}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            {t.pipeline.deleteOpportunityConfirm}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} data-testid="button-cancel-delete">{t.common.cancel}</Button>
            <Button
              variant="destructive"
              onClick={() => { deleteMutation.mutate(); setDeleteConfirmOpen(false); }}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? t.common.deleting : t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

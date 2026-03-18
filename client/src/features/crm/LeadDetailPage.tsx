import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, Building2, User, Globe, Phone, Mail, MapPin,
  Calendar, Tag, MessageSquare, PhoneCall, MailIcon, ClipboardList,
  RefreshCw, Bot, Send, ExternalLink, TrendingUp,
  Plus, CheckCircle, CheckCheck, Clock, AlertCircle, Monitor, Pencil, Loader2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import RichTextEditorField from "@/features/chat/RichTextEditorField";
import { sanitizeHtml } from "@/features/chat/RichTextEditor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryClient, apiRequest, STALE } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CrmLead, CrmLeadStatus, CrmContact, CrmCompany, CrmLeadNote, CrmTag, PipelineStage, FollowupTask, PipelineOpportunity, DemoConfig } from "@shared/schema";
import QuickTaskModal, { formatTaskTimeDisplay } from "@/components/QuickTaskModal";
import CompleteTaskModal from "@/components/CompleteTaskModal";
import { RecordTimeline } from "@/components/RecordTimeline";
import { useAdminLang } from "@/i18n/LanguageContext";
import { renderActivityContent, renderTaskTitle } from "@/lib/activityI18n";
import { US_STATES } from "@/lib/usStates";
import { BUSINESS_TRADES } from "@/features/crm/CreateLeadModal";

type TaskWithContact = FollowupTask & {
  contact: { firstName: string; lastName: string | null; phone: string | null } | null;
  company: { name: string } | null;
};

interface LeadDetail extends CrmLead {
  contact?: CrmContact | null;
  company?: CrmCompany | null;
  status?: CrmLeadStatus | null;
}

const NOTE_TYPE_ICONS: Record<string, any> = {
  note: MessageSquare,
  call: PhoneCall,
  email: MailIcon,
  task: ClipboardList,
  status_change: RefreshCw,
  system: Bot,
};

const NOTE_TYPE_BADGE: Record<string, { badge: string; iconBg: string; icon: string }> = {
  note:          { badge: "bg-blue-100 text-blue-700 border-blue-200",      iconBg: "bg-blue-100",   icon: "text-blue-500" },
  call:          { badge: "bg-green-100 text-green-700 border-green-200",   iconBg: "bg-green-100",  icon: "text-green-500" },
  email:         { badge: "bg-violet-100 text-violet-700 border-violet-200",iconBg: "bg-violet-100", icon: "text-violet-500" },
  task:          { badge: "bg-amber-100 text-amber-700 border-amber-200",   iconBg: "bg-amber-100",  icon: "text-amber-500" },
  status_change: { badge: "bg-teal-100 text-teal-700 border-teal-200",     iconBg: "bg-teal-100",   icon: "text-teal-500" },
  system:        { badge: "bg-gray-100 text-gray-600 border-gray-200",     iconBg: "bg-gray-100",   icon: "text-gray-400" },
};

export default function LeadDetailPage({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useAdminLang();

  const NOTE_TYPE_LABELS: Record<string, string> = {
    note: t.crm.note,
    call: t.crm.call,
    email: t.crm.email,
    task: t.crm.task,
    status_change: t.crm.statusChange,
    system: t.crm.system,
  };
  const [noteContent, setNoteContent] = useState("");
  const [noteType, setNoteType] = useState("note");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [rescheduleTask, setRescheduleTask] = useState<TaskWithContact | null>(null);
  const [editingCity, setEditingCity] = useState(false);
  const [editCityValue, setEditCityValue] = useState("");
  const [editingState, setEditingState] = useState(false);
  const [editStateValue, setEditStateValue] = useState("");
  const [editingContactTitle, setEditingContactTitle] = useState(false);
  const [editContactTitleValue, setEditContactTitleValue] = useState("");
  const [editingDba, setEditingDba] = useState(false);
  const [editDbaValue, setEditDbaValue] = useState("");
  const [editingIndustry, setEditingIndustry] = useState(false);
  const [editIndustryValue, setEditIndustryValue] = useState("");
  const [editingLang, setEditingLang] = useState(false);
  const [editLangValue, setEditLangValue] = useState("");
  const [editingFirstName, setEditingFirstName] = useState(false);
  const [editFirstNameValue, setEditFirstNameValue] = useState("");
  const [editingLastName, setEditingLastName] = useState(false);
  const [editLastNameValue, setEditLastNameValue] = useState("");
  const [editingPhone, setEditingPhone] = useState(false);
  const [editPhoneValue, setEditPhoneValue] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  const [editEmailValue, setEditEmailValue] = useState("");
  const [editingBusinessName, setEditingBusinessName] = useState(false);
  const [editBusinessNameValue, setEditBusinessNameValue] = useState("");
  const [editingWebsite, setEditingWebsite] = useState(false);
  const [editWebsiteValue, setEditWebsiteValue] = useState("");

  const { data: lead, isLoading: leadLoading } = useQuery<LeadDetail>({
    queryKey: ["/api/crm/leads", id],
    queryFn: async () => {
      const res = await fetch(`/api/crm/leads/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch lead");
      return res.json();
    },
  });

  const { data: statuses = [] } = useQuery<CrmLeadStatus[]>({
    queryKey: ["/api/crm/statuses"],
  });

  const { data: notes = [] } = useQuery<CrmLeadNote[]>({
    queryKey: ["/api/crm/leads", id, "notes"],
    queryFn: async () => {
      const res = await fetch(`/api/crm/leads/${id}/notes`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch notes");
      return res.json();
    },
  });

  const { data: leadTags = [] } = useQuery<CrmTag[]>({
    queryKey: ["/api/crm/leads", id, "tags"],
    queryFn: async () => {
      const res = await fetch(`/api/crm/leads/${id}/tags`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tags");
      return res.json();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (statusId: string) => {
      await apiRequest("PUT", `/api/crm/leads/${id}`, { statusId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", id, "notes"] });
    },
  });

  const updateLeadFieldMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      await apiRequest("PUT", `/api/crm/leads/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", id] });
      toast({ title: t.common.success });
    },
    onError: (err: any) => {
      toast({ title: err.message ?? t.common.error, variant: "destructive" });
    },
  });

  const updateIndustryMutation = useMutation({
    mutationFn: async (industry: string) => {
      await apiRequest("PUT", `/api/crm/companies/${lead?.companyId}`, { industry });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", id] });
      setEditingIndustry(false);
    },
    onError: (err: any) => {
      toast({ title: err.message ?? t.common.error, variant: "destructive" });
    },
  });

  const updateLangMutation = useMutation({
    mutationFn: async (preferredLanguage: string) => {
      await apiRequest("PUT", `/api/crm/contacts/${lead?.contactId}`, { preferredLanguage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", id] });
      setEditingLang(false);
    },
    onError: (err: any) => {
      toast({ title: err.message ?? t.common.error, variant: "destructive" });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      await apiRequest("PUT", `/api/crm/contacts/${lead?.contactId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", id] });
      toast({ title: t.common.success });
    },
    onError: (err: any) => {
      toast({ title: err.message ?? t.common.error, variant: "destructive" });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      await apiRequest("PUT", `/api/crm/companies/${lead?.companyId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", id] });
      toast({ title: t.common.success });
    },
    onError: (err: any) => {
      toast({ title: err.message ?? t.common.error, variant: "destructive" });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/crm/leads/${id}/notes`, {
        content: noteContent,
        type: noteType,
        leadId: id,
      });
    },
    onSuccess: () => {
      setNoteContent("");
      setNoteType("note");
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", id, "notes"] });
    },
  });

  const { data: pipelineStages } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline/stages"],
  });

  const { data: tasks } = useQuery<TaskWithContact[]>({
    queryKey: ["/api/tasks/for-lead", id],
  });

  const { data: demoConfigs = [] } = useQuery<DemoConfig[]>({
    queryKey: ["/api/demo-configs/by-lead", id],
    queryFn: async () => {
      const res = await fetch(`/api/demo-configs?leadId=${id}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: STALE.MEDIUM,
  });

  const { data: linkedOpportunity } = useQuery<PipelineOpportunity | null>({
    queryKey: ["/api/pipeline/opportunities/by-lead", id],
    queryFn: async () => {
      const res = await fetch(`/api/pipeline/opportunities/by-lead/${id}`, { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      return data;
    },
    staleTime: STALE.MEDIUM,
    enabled: !!id,
  });

  const [completingTask, setCompletingTask] = useState<FollowupTask | null>(null);

  const convertMutation = useMutation({
    mutationFn: async (stageId: string) => {
      const res = await apiRequest("POST", `/api/pipeline/convert-lead/${id}`, { stageId });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities/by-lead", id] });
      toast({ title: "Converted to opportunity" });
      navigate(`/admin/pipeline/opportunities/${data.id}`);
    },
    onError: async (err: any) => {
      if (err?.response?.status === 409) {
        const body = await err.response.json().catch(() => ({}));
        const oppId = body?.opportunityId;
        toast({ title: "Already converted", description: "This lead has already been converted to an opportunity.", variant: "destructive" });
        if (oppId) navigate(`/admin/pipeline/opportunities/${oppId}`);
        queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities/by-lead", id] });
      } else {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    },
  });

  if (leadLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Lead not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/crm")} data-testid="button-back-to-leads">
          Back to Leads
        </Button>
      </div>
    );
  }

  const contactName = lead.contact
    ? [lead.contact.firstName, lead.contact.lastName].filter(Boolean).join(" ")
    : null;

  const sortedTasks = tasks ? [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (!a.completed) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    const aTime = a.completedAt ? new Date(a.completedAt).getTime() : new Date(a.dueDate).getTime();
    const bTime = b.completedAt ? new Date(b.completedAt).getTime() : new Date(b.dueDate).getTime();
    return bTime - aTime;
  }) : [];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/crm")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate" data-testid="text-lead-title">
            {lead.title}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Created {new Date(lead.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
          {lead.value && (
            <span className="text-lg font-semibold text-gray-900" data-testid="text-lead-value">
              ${Number(lead.value).toLocaleString()}
            </span>
          )}
          {linkedOpportunity ? (
            <Link href={`/admin/pipeline/opportunities/${linkedOpportunity.id}`} data-testid="link-view-opportunity">
              <Button variant="outline" size="sm" className="border-teal-500 text-teal-700 hover:bg-teal-50 gap-1.5">
                <TrendingUp className="w-4 h-4" />
                View Opportunity
                <ExternalLink className="w-3 h-3" />
              </Button>
            </Link>
          ) : (
            pipelineStages && pipelineStages.length > 0 && (
              <Select
                onValueChange={(stageId) => convertMutation.mutate(stageId)}
                disabled={convertMutation.isPending}
              >
                <SelectTrigger className="w-auto" data-testid="button-convert-opportunity">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" />
                    <span>{convertMutation.isPending ? t.common.saving : t.crm.convertToOpportunity}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {pipelineStages.filter(s => !s.isClosed).map(stage => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                        {(t.pipeline.stageNames as Record<string, string>)[stage.slug] || stage.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <h2 className="font-semibold text-gray-900">Lead Details</h2>
              <Select
                value={lead.statusId || ""}
                onValueChange={(v) => updateStatusMutation.mutate(v)}
              >
                <SelectTrigger className="w-full md:w-[180px]" data-testid="select-lead-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                        {(t.crm.statusNames as Record<string, string>)[s.slug] || s.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-5 text-sm">
              {/* Status & Source */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 mb-1">Status</p>
                  {lead.status ? (
                    <Badge
                      variant="outline"
                      style={{ borderColor: lead.status.color, color: lead.status.color }}
                      data-testid="badge-lead-status"
                    >
                      {(t.crm.statusNames as Record<string, string>)[lead.status.slug] || lead.status.name}
                    </Badge>
                  ) : (
                    <span className="text-gray-400">No status</span>
                  )}
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Source</p>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900" data-testid="text-lead-source">{lead.sourceLabel || lead.source || "Unknown"}</span>
                    {lead.fromWebsiteForm && (
                      <Badge variant="secondary" className="text-xs">
                        <Globe className="w-3 h-3 mr-1" />
                        Web Form
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* CONTACT GROUP */}
              <div className="pt-4 border-t border-gray-100">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Contact</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* First Name */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-gray-500">{t.crm.firstName}</p>
                      {lead.contact && !editingFirstName && (
                        <button
                          onClick={() => { setEditFirstNameValue(lead.contact!.firstName); setEditingFirstName(true); }}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          data-testid="button-edit-first-name" aria-label="Edit first name"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {editingFirstName ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={editFirstNameValue}
                          onChange={(e) => setEditFirstNameValue(e.target.value)}
                          className="h-8 text-sm flex-1"
                          data-testid="input-edit-first-name"
                        />
                        <Button size="sm" variant="default" className="h-8 px-3"
                          disabled={updateContactMutation.isPending || !editFirstNameValue.trim()}
                          onClick={() => updateContactMutation.mutate({ firstName: editFirstNameValue.trim() }, { onSuccess: () => setEditingFirstName(false) })}
                          data-testid="button-save-first-name"
                        >
                          {updateContactMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.common.save}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2"
                          onClick={() => setEditingFirstName(false)} data-testid="button-cancel-first-name"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-gray-900" data-testid="text-lead-first-name">{lead.contact?.firstName || "—"}</p>
                    )}
                  </div>

                  {/* Last Name */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-gray-500">{t.crm.lastName}</p>
                      {lead.contact && !editingLastName && (
                        <button
                          onClick={() => { setEditLastNameValue(lead.contact!.lastName ?? ""); setEditingLastName(true); }}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          data-testid="button-edit-last-name" aria-label="Edit last name"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {editingLastName ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={editLastNameValue}
                          onChange={(e) => setEditLastNameValue(e.target.value)}
                          className="h-8 text-sm flex-1"
                          data-testid="input-edit-last-name"
                        />
                        <Button size="sm" variant="default" className="h-8 px-3"
                          disabled={updateContactMutation.isPending}
                          onClick={() => updateContactMutation.mutate({ lastName: editLastNameValue.trim() || null }, { onSuccess: () => setEditingLastName(false) })}
                          data-testid="button-save-last-name"
                        >
                          {updateContactMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.common.save}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2"
                          onClick={() => setEditingLastName(false)} data-testid="button-cancel-last-name"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-gray-900" data-testid="text-lead-last-name">{lead.contact?.lastName || "—"}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-gray-500">{t.common.phone}</p>
                      {lead.contact && !editingPhone && (
                        <button
                          onClick={() => { setEditPhoneValue(lead.contact!.phone ?? ""); setEditingPhone(true); }}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          data-testid="button-edit-phone" aria-label="Edit phone"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {editingPhone ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={editPhoneValue}
                          onChange={(e) => setEditPhoneValue(e.target.value)}
                          className="h-8 text-sm flex-1"
                          data-testid="input-edit-phone"
                          type="tel"
                        />
                        <Button size="sm" variant="default" className="h-8 px-3"
                          disabled={updateContactMutation.isPending}
                          onClick={() => updateContactMutation.mutate({ phone: editPhoneValue.trim() || null }, { onSuccess: () => setEditingPhone(false) })}
                          data-testid="button-save-phone"
                        >
                          {updateContactMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.common.save}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2"
                          onClick={() => setEditingPhone(false)} data-testid="button-cancel-phone"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-gray-900" data-testid="text-lead-phone">
                        {(lead.contact?.phone || lead.company?.phone) ? (
                          <a href={`tel:${lead.contact?.phone || lead.company?.phone}`} className="text-[#0D9488] hover:underline">
                            {lead.contact?.phone || lead.company?.phone}
                          </a>
                        ) : "—"}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-gray-500">{t.common.email}</p>
                      {lead.contact && !editingEmail && (
                        <button
                          onClick={() => { setEditEmailValue(lead.contact!.email ?? ""); setEditingEmail(true); }}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          data-testid="button-edit-email" aria-label="Edit email"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {editingEmail ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={editEmailValue}
                          onChange={(e) => setEditEmailValue(e.target.value)}
                          className="h-8 text-sm flex-1"
                          data-testid="input-edit-email"
                          type="email"
                        />
                        <Button size="sm" variant="default" className="h-8 px-3"
                          disabled={updateContactMutation.isPending}
                          onClick={() => updateContactMutation.mutate({ email: editEmailValue.trim() || null }, { onSuccess: () => setEditingEmail(false) })}
                          data-testid="button-save-email"
                        >
                          {updateContactMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.common.save}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2"
                          onClick={() => setEditingEmail(false)} data-testid="button-cancel-email"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-gray-900" data-testid="text-lead-email">
                        {(lead.contact?.email || lead.company?.email) ? (
                          <a href={`mailto:${lead.contact?.email || lead.company?.email}`} className="text-[#0D9488] hover:underline truncate block">
                            {lead.contact?.email || lead.company?.email}
                          </a>
                        ) : "—"}
                      </p>
                    )}
                  </div>

                  {/* Preferred Language */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-gray-500">{t.clients.preferredLanguage}</p>
                      {lead.contact && !editingLang && (
                        <button
                          onClick={() => { setEditLangValue(lead.contact?.preferredLanguage ?? "es"); setEditingLang(true); }}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          data-testid="button-edit-lang" aria-label="Edit preferred language"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {editingLang ? (
                      <div className="flex items-center gap-1.5">
                        <Select value={editLangValue} onValueChange={setEditLangValue}>
                          <SelectTrigger className="h-8 text-sm flex-1" data-testid="select-edit-lang">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="es">{t.clients.langSpanish}</SelectItem>
                            <SelectItem value="en">{t.clients.langEnglish}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="default" className="h-8 px-3"
                          disabled={updateLangMutation.isPending}
                          onClick={() => updateLangMutation.mutate(editLangValue)}
                          data-testid="button-save-lang"
                        >
                          {updateLangMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.common.save}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2"
                          disabled={updateLangMutation.isPending}
                          onClick={() => setEditingLang(false)} data-testid="button-cancel-lang"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-gray-900" data-testid="text-lead-lang">
                        {lead.contact?.preferredLanguage === "es"
                          ? t.clients.langSpanish
                          : lead.contact?.preferredLanguage === "en"
                          ? t.clients.langEnglish
                          : "—"}
                      </p>
                    )}
                  </div>

                  {/* Contact title — editable */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-gray-500">Title</p>
                      {lead.contact && !editingContactTitle && (
                        <button
                          onClick={() => { setEditContactTitleValue(lead.contact?.title ?? ""); setEditingContactTitle(true); }}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          data-testid="button-edit-contact-title" aria-label="Edit contact title"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {editingContactTitle ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={editContactTitleValue}
                          onChange={(e) => setEditContactTitleValue(e.target.value)}
                          className="h-8 text-sm flex-1"
                          placeholder="e.g. Owner"
                          data-testid="input-edit-contact-title"
                        />
                        <Button size="sm" variant="default" className="h-8 px-3"
                          disabled={updateContactMutation.isPending}
                          onClick={() => updateContactMutation.mutate({ title: editContactTitleValue.trim() || null }, { onSuccess: () => setEditingContactTitle(false) })}
                          data-testid="button-save-contact-title"
                        >
                          {updateContactMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.common.save}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2"
                          onClick={() => setEditingContactTitle(false)} data-testid="button-cancel-contact-title"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-gray-900" data-testid="text-lead-contact-title">{lead.contact?.title || "—"}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* BUSINESS GROUP */}
              <div className="pt-4 border-t border-gray-100">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Business</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* Business Name */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-gray-500">{t.crm.businessName}</p>
                      {lead.company && !editingBusinessName && (
                        <button
                          onClick={() => { setEditBusinessNameValue(lead.company!.name); setEditingBusinessName(true); }}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          data-testid="button-edit-business-name" aria-label="Edit business name"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {editingBusinessName ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={editBusinessNameValue}
                          onChange={(e) => setEditBusinessNameValue(e.target.value)}
                          className="h-8 text-sm flex-1"
                          data-testid="input-edit-business-name"
                        />
                        <Button size="sm" variant="default" className="h-8 px-3"
                          disabled={updateCompanyMutation.isPending || !editBusinessNameValue.trim()}
                          onClick={() => updateCompanyMutation.mutate({ name: editBusinessNameValue.trim() }, { onSuccess: () => setEditingBusinessName(false) })}
                          data-testid="button-save-business-name"
                        >
                          {updateCompanyMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.common.save}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2"
                          onClick={() => setEditingBusinessName(false)} data-testid="button-cancel-business-name"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-gray-900" data-testid="text-lead-business-name">{lead.company?.name || "—"}</p>
                    )}
                  </div>

                  {/* Industry */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-gray-500">{t.pipeline.industry}</p>
                      {lead.company && !editingIndustry && (
                        <button
                          onClick={() => { setEditIndustryValue(lead.company?.industry ?? ""); setEditingIndustry(true); }}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          data-testid="button-edit-industry" aria-label="Edit industry"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {editingIndustry ? (
                      <div className="flex items-center gap-1.5">
                        <Select value={editIndustryValue} onValueChange={setEditIndustryValue}>
                          <SelectTrigger className="h-8 text-sm flex-1" data-testid="select-edit-industry">
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
                        <Button size="sm" variant="default" className="h-8 px-3"
                          disabled={updateIndustryMutation.isPending || !editIndustryValue}
                          onClick={() => updateIndustryMutation.mutate(editIndustryValue)}
                          data-testid="button-save-industry"
                        >
                          {updateIndustryMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.common.save}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2"
                          disabled={updateIndustryMutation.isPending}
                          onClick={() => setEditingIndustry(false)} data-testid="button-cancel-industry"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-gray-900" data-testid="text-lead-industry">
                        {lead.company?.industry
                          ? (t.crm.trades as Record<string, string>)[lead.company.industry] ?? lead.company.industry
                          : "—"}
                      </p>
                    )}
                  </div>

                  {/* Website */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-gray-500">{t.common.website}</p>
                      {lead.company && !editingWebsite && (
                        <button
                          onClick={() => { setEditWebsiteValue(lead.company?.website ?? ""); setEditingWebsite(true); }}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          data-testid="button-edit-website" aria-label="Edit website"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {editingWebsite ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={editWebsiteValue}
                          onChange={(e) => setEditWebsiteValue(e.target.value)}
                          className="h-8 text-sm flex-1"
                          data-testid="input-edit-website"
                          placeholder="https://"
                        />
                        <Button size="sm" variant="default" className="h-8 px-3"
                          disabled={updateCompanyMutation.isPending}
                          onClick={() => updateCompanyMutation.mutate({ website: editWebsiteValue.trim() || null }, { onSuccess: () => setEditingWebsite(false) })}
                          data-testid="button-save-website"
                        >
                          {updateCompanyMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.common.save}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2"
                          onClick={() => setEditingWebsite(false)} data-testid="button-cancel-website"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-gray-900" data-testid="text-lead-website">
                        {lead.company?.website ? (
                          <a href={lead.company.website} target="_blank" rel="noopener noreferrer" className="text-[#0D9488] hover:underline truncate block">
                            {lead.company.website}
                          </a>
                        ) : "—"}
                      </p>
                    )}
                  </div>

                  {/* Company DBA — editable */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-gray-500">DBA</p>
                      {lead.company && !editingDba && (
                        <button
                          onClick={() => { setEditDbaValue(lead.company?.dba ?? ""); setEditingDba(true); }}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          data-testid="button-edit-dba" aria-label="Edit DBA"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {editingDba ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={editDbaValue}
                          onChange={(e) => setEditDbaValue(e.target.value)}
                          className="h-8 text-sm flex-1"
                          placeholder="Doing business as"
                          data-testid="input-edit-dba"
                        />
                        <Button size="sm" variant="default" className="h-8 px-3"
                          disabled={updateCompanyMutation.isPending}
                          onClick={() => updateCompanyMutation.mutate({ dba: editDbaValue.trim() || null }, { onSuccess: () => setEditingDba(false) })}
                          data-testid="button-save-dba"
                        >
                          {updateCompanyMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.common.save}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2"
                          onClick={() => setEditingDba(false)} data-testid="button-cancel-dba"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-gray-900" data-testid="text-lead-dba">{lead.company?.dba || "—"}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* LOCATION GROUP */}
              <div className="pt-4 border-t border-gray-100">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Location</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* City */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <p className="text-gray-500">{t.common.city}</p>
                      {!editingCity && (
                        <button
                          onClick={() => { setEditCityValue(lead.city ?? (lead.company as any)?.city ?? ""); setEditingCity(true); }}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          data-testid="button-edit-city" aria-label="Edit city"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {editingCity ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={editCityValue}
                          onChange={(e) => setEditCityValue(e.target.value)}
                          placeholder={t.common.city}
                          className="h-8 text-sm flex-1"
                          data-testid="input-edit-city"
                        />
                        <Button size="sm" variant="default" className="h-8 px-3"
                          disabled={updateLeadFieldMutation.isPending}
                          onClick={() => updateLeadFieldMutation.mutate({ city: editCityValue.trim() || null }, { onSuccess: () => setEditingCity(false) })}
                          data-testid="button-save-city"
                        >
                          {updateLeadFieldMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.common.save}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2"
                          onClick={() => setEditingCity(false)} data-testid="button-cancel-city"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-gray-900" data-testid="text-lead-city">
                        {lead.city || (lead.company as any)?.city || <span className="text-gray-400">—</span>}
                      </p>
                    )}
                  </div>

                  {/* State */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-gray-500">{t.common.state}</p>
                      {!editingState && (
                        <button
                          onClick={() => { setEditStateValue(lead.state ?? (lead.company as any)?.state ?? ""); setEditingState(true); }}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          data-testid="button-edit-state" aria-label="Edit state"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {editingState ? (
                      <div className="flex items-center gap-1.5">
                        <Select value={editStateValue} onValueChange={setEditStateValue}>
                          <SelectTrigger className="h-8 text-sm flex-1" data-testid="select-edit-state">
                            <SelectValue placeholder={t.common.state} />
                          </SelectTrigger>
                          <SelectContent>
                            {US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="default" className="h-8 px-3"
                          disabled={updateLeadFieldMutation.isPending}
                          onClick={() => updateLeadFieldMutation.mutate({ state: editStateValue || null }, { onSuccess: () => setEditingState(false) })}
                          data-testid="button-save-state"
                        >
                          {updateLeadFieldMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.common.save}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2"
                          onClick={() => setEditingState(false)} data-testid="button-cancel-state"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-gray-900" data-testid="text-lead-state">
                        {lead.state || (lead.company as any)?.state || <span className="text-gray-400">—</span>}
                      </p>
                    )}
                    {lead.timezone && (
                      <span className="text-gray-400 text-xs mt-1 block" data-testid="text-lead-timezone">({lead.timezone})</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {lead.notes && (
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-gray-500 mb-1">Notes</p>
                  <p className="text-gray-900 whitespace-pre-wrap" data-testid="text-lead-notes">{lead.notes}</p>
                </div>
              )}
            </div>

            {leadTags.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {leadTags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="secondary"
                      className="text-xs"
                      style={tag.color ? { backgroundColor: `${tag.color}20`, color: tag.color, borderColor: tag.color } : {}}
                      data-testid={`badge-tag-${tag.id}`}
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {(lead.utmSource || lead.utmMedium || lead.utmCampaign || lead.referrer || lead.landingPage || lead.formPageUrl) && (
            <Card className="p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Source Attribution</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {lead.utmSource && (
                  <div>
                    <p className="text-gray-500 text-xs">UTM Source</p>
                    <p className="text-gray-900" data-testid="text-utm-source">{lead.utmSource}</p>
                  </div>
                )}
                {lead.utmMedium && (
                  <div>
                    <p className="text-gray-500 text-xs">UTM Medium</p>
                    <p className="text-gray-900" data-testid="text-utm-medium">{lead.utmMedium}</p>
                  </div>
                )}
                {lead.utmCampaign && (
                  <div>
                    <p className="text-gray-500 text-xs">UTM Campaign</p>
                    <p className="text-gray-900" data-testid="text-utm-campaign">{lead.utmCampaign}</p>
                  </div>
                )}
                {lead.utmTerm && (
                  <div>
                    <p className="text-gray-500 text-xs">UTM Term</p>
                    <p className="text-gray-900">{lead.utmTerm}</p>
                  </div>
                )}
                {lead.utmContent && (
                  <div>
                    <p className="text-gray-500 text-xs">UTM Content</p>
                    <p className="text-gray-900">{lead.utmContent}</p>
                  </div>
                )}
                {lead.referrer && (
                  <div>
                    <p className="text-gray-500 text-xs">Referrer</p>
                    <p className="text-gray-900 truncate" data-testid="text-referrer">{lead.referrer}</p>
                  </div>
                )}
                {lead.landingPage && (
                  <div className="sm:col-span-2">
                    <p className="text-gray-500 text-xs">Landing Page</p>
                    <p className="text-gray-900 truncate" data-testid="text-landing-page">{lead.landingPage}</p>
                  </div>
                )}
                {lead.formPageUrl && (
                  <div className="sm:col-span-2">
                    <p className="text-gray-500 text-xs">Form Page URL</p>
                    <p className="text-gray-900 truncate" data-testid="text-form-page">{lead.formPageUrl}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Activity Timeline</h2>

            <div className="mb-4 space-y-3">
              <div className="flex gap-2">
                <Select value={noteType} onValueChange={setNoteType}>
                  <SelectTrigger className="w-[140px]" data-testid="select-note-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="note">Note</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <RichTextEditorField
                value={noteContent}
                onChange={(html) => setNoteContent(html)}
                placeholder="Add a note..."
                minHeight="80px"
                data-testid="textarea-note"
              />
              <div className="flex justify-end">
                <Button
                  onClick={() => addNoteMutation.mutate()}
                  disabled={!noteContent.replace(/<[^>]*>/g, "").trim() || addNoteMutation.isPending}
                  data-testid="button-add-note"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {addNoteMutation.isPending ? "Adding..." : "Add Note"}
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {notes.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No activity yet</p>
              ) : (
                notes.map((note, i) => {
                  const NoteIcon = NOTE_TYPE_ICONS[note.type] || MessageSquare;
                  const noteStyle = NOTE_TYPE_BADGE[note.type] ?? NOTE_TYPE_BADGE.system;
                  return (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex gap-3"
                      data-testid={`note-${note.id}`}
                    >
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${noteStyle.iconBg}`}>
                        <NoteIcon className={`w-4 h-4 ${noteStyle.icon}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`text-xs border ${noteStyle.badge}`}>
                            {NOTE_TYPE_LABELS[note.type] || note.type}
                          </Badge>
                          <span className="text-xs text-gray-400">
                            {new Date(note.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {(note.metadata as any)?.event ? (
                          <p
                            className="text-sm text-gray-700 mt-1"
                            data-testid={`text-note-content-${note.id}`}
                          >
                            {renderActivityContent(note, t)}
                          </p>
                        ) : (
                          <div
                            className="text-sm text-gray-700 mt-1 chat-message-content"
                            data-testid={`text-note-content-${note.id}`}
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.content) }}
                          />
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Timeline</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-500">{t.common.created}</span>
                <span className="text-gray-900 ml-auto">{new Date(lead.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-500">{t.common.updated}</span>
                <span className="text-gray-900 ml-auto">{new Date(lead.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-gray-400" />
                {t.pipeline.tasks}
                {tasks && tasks.filter(t => !t.completed).length > 0 && (
                  <Badge variant="secondary" className="text-xs ml-1" data-testid="badge-lead-pending-tasks">
                    {tasks.filter(t => !t.completed).length}
                  </Badge>
                )}
              </h3>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-[#0D9488] hover:bg-[#0D9488]/10"
                onClick={() => { setRescheduleTask(null); setTaskModalOpen(true); }}
                data-testid="button-add-lead-task"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                {t.common.add}
              </Button>
            </div>
            <div className="space-y-2">
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
                      data-testid={`lead-task-row-${task.id}`}
                    >
                      <button
                        onClick={() => !task.completed && setCompletingTask(task)}
                        disabled={task.completed}
                        className="flex-shrink-0 mt-0.5"
                        data-testid={`button-complete-lead-task-${task.id}`}
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
                          data-testid={`button-reschedule-lead-task-${task.id}`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {demoConfigs.length > 0 && (
            <Card className="p-5" data-testid="card-demo-history">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                  <Monitor className="w-4 h-4 text-gray-400" />
                  Vista Previas Enviadas
                  <Badge variant="secondary" className="text-xs ml-1">{demoConfigs.length}</Badge>
                </h3>
                <a
                  href="/admin/demo-builder"
                  className="text-xs text-[#0D9488] hover:underline"
                  data-testid="link-demo-builder"
                >
                  + Nueva
                </a>
              </div>
              <div className="space-y-2">
                {demoConfigs.map((demo) => (
                  <div
                    key={demo.id}
                    className="p-2 rounded-md border border-gray-100 bg-gray-50 text-xs"
                    data-testid={`demo-card-${demo.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 truncate">{demo.businessName}</p>
                        <p className="text-gray-400 mt-0.5">
                          {demo.trade} · {demo.tier} · {demo.city || "—"}
                        </p>
                      </div>
                      {demo.previewUrl && (
                        <a
                          href={demo.previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 text-[#0D9488] hover:text-[#0F766E]"
                          title="Abrir vista previa"
                          data-testid={`link-demo-preview-${demo.id}`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    <p className="text-gray-300 mt-1">
                      {new Date(demo.createdAt).toLocaleDateString("es-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-gray-400" />
              <h3 className="font-semibold text-gray-900 text-sm">{t.common.history}</h3>
            </div>
            <RecordTimeline entityType="lead" entityId={id} limit={10} />
          </Card>
        </div>
      </div>

      <QuickTaskModal
        open={taskModalOpen}
        onClose={() => { setTaskModalOpen(false); setRescheduleTask(null); }}
        leadId={id}
        contactId={lead.contactId ?? null}
        leadTimezone={lead.timezone ?? null}
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
        open={!!completingTask}
        onClose={() => setCompletingTask(null)}
        task={completingTask}
        leadTimezone={lead.timezone ?? null}
      />
    </div>
  );
}

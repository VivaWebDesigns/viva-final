import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, Building2, User, Globe, Phone, Mail, MapPin,
  Calendar, Tag, MessageSquare, PhoneCall, MailIcon, ClipboardList,
  RefreshCw, Bot, Send, ExternalLink, TrendingUp,
  Plus, CheckCircle, CheckCheck, Clock, AlertCircle, Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import QuickTaskModal from "@/components/QuickTaskModal";
import { RecordTimeline } from "@/components/RecordTimeline";

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

const NOTE_TYPE_LABELS: Record<string, string> = {
  note: "Note",
  call: "Call",
  email: "Email",
  task: "Task",
  status_change: "Status Change",
  system: "System",
};

export default function LeadDetailPage({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [noteContent, setNoteContent] = useState("");
  const [noteType, setNoteType] = useState("note");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [rescheduleTask, setRescheduleTask] = useState<TaskWithContact | null>(null);

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
    staleTime: STALE.NORMAL,
  });

  const { data: linkedOpportunity } = useQuery<PipelineOpportunity | null>({
    queryKey: ["/api/pipeline/opportunities/by-lead", id],
    queryFn: async () => {
      const res = await fetch(`/api/pipeline/opportunities/by-lead/${id}`, { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      return data;
    },
    staleTime: STALE.NORMAL,
    enabled: !!id,
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiRequest("PUT", `/api/tasks/${taskId}/complete`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/for-lead", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/due-today"] });
      toast({ title: "Task completed" });
    },
  });

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
        <div className="flex items-center gap-3 flex-shrink-0">
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
                    <span>{convertMutation.isPending ? "Converting..." : "Convert to Opportunity"}</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {pipelineStages.filter(s => !s.isClosed).map(stage => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                        {stage.name}
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
                <SelectTrigger className="w-[180px]" data-testid="select-lead-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 mb-1">Status</p>
                {lead.status ? (
                  <Badge
                    variant="outline"
                    style={{ borderColor: lead.status.color, color: lead.status.color }}
                    data-testid="badge-lead-status"
                  >
                    {lead.status.name}
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
              {lead.notes && (
                <div className="sm:col-span-2">
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
                  return (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex gap-3"
                      data-testid={`note-${note.id}`}
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <NoteIcon className="w-4 h-4 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {NOTE_TYPE_LABELS[note.type] || note.type}
                          </Badge>
                          <span className="text-xs text-gray-400">
                            {new Date(note.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div
                          className="text-sm text-gray-700 mt-1 chat-message-content"
                          data-testid={`text-note-content-${note.id}`}
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.content) }}
                        />
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {lead.contact && (
            <Card
              className="p-5 hover-elevate cursor-pointer"
              onClick={() => navigate(`/admin/crm/contacts/${lead.contact!.id}`)}
              data-testid="card-lead-contact"
            >
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-gray-400" />
                <h3 className="font-semibold text-gray-900 text-sm">Contact</h3>
              </div>
              <p className="font-medium text-gray-900" data-testid="text-contact-name">
                {contactName}
              </p>
              {lead.contact.title && (
                <p className="text-xs text-gray-500 mt-0.5">{lead.contact.title}</p>
              )}
              <div className="mt-3 space-y-1.5 text-sm">
                {lead.contact.email && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    <span className="truncate">{lead.contact.email}</span>
                  </div>
                )}
                {lead.contact.phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <span>{lead.contact.phone}</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {lead.company && (
            <Card
              className="p-5 hover-elevate cursor-pointer"
              onClick={() => navigate(`/admin/crm/companies/${lead.company!.id}`)}
              data-testid="card-lead-company"
            >
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-gray-400" />
                <h3 className="font-semibold text-gray-900 text-sm">Company</h3>
              </div>
              <p className="font-medium text-gray-900" data-testid="text-company-name">
                {lead.company.name}
              </p>
              {lead.company.dba && (
                <p className="text-xs text-gray-500 mt-0.5">DBA: {lead.company.dba}</p>
              )}
              <div className="mt-3 space-y-1.5 text-sm">
                {lead.company.email && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    <span className="truncate">{lead.company.email}</span>
                  </div>
                )}
                {lead.company.phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <span>{lead.company.phone}</span>
                  </div>
                )}
                {lead.company.city && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    <span>{[lead.company.city, lead.company.state].filter(Boolean).join(", ")}</span>
                  </div>
                )}
                {lead.company.website && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                    <a
                      href={lead.company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-[#0D9488] hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {lead.company.website}
                    </a>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card className="p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Timeline</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-500">Created</span>
                <span className="text-gray-900 ml-auto">{new Date(lead.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-500">Updated</span>
                <span className="text-gray-900 ml-auto">{new Date(lead.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-gray-400" />
                Follow-up Tasks
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
                Add
              </Button>
            </div>
            <div className="space-y-2">
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
                      data-testid={`lead-task-row-${task.id}`}
                    >
                      <button
                        onClick={() => !task.completed && completeTaskMutation.mutate(task.id)}
                        disabled={task.completed || completeTaskMutation.isPending}
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
              <h3 className="font-semibold text-gray-900 text-sm">History</h3>
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

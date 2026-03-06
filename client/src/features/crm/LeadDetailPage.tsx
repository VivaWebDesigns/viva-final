import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, Building2, User, Globe, Phone, Mail, MapPin,
  Calendar, Tag, MessageSquare, PhoneCall, MailIcon, ClipboardList,
  RefreshCw, Bot, Send, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { CrmLead, CrmLeadStatus, CrmContact, CrmCompany, CrmLeadNote, CrmTag } from "@shared/schema";

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
  const [noteContent, setNoteContent] = useState("");
  const [noteType, setNoteType] = useState("note");

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
        {lead.value && (
          <span className="text-lg font-semibold text-gray-900" data-testid="text-lead-value">
            ${Number(lead.value).toLocaleString()}
          </span>
        )}
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
              <Textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Add a note..."
                className="resize-none"
                rows={3}
                data-testid="textarea-note"
              />
              <div className="flex justify-end">
                <Button
                  onClick={() => addNoteMutation.mutate()}
                  disabled={!noteContent.trim() || addNoteMutation.isPending}
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
                        <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap" data-testid={`text-note-content-${note.id}`}>
                          {note.content}
                        </p>
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
        </div>
      </div>
    </div>
  );
}

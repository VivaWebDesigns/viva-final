import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ArrowLeft, Building2, Mail, Phone, MapPin, Globe,
  User, Calendar, Plus, MessageSquare, History,
  Users, Layout, Star, Pin, Trash2, Edit2, CheckCircle2,
  Clock, AlertCircle, CheckCircle, FileText, Upload,
  Download, CreditCard, Shield, Rocket, RefreshCw,
  ClipboardList, ExternalLink, CheckSquare, Square,
  CalendarDays, Tag, ServerCrash, Wifi, WifiOff, Wrench,
  Building, BarChart3, Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import RichTextEditorField from "@/features/chat/RichTextEditorField";
import { sanitizeHtml } from "@/features/chat/RichTextEditor";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminLang } from "@/i18n/LanguageContext";
import { renderTaskTitle } from "@/lib/activityI18n";
import { format, isPast, isToday } from "date-fns";
import type {
  CrmCompany, CrmContact, CrmLead, CrmLeadStatus,
  PipelineOpportunity, PipelineStage, OnboardingRecord,
  ClientNote, User as DbUser, FollowupTask,
} from "@shared/schema";
import { useUnifiedProfile, PROFILE_KEYS } from "@/features/profiles/hooks";
import type { UnifiedProfileDto } from "@/features/profiles/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientProfile extends CrmCompany {
  contacts: (CrmContact & { isPrimary: boolean })[];
  leads: (CrmLead & { status: CrmLeadStatus | null })[];
  opportunities: (PipelineOpportunity & { stage: PipelineStage | null })[];
  onboardings: OnboardingRecord[];
  accountOwner: Pick<DbUser, "id" | "name" | "email"> | null;
  recentNotes: (ClientNote & { user?: Pick<DbUser, "id" | "name"> })[];
  openTaskCount: number;
}

interface ClientTask extends FollowupTask {
  creatorName: string | null;
  status: "open" | "overdue" | "completed";
}

interface ClientFile {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  key: string;
  createdAt: string;
  uploaderName: string | null;
  uploaderUserId: string | null;
}

interface BillingSnapshot {
  billingNotes: string | null;
  serviceTier: string | null;
  carePlanStatus: string | null;
  stripeCustomer: { id: string; stripeCustomerId: string; email: string | null; metadata: any } | null;
  recentEvents: any[];
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const updateAccountSchema = z.object({
  clientStatus: z.string().nullable(),
  accountOwnerId: z.string().nullable(),
  nextFollowUpDate: z.string().nullable().or(z.date()),
  preferredContactMethod: z.string().nullable(),
  preferredLanguage: z.string().nullable(),
  name: z.string().min(1, "Name is required"),
  dba: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  industry: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  notes: z.string().nullable(),
});

const nullableEnum = <T extends string>(values: [T, ...T[]]) =>
  z.preprocess(v => (v === "" ? null : v), z.enum(values).nullable());

const accountHealthSchema = z.object({
  launchDate: z.string().nullable(),
  renewalDate: z.string().nullable(),
  websiteStatus: nullableEnum(["live", "maintenance", "down", "building"]),
  carePlanStatus: nullableEnum(["active", "inactive", "none"]),
  serviceTier: nullableEnum(["basic", "standard", "premium"]),
  billingNotes: z.string().nullable(),
});

const createNoteSchema = z.object({
  type: z.enum(["general", "call", "meeting", "internal"]),
  content: z.string().min(1, "Content is required"),
  isPinned: z.boolean().default(false),
});

const contactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().nullable(),
  email: z.string().email("Invalid email").nullable().or(z.literal("")),
  phone: z.string().nullable(),
  title: z.string().nullable(),
  preferredLanguage: z.string().default("es"),
  isPrimary: z.boolean().default(false),
});

const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  notes: z.string().nullable().optional(),
  taskType: z.enum(["follow_up", "onboarding", "billing", "general", "review"]),
  dueDate: z.string().min(1, "Due date is required"),
});

// ─── Profile → ClientProfile adapter ─────────────────────────────────────────
// Maps UnifiedProfileDto to the shape the existing page UI expects.
// All date fields are left as strings — every call site already wraps them
// in `new Date(...)`, so the coercion is transparent.

function adaptToClient(
  profile: UnifiedProfileDto,
  recentNotes: (ClientNote & { user?: Pick<DbUser, "id" | "name"> })[],
): ClientProfile {
  const co = profile.identity.company;
  return {
    // ── CrmCompany scalars ────────────────────────────────────────────────────
    id: co.id,
    name: co.name,
    dba: co.dba,
    website: co.website,
    phone: co.phone,
    email: co.email,
    address: co.address,
    city: co.city,
    state: co.state,
    zip: co.zip,
    country: co.country,
    industry: co.industry,
    preferredLanguage: co.preferredLanguage,
    clientStatus: co.clientStatus,
    accountOwnerId: co.accountOwnerId,
    // Dates arrive as ISO strings; cast to satisfy the CrmCompany type while
    // keeping the runtime value as a string (which all formatters accept).
    nextFollowUpDate: co.nextFollowUpDate as unknown as Date | null,
    preferredContactMethod: co.preferredContactMethod,
    launchDate: co.launchDate as unknown as Date | null,
    renewalDate: co.renewalDate as unknown as Date | null,
    websiteStatus: co.websiteStatus,
    carePlanStatus: co.carePlanStatus,
    serviceTier: co.serviceTier,
    notes: co.notes,
    billingNotes: co.billingNotes,
    createdAt: co.createdAt as unknown as Date,
    updatedAt: co.updatedAt as unknown as Date,

    // ── ClientProfile additions ───────────────────────────────────────────────
    contacts: profile.identity.contacts as unknown as ClientProfile["contacts"],
    leads: profile.sales.leadHistory.map(l => ({
      ...l,
      createdAt: l.createdAt as unknown as Date,
      updatedAt: l.updatedAt as unknown as Date,
      // status object not in MappedLead; badge falls back gracefully to null
      status: null,
    })) as unknown as ClientProfile["leads"],
    opportunities: profile.sales.opportunities.map(o => ({
      ...o,
      createdAt: o.createdAt as unknown as Date,
      updatedAt: o.updatedAt as unknown as Date,
      stage: null,
    })) as unknown as ClientProfile["opportunities"],
    onboardings: profile.service.onboarding.map(ob => ({
      ...ob,
      createdAt: ob.createdAt as unknown as Date,
      updatedAt: ob.updatedAt as unknown as Date,
    })) as unknown as ClientProfile["onboardings"],
    accountOwner: co.accountOwnerId && profile.derived.owner
      ? { id: co.accountOwnerId, name: profile.derived.owner, email: "" }
      : null,
    recentNotes,
    openTaskCount: profile.work.tasks.filter(t => !t.completed).length,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClientProfilePage({ id }: { id: string }) {
  const { toast } = useToast();
  const { t } = useAdminLang();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CrmContact | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // ── Primary data: unified profile (replaces /api/clients/:id) ────────────────
  const profileEntry = { type: "company" as const, id };
  const { data: profile, isLoading, error } = useUnifiedProfile(profileEntry);

  // ── Notes (still fetched separately — not part of unified profile) ──────────
  const { data: notes = [] } = useQuery<(ClientNote & { user?: { name: string } })[]>({
    queryKey: ["/api/clients", id, "notes"],
    enabled: !!id,
  });

  // ── Tab-gated queries (unchanged — unified profile doesn't carry full details)
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<ClientTask[]>({
    queryKey: ["/api/clients", id, "tasks"],
    enabled: activeTab === "tasks" && !!id,
  });

  const { data: files = [], isLoading: filesLoading } = useQuery<ClientFile[]>({
    queryKey: ["/api/clients", id, "files"],
    enabled: activeTab === "files" && !!id,
  });

  const { data: billing, isLoading: billingLoading } = useQuery<BillingSnapshot>({
    queryKey: ["/api/clients", id, "billing"],
    enabled: activeTab === "billing" && !!id,
  });

  const { data: users = [] } = useQuery<Pick<DbUser, "id" | "name">[]>({
    queryKey: ["/api/admin/users"],
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /** Invalidate both the legacy client key AND the unified profile cache. */
  function invalidateClient() {
    queryClient.invalidateQueries({ queryKey: ["/api/clients", id] });
    queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.detail(profileEntry) });
  }

  // ─── Mutations ───────────────────────────────────────────────────────────────

  const updateClientMutation = useMutation({
    mutationFn: async (values: z.infer<typeof updateAccountSchema>) => {
      await apiRequest("PATCH", `/api/clients/${id}`, values);
    },
    onSuccess: () => {
      invalidateClient();
      toast({ title: "Success", description: "Account updated successfully" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Update failed", description: err.message });
    }
  });

  const updateHealthMutation = useMutation({
    mutationFn: async (values: z.infer<typeof accountHealthSchema>) => {
      const payload: any = {};
      for (const [k, v] of Object.entries(values)) {
        if (v === "" || v === undefined) {
          payload[k] = null;
        } else if ((k === "launchDate" || k === "renewalDate") && typeof v === "string" && v) {
          payload[k] = new Date(v).toISOString();
        } else {
          payload[k] = v;
        }
      }
      await apiRequest("PATCH", `/api/clients/${id}/account`, payload);
    },
    onSuccess: () => {
      invalidateClient();
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id, "billing"] });
      toast({ title: "Account health updated" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Update failed", description: err.message });
    }
  });

  const createNoteMutation = useMutation({
    mutationFn: async (values: z.infer<typeof createNoteSchema>) => {
      await apiRequest("POST", `/api/clients/${id}/notes`, values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id, "notes"] });
      invalidateClient();
      toast({ title: "Note added" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await apiRequest("DELETE", `/api/clients/${id}/notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id, "notes"] });
      toast({ title: "Note deleted" });
    },
  });

  const upsertContactMutation = useMutation({
    mutationFn: async (values: z.infer<typeof contactSchema>) => {
      if (editingContact) {
        await apiRequest("PATCH", `/api/clients/${id}/contacts/${editingContact.id}`, values);
      } else {
        await apiRequest("POST", `/api/clients/${id}/contacts`, values);
      }
    },
    onSuccess: () => {
      invalidateClient();
      setIsContactDialogOpen(false);
      setEditingContact(null);
      toast({ title: editingContact ? "Contact updated" : "Contact added" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (values: z.infer<typeof taskSchema>) => {
      const dueDate = new Date(values.dueDate);
      dueDate.setHours(9, 0, 0, 0);
      await apiRequest("POST", `/api/clients/${id}/tasks`, {
        ...values,
        dueDate: dueDate.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id, "tasks"] });
      invalidateClient();
      setIsTaskDialogOpen(false);
      toast({ title: "Task created" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Failed to create task", description: err.message });
    }
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await apiRequest("PUT", `/api/clients/${id}/tasks/${taskId}/complete`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id, "tasks"] });
      invalidateClient();
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await apiRequest("DELETE", `/api/clients/${id}/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id, "tasks"] });
      invalidateClient();
      toast({ title: "Task deleted" });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      await apiRequest("DELETE", `/api/attachments/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id, "files"] });
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.detail(profileEntry) });
      toast({ title: "File deleted" });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", "client");
      formData.append("entityId", id);
      formData.append("folder", "client-files");
      const res = await fetch("/api/attachments/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id, "files"] });
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.detail(profileEntry) });
      toast({ title: "File uploaded successfully" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload failed", description: err.message });
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ─── Loading / Error States ───────────────────────────────────────────────────

  if (isLoading) return (
    <div className="p-8 animate-pulse space-y-4">
      <div className="h-12 bg-gray-200 rounded w-1/3" />
      <div className="h-64 bg-gray-100 rounded" />
    </div>
  );

  if (error || !profile) return (
    <div className="p-8 text-center">
      <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
      <h2 className="text-xl font-bold">Client not found</h2>
      <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/clients")}>
        Back to Clients
      </Button>
    </div>
  );

  // ─── Adapt profile to legacy ClientProfile shape ───────────────────────────
  const client = adaptToClient(profile, notes as (ClientNote & { user?: Pick<DbUser, "id" | "name"> })[]);

  const statusColors: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700 border-emerald-200",
    inactive: "bg-gray-100 text-gray-700 border-gray-200",
    at_risk: "bg-amber-100 text-amber-700 border-amber-200",
    churned: "bg-red-100 text-red-700 border-red-200",
    prospect: "bg-blue-100 text-blue-700 border-blue-200",
  };

  const openTasks = client.openTaskCount ?? 0;

  return (
    <div className="h-full flex flex-col space-y-6 p-6 overflow-y-auto" data-testid={`page-client-profile-${id}`}>
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/clients")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 truncate" data-testid="text-client-name">
                {client.name}
              </h1>
              {client.clientStatus && (
                <Badge className={statusColors[client.clientStatus] || ""} data-testid={`badge-status-${client.clientStatus}`}>
                  {client.clientStatus.replace("_", " ")}
                </Badge>
              )}
              {client.serviceTier && (
                <Badge className="bg-purple-100 text-purple-700 border-purple-200" data-testid="badge-service-tier">
                  {client.serviceTier}
                </Badge>
              )}
              {client.industry && (
                <Badge variant="outline" data-testid="badge-industry">{client.industry}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
              {client.dba && <span className="font-medium">DBA: {client.dba}</span>}
              {(client.city || client.state) && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {[client.city, client.state].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Contacts</p>
              <p className="font-bold text-lg leading-tight" data-testid="stat-contacts-count">{client.contacts.length}</p>
            </div>
          </Card>
          <Card className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <Layout className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Leads</p>
              <p className="font-bold text-lg leading-tight" data-testid="stat-leads-count">{client.leads.length}</p>
            </div>
          </Card>
          <Card className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Deals</p>
              <p className="font-bold text-lg leading-tight" data-testid="stat-deals-count">{client.opportunities.length}</p>
            </div>
          </Card>
          <Card className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <Star className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Deal Value</p>
              <p className="font-bold text-lg leading-tight" data-testid="stat-deals-value">
                ${client.opportunities.reduce((sum, op) => sum + Number(op.value || 0), 0).toLocaleString()}
              </p>
            </div>
          </Card>
          <Card
            className="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setActiveTab("tasks")}
            data-testid="stat-open-tasks"
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${openTasks > 0 ? "bg-rose-50" : "bg-gray-50"}`}>
              <ClipboardList className={`w-4 h-4 ${openTasks > 0 ? "text-rose-500" : "text-gray-400"}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Open Tasks</p>
              <p className={`font-bold text-lg leading-tight ${openTasks > 0 ? "text-rose-600" : "text-gray-700"}`}>{openTasks}</p>
            </div>
          </Card>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-gray-100/50 p-1 flex-wrap h-auto">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="notes" data-testid="tab-notes">Notes</TabsTrigger>
          <TabsTrigger value="contacts" data-testid="tab-contacts">Contacts</TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks" className="relative">
            Tasks
            {openTasks > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-rose-500 text-white rounded-full">
                {openTasks > 9 ? "9+" : openTasks}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="files" data-testid="tab-files">Files</TabsTrigger>
          <TabsTrigger value="billing" data-testid="tab-billing">Billing</TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ───────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Contact Info Card */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-gray-400" />
                  Company Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {client.email && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                  {client.website && (
                    <div className="flex items-center gap-3 text-sm">
                      <Globe className="w-4 h-4 text-gray-400" />
                      <a href={client.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">
                        {client.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span>
                      {[client.address, client.city, client.state, client.zip].filter(Boolean).join(", ") || "No address provided"}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1 uppercase font-semibold">Preferred Language</p>
                    <Badge variant="outline">{client.preferredLanguage === 'es' ? 'Spanish' : 'English'}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1 uppercase font-semibold">Contact Method</p>
                    <p className="text-sm capitalize">{client.preferredContactMethod || "Not specified"}</p>
                  </div>
                  {client.accountOwner && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1 uppercase font-semibold">Account Owner</p>
                      <p className="text-sm">{client.accountOwner.name}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Account Management Form */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Account Management</CardTitle>
              </CardHeader>
              <CardContent>
                <AccountForm
                  client={client}
                  users={users}
                  onSubmit={(data) => updateClientMutation.mutate(data)}
                  isPending={updateClientMutation.isPending}
                />
              </CardContent>
            </Card>
          </div>

          {/* Account Health Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" />
                Account Health &amp; Key Dates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AccountHealthForm
                client={client}
                onSubmit={(data) => updateHealthMutation.mutate(data)}
                isPending={updateHealthMutation.isPending}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Onboarding Section */}
            {client.onboardings.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Rocket className="w-5 h-5 text-emerald-400" />
                    Onboarding
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">{client.onboardings.length} record{client.onboardings.length !== 1 ? "s" : ""}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  {client.onboardings.map(ob => {
                    const statusBg: Record<string, string> = {
                      completed: "bg-emerald-50 border-emerald-200",
                      in_progress: "bg-blue-50 border-blue-200",
                      on_hold: "bg-amber-50 border-amber-200",
                      not_started: "bg-gray-50 border-gray-200",
                    };
                    const isDone = ob.status === "completed";
                    return (
                      <div
                        key={ob.id}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:opacity-90 transition-opacity ${statusBg[ob.status] || "bg-gray-50 border-gray-200"}`}
                        onClick={() => navigate(`/admin/onboarding/${ob.id}`)}
                        data-testid={`onboarding-item-${ob.id}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <CheckCircle2 className={`w-5 h-5 shrink-0 ${isDone ? "text-emerald-500" : "text-gray-300"}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{ob.clientName}</p>
                            <p className="text-xs text-gray-500 capitalize">{ob.status.replace("_", " ")}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {ob.dueDate && (
                            <Badge variant="outline" className="text-[10px]">
                              Due {format(new Date(ob.dueDate), "MMM d")}
                            </Badge>
                          )}
                          <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Recent Leads */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Leads</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {client.leads.slice(0, 5).map(lead => (
                  <div key={lead.id} className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => navigate(`/admin/crm/leads/${lead.id}`)}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{lead.title}</p>
                      <p className="text-xs text-gray-500">{format(new Date(lead.createdAt), "MMM d, yyyy")}</p>
                    </div>
                    {lead.status && (
                      <Badge variant="outline" style={{ borderColor: lead.status.color, color: lead.status.color }}>
                        {lead.status.name}
                      </Badge>
                    )}
                  </div>
                ))}
                {client.leads.length === 0 && <p className="text-center py-4 text-sm text-gray-400">No leads found</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Notes Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="notes" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Client Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <NoteForm onSubmit={(data) => createNoteMutation.mutate(data)} isPending={createNoteMutation.isPending} />

              <div className="space-y-4">
                {notes.map(note => (
                  <div key={note.id} className={`p-4 rounded-xl border ${note.isPinned ? 'bg-amber-50/30 border-amber-100' : 'bg-white'} relative group`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] uppercase">{note.type}</Badge>
                        {note.isPinned && <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                        <span className="text-xs text-gray-500">
                          {note.user?.name || "System"} • {format(new Date(note.createdAt), "MMM d, yyyy h:mm a")}
                        </span>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteNoteMutation.mutate(note.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm text-gray-700 chat-message-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.content) }} />
                  </div>
                ))}
                {notes.length === 0 && <p className="text-center py-8 text-gray-400">No notes added yet.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Contacts Tab ───────────────────────────────────────────────── */}
        <TabsContent value="contacts" className="space-y-6 pt-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Contacts</h2>
            <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingContact(null)} data-testid="button-add-contact">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingContact ? "Edit Contact" : "Add New Contact"}</DialogTitle>
                </DialogHeader>
                <ContactForm
                  initialData={editingContact}
                  onSubmit={(data) => upsertContactMutation.mutate(data)}
                  isPending={upsertContactMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {client.contacts
              .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
              .map(contact => (
                <Card key={contact.id} className="p-4 flex items-start justify-between group hover-elevate">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900">
                          {[contact.firstName, contact.lastName].filter(Boolean).join(" ")}
                        </p>
                        {contact.isPrimary && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Primary</Badge>}
                      </div>
                      <p className="text-xs text-gray-500">{contact.title || "No title"}</p>
                      <div className="mt-2 space-y-1">
                        {contact.email && (
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Mail className="w-3 h-3" />
                            {contact.email}
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Phone className="w-3 h-3" />
                            {contact.phone}
                          </div>
                        )}
                        <Badge variant="outline" className="text-[9px] uppercase px-1 h-4">
                          {contact.preferredLanguage === 'es' ? 'Spanish' : 'English'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      setEditingContact(contact as unknown as CrmContact);
                      setIsContactDialogOpen(true);
                    }}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </Card>
              ))}
            {client.contacts.length === 0 && (
              <div className="col-span-full py-12 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No contacts listed for this client.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Tasks Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="tasks" className="space-y-4 pt-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Tasks &amp; Follow-Ups</h2>
            <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-task">
                  <Plus className="w-4 h-4 mr-2" />
                  New Task
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Task</DialogTitle>
                </DialogHeader>
                <TaskForm
                  onSubmit={(data) => createTaskMutation.mutate(data)}
                  isPending={createTaskMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>

          {tasksLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-50 rounded-lg animate-pulse" />)}
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-16 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No tasks yet</p>
              <p className="text-sm text-gray-400 mt-1">Create a task to track follow-ups and action items.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Group: Overdue */}
              {tasks.filter(t => t.status === "overdue").length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wide px-1">Overdue</p>
                  {tasks.filter(t => t.status === "overdue").map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={() => toggleTaskMutation.mutate(task.id)}
                      onDelete={() => deleteTaskMutation.mutate(task.id)}
                      isToggling={toggleTaskMutation.isPending}
                      renderTitle={(tk) => renderTaskTitle(tk, t)}
                    />
                  ))}
                </div>
              )}
              {/* Group: Open */}
              {tasks.filter(t => t.status === "open").length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Open</p>
                  {tasks.filter(t => t.status === "open").map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={() => toggleTaskMutation.mutate(task.id)}
                      onDelete={() => deleteTaskMutation.mutate(task.id)}
                      isToggling={toggleTaskMutation.isPending}
                      renderTitle={(tk) => renderTaskTitle(tk, t)}
                    />
                  ))}
                </div>
              )}
              {/* Group: Completed */}
              {tasks.filter(t => t.status === "completed").length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide px-1">Completed</p>
                  {tasks.filter(t => t.status === "completed").map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={() => toggleTaskMutation.mutate(task.id)}
                      onDelete={() => deleteTaskMutation.mutate(task.id)}
                      isToggling={toggleTaskMutation.isPending}
                      renderTitle={(tk) => renderTaskTitle(tk, t)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── Files Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="files" className="space-y-4 pt-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Files &amp; Attachments</h2>
            <div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
                accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                data-testid="input-file-upload"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                data-testid="button-upload-file"
              >
                {uploadingFile ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                {uploadingFile ? "Uploading..." : "Upload File"}
              </Button>
            </div>
          </div>

          <p className="text-xs text-gray-400">Allowed: images, PDF, Word, Excel, CSV — max 10 MB per file.</p>

          {filesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />)}
            </div>
          ) : files.length === 0 ? (
            <div className="py-16 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <Paperclip className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No files uploaded</p>
              <p className="text-sm text-gray-400 mt-1">Upload contracts, proposals, or other documents for this client.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map(file => (
                <Card key={file.id} className="p-3 flex items-center justify-between gap-3 group" data-testid={`file-row-${file.id}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <FileIcon mimeType={file.mimeType} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" data-testid={`file-name-${file.id}`}>{file.originalName}</p>
                      <p className="text-xs text-gray-400">
                        {formatBytes(file.sizeBytes)} · {file.uploaderName || "Unknown"} · {format(new Date(file.createdAt), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      asChild
                      data-testid={`button-download-${file.id}`}
                    >
                      <a href={file.url} target="_blank" rel="noreferrer" download={file.originalName}>
                        <Download className="w-4 h-4 text-blue-500" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteFileMutation.mutate(file.id)}
                      data-testid={`button-delete-file-${file.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Billing Tab ────────────────────────────────────────────────── */}
        <TabsContent value="billing" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stripe Customer Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-indigo-400" />
                  Stripe Account
                </CardTitle>
              </CardHeader>
              <CardContent>
                {billingLoading ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-4 bg-gray-100 rounded w-1/2" />
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                  </div>
                ) : billing?.stripeCustomer ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Connected</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Stripe Customer ID</p>
                      <p className="text-sm font-mono bg-gray-50 px-2 py-1 rounded border" data-testid="text-stripe-customer-id">
                        {billing.stripeCustomer.stripeCustomerId}
                      </p>
                    </div>
                    {billing.stripeCustomer.email && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Billing Email</p>
                        <p className="text-sm">{billing.stripeCustomer.email}</p>
                      </div>
                    )}
                    <Button variant="outline" size="sm" asChild>
                      <a href={`https://dashboard.stripe.com/customers/${billing.stripeCustomer.stripeCustomerId}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        Open in Stripe
                      </a>
                    </Button>
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <CreditCard className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No Stripe customer linked</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => navigate("/admin/payments")}
                    >
                      Go to Payments
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Service Overview Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-400" />
                  Service Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1.5">Service Tier</p>
                    {client.serviceTier ? (
                      <Badge className={{
                        basic: "bg-gray-100 text-gray-700",
                        standard: "bg-blue-100 text-blue-700",
                        premium: "bg-purple-100 text-purple-700",
                      }[client.serviceTier] || "bg-gray-100 text-gray-700"} data-testid="text-service-tier">
                        {client.serviceTier.charAt(0).toUpperCase() + client.serviceTier.slice(1)}
                      </Badge>
                    ) : (
                      <p className="text-sm text-gray-400">Not set</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1.5">Care Plan</p>
                    {client.carePlanStatus ? (
                      <Badge className={{
                        active: "bg-emerald-100 text-emerald-700",
                        inactive: "bg-gray-100 text-gray-700",
                        none: "bg-red-100 text-red-700",
                      }[client.carePlanStatus] || "bg-gray-100 text-gray-700"} data-testid="text-care-plan-status">
                        {client.carePlanStatus.charAt(0).toUpperCase() + client.carePlanStatus.slice(1)}
                      </Badge>
                    ) : (
                      <p className="text-sm text-gray-400">Not set</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1.5">Launch Date</p>
                    <p className="text-sm" data-testid="text-launch-date">
                      {client.launchDate ? format(new Date(client.launchDate), "MMM d, yyyy") : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1.5">Renewal Date</p>
                    <p className={`text-sm ${client.renewalDate && isPast(new Date(client.renewalDate)) ? "text-red-600 font-semibold" : ""}`} data-testid="text-renewal-date">
                      {client.renewalDate ? format(new Date(client.renewalDate), "MMM d, yyyy") : "—"}
                    </p>
                  </div>
                </div>

                {client.billingNotes && (
                  <div className="pt-3 border-t">
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1.5">Billing Notes</p>
                    <p className="text-sm text-gray-700 bg-gray-50 p-2.5 rounded-lg border whitespace-pre-wrap" data-testid="text-billing-notes">
                      {client.billingNotes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Edit Account Health from Billing Tab too */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Update Service Details</CardTitle>
            </CardHeader>
            <CardContent>
              <AccountHealthForm
                client={client}
                onSubmit={(data) => updateHealthMutation.mutate(data)}
                isPending={updateHealthMutation.isPending}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Activity Tab ───────────────────────────────────────────────── */}
        <TabsContent value="activity" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Activity History</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline clientId={id} clientData={client} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────

function TaskRow({ task, onToggle, onDelete, isToggling, renderTitle }: {
  task: ClientTask;
  onToggle: () => void;
  onDelete: () => void;
  isToggling: boolean;
  renderTitle: (task: { title: string }) => string;
}) {
  const taskTypeColors: Record<string, string> = {
    follow_up: "bg-blue-100 text-blue-700",
    onboarding: "bg-emerald-100 text-emerald-700",
    billing: "bg-purple-100 text-purple-700",
    general: "bg-gray-100 text-gray-700",
    review: "bg-amber-100 text-amber-700",
  };

  const isOverdue = task.status === "overdue";
  const isDone = task.status === "completed";

  return (
    <Card className={`p-3 flex items-start gap-3 group transition-opacity ${isDone ? "opacity-60" : ""}`} data-testid={`task-row-${task.id}`}>
      <button
        className="mt-0.5 shrink-0"
        onClick={onToggle}
        disabled={isToggling}
        data-testid={`button-toggle-task-${task.id}`}
      >
        {isDone
          ? <CheckSquare className="w-5 h-5 text-emerald-500" />
          : <Square className={`w-5 h-5 ${isOverdue ? "text-red-400" : "text-gray-300"}`} />
        }
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-medium ${isDone ? "line-through text-gray-400" : "text-gray-900"}`} data-testid={`task-title-${task.id}`}>
            {renderTitle(task)}
          </p>
          {task.taskType && (
            <Badge className={`text-[10px] px-1.5 ${taskTypeColors[task.taskType] || "bg-gray-100 text-gray-700"}`}>
              {task.taskType.replace("_", " ")}
            </Badge>
          )}
        </div>
        {task.notes && (
          <div className="text-xs text-gray-500 mt-0.5 line-clamp-2 chat-message-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(task.notes) }} />
        )}
        <div className="flex items-center gap-3 mt-1.5">
          <span className={`text-xs flex items-center gap-1 ${isOverdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
            <CalendarDays className="w-3 h-3" />
            {task.dueDate ? (isToday(new Date(task.dueDate)) ? "Today" : format(new Date(task.dueDate), "MMM d, yyyy")) : "No due date"}
          </span>
          {task.creatorName && (
            <span className="text-xs text-gray-400">by {task.creatorName}</span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={onDelete}
        data-testid={`button-delete-task-${task.id}`}
      >
        <Trash2 className="w-3.5 h-3.5 text-red-400" />
      </Button>
    </Card>
  );
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <FileText className="w-4 h-4 text-blue-400" />;
  if (mimeType === "application/pdf") return <FileText className="w-4 h-4 text-red-400" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "text/csv")
    return <FileText className="w-4 h-4 text-emerald-500" />;
  return <FileText className="w-4 h-4 text-gray-400" />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Sub-forms ────────────────────────────────────────────────────────────────

function AccountForm({ client, users, onSubmit, isPending }: {
  client: ClientProfile;
  users: Pick<DbUser, "id" | "name">[];
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const form = useForm({
    resolver: zodResolver(updateAccountSchema),
    defaultValues: {
      clientStatus: client.clientStatus || "prospect",
      accountOwnerId: client.accountOwnerId || "",
      nextFollowUpDate: client.nextFollowUpDate ? new Date(client.nextFollowUpDate).toISOString().split('T')[0] : "",
      preferredContactMethod: client.preferredContactMethod || "email",
      preferredLanguage: client.preferredLanguage || "en",
      name: client.name,
      dba: client.dba || "",
      phone: client.phone || "",
      email: client.email || "",
      website: client.website || "",
      industry: client.industry || "",
      address: client.address || "",
      city: client.city || "",
      state: client.state || "",
      zip: client.zip || "",
      notes: client.notes || "",
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="clientStatus"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="at_risk">At Risk</SelectItem>
                    <SelectItem value="churned">Churned</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="accountOwnerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account Owner</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nextFollowUpDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Next Follow-up</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value || ""} data-testid="input-next-followup" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="preferredContactMethod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preferred Method</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="text">Text Message</SelectItem>
                    <SelectItem value="in_person">In Person</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Internal Account Notes</FormLabel>
              <FormControl>
                <RichTextEditorField value={field.value || ""} onChange={(html) => field.onChange(html)} onBlur={field.onBlur} placeholder="Internal details about this account relationship..." minHeight="80px" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending} data-testid="button-save-account">
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function AccountHealthForm({ client, onSubmit, isPending }: {
  client: ClientProfile;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const form = useForm({
    resolver: zodResolver(accountHealthSchema),
    defaultValues: {
      launchDate: client.launchDate ? new Date(client.launchDate).toISOString().split('T')[0] : "",
      renewalDate: client.renewalDate ? new Date(client.renewalDate).toISOString().split('T')[0] : "",
      websiteStatus: (client.websiteStatus as any) || "",
      carePlanStatus: (client.carePlanStatus as any) || "",
      serviceTier: (client.serviceTier as any) || "",
      billingNotes: client.billingNotes || "",
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="serviceTier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service Tier</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                  <FormControl>
                    <SelectTrigger data-testid="select-service-tier">
                      <SelectValue placeholder="Select tier" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="carePlanStatus"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Care Plan Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                  <FormControl>
                    <SelectTrigger data-testid="select-care-plan-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="websiteStatus"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                  <FormControl>
                    <SelectTrigger data-testid="select-website-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="building">Building</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="down">Down</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="launchDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Launch Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value || ""} data-testid="input-launch-date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="renewalDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Renewal Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value || ""} data-testid="input-renewal-date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="billingNotes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Billing Notes</FormLabel>
              <FormControl>
                <RichTextEditorField value={field.value || ""} onChange={(html) => field.onChange(html)} onBlur={field.onBlur} placeholder="Payment terms, invoicing notes, special billing arrangements..." minHeight="80px" data-testid="input-billing-notes" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending} data-testid="button-save-account-health">
            {isPending ? "Saving..." : "Save Account Health"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function NoteForm({ onSubmit, isPending }: { onSubmit: (data: any) => void, isPending: boolean }) {
  const form = useForm({
    resolver: zodResolver(createNoteSchema),
    defaultValues: { type: "general", content: "", isPinned: false }
  });

  const handleSubmit = (data: any) => {
    onSubmit(data);
    form.reset({ type: "general", content: "", isPinned: false });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 bg-gray-50/50 p-4 rounded-xl border">
        <div className="flex gap-4 items-start">
          <div className="w-1/4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="call">Call Log</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>
          <div className="flex-1">
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RichTextEditorField value={field.value || ""} onChange={(html) => field.onChange(html)} onBlur={field.onBlur} placeholder="Type a note..." minHeight="80px" data-testid="input-note-content" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <FormField
            control={form.control}
            name="isPinned"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="text-sm font-normal">Pin this note</FormLabel>
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isPending || !form.watch("content") || form.watch("content") === "<p></p>"} data-testid="button-submit-note">
            Add Note
          </Button>
        </div>
      </form>
    </Form>
  );
}

function TaskForm({ onSubmit, isPending }: { onSubmit: (data: any) => void; isPending: boolean }) {
  const form = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      notes: "",
      taskType: "follow_up" as const,
      dueDate: new Date().toISOString().split('T')[0],
    }
  });

  const handleSubmit = (data: any) => {
    onSubmit(data);
    form.reset();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Task Title</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. Follow up on proposal" data-testid="input-task-title" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="taskType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-task-type">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="follow_up">Follow-Up</SelectItem>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Due Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="input-task-due-date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <RichTextEditorField value={field.value || ""} onChange={(html) => field.onChange(html)} onBlur={field.onBlur} placeholder="Additional details..." minHeight="80px" data-testid="input-task-notes" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="submit" disabled={isPending} data-testid="button-submit-task">
            {isPending ? "Creating..." : "Create Task"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

function ContactForm({ initialData, onSubmit, isPending }: {
  initialData: any;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const form = useForm({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: initialData?.firstName || "",
      lastName: initialData?.lastName || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      title: initialData?.title || "",
      preferredLanguage: initialData?.preferredLanguage || "es",
      isPrimary: initialData?.isPrimary || false,
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl><Input {...field} value={field.value || ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl><Input {...field} value={field.value || ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title / Position</FormLabel>
              <FormControl><Input {...field} value={field.value || ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-between items-center gap-4">
          <FormField
            control={form.control}
            name="preferredLanguage"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Language</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isPrimary"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2 space-y-0 pt-6">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel>Primary Contact</FormLabel>
              </FormItem>
            )}
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : (initialData ? "Update Contact" : "Add Contact")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

// ─── Activity Timeline ────────────────────────────────────────────────────────

function ActivityTimeline({ clientId, clientData }: { clientId: string; clientData: ClientProfile }) {
  const { data: history = [], isLoading } = useQuery<{
    id: string;
    event: string;
    entityType: string;
    entityId: string;
    userId: string | null;
    metadata: any;
    createdAt: string;
    user?: { name: string };
  }[]>({
    queryKey: ["/api/history/client", clientId],
  });

  if (isLoading) return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-50 rounded-lg animate-pulse" />)}
    </div>
  );

  const timelineItems: {
    id: string; date: Date; type: string; event: string;
    user: string; content: string; icon: JSX.Element; noteType?: string;
  }[] = [
    ...history.map(h => ({
      id: h.id,
      date: new Date(h.createdAt),
      type: 'history',
      event: h.event,
      user: h.user?.name || 'System',
      content: getEventDescription(h),
      icon: getEventIcon(h.event),
    })),
    ...clientData.recentNotes.map(n => ({
      id: n.id,
      date: new Date(n.createdAt),
      type: 'note',
      event: 'note_added',
      user: n.user?.name || 'System',
      content: n.content,
      icon: <MessageSquare className="w-4 h-4 text-blue-500" />,
      noteType: n.type,
    }))
  ];

  timelineItems.sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-gray-100">
      {timelineItems.map((item) => (
        <div key={item.id} className="relative pl-12">
          <div className="absolute left-0 mt-1 flex h-10 w-10 items-center justify-center rounded-full border bg-white ring-4 ring-white shadow-sm">
            {item.icon}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-900">{item.user}</span>
              <span className="text-[10px] text-gray-500">{format(item.date, "MMM d, yyyy h:mm a")}</span>
            </div>
            <div className="mt-1 text-sm text-gray-600">
              {item.type === 'note' ? (
                <div className="bg-gray-50 p-3 rounded-lg border">
                  <Badge variant="outline" className="text-[9px] mb-2">{item.noteType}</Badge>
                  <p className="line-clamp-3">{item.content}</p>
                </div>
              ) : (
                <p>{item.content}</p>
              )}
            </div>
          </div>
        </div>
      ))}
      {timelineItems.length === 0 && (
        <p className="text-center py-8 text-gray-400">No activity recorded yet.</p>
      )}
    </div>
  );
}

function getEventIcon(event: string) {
  if (event.includes('status')) return <Clock className="w-4 h-4 text-amber-500" />;
  if (event.includes('contact')) return <Users className="w-4 h-4 text-blue-500" />;
  if (event.includes('onboarding')) return <CheckCircle className="w-4 h-4 text-emerald-500" />;
  if (event.includes('task')) return <ClipboardList className="w-4 h-4 text-purple-500" />;
  if (event.includes('file') || event.includes('attachment')) return <Paperclip className="w-4 h-4 text-gray-400" />;
  return <History className="w-4 h-4 text-gray-400" />;
}

function getEventDescription(h: any) {
  const meta = h.metadata || {};
  if (h.event === 'client_status_updated') return `Status changed to ${meta.newStatus || 'unknown'}`;
  if (h.event === 'client_contact_added') return `New contact added`;
  if (h.event === 'onboarding_started') return `Onboarding started: ${meta.recordName || 'unknown'}`;
  if (h.event === 'client_task_created') return `Task created: ${meta.title || 'unknown'}`;
  if (h.event === 'client_task_completed') return `Task completed: ${meta.title || ''}`;
  if (h.event === 'client_task_reopened') return `Task reopened: ${meta.title || ''}`;
  if (h.event === 'client_account_updated') return `Account health updated`;
  if (h.event === 'field_updated' && meta.note) return meta.note;
  if (h.event === 'status_changed') return `Status changed: ${meta.fromValue || ''} → ${meta.toValue || ''}`;
  if (h.event === 'owner_changed') return `Account owner changed`;
  return h.event.replace(/_/g, ' ');
}

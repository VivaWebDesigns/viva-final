/**
 * Unified Profile Shell
 *
 * A fully reusable, context-aware profile viewer that works for any entry point:
 *   <ProfileShell entry={{ type: "company",     id: "..." }} />
 *   <ProfileShell entry={{ type: "lead",        id: "..." }} />
 *   <ProfileShell entry={{ type: "opportunity", id: "..." }} />
 *
 * Section components are exported individually so they can be composed into
 * other pages (e.g. sidebars, drawers) without pulling in the full shell.
 *
 * All sections have safe fallbacks for null / partial data.
 */

import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Building2, User, Phone, Mail, MapPin, Globe,
  AlertCircle, CheckSquare2, Square, Clock, Paperclip,
  MessageSquare, RefreshCw, ArrowRight, Info, CreditCard,
  Rocket, TrendingUp, FileText, Download, Activity,
  CheckCircle2, Circle, Pencil, Zap, Plus, Pin,
  Trash2, Users, CalendarDays, Upload, ExternalLink,
  BarChart3, CheckSquare, History, Star, Edit2,
  ClipboardList, CheckCircle, ChevronDown, ChevronRight, CalendarClock,
} from "lucide-react";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import RichTextEditorField from "@/features/chat/RichTextEditorField";
import { sanitizeHtml } from "@/features/chat/RichTextEditor";
import { apiRequest, queryClient, STALE } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminLang } from "@/i18n/LanguageContext";
import type { AdminTranslations } from "@/i18n/locales/en";
import { useUnifiedProfile, useInfiniteTimeline, PROFILE_KEYS } from "./hooks";
import { useAuth } from "@features/auth/useAuth";
import { EditCompanyDialog } from "./edit/EditCompanyDialog";
import { EditContactDialog } from "./edit/EditContactDialog";
import { EditLeadDialog } from "./edit/EditLeadDialog";
import { EditOpportunityDialog } from "./edit/EditOpportunityDialog";
import CompleteTaskModal from "@/components/CompleteTaskModal";
import QuickTaskModal from "@/components/QuickTaskModal";
import PaymentSentModal from "@/components/PaymentSentModal";
import type {
  ProfileEntry,
  ProfileHealth,
  TimelineEventType,
  TimelineEventSource,
  MappedCompany,
  MappedContact,
  MappedLead,
  MappedOpportunity,
  MappedTask,
  MappedFile,
  MappedOnboarding,
  BillingSummary,
  UnifiedTimelineEvent,
  UnifiedProfileDto,
} from "./types";
import { ProfileLinkageApiError } from "./types";
import type {
  PipelineStage, ClientNote, User as DbUser, FollowupTask,
} from "@shared/schema";
import { useLocation } from "wouter";

// ── Types ──────────────────────────────────────────────────────────────────────

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
  stripeCustomer: { id: string; stripeCustomerId: string; email: string | null; metadata: Record<string, unknown> } | null;
  recentEvents: Array<{ id: string; type: string; amount: number; status: string; created: number }>;
}

// ── Schemas ────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(date: string | null | undefined, pattern = "MMM d, yyyy"): string {
  if (!date) return "—";
  try { return format(new Date(date), pattern); }
  catch { return "—"; }
}

function fmtRelative(date: string | null | undefined): string {
  if (!date) return "—";
  try { return formatDistanceToNow(new Date(date), { addSuffix: true }); }
  catch { return "—"; }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const HEALTH_STYLE: Record<ProfileHealth, { label: string; className: string }> = {
  healthy:  { label: "Healthy",  className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  at_risk:  { label: "At Risk",  className: "bg-amber-100 text-amber-700 border-amber-200" },
  stale:    { label: "Stale",    className: "bg-red-100 text-red-700 border-red-200" },
  unknown:  { label: "Unknown",  className: "bg-gray-100 text-gray-600 border-gray-200" },
};

const TIMELINE_ICON: Record<TimelineEventType, typeof MessageSquare> = {
  note:           MessageSquare,
  call:           Phone,
  email:          Mail,
  task:           CheckSquare2,
  status_change:  RefreshCw,
  stage_change:   ArrowRight,
  system:         Info,
};

const SOURCE_LABEL: Record<TimelineEventSource, string> = {
  crm_lead_notes:       "Lead Note",
  client_notes:         "Client Note",
  pipeline_activities:  "Activity",
};

const CONTEXT_LABEL: Record<ProfileEntry["type"], string> = {
  company:     "Company",
  lead:        "Lead",
  opportunity: "Opportunity",
};

const NOTE_TYPE_ICONS: Record<string, typeof MessageSquare> = {
  general: MessageSquare,
  call: Phone,
  meeting: Users,
  internal: Info,
};

const NOTE_TYPE_COLORS: Record<string, string> = {
  general: "bg-gray-100 text-gray-700",
  call: "bg-blue-100 text-blue-700",
  meeting: "bg-purple-100 text-purple-700",
  internal: "bg-amber-100 text-amber-700",
};

const TASK_TYPE_COLORS: Record<string, string> = {
  follow_up: "bg-blue-100 text-blue-700",
  onboarding: "bg-emerald-100 text-emerald-700",
  billing: "bg-purple-100 text-purple-700",
  general: "bg-gray-100 text-gray-700",
  review: "bg-amber-100 text-amber-700",
};

// ── Loading skeleton ──────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="space-y-4 p-6 animate-pulse" data-testid="profile-skeleton">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-5 w-32" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <Skeleton className="h-40 col-span-1" />
        <Skeleton className="h-40 col-span-1" />
        <Skeleton className="h-40 col-span-1" />
      </div>
      <Skeleton className="h-64 mt-4" />
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────

function ProfileError({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6" data-testid="profile-error">
      <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
      <p className="text-sm font-medium text-gray-700">Failed to load profile</p>
      <p className="text-xs text-gray-400 mt-1 max-w-xs">{message}</p>
    </div>
  );
}

// ── Orphaned opportunity fallback ─────────────────────────────────────────────
// Shown when a 422 PROFILE_LINKAGE_ERROR is returned for an opportunity entry.
// The opportunity has no linked company so a full profile cannot be assembled,
// but we can still surface the opportunity's own data and guide the user.

function OrphanedOpportunityFallback({
  error,
}: {
  error: ProfileLinkageApiError;
}) {
  const [, navigate] = useLocation();
  const opp = error.opportunity;

  return (
    <div
      className="flex flex-col items-center justify-center py-16 text-center px-6 gap-4"
      data-testid="profile-linkage-error"
    >
      <div className="rounded-full bg-amber-50 p-4 border border-amber-100">
        <AlertCircle className="w-10 h-10 text-amber-400" />
      </div>

      {opp && (
        <div className="max-w-md">
          <p className="text-lg font-semibold text-gray-900" data-testid="linkage-error-opp-title">
            {opp.title}
          </p>
          {opp.value && (
            <p className="text-sm text-gray-500 mt-0.5" data-testid="linkage-error-opp-value">
              Value: ${Number(opp.value).toLocaleString()}
            </p>
          )}
          {opp.status && (
            <p className="text-xs text-gray-400 mt-0.5 capitalize" data-testid="linkage-error-opp-status">
              Status: {opp.status}
            </p>
          )}
        </div>
      )}

      <div className="max-w-sm space-y-1.5">
        <p className="text-sm font-medium text-gray-700">
          This opportunity isn&apos;t linked to a company
        </p>
        <p className="text-xs text-gray-400 leading-relaxed">
          A full profile can&apos;t be loaded because this opportunity has no associated
          client. Open the Pipeline to assign it to an existing client.
        </p>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="mt-2 gap-1.5"
        onClick={() => navigate("/admin/pipeline")}
        data-testid="button-go-to-pipeline"
      >
        <ArrowRight className="w-4 h-4" />
        Go to Pipeline
      </Button>
    </div>
  );
}

// ── Empty inline helper ───────────────────────────────────────────────────────

function EmptySection({ label }: { label: string }) {
  return (
    <p className="text-sm text-gray-400 italic py-4 text-center" data-testid={`empty-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      No {label.toLowerCase()} yet.
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section: ProfileHeader
// ─────────────────────────────────────────────────────────────────────────────

export interface ProfileHeaderProps {
  entry: ProfileEntry;
  company: MappedCompany;
  derived: UnifiedProfileDto["derived"];
}

export function ProfileHeader({ entry, company, derived }: ProfileHeaderProps) {
  const health = HEALTH_STYLE[derived.health] ?? HEALTH_STYLE.unknown;
  const contextLabel = CONTEXT_LABEL[entry.type];

  return (
    <div className="flex flex-col gap-1" data-testid="profile-header">
      <div className="flex items-center gap-2 text-xs text-gray-400 font-medium uppercase tracking-wide">
        <Building2 className="w-3.5 h-3.5" />
        <span data-testid="text-profile-context-label">{contextLabel} Profile</span>
      </div>

      <div className="flex items-start gap-3 flex-wrap">
        <h1
          className="text-2xl font-bold text-gray-900 truncate"
          data-testid="text-profile-company-name"
        >
          {company.name}
        </h1>
        {company.dba && (
          <span className="text-sm text-gray-500 mt-1.5" data-testid="text-profile-dba">
            DBA: {company.dba}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-1">
        <Badge className={health.className} data-testid={`badge-health-${derived.health}`}>
          {health.label}
        </Badge>

        {derived.status && (
          <Badge variant="outline" data-testid="badge-derived-status">
            {derived.status.replace(/_/g, " ")}
          </Badge>
        )}

        {derived.stage && (
          <Badge className="bg-violet-100 text-violet-700 border-violet-200" data-testid="badge-derived-stage">
            {derived.stage}
          </Badge>
        )}

        {company.industry && (
          <Badge variant="outline" data-testid="badge-company-industry">
            {company.industry}
          </Badge>
        )}

        {company.serviceTier && (
          <Badge className="bg-purple-100 text-purple-700 border-purple-200" data-testid="badge-service-tier">
            {company.serviceTier}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 mt-1 flex-wrap">
        {(company.city || company.state) && (
          <span className="flex items-center gap-1" data-testid="text-profile-location">
            <MapPin className="w-3 h-3" />
            {[company.city, company.state].filter(Boolean).join(", ")}
          </span>
        )}
        {derived.owner && (
          <span className="flex items-center gap-1" data-testid="text-profile-owner">
            <User className="w-3 h-3" />
            {derived.owner}
          </span>
        )}
        {derived.value !== null && (
          <span className="flex items-center gap-1 font-medium text-gray-700" data-testid="text-profile-value">
            <TrendingUp className="w-3 h-3" />
            ${derived.value.toLocaleString()}
          </span>
        )}
        {derived.lastActivityAt && (
          <span className="flex items-center gap-1" data-testid="text-profile-last-activity">
            <Activity className="w-3 h-3" />
            Active {fmtRelative(derived.lastActivityAt)}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section: QuickStats
// ─────────────────────────────────────────────────────────────────────────────

interface QuickStatsProps {
  contacts: number;
  leads: number;
  deals: number;
  dealValue: number;
  openTasks: number;
  t: AdminTranslations;
}

function QuickStats({ contacts, leads, deals, dealValue, openTasks, t }: QuickStatsProps) {
  const stats = [
    { label: t.profileShell.quickStats.contacts, value: contacts, icon: Users, color: "text-blue-600 bg-blue-50" },
    { label: t.profileShell.quickStats.leads, value: leads, icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
    { label: t.profileShell.quickStats.deals, value: deals, icon: FileText, color: "text-violet-600 bg-violet-50" },
    { label: t.profileShell.quickStats.dealValue, value: `$${dealValue.toLocaleString()}`, icon: CreditCard, color: "text-amber-600 bg-amber-50" },
    { label: t.profileShell.quickStats.openTasks, value: openTasks, icon: CheckSquare2, color: "text-rose-600 bg-rose-50" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="quick-stats">
      {stats.map((s) => (
        <Card key={s.label} className="p-3 flex items-center gap-3" data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${s.color}`}>
            <s.icon className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 leading-tight">{s.value}</p>
            <p className="text-[11px] text-gray-500 uppercase tracking-wide font-medium">{s.label}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section: MoveToStageBar
// ─────────────────────────────────────────────────────────────────────────────

interface MoveToStageBarProps {
  opportunityId: string;
  currentStageId: string;
  stages: PipelineStage[];
  onContactedPending: (stageId: string) => void;
  onPaymentSentPending: (stageId: string) => void;
  stageMutation: ReturnType<typeof useMutation<unknown, Error, string>>;
  t: AdminTranslations;
}

function MoveToStageBar({
  opportunityId, currentStageId, stages, onContactedPending, onPaymentSentPending, stageMutation, t,
}: MoveToStageBarProps) {
  return (
    <Card className="p-4" data-testid="move-to-stage-bar">
      <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">{t.pipeline.moveToStage}</p>
      <div className="flex flex-wrap gap-1.5">
        {stages.map(stage => (
          <Button
            key={stage.id}
            size="sm"
            variant={stage.id === currentStageId ? "default" : "outline"}
            className="text-xs h-7"
            style={stage.id === currentStageId ? { backgroundColor: stage.color } : { borderColor: stage.color, color: stage.color }}
            onClick={() => {
              if (stage.id === currentStageId) return;
              if (stage.slug === "contacted") {
                onContactedPending(stage.id);
              } else if (stage.slug === "payment-sent") {
                onPaymentSentPending(stage.id);
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
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section: CompanyContactCard
// ─────────────────────────────────────────────────────────────────────────────

export interface CompanyContactCardProps {
  entry: ProfileEntry;
  company: MappedCompany;
  primaryContact: MappedContact | null;
  contacts: MappedContact[];
}

export function CompanyContactCard({ entry, company, primaryContact, contacts }: CompanyContactCardProps) {
  const [editCompanyOpen, setEditCompanyOpen] = useState(false);
  const [editContactOpen, setEditContactOpen] = useState(false);

  return (
    <>
    <Card className="p-5 space-y-5" data-testid="card-company-contact">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-400" />
          Company
          <button
            onClick={() => setEditCompanyOpen(true)}
            className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Edit company"
            data-testid="button-edit-company"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </h3>
        <dl className="space-y-2 text-sm">
          {company.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-gray-700" data-testid="text-company-phone">{company.phone}</span>
            </div>
          )}
          {company.email && (
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <a
                href={`mailto:${company.email}`}
                className="text-blue-600 hover:underline truncate"
                data-testid="link-company-email"
              >
                {company.email}
              </a>
            </div>
          )}
          {company.website && (
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <a
                href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline truncate"
                data-testid="link-company-website"
              >
                {company.website}
              </a>
            </div>
          )}
          {(company.city || company.state || company.address) && (
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
              <span className="text-gray-700" data-testid="text-company-address">
                {[company.address, company.city, company.state, company.zip]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </div>
          )}
          {company.preferredLanguage && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-xs w-3.5 text-center shrink-0">🌐</span>
              <span className="text-gray-700" data-testid="text-company-language">
                {company.preferredLanguage === "es" ? "Spanish" : "English"}
              </span>
            </div>
          )}
        </dl>
      </div>

      {primaryContact ? (
        <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            Primary Contact
            <button
              onClick={() => setEditContactOpen(true)}
              className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Edit contact"
              data-testid="button-edit-contact"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </h3>
          <dl className="space-y-2 text-sm">
            <div data-testid="text-contact-name" className="font-medium text-gray-900">
              {[primaryContact.firstName, primaryContact.lastName].filter(Boolean).join(" ")}
              {primaryContact.title && (
                <span className="font-normal text-gray-500"> · {primaryContact.title}</span>
              )}
            </div>
            {(primaryContact.phone || company.phone) && (
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-gray-700" data-testid="text-contact-phone">{primaryContact.phone || company.phone}</span>
              </div>
            )}
            {primaryContact.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <a
                  href={`mailto:${primaryContact.email}`}
                  className="text-blue-600 hover:underline truncate"
                  data-testid="link-contact-email"
                >
                  {primaryContact.email}
                </a>
              </div>
            )}
          </dl>
        </div>
      ) : (
        <div className="border-t pt-4">
          <p className="text-xs text-gray-400 italic" data-testid="text-no-primary-contact">
            No primary contact on file.
          </p>
        </div>
      )}

      {contacts.length > 1 && (
        <p className="text-xs text-gray-400" data-testid="text-additional-contacts">
          +{contacts.length - 1} additional contact{contacts.length - 1 !== 1 ? "s" : ""}
        </p>
      )}
    </Card>

    <EditCompanyDialog
      open={editCompanyOpen}
      onOpenChange={setEditCompanyOpen}
      company={company}
      entry={entry}
    />
    {primaryContact && (
      <EditContactDialog
        open={editContactOpen}
        onOpenChange={setEditContactOpen}
        contact={primaryContact}
        entry={entry}
      />
    )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section: SalesSnapshotCard
// ─────────────────────────────────────────────────────────────────────────────

export interface SalesSnapshotCardProps {
  entry: ProfileEntry;
  sales: UnifiedProfileDto["sales"];
  companyName?: string | null;
  contactName?: string | null;
  contacts?: MappedContact[];
}

function resolveContactName(
  contactId: string | null | undefined,
  contacts: MappedContact[] | undefined,
  fallbackName: string | null | undefined,
): string | null {
  if (contactId && contacts) {
    const ct = contacts.find(c => c.id === contactId);
    if (ct) return [ct.firstName, ct.lastName].filter(Boolean).join(" ");
  }
  return fallbackName ?? null;
}

export function SalesSnapshotCard({ entry, sales, companyName, contactName, contacts }: SalesSnapshotCardProps) {
  const { sourceLead, leadHistory, activeOpportunity, opportunities } = sales;
  const hasAnything = sourceLead || activeOpportunity || leadHistory.length > 0;

  const [editOppOpen,  setEditOppOpen]  = useState(false);
  const [editLeadOpen, setEditLeadOpen] = useState(false);

  return (
    <>
    <Card className="p-5" data-testid="card-sales-snapshot">
      <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-gray-400" />
        Sales Snapshot
      </h3>

      {!hasAnything ? (
        <EmptySection label="sales activity" />
      ) : (
        <div className="space-y-4">
          {activeOpportunity && (
            <div className="rounded-lg bg-violet-50 border border-violet-100 p-3" data-testid="card-active-opportunity">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">
                  {entry.type === "opportunity" ? "Current Opportunity" : "Active Opportunity"}
                </p>
                <div className="flex items-center gap-1.5">
                  {activeOpportunity.websitePackage && (
                    <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-xs" data-testid="badge-opportunity-package">
                      {activeOpportunity.websitePackage}
                    </Badge>
                  )}
                  <button
                    onClick={() => setEditOppOpen(true)}
                    className="text-violet-400 hover:text-violet-600 transition-colors"
                    aria-label="Edit opportunity"
                    data-testid="button-edit-opportunity"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="font-medium text-gray-900 mt-1 text-sm truncate" data-testid="text-opportunity-title">
                {(() => {
                  const cn = resolveContactName(activeOpportunity.contactId, contacts, contactName);
                  if (companyName && cn) return `${companyName} – ${cn}`;
                  return companyName || cn || activeOpportunity.title;
                })()}
              </p>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                {activeOpportunity.value && (
                  <span data-testid="text-opportunity-value">${Number(activeOpportunity.value).toLocaleString()}</span>
                )}
                {activeOpportunity.expectedCloseDate && (
                  <span data-testid="text-opportunity-close-date">
                    Close: {fmt(activeOpportunity.expectedCloseDate)}
                  </span>
                )}
              </div>
            </div>
          )}

          {sourceLead && entry.type !== "lead" && (
            <div className="space-y-1" data-testid="div-source-lead">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Source Lead</p>
                <button
                  onClick={() => setEditLeadOpen(true)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Edit lead"
                  data-testid="button-edit-lead"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-sm text-gray-800 font-medium truncate" data-testid="text-source-lead-title">
                {(() => {
                  const cn = resolveContactName(sourceLead.contactId, contacts, contactName);
                  if (companyName && cn) return `${companyName} – ${cn}`;
                  return companyName || cn || sourceLead.title;
                })()}
              </p>
              {sourceLead.sourceLabel && (
                <Badge variant="outline" className="text-xs" data-testid="badge-lead-source">
                  {sourceLead.sourceLabel}
                </Badge>
              )}
            </div>
          )}

          {entry.type === "lead" && sourceLead && (
            <div className="flex justify-end">
              <button
                onClick={() => setEditLeadOpen(true)}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
                aria-label="Edit lead"
                data-testid="button-edit-lead-direct"
              >
                <Pencil className="w-3 h-3" /> Edit Lead
              </button>
            </div>
          )}

          <div className="flex gap-4 text-xs text-gray-500 border-t pt-3">
            <span data-testid="text-opportunities-count">
              {opportunities.length} opportunit{opportunities.length !== 1 ? "ies" : "y"}
            </span>
            {leadHistory.length > 0 && (
              <span data-testid="text-leads-count">
                {leadHistory.length} lead{leadHistory.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      )}
    </Card>

    {activeOpportunity && (
      <EditOpportunityDialog
        open={editOppOpen}
        onOpenChange={setEditOppOpen}
        opportunity={activeOpportunity}
        entry={entry}
      />
    )}
    {sourceLead && (
      <EditLeadDialog
        open={editLeadOpen}
        onOpenChange={setEditLeadOpen}
        lead={sourceLead}
        entry={entry}
      />
    )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section: TasksCard (read-only from profile data)
// ─────────────────────────────────────────────────────────────────────────────

export interface TasksCardProps {
  work: UnifiedProfileDto["work"];
}

function ProfileTaskRow({ task }: { task: MappedTask }) {
  const isOverdue = !task.completed && new Date(task.dueDate) < new Date();

  return (
    <div
      className="flex items-start gap-3 py-2.5 border-b last:border-0"
      data-testid={`row-task-${task.id}`}
    >
      {task.completed ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
      ) : isOverdue ? (
        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
      ) : (
        <Circle className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium truncate ${task.completed ? "line-through text-gray-400" : "text-gray-800"}`}
          data-testid={`text-task-title-${task.id}`}
        >
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
          <Clock className="w-3 h-3" />
          <span
            className={isOverdue && !task.completed ? "text-red-500 font-medium" : ""}
            data-testid={`text-task-due-${task.id}`}
          >
            {fmt(task.dueDate)}
          </span>
          {task.taskType && (
            <Badge variant="outline" className="text-xs py-0">
              {task.taskType.replace(/_/g, " ")}
            </Badge>
          )}
          {task.automationMeta && (
            <Badge
              variant="outline"
              className="text-xs py-0 px-1.5 bg-violet-50 text-violet-700 border-violet-200 gap-1"
              data-testid={`badge-automation-${task.id}`}
              title={`Stage: ${task.automationMeta.triggerStageSlug.replace(/-/g, " ")}`}
            >
              <Zap className="w-3 h-3" />
              Auto
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

export function TasksCard({ work }: TasksCardProps) {
  const { tasks, nextAction } = work;

  return (
    <div className="space-y-4" data-testid="section-tasks">
      {nextAction && (
        <Card className="p-4 border-amber-200 bg-amber-50" data-testid="card-next-action">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Next Action</p>
          <p className="text-sm font-medium text-gray-900" data-testid="text-next-action-title">{nextAction.title}</p>
          <p className="text-xs text-amber-600 mt-0.5" data-testid="text-next-action-due">Due: {fmt(nextAction.dueDate)}</p>
        </Card>
      )}

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Tasks{tasks.length > 0 ? ` (${tasks.length})` : ""}
        </h3>
        {tasks.length === 0 ? (
          <EmptySection label="tasks" />
        ) : (
          <div>{tasks.map((t) => <ProfileTaskRow key={t.id} task={t} />)}</div>
        )}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section: FilesCard
// ─────────────────────────────────────────────────────────────────────────────

export interface FilesCardProps {
  files: MappedFile[];
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  return "📎";
}

export function FilesCard({ files }: FilesCardProps) {
  return (
    <Card className="p-5" data-testid="card-files">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <Paperclip className="w-4 h-4 text-gray-400" />
        Files{files.length > 0 ? ` (${files.length})` : ""}
      </h3>
      {files.length === 0 ? (
        <EmptySection label="files" />
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
              data-testid={`row-file-${f.id}`}
            >
              <span className="text-base shrink-0">{fileIcon(f.mimeType)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 font-medium truncate" data-testid={`text-filename-${f.id}`}>
                  {f.originalName}
                </p>
                <p className="text-xs text-gray-400" data-testid={`text-filesize-${f.id}`}>
                  {formatBytes(f.sizeBytes)} · {fmt(f.createdAt)}
                </p>
              </div>
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-blue-500 hover:text-blue-700"
                aria-label={`Download ${f.originalName}`}
                data-testid={`link-download-file-${f.id}`}
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section: BillingOnboardingCard (legacy)
// ─────────────────────────────────────────────────────────────────────────────

export interface BillingOnboardingCardProps {
  service: UnifiedProfileDto["service"];
}

const ONBOARDING_STATUS_STYLE: Record<string, string> = {
  pending:     "bg-gray-100 text-gray-600 border-gray-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  completed:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  on_hold:     "bg-amber-100 text-amber-700 border-amber-200",
};

function OnboardingRow({ record }: { record: MappedOnboarding }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b last:border-0" data-testid={`row-onboarding-${record.id}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate" data-testid={`text-onboarding-client-${record.id}`}>
          {record.clientName}
        </p>
        {record.dueDate && (
          <p className="text-xs text-gray-400" data-testid={`text-onboarding-due-${record.id}`}>
            Due: {fmt(record.dueDate)}
          </p>
        )}
      </div>
      <Badge
        className={`${ONBOARDING_STATUS_STYLE[record.status] ?? "bg-gray-100 text-gray-600"} text-xs`}
        data-testid={`badge-onboarding-status-${record.id}`}
      >
        {record.status.replace(/_/g, " ")}
      </Badge>
    </div>
  );
}

export function BillingOnboardingCard({ service }: BillingOnboardingCardProps) {
  const { billingSummary, onboarding } = service;

  return (
    <div className="space-y-4" data-testid="section-service">
      <Card className="p-5" data-testid="card-billing">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-gray-400" />
          Billing
        </h3>
        {!billingSummary ? (
          <EmptySection label="billing info" />
        ) : billingSummary.hasStripe ? (
          <div className="flex items-center gap-2 text-sm" data-testid="div-stripe-active">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span className="text-gray-700">Stripe customer linked</span>
            {billingSummary.stripeCustomerId && (
              <code className="text-xs text-gray-400 font-mono" data-testid="text-stripe-customer-id">
                {billingSummary.stripeCustomerId}
              </code>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-gray-400" data-testid="div-no-stripe">
            <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
            No Stripe customer connected
          </div>
        )}
      </Card>

      <Card className="p-5" data-testid="card-onboarding">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Rocket className="w-4 h-4 text-gray-400" />
          Onboarding{onboarding.length > 0 ? ` (${onboarding.length})` : ""}
        </h3>
        {onboarding.length === 0 ? (
          <EmptySection label="onboarding records" />
        ) : (
          <div>
            {onboarding.map((r) => <OnboardingRow key={r.id} record={r} />)}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section: TimelineSection
// ─────────────────────────────────────────────────────────────────────────────

export interface TimelineSectionProps {
  entry: ProfileEntry;
}

export function TimelineSection({ entry }: TimelineSectionProps) {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useInfiniteTimeline(entry);

  const events = data?.pages.flatMap((p) => p.events) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse" data-testid="timeline-loading">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (error) {
    return <ProfileError message={(error as Error).message} />;
  }

  if (events.length === 0) {
    return <EmptySection label="timeline events" />;
  }

  return (
    <div className="space-y-1" data-testid="section-timeline">
      {events.map((event) => <TimelineEventRow key={event.id} event={event} />)}
      {hasNextPage && (
        <div className="pt-2 flex justify-center">
          <button
            className="text-sm text-[#0D9488] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            data-testid="button-timeline-load-more"
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}

function TimelineEventRow({ event }: { event: UnifiedTimelineEvent }) {
  const IconComponent = TIMELINE_ICON[event.type] ?? Info;
  const sourceLabel = SOURCE_LABEL[event.source] ?? event.source;

  return (
    <div
      className="flex gap-3 py-3 border-b last:border-0"
      data-testid={`row-timeline-${event.id}`}
    >
      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
        <IconComponent className="w-3.5 h-3.5 text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800" data-testid={`text-timeline-content-${event.id}`}>
          {event.content}
        </p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400 flex-wrap">
          <span data-testid={`text-timeline-date-${event.id}`}>{fmtRelative(event.timestamp)}</span>
          {event.actor && (
            <span className="text-gray-500" data-testid={`text-timeline-actor-${event.id}`}>
              · {event.actor}
            </span>
          )}
          <Badge variant="outline" className="text-xs py-0 capitalize" data-testid={`badge-timeline-source-${event.id}`}>
            {sourceLabel}
          </Badge>
          <Badge variant="outline" className="text-xs py-0 capitalize" data-testid={`badge-timeline-type-${event.id}`}>
            {event.type.replace(/_/g, " ")}
          </Badge>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-form: NoteForm
// ─────────────────────────────────────────────────────────────────────────────

function NoteForm({ onSubmit, isPending }: { onSubmit: (data: Record<string, unknown>) => void; isPending: boolean }) {
  const form = useForm({
    resolver: zodResolver(createNoteSchema),
    defaultValues: { type: "general" as const, content: "", isPinned: false },
  });

  const handleSubmit = (data: Record<string, unknown>) => {
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
                      <SelectTrigger data-testid="select-note-type">
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
                    <RichTextEditorField
                      value={field.value || ""}
                      onChange={(html) => field.onChange(html)}
                      onBlur={field.onBlur}
                      placeholder="Type a note..."
                      minHeight="80px"
                      data-testid="input-note-content"
                    />
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
          <Button
            type="submit"
            disabled={isPending || !form.watch("content") || form.watch("content") === "<p></p>"}
            data-testid="button-submit-note"
          >
            Add Note
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-form: TaskForm
// ─────────────────────────────────────────────────────────────────────────────

function TaskForm({ onSubmit, isPending, t }: { onSubmit: (data: Record<string, unknown>) => void; isPending: boolean; t: AdminTranslations }) {
  const form = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      notes: "",
      taskType: "follow_up" as const,
      dueDate: new Date().toISOString().split("T")[0],
    },
  });

  const handleSubmit = (data: Record<string, unknown>) => {
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
              <FormLabel>{t.profileShell.taskTitle}</FormLabel>
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
                <FormLabel>{t.profileShell.taskType}</FormLabel>
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
                <FormLabel>{t.profileShell.dueDate}</FormLabel>
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
              <FormLabel>{t.profileShell.notesOptional}</FormLabel>
              <FormControl>
                <RichTextEditorField
                  value={field.value || ""}
                  onChange={(html) => field.onChange(html)}
                  onBlur={field.onBlur}
                  placeholder="Additional details..."
                  minHeight="80px"
                  data-testid="input-task-notes"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="submit" disabled={isPending} data-testid="button-submit-task">
            {isPending ? "..." : t.profileShell.createTask}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-form: ContactForm
// ─────────────────────────────────────────────────────────────────────────────

function ContactForm({ initialData, onSubmit, isPending, t }: {
  initialData: MappedContact | null;
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
  t: AdminTranslations;
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
    },
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
                <FormLabel>{t.profileShell.firstName}</FormLabel>
                <FormControl><Input {...field} data-testid="input-contact-first-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.profileShell.lastName}</FormLabel>
                <FormControl><Input {...field} value={field.value || ""} data-testid="input-contact-last-name" /></FormControl>
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
              <FormLabel>{t.profileShell.email}</FormLabel>
              <FormControl><Input {...field} value={field.value || ""} data-testid="input-contact-email" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.profileShell.phone}</FormLabel>
              <FormControl><Input {...field} value={field.value || ""} data-testid="input-contact-phone" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t.profileShell.titlePosition}</FormLabel>
              <FormControl><Input {...field} value={field.value || ""} data-testid="input-contact-title" /></FormControl>
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
                <FormLabel>{t.profileShell.language}</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-contact-language">
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
                <FormLabel>{t.profileShell.primaryContact}</FormLabel>
              </FormItem>
            )}
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={isPending} data-testid="button-submit-contact">
            {isPending ? t.profileShell.saving : (initialData ? t.profileShell.updateContact : t.profileShell.addContact)}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-form: AccountHealthForm
// ─────────────────────────────────────────────────────────────────────────────

function AccountHealthForm({ company, onSubmit, isPending }: {
  company: MappedCompany;
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const form = useForm({
    resolver: zodResolver(accountHealthSchema),
    defaultValues: {
      launchDate: company.launchDate ? new Date(company.launchDate).toISOString().split("T")[0] : "",
      renewalDate: company.renewalDate ? new Date(company.renewalDate).toISOString().split("T")[0] : "",
      websiteStatus: company.websiteStatus || "",
      carePlanStatus: company.carePlanStatus || "",
      serviceTier: company.serviceTier || "",
      billingNotes: company.billingNotes || "",
    },
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
                <RichTextEditorField
                  value={field.value || ""}
                  onChange={(html) => field.onChange(html)}
                  onBlur={field.onBlur}
                  placeholder="Payment terms, invoicing notes..."
                  minHeight="80px"
                  data-testid="input-billing-notes"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending} data-testid="button-save-account-health">
            {isPending ? "..." : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section: AccountManagementForm (Overview tab)
// ─────────────────────────────────────────────────────────────────────────────

function AccountManagementForm({ company, users, onSubmit, isPending, t }: {
  company: MappedCompany;
  users: Pick<DbUser, "id" | "name">[];
  onSubmit: (data: Record<string, unknown>) => void;
  isPending: boolean;
  t: AdminTranslations;
}) {
  const form = useForm({
    resolver: zodResolver(updateAccountSchema),
    defaultValues: {
      clientStatus: company.clientStatus || "prospect",
      accountOwnerId: company.accountOwnerId || "",
      nextFollowUpDate: company.nextFollowUpDate ? new Date(company.nextFollowUpDate).toISOString().split("T")[0] : "",
      preferredContactMethod: company.preferredContactMethod || "email",
      preferredLanguage: company.preferredLanguage || "es",
      name: company.name,
      dba: company.dba || "",
      phone: company.phone || "",
      email: company.email || "",
      website: company.website || "",
      industry: company.industry || "",
      address: company.address || "",
      city: company.city || "",
      state: company.state || "",
      zip: company.zip || "",
      notes: company.notes || "",
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-teal-500" />
          {t.profileShell.accountManagement}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => onSubmit(data as Record<string, unknown>))} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="clientStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.profileShell.clientStatus}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-client-status-overview">
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
                    <FormLabel>{t.profileShell.accountOwner}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-account-owner-overview">
                          <SelectValue placeholder="Select owner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users.map((u) => (
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
                    <FormLabel>{t.profileShell.nextFollowUp}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value?.toString() || ""} data-testid="input-next-followup-overview" />
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
                    <FormLabel>{t.profileShell.preferredMethod}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-preferred-method-overview">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="email">{t.profileShell.email}</SelectItem>
                        <SelectItem value="phone">{t.profileShell.phone}</SelectItem>
                        <SelectItem value="text">Text</SelectItem>
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
                  <FormLabel>{t.profileShell.internalNotes}</FormLabel>
                  <FormControl>
                    <RichTextEditorField
                      value={field.value || ""}
                      onChange={(html) => field.onChange(html)}
                      onBlur={field.onBlur}
                      placeholder="Internal details about this account..."
                      minHeight="80px"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={isPending} data-testid="button-save-account-overview">
                {isPending ? t.profileShell.saving : t.profileShell.saveChanges}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section: ClientTaskRow (full CRUD version)
// ─────────────────────────────────────────────────────────────────────────────

function ClientTaskRow({ task, onComplete, onToggle, onReschedule, onDelete, canDelete, isToggling, t }: {
  task: ClientTask;
  onComplete: () => void;
  onToggle: () => void;
  onReschedule: () => void;
  onDelete: () => void;
  canDelete: boolean;
  isToggling: boolean;
  t: AdminTranslations;
}) {
  const isOverdue = task.status === "overdue";
  const isDone = task.status === "completed";

  return (
    <Card className={`p-3 flex items-start gap-3 group transition-opacity ${isDone ? "opacity-60" : ""}`} data-testid={`task-row-${task.id}`}>
      <button
        className="mt-0.5 shrink-0"
        onClick={isDone ? onToggle : onComplete}
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
            {task.title}
          </p>
          {task.taskType && (
            <Badge className={`text-[10px] px-1.5 ${TASK_TYPE_COLORS[task.taskType] || "bg-gray-100 text-gray-700"}`}>
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
            {task.dueDate ? (isToday(new Date(task.dueDate)) ? t.profileShell.today : format(new Date(task.dueDate), "MMM d, yyyy")) : t.profileShell.noDueDate}
          </span>
          {task.creatorName && (
            <span className="text-xs text-gray-400">by {task.creatorName}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!isDone && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs px-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onReschedule}
            data-testid={`button-reschedule-task-${task.id}`}
          >
            <CalendarClock className="w-3 h-3 mr-1" />
            {t.tasks.reschedule}
          </Button>
        )}
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onDelete}
            data-testid={`button-delete-task-${task.id}`}
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </Button>
        )}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProfileShell — main orchestrator
// ─────────────────────────────────────────────────────────────────────────────

export interface ProfileShellProps {
  entry: ProfileEntry;
  defaultTab?: "overview" | "notes" | "contacts" | "tasks" | "files" | "billing" | "activity";
  className?: string;
}

export default function ProfileShell({
  entry,
  defaultTab = "overview",
  className = "",
}: ProfileShellProps) {
  const { data: profile, isLoading, error } = useUnifiedProfile(entry);
  const urlTab = new URLSearchParams(window.location.search).get("tab");
  const validTabs = ["overview", "notes", "contacts", "tasks", "files", "billing", "activity"];
  const resolvedTab = urlTab && validTabs.includes(urlTab) ? urlTab : defaultTab;
  const [activeTab, setActiveTab] = useState<string>(resolvedTab);
  const { toast } = useToast();
  const { t } = useAdminLang();
  const [, navigate] = useLocation();

  const [contactedPendingStageId, setContactedPendingStageId] = useState<string | null>(null);
  const [paymentSentPendingStageId, setPaymentSentPendingStageId] = useState<string | null>(null);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<MappedContact | null>(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  const [completingTask, setCompletingTask] = useState<ClientTask | null>(null);
  const [rescheduleTask, setRescheduleTask] = useState<ClientTask | null>(null);

  if (isLoading) return <ProfileSkeleton />;

  if (error) {
    if (error instanceof ProfileLinkageApiError) {
      return <OrphanedOpportunityFallback error={error} />;
    }
    return <ProfileError message={(error as Error).message} />;
  }

  if (!profile) {
    return <ProfileError message="Profile unavailable." />;
  }

  const { identity, sales, work, service, derived } = profile;
  const companyId = identity.company.id;
  const activeOpp = sales.activeOpportunity;
  const hasOpenOpp = activeOpp && activeOpp.status === "open";

  return (
    <ProfileShellInner
      entry={entry}
      profile={profile}
      companyId={companyId}
      activeOpp={activeOpp}
      hasOpenOpp={!!hasOpenOpp}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      toast={toast}
      t={t}
      navigate={navigate}
      contactedPendingStageId={contactedPendingStageId}
      setContactedPendingStageId={setContactedPendingStageId}
      paymentSentPendingStageId={paymentSentPendingStageId}
      setPaymentSentPendingStageId={setPaymentSentPendingStageId}
      isContactDialogOpen={isContactDialogOpen}
      setIsContactDialogOpen={setIsContactDialogOpen}
      editingContact={editingContact}
      setEditingContact={setEditingContact}
      isTaskDialogOpen={isTaskDialogOpen}
      setIsTaskDialogOpen={setIsTaskDialogOpen}
      togglingTaskId={togglingTaskId}
      setTogglingTaskId={setTogglingTaskId}
      fileInputRef={fileInputRef}
      uploadingFile={uploadingFile}
      setUploadingFile={setUploadingFile}
      expandedActivityId={expandedActivityId}
      setExpandedActivityId={setExpandedActivityId}
      completingTask={completingTask}
      setCompletingTask={setCompletingTask}
      rescheduleTask={rescheduleTask}
      setRescheduleTask={setRescheduleTask}
      className={className}
    />
  );
}

interface ProfileShellInnerProps {
  entry: ProfileEntry;
  profile: UnifiedProfileDto;
  companyId: string;
  activeOpp: MappedOpportunity | null;
  hasOpenOpp: boolean;
  activeTab: string;
  setActiveTab: (t: string) => void;
  toast: ReturnType<typeof useToast>["toast"];
  t: AdminTranslations;
  navigate: (to: string) => void;
  contactedPendingStageId: string | null;
  setContactedPendingStageId: (v: string | null) => void;
  paymentSentPendingStageId: string | null;
  setPaymentSentPendingStageId: (v: string | null) => void;
  isContactDialogOpen: boolean;
  setIsContactDialogOpen: (v: boolean) => void;
  editingContact: MappedContact | null;
  setEditingContact: (v: MappedContact | null) => void;
  isTaskDialogOpen: boolean;
  setIsTaskDialogOpen: (v: boolean) => void;
  togglingTaskId: string | null;
  setTogglingTaskId: (v: string | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  uploadingFile: boolean;
  setUploadingFile: (v: boolean) => void;
  expandedActivityId: string | null;
  setExpandedActivityId: (v: string | null) => void;
  completingTask: ClientTask | null;
  setCompletingTask: (v: ClientTask | null) => void;
  rescheduleTask: ClientTask | null;
  setRescheduleTask: (v: ClientTask | null) => void;
  className: string;
}

function ProfileShellInner({
  entry, profile, companyId, activeOpp, hasOpenOpp,
  activeTab, setActiveTab, toast, t, navigate,
  contactedPendingStageId, setContactedPendingStageId,
  paymentSentPendingStageId, setPaymentSentPendingStageId,
  isContactDialogOpen, setIsContactDialogOpen,
  editingContact, setEditingContact,
  isTaskDialogOpen, setIsTaskDialogOpen,
  togglingTaskId, setTogglingTaskId,
  fileInputRef, uploadingFile, setUploadingFile,
  expandedActivityId, setExpandedActivityId,
  completingTask, setCompletingTask,
  rescheduleTask, setRescheduleTask,
  className,
}: ProfileShellInnerProps) {
  const { identity, sales, work, service, derived } = profile;
  const { role } = useAuth();
  const hideSalesRepOppSections = entry.type === "opportunity" && role === "sales_rep";

  const { data: stages } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline/stages"],
    staleTime: STALE.MEDIUM,
    enabled: hasOpenOpp,
  });

  const { data: users = [] } = useQuery<Pick<DbUser, "id" | "name">[]>({
    queryKey: ["/api/admin/users"],
    staleTime: STALE.MEDIUM,
  });

  const { data: notes = [], isLoading: notesLoading } = useQuery<(ClientNote & { user?: Pick<DbUser, "id" | "name"> })[]>({
    queryKey: ["/api/profiles/company", companyId, "notes"],
    enabled: activeTab === "notes",
  });

  const { data: clientTasks = [], isLoading: tasksLoading } = useQuery<ClientTask[]>({
    queryKey: ["/api/profiles/company", companyId, "tasks"],
    enabled: activeTab === "tasks",
  });

  const { data: clientFiles = [], isLoading: filesLoading } = useQuery<ClientFile[]>({
    queryKey: ["/api/profiles/company", companyId, "files"],
    enabled: activeTab === "files",
  });

  const { data: billing, isLoading: billingLoading } = useQuery<BillingSnapshot>({
    queryKey: ["/api/profiles/company", companyId, "billing"],
    enabled: activeTab === "billing",
  });

  const { data: activityHistory = [], isLoading: activityLoading } = useQuery<{
    id: string; event: string; entityType: string; entityId: string;
    fieldName: string | null; fromValue: string | null; toValue: string | null;
    actorId: string | null; actorName: string | null; note: string | null;
    createdAt: string;
  }[]>({
    queryKey: ["/api/profiles/company", companyId, "activity"],
    enabled: activeTab === "activity",
  });

  const stageMutation = useMutation({
    mutationFn: async (stageId: string) => {
      if (!activeOpp) throw new Error("No active opportunity");
      const res = await apiRequest("PUT", `/api/pipeline/opportunities/${activeOpp.id}/stage`, { stageId });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.detail(entry) });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities", activeOpp?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities/board"] });
      if (data?.opportunity?.status === "won") {
        queryClient.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && q.queryKey[0].startsWith("/api/clients") });
      }
      toast({ title: t.pipeline.stageUpdated });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addNoteMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await apiRequest("POST", `/api/profiles/company/${companyId}/notes`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/company", companyId, "notes"] });
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.detail(entry) });
      toast({ title: t.profileShell.noteAdded });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await apiRequest("DELETE", `/api/profiles/company/${companyId}/notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/company", companyId, "notes"] });
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.detail(entry) });
      toast({ title: t.profileShell.noteDeleted });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addContactMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await apiRequest("POST", `/api/profiles/company/${companyId}/contacts`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.detail(entry) });
      setIsContactDialogOpen(false);
      toast({ title: t.profileShell.contactAdded });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ contactId, data }: { contactId: string; data: Record<string, unknown> }) => {
      await apiRequest("PATCH", `/api/profiles/company/${companyId}/contacts/${contactId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.detail(entry) });
      setEditingContact(null);
      toast({ title: t.profileShell.contactUpdated });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addTaskMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await apiRequest("POST", `/api/profiles/company/${companyId}/tasks`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/company", companyId, "tasks"] });
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.detail(entry) });
      setIsTaskDialogOpen(false);
      toast({ title: t.profileShell.taskCreated });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      setTogglingTaskId(taskId);
      await apiRequest("PUT", `/api/profiles/company/${companyId}/tasks/${taskId}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/company", companyId, "tasks"] });
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.detail(entry) });
      setTogglingTaskId(null);
    },
    onError: (err: Error) => {
      setTogglingTaskId(null);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await apiRequest("DELETE", `/api/profiles/company/${companyId}/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/company", companyId, "tasks"] });
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.detail(entry) });
      toast({ title: t.profileShell.taskDeleted });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateHealthMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await apiRequest("PATCH", `/api/profiles/company/${companyId}/account`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/company", companyId, "billing"] });
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.detail(entry) });
      toast({ title: t.profileShell.accountHealthUpdated });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateAccountMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const payload = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, v === "" ? null : v])
      );
      if (payload.website && typeof payload.website === "string" && !/^https?:\/\//i.test(payload.website)) {
        payload.website = `https://${payload.website}`;
      }
      await apiRequest("PATCH", `/api/profiles/company/${companyId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.detail(entry) });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities/board"] });
      toast({ title: t.profileShell.accountUpdated });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("companyId", companyId);
      const res = await fetch("/api/attachments/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/company", companyId, "files"] });
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.detail(entry) });
      toast({ title: t.profileShell.fileUploaded });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Upload failed", variant: "destructive" });
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const quickStats: QuickStatsProps = {
    contacts: identity.contacts.length,
    leads: sales.leadHistory.length,
    deals: sales.opportunities.length,
    dealValue: sales.opportunities.reduce((sum, o) => sum + (Number(o.value) || 0), 0),
    openTasks: work.tasks.filter((wt) => !wt.completed).length,
    t,
  };

  const pinnedNotes = notes.filter((n) => n.isPinned);
  const unpinnedNotes = notes.filter((n) => !n.isPinned);
  const sortedNotes = [...pinnedNotes, ...unpinnedNotes];

  const overdueTasks = clientTasks.filter((ct) => ct.status === "overdue");
  const openTasks = clientTasks.filter((ct) => ct.status === "open");
  const completedTasks = clientTasks.filter((ct) => ct.status === "completed");

  const primaryContact = identity.primaryContact;
  const contact = primaryContact;

  return (
    <div
      className={`flex flex-col gap-6 ${className}`}
      data-testid={`profile-shell-${entry.type}-${entry.id}`}
    >
      <ProfileHeader entry={entry} company={identity.company} derived={derived} />

      {!hideSalesRepOppSections && <QuickStats {...quickStats} />}

      {hasOpenOpp && stages && stages.length > 0 && activeOpp && (
        <MoveToStageBar
          opportunityId={activeOpp.id}
          currentStageId={activeOpp.stageId ?? ""}
          stages={stages}
          onContactedPending={setContactedPendingStageId}
          onPaymentSentPending={setPaymentSentPendingStageId}
          stageMutation={stageMutation}
          t={t}
        />
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto" data-testid="tabs-profile">
          <TabsTrigger value="overview" data-testid="tab-overview">{t.profileShell.overview}</TabsTrigger>
          <TabsTrigger value="notes" data-testid="tab-notes">{t.profileShell.notes}</TabsTrigger>
          <TabsTrigger value="contacts" data-testid="tab-contacts">
            {t.profileShell.contacts}
          </TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">
            {t.profileShell.tasks}
            {work.tasks.length > 0 && (
              <span className="ml-1.5 bg-amber-100 text-amber-700 rounded-full text-xs px-1.5 py-0 font-medium">
                {work.tasks.filter((wt) => !wt.completed).length}
              </span>
            )}
          </TabsTrigger>
          {!hideSalesRepOppSections && <TabsTrigger value="files" data-testid="tab-files">{t.profileShell.files}</TabsTrigger>}
          {!hideSalesRepOppSections && <TabsTrigger value="billing" data-testid="tab-billing">{t.profileShell.billing}</TabsTrigger>}
          <TabsTrigger value="activity" data-testid="tab-activity">{t.profileShell.activity}</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className={`grid grid-cols-1 gap-4 ${!hideSalesRepOppSections ? "lg:grid-cols-2" : ""}`}>
            <CompanyContactCard
              entry={entry}
              company={identity.company}
              primaryContact={identity.primaryContact}
              contacts={identity.contacts}
            />
            {!hideSalesRepOppSections && (
              <SalesSnapshotCard
                entry={entry}
                sales={sales}
                companyName={identity.company?.name}
                contactName={identity.primaryContact ? [identity.primaryContact.firstName, identity.primaryContact.lastName].filter(Boolean).join(" ") : null}
                contacts={identity.contacts}
              />
            )}
          </div>
          {!hideSalesRepOppSections && (
            <AccountManagementForm
              company={identity.company}
              users={users}
              onSubmit={(data) => updateAccountMutation.mutate(data)}
              isPending={updateAccountMutation.isPending}
              t={t}
            />
          )}
        </TabsContent>

        {/* ── Notes Tab ────────────────────────────────────────────────────── */}
        <TabsContent value="notes" className="mt-4 space-y-4">
          <NoteForm onSubmit={(data) => addNoteMutation.mutate(data)} isPending={addNoteMutation.isPending} />

          {notesLoading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-50 rounded-lg" />)}
            </div>
          ) : sortedNotes.length === 0 ? (
            <Card className="p-8 text-center">
              <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">{t.profileShell.noNotesYet}</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {sortedNotes.map((note) => {
                const NoteIcon = NOTE_TYPE_ICONS[note.type] || MessageSquare;
                return (
                  <Card key={note.id} className={`p-4 ${note.isPinned ? "border-amber-200 bg-amber-50/30" : ""}`} data-testid={`note-${note.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                          <NoteIcon className="w-4 h-4 text-gray-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge className={`text-[10px] ${NOTE_TYPE_COLORS[note.type] || "bg-gray-100 text-gray-700"}`}>
                              {note.type}
                            </Badge>
                            {note.isPinned && (
                              <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                                <Pin className="w-2.5 h-2.5 mr-0.5" /> {t.profileShell.pinned}
                              </Badge>
                            )}
                            <span className="text-[10px] text-gray-400">
                              {note.user?.name || "System"} · {fmt(typeof note.createdAt === "string" ? note.createdAt : note.createdAt?.toISOString?.() ?? null, "MMM d, yyyy h:mm a")}
                            </span>
                          </div>
                          <div className="text-sm text-gray-700 chat-message-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.content) }} />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity shrink-0"
                        onClick={() => deleteNoteMutation.mutate(note.id)}
                        data-testid={`button-delete-note-${note.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Contacts Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="contacts" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">{t.profileShell.contacts} ({identity.contacts.length})</h3>
            <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-contact">
                  <Plus className="w-4 h-4 mr-1.5" /> {t.profileShell.addContact}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t.profileShell.addContact}</DialogTitle>
                </DialogHeader>
                <ContactForm
                  initialData={null}
                  onSubmit={(data) => addContactMutation.mutate(data)}
                  isPending={addContactMutation.isPending}
                  t={t}
                />
              </DialogContent>
            </Dialog>
          </div>

          {identity.contacts.length === 0 ? (
            <Card className="p-8 text-center">
              <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">{t.profileShell.noContactsYet}</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {identity.contacts.map((c) => (
                <Card key={c.id} className="p-4" data-testid={`contact-card-${c.id}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">
                          {[c.firstName, c.lastName].filter(Boolean).join(" ")}
                        </p>
                        {c.isPrimary && (
                          <Badge className="text-[10px] bg-teal-100 text-teal-700 border-teal-200">Primary</Badge>
                        )}
                      </div>
                      {c.title && <p className="text-xs text-gray-500 mt-0.5">{c.title}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditingContact(c)}
                      data-testid={`button-edit-contact-${c.id}`}
                    >
                      <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                    </Button>
                  </div>
                  <div className="mt-3 space-y-1.5 text-sm">
                    {c.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        <a href={`mailto:${c.email}`} className="text-blue-600 hover:underline text-xs">{c.email}</a>
                      </div>
                    )}
                    {c.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-700">{c.phone}</span>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          <Dialog open={!!editingContact} onOpenChange={(open) => { if (!open) setEditingContact(null); }}>
            <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t.profileShell.editContact}</DialogTitle>
              </DialogHeader>
              {editingContact && (
                <ContactForm
                  initialData={editingContact}
                  onSubmit={(data) => updateContactMutation.mutate({ contactId: editingContact.id, data })}
                  isPending={updateContactMutation.isPending}
                  t={t}
                />
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── Tasks Tab (full CRUD) ────────────────────────────────────────── */}
        <TabsContent value="tasks" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">{t.profileShell.tasks}</h3>
            <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-task">
                  <Plus className="w-4 h-4 mr-1.5" /> {t.profileShell.newTask}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t.profileShell.createTask}</DialogTitle>
                </DialogHeader>
                <TaskForm
                  onSubmit={(data) => addTaskMutation.mutate(data)}
                  isPending={addTaskMutation.isPending}
                  t={t}
                />
              </DialogContent>
            </Dialog>
          </div>

          {tasksLoading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-50 rounded-lg" />)}
            </div>
          ) : clientTasks.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckSquare2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">{t.profileShell.noTasksYet}</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {overdueTasks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">
                    {t.profileShell.overdue} ({overdueTasks.length})
                  </p>
                  {overdueTasks.map((task) => (
                    <ClientTaskRow
                      key={task.id}
                      task={task}
                      onComplete={() => setCompletingTask(task)}
                      onToggle={() => toggleTaskMutation.mutate(task.id)}
                      onReschedule={() => setRescheduleTask(task)}
                      onDelete={() => deleteTaskMutation.mutate(task.id)}
                      canDelete={role !== "sales_rep"}
                      isToggling={togglingTaskId === task.id}
                      t={t}
                    />
                  ))}
                </div>
              )}
              {openTasks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {t.profileShell.open} ({openTasks.length})
                  </p>
                  {openTasks.map((task) => (
                    <ClientTaskRow
                      key={task.id}
                      task={task}
                      onComplete={() => setCompletingTask(task)}
                      onToggle={() => toggleTaskMutation.mutate(task.id)}
                      onReschedule={() => setRescheduleTask(task)}
                      onDelete={() => deleteTaskMutation.mutate(task.id)}
                      canDelete={role !== "sales_rep"}
                      isToggling={togglingTaskId === task.id}
                      t={t}
                    />
                  ))}
                </div>
              )}
              {completedTasks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {t.profileShell.completed} ({completedTasks.length})
                  </p>
                  {completedTasks.map((task) => (
                    <ClientTaskRow
                      key={task.id}
                      task={task}
                      onComplete={() => setCompletingTask(task)}
                      onToggle={() => toggleTaskMutation.mutate(task.id)}
                      onReschedule={() => setRescheduleTask(task)}
                      onDelete={() => deleteTaskMutation.mutate(task.id)}
                      canDelete={role !== "sales_rep"}
                      isToggling={togglingTaskId === task.id}
                      t={t}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── Files Tab ────────────────────────────────────────────────────── */}
        <TabsContent value="files" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">{t.profileShell.files}</h3>
            <div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                data-testid="button-upload-file"
              >
                <Upload className="w-4 h-4 mr-1.5" />
                {uploadingFile ? t.profileShell.uploading : t.profileShell.uploadFile}
              </Button>
            </div>
          </div>

          {filesLoading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-50 rounded-lg" />)}
            </div>
          ) : clientFiles.length === 0 && service.files.length === 0 ? (
            <Card className="p-8 text-center">
              <Paperclip className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">{t.profileShell.noFilesYet}</p>
            </Card>
          ) : (
            <Card className="p-5">
              <div className="space-y-2">
                {(clientFiles.length > 0 ? clientFiles : service.files as Array<{ id: string; originalName: string; mimeType: string; sizeBytes: number; url: string; createdAt: string; uploaderName?: string | null }>).map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    data-testid={`row-file-${f.id}`}
                  >
                    <span className="text-base shrink-0">{fileIcon(f.mimeType)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 font-medium truncate">{f.originalName}</p>
                      <p className="text-xs text-gray-400">
                        {formatBytes(f.sizeBytes)} · {fmt(f.createdAt)}
                        {f.uploaderName && ` · ${f.uploaderName}`}
                      </p>
                    </div>
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-blue-500 hover:text-blue-700"
                      aria-label={`Download ${f.originalName}`}
                      data-testid={`link-download-file-${f.id}`}
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ── Billing Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="billing" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-indigo-400" />
                  {t.profileShell.stripeAccount}
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
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{t.profileShell.connected}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-semibold mb-1">{t.profileShell.stripeCustomerId}</p>
                      <p className="text-sm font-mono bg-gray-50 px-2 py-1 rounded border" data-testid="text-stripe-customer-id-billing">
                        {billing.stripeCustomer.stripeCustomerId}
                      </p>
                    </div>
                    {billing.stripeCustomer.email && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold mb-1">{t.profileShell.billingEmail}</p>
                        <p className="text-sm">{billing.stripeCustomer.email}</p>
                      </div>
                    )}
                    <Button variant="outline" size="sm" asChild>
                      <a href={`https://dashboard.stripe.com/customers/${billing.stripeCustomer.stripeCustomerId}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        {t.profileShell.openInStripe}
                      </a>
                    </Button>
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <CreditCard className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">{t.profileShell.noStripeCustomer}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => navigate("/admin/payments")}
                      data-testid="button-go-to-payments"
                    >
                      {t.profileShell.goToPayments}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-400" />
                  {t.profileShell.serviceOverview}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1.5">{t.profileShell.serviceTier}</p>
                    {identity.company.serviceTier ? (
                      <Badge className={{
                        basic: "bg-gray-100 text-gray-700",
                        standard: "bg-blue-100 text-blue-700",
                        premium: "bg-purple-100 text-purple-700",
                      }[identity.company.serviceTier] || "bg-gray-100 text-gray-700"} data-testid="text-service-tier-billing">
                        {identity.company.serviceTier.charAt(0).toUpperCase() + identity.company.serviceTier.slice(1)}
                      </Badge>
                    ) : (
                      <p className="text-sm text-gray-400">{t.profileShell.notSet}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1.5">{t.profileShell.carePlan}</p>
                    {identity.company.carePlanStatus ? (
                      <Badge className={({
                        active: "bg-emerald-100 text-emerald-700",
                        inactive: "bg-gray-100 text-gray-700",
                        none: "bg-red-100 text-red-700",
                      } as Record<string, string>)[identity.company.carePlanStatus] || "bg-gray-100 text-gray-700"} data-testid="text-care-plan-billing">
                        {identity.company.carePlanStatus.charAt(0).toUpperCase() + identity.company.carePlanStatus.slice(1)}
                      </Badge>
                    ) : (
                      <p className="text-sm text-gray-400">{t.profileShell.notSet}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1.5">{t.profileShell.launchDate}</p>
                    <p className="text-sm" data-testid="text-launch-date-billing">
                      {identity.company.launchDate ? format(new Date(identity.company.launchDate), "MMM d, yyyy") : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1.5">{t.profileShell.renewalDate}</p>
                    <p className={`text-sm ${identity.company.renewalDate && isPast(new Date(identity.company.renewalDate)) ? "text-red-600 font-semibold" : ""}`} data-testid="text-renewal-date-billing">
                      {identity.company.renewalDate ? format(new Date(identity.company.renewalDate), "MMM d, yyyy") : "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t.profileShell.updateServiceDetails}</CardTitle>
            </CardHeader>
            <CardContent>
              <AccountHealthForm
                company={identity.company}
                onSubmit={(data) => updateHealthMutation.mutate(data)}
                isPending={updateHealthMutation.isPending}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Activity Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="activity" className="mt-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-400" />
              {t.profileShell.activityHistory}
            </h3>
            {activityLoading ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-50 rounded-lg" />)}
              </div>
            ) : activityHistory.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">{t.timeline.noHistory}</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {activityHistory.map((evt) => {
                  const label = t.timeline.events[evt.event as keyof typeof t.timeline.events] || evt.event.replace(/_/g, " ");
                  const isExpanded = expandedActivityId === evt.id;

                  const prettyField = (f: string | null) => {
                    if (!f) return null;
                    return f.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
                  };

                  const getDetailRows = (): Array<{ label: string; value: string }> => {
                    const { event, fieldName, fromValue, toValue, actorName, note } = evt;
                    const rows: Array<{ label: string; value: string }> = [];
                    const add = (l: string, v: string | null | undefined) => { if (v) rows.push({ label: l, value: v }); };

                    switch (event) {
                      case "status_changed":
                      case "stage_changed":
                      case "field_updated":
                      case "owner_changed":
                      case "service_tier_changed":
                        add("Field", prettyField(fieldName));
                        add("From", fromValue);
                        add("To", toValue);
                        add("Changed by", actorName);
                        break;
                      case "assigned":
                        add("Assigned to", toValue);
                        add("By", actorName);
                        break;
                      case "task_created":
                      case "task_completed":
                      case "task_reopened":
                      case "task_deleted":
                        add("Task", note);
                        add("Notes", toValue);
                        add("By", actorName);
                        break;
                      case "note_added":
                      case "note_deleted":
                        add("Note", note);
                        add("By", actorName);
                        break;
                      case "contact_added":
                      case "contact_updated":
                        add("Contact", note);
                        add("By", actorName);
                        break;
                      case "checklist_completed":
                      case "checklist_uncompleted":
                        add("Item", note);
                        add("By", actorName);
                        break;
                      case "billing_event":
                        add("Detail", note);
                        add("By", actorName);
                        break;
                      default:
                        add("Field", prettyField(fieldName));
                        add("From", fromValue);
                        add("To", toValue);
                        add("Detail", note);
                        add("By", actorName);
                    }
                    return rows;
                  };

                  const detailRows = getDetailRows();
                  const isExpandable = detailRows.length > 0;

                  return (
                    <div
                      key={evt.id}
                      className={`py-2.5 first:pt-0 last:pb-0 ${isExpandable ? "cursor-pointer" : ""}`}
                      onClick={isExpandable ? () => setExpandedActivityId(isExpanded ? null : evt.id) : undefined}
                      data-testid={`activity-event-${evt.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                          <History className="w-3 h-3 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 leading-tight">{label}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {evt.actorName && <>{evt.actorName} · </>}
                            {fmt(evt.createdAt, "MMM d, yyyy h:mm a")}
                          </p>
                        </div>
                        {isExpandable && (
                          <div className="shrink-0 mt-0.5 text-gray-300">
                            {isExpanded
                              ? <ChevronDown className="w-3.5 h-3.5" />
                              : <ChevronRight className="w-3.5 h-3.5" />
                            }
                          </div>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="ml-9 mt-2 pt-2 border-t border-gray-100 space-y-1">
                          {detailRows.map(({ label: dl, value: dv }) => (
                            <div key={dl} className="flex items-start gap-2">
                              <span className="text-[11px] text-gray-400 shrink-0 w-20">{dl}</span>
                              <span className="text-[11px] text-gray-600 break-words min-w-0 flex-1">{dv}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {hasOpenOpp && activeOpp && (
        <>
          <CompleteTaskModal
            open={contactedPendingStageId !== null}
            onClose={() => setContactedPendingStageId(null)}
            task={null}
            opportunityId={activeOpp.id}
            contactId={primaryContact?.id ?? null}
            defaultTaskTitle={`Follow up with ${contact?.firstName ?? ""} ${contact?.lastName ?? ""}`.trim()}
            onSuccess={() => {
              if (contactedPendingStageId) stageMutation.mutate(contactedPendingStageId);
            }}
          />
          <PaymentSentModal
            open={paymentSentPendingStageId !== null}
            onClose={() => setPaymentSentPendingStageId(null)}
            opportunityId={activeOpp.id}
            onSuccess={() => {
              if (paymentSentPendingStageId) stageMutation.mutate(paymentSentPendingStageId);
            }}
          />
        </>
      )}

      <CompleteTaskModal
        open={!!completingTask}
        onClose={() => setCompletingTask(null)}
        task={completingTask}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/profiles/company", companyId, "tasks"] });
          queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.detail(entry) });
        }}
      />

      <QuickTaskModal
        open={!!rescheduleTask}
        onClose={() => setRescheduleTask(null)}
        editTask={rescheduleTask ? {
          id: rescheduleTask.id,
          title: rescheduleTask.title,
          notes: rescheduleTask.notes ?? null,
          dueDate: typeof rescheduleTask.dueDate === "string"
            ? rescheduleTask.dueDate
            : (rescheduleTask.dueDate as unknown as Date).toISOString(),
          followUpTime: rescheduleTask.followUpTime ?? null,
          followUpTimezone: rescheduleTask.followUpTimezone ?? null,
        } : null}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/profiles/company", companyId, "tasks"] });
          queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.detail(entry) });
        }}
      />
    </div>
  );
}

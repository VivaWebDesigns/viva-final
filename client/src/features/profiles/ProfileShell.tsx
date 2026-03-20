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

import { useState } from "react";
import {
  Building2, User, Phone, Mail, MapPin, Globe,
  AlertCircle, CheckSquare2, Square, Clock, Paperclip,
  MessageSquare, RefreshCw, ArrowRight, Info, CreditCard,
  Rocket, TrendingUp, FileText, Download, Activity,
  CheckCircle2, Circle, Pencil,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useUnifiedProfile, useProfileTimeline } from "./hooks";
import { EditCompanyDialog } from "./edit/EditCompanyDialog";
import { EditContactDialog } from "./edit/EditContactDialog";
import { EditLeadDialog } from "./edit/EditLeadDialog";
import { EditOpportunityDialog } from "./edit/EditOpportunityDialog";
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
            {primaryContact.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-gray-700" data-testid="text-contact-phone">{primaryContact.phone}</span>
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
}

export function SalesSnapshotCard({ entry, sales }: SalesSnapshotCardProps) {
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
          {/* Active opportunity */}
          {activeOpportunity && (
            <div className="rounded-lg bg-violet-50 border border-violet-100 p-3" data-testid="card-active-opportunity">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Active Opportunity</p>
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
                {activeOpportunity.title}
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

          {/* Source lead */}
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
              <p className="text-sm text-gray-800 font-medium truncate" data-testid="text-source-lead-title">{sourceLead.title}</p>
              {sourceLead.sourceLabel && (
                <Badge variant="outline" className="text-xs" data-testid="badge-lead-source">
                  {sourceLead.sourceLabel}
                </Badge>
              )}
            </div>
          )}

          {/* Lead view: show current lead edit button */}
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

          {/* Counts */}
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
// Section: TasksCard
// ─────────────────────────────────────────────────────────────────────────────

export interface TasksCardProps {
  work: UnifiedProfileDto["work"];
}

function TaskRow({ task }: { task: MappedTask }) {
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
          <div>{tasks.map((t) => <TaskRow key={t.id} task={t} />)}</div>
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
// Section: BillingOnboardingCard
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
      {/* Billing */}
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

      {/* Onboarding */}
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
  const { data: events = [], isLoading, error } = useProfileTimeline(entry);

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
// ProfileShell — main orchestrator
// ─────────────────────────────────────────────────────────────────────────────

export interface ProfileShellProps {
  entry: ProfileEntry;
  /** Default tab to open. Defaults to "overview". */
  defaultTab?: "overview" | "timeline" | "tasks" | "files" | "service";
  /** Optional CSS class applied to the outermost container. */
  className?: string;
}

export default function ProfileShell({
  entry,
  defaultTab = "overview",
  className = "",
}: ProfileShellProps) {
  const { data: profile, isLoading, error } = useUnifiedProfile(entry);
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  if (isLoading) return <ProfileSkeleton />;

  if (error || !profile) {
    return <ProfileError message={error ? (error as Error).message : "Profile unavailable."} />;
  }

  const { identity, sales, work, service, derived } = profile;

  return (
    <div
      className={`flex flex-col gap-6 ${className}`}
      data-testid={`profile-shell-${entry.type}-${entry.id}`}
    >
      {/* ── Header (always visible) ─────────────────────────────────────── */}
      <ProfileHeader entry={entry} company={identity.company} derived={derived} />

      {/* ── Tabbed sections ─────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto" data-testid="tabs-profile">
          <TabsTrigger value="overview"  data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline" data-testid="tab-timeline">Timeline</TabsTrigger>
          <TabsTrigger value="tasks"    data-testid="tab-tasks">
            Tasks
            {work.tasks.length > 0 && (
              <span className="ml-1.5 bg-amber-100 text-amber-700 rounded-full text-xs px-1.5 py-0 font-medium">
                {work.tasks.filter((t) => !t.completed).length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="files"   data-testid="tab-files">Files</TabsTrigger>
          <TabsTrigger value="service" data-testid="tab-service">Service</TabsTrigger>
        </TabsList>

        {/* Overview: company/contact + sales side-by-side */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CompanyContactCard
              entry={entry}
              company={identity.company}
              primaryContact={identity.primaryContact}
              contacts={identity.contacts}
            />
            <SalesSnapshotCard entry={entry} sales={sales} />
          </div>
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline" className="mt-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              Activity Timeline
            </h3>
            <TimelineSection entry={entry} />
          </Card>
        </TabsContent>

        {/* Tasks */}
        <TabsContent value="tasks" className="mt-4">
          <TasksCard work={work} />
        </TabsContent>

        {/* Files */}
        <TabsContent value="files" className="mt-4">
          <FilesCard files={service.files} />
        </TabsContent>

        {/* Service: billing + onboarding */}
        <TabsContent value="service" className="mt-4">
          <BillingOnboardingCard service={service} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

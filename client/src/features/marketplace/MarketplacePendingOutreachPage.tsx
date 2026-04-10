import { useState, useEffect } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useQuery, useMutation } from "@tanstack/react-query";
import { STALE, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  Search, Phone, ExternalLink, ChevronLeft, ChevronRight,
  ShoppingBag, AlertCircle, CheckCircle2, Clock, Eye, SkipForward,
  ThumbsUp, ThumbsDown, X, Trash2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatPhoneDisplay } from "@shared/phone";
import { cn } from "@/lib/utils";
import type { MarketplacePendingOutreach } from "@shared/schema";

// ─── ApiError — carries parsed JSON body from non-2xx responses ───────────────

class ApiError extends Error {
  constructor(public status: number, public body: Record<string, unknown>) {
    super(`${status}`);
  }
}

async function apiFetch(
  method: string,
  url: string,
  payload?: unknown,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: payload !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new ApiError(res.status, body);
  }
  return res;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ListResponse {
  items: MarketplacePendingOutreach[];
  total: number;
  page:  number;
  limit: number;
}

interface SummaryResponse {
  ready_to_message?:       number;
  awaiting_reply?:         number;
  reply_received?:         number;
  manual_review_required?: number;
  converted?:              number;
  skipped?:                number;
  [key: string]:           number | undefined;
}

interface DuplicateMatch {
  name:            string;
  businessName:    string | null;
  phone:           string | null;
  city:            string | null;
  state:           string | null;
  assignedRepName: string | null;
  stageName:       string | null;
  leadId?:         string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_STATUSES = [
  "ready_to_message",
  "awaiting_reply",
  "reply_received",
  "manual_review_required",
  "converted",
  "skipped",
] as const;

type OutreachStatus = typeof ALL_STATUSES[number];

const STATUS_LABELS: Record<OutreachStatus, string> = {
  ready_to_message:       "Ready to Message",
  awaiting_reply:         "Awaiting Reply",
  reply_received:         "Reply Received",
  manual_review_required: "Manual Review",
  converted:              "Converted",
  skipped:                "Skipped",
};

const STATUS_BADGE_CLASSES: Record<OutreachStatus, string> = {
  ready_to_message:       "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  awaiting_reply:         "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  reply_received:         "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  manual_review_required: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  converted:              "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  skipped:                "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
};

const SUMMARY_COUNT_COLORS: Record<OutreachStatus, string> = {
  ready_to_message:       "text-blue-600",
  awaiting_reply:         "text-amber-600",
  reply_received:         "text-green-600",
  manual_review_required: "text-orange-600",
  converted:              "text-teal-600",
  skipped:                "text-gray-500",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(val: string | Date | null | undefined): string {
  if (!val) return "—";
  return new Date(val).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function formatDateShort(val: string | Date | null | undefined): string {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", {
    month: "2-digit", day: "2-digit", year: "2-digit",
  });
}

function getDisplayPhone(record: MarketplacePendingOutreach): string | null {
  const raw = record.replyPhoneNormalized ?? record.extractedPhone;
  if (!raw) return null;
  try { return formatPhoneDisplay(raw); } catch { return raw; }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = status as OutreachStatus;
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium",
        STATUS_BADGE_CLASSES[s] ?? "bg-gray-100 text-gray-600"
      )}
    >
      {STATUS_LABELS[s] ?? status}
    </span>
  );
}

// ─── Duplicate inline block ───────────────────────────────────────────────────

function DuplicateInlineBlock({
  match,
  onViewLead,
}: {
  match: DuplicateMatch;
  onViewLead?: () => void;
}) {
  return (
    <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm space-y-1">
      <p className="font-semibold text-destructive flex items-center gap-1.5">
        <AlertCircle className="w-4 h-4" /> Duplicate already exists
      </p>
      {match.name          && <p><span className="text-muted-foreground">Name:</span> {match.name}</p>}
      {match.businessName  && <p><span className="text-muted-foreground">Business:</span> {match.businessName}</p>}
      {match.phone         && <p><span className="text-muted-foreground">Phone:</span> {formatPhoneDisplay(match.phone)}</p>}
      {(match.city || match.state) && (
        <p>
          <span className="text-muted-foreground">Location:</span>{" "}
          {[match.city, match.state].filter(Boolean).join(", ")}
        </p>
      )}
      {match.assignedRepName && <p><span className="text-muted-foreground">Rep:</span> {match.assignedRepName}</p>}
      {match.stageName       && <p><span className="text-muted-foreground">Stage:</span> {match.stageName}</p>}
      {match.leadId && onViewLead && (
        <Button variant="outline" size="sm" className="mt-2" onClick={onViewLead} data-testid="button-view-dup-lead">
          <Eye className="w-3 h-3 mr-1.5" /> View existing lead
        </Button>
      )}
    </div>
  );
}

// ─── Detail field row ─────────────────────────────────────────────────────────

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium break-words">{children}</span>
    </div>
  );
}

function DetailLink({ href, label }: { href: string | null | undefined; label?: string }) {
  if (!href) return <span className="text-muted-foreground">—</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 text-sm"
    >
      {label || href}
      <ExternalLink className="w-3 h-3 flex-shrink-0" />
    </a>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MarketplacePendingOutreachPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [rawSearch, setRawSearch]       = useState("");
  const search                           = useDebounce(rawSearch, 300);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [hasPhone, setHasPhone]         = useState<boolean | undefined>(undefined);
  const [hasCrmLead, setHasCrmLead]     = useState<boolean | undefined>(undefined);
  const [page, setPage]                 = useState(1);
  const limit                            = 25;

  // selectedId drives the Sheet drawer; null = closed
  const [selectedId, setSelectedId]           = useState<string | null>(null);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [duplicateMatch, setDuplicateMatch]       = useState<DuplicateMatch | null>(null);
  const [convertedLeadId, setConvertedLeadId]     = useState<string | null>(null);

  // Multi-select state (page-local only)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Delete confirmation dialogs
  const [showDeleteConfirm, setShowDeleteConfirm]           = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm]   = useState(false);

  useEffect(() => { setPage(1); }, [search, statusFilter, hasPhone, hasCrmLead]);
  // Clear selection whenever filters or page changes (page-local selection contract)
  useEffect(() => { setSelectedIds(new Set()); }, [search, statusFilter, hasPhone, hasCrmLead, page]);

  const summaryQueryKey = ["/api/marketplace/pending-outreach/summary"] as const;

  // ── Summary counts ────────────────────────────────────────────────────────
  const { data: summary = {} } = useQuery<SummaryResponse>({
    queryKey: summaryQueryKey,
    staleTime: STALE.FAST,
    queryFn: async () => {
      const res = await fetch("/api/marketplace/pending-outreach/summary", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
  });

  // ── List ──────────────────────────────────────────────────────────────────
  const listQueryKey = [
    "/api/marketplace/pending-outreach",
    "list", search, statusFilter, hasPhone, hasCrmLead, page,
  ] as const;

  const { data: listData, isLoading } = useQuery<ListResponse>({
    queryKey: listQueryKey,
    staleTime: STALE.FAST,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search)       params.set("search",     search);
      if (statusFilter) params.set("status",     statusFilter);
      if (hasPhone  !== undefined) params.set("hasPhone",   String(hasPhone));
      if (hasCrmLead !== undefined) params.set("hasCrmLead", String(hasCrmLead));
      params.set("page",  String(page));
      params.set("limit", String(limit));
      const res = await fetch(`/api/marketplace/pending-outreach?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch records");
      return res.json();
    },
  });

  // ── Drawer detail (query-backed, keyed by selectedId) ─────────────────────
  const detailQueryKey = ["/api/marketplace/pending-outreach", selectedId] as const;

  const { data: detailRecord, isLoading: detailLoading, isError: detailError } = useQuery<MarketplacePendingOutreach>({
    queryKey: detailQueryKey,
    enabled: !!selectedId,
    staleTime: STALE.FAST,
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/api/marketplace/pending-outreach/${selectedId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(res.status === 404 ? "not_found" : "fetch_error");
      return res.json();
    },
  });

  // ── Deep-link: auto-open record from ?recordId= query param ──────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const recordId = params.get("recordId");
    if (recordId) {
      setSelectedId(recordId);
      // Clean the param from URL so closing doesn't re-trigger on back-nav
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const items      = listData?.items ?? [];
  const total      = listData?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const hasFilters = !!(search || statusFilter || hasPhone !== undefined || hasCrmLead !== undefined);

  // Invalidate list + summary + detail in sync after any action
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/marketplace/pending-outreach/summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/marketplace/pending-outreach", "list"] });
    if (selectedId) {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/pending-outreach", selectedId] });
    }
  };

  // ── Skip mutation ─────────────────────────────────────────────────────────
  const skipMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch("PATCH", `/api/marketplace/pending-outreach/${id}`, {
        messageStatus: "skipped",
      });
      return res.json() as Promise<MarketplacePendingOutreach>;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Record skipped" });
    },
    onError: (e: unknown) => {
      const msg = e instanceof ApiError
        ? ((e.body.message as string | undefined) ?? `Error ${e.status}`)
        : e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Failed to skip", description: msg, variant: "destructive" });
    },
  });

  // ── Convert mutation ──────────────────────────────────────────────────────
  const convertMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch("POST", `/api/marketplace/pending-outreach/${id}/convert-to-crm`, {});
      return res.json() as Promise<{ crmLeadId: string; messageStatus: string }>;
    },
    onSuccess: (data) => {
      invalidateAll();
      setShowConvertDialog(false);
      setDuplicateMatch(null);
      setConvertedLeadId(data?.crmLeadId ?? null);
      toast({ title: "Converted to CRM lead" });
    },
    onError: (e: unknown) => {
      setShowConvertDialog(false);
      if (e instanceof ApiError) {
        const body = e.body as { code?: string; match?: DuplicateMatch; message?: string };
        if (e.status === 409 && body.code === "DUPLICATE_LEAD" && body.match) {
          setDuplicateMatch(body.match);
          return;
        }
        toast({
          title: "Conversion failed",
          description: body.message ?? `Error ${e.status}`,
          variant: "destructive",
        });
        return;
      }
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Conversion failed", description: msg, variant: "destructive" });
    },
  });

  // ── Approve manual review ─────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch("POST", `/api/marketplace/pending-outreach/${id}/approve-match`);
      return res.json() as Promise<MarketplacePendingOutreach>;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Match approved — status changed to Reply Received" });
    },
    onError: (e: unknown) => {
      const msg = e instanceof ApiError
        ? ((e.body.message as string | undefined) ?? `Error ${e.status}`)
        : e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Approve failed", description: msg, variant: "destructive" });
    },
  });

  // ── Reject manual review ──────────────────────────────────────────────────
  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch("POST", `/api/marketplace/pending-outreach/${id}/reject-match`);
      return res.json() as Promise<MarketplacePendingOutreach>;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Match rejected — record skipped" });
    },
    onError: (e: unknown) => {
      const msg = e instanceof ApiError
        ? ((e.body.message as string | undefined) ?? `Error ${e.status}`)
        : e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Reject failed", description: msg, variant: "destructive" });
    },
  });

  // ── Bulk Skip mutation ────────────────────────────────────────────────────
  const bulkSkipMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiFetch("POST", "/api/marketplace/pending-outreach/bulk-skip", { ids });
      return res.json() as Promise<{ count: number; updatedIds: string[] }>;
    },
    onSuccess: (data) => {
      setSelectedIds(new Set());
      invalidateAll();
      toast({ title: `${data.count} record${data.count !== 1 ? "s" : ""} skipped` });
    },
    onError: (e: unknown) => {
      const msg = e instanceof ApiError
        ? ((e.body.message as string | undefined) ?? `Error ${e.status}`)
        : e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Bulk skip failed", description: msg, variant: "destructive" });
    },
  });

  // ── Bulk Approve mutation ─────────────────────────────────────────────────
  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiFetch("POST", "/api/marketplace/pending-outreach/bulk-approve-match", { ids });
      return res.json() as Promise<{ count: number; updatedIds: string[] }>;
    },
    onSuccess: (data) => {
      setSelectedIds(new Set());
      invalidateAll();
      toast({ title: `${data.count} record${data.count !== 1 ? "s" : ""} approved` });
    },
    onError: (e: unknown) => {
      const msg = e instanceof ApiError
        ? ((e.body.message as string | undefined) ?? `Error ${e.status}`)
        : e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Bulk approve failed", description: msg, variant: "destructive" });
    },
  });

  // ── Delete single record ──────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch("DELETE", `/api/marketplace/pending-outreach/${id}`);
      return res.json() as Promise<{ deleted: boolean; id: string }>;
    },
    onSuccess: () => {
      closeDrawer();
      invalidateAll();
      toast({ title: "Record deleted" });
    },
    onError: (e: unknown) => {
      const msg = e instanceof ApiError
        ? ((e.body.message as string | undefined) ?? `Error ${e.status}`)
        : e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Delete failed", description: msg, variant: "destructive" });
    },
  });

  // ── Bulk Delete mutation ───────────────────────────────────────────────────
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiFetch("POST", "/api/marketplace/pending-outreach/bulk-delete", { ids });
      return res.json() as Promise<{ count: number; deletedIds: string[] }>;
    },
    onSuccess: (data) => {
      setSelectedIds(new Set());
      invalidateAll();
      toast({ title: `${data.count} record${data.count !== 1 ? "s" : ""} deleted` });
    },
    onError: (e: unknown) => {
      const msg = e instanceof ApiError
        ? ((e.body.message as string | undefined) ?? `Error ${e.status}`)
        : e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Bulk delete failed", description: msg, variant: "destructive" });
    },
  });

  // ── Bulk action selection helpers ─────────────────────────────────────────
  const BULK_SKIP_ELIGIBLE_STATUSES = [
    "ready_to_message", "awaiting_reply", "reply_received", "manual_review_required",
  ];

  const allCurrentPageSelected =
    items.length > 0 && items.every((item) => selectedIds.has(item.id));
  const someCurrentPageSelected =
    items.some((item) => selectedIds.has(item.id)) && !allCurrentPageSelected;

  const toggleSelectAll = () => {
    if (allCurrentPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        items.forEach((item) => next.delete(item.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        items.forEach((item) => next.add(item.id));
        return next;
      });
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkSkip = () => {
    const selectedRecords = items.filter((item) => selectedIds.has(item.id));
    const ineligible = selectedRecords.filter(
      (r) => !BULK_SKIP_ELIGIBLE_STATUSES.includes(r.messageStatus)
    );
    if (ineligible.length > 0) {
      toast({
        title: "Cannot bulk skip",
        description: `${ineligible.length} record(s) are not eligible for skipping (${[...new Set(ineligible.map((r) => r.messageStatus))].join(", ")}).`,
        variant: "destructive",
      });
      return;
    }
    bulkSkipMutation.mutate([...selectedIds]);
  };

  const handleBulkApprove = () => {
    const selectedRecords = items.filter((item) => selectedIds.has(item.id));
    const ineligible = selectedRecords.filter(
      (r) => r.messageStatus !== "manual_review_required"
    );
    if (ineligible.length > 0) {
      toast({
        title: "Cannot bulk approve",
        description: `${ineligible.length} record(s) are not in "Manual Review" status (${[...new Set(ineligible.map((r) => r.messageStatus))].join(", ")}).`,
        variant: "destructive",
      });
      return;
    }
    bulkApproveMutation.mutate([...selectedIds]);
  };

  const handleCardClick = (status: OutreachStatus) => {
    setStatusFilter(statusFilter === status ? "" : status);
  };

  const handleRowClick = (record: MarketplacePendingOutreach) => {
    if (selectedId === record.id) return;
    setSelectedId(record.id);
    setDuplicateMatch(null);
    setConvertedLeadId(null);
  };

  const closeDrawer = () => {
    setSelectedId(null);
    setDuplicateMatch(null);
    setConvertedLeadId(null);
  };

  const canSkip      = (s: string) => ["ready_to_message", "awaiting_reply", "reply_received"].includes(s);
  const canConvert   = (s: string) => s === "reply_received";
  const canApprove   = (s: string) => s === "manual_review_required";
  const canReject    = (s: string) => s === "manual_review_required";
  const isConverted  = (s: string) => s === "converted";

  return (
    <div className="flex flex-col gap-6" data-testid="page-marketplace-pending-outreach">

      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"
          data-testid="text-marketplace-title"
        >
          <ShoppingBag className="w-6 h-6 text-violet-500" />
          Marketplace Pending Outreach
        </h1>
        <p className="text-gray-500 text-sm mt-1">{total} record{total !== 1 ? "s" : ""}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {ALL_STATUSES.map((status) => {
          const cnt = summary[status] ?? 0;
          const active = statusFilter === status;
          return (
            <button
              key={status}
              onClick={() => handleCardClick(status)}
              data-testid={`card-summary-${status}`}
              className={cn(
                "rounded-lg border bg-white dark:bg-gray-900 p-3 text-left transition-all cursor-pointer hover:shadow-sm",
                active
                  ? "ring-2 ring-violet-400 border-violet-300 shadow-sm"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <p className={cn("text-2xl font-bold", SUMMARY_COUNT_COLORS[status])}>{cnt}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{STATUS_LABELS[status]}</p>
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              placeholder="Search name, title, phone…"
              className="pl-10"
              data-testid="input-search-outreach"
            />
          </div>
          <Select
            value={statusFilter || "all"}
            onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}
          >
            <SelectTrigger className="w-full sm:w-52" data-testid="select-status-filter">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 sm:ml-2">
            <Switch
              id="has-phone-toggle"
              checked={hasPhone === true}
              onCheckedChange={(v) => { setHasPhone(v ? true : undefined); setPage(1); }}
              data-testid="toggle-has-phone"
            />
            <Label htmlFor="has-phone-toggle" className="text-sm whitespace-nowrap cursor-pointer">
              Has Phone
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="has-crm-lead-toggle"
              checked={hasCrmLead === true}
              onCheckedChange={(v) => { setHasCrmLead(v ? true : undefined); setPage(1); }}
              data-testid="toggle-has-crm-lead"
            />
            <Label htmlFor="has-crm-lead-toggle" className="text-sm whitespace-nowrap cursor-pointer">
              Has CRM Lead
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* "No drawer selected" hint (shown when no record is selected and table is populated) */}
      {!selectedId && !isLoading && items.length > 0 && (
        <p
          className="text-sm text-muted-foreground text-center"
          data-testid="text-no-record-selected"
        >
          <Clock className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
          Click any row to view its details.
        </p>
      )}

      {/* Bulk action bar — visible when 1+ rows selected */}
      {selectedIds.size > 0 && (
        <div
          className="flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-lg border border-violet-200 bg-violet-50 dark:border-violet-800/50 dark:bg-violet-950/20"
          data-testid="bulk-action-bar"
        >
          <span
            className="text-sm font-medium text-violet-700 dark:text-violet-300"
            data-testid="text-bulk-selected-count"
          >
            {selectedIds.size} record{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkSkip}
              disabled={bulkSkipMutation.isPending || bulkApproveMutation.isPending}
              data-testid="button-bulk-skip"
            >
              <SkipForward className="w-3.5 h-3.5 mr-1.5" />
              Skip ({selectedIds.size})
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleBulkApprove}
              disabled={bulkSkipMutation.isPending || bulkApproveMutation.isPending}
              data-testid="button-bulk-approve"
            >
              <ThumbsUp className="w-3.5 h-3.5 mr-1.5" />
              Approve Match ({selectedIds.size})
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/20"
              onClick={() => setShowBulkDeleteConfirm(true)}
              disabled={bulkDeleteMutation.isPending || bulkSkipMutation.isPending || bulkApproveMutation.isPending}
              data-testid="button-bulk-delete"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete ({selectedIds.size})
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              data-testid="button-clear-selection"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ShoppingBag className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            {hasFilters ? (
              <>
                <p className="text-gray-500 font-medium" data-testid="text-no-results">
                  No records match the current filters.
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  Try adjusting your search or filter options.
                </p>
              </>
            ) : (
              <>
                <p className="text-gray-500 font-medium" data-testid="text-no-records">
                  No pending outreach records yet.
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  Records appear here when the Marketplace bot creates them.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-white dark:bg-gray-900">
            <table className="w-full text-sm" data-testid="table-outreach">
              <thead>
                <tr className="border-b border-border bg-gray-50 dark:bg-gray-800/60">
                  <th className="px-3 py-2.5 w-8" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={allCurrentPageSelected}
                      data-state={someCurrentPageSelected ? "indeterminate" : allCurrentPageSelected ? "checked" : "unchecked"}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all on this page"
                      data-testid="checkbox-select-all"
                      className={someCurrentPageSelected ? "data-[state=unchecked]:bg-violet-200/60" : ""}
                    />
                  </th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs whitespace-nowrap">Seller Name</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs whitespace-nowrap">Company</th>
                  <th className="text-left px-2 py-2.5 font-medium text-muted-foreground text-xs whitespace-nowrap">City / State</th>
                  <th className="text-left px-2 py-2.5 font-medium text-muted-foreground text-xs whitespace-nowrap">Trade</th>
                  <th className="text-left px-1 py-2.5 font-medium text-muted-foreground text-xs whitespace-nowrap">Status</th>
                  <th className="text-left px-1 py-2.5 font-medium text-muted-foreground text-xs whitespace-nowrap">Reply Phone</th>
                  <th className="text-left px-2 py-2.5 font-medium text-muted-foreground text-xs whitespace-nowrap">Created</th>
                  <th className="text-left px-2 py-2.5 font-medium text-muted-foreground text-xs whitespace-nowrap">Updated</th>
                </tr>
              </thead>
              <tbody>
                {items.map((record) => {
                  const isSelected = selectedId === record.id;
                  const isChecked  = selectedIds.has(record.id);
                  const phone = getDisplayPhone(record);
                  return (
                    <tr
                      key={record.id}
                      onClick={() => handleRowClick(record)}
                      data-testid={`row-outreach-${record.id}`}
                      className={cn(
                        "border-b border-border/50 last:border-0 cursor-pointer transition-colors",
                        isSelected
                          ? "bg-violet-50 dark:bg-violet-950/20"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
                      )}
                    >
                      <td
                        className="px-3 py-2 w-8"
                        onClick={(e) => { e.stopPropagation(); toggleSelectRow(record.id); }}
                      >
                        <Checkbox
                          checked={isChecked}
                          aria-label={`Select ${record.sellerFullName}`}
                          data-testid={`checkbox-row-${record.id}`}
                          onCheckedChange={() => toggleSelectRow(record.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium whitespace-nowrap max-w-[140px] truncate">
                        {record.sellerFullName}
                      </td>
                      <td
                        className="px-3 py-2 text-muted-foreground text-xs"
                        title={record.businessName ?? undefined}
                      >
                        <div className="max-w-[180px] truncate whitespace-nowrap">
                          {record.businessName ?? "—"}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground whitespace-nowrap text-xs">
                        {[record.city, record.state].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground text-xs">
                        <div className="max-w-[100px] truncate whitespace-nowrap">
                          {record.tradeGuess ?? "—"}
                        </div>
                      </td>
                      <td className="px-1 py-2 whitespace-nowrap">
                        <StatusBadge status={record.messageStatus} />
                      </td>
                      <td className="px-1 py-2 whitespace-nowrap text-muted-foreground text-xs">
                        {phone ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {phone}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground whitespace-nowrap text-xs">
                        {formatDateShort(record.createdAt)}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground whitespace-nowrap text-xs">
                        {formatDateShort(record.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} · {total} total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  data-testid="button-next-page"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Right-side Sheet drawer ─────────────────────────────────────────── */}
      <Sheet open={!!selectedId} onOpenChange={(open) => { if (!open) closeDrawer(); }}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto"
          data-testid="drawer-outreach-detail"
        >
          {detailLoading ? (
            <div className="space-y-3 pt-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-5 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              ))}
            </div>
          ) : detailRecord ? (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="text-base leading-snug">{detailRecord.sellerFullName}</SheetTitle>
                <div className="mt-1">
                  <StatusBadge status={detailRecord.messageStatus} />
                </div>
              </SheetHeader>

              {/* ── Action buttons ── */}
              <div className="space-y-2 mb-6">
                {/* Manual review gate: Approve or Reject */}
                {canApprove(detailRecord.messageStatus) && (
                  <div className="rounded-md border border-orange-200 bg-orange-50 dark:bg-orange-950/20 p-3 space-y-2">
                    <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide">
                      Manual Review Required
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Review the reply details below, then approve or reject this match.
                    </p>
                    <div className="flex gap-2 pt-1">
                      <Button
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => approveMutation.mutate(detailRecord.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        data-testid="button-approve-match"
                      >
                        <ThumbsUp className="w-4 h-4 mr-2" />
                        {approveMutation.isPending ? "Approving…" : "Approve Match"}
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                        onClick={() => rejectMutation.mutate(detailRecord.id)}
                        disabled={rejectMutation.isPending || approveMutation.isPending}
                        data-testid="button-reject-match"
                      >
                        <ThumbsDown className="w-4 h-4 mr-2" />
                        {rejectMutation.isPending ? "Rejecting…" : "Reject Match"}
                      </Button>
                    </div>
                  </div>
                )}

                {canConvert(detailRecord.messageStatus) && (
                  <Button
                    className="w-full"
                    onClick={() => {
                      setDuplicateMatch(null);
                      setConvertedLeadId(null);
                      setShowConvertDialog(true);
                    }}
                    disabled={convertMutation.isPending || skipMutation.isPending}
                    data-testid="button-convert-to-crm"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Convert to CRM Lead
                  </Button>
                )}

                {canSkip(detailRecord.messageStatus) && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => skipMutation.mutate(detailRecord.id)}
                    disabled={skipMutation.isPending || convertMutation.isPending}
                    data-testid="button-skip"
                  >
                    <SkipForward className="w-4 h-4 mr-2" />
                    {skipMutation.isPending ? "Skipping…" : "Skip"}
                  </Button>
                )}

                {isConverted(detailRecord.messageStatus) && detailRecord.crmLeadId && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(`/admin/crm/leads/${detailRecord.crmLeadId}`)}
                    data-testid="button-view-crm-lead"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View CRM Lead
                  </Button>
                )}

                {detailRecord.messageStatus === "skipped" && (
                  <p
                    className="text-sm text-muted-foreground text-center py-2"
                    data-testid="text-no-actions"
                  >
                    No actions available for skipped records.
                  </p>
                )}

                {/* Delete — always available, requires confirmation */}
                <Button
                  variant="outline"
                  className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:border-red-800 dark:hover:bg-red-950/20"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete-record"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleteMutation.isPending ? "Deleting…" : "Delete Record"}
                </Button>

                {/* Duplicate 409: inline under action buttons */}
                {duplicateMatch && (
                  <DuplicateInlineBlock
                    match={duplicateMatch}
                    onViewLead={
                      duplicateMatch.leadId
                        ? () => navigate(`/admin/crm/leads/${duplicateMatch.leadId}`)
                        : undefined
                    }
                  />
                )}

                {/* Convert success: show CRM lead ID inline */}
                {convertedLeadId && (
                  <div
                    className="rounded-md border border-teal-200 bg-teal-50 dark:bg-teal-950/20 p-3 text-sm"
                    data-testid="block-converted-success"
                  >
                    <p className="font-semibold text-teal-700 dark:text-teal-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Converted to CRM lead
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">CRM Lead ID:</p>
                    <p
                      className="font-mono text-xs break-all text-teal-700 dark:text-teal-300 mt-0.5"
                      data-testid="text-converted-lead-id"
                    >
                      {convertedLeadId}
                    </p>
                    <button
                      className="mt-2 text-sm text-teal-600 dark:text-teal-400 hover:underline"
                      onClick={() => navigate(`/admin/crm/leads/${convertedLeadId}`)}
                      data-testid="button-view-new-crm-lead"
                    >
                      View lead →
                    </button>
                  </div>
                )}
              </div>

              {/* ── Detail fields ── */}
              <div className="space-y-0">
                <DetailField label="Listing Title">
                  {detailRecord.listingTitleRaw ?? "—"}
                </DetailField>
                <DetailField label="Seller Profile">
                  <DetailLink href={detailRecord.sellerProfileUrl} label="Open profile" />
                </DetailField>
                <DetailField label="Listing URL">
                  <DetailLink href={detailRecord.listingUrl} label="Open listing" />
                </DetailField>
                <DetailField label="CRM Lead ID">
                  {detailRecord.crmLeadId ? (
                    <button
                      className="text-blue-600 dark:text-blue-400 hover:underline font-mono text-xs break-all"
                      onClick={() => navigate(`/admin/crm/leads/${detailRecord.crmLeadId}`)}
                      data-testid="button-linked-crm-lead"
                    >
                      {detailRecord.crmLeadId}
                    </button>
                  ) : "—"}
                </DetailField>
                <DetailField label="Converted At">
                  {formatDateTime(detailRecord.convertedAt)}
                </DetailField>
                <DetailField label="Created At">
                  {formatDateTime(detailRecord.createdAt)}
                </DetailField>
                <DetailField label="Updated At">
                  {formatDateTime(detailRecord.updatedAt)}
                </DetailField>
              </div>
            </>
          ) : (
            <div
              className="flex flex-col items-center justify-center h-full min-h-[300px] text-center text-muted-foreground"
              data-testid="text-drawer-record-not-found"
            >
              <ShoppingBag className="w-8 h-8 mb-3 opacity-30" />
              <p className="text-sm">Record not found.</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Convert confirm dialog ── */}
      <Dialog
        open={showConvertDialog}
        onOpenChange={(open) => { if (!open) setShowConvertDialog(false); }}
      >
        <DialogContent className="sm:max-w-sm" data-testid="dialog-confirm-convert">
          <DialogHeader>
            <DialogTitle>Convert to CRM Lead?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will create a new CRM lead, contact, and pipeline opportunity for{" "}
            <strong>{detailRecord?.sellerFullName}</strong>.
          </p>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowConvertDialog(false)}
              disabled={convertMutation.isPending}
              data-testid="button-cancel-convert"
            >
              Cancel
            </Button>
            <Button
              onClick={() => { if (selectedId) convertMutation.mutate(selectedId); }}
              disabled={convertMutation.isPending}
              data-testid="button-confirm-convert"
            >
              {convertMutation.isPending ? "Converting…" : "Convert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete single record confirmation ───────────────────────────────── */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent data-testid="dialog-delete-confirm">
          <DialogHeader>
            <DialogTitle>Delete this record?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the record for{" "}
            <strong>{detailRecord?.sellerFullName}</strong>. This action cannot be undone.
          </p>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleteMutation.isPending}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedId) {
                  setShowDeleteConfirm(false);
                  deleteMutation.mutate(selectedId);
                }
              }}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk delete confirmation ────────────────────────────────────────── */}
      <Dialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <DialogContent data-testid="dialog-bulk-delete-confirm">
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} record{selectedIds.size !== 1 ? "s" : ""}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete {selectedIds.size} selected record{selectedIds.size !== 1 ? "s" : ""}. This action cannot be undone.
          </p>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowBulkDeleteConfirm(false)}
              disabled={bulkDeleteMutation.isPending}
              data-testid="button-cancel-bulk-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowBulkDeleteConfirm(false);
                bulkDeleteMutation.mutate([...selectedIds]);
              }}
              disabled={bulkDeleteMutation.isPending}
              data-testid="button-confirm-bulk-delete"
            >
              {bulkDeleteMutation.isPending ? "Deleting…" : `Delete ${selectedIds.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useQuery, useMutation } from "@tanstack/react-query";
import { STALE, queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ChevronLeft, ChevronRight, Globe, Phone, Mail,
  X, Trash2, UserCheck, CircleDot, Tag, Tags, AlertTriangle, Users, Upload, UserPlus, UserCircle,
} from "lucide-react";
import { CsvImportModal, CsvExportDropdown } from "./CsvImportExportModal";
import CreateLeadModal from "./CreateLeadModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@features/auth/useAuth";
import { cn } from "@/lib/utils";
import type { CrmLead, CrmLeadStatus, CrmContact, CrmCompany, CrmTag } from "@shared/schema";
import { useAdminLang } from "@/i18n/LanguageContext";

interface LeadWithRelations extends CrmLead {
  contact?: CrmContact | null;
  company?: CrmCompany | null;
  status?: CrmLeadStatus | null;
}

interface LeadsResponse {
  leads: LeadWithRelations[];
  total: number;
  page: number;
  pageSize: number;
}

interface AssignableUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

type BulkAction = "assign" | "status" | "addTag" | "removeTag" | "delete";

export default function LeadListPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useAdminLang();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const isRestricted = role === "sales_rep" || role === "lead_gen";

  const [rawSearch, setRawSearch] = useState("");
  const search = useDebounce(rawSearch, 300);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search]);
  const pageSize = 20;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialog, setBulkDialog] = useState<BulkAction | null>(null);
  const [bulkAssignTo, setBulkAssignTo] = useState<string>("");
  const [bulkStatusId, setBulkStatusId] = useState<string>("");
  const [bulkTagIds, setBulkTagIds] = useState<string[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: statuses = [] } = useQuery<CrmLeadStatus[]>({
    queryKey: ["/api/crm/statuses"],
    staleTime: STALE.SLOW,
  });

  const { data: allTags = [] } = useQuery<CrmTag[]>({
    queryKey: ["/api/crm/tags"],
    staleTime: STALE.SLOW,
  });

  const { data: assignableUsers = [] } = useQuery<AssignableUser[]>({
    queryKey: ["/api/crm/leads/assignable-users"],
    staleTime: STALE.SLOW,
  });

  const { data: leadsData, isLoading } = useQuery<LeadsResponse>({
    queryKey: ["/api/crm/leads", search, statusFilter, sourceFilter, page],
    staleTime: STALE.FAST,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter && statusFilter !== "all") params.set("statusId", statusFilter);
      if (sourceFilter && sourceFilter !== "all") params.set("source", sourceFilter);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      const res = await fetch(`/api/crm/leads?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
  });

  const leads = leadsData?.leads ?? [];
  const total = leadsData?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);
  const allOnPageSelected = leads.length > 0 && leads.every(l => selectedIds.has(l.id));
  const someOnPageSelected = leads.some(l => selectedIds.has(l.id)) && !allOnPageSelected;

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds(prev => { const n = new Set(prev); leads.forEach(l => n.delete(l.id)); return n; });
    } else {
      setSelectedIds(prev => { const n = new Set(prev); leads.forEach(l => n.add(l.id)); return n; });
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const closeBulkDialog = () => {
    setBulkDialog(null);
    setBulkAssignTo("");
    setBulkStatusId("");
    setBulkTagIds([]);
  };

  const invalidateLeads = () => queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });

  const selectedCount = selectedIds.size;
  const selectedLabel = selectedCount === 1
    ? t.crm.selectedLeads_one.replace("{{count}}", String(selectedCount))
    : t.crm.selectedLeads_other.replace("{{count}}", String(selectedCount));

  const bulkAssignMutation = useMutation({
    mutationFn: (assignedTo: string | null) =>
      apiRequest("POST", "/api/crm/leads/bulk/assign", { ids: [...selectedIds], assignedTo }),
    onSuccess: async () => {
      await invalidateLeads();
      toast({ title: selectedLabel });
      clearSelection(); closeBulkDialog();
    },
    onError: (e: any) => toast({ title: t.common.error, description: e.message, variant: "destructive" }),
  });

  const bulkStatusMutation = useMutation({
    mutationFn: (statusId: string | null) =>
      apiRequest("POST", "/api/crm/leads/bulk/status", { ids: [...selectedIds], statusId }),
    onSuccess: async () => {
      await invalidateLeads();
      toast({ title: selectedLabel });
      clearSelection(); closeBulkDialog();
    },
    onError: (e: any) => toast({ title: t.common.error, description: e.message, variant: "destructive" }),
  });

  const bulkAddTagsMutation = useMutation({
    mutationFn: (tagIds: string[]) =>
      apiRequest("POST", "/api/crm/leads/bulk/tags/add", { ids: [...selectedIds], tagIds }),
    onSuccess: async () => {
      await invalidateLeads();
      toast({ title: selectedLabel });
      clearSelection(); closeBulkDialog();
    },
    onError: (e: any) => toast({ title: t.common.error, description: e.message, variant: "destructive" }),
  });

  const bulkRemoveTagsMutation = useMutation({
    mutationFn: (tagIds: string[]) =>
      apiRequest("POST", "/api/crm/leads/bulk/tags/remove", { ids: [...selectedIds], tagIds }),
    onSuccess: async () => {
      await invalidateLeads();
      toast({ title: selectedLabel });
      clearSelection(); closeBulkDialog();
    },
    onError: (e: any) => toast({ title: t.common.error, description: e.message, variant: "destructive" }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/crm/leads/bulk/delete", { ids: [...selectedIds] }),
    onSuccess: async () => {
      await invalidateLeads();
      toast({ title: selectedLabel });
      clearSelection(); closeBulkDialog();
    },
    onError: (e: any) => toast({ title: t.common.error, description: e.message, variant: "destructive" }),
  });

  const anyBulkPending =
    bulkAssignMutation.isPending || bulkStatusMutation.isPending ||
    bulkAddTagsMutation.isPending || bulkRemoveTagsMutation.isPending ||
    bulkDeleteMutation.isPending;

  const getStatusBadge = (lead: LeadWithRelations) => {
    if (!lead.status) return null;
    return (
      <Badge
        variant="outline"
        className="text-xs"
        style={{ borderColor: lead.status.color, color: lead.status.color }}
        data-testid={`badge-status-${lead.id}`}
      >
        {(t.crm.statusNames as Record<string, string>)[lead.status.slug] || lead.status.name}
      </Badge>
    );
  };

  const getContactName = (lead: LeadWithRelations) => {
    if (!lead.contact) return t.crm.noContact;
    return [lead.contact.firstName, lead.contact.lastName].filter(Boolean).join(" ");
  };

  const getLeadDisplayTitle = (lead: LeadWithRelations) => {
    const contactName = lead.contact
      ? [lead.contact.firstName, lead.contact.lastName].filter(Boolean).join(" ")
      : null;
    const companyName = lead.company?.name;
    if (companyName && contactName) return `${companyName} – ${contactName}`;
    if (companyName) return companyName;
    if (contactName) return contactName;
    return lead.title;
  };

  const toggleTagId = (id: string) =>
    setBulkTagIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100" data-testid="text-crm-title">
            {t.crm.title}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {total} {t.common.leads.toLowerCase()}
          </p>
        </div>
        {(isAdmin || role === "sales_rep") && (
          <div className="flex items-center gap-2 flex-wrap">
            <CsvExportDropdown />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowImportModal(true)}
              data-testid="button-import-csv"
            >
              <Upload className="w-4 h-4 mr-1.5" />
              {t.crm.import}
            </Button>
            {role !== "sales_rep" && (
              <Button
                size="sm"
                onClick={() => setShowCreateModal(true)}
                data-testid="button-add-lead"
              >
                <UserPlus className="w-4 h-4 mr-1.5" />
                {t.crm.addLead}
              </Button>
            )}
          </div>
        )}
      </div>

      <CsvImportModal open={showImportModal} onClose={() => setShowImportModal(false)} />
      <CreateLeadModal open={showCreateModal} onClose={() => setShowCreateModal(false)} />

      <Card className="mb-4">
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              placeholder={t.crm.searchPlaceholder}
              className="pl-10"
              data-testid="input-search-leads"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-44" data-testid="select-status-filter">
              <SelectValue placeholder={t.crm.allStatuses} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.crm.allStatuses}</SelectItem>
              {statuses.map(s => (
                <SelectItem key={s.id} value={s.id}>{(t.crm.statusNames as Record<string, string>)[s.slug] || s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-44" data-testid="select-source-filter">
              <SelectValue placeholder="Todas las fuentes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.crm.allSources}</SelectItem>
              <SelectItem value="website_form">Website Form</SelectItem>
              <SelectItem value="referral">Referral</SelectItem>
              <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
              <SelectItem value="social_media">Social Media</SelectItem>
              <SelectItem value="paid_ads">Paid Ads</SelectItem>
              <SelectItem value="event">Event</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="mb-4 rounded-lg bg-teal-600 text-white px-4 py-2.5 flex flex-wrap items-center gap-2 shadow-md"
            data-testid="bulk-action-bar"
          >
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-sm font-semibold hover:text-teal-100 transition-colors"
              data-testid="button-toggle-select-all"
            >
              {selectedLabel}
            </button>
            <button
              onClick={clearSelection}
              className="flex items-center gap-1 text-teal-200 hover:text-white text-xs transition-colors"
              data-testid="button-clear-selection"
            >
              <X className="w-3 h-3" /> {t.common.clear}
            </button>
            <span className="text-teal-400 text-xs hidden sm:inline">
              · {allOnPageSelected ? t.common.allSelected : `${t.common.selectAll} (${leads.length})`}
            </span>
            {!allOnPageSelected && (
              <button
                onClick={toggleSelectAll}
                className="text-teal-200 hover:text-white text-xs underline transition-colors hidden sm:inline"
                data-testid="button-select-page"
              >
                {t.common.selectAll}
              </button>
            )}

            <div className="flex flex-wrap items-center gap-1.5 ml-auto">
              {!isRestricted && (
                <Button
                  size="sm"
                  className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
                  onClick={() => setBulkDialog("assign")}
                  disabled={anyBulkPending}
                  data-testid="button-bulk-assign"
                >
                  <UserCheck className="w-3 h-3 mr-1" /> {t.crm.bulkAssign}
                </Button>
              )}
              <Button
                size="sm"
                className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
                onClick={() => setBulkDialog("status")}
                disabled={anyBulkPending}
                data-testid="button-bulk-status"
              >
                <CircleDot className="w-3 h-3 mr-1" /> {t.crm.status}
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
                onClick={() => setBulkDialog("addTag")}
                disabled={anyBulkPending}
                data-testid="button-bulk-add-tag"
              >
                <Tag className="w-3 h-3 mr-1" /> {t.crm.bulkAddTags}
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
                onClick={() => setBulkDialog("removeTag")}
                disabled={anyBulkPending}
                data-testid="button-bulk-remove-tag"
              >
                <Tags className="w-3 h-3 mr-1" /> {t.crm.bulkRemoveTags}
              </Button>
              {isAdmin && (
                <Button
                  size="sm"
                  className="h-7 text-xs bg-red-500 hover:bg-red-400 text-white border-0"
                  onClick={() => setBulkDialog("delete")}
                  disabled={anyBulkPending}
                  data-testid="button-bulk-delete"
                >
                  <Trash2 className="w-3 h-3 mr-1" /> {t.crm.bulkDelete}
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500" data-testid="text-no-leads">{t.crm.noLeads}</p>
          <p className="text-gray-400 text-sm mt-1">{t.crm.searchNoResults}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 px-4 py-2">
            <Checkbox
              checked={allOnPageSelected ? true : someOnPageSelected ? "indeterminate" : false}
              onCheckedChange={toggleSelectAll}
              data-testid="checkbox-select-all"
              aria-label="Select all leads on this page"
            />
            <button
              onClick={toggleSelectAll}
              className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors select-none"
              data-testid="button-select-all-label"
            >
              {allOnPageSelected
                ? `${leads.length} selected`
                : someOnPageSelected
                ? `${selectedIds.size} selected — select all ${leads.length}`
                : `Select all ${leads.length}`}
            </button>
          </div>
          {leads.map((lead) => {
            const isSelected = selectedIds.has(lead.id);
            return (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.12 }}
              >
                <Card
                  className={cn(
                    "hover-elevate cursor-pointer transition-all duration-150",
                    isSelected && "ring-2 ring-teal-500 bg-teal-50/40 dark:bg-teal-950/20"
                  )}
                  onClick={() => navigate(`/admin/crm/leads/${lead.id}`)}
                  data-testid={`card-lead-${lead.id}`}
                >
                  <div className="flex items-start gap-3 p-4">
                    <div
                      className="flex-shrink-0 pt-0.5"
                      onClick={(e) => toggleSelect(lead.id, e)}
                      data-testid={`checkbox-lead-${lead.id}`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => {}}
                        className="pointer-events-none"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3
                              className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate"
                              data-testid={`text-lead-title-${lead.id}`}
                            >
                              {getLeadDisplayTitle(lead)}
                            </h3>
                            {getStatusBadge(lead)}
                            {lead.fromWebsiteForm && (
                              <Badge variant="secondary" className="text-xs" data-testid={`badge-web-form-${lead.id}`}>
                                <Globe className="w-3 h-3 mr-1" /> Web Form
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500 flex-wrap">
                            <span data-testid={`text-lead-contact-${lead.id}`}>
                              {getContactName(lead)}
                            </span>
                            {lead.company && (
                              <span data-testid={`text-lead-company-${lead.id}`}>
                                {lead.company.name}
                              </span>
                            )}
                            {lead.contact?.email && (
                              <span className="hidden sm:flex items-center gap-1">
                                <Mail className="w-3 h-3" /> {lead.contact.email}
                              </span>
                            )}
                            {lead.contact?.phone && (
                              <span className="hidden sm:flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {lead.contact.phone}
                              </span>
                            )}
                            {lead.assignedTo && (
                              <span className="hidden sm:flex items-center gap-1" data-testid={`text-lead-assignee-${lead.id}`}>
                                <UserCircle className="w-3 h-3" />
                                {(() => {
                                  const u = assignableUsers.find(u => u.id === lead.assignedTo);
                                  if (u) {
                                    return u.name.trim().split(" ")[0];
                                  }
                                  return isRestricted ? "You" : "—";
                                })()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {lead.value && (
                            <span
                              className="text-sm font-medium text-gray-900 dark:text-gray-100"
                              data-testid={`text-lead-value-${lead.id}`}
                            >
                              ${Number(lead.value).toLocaleString()}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 hidden sm:inline">
                            {new Date(lead.createdAt).toLocaleDateString()}
                          </span>
                          <ChevronRight className="w-4 h-4 text-gray-300" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mt-6">
          <p className="text-sm text-gray-500">{t.crm.page.replace("{{page}}", String(page)).replace("{{total}}", String(totalPages))}</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> {t.crm.prevPage}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              data-testid="button-next-page"
            >
              {t.crm.nextPage} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={bulkDialog !== null} onOpenChange={open => !open && closeBulkDialog()}>
        <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto" data-testid="bulk-action-dialog">
          {bulkDialog === "assign" && (
            <>
              <DialogHeader>
                <DialogTitle>{t.crm.bulkAssign} — {selectedLabel}</DialogTitle>
              </DialogHeader>
              <div className="py-2">
                <Select value={bulkAssignTo} onValueChange={setBulkAssignTo}>
                  <SelectTrigger data-testid="select-bulk-assign-user">
                    <SelectValue placeholder={t.crm.selectUser} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unassign__">{t.crm.unassigned}</SelectItem>
                    {assignableUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                        <span className="ml-1 text-xs text-gray-400 capitalize">({u.role})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeBulkDialog}>{t.common.cancel}</Button>
                <Button
                  onClick={() => bulkAssignMutation.mutate(bulkAssignTo === "__unassign__" ? null : bulkAssignTo || null)}
                  disabled={!bulkAssignTo || bulkAssignMutation.isPending}
                  data-testid="button-confirm-bulk-assign"
                >
                  {bulkAssignMutation.isPending ? t.crm.applying : t.common.apply}
                </Button>
              </DialogFooter>
            </>
          )}

          {bulkDialog === "status" && (
            <>
              <DialogHeader>
                <DialogTitle>{t.crm.bulkStatus} — {selectedLabel}</DialogTitle>
              </DialogHeader>
              <div className="py-2">
                <Select value={bulkStatusId} onValueChange={setBulkStatusId}>
                  <SelectTrigger data-testid="select-bulk-status">
                    <SelectValue placeholder={t.crm.selectStatus} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__clear__">{t.crm.allStatuses}</SelectItem>
                    {statuses.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full inline-block"
                            style={{ backgroundColor: s.color }}
                          />
                          {(t.crm.statusNames as Record<string, string>)[s.slug] || s.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeBulkDialog}>{t.common.cancel}</Button>
                <Button
                  onClick={() => bulkStatusMutation.mutate(bulkStatusId === "__clear__" ? null : bulkStatusId || null)}
                  disabled={!bulkStatusId || bulkStatusMutation.isPending}
                  data-testid="button-confirm-bulk-status"
                >
                  {bulkStatusMutation.isPending ? t.crm.applying : t.common.apply}
                </Button>
              </DialogFooter>
            </>
          )}

          {(bulkDialog === "addTag" || bulkDialog === "removeTag") && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {bulkDialog === "addTag" ? t.crm.bulkAddTags : t.crm.bulkRemoveTags} — {selectedLabel}
                </DialogTitle>
              </DialogHeader>
              <div className="py-2 max-h-60 overflow-y-auto space-y-1">
                {allTags.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">{t.common.noResults}</p>
                ) : allTags.map(tag => (
                  <label
                    key={tag.id}
                    className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                    data-testid={`label-tag-${tag.id}`}
                  >
                    <Checkbox
                      checked={bulkTagIds.includes(tag.id)}
                      onCheckedChange={() => toggleTagId(tag.id)}
                      data-testid={`checkbox-tag-${tag.id}`}
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color ?? "#6B7280" }}
                    />
                    <span className="text-sm">{tag.name}</span>
                  </label>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeBulkDialog}>{t.common.cancel}</Button>
                <Button
                  onClick={() =>
                    bulkDialog === "addTag"
                      ? bulkAddTagsMutation.mutate(bulkTagIds)
                      : bulkRemoveTagsMutation.mutate(bulkTagIds)
                  }
                  disabled={bulkTagIds.length === 0 || bulkAddTagsMutation.isPending || bulkRemoveTagsMutation.isPending}
                  data-testid="button-confirm-bulk-tags"
                >
                  {(bulkAddTagsMutation.isPending || bulkRemoveTagsMutation.isPending)
                    ? t.crm.applying
                    : t.crm.applyWithCount.replace("{{count}}", String(bulkTagIds.length > 0 ? bulkTagIds.length : ""))}
                </Button>
              </DialogFooter>
            </>
          )}

          {bulkDialog === "delete" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-5 h-5" />
                  {t.crm.confirmDelete.replace("{{label}}", selectedLabel)}
                </DialogTitle>
              </DialogHeader>
              <div className="py-2 text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p>{t.crm.deleteWarning.replace("{{label}}", selectedLabel)}</p>
                <p className="text-red-600 font-medium">{t.crm.deleteIrreversible}</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeBulkDialog}>{t.common.cancel}</Button>
                <Button
                  variant="destructive"
                  onClick={() => bulkDeleteMutation.mutate()}
                  disabled={bulkDeleteMutation.isPending}
                  data-testid="button-confirm-bulk-delete"
                >
                  {bulkDeleteMutation.isPending ? t.crm.deleting : `${t.crm.bulkDelete} ${selectedLabel}`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

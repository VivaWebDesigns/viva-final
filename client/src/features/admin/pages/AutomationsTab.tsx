import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, STALE } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminLang } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus,
  Edit2,
  Trash2,
  Zap,
  GripVertical,
  ChevronRight,
  ListChecks,
  History,
  CheckCircle2,
  XCircle,
  SkipForward,
  ExternalLink,
} from "lucide-react";
import type {
  StageAutomationTemplate,
  AutomationTriggerStage,
} from "@shared/schema";
import { AUTOMATION_TRIGGER_STAGES, AUTOMATION_PRIORITIES } from "@shared/schema";

const STAGE_SLUGS = AUTOMATION_TRIGGER_STAGES as readonly AutomationTriggerStage[];

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600 border-gray-200",
  medium: "bg-blue-50 text-blue-700 border-blue-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  urgent: "bg-red-50 text-red-700 border-red-200",
};

interface TemplateForm {
  title: string;
  description: string;
  dueOffsetDays: number;
  priority: string;
  taskType: string;
  isActive: boolean;
}

const EMPTY_FORM: TemplateForm = {
  title: "",
  description: "",
  dueOffsetDays: 0,
  priority: "medium",
  taskType: "follow_up",
  isActive: true,
};

interface StageCounts {
  [stage: string]: { total: number; active: number };
}

interface ExecutionLogEntry {
  id: string;
  opportunityId: string | null;
  leadId: string | null;
  triggerStageSlug: string;
  templateId: string | null;
  generatedTaskId: string | null;
  status: string;
  details: string | null;
  createdAt: string;
  templateTitle: string | null;
  opportunityTitle: string | null;
  generatedTaskTitle: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  skipped: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

export default function AutomationsTab() {
  const { t } = useAdminLang();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>("templates");
  const [selectedStage, setSelectedStage] = useState<AutomationTriggerStage>("new-lead");
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<StageAutomationTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<StageAutomationTemplate | null>(null);

  const [logStageFilter, setLogStageFilter] = useState<string>("all");
  const [logStatusFilter, setLogStatusFilter] = useState<string>("all");

  const stageNames = t.pipeline.stageNames as Record<string, string>;
  const auto = t.automations;

  const { data: stageCounts } = useQuery<StageCounts>({
    queryKey: ["/api/automations/stats/stage-counts"],
    staleTime: STALE.FAST,
  });

  const { data: templates = [], isLoading } = useQuery<StageAutomationTemplate[]>({
    queryKey: ["/api/automations/templates/stage", selectedStage],
    queryFn: async () => {
      const res = await fetch(`/api/automations/templates/stage/${selectedStage}`);
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json();
    },
    staleTime: STALE.FAST,
  });

  const logParams = new URLSearchParams();
  logParams.set("limit", "100");
  if (logStageFilter !== "all") logParams.set("stageSlug", logStageFilter);
  if (logStatusFilter !== "all") logParams.set("status", logStatusFilter);

  const { data: executionLogs = [], isLoading: logsLoading } = useQuery<ExecutionLogEntry[]>({
    queryKey: ["/api/automations/execution-logs", logStageFilter, logStatusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/automations/execution-logs?${logParams.toString()}`);
      if (!res.ok) throw new Error("Failed to load logs");
      return res.json();
    },
    staleTime: STALE.FAST,
    enabled: activeTab === "logs",
  });

  const createMutation = useMutation({
    mutationFn: async (data: TemplateForm & { triggerStageSlug: string }) => {
      const res = await apiRequest("POST", "/api/automations/templates", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/automations/templates/stage", selectedStage] });
      qc.invalidateQueries({ queryKey: ["/api/automations/stats/stage-counts"] });
      closeForm();
      toast({ title: auto.templateCreated });
    },
    onError: (err: Error) =>
      toast({ title: t.common.error, description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TemplateForm> }) => {
      const res = await apiRequest("PUT", `/api/automations/templates/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/automations/templates/stage", selectedStage] });
      qc.invalidateQueries({ queryKey: ["/api/automations/stats/stage-counts"] });
      closeForm();
      toast({ title: auto.templateUpdated });
    },
    onError: (err: Error) =>
      toast({ title: t.common.error, description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/automations/templates/${id}`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/automations/templates/stage", selectedStage] });
      qc.invalidateQueries({ queryKey: ["/api/automations/stats/stage-counts"] });
      setDeleteTarget(null);
      toast({ title: auto.templateDeleted });
    },
    onError: (err: Error) =>
      toast({ title: t.common.error, description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PUT", `/api/automations/templates/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/automations/templates/stage", selectedStage] });
      qc.invalidateQueries({ queryKey: ["/api/automations/stats/stage-counts"] });
    },
    onError: (err: Error) =>
      toast({ title: t.common.error, description: err.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditingTemplate(null);
    setFormData(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(tpl: StageAutomationTemplate) {
    setEditingTemplate(tpl);
    setFormData({
      title: tpl.title,
      description: tpl.description ?? "",
      dueOffsetDays: tpl.dueOffsetDays,
      priority: tpl.priority,
      taskType: tpl.taskType,
      isActive: tpl.isActive,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingTemplate(null);
    setFormData(EMPTY_FORM);
  }

  function handleSubmit() {
    if (!formData.title.trim()) return;
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: formData });
    } else {
      createMutation.mutate({ ...formData, triggerStageSlug: selectedStage });
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const priorityLabels = auto.priorities as Record<string, string>;

  const statusLabel = (s: string) => {
    if (s === "success") return auto.statusSuccess;
    if (s === "skipped") return auto.statusSkipped;
    if (s === "failed") return auto.statusFailed;
    return s;
  };

  const statusIcon = (s: string) => {
    if (s === "success") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
    if (s === "skipped") return <SkipForward className="w-3.5 h-3.5 text-amber-600" />;
    return <XCircle className="w-3.5 h-3.5 text-red-600" />;
  };

  return (
    <div className="flex-1 overflow-y-auto" data-testid="tab-automations-content">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-5 h-5 text-[#0D9488]" />
          <h2 className="text-lg font-semibold text-gray-900">{auto.title}</h2>
        </div>
        <p className="text-sm text-gray-500">{auto.subtitle}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="templates" className="gap-1.5" data-testid="tab-templates">
            <ListChecks className="w-4 h-4" />
            {auto.templatesTab}
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5" data-testid="tab-execution-logs">
            <History className="w-4 h-4" />
            {auto.executionLogsTab}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <div className="flex gap-6">
            <div className="w-56 flex-shrink-0">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                {auto.triggerStages}
              </p>
              <div className="space-y-1">
                {STAGE_SLUGS.map((slug) => {
                  const sc = stageCounts?.[slug];
                  return (
                    <button
                      key={slug}
                      onClick={() => setSelectedStage(slug)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedStage === slug
                          ? "bg-[#0D9488]/10 text-[#0D9488]"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                      data-testid={`stage-selector-${slug}`}
                    >
                      <span className="flex items-center gap-2">
                        <ChevronRight
                          className={`w-3.5 h-3.5 transition-transform ${
                            selectedStage === slug ? "rotate-90" : ""
                          }`}
                        />
                        {stageNames[slug] || slug}
                      </span>
                      {sc && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-full bg-[#0D9488]/15 text-[#0D9488]"
                          title={auto.stageCountActive.replace("{active}", String(sc.active)) + " / " + auto.stageCountTotal.replace("{total}", String(sc.total))}
                        >
                          {sc.active}/{sc.total}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">
                  {stageNames[selectedStage] || selectedStage}
                </h3>
                <Button
                  onClick={openCreate}
                  size="sm"
                  className="bg-[#0D9488] hover:bg-[#0F766E] text-white"
                  data-testid="button-add-template"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {auto.addTemplate}
                </Button>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                  <ListChecks className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm text-gray-500 mb-1">{auto.emptyTitle}</p>
                  <p className="text-xs text-gray-400 mb-4">{auto.emptySubtitle}</p>
                  <Button
                    onClick={openCreate}
                    size="sm"
                    variant="outline"
                    className="border-[#0D9488] text-[#0D9488] hover:bg-[#0D9488]/5"
                    data-testid="button-add-template-empty"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {auto.addFirstTemplate}
                  </Button>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className={`flex items-center gap-3 px-4 py-3 group hover:bg-gray-50/50 transition-colors ${
                        !tpl.isActive ? "opacity-60" : ""
                      }`}
                      data-testid={`template-row-${tpl.id}`}
                    >
                      <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {tpl.title}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[tpl.priority] || ""}`}
                          >
                            {priorityLabels[tpl.priority] || tpl.priority}
                          </Badge>
                        </div>
                        {tpl.description && (
                          <p className="text-xs text-gray-400 truncate">{tpl.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {auto.dueIn}{" "}
                          {tpl.dueOffsetDays === 0
                            ? auto.sameDay
                            : tpl.dueOffsetDays === 1
                            ? `1 ${auto.day}`
                            : `${tpl.dueOffsetDays} ${auto.days}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Switch
                          checked={tpl.isActive}
                          onCheckedChange={(v) =>
                            toggleMutation.mutate({ id: tpl.id, isActive: v })
                          }
                          data-testid={`toggle-active-${tpl.id}`}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(tpl)}
                          className="text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                          data-testid={`button-edit-template-${tpl.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(tpl)}
                          className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          data-testid={`button-delete-template-${tpl.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <p className="text-sm text-gray-500 mb-4">{auto.executionLogsDesc}</p>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Select value={logStageFilter} onValueChange={setLogStageFilter}>
              <SelectTrigger className="w-48" data-testid="filter-log-stage">
                <SelectValue placeholder={auto.filterStage} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{auto.filterAll}</SelectItem>
                {STAGE_SLUGS.map((slug) => (
                  <SelectItem key={slug} value={slug}>
                    {stageNames[slug] || slug}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={logStatusFilter} onValueChange={setLogStatusFilter}>
              <SelectTrigger className="w-40" data-testid="filter-log-status">
                <SelectValue placeholder={auto.filterStatus} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{auto.filterAll}</SelectItem>
                <SelectItem value="success">{auto.statusSuccess}</SelectItem>
                <SelectItem value="skipped">{auto.statusSkipped}</SelectItem>
                <SelectItem value="failed">{auto.statusFailed}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {logsLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : executionLogs.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <History className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500 mb-1">{auto.logNoResults}</p>
              <p className="text-xs text-gray-400">{auto.logNoResultsDesc}</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-execution-logs">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-2.5">{auto.logStatus}</th>
                      <th className="px-4 py-2.5">{auto.logStage}</th>
                      <th className="px-4 py-2.5">{auto.logTemplate}</th>
                      <th className="px-4 py-2.5">{auto.logOpportunity}</th>
                      <th className="px-4 py-2.5">{auto.logTask}</th>
                      <th className="px-4 py-2.5">{auto.logTime}</th>
                      <th className="px-4 py-2.5">{auto.logDetails}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {executionLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-gray-50/50 transition-colors"
                        data-testid={`log-row-${log.id}`}
                      >
                        <td className="px-4 py-2.5">
                          <Badge
                            variant="outline"
                            className={`text-xs py-0 px-1.5 gap-1 ${STATUS_STYLES[log.status] || ""}`}
                            data-testid={`badge-status-${log.id}`}
                          >
                            {statusIcon(log.status)}
                            {statusLabel(log.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs text-gray-600">
                            {stageNames[log.triggerStageSlug] || log.triggerStageSlug}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs text-gray-700 font-medium">
                            {log.templateTitle || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          {log.opportunityId ? (
                            <a
                              href={`/admin/pipeline/opportunities/${log.opportunityId}`}
                              className="flex items-center gap-1 text-xs text-[#0D9488] hover:underline"
                              data-testid={`link-opportunity-${log.id}`}
                            >
                              {log.opportunityTitle || log.opportunityId.slice(0, 8)}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {log.generatedTaskId ? (
                            <span className="text-xs text-gray-600" title={log.generatedTaskId}>
                              {log.generatedTaskTitle || log.generatedTaskId.slice(0, 8)}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="text-xs text-gray-400">
                            {new Date(log.createdAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 max-w-[200px]">
                          {log.details ? (
                            <span
                              className="text-xs text-gray-400 truncate block"
                              title={log.details}
                            >
                              {log.details}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showForm} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? auto.editTemplate : auto.newTemplate}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? auto.editTemplateDesc
                : auto.newTemplateDesc.replace("{{stage}}", stageNames[selectedStage] || selectedStage)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{auto.taskTitle}</Label>
              <Input
                value={formData.title}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, title: e.target.value }))
                }
                placeholder={auto.taskTitlePlaceholder}
                data-testid="input-template-title"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{auto.description}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, description: e.target.value }))
                }
                placeholder={auto.descriptionPlaceholder}
                rows={3}
                data-testid="input-template-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{auto.dueOffset}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={formData.dueOffsetDays}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        dueOffsetDays: Math.max(0, parseInt(e.target.value) || 0),
                      }))
                    }
                    className="w-20"
                    data-testid="input-template-due-offset"
                  />
                  <span className="text-sm text-gray-500">{auto.daysAfterEntry}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{auto.priority}</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(v) =>
                    setFormData((p) => ({ ...p, priority: v }))
                  }
                >
                  <SelectTrigger data-testid="select-template-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTOMATION_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {priorityLabels[p] || p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900">{auto.activeStatus}</p>
                <p className="text-xs text-gray-500">
                  {formData.isActive ? auto.activeDesc : auto.inactiveDesc}
                </p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(v) =>
                  setFormData((p) => ({ ...p, isActive: v }))
                }
                data-testid="toggle-template-active"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>
              {t.settings.cancel}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving || !formData.title.trim()}
              className="bg-[#0D9488] hover:bg-[#0F766E] text-white"
              data-testid="button-save-template"
            >
              {isSaving
                ? auto.saving
                : editingTemplate
                ? t.settings.saveChanges
                : auto.createTemplate}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{auto.deleteConfirmTitle}</DialogTitle>
            <DialogDescription>
              {auto.deleteConfirmDesc.replace("{{title}}", deleteTarget?.title ?? "")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t.settings.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? auto.deleting : auto.deleteTemplate}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
  AlertCircle,
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

export default function AutomationsTab() {
  const { t } = useAdminLang();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedStage, setSelectedStage] = useState<AutomationTriggerStage>("new-lead");
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<StageAutomationTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<StageAutomationTemplate | null>(null);

  const stageNames = t.pipeline.stageNames as Record<string, string>;
  const auto = t.automations;

  const { data: templates = [], isLoading } = useQuery<StageAutomationTemplate[]>({
    queryKey: ["/api/automations/templates/stage", selectedStage],
    queryFn: async () => {
      const res = await fetch(`/api/automations/templates/stage/${selectedStage}`);
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json();
    },
    staleTime: STALE.FAST,
  });

  const createMutation = useMutation({
    mutationFn: async (data: TemplateForm & { triggerStageSlug: string }) => {
      const res = await apiRequest("POST", "/api/automations/templates", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/automations/templates/stage", selectedStage] });
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

  return (
    <div className="flex-1 overflow-y-auto" data-testid="tab-automations-content">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-5 h-5 text-[#0D9488]" />
          <h2 className="text-lg font-semibold text-gray-900">{auto.title}</h2>
        </div>
        <p className="text-sm text-gray-500">{auto.subtitle}</p>
      </div>

      <div className="flex gap-6">
        <div className="w-56 flex-shrink-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {auto.triggerStages}
          </p>
          <div className="space-y-1">
            {STAGE_SLUGS.map((slug) => {
              const count = slug === selectedStage ? templates.length : undefined;
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
                  {count !== undefined && (
                    <span className="text-xs bg-[#0D9488]/15 text-[#0D9488] px-1.5 py-0.5 rounded-full">
                      {count}
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
              {templates.map((tpl, idx) => (
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

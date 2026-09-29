import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { resolveRepTimezone } from "@/lib/timezone";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RichTextEditorField from "@/features/chat/RichTextEditorField";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, CheckCircle, Clock } from "lucide-react";
import { useAdminLang } from "@/i18n/LanguageContext";
import { TASK_PRESET_VALUES, TIME_SLOTS, formatTimeSlot, todayLocalString, calcDueDateString, type TaskPreset } from "@/components/taskScheduling";
import { useOpenSessionKey } from "@/hooks/use-open-session-key";

function toInputDate(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm   = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd   = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

interface QuickTaskModalProps {
  open: boolean;
  onClose: () => void;
  opportunityId?: string | null;
  leadId?: string | null;
  contactId?: string | null;
  defaultTitle?: string;
  leadTimezone?: string | null;
  editTask?: {
    id: string;
    title: string;
    notes?: string | null;
    dueDate: string;
    followUpTime?: string | null;
    followUpTimezone?: string | null;
  } | null;
  onSuccess?: () => void;
}

function QuickTaskModalContent({
  open,
  onClose,
  opportunityId,
  leadId,
  contactId,
  defaultTitle = "",
  leadTimezone,
  editTask,
  onSuccess,
}: QuickTaskModalProps) {
  const { toast } = useToast();
  const { t } = useAdminLang();
  const isEdit = !!editTask;

  const browserTimezone = resolveRepTimezone();
  const effectiveTimezone = leadTimezone ?? browserTimezone;

  const [title, setTitle] = useState(() => editTask?.title ?? defaultTitle);
  const [notes, setNotes] = useState(() => editTask?.notes ?? "");
  const [preset, setPreset] = useState<TaskPreset>(editTask ? "custom" : "1w");
  const [dateStr, setDateStr] = useState(() => editTask ? toInputDate(new Date(editTask.dueDate)) : calcDueDateString("1w"));
  const [followUpTime, setFollowUpTime] = useState(() => editTask?.followUpTime ?? "09:00");

  const handlePresetChange = (val: string) => {
    const p = val as TaskPreset;
    setPreset(p);
    if (p !== "custom") {
      setDateStr(calcDueDateString(p as Exclude<TaskPreset, "custom">));
    }
  };

  const invalidateTaskQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/due-today"] });
    if (opportunityId) queryClient.invalidateQueries({ queryKey: ["/api/tasks/for-opportunity", opportunityId] });
    if (leadId) queryClient.invalidateQueries({ queryKey: ["/api/tasks/for-lead", leadId] });
    if (contactId) queryClient.invalidateQueries({ queryKey: ["/api/tasks/for-contact", contactId] });
  };

  const buildPayload = () => ({
    title: title.trim(),
    notes: notes.trim() || null,
    dueDate: dateStr,
    followUpTime,
    followUpTimezone: effectiveTimezone,
    opportunityId: opportunityId ?? null,
    leadId: leadId ?? null,
    contactId: contactId ?? null,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/tasks", buildPayload());
      return res.json();
    },
    onSuccess: () => {
      invalidateTaskQueries();
      toast({ title: t.tasks.taskCreated, description: `"${title.trim()}" scheduled.` });
      onSuccess?.();
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: t.common.error, description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { opportunityId: _o, leadId: _l, contactId: _c, ...updateFields } = buildPayload();
      const res = await apiRequest("PUT", `/api/tasks/${editTask!.id}`, updateFields);
      return res.json();
    },
    onSuccess: () => {
      invalidateTaskQueries();
      toast({ title: t.tasks.taskUpdated });
      onSuccess?.();
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: t.common.error, description: err.message, variant: "destructive" });
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (isEdit) updateMutation.mutate();
    else createMutation.mutate();
  };

  const [dPreviewY, dPreviewM, dPreviewD] = dateStr.split("-").map(Number);
  const previewDate = new Date(dPreviewY, dPreviewM - 1, dPreviewD, 12, 0, 0);
  const dueDatePreview = previewDate.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto" data-testid="modal-quick-task">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-[#0D9488]" />
            {isEdit ? t.tasks.reschedule : t.tasks.scheduleFollowUp}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">{t.tasks.taskTitle}</Label>
            <Input
              id="task-title"
              data-testid="input-task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.tasks.taskTitlePlaceholder}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-preset">{t.tasks.dueDate}</Label>
            <Select value={preset} onValueChange={handlePresetChange}>
              <SelectTrigger id="task-preset" data-testid="select-task-preset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_PRESET_VALUES.map((v) => (
                  <SelectItem key={v} value={v} data-testid={`option-preset-${v}`}>
                    {(t.tasks.presets as Record<string, string>)[v] ?? v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {preset === "custom" && (
            <div className="space-y-1.5">
              <Label htmlFor="task-custom-date">{t.tasks.dueDate}</Label>
              <Input
                id="task-custom-date"
                type="date"
                data-testid="input-task-custom-date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                min={todayLocalString()}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="task-time">{t.tasks.followUpTime} <span className="text-red-500">*</span></Label>
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {effectiveTimezone}
              </span>
            </div>
            <Select value={followUpTime} onValueChange={setFollowUpTime}>
              <SelectTrigger id="task-time" data-testid="select-task-time">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((slot) => (
                  <SelectItem key={slot} value={slot} data-testid={`option-time-${slot}`}>
                    {formatTimeSlot(slot)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-2">
            <CalendarIcon className="w-3.5 h-3.5 flex-shrink-0" />
            <span data-testid="text-due-date-preview">
              {t.tasks.dueDate}: <strong>{dueDatePreview} {t.tasks.at} {formatTimeSlot(followUpTime)}</strong>
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-notes">{t.tasks.notesOptional}</Label>
            <RichTextEditorField
              value={notes}
              onChange={(html) => setNotes(html)}
              placeholder={t.tasks.notesPlaceholder}
              minHeight="60px"
              data-testid="input-task-notes"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isPending}
              data-testid="button-task-cancel"
            >
              {t.tasks.cancel}
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-[#0D9488] hover:bg-[#0B8276] text-white"
              disabled={isPending || !title.trim()}
              data-testid="button-task-save"
            >
              {isPending ? t.tasks.saving : isEdit ? t.tasks.updateTask : t.tasks.addTask}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function QuickTaskModal(props: QuickTaskModalProps) {
  const sessionKey = useOpenSessionKey(props.open);
  return <QuickTaskModalContent key={`${sessionKey}-${props.editTask?.id ?? "new"}`} {...props} />;
}

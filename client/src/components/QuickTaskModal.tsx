import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
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

export const TASK_PRESET_VALUES = ["1d", "2d", "5d", "1w", "2w", "1mo", "2mo", "6mo", "1yr", "custom"] as const;
export type TaskPreset = typeof TASK_PRESET_VALUES[number];

export const TIME_SLOTS: string[] = (() => {
  const slots: string[] = [];
  for (let h = 9; h <= 18; h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === 18 && m > 0) break;
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
})();

export function formatTimeSlot(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${mStr} ${suffix}`;
}

function calcAbsoluteUtcMs(dateStr: string, time24: string, timezone: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [h, m] = time24.split(":").map(Number);
  const naive = Date.UTC(year, month - 1, day, h, m, 0);
  const probe = new Date(naive);
  const localH = parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", hour12: false }).format(probe),
    10,
  );
  const localM = parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, minute: "2-digit", hour12: false }).format(probe),
    10,
  );
  const offsetMinutes = h * 60 + m - ((localH === 24 ? 0 : localH) * 60 + localM);
  return naive - offsetMinutes * 60_000;
}

function fmtTime(absDate: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(absDate);
}

function fmtTZAbbr(absDate: Date, tz: string): string {
  return (
    new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(absDate)
      .find((p) => p.type === "timeZoneName")?.value ?? ""
  );
}

export function formatTaskTimeDisplay(
  dueDate: Date | string,
  followUpTime: string,
  followUpTimezone: string | null | undefined,
): string {
  if (!followUpTimezone) return formatTimeSlot(followUpTime);
  const browserTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (followUpTimezone === browserTZ) return formatTimeSlot(followUpTime);
  const d = new Date(dueDate);
  const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  const absDate = new Date(calcAbsoluteUtcMs(dateStr, followUpTime, followUpTimezone));
  const leadTime = fmtTime(absDate, followUpTimezone);
  const leadAbbr = fmtTZAbbr(absDate, followUpTimezone);
  const repTime = fmtTime(absDate, browserTZ);
  return `${leadTime} ${leadAbbr} · ${repTime} your time`;
}

function todayLocalString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function calcDueDateString(preset: Exclude<TaskPreset, "custom">): string {
  const d = new Date();
  switch (preset) {
    case "1d":  d.setDate(d.getDate() + 1); break;
    case "2d":  d.setDate(d.getDate() + 2); break;
    case "5d":  d.setDate(d.getDate() + 5); break;
    case "1w":  d.setDate(d.getDate() + 7); break;
    case "2w":  d.setDate(d.getDate() + 14); break;
    case "1mo": d.setMonth(d.getMonth() + 1); break;
    case "2mo": d.setMonth(d.getMonth() + 2); break;
    case "6mo": d.setMonth(d.getMonth() + 6); break;
    case "1yr": d.setFullYear(d.getFullYear() + 1); break;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

export default function QuickTaskModal({
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

  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const effectiveTimezone = leadTimezone ?? browserTimezone;

  const [title, setTitle] = useState(defaultTitle);
  const [notes, setNotes] = useState("");
  const [preset, setPreset] = useState<TaskPreset>("1w");
  const [dateStr, setDateStr] = useState(calcDueDateString("1w"));
  const [followUpTime, setFollowUpTime] = useState("09:00");

  useEffect(() => {
    if (open) {
      if (editTask) {
        setTitle(editTask.title);
        setNotes(editTask.notes ?? "");
        setPreset("custom");
        setDateStr(toInputDate(new Date(editTask.dueDate)));
        setFollowUpTime(editTask.followUpTime ?? "09:00");
      } else {
        setTitle(defaultTitle);
        setNotes("");
        setPreset("1w");
        setDateStr(calcDueDateString("1w"));
        setFollowUpTime("09:00");
      }
    }
  }, [open, editTask, defaultTitle]);

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
              <Label htmlFor="task-time">Follow-Up Time <span className="text-red-500">*</span></Label>
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
              {t.tasks.dueDate}: <strong>{dueDatePreview} at {formatTimeSlot(followUpTime)}</strong>
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

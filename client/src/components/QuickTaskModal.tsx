import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { CalendarIcon, CheckCircle } from "lucide-react";

export const TASK_PRESETS = [
  { value: "1d",   label: "Tomorrow (1 day)"    },
  { value: "2d",   label: "In 2 days"           },
  { value: "5d",   label: "In 5 days"           },
  { value: "1w",   label: "In 1 week"           },
  { value: "2w",   label: "In 2 weeks"          },
  { value: "1mo",  label: "In 1 month"          },
  { value: "2mo",  label: "In 2 months"         },
  { value: "6mo",  label: "In 6 months"         },
  { value: "1yr",  label: "In 1 year"           },
  { value: "custom", label: "Custom date..."    },
] as const;

export type TaskPreset = typeof TASK_PRESETS[number]["value"];

function calcDueDate(preset: TaskPreset): Date {
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
    default: break;
  }
  d.setHours(9, 0, 0, 0);
  return d;
}

function toInputDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface QuickTaskModalProps {
  open: boolean;
  onClose: () => void;
  opportunityId?: string | null;
  leadId?: string | null;
  contactId?: string | null;
  defaultTitle?: string;
  editTask?: { id: string; title: string; notes?: string | null; dueDate: string } | null;
  onSuccess?: () => void;
}

export default function QuickTaskModal({
  open,
  onClose,
  opportunityId,
  leadId,
  contactId,
  defaultTitle = "",
  editTask,
  onSuccess,
}: QuickTaskModalProps) {
  const { toast } = useToast();
  const isEdit = !!editTask;

  const [title, setTitle] = useState(defaultTitle);
  const [notes, setNotes] = useState("");
  const [preset, setPreset] = useState<TaskPreset>("1w");
  const [customDate, setCustomDate] = useState(toInputDate(calcDueDate("1w")));

  useEffect(() => {
    if (open) {
      if (editTask) {
        setTitle(editTask.title);
        setNotes(editTask.notes ?? "");
        setPreset("custom");
        setCustomDate(toInputDate(new Date(editTask.dueDate)));
      } else {
        setTitle(defaultTitle);
        setNotes("");
        setPreset("1w");
        setCustomDate(toInputDate(calcDueDate("1w")));
      }
    }
  }, [open, editTask, defaultTitle]);

  const handlePresetChange = (val: string) => {
    const p = val as TaskPreset;
    setPreset(p);
    if (p !== "custom") {
      setCustomDate(toInputDate(calcDueDate(p)));
    }
  };

  const getDueDate = (): string => {
    if (preset === "custom") return new Date(customDate).toISOString();
    return calcDueDate(preset).toISOString();
  };

  const invalidateTaskQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/due-today"] });
    if (opportunityId) queryClient.invalidateQueries({ queryKey: ["/api/tasks/for-opportunity", opportunityId] });
    if (leadId) queryClient.invalidateQueries({ queryKey: ["/api/tasks/for-lead", leadId] });
    if (contactId) queryClient.invalidateQueries({ queryKey: ["/api/tasks/for-contact", contactId] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/tasks", {
        title: title.trim(),
        notes: notes.trim() || null,
        dueDate: getDueDate(),
        opportunityId: opportunityId ?? null,
        leadId: leadId ?? null,
        contactId: contactId ?? null,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateTaskQueries();
      toast({ title: "Task created", description: `"${title.trim()}" scheduled.` });
      onSuccess?.();
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/tasks/${editTask!.id}`, {
        title: title.trim(),
        notes: notes.trim() || null,
        dueDate: getDueDate(),
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateTaskQueries();
      toast({ title: "Task updated" });
      onSuccess?.();
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (isEdit) updateMutation.mutate();
    else createMutation.mutate();
  };

  const dueDatePreview = preset === "custom"
    ? new Date(customDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    : calcDueDate(preset).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md" data-testid="modal-quick-task">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-[#0D9488]" />
            {isEdit ? "Reschedule Task" : "Add Follow-up Task"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Task / Action</Label>
            <Input
              id="task-title"
              data-testid="input-task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Call back to follow up on demo"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-preset">Follow up in</Label>
            <Select value={preset} onValueChange={handlePresetChange}>
              <SelectTrigger id="task-preset" data-testid="select-task-preset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value} data-testid={`option-preset-${p.value}`}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {preset === "custom" && (
            <div className="space-y-1.5">
              <Label htmlFor="task-custom-date">Due date</Label>
              <Input
                id="task-custom-date"
                type="date"
                data-testid="input-task-custom-date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={toInputDate(new Date())}
              />
            </div>
          )}

          <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-2">
            <CalendarIcon className="w-3.5 h-3.5 flex-shrink-0" />
            <span data-testid="text-due-date-preview">Due: <strong>{dueDatePreview}</strong></span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-notes">Notes (optional)</Label>
            <Textarea
              id="task-notes"
              data-testid="input-task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details..."
              rows={2}
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
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-[#0D9488] hover:bg-[#0B8276] text-white"
              disabled={isPending || !title.trim()}
              data-testid="button-task-save"
            >
              {isPending ? "Saving..." : isEdit ? "Update Task" : "Add Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

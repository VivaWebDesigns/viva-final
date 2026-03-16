import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminLang } from "@/i18n/LanguageContext";
import { resolveRepTimezone } from "@/lib/timezone";
import {
  TIME_SLOTS,
  formatTimeSlot,
  calcDueDateString,
  todayLocalString,
} from "@/components/QuickTaskModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const OUTCOME_KEYS = [
  "noAnswer",
  "leftVoicemail",
  "spokeWithLead",
  "interested",
  "notInterested",
  "badNumber",
  "appointmentSet",
  "other",
] as const;

type FollowUpOption = "none" | "1d" | "3d" | "1w" | "custom";

interface CompleteTaskModalProps {
  open: boolean;
  onClose: () => void;
  task: {
    id: string;
    title: string;
    leadId?: string | null;
    opportunityId?: string | null;
    contactId?: string | null;
  } | null;
  leadTimezone?: string | null;
}

export default function CompleteTaskModal({
  open,
  onClose,
  task,
  leadTimezone,
}: CompleteTaskModalProps) {
  const { toast } = useToast();
  const { t } = useAdminLang();

  const [outcome, setOutcome] = useState("");
  const [completionNote, setCompletionNote] = useState("");
  const [followUp, setFollowUp] = useState<FollowUpOption>("none");
  const [customDate, setCustomDate] = useState(todayLocalString());
  const [followUpTime, setFollowUpTime] = useState("09:00");

  const effectiveTimezone = leadTimezone ?? resolveRepTimezone();

  useEffect(() => {
    if (open) {
      setOutcome("");
      setCompletionNote("");
      setFollowUp("none");
      setCustomDate(todayLocalString());
      setFollowUpTime("09:00");
    }
  }, [open]);

  const invalidateTaskQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/due-today"] });
    if (task?.opportunityId) queryClient.invalidateQueries({ queryKey: ["/api/tasks/for-opportunity", task.opportunityId] });
    if (task?.leadId) queryClient.invalidateQueries({ queryKey: ["/api/tasks/for-lead", task.leadId] });
    if (task?.contactId) queryClient.invalidateQueries({ queryKey: ["/api/tasks/for-contact", task.contactId] });
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!task) return;
      await apiRequest("PUT", `/api/tasks/${task.id}/complete`, {
        outcome,
        completionNote: completionNote.trim() || undefined,
      });

      if (followUp !== "none") {
        const dateStr = followUp === "custom"
          ? customDate
          : calcDueDateString(followUp);

        const payload: Record<string, unknown> = {
          title: "Follow up",
          notes: null,
          dueDate: dateStr,
          opportunityId: task.opportunityId ?? null,
          leadId: task.leadId ?? null,
          contactId: task.contactId ?? null,
        };

        if (followUp === "custom") {
          payload.followUpTime = followUpTime;
          payload.followUpTimezone = effectiveTimezone;
        }

        await apiRequest("POST", "/api/tasks", payload);
      }
    },
    onSuccess: () => {
      invalidateTaskQueries();
      const msg = followUp !== "none"
        ? t.tasks.taskCompletedNext
        : t.tasks.taskCompleted;
      toast({ title: msg });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: t.common.error, description: err.message, variant: "destructive" });
    },
  });

  if (!task) return null;

  const customDateValid = followUp !== "custom" || customDate !== "";
  const canSubmit = outcome !== "" && customDateValid && !submitMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md" data-testid="dialog-complete-task">
        <DialogHeader>
          <DialogTitle data-testid="text-complete-task-title">
            {t.tasks.completeTask}
          </DialogTitle>
          <p className="text-sm text-gray-500 truncate mt-1" data-testid="text-completing-task-name">
            {task.title}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t.tasks.outcome}</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger data-testid="select-outcome">
                <SelectValue placeholder={t.tasks.selectOutcome} />
              </SelectTrigger>
              <SelectContent>
                {OUTCOME_KEYS.map((key) => (
                  <SelectItem key={key} value={key} data-testid={`option-outcome-${key}`}>
                    {(t.tasks.outcomes as Record<string, string>)[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t.tasks.completionNotes}</Label>
            <Textarea
              value={completionNote}
              onChange={(e) => setCompletionNote(e.target.value)}
              placeholder={t.tasks.completionNotesPlaceholder}
              rows={2}
              data-testid="textarea-completion-note"
            />
          </div>

          <div className="space-y-2">
            <Label>{t.tasks.nextFollowUp}</Label>
            <RadioGroup value={followUp} onValueChange={(v) => setFollowUp(v as FollowUpOption)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="none" id="fu-none" data-testid="radio-followup-none" />
                <Label htmlFor="fu-none" className="font-normal cursor-pointer">{t.tasks.noNextFollowUp}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="1d" id="fu-1d" data-testid="radio-followup-1d" />
                <Label htmlFor="fu-1d" className="font-normal cursor-pointer">{t.tasks.tomorrow}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="3d" id="fu-3d" data-testid="radio-followup-3d" />
                <Label htmlFor="fu-3d" className="font-normal cursor-pointer">{t.tasks.in3Days}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="1w" id="fu-1w" data-testid="radio-followup-1w" />
                <Label htmlFor="fu-1w" className="font-normal cursor-pointer">{t.tasks.in1Week}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="fu-custom" data-testid="radio-followup-custom" />
                <Label htmlFor="fu-custom" className="font-normal cursor-pointer">{t.tasks.customDateTime}</Label>
              </div>
            </RadioGroup>

            {followUp === "custom" && (
              <div className="ml-6 mt-2 space-y-3 p-3 bg-gray-50 rounded-md border border-gray-100">
                <div className="space-y-1">
                  <Label htmlFor="custom-date" className="text-xs">{t.tasks.dueDate}</Label>
                  <Input
                    id="custom-date"
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    min={todayLocalString()}
                    data-testid="input-custom-date"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="custom-time" className="text-xs">Time</Label>
                  <Select value={followUpTime} onValueChange={setFollowUpTime}>
                    <SelectTrigger data-testid="select-custom-time">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_SLOTS.map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          {formatTimeSlot(slot)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-gray-400" data-testid="text-timezone-label">
                  {effectiveTimezone.replace(/_/g, " ")}
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitMutation.isPending}
            data-testid="button-cancel-complete"
          >
            {t.tasks.cancel}
          </Button>
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={!canSubmit}
            data-testid="button-submit-complete"
          >
            {submitMutation.isPending ? t.tasks.completing : t.tasks.completeTask}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

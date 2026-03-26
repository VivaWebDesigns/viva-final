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

export const OUTCOME_LABELS: Record<string, string> = {
  interested: "Interested",
  uncertain: "Uncertain",
  notInterested: "Not interested",
  appointmentSet: "Appointment set",
};

export const OUTCOME_KEYS = Object.keys(OUTCOME_LABELS) as readonly string[];

const NEW_LEAD_OUTCOME_LABELS: Record<string, string> = {
  noAnswer:      "No answer",
  leftVoicemail: "Left voicemail",
  spokeWithLead: "Spoke with lead",
};
const NEW_LEAD_OUTCOME_KEYS = Object.keys(NEW_LEAD_OUTCOME_LABELS) as readonly string[];

const REQUIRES_FOLLOW_UP = new Set([
  "Interested", "Uncertain",
]);

const US_TIMEZONES = [
  { value: "EST", label: "Eastern (EST)" },
  { value: "CST", label: "Central (CST)" },
  { value: "MST", label: "Mountain (MST)" },
  { value: "PST", label: "Pacific (PST)" },
];

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
  opportunityId?: string | null;
  leadId?: string | null;
  contactId?: string | null;
  defaultTaskTitle?: string;
  outcomeMode?: "new-lead" | "general";
  excludeOutcomes?: string[];
  hideFollowUp?: boolean;
  onSpokeWithLead?: (completionNote?: string) => void;
  onSuccess?: (outcome: string) => void;
  preventClose?: boolean;
}

export default function CompleteTaskModal({
  open,
  onClose,
  task,
  leadTimezone,
  opportunityId,
  leadId,
  contactId,
  defaultTaskTitle,
  outcomeMode = "general",
  excludeOutcomes = [] as string[],
  hideFollowUp = false,
  onSpokeWithLead,
  onSuccess,
  preventClose = false,
}: CompleteTaskModalProps) {
  const { toast } = useToast();
  const { t } = useAdminLang();

  const [outcome, setOutcome] = useState("");
  const [completionNote, setCompletionNote] = useState("");
  const [followUp, setFollowUp] = useState<FollowUpOption>("none");
  const [customDate, setCustomDate] = useState(todayLocalString());
  const [followUpTime, setFollowUpTime] = useState("09:00");

  // Demo scheduling fields (Appointment set)
  const [demoDate, setDemoDate] = useState("");
  const [demoTime, setDemoTime] = useState("");
  const [demoTimezone, setDemoTimezone] = useState("");
  const [demoRep, setDemoRep] = useState("");

  const effectiveTimezone = leadTimezone ?? resolveRepTimezone();

  const effOppId = task?.opportunityId ?? opportunityId ?? null;
  const effLeadId = task?.leadId ?? leadId ?? null;
  const effContactId = task?.contactId ?? contactId ?? null;

  const isAppointmentSet = outcome === "Appointment set";

  useEffect(() => {
    if (open) {
      setOutcome("");
      setCompletionNote("");
      setFollowUp("none");
      setCustomDate(todayLocalString());
      setFollowUpTime("09:00");
      setDemoDate("");
      setDemoTime("");
      setDemoTimezone("");
      setDemoRep("");
    }
  }, [open]);

  const buildDemoNote = (): string => {
    const datePart = demoDate
      ? new Date(demoDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
      : "";
    const timePart = demoTime ? formatTimeSlot(demoTime) : "";
    return [
      datePart && `Date: ${datePart}`,
      timePart && demoTimezone && `Time: ${timePart} ${demoTimezone}`,
      demoRep && `Rep: ${demoRep}`,
    ].filter(Boolean).join(" · ");
  };

  const invalidateTaskQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/due-today"] });
    queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === "/api/clients" &&
        query.queryKey[2] === "tasks",
    });
    if (effOppId) {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/for-opportunity", effOppId] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities/board"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities", effOppId] });
    }
    if (effLeadId) queryClient.invalidateQueries({ queryKey: ["/api/tasks/for-lead", effLeadId] });
    if (effContactId) queryClient.invalidateQueries({ queryKey: ["/api/tasks/for-contact", effContactId] });
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const note = isAppointmentSet ? buildDemoNote() : (completionNote.trim() || undefined);

      if (task) {
        await apiRequest("PUT", `/api/tasks/${task.id}/complete`, {
          outcome,
          completionNote: note,
          ...(isAppointmentSet && demoDate ? { demoDate } : {}),
        });
      } else if (outcome) {
        const rawTitle = defaultTaskTitle ?? "Follow up";
        const res = await apiRequest("POST", "/api/tasks", {
          title: rawTitle,
          dueDate: todayLocalString(),
          opportunityId: effOppId,
          leadId: effLeadId,
          contactId: effContactId,
          taskType: "follow_up",
        });
        const created: { id: string } = await res.json();
        await apiRequest("PUT", `/api/tasks/${created.id}/complete`, {
          outcome,
          completionNote: note,
        });
      }

      if (!hideFollowUp && followUp !== "none") {
        const dateStr = followUp === "custom"
          ? customDate
          : calcDueDateString(followUp);

        const rawTitle = task ? task.title : (defaultTaskTitle ?? "Follow up");
        const baseTitle = rawTitle.replace(/^(follow[\s-]up:\s*)+/gi, "").trim();
        const newTitle = /^follow[\s-]up with\b/i.test(baseTitle)
          ? baseTitle
          : `Follow up: ${baseTitle}`;
        const payload: Record<string, unknown> = {
          title: newTitle,
          notes: null,
          dueDate: dateStr,
          opportunityId: effOppId,
          leadId: effLeadId,
          contactId: effContactId,
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
      onSuccess?.(outcome);
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: t.common.error, description: err.message, variant: "destructive" });
    },
  });

  const isNewLead = outcomeMode === "new-lead";
  const baseOutcomeKeys = isNewLead ? NEW_LEAD_OUTCOME_KEYS : OUTCOME_KEYS;
  const baseOutcomeLabels = isNewLead ? NEW_LEAD_OUTCOME_LABELS : OUTCOME_LABELS;
  const activeOutcomeKeys = excludeOutcomes.length
    ? baseOutcomeKeys.filter((k) => !excludeOutcomes.includes(k))
    : baseOutcomeKeys;
  const activeOutcomeLabels = excludeOutcomes.length
    ? Object.fromEntries(Object.entries(baseOutcomeLabels).filter(([k]) => !excludeOutcomes.includes(k)))
    : baseOutcomeLabels;
  const isSpokeWithLead = isNewLead && outcome === "Spoke with lead";

  const customDateValid = followUp !== "custom" || customDate !== "";
  const followUpRequired = !isNewLead && !hideFollowUp && REQUIRES_FOLLOW_UP.has(outcome);
  const followUpMissing = followUpRequired && followUp === "none";

  const demoFieldsValid = !isAppointmentSet || (
    demoDate !== "" && demoTime !== "" && demoTimezone !== "" && demoRep.trim() !== ""
  );

  const canSubmit = outcome !== "" && customDateValid && !followUpMissing && demoFieldsValid && !submitMutation.isPending;

  const displayTitle = task?.title ?? defaultTaskTitle ?? null;

  const handleSubmitClick = () => {
    if (isSpokeWithLead && onSpokeWithLead) {
      onSpokeWithLead(completionNote.trim() || undefined);
    } else {
      submitMutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-md flex flex-col max-h-[90vh]"
        data-testid="dialog-complete-task"
        {...(preventClose ? {
          onInteractOutside: (e: Event) => e.preventDefault(),
          onEscapeKeyDown: (e: KeyboardEvent) => e.preventDefault(),
        } : {})}
      >
        <DialogHeader>
          <DialogTitle data-testid="text-complete-task-title">
            {t.tasks.completeTask}
          </DialogTitle>
          {displayTitle && (
            <p className="text-sm text-gray-500 truncate mt-1" data-testid="text-completing-task-name">
              {displayTitle}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0">
          <div className="space-y-2">
            <Label>{t.tasks.outcome}</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger data-testid="select-outcome">
                <SelectValue placeholder={t.tasks.selectOutcome} />
              </SelectTrigger>
              <SelectContent>
                {activeOutcomeKeys.map((key) => (
                  <SelectItem key={key} value={activeOutcomeLabels[key]} data-testid={`option-outcome-${key}`}>
                    {(t.tasks.outcomes as Record<string, string>)[key] ?? activeOutcomeLabels[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isAppointmentSet ? (
            <div className="space-y-3 p-3 bg-teal-50 border border-teal-100 rounded-lg">
              <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Demo Details (required)</p>

              <div className="space-y-1">
                <Label className="text-sm" htmlFor="demo-date">Date</Label>
                <Input
                  id="demo-date"
                  type="date"
                  value={demoDate}
                  onChange={(e) => setDemoDate(e.target.value)}
                  min={todayLocalString()}
                  data-testid="input-demo-date"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-sm font-semibold text-amber-600" htmlFor="demo-time">⚠ Lead's Time</Label>
                  <Select value={demoTime} onValueChange={setDemoTime}>
                    <SelectTrigger id="demo-time" data-testid="select-demo-time">
                      <SelectValue placeholder="Select time" />
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

                <div className="space-y-1">
                  <Label className="text-sm font-semibold text-amber-600" htmlFor="demo-tz">⚠ Lead's Time Zone</Label>
                  <Select value={demoTimezone} onValueChange={setDemoTimezone}>
                    <SelectTrigger id="demo-tz" data-testid="select-demo-timezone">
                      <SelectValue placeholder="Select TZ" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-teal-600 bg-teal-50 border border-teal-100 rounded px-2 py-1">
                Enter the time as it is for the <strong>lead</strong>, not your own time zone.
              </p>

              <div className="space-y-1">
                <Label className="text-sm" htmlFor="demo-rep">Sales Rep</Label>
                <Input
                  id="demo-rep"
                  type="text"
                  value={demoRep}
                  onChange={(e) => setDemoRep(e.target.value)}
                  placeholder="Rep's full name"
                  data-testid="input-demo-rep"
                />
              </div>

              {demoDate && demoTime && demoTimezone && demoRep.trim() && (
                <div className="mt-1 text-xs text-teal-600 bg-white border border-teal-100 rounded px-2 py-1.5">
                  <span className="font-medium">Preview: </span>
                  {buildDemoNote()}
                </div>
              )}
            </div>
          ) : (
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
          )}

          {!isNewLead && !hideFollowUp && !isAppointmentSet && (
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

              {followUpMissing && (
                <p className="text-xs text-red-500 mt-1" data-testid="msg-followup-required">
                  {t.tasks.requireFollowUpMessage}
                </p>
              )}

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
          )}

          {isNewLead && outcome !== "" && !isSpokeWithLead && (
            <p className="text-xs text-gray-500" data-testid="text-auto-followup-info">
              {(t.tasks.outcomes as Record<string, string>).autoFollowUpInfo}
            </p>
          )}
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
            onClick={handleSubmitClick}
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

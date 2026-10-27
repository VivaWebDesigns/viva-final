import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminLang } from "@/i18n/LanguageContext";
import { renderTaskTitle } from "@/lib/activityI18n";
import { useOpenSessionKey } from "@/hooks/use-open-session-key";
import { TIME_SLOTS, formatTimeSlot, todayLocalString } from "@/components/taskScheduling";
import { invalidateTaskQueriesFor } from "@/components/taskQueryInvalidation";
import { CALL_OUTCOMES, CALL_OUTCOME_STAGE } from "@shared/callPipeline";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LEAD_TIMEZONES = [
  { value: "America/New_York", labelKey: "timezoneEastern" },
  { value: "America/Chicago", labelKey: "timezoneCentral" },
  { value: "America/Denver", labelKey: "timezoneMountain" },
  { value: "America/Los_Angeles", labelKey: "timezonePacific" },
] as const;

/** Each screen of the prompt; "details" is the last one, where the chosen outcome is saved. */
type Step = "result" | "noAnswer" | "answered" | "afterSms" | "details";
type CallOutcome = typeof CALL_OUTCOMES[keyof typeof CALL_OUTCOMES];

interface CallTaskModalProps {
  open: boolean;
  onClose: () => void;
  task: {
    id: string;
    title: string;
    leadId?: string | null;
    opportunityId?: string | null;
    contactId?: string | null;
    companyId?: string | null;
  };
  onSuccess?: (outcome?: string) => void;
}

function CallTaskModalContent({ open, onClose, task, onSuccess }: CallTaskModalProps) {
  const { toast } = useToast();
  const { t } = useAdminLang();
  const c = t.callTask;

  const [history, setHistory] = useState<Step[]>(["result"]);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [smsSent, setSmsSent] = useState(false);
  const [date, setDate] = useState(() => todayLocalString());
  const [time, setTime] = useState("");
  const [timezone, setTimezone] = useState<string>("America/New_York");
  const [notes, setNotes] = useState("");

  const outcomeLabels: Record<CallOutcome, string> = {
    [CALL_OUTCOMES.leftVoicemail]: `${c.noAnswer} → ${c.leftVoicemail}`,
    [CALL_OUTCOMES.noVoicemail]: `${c.noAnswer} → ${c.noVoicemail}`,
    [CALL_OUTCOMES.wrongNumber]: c.wrongNumber,
    [CALL_OUTCOMES.appointmentSet]: c.interested,
    [CALL_OUTCOMES.callBack]: c.callBack,
    [CALL_OUTCOMES.notInterested]: c.notInterested,
  };

  const step = history[history.length - 1];
  const go = (next: Step) => setHistory((h) => [...h, next]);
  const back = () => {
    if (step === "details") setOutcome(null);
    if (step === "afterSms") setSmsSent(false);
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
  };
  const choose = (value: CallOutcome) => {
    setOutcome(value);
    go("details");
  };

  const needsTime = outcome === CALL_OUTCOMES.appointmentSet || outcome === CALL_OUTCOMES.callBack;
  const canSave = !!outcome && (!needsTime || (date !== "" && time !== ""));
  const stageSlug = outcome ? CALL_OUTCOME_STAGE[outcome] : null;
  const stageName = stageSlug ? (t.pipeline.stageNames as Record<string, string>)[stageSlug] ?? stageSlug : "";

  const saveMutation = useMutation({
    mutationFn: async () => {
      const completionNote = [smsSent ? "Texted the scan." : null, notes.trim() || null].filter(Boolean).join(" ") || undefined;
      await apiRequest("PUT", `/api/tasks/${task.id}/complete`, {
        outcome,
        completionNote,
        ...(outcome === CALL_OUTCOMES.appointmentSet ? { demoDate: date, demoTime: time, demoTimezone: timezone } : {}),
        ...(outcome === CALL_OUTCOMES.callBack ? { callBackDate: date, callBackTime: time, callBackTimezone: timezone } : {}),
      });
    },
    onSuccess: () => {
      invalidateTaskQueriesFor({
        opportunityId: task.opportunityId ?? null, leadId: task.leadId ?? null,
        contactId: task.contactId ?? null, companyId: task.companyId ?? null,
      });
      toast({ title: c.saved });
      onSuccess?.(outcome ?? undefined);
      onClose();
    },
    onError: (err: Error) => toast({ title: t.common.error, description: err.message, variant: "destructive" }),
  });

  const choice = (label: string, onClick: () => void, testId: string, tone = "") => (
    <Button variant="outline" className={`h-11 justify-start ${tone}`} onClick={onClick} data-testid={testId}>
      {label}
    </Button>
  );

  const answeredChoices = (prefix: string) => (
    <>
      {choice(c.interested, () => choose(CALL_OUTCOMES.appointmentSet), `${prefix}-interested`)}
      {prefix === "answered" && choice(c.sentSms, () => { setSmsSent(true); go("afterSms"); }, "answered-sent-sms")}
      {choice(c.callBack, () => choose(CALL_OUTCOMES.callBack), `${prefix}-call-back`)}
      {choice(c.notInterested, () => choose(CALL_OUTCOMES.notInterested), `${prefix}-not-interested`, "text-red-600")}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md flex flex-col max-h-[90vh]" data-testid="dialog-call-task">
        <DialogHeader>
          <DialogTitle>{c.title}</DialogTitle>
          <DialogDescription>{renderTaskTitle({ title: task.title }, t)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 overflow-y-auto flex-1 min-h-0">
          {step === "result" && (
            <>
              <p className="text-sm font-medium text-gray-700">{c.whatHappened}</p>
              <div className="grid gap-2">
                {choice(c.noAnswer, () => go("noAnswer"), "call-no-answer")}
                {choice(c.answered, () => go("answered"), "call-answered")}
                {choice(c.wrongNumber, () => choose(CALL_OUTCOMES.wrongNumber), "call-wrong-number", "text-red-600")}
              </div>
            </>
          )}

          {step === "noAnswer" && (
            <div className="grid gap-2">
              {choice(c.leftVoicemail, () => choose(CALL_OUTCOMES.leftVoicemail), "call-left-voicemail")}
              {choice(c.noVoicemail, () => choose(CALL_OUTCOMES.noVoicemail), "call-no-voicemail")}
            </div>
          )}

          {step === "answered" && <div className="grid gap-2">{answeredChoices("answered")}</div>}

          {step === "afterSms" && (
            <>
              <p className="text-sm font-medium text-gray-700">{c.afterSms}</p>
              <div className="grid gap-2">{answeredChoices("after-sms")}</div>
            </>
          )}

          {step === "details" && outcome && (
            <>
              <p className="text-sm font-semibold text-gray-900">
                {smsSent ? `${c.sentSms} → ` : ""}{outcomeLabels[outcome]}
              </p>
              <p className="text-xs text-gray-500">
                {c.willMoveTo.replace("{{stage}}", stageName)}
                {" · "}
                {outcome === CALL_OUTCOMES.appointmentSet ? c.discoveryCallTask
                  : outcome === CALL_OUTCOMES.callBack ? c.callBackTask
                  : stageSlug === "attempted" ? c.nextCallTomorrow : ""}
              </p>

              {needsTime && (
                <div className="space-y-3 p-3 bg-teal-50 border border-teal-100 rounded-lg">
                  <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">
                    {outcome === CALL_OUTCOMES.appointmentSet ? c.discoveryCallDetails : c.callBackDetails}
                  </p>
                  <div className="space-y-1">
                    <Label className="text-sm" htmlFor="call-date">{c.date}</Label>
                    <Input id="call-date" type="date" value={date} min={todayLocalString()}
                      onChange={(e) => setDate(e.target.value)} data-testid="input-call-date" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-sm" htmlFor="call-time">{c.time}</Label>
                      <Select value={time} onValueChange={setTime}>
                        <SelectTrigger id="call-time" data-testid="select-call-time">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_SLOTS.map((slot) => (
                            <SelectItem key={slot} value={slot}>{formatTimeSlot(slot)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm" htmlFor="call-tz">{c.timezone}</Label>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger id="call-tz" data-testid="select-call-timezone">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_TIMEZONES.map((tz) => (
                            <SelectItem key={tz.value} value={tz.value}>
                              {(t.tasks as unknown as Record<string, string>)[tz.labelKey]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="call-notes">{c.notes}</Label>
                <Textarea id="call-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder={c.notesPlaceholder} rows={2} data-testid="textarea-call-notes" />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "result" ? (
            <Button variant="outline" onClick={onClose} disabled={saveMutation.isPending}>{t.tasks.cancel}</Button>
          ) : (
            <Button variant="outline" onClick={back} disabled={saveMutation.isPending} data-testid="button-call-back-step">{c.back}</Button>
          )}
          {step === "details" && (
            <Button onClick={() => saveMutation.mutate()} disabled={!canSave || saveMutation.isPending} data-testid="button-call-save">
              {saveMutation.isPending ? c.saving : c.save}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CallTaskModal(props: CallTaskModalProps) {
  const sessionKey = useOpenSessionKey(props.open);
  return <CallTaskModalContent key={sessionKey} {...props} />;
}

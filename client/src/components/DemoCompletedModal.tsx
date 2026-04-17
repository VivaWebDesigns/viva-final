import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminLang } from "@/i18n/LanguageContext";
import { formatTimeSlot, TIME_SLOTS } from "@/components/QuickTaskModal";

function tomorrowLocalString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CallButton from "@/components/CallButton";
import SMSButton from "@/components/SMSButton";

type Outcome = "ready-for-payment" | "still-thinking" | "not-interested";

interface DemoCompletedModalProps {
  open: boolean;
  onClose: () => void;
  opportunityId: string;
  contactName: string;
  contactPhone: string | null;
  onReadyForPayment: () => void;
  onDemoCompleted: () => void;
  onClosedLost: () => void;
}

export default function DemoCompletedModal({
  open,
  onClose,
  opportunityId,
  contactName,
  contactPhone,
  onReadyForPayment,
  onDemoCompleted,
  onClosedLost,
}: DemoCompletedModalProps) {
  const { toast } = useToast();
  const { t } = useAdminLang();
  const dc = t.demoCompleted;

  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const [followUpDate, setFollowUpDate] = useState(tomorrowLocalString());
  const [followUpTime, setFollowUpTime] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");

  const [countdown, setCountdown] = useState(5);
  const [countdownStarted, setCountdownStarted] = useState(false);

  useEffect(() => {
    if (!open) {
      setOutcome(null);
      setFollowUpDate(tomorrowLocalString());
      setFollowUpTime("");
      setFollowUpNotes("");
      setCountdown(5);
      setCountdownStarted(false);
    }
  }, [open]);

  useEffect(() => {
    if (outcome === "not-interested" && !countdownStarted) {
      setCountdownStarted(true);
      setCountdown(5);
    }
  }, [outcome, countdownStarted]);

  useEffect(() => {
    if (!countdownStarted || countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdownStarted, countdown]);

  const taskMutation = useMutation({
    mutationFn: async () => {
      const firstName = contactName.split(" ")[0] || contactName;
      await apiRequest("POST", "/api/tasks", {
        title: `Follow up with ${firstName}`,
        notes: followUpNotes.trim() || undefined,
        dueDate: followUpDate,
        followUpTime: followUpTime || undefined,
        opportunityId,
        taskType: "demo_followup",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/due-today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/for-opportunity", opportunityId] });
      onDemoCompleted();
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: t.common.error, description: err.message, variant: "destructive" });
    },
  });

  const handleOutcomeSelect = (o: Outcome) => {
    setOutcome(o);
  };

  const handleReadyForPaymentConfirm = () => {
    onReadyForPayment();
    onClose();
  };

  const handleStillThinkingSubmit = () => {
    if (!followUpDate) return;
    taskMutation.mutate();
  };

  const handleNotInterestedConfirm = () => {
    onClosedLost();
    onClose();
  };

  const firstName = contactName.split(" ")[0] || contactName;
  const smsText = dc.closingSms.replace("{{name}}", firstName);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-md"
        data-testid="dialog-demo-completed"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle data-testid="text-demo-completed-title">{dc.title}</DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            {dc.subtitle}
          </p>
        </DialogHeader>

        {!outcome && (
          <>
            <div className="space-y-2 py-2">
              <Button
                className="w-full justify-start h-auto py-3 px-4"
                variant="outline"
                onClick={() => handleOutcomeSelect("ready-for-payment")}
                data-testid="button-demo-outcome-payment"
              >
                <div className="text-left">
                  <div className="font-medium text-green-700">{dc.outcomePayment}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{dc.outcomePaymentSub}</div>
                </div>
              </Button>
              <Button
                className="w-full justify-start h-auto py-3 px-4"
                variant="outline"
                onClick={() => handleOutcomeSelect("still-thinking")}
                data-testid="button-demo-outcome-thinking"
              >
                <div className="text-left">
                  <div className="font-medium text-amber-700">{dc.outcomeThinking}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{dc.outcomeThinkingSub}</div>
                </div>
              </Button>
              <Button
                className="w-full justify-start h-auto py-3 px-4"
                variant="outline"
                onClick={handleNotInterestedConfirm}
                data-testid="button-demo-outcome-lost"
              >
                <div className="text-left">
                  <div className="font-medium text-red-700">{dc.outcomeNotInterested}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{dc.outcomeNotInterestedSub}</div>
                </div>
              </Button>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose} data-testid="button-demo-cancel">
                {t.common.cancel}
              </Button>
            </DialogFooter>
          </>
        )}

        {outcome === "ready-for-payment" && (
          <>
            <div className="py-2 space-y-3">
              <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                {dc.readyForPaymentMsg}
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setOutcome(null)} data-testid="button-payment-back">
                {t.common.back}
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleReadyForPaymentConfirm}
                data-testid="button-payment-confirm"
              >
                {dc.confirmProceed}
              </Button>
            </DialogFooter>
          </>
        )}

        {outcome === "still-thinking" && (
          <>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label htmlFor="fu-date">{dc.followUpDate} <span className="text-red-500">*</span></Label>
                <Input
                  id="fu-date"
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  data-testid="input-followup-date"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fu-time">
                  {dc.followUpTime}{" "}
                  <span className="text-gray-400 text-xs font-normal">({t.common.optional.toLowerCase()})</span>
                </Label>
                <Select value={followUpTime} onValueChange={setFollowUpTime}>
                  <SelectTrigger id="fu-time" data-testid="select-followup-time">
                    <SelectValue placeholder={dc.selectTime} />
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
                <Label htmlFor="fu-notes">
                  {dc.notes}{" "}
                  <span className="text-gray-400 text-xs font-normal">({t.common.optional.toLowerCase()})</span>
                </Label>
                <Textarea
                  id="fu-notes"
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  placeholder={dc.notesPlaceholder}
                  rows={2}
                  data-testid="textarea-followup-notes"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setOutcome(null)} disabled={taskMutation.isPending}>
                {t.common.back}
              </Button>
              <Button
                onClick={handleStillThinkingSubmit}
                disabled={taskMutation.isPending || !followUpDate}
                data-testid="button-save-followup"
              >
                {taskMutation.isPending ? t.common.saving : dc.saveAndMove}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* NOT-INTERESTED SMS SCREEN — hidden until re-enabled
        {outcome === "not-interested" && (
          <>
            <div className="space-y-4 py-2">
              {contactPhone && (
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">{dc.leadsPhone}</Label>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium" data-testid="text-lead-phone">{contactPhone}</p>
                    <CallButton phone={contactPhone} />
                    <SMSButton phone={contactPhone} />
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs text-gray-500 uppercase tracking-wide">{dc.closingMessage}</Label>
                <div
                  className="text-sm bg-gray-50 border border-gray-200 rounded px-3 py-2 leading-relaxed"
                  data-testid="text-closing-sms"
                >
                  {smsText}
                </div>
                <p className="text-xs text-gray-400">
                  {dc.sendManuallyHint}
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => { setOutcome(null); setCountdownStarted(false); setCountdown(5); }}>
                {t.common.back}
              </Button>
              <Button
                variant="destructive"
                disabled={countdown > 0}
                onClick={handleNotInterestedConfirm}
                data-testid="button-message-sent"
              >
                {countdown > 0
                  ? dc.messageSentCountdown.replace("{{n}}", String(countdown))
                  : dc.messageSentCloseLead}
              </Button>
            </DialogFooter>
          </>
        )}
        */}
      </DialogContent>
    </Dialog>
  );
}

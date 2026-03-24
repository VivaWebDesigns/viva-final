import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { todayLocalString, formatTimeSlot, TIME_SLOTS } from "@/components/QuickTaskModal";
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

type Outcome = "ready-for-payment" | "still-thinking" | "not-interested";

interface DemoCompletedModalProps {
  open: boolean;
  onClose: () => void;
  opportunityId: string;
  contactName: string;
  contactPhone: string | null;
  hasOpenFollowUpTask: boolean;
  onReadyForPayment: () => void;
  onDemoCompleted: () => void;
  onClosedLost: () => void;
}

const CLOSING_SMS = (name: string) =>
  `Hi ${name || "there"}, thank you for your time speaking with us. We appreciate the opportunity and hope we can work together in the future. Don't hesitate to reach out anytime. — Viva Web Designs (980) 949-0548`;

export default function DemoCompletedModal({
  open,
  onClose,
  opportunityId,
  contactName,
  contactPhone,
  hasOpenFollowUpTask,
  onReadyForPayment,
  onDemoCompleted,
  onClosedLost,
}: DemoCompletedModalProps) {
  const { toast } = useToast();

  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const [followUpDate, setFollowUpDate] = useState(todayLocalString());
  const [followUpTime, setFollowUpTime] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");

  const [countdown, setCountdown] = useState(5);
  const [countdownStarted, setCountdownStarted] = useState(false);

  useEffect(() => {
    if (!open) {
      setOutcome(null);
      setFollowUpDate(todayLocalString());
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
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdownStarted, countdown]);

  const taskMutation = useMutation({
    mutationFn: async () => {
      if (!hasOpenFollowUpTask) {
        const firstName = contactName.split(" ")[0] || contactName;
        await apiRequest("POST", "/api/tasks", {
          title: `Follow up with ${firstName}`,
          notes: followUpNotes.trim() || undefined,
          dueDate: followUpDate,
          followUpTime: followUpTime || undefined,
          opportunityId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/due-today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/for-opportunity", opportunityId] });
      onDemoCompleted();
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleOutcomeSelect = (o: Outcome) => {
    if (o === "ready-for-payment") {
      onReadyForPayment();
      onClose();
      return;
    }
    setOutcome(o);
  };

  const handleStillThinkingSubmit = () => {
    if (!hasOpenFollowUpTask && !followUpDate) return;
    taskMutation.mutate();
  };

  const handleNotInterestedConfirm = () => {
    onClosedLost();
    onClose();
  };

  const smsText = CLOSING_SMS(contactName.split(" ")[0] || contactName);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md" data-testid="dialog-demo-completed">
        <DialogHeader>
          <DialogTitle data-testid="text-demo-completed-title">Demo Completed</DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            How did the demo go?
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
                  <div className="font-medium text-green-700">Ready for payment</div>
                  <div className="text-xs text-gray-500 mt-0.5">Continue to send the payment link</div>
                </div>
              </Button>
              <Button
                className="w-full justify-start h-auto py-3 px-4"
                variant="outline"
                onClick={() => handleOutcomeSelect("still-thinking")}
                data-testid="button-demo-outcome-thinking"
              >
                <div className="text-left">
                  <div className="font-medium text-amber-700">Still thinking</div>
                  <div className="text-xs text-gray-500 mt-0.5">Schedule a follow-up call</div>
                </div>
              </Button>
              <Button
                className="w-full justify-start h-auto py-3 px-4"
                variant="outline"
                onClick={() => handleOutcomeSelect("not-interested")}
                data-testid="button-demo-outcome-lost"
              >
                <div className="text-left">
                  <div className="font-medium text-red-700">Not interested</div>
                  <div className="text-xs text-gray-500 mt-0.5">Send a closing message and close the lead</div>
                </div>
              </Button>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose} data-testid="button-demo-cancel">
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}

        {outcome === "still-thinking" && (
          <>
            <div className="space-y-4 py-2">
              {hasOpenFollowUpTask ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2">
                  An open follow-up task already exists for this lead. No new task will be created.
                </p>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="fu-date">Follow-up Date <span className="text-red-500">*</span></Label>
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
                      Follow-up Time{" "}
                      <span className="text-gray-400 text-xs font-normal">(optional)</span>
                    </Label>
                    <Select value={followUpTime} onValueChange={setFollowUpTime}>
                      <SelectTrigger id="fu-time" data-testid="select-followup-time">
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
                    <Label htmlFor="fu-notes">
                      Notes{" "}
                      <span className="text-gray-400 text-xs font-normal">(optional)</span>
                    </Label>
                    <Textarea
                      id="fu-notes"
                      value={followUpNotes}
                      onChange={(e) => setFollowUpNotes(e.target.value)}
                      placeholder="What to discuss on the follow-up call..."
                      rows={2}
                      data-testid="textarea-followup-notes"
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setOutcome(null)} disabled={taskMutation.isPending}>
                Back
              </Button>
              <Button
                onClick={handleStillThinkingSubmit}
                disabled={taskMutation.isPending || (!hasOpenFollowUpTask && !followUpDate)}
                data-testid="button-save-followup"
              >
                {taskMutation.isPending
                  ? "Saving…"
                  : hasOpenFollowUpTask
                  ? "Move to Demo Completed"
                  : "Save & Move"}
              </Button>
            </DialogFooter>
          </>
        )}

        {outcome === "not-interested" && (
          <>
            <div className="space-y-4 py-2">
              {contactPhone && (
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Lead's Phone</Label>
                  <p className="text-sm font-medium" data-testid="text-lead-phone">{contactPhone}</p>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs text-gray-500 uppercase tracking-wide">Closing Message</Label>
                <div
                  className="text-sm bg-gray-50 border border-gray-200 rounded px-3 py-2 leading-relaxed"
                  data-testid="text-closing-sms"
                >
                  {smsText}
                </div>
                <p className="text-xs text-gray-400">
                  Send this message manually from your phone before confirming.
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => { setOutcome(null); setCountdownStarted(false); setCountdown(5); }}>
                Back
              </Button>
              <Button
                variant="destructive"
                disabled={countdown > 0}
                onClick={handleNotInterestedConfirm}
                data-testid="button-message-sent"
              >
                {countdown > 0 ? `Message sent (${countdown}s)` : "Message sent — Close Lead"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

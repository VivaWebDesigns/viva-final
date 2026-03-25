import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getClosingSms } from "@/lib/closingMessage";
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

type Outcome = "payment-received" | "still-waiting" | "backed-out";

interface PaymentFollowUpModalProps {
  open: boolean;
  onClose: () => void;
  opportunityId: string;
  contactName: string;
  contactPhone: string | null;
  contactLanguage: string | null;
  onPaymentReceived: () => void;
  onStillWaiting: () => void;
  onBackedOut: () => void;
}

export default function PaymentFollowUpModal({
  open,
  onClose,
  opportunityId,
  contactName,
  contactPhone,
  contactLanguage,
  onPaymentReceived,
  onStillWaiting,
  onBackedOut,
}: PaymentFollowUpModalProps) {
  const { toast } = useToast();

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
    if (outcome === "backed-out" && !countdownStarted) {
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
      const firstName = contactName.split(" ")[0] || contactName;
      await apiRequest("POST", "/api/tasks", {
        title: `Follow up on payment — ${firstName}`,
        notes: followUpNotes.trim() || undefined,
        dueDate: followUpDate,
        followUpTime: followUpTime || undefined,
        opportunityId,
        taskType: "payment_followup",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/due-today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/for-opportunity", opportunityId] });
      onStillWaiting();
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const firstName = contactName.split(" ")[0] || contactName;
  const smsText = getClosingSms(firstName, contactLanguage);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-md"
        data-testid="dialog-payment-followup"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle data-testid="text-payment-followup-title">Payment Follow-Up</DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            What happened with the payment?
          </p>
        </DialogHeader>

        {!outcome && (
          <>
            <div className="space-y-2 py-2">
              <Button
                className="w-full justify-start h-auto py-3 px-4"
                variant="outline"
                onClick={() => setOutcome("payment-received")}
                data-testid="button-payment-received"
              >
                <div className="text-left">
                  <div className="font-medium text-green-700">Payment received</div>
                  <div className="text-xs text-gray-500 mt-0.5">Close this lead as Won</div>
                </div>
              </Button>
              <Button
                className="w-full justify-start h-auto py-3 px-4"
                variant="outline"
                onClick={() => setOutcome("still-waiting")}
                data-testid="button-still-waiting"
              >
                <div className="text-left">
                  <div className="font-medium text-amber-700">Still waiting</div>
                  <div className="text-xs text-gray-500 mt-0.5">Schedule another follow-up</div>
                </div>
              </Button>
              <Button
                className="w-full justify-start h-auto py-3 px-4"
                variant="outline"
                onClick={() => setOutcome("backed-out")}
                data-testid="button-backed-out"
              >
                <div className="text-left">
                  <div className="font-medium text-red-700">Backed out</div>
                  <div className="text-xs text-gray-500 mt-0.5">Send a closing message and close the lead</div>
                </div>
              </Button>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose} data-testid="button-payment-followup-cancel">
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}

        {outcome === "payment-received" && (
          <>
            <div className="py-2 space-y-3">
              <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                Great work! Confirm below to close this lead as Won.
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setOutcome(null)} data-testid="button-payment-received-back">
                Back
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => { onPaymentReceived(); onClose(); }}
                data-testid="button-payment-received-confirm"
              >
                Confirm — Close as Won
              </Button>
            </DialogFooter>
          </>
        )}

        {outcome === "still-waiting" && (
          <>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label htmlFor="pf-date">Follow-up Date <span className="text-red-500">*</span></Label>
                <Input
                  id="pf-date"
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  data-testid="input-payment-followup-date"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pf-time">
                  Follow-up Time{" "}
                  <span className="text-gray-400 text-xs font-normal">(optional)</span>
                </Label>
                <Select value={followUpTime} onValueChange={setFollowUpTime}>
                  <SelectTrigger id="pf-time" data-testid="select-payment-followup-time">
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
                <Label htmlFor="pf-notes">
                  Notes{" "}
                  <span className="text-gray-400 text-xs font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="pf-notes"
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  placeholder="Notes for the next follow-up..."
                  rows={2}
                  data-testid="textarea-payment-followup-notes"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setOutcome(null)} disabled={taskMutation.isPending}>
                Back
              </Button>
              <Button
                onClick={() => { if (followUpDate) taskMutation.mutate(); }}
                disabled={taskMutation.isPending || !followUpDate}
                data-testid="button-save-payment-followup"
              >
                {taskMutation.isPending ? "Saving…" : "Save & Follow Up"}
              </Button>
            </DialogFooter>
          </>
        )}

        {outcome === "backed-out" && (
          <>
            <div className="space-y-4 py-2">
              {contactPhone && (
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500 uppercase tracking-wide">Lead's Phone</Label>
                  <p className="text-sm font-medium" data-testid="text-payment-lead-phone">{contactPhone}</p>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs text-gray-500 uppercase tracking-wide">Closing Message</Label>
                <div
                  className="text-sm bg-gray-50 border border-gray-200 rounded px-3 py-2 leading-relaxed"
                  data-testid="text-payment-closing-sms"
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
                onClick={() => { onBackedOut(); onClose(); }}
                data-testid="button-backed-out-confirm"
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

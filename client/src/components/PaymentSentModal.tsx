import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { resolveRepTimezone } from "@/lib/timezone";
import { todayLocalString, formatTimeSlot } from "@/components/QuickTaskModal";
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

const PAYMENT_METHODS = ["Text", "Email", "Both"] as const;
type PaymentMethod = typeof PAYMENT_METHODS[number];

const FOLLOWUP_OFFSETS = [
  { value: 2, label: "2 hours (aggressive)" },
  { value: 3, label: "3 hours (standard)" },
  { value: 4, label: "4 hours (light)" },
] as const;

const TASK_TITLE = "Follow up on payment";
const TASK_NOTES = "Follow up on payment link. Check if they had any issues and resend the link if needed.";

function addHoursToTime(time24: string, hours: number): string {
  const [h, m] = time24.split(":").map(Number);
  const totalMinutes = h * 60 + m + hours * 60;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

interface PaymentSentModalProps {
  open: boolean;
  onClose: () => void;
  opportunityId: string;
  onSuccess: () => void;
}

export default function PaymentSentModal({
  open,
  onClose,
  opportunityId,
  onSuccess,
}: PaymentSentModalProps) {
  const { toast } = useToast();
  const repTimezone = resolveRepTimezone();

  const [timeSent, setTimeSent] = useState("");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [notes, setNotes] = useState("");
  const [offsetHours, setOffsetHours] = useState<number>(3);

  useEffect(() => {
    if (open) {
      setTimeSent("");
      setMethod("");
      setNotes("");
      setOffsetHours(3);
    }
  }, [open]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const today = todayLocalString();
      const followUpTime = addHoursToTime(timeSent, offsetHours);

      await apiRequest("POST", "/api/tasks", {
        title: TASK_TITLE,
        notes: TASK_NOTES,
        dueDate: today,
        followUpTime,
        followUpTimezone: repTimezone,
        opportunityId,
      });

      const timeFmt = formatTimeSlot(timeSent);
      const activityParts = [`Payment link sent via ${method} at ${timeFmt}.`];
      if (notes.trim()) activityParts.push(notes.trim());
      await apiRequest("POST", `/api/pipeline/opportunities/${opportunityId}/activities`, {
        type: "note",
        content: activityParts.join(" "),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/due-today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/for-opportunity", opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities/board"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities", opportunityId, "activities"] });
      toast({ title: "Follow-up scheduled" });
      onSuccess();
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const followUpTime = timeSent ? addHoursToTime(timeSent, offsetHours) : null;
  const canSubmit = timeSent !== "" && method !== "" && !submitMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md" data-testid="dialog-payment-sent">
        <DialogHeader>
          <DialogTitle data-testid="text-payment-sent-title">
            Payment Sent — Schedule Follow-Up
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Log the payment details and set a follow-up reminder.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="ps-time-sent">
              Time Sent <span className="text-red-500">*</span>
            </Label>
            <Input
              id="ps-time-sent"
              type="time"
              value={timeSent}
              onChange={(e) => setTimeSent(e.target.value)}
              data-testid="input-time-sent"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Method <span className="text-red-500">*</span>
            </Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger data-testid="select-payment-method">
                <SelectValue placeholder="Select method..." />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem
                    key={m}
                    value={m}
                    data-testid={`option-method-${m.toLowerCase()}`}
                  >
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ps-notes">
              Notes{" "}
              <span className="text-gray-400 text-xs font-normal">(optional)</span>
            </Label>
            <Textarea
              id="ps-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional context..."
              rows={2}
              data-testid="textarea-payment-notes"
            />
          </div>

          <div className="border-t pt-4 space-y-2">
            <Label>Follow-Up Timing</Label>
            <Select
              value={String(offsetHours)}
              onValueChange={(v) => setOffsetHours(Number(v))}
            >
              <SelectTrigger data-testid="select-followup-timing">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FOLLOWUP_OFFSETS.map((o) => (
                  <SelectItem
                    key={o.value}
                    value={String(o.value)}
                    data-testid={`option-timing-${o.value}h`}
                  >
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {followUpTime && (
              <p className="text-xs text-gray-500" data-testid="text-followup-preview">
                Follow-up task due at{" "}
                <span className="font-medium">{formatTimeSlot(followUpTime)}</span>
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitMutation.isPending}
            data-testid="button-cancel-payment-sent"
          >
            Cancel
          </Button>
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={!canSubmit}
            data-testid="button-submit-payment-sent"
          >
            {submitMutation.isPending ? "Saving..." : "Save & Move to Payment Sent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { resolveRepTimezone } from "@/lib/timezone";
import { todayLocalString, formatTimeSlot } from "@/components/QuickTaskModal";
import { useAdminLang } from "@/i18n/LanguageContext";
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

const PAYMENT_METHOD_VALUES = ["Text", "Email", "Both"] as const;
type PaymentMethod = typeof PAYMENT_METHOD_VALUES[number];

const TASK_TITLE = "Follow up on payment";
const TASK_NOTES =
  "Follow up on payment link. Check if they had any issues and resend the link if needed.";

/**
 * Add offsetHours to a HH:MM rep-local time string.
 * Returns { dueDate, followUpTime } — dueDate rolls to the next day if needed.
 * Time Sent is always treated as the rep's local wall-clock time.
 */
function computeFollowUp(
  timeSent: string,
  offsetHours: number,
): { dueDate: string; followUpTime: string } {
  const [h, m] = timeSent.split(":").map(Number);
  const totalMinutes = h * 60 + m + offsetHours * 60;
  const dayOffset = Math.floor(totalMinutes / (60 * 24));
  const minutesInDay = totalMinutes % (60 * 24);
  const newH = Math.floor(minutesInDay / 60);
  const newM = minutesInDay % 60;

  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return {
    dueDate: `${yyyy}-${mm}-${dd}`,
    followUpTime: `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`,
  };
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
  const { t } = useAdminLang();
  const ps = t.pipeline.paymentSent;

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

  const followUpResult = timeSent ? computeFollowUp(timeSent, offsetHours) : null;

  const methodLabels: Record<PaymentMethod, string> = {
    Text:  ps.methodText,
    Email: ps.methodEmail,
    Both:  ps.methodBoth,
  };

  const followUpOffsets = [
    { value: 2, label: ps.timing2h },
    { value: 3, label: ps.timing3h },
    { value: 4, label: ps.timing4h },
  ];

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { dueDate, followUpTime } = followUpResult ?? computeFollowUp(timeSent, offsetHours);

      await apiRequest("POST", "/api/tasks", {
        title: TASK_TITLE,
        notes: TASK_NOTES,
        dueDate,
        followUpTime,
        followUpTimezone: repTimezone,
        opportunityId,
      });

      const timeFmt = formatTimeSlot(timeSent);
      const userNote = notes.trim() || null;
      const activityParts = [`Payment link sent via ${method} at ${timeFmt}.`];
      if (userNote) activityParts.push(userNote);
      await apiRequest("POST", `/api/pipeline/opportunities/${opportunityId}/activities`, {
        type: "note",
        content: activityParts.join(" "),
        metadata: {
          event: "payment_sent",
          method,
          timeFmt,
          userNote,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/due-today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/for-opportunity", opportunityId] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities/board"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/pipeline/opportunities", opportunityId, "activities"],
      });
      toast({ title: ps.toastSuccess });
      onSuccess();
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: t.common.error ?? "Error", description: err.message, variant: "destructive" });
    },
  });

  const canSubmit = timeSent !== "" && method !== "" && !submitMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-md"
        data-testid="dialog-payment-sent"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle data-testid="text-payment-sent-title">
            {ps.title}
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            {ps.subtitle}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="ps-time-sent" className="text-sm font-semibold text-blue-600">
              🕐 Rep's Time Sent <span className="text-red-500">*</span>
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
              {ps.method} <span className="text-red-500">*</span>
            </Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger data-testid="select-payment-method">
                <SelectValue placeholder={ps.selectMethod} />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHOD_VALUES.map((m) => (
                  <SelectItem
                    key={m}
                    value={m}
                    data-testid={`option-method-${m.toLowerCase()}`}
                  >
                    {methodLabels[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ps-notes">
              {ps.notes}{" "}
              <span className="text-gray-400 text-xs font-normal">{ps.optional}</span>
            </Label>
            <Textarea
              id="ps-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={ps.notesPlaceholder}
              rows={2}
              data-testid="textarea-payment-notes"
            />
          </div>

          <div className="border-t pt-4 space-y-2">
            <Label>{ps.followUpTiming}</Label>
            <Select
              value={String(offsetHours)}
              onValueChange={(v) => setOffsetHours(Number(v))}
            >
              <SelectTrigger data-testid="select-followup-timing">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {followUpOffsets.map((o) => (
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
            {followUpResult && (
              <p className="text-xs text-gray-500" data-testid="text-followup-preview">
                {ps.followUpDueAt}{" "}
                <span className="font-medium">
                  {formatTimeSlot(followUpResult.followUpTime)}
                </span>{" "}
                {ps.yourTime}
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
            {t.common.cancel}
          </Button>
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={!canSubmit}
            data-testid="button-submit-payment-sent"
          >
            {submitMutation.isPending ? ps.saving : ps.saveAndMove}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

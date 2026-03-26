import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { resolveRepTimezone } from "@/lib/timezone";
import { TIME_SLOTS, formatTimeSlot, todayLocalString } from "@/components/QuickTaskModal";
import { useAdminLang } from "@/i18n/LanguageContext";
import { Copy, Check } from "lucide-react";
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

const FOLLOW_UP_TITLE = "Follow up on payment";
const FOLLOW_UP_NOTES =
  "Follow up on payment link. Check if they had any issues and resend the link if needed.";

type Path = "payment-received" | "still-waiting" | "wont-pay" | null;

interface PaymentFollowupModalProps {
  open: boolean;
  onClose: () => void;
  opportunityId: string;
  taskId: string;
  onPaymentReceived: () => void;
  onWontPay: () => void;
  contactName?: string | null;
}

export default function PaymentFollowupModal({
  open,
  onClose,
  opportunityId,
  taskId,
  onPaymentReceived,
  onWontPay,
  contactName,
}: PaymentFollowupModalProps) {
  const { toast } = useToast();
  const { lang } = useAdminLang();
  const repTimezone = resolveRepTimezone();

  const [path, setPath] = useState<Path>(null);

  const [followUpDate, setFollowUpDate] = useState(todayLocalString());
  const [followUpTime, setFollowUpTime] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");

  const [countdown, setCountdown] = useState(5);
  const [countdownStarted, setCountdownStarted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setPath(null);
      setFollowUpDate(todayLocalString());
      setFollowUpTime("");
      setFollowUpNotes("");
      setCountdown(5);
      setCountdownStarted(false);
      setCopied(false);
    }
  }, [open]);

  useEffect(() => {
    if (path === "wont-pay" && !countdownStarted) {
      setCountdownStarted(true);
      setCountdown(5);
    }
  }, [path, countdownStarted]);

  useEffect(() => {
    if (!countdownStarted || countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdownStarted, countdown]);

  const invalidateCaches = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/due-today"] });
    queryClient.invalidateQueries({ queryKey: ["/api/tasks/for-opportunity", opportunityId] });
    queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities/board"] });
    queryClient.invalidateQueries({ queryKey: ["/api/pipeline/opportunities", opportunityId] });
    queryClient.invalidateQueries({
      queryKey: ["/api/pipeline/opportunities", opportunityId, "activities"],
    });
  };

  const paymentReceivedMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/tasks/${taskId}/complete`, {
        outcome: "Payment received",
      });
    },
    onSuccess: () => {
      invalidateCaches();
      onPaymentReceived();
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const stillWaitingMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/tasks/${taskId}/complete`, {
        outcome: "Still waiting",
      });
      await apiRequest("POST", "/api/tasks", {
        title: FOLLOW_UP_TITLE,
        notes: followUpNotes.trim() || FOLLOW_UP_NOTES,
        taskType: "payment_followup",
        dueDate: followUpDate,
        followUpTime: followUpTime || undefined,
        followUpTimezone: repTimezone,
        opportunityId,
      });
    },
    onSuccess: () => {
      invalidateCaches();
      toast({ title: "Follow-up scheduled" });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const wontPayMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/tasks/${taskId}/complete`, {
        outcome: "Won't pay",
      });
    },
    onSuccess: () => {
      invalidateCaches();
      onWontPay();
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const isPending =
    paymentReceivedMutation.isPending ||
    stillWaitingMutation.isPending ||
    wontPayMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-md"
        data-testid="dialog-payment-followup"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle data-testid="text-payment-followup-title">
            Follow Up on Payment
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            What is the status of the payment?
          </p>
        </DialogHeader>

        {!path && (
          <>
            <div className="space-y-2 py-2">
              <Button
                className="w-full justify-start h-auto py-3 px-4"
                variant="outline"
                onClick={() => setPath("payment-received")}
                data-testid="button-payment-received"
              >
                <div className="text-left">
                  <div className="font-medium text-green-700">Payment received</div>
                  <div className="text-xs text-gray-500 mt-0.5">Client has paid — mark as won</div>
                </div>
              </Button>
              <Button
                className="w-full justify-start h-auto py-3 px-4"
                variant="outline"
                onClick={() => setPath("still-waiting")}
                data-testid="button-still-waiting"
              >
                <div className="text-left">
                  <div className="font-medium text-amber-700">Still waiting</div>
                  <div className="text-xs text-gray-500 mt-0.5">Schedule another follow-up call</div>
                </div>
              </Button>
              <Button
                className="w-full justify-start h-auto py-3 px-4"
                variant="outline"
                onClick={() => setPath("wont-pay")}
                data-testid="button-wont-pay"
              >
                <div className="text-left">
                  <div className="font-medium text-red-700">Won't pay</div>
                  <div className="text-xs text-gray-500 mt-0.5">Client declined — close this lead</div>
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

        {path === "payment-received" && (
          <>
            <div className="py-2">
              <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                Great work! Confirming will mark this opportunity as won and close it out.
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setPath(null)}
                disabled={isPending}
                data-testid="button-payment-received-back"
              >
                Back
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => paymentReceivedMutation.mutate()}
                disabled={isPending}
                data-testid="button-payment-received-confirm"
              >
                {paymentReceivedMutation.isPending ? "Saving…" : "Confirm — Mark as Won"}
              </Button>
            </DialogFooter>
          </>
        )}

        {path === "still-waiting" && (
          <>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label htmlFor="pf-date">
                  Follow-up Date <span className="text-red-500">*</span>
                </Label>
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
                  placeholder="Any context for the next follow-up call…"
                  rows={2}
                  data-testid="textarea-payment-followup-notes"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setPath(null)}
                disabled={isPending}
              >
                Back
              </Button>
              <Button
                onClick={() => stillWaitingMutation.mutate()}
                disabled={isPending || !followUpDate}
                data-testid="button-save-payment-followup"
              >
                {stillWaitingMutation.isPending ? "Saving…" : "Schedule Follow-up"}
              </Button>
            </DialogFooter>
          </>
        )}

        {path === "wont-pay" && (() => {
          const name = contactName?.trim() || (lang === "es" ? "cliente" : "there");
          const smsText = lang === "es"
            ? `Hola ${name}, gracias nuevamente por tu tiempo. Si algo cambia o decides avanzar, no dudes en comunicarte con nosotros en info@vivawebdesigns.com. Creo que podemos ayudarte a hacer crecer tu negocio.`
            : `Hey ${name}, thanks again for your time. If anything changes or you decide to move forward, feel free to reach out at info@vivawebdesigns.com. I believe we can help you grow your business.`;

          return (
            <>
              <div className="py-2 space-y-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {lang === "es" ? "Mensaje de cierre para enviar" : "Closing message to send"}
                </p>
                <div className="relative rounded-xl bg-gray-100 dark:bg-gray-800 px-4 py-3 text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                  {smsText}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(smsText).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      });
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    title={lang === "es" ? "Copiar mensaje" : "Copy message"}
                    data-testid="button-copy-wont-pay-sms"
                  >
                    {copied
                      ? <Check className="w-3.5 h-3.5 text-green-600" />
                      : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => { setPath(null); setCountdownStarted(false); setCountdown(5); setCopied(false); }}
                  disabled={isPending}
                >
                  {lang === "es" ? "Atrás" : "Back"}
                </Button>
                <Button
                  variant="destructive"
                  disabled={countdown > 0 || isPending}
                  onClick={() => wontPayMutation.mutate()}
                  data-testid="button-wont-pay-confirm"
                >
                  {wontPayMutation.isPending
                    ? (lang === "es" ? "Cerrando…" : "Closing…")
                    : countdown > 0
                    ? (lang === "es" ? `Cerrar lead (${countdown}s)` : `Close Lead (${countdown}s)`)
                    : (lang === "es" ? "Cerrar lead" : "Close Lead")}
                </Button>
              </DialogFooter>
            </>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MessageSquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SCAN_TEXT_READ_BACK } from "@shared/scanText";
import { PROFILE_KEYS } from "./hooks";

interface ScanTextPreview {
  configured: boolean;
  businessName: string;
  hasSnapshot: boolean;
  suggestedNumber: string;
  suggestedNumberOptedOut: boolean;
  script: string;
  message: string;
  competitor: { businessName: string; hasSnapshot: boolean } | null;
  canEditMessage: boolean;
  existingSend: { status: string; toNumber: string; sentAt: string; sentBy: string | null } | null;
}

/**
 * Texts the lead their scan picture after they agree on the call, following the approved 10DLC script.
 * With competitorSnapshotUrl, the same one text also carries the linked competitor's report.
 */
export function TextScanDialog({
  leadId,
  reportId,
  snapshotUrl,
  competitorSnapshotUrl,
  open,
  onOpenChange,
}: {
  leadId: string;
  reportId: string;
  snapshotUrl: string;
  competitorSnapshotUrl?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [toNumber, setToNumber] = useState("");
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("");

  const previewKey = [`/api/crm/leads/${leadId}/scan-text`, reportId];
  const { data: preview, isLoading, error } = useQuery<ScanTextPreview>({
    queryKey: previewKey,
    queryFn: async () => {
      const response = await fetch(
        `/api/crm/leads/${encodeURIComponent(leadId)}/scan-text?reportId=${encodeURIComponent(reportId)}`,
        { credentials: "include" },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Could not prepare the scan text");
      return body;
    },
    enabled: open,
  });

  const includeCompetitor = !!competitorSnapshotUrl;
  const competitor = includeCompetitor ? preview?.competitor ?? null : null;
  const script = preview?.script ?? "";
  const approvedMessage = preview?.message ?? "";

  useEffect(() => {
    if (!open || !preview) return;
    setToNumber(preview.suggestedNumber);
    setMessage(approvedMessage);
    setConsent(false);
  }, [open, preview, approvedMessage]);

  const send = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/crm/leads/${encodeURIComponent(leadId)}/scan-text`, {
        reportId,
        toNumber,
        consent: true,
        includeCompetitor,
        ...(preview?.canEditMessage ? { message } : {}),
      });
      return response.json() as Promise<{ toNumber: string }>;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: previewKey });
      queryClient.invalidateQueries({ queryKey: ["/api/quo/conversations", leadId] });
      queryClient.invalidateQueries({ queryKey: PROFILE_KEYS.all });
      toast({
        title: includeCompetitor ? "Both scans texted" : "Scan texted",
        description: `The ${includeCompetitor ? "scan pictures are" : "scan picture is"} on its way to ${result.toNumber}.`,
      });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Scan not sent", description: err.message, variant: "destructive" });
    },
  });

  const digits = toNumber.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  const missingCompetitor = includeCompetitor && !preview?.competitor?.hasSnapshot;
  const blocked = !preview?.configured || !preview.hasSnapshot || !!preview.existingSend || missingCompetitor;
  const canSend = !blocked && consent && digits.length === 10 && !!message.trim() && !send.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!send.isPending) onOpenChange(next); }}>
      <DialogContent className="max-h-[94dvh] overflow-y-auto sm:max-w-xl" data-testid="modal-text-scan">
        <DialogHeader>
          <DialogTitle>{includeCompetitor ? "Text both scans" : "Text scan"}</DialogTitle>
          <DialogDescription>
            Read the script to the lead, wait for a clear yes, then read their mobile number back.
          </DialogDescription>
        </DialogHeader>

        {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

        {preview && (
          <div className="space-y-4">
            {preview.existingSend && (
              <p className="rounded bg-amber-50 p-2 text-sm text-amber-900" role="status" data-testid="text-scan-already-sent">
                Already texted to {preview.existingSend.toNumber}
                {preview.existingSend.sentBy ? ` by ${preview.existingSend.sentBy}` : ""} on{" "}
                {new Date(preview.existingSend.sentAt).toLocaleDateString("en-US")} ({preview.existingSend.status}).
                Each lead gets one scan text.
              </p>
            )}
            {!preview.configured && (
              <p className="rounded bg-amber-50 p-2 text-sm text-amber-900" role="status">
                Texting isn't connected to Twilio yet, so nothing can be sent.
              </p>
            )}
            {missingCompetitor && (
              <p className="rounded bg-amber-50 p-2 text-sm text-amber-900" role="status">
                This lead's competitor report has no finished snapshot, so both scans can't be sent.
              </p>
            )}
            {!preview.hasSnapshot && (
              <p className="rounded bg-amber-50 p-2 text-sm text-amber-900" role="status">
                Generate the finished snapshot before texting this report.
              </p>
            )}

            <div className="space-y-1.5">
              <Label>1. Read this to {preview.businessName}</Label>
              <blockquote className="rounded-lg border bg-slate-50 p-3 text-sm leading-6 text-slate-800" data-testid="text-scan-script">
                “{script}”
              </blockquote>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`text-scan-number-${reportId}`}>2. Their mobile number, read back to them</Label>
              <Input
                id={`text-scan-number-${reportId}`}
                type="tel"
                inputMode="tel"
                value={toNumber}
                onChange={(event) => setToNumber(event.target.value)}
                placeholder="(704) 555-0123"
                disabled={blocked}
                data-testid="input-text-scan-number"
              />
              <p className="text-xs text-gray-500">
                Say: “{SCAN_TEXT_READ_BACK}” The number on file is often the business landline, which can't receive pictures.
              </p>
              {preview.suggestedNumberOptedOut && digits === preview.suggestedNumber.replace(/\D/g, "") && (
                <p className="text-xs text-red-600">This number replied STOP and can't be texted.</p>
              )}
            </div>

            <label className="flex items-start gap-2 text-sm" htmlFor={`text-scan-consent-${reportId}`}>
              <Checkbox
                id={`text-scan-consent-${reportId}`}
                checked={consent}
                onCheckedChange={(checked) => setConsent(checked === true)}
                disabled={blocked}
                data-testid="checkbox-text-scan-consent"
              />
              <span>
                3. The lead said yes to one text with {competitor ? `their scan and ${competitor.businessName}'s` : "their scan"}, and I read
                the number back to them.
              </span>
            </label>

            <div className={`grid gap-3 ${includeCompetitor ? "sm:grid-cols-[1fr_96px_96px]" : "sm:grid-cols-[1fr_96px]"}`}>
              <div className="space-y-1.5">
                <Label htmlFor={`text-scan-message-${reportId}`}>Message</Label>
                {preview.canEditMessage ? (
                  <Textarea
                    id={`text-scan-message-${reportId}`}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={4}
                    maxLength={1600}
                    disabled={blocked}
                    className="resize-none text-sm"
                    data-testid="textarea-text-scan-message"
                  />
                ) : (
                  <p className="rounded-lg border bg-slate-50 p-3 text-sm" data-testid="text-scan-message">{approvedMessage}</p>
                )}
                {preview.canEditMessage && message.trim() !== approvedMessage && (
                  <p className="text-xs text-amber-700">
                    Edited from the approved wording. The approved campaign covers the original text.
                  </p>
                )}
              </div>
              <img src={snapshotUrl} alt="Scan picture that will be attached" className="h-[170px] w-[96px] rounded border object-cover" />
              {competitorSnapshotUrl && (
                <img
                  src={competitorSnapshotUrl}
                  alt="Competitor scan picture that will be attached"
                  className="h-[170px] w-[96px] rounded border object-cover"
                />
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={send.isPending}>Cancel</Button>
          <Button
            onClick={() => send.mutate()}
            disabled={!canSend}
            className="bg-violet-600 hover:bg-violet-700"
            data-testid="button-send-text-scan"
          >
            {send.isPending ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-1.5 h-4 w-4" />}
            {send.isPending ? "Sending…" : includeCompetitor ? "Send both scans" : "Send scan text"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
